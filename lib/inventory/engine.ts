import { and, eq } from "drizzle-orm";
import type { Credentials } from "google-auth-library";
import {
  auditEvents,
  getDb,
  googleConnections,
  inventories,
  mutationRequests,
  newId,
} from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { MemoryInventoryStore } from "./memory-store";
import { GoogleSheetsStore } from "./sheets-store";
import { mutationPolicy } from "./policy";
import type {
  Filter,
  InventoryMeta,
  InventoryRecord,
  InventoryStore,
  JsonObject,
  MutationOp,
  QueryOpts,
  Tenant,
} from "./types";

export type MutationPreview = {
  id: string;
  orgId: string;
  inventoryId: string;
  op: MutationOp;
  recordId?: string;
  proposed: JsonObject;
  before: JsonObject | null;
  warnings: string[];
  status: "previewed" | "committed" | "cancelled";
  idempotencyKey: string | null;
};

const memInventories = new Map<string, InventoryMeta>();
const memStores = new Map<string, MemoryInventoryStore>();
const memMutations = new Map<string, MutationPreview>();
const memConnections = new Map<string, { orgId: string; googleEmail: string | null; encryptedTokens: string }>();

function tryDb() {
  try {
    return getDb();
  } catch {
    return null;
  }
}

function mapInventory(row: typeof inventories.$inferSelect): InventoryMeta {
  return {
    id: row.id,
    orgId: row.orgId,
    title: row.title,
    adapter: row.adapter as InventoryMeta["adapter"],
    spreadsheetId: row.spreadsheetId,
    sheetTitle: row.sheetTitle,
    schema: row.schemaJson,
  };
}

async function listMeta(orgId: string): Promise<InventoryMeta[]> {
  const db = tryDb();
  if (!db) return [...memInventories.values()].filter((row) => row.orgId === orgId);
  const rows = await db.select().from(inventories).where(eq(inventories.orgId, orgId));
  return rows.map(mapInventory);
}

async function getMeta(orgId: string, id: string): Promise<InventoryMeta | null> {
  const db = tryDb();
  if (!db) {
    const row = memInventories.get(id);
    return row?.orgId === orgId ? row : null;
  }
  const rows = await db.select().from(inventories).where(and(eq(inventories.orgId, orgId), eq(inventories.id, id)));
  return rows[0] ? mapInventory(rows[0]) : null;
}

async function saveMeta(row: InventoryMeta) {
  memInventories.set(row.id, row);
  const db = tryDb();
  if (!db) return;
  await db
    .insert(inventories)
    .values({
      id: row.id,
      orgId: row.orgId,
      title: row.title,
      adapter: row.adapter,
      spreadsheetId: row.spreadsheetId ?? null,
      sheetTitle: row.sheetTitle ?? null,
      schemaJson: row.schema,
    })
    .onConflictDoUpdate({
      target: inventories.id,
      set: {
        title: row.title,
        schemaJson: row.schema,
        spreadsheetId: row.spreadsheetId ?? null,
        sheetTitle: row.sheetTitle ?? null,
      },
    });
}

export async function ensureDemoInventory(tenant: Tenant): Promise<InventoryMeta> {
  const existing = (await listMeta(tenant.orgId)).find((row) => row.adapter === "memory");
  if (existing) {
    if (!memStores.has(existing.id)) memStores.set(existing.id, new MemoryInventoryStore());
    return existing;
  }
  const store = new MemoryInventoryStore();
  const schema = await store.inspect();
  const row: InventoryMeta = {
    id: newId(),
    orgId: tenant.orgId,
    title: "Demo warehouse",
    adapter: "memory",
    schema,
  };
  memStores.set(row.id, store);
  await saveMeta(row);
  return row;
}

async function storeFor(tenant: Tenant, inventoryId: string): Promise<{ meta: InventoryMeta; store: InventoryStore }> {
  await ensureDemoInventory(tenant);
  const meta = await getMeta(tenant.orgId, inventoryId);
  if (!meta) throw new Error("Inventory not found");
  if (meta.adapter === "memory") {
    const store = memStores.get(meta.id) ?? new MemoryInventoryStore();
    memStores.set(meta.id, store);
    return { meta, store };
  }
  const tokens = await googleTokens(tenant);
  if (!tokens) throw new Error("Google Sheets is not connected");
  if (!meta.spreadsheetId || !meta.sheetTitle) throw new Error("Sheet binding is incomplete");
  return { meta, store: new GoogleSheetsStore(tokens, meta.spreadsheetId, meta.sheetTitle, meta.schema.primaryKey) };
}

export async function listInventories(tenant: Tenant) {
  await ensureDemoInventory(tenant);
  return listMeta(tenant.orgId);
}

export async function inspectInventory(tenant: Tenant, inventoryId: string) {
  const { meta, store } = await storeFor(tenant, inventoryId);
  meta.schema = await store.inspect();
  await saveMeta(meta);
  return meta;
}

export async function queryRecords(tenant: Tenant, inventoryId: string, filters: Filter[] = [], opts: QueryOpts = {}) {
  const { store } = await storeFor(tenant, inventoryId);
  return store.query(filters, opts);
}

export async function getRecord(tenant: Tenant, inventoryId: string, recordId: string) {
  const { store } = await storeFor(tenant, inventoryId);
  return store.get(recordId);
}

