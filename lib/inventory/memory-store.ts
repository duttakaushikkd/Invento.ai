import { INVENTO_ID_FIELD, type Filter, type InventoryRecord, type InventoryStore, type JsonObject, type Page, type QueryOpts } from "./types";
import { inferSchema, matchesFilter, rowToObject, validateAgainstSchema } from "./schema";

export const DEMO_HEADERS = ["sku", "name", "qty", "warehouse", "status"];
export const DEMO_ROWS: unknown[][] = [
  ["SKU-1", "Walnut Desk", "12", "East", "active"],
  ["SKU-2", "Oak Chair", "4", "West", "active"],
  ["SKU-3", "Lamp", "0", "East", "backorder"],
  ["", "Mystery Item", "2", "East", "active"],
  ["SKU-5", "Shelf", "nine", "North", "active"],
];

export class MemoryInventoryStore implements InventoryStore {
  private rows: JsonObject[];
  private schema;

  constructor(headerRow: unknown[] = DEMO_HEADERS, dataRows: unknown[][] = DEMO_ROWS) {
    this.schema = inferSchema(headerRow, dataRows);
    const sourceHeaders = this.schema.fields.filter((field) => field.name !== INVENTO_ID_FIELD).map((field) => field.name);
    this.rows = dataRows.map((row) => {
      const data = rowToObject(sourceHeaders, row, this.schema);
    if (!data[this.schema.primaryKey]) data[this.schema.primaryKey] = crypto.randomUUID();
      return data;
    });
  }

  async inspect() {
    return this.schema;
  }

  async query(filters: Filter[] = [], opts: QueryOpts = {}): Promise<Page<InventoryRecord>> {
    let items = this.rows.filter((row) => filters.every((filter) => matchesFilter(row, filter.field, filter.op, filter.value)));
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
      items: items.slice(offset, offset + limit).map((data) => ({
        id: String(data[this.schema.primaryKey]),
        data,
      })),
    };
  }

  async get(id: string) {
    const data = this.rows.find((row) => String(row[this.schema.primaryKey]) === id);
    return data ? { id, data } : null;
  }

  async create(input: JsonObject) {
    const data = validateAgainstSchema(this.schema, input, "create");
    if (!data[this.schema.primaryKey]) data[this.schema.primaryKey] = crypto.randomUUID();
    this.rows.push(data);
    return { id: String(data[this.schema.primaryKey]), data };
  }

  async update(id: string, patch: JsonObject) {
    const index = this.rows.findIndex((row) => String(row[this.schema.primaryKey]) === id);
    if (index < 0) throw new Error(`Record ${id} not found`);
    const data = { ...this.rows[index], ...validateAgainstSchema(this.schema, patch, "update") };
    this.rows[index] = data;
    return { id, data };
  }

  async delete(id: string) {
    const index = this.rows.findIndex((row) => String(row[this.schema.primaryKey]) === id);
    if (index < 0) throw new Error(`Record ${id} not found`);
    this.rows.splice(index, 1);
  }
}
