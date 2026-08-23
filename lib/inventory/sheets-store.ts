import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import {
  INVENTO_ID_FIELD,
  type Filter,
  type InventoryRecord,
  type InventoryStore,
  type JsonObject,
  type Page,
  type QueryOpts,
} from "./types";
import { inferSchema, matchesFilter, rowToObject, validateAgainstSchema } from "./schema";

function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/google/callback`;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

export function googleAuthUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth = google.oauth2({ version: "v2", auth: client });
  const me = await oauth.userinfo.get();
  return { tokens, email: me.data.email ?? null };
}

function apis(tokens: Credentials) {
  const client = oauthClient();
  client.setCredentials(tokens);
  return {
    sheets: google.sheets({ version: "v4", auth: client }),
    drive: google.drive({ version: "v3", auth: client }),
  };
}

export class GoogleSheetsStore implements InventoryStore {
  private cache: { objects: JsonObject[]; schema: ReturnType<typeof inferSchema> } | null = null;

  constructor(
    private readonly tokens: Credentials,
    private readonly spreadsheetId: string,
    private readonly sheetTitle: string,
    private readonly pkHint?: string,
  ) {}

  private quotedRange() {
    return `'${this.sheetTitle.replace(/'/g, "''")}'`;
  }

  private async load() {
    if (this.cache) return this.cache;
    const { sheets } = apis(this.tokens);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.quotedRange(),
    });
    const values = (res.data.values ?? []) as unknown[][];
    const headerRow = values[0] ?? [];
    const dataRows = values.slice(1);
    let schema = inferSchema(headerRow, dataRows, this.pkHint);
    const sourceHeaders = schema.fields.filter((field) => field.name !== INVENTO_ID_FIELD || headerRow.map(String).includes(INVENTO_ID_FIELD)).map((field) => field.name).slice(0, Math.max(headerRow.length, 1));
    const objects = dataRows.map((row) => {
      const data = rowToObject(sourceHeaders, row, schema);
      if (!data[schema.primaryKey]) data[schema.primaryKey] = crypto.randomUUID();
      return data;
    });
    if (schema.primaryKey === INVENTO_ID_FIELD && !headerRow.map(String).includes(INVENTO_ID_FIELD)) {
      await this.persist(schema.fields.map((field) => field.name), objects);
      schema = inferSchema(schema.fields.map((field) => field.name), objects.map((object) => schema.fields.map((field) => object[field.name] ?? "")));
    }
    this.cache = { objects, schema };
    return this.cache;
  }

  private async persist(headers: string[], objects: JsonObject[]) {
    const { sheets } = apis(this.tokens);
    await sheets.spreadsheets.values.clear({ spreadsheetId: this.spreadsheetId, range: this.quotedRange() });
    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedRange()}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers, ...objects.map((object) => headers.map((header) => object[header] ?? ""))] },
    });
    this.cache = null;
  }

  async inspect() {
    return (await this.load()).schema;
  }

  async query(filters: Filter[] = [], opts: QueryOpts = {}): Promise<Page<InventoryRecord>> {
    const { objects, schema } = await this.load();
    let items = objects.filter((row) => filters.every((filter) => matchesFilter(row, filter.field, filter.op, filter.value)));
    if (opts.sortField) {
      const dir = opts.sortDir === "desc" ? -1 : 1;
      const field = opts.sortField;
      items = [...items].sort((a, b) => ((a[field] ?? "") > (b[field] ?? "") ? dir : -dir));
    }
    const total = items.length;
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 50;
    return {
      total,
      items: items.slice(offset, offset + limit).map((data) => ({ id: String(data[schema.primaryKey]), data })),
    };
  }

  async get(id: string) {
    const page = await this.query([], { limit: 20_000 });
    return page.items.find((item) => item.id === id) ?? null;
  }

  async create(input: JsonObject) {
    const loaded = await this.load();
    const data = validateAgainstSchema(loaded.schema, input, "create");
    if (!data[loaded.schema.primaryKey]) data[loaded.schema.primaryKey] = crypto.randomUUID();
    await this.persist(loaded.schema.fields.map((field) => field.name), [...loaded.objects, data]);
    return { id: String(data[loaded.schema.primaryKey]), data };
  }

  async update(id: string, patch: JsonObject) {
    const loaded = await this.load();
    const index = loaded.objects.findIndex((row) => String(row[loaded.schema.primaryKey]) === id);
    if (index < 0) throw new Error(`Record ${id} not found`);
    const data = { ...loaded.objects[index], ...validateAgainstSchema(loaded.schema, patch, "update") };
    const next = [...loaded.objects];
    next[index] = data;
    await this.persist(loaded.schema.fields.map((field) => field.name), next);
    return { id, data };
  }

  async delete(id: string) {
    const loaded = await this.load();
    const next = loaded.objects.filter((row) => String(row[loaded.schema.primaryKey]) !== id);
    if (next.length === loaded.objects.length) throw new Error(`Record ${id} not found`);
    await this.persist(loaded.schema.fields.map((field) => field.name), next);
  }
}

export async function listSpreadsheets(tokens: Credentials) {
  const { drive } = apis(tokens);
  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: "files(id,name)",
    pageSize: 50,
  });
  return res.data.files ?? [];
}

export async function listWorksheets(tokens: Credentials, spreadsheetId: string) {
  const { sheets } = apis(tokens);
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? []).map((sheet) => ({
    title: sheet.properties?.title ?? "Sheet1",
    sheetId: sheet.properties?.sheetId,
  }));
}