export async function previewMutation(
  tenant: Tenant,
  input: { inventoryId: string; op: MutationOp; recordId?: string; data?: JsonObject; idempotencyKey?: string },
): Promise<MutationPreview> {
  const { store, meta } = await storeFor(tenant, input.inventoryId);
  const policy = mutationPolicy(input.op, 1, false);
  if (policy.capped) throw new Error(policy.reason);
  let before: JsonObject | null = null;
  let proposed: JsonObject = input.data ?? {};
  if (input.op !== "create") {
    if (!input.recordId) throw new Error("recordId is required");
    const existing = await store.get(input.recordId);
    if (!existing) throw new Error("Record not found");
    before = existing.data;
    proposed = input.op === "update" ? { ...existing.data, ...(input.data ?? {}) } : existing.data;
  }
  const mutation: MutationPreview = {
    id: newId(),
    orgId: tenant.orgId,
    inventoryId: meta.id,
    op: input.op,
    recordId: input.recordId,
    proposed,
    before,
    warnings: [policy.reason],
    status: "previewed",
    idempotencyKey: input.idempotencyKey ?? null,
  };
  memMutations.set(mutation.id, mutation);
  const db = tryDb();
  if (db) {
    await db.insert(mutationRequests).values({
      id: mutation.id,
      orgId: mutation.orgId,
      inventoryId: mutation.inventoryId,
      op: mutation.op,
      recordId: mutation.recordId,
      proposed: mutation.proposed,
      before: mutation.before,
      status: mutation.status,
      idempotencyKey: mutation.idempotencyKey,
    });
  }
  return mutation;
}

export async function commitMutation(tenant: Tenant, mutationId: string) {
  const local = memMutations.get(mutationId);
  const db = tryDb();
  const row =
    local?.orgId === tenant.orgId
      ? local
      : db
        ? (await db.select().from(mutationRequests).where(and(eq(mutationRequests.orgId, tenant.orgId), eq(mutationRequests.id, mutationId))))[0]
        : undefined;
  if (!row) throw new Error("Mutation not found");
  const current: MutationPreview =
    "warnings" in row
      ? row
      : {
          id: row.id,
          orgId: row.orgId,
          inventoryId: row.inventoryId,
          op: row.op as MutationOp,
          recordId: row.recordId ?? undefined,
          proposed: row.proposed,
          before: row.before,
          warnings: [],
          status: row.status as MutationPreview["status"],
          idempotencyKey: row.idempotencyKey,
        };
  if (current.status === "committed") {
    return current.recordId ? getRecord(tenant, current.inventoryId, current.recordId) : { deleted: true as const, id: current.recordId };
  }
  const { store } = await storeFor(tenant, current.inventoryId);
  let result: InventoryRecord | { deleted: true; id: string };
  if (current.op === "create") result = await store.create(current.proposed);
  else if (current.op === "update") result = await store.update(current.recordId!, current.proposed);
  else {
    await store.delete(current.recordId!);
    result = { deleted: true, id: current.recordId! };
  }
  current.status = "committed";
  memMutations.set(current.id, current);
  if (db) {
    await db.update(mutationRequests).set({ status: "committed" }).where(eq(mutationRequests.id, current.id));
    await db.insert(auditEvents).values({
      id: newId(),
      orgId: tenant.orgId,
      inventoryId: current.inventoryId,
      actorId: tenant.actorId,
      action: "mutation.commit",
      payload: { op: current.op, mutationId: current.id },
    });
  }
  return result;
}

export async function saveGoogleConnection(tenant: Tenant, tokens: Credentials, email: string | null) {
  const encryptedTokens = encryptSecret(JSON.stringify(tokens));
  memConnections.set(tenant.orgId, { orgId: tenant.orgId, googleEmail: email, encryptedTokens });
  const db = tryDb();
  if (db) {
    await db
      .insert(googleConnections)
      .values({ id: tenant.orgId, orgId: tenant.orgId, googleEmail: email, encryptedTokens })
      .onConflictDoUpdate({
        target: googleConnections.id,
        set: { encryptedTokens, googleEmail: email, updatedAt: new Date() },
      });
  }
}

export async function connectSheet(tenant: Tenant, input: { spreadsheetId: string; sheetTitle: string; title?: string }) {
  const tokens = await googleTokens(tenant);
  if (!tokens) throw new Error("Connect Google first");
  const store = new GoogleSheetsStore(tokens, input.spreadsheetId, input.sheetTitle);
  const schema = await store.inspect();
  const row: InventoryMeta = {
    id: newId(),
    orgId: tenant.orgId,
    title: input.title ?? input.sheetTitle,
    adapter: "google_sheets",
    spreadsheetId: input.spreadsheetId,
    sheetTitle: input.sheetTitle,
    schema,
  };
  await saveMeta(row);
  return row;
}

export async function googleStatus(tenant: Tenant) {
  const local = memConnections.get(tenant.orgId);
  if (local) return { connected: true, email: local.googleEmail };
  const db = tryDb();
  if (!db) return { connected: false, email: null };
  const rows = await db.select().from(googleConnections).where(eq(googleConnections.orgId, tenant.orgId));
  return { connected: Boolean(rows[0]), email: rows[0]?.googleEmail ?? null };
}

export async function googleTokens(tenant: Tenant): Promise<Credentials | null> {
  const local = memConnections.get(tenant.orgId);
  const db = tryDb();
  const row = local ?? (db ? (await db.select().from(googleConnections).where(eq(googleConnections.orgId, tenant.orgId)))[0] : undefined);
  if (!row) return null;
  return JSON.parse(decryptSecret(row.encryptedTokens)) as Credentials;
}

export async function getMutation(tenant: Tenant, mutationId: string) {
  const local = memMutations.get(mutationId);
  if (local?.orgId === tenant.orgId) return local;
  const db = tryDb();
  if (!db) return null;
  const rows = await db.select().from(mutationRequests).where(and(eq(mutationRequests.orgId, tenant.orgId), eq(mutationRequests.id, mutationId)));
  return rows[0] ?? null;
}

export { googleAuthUrl, exchangeGoogleCode, listSpreadsheets, listWorksheets } from "./sheets-store";

