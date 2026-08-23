export type FieldType = "string" | "number" | "boolean" | "date" | "enum";

export type FieldSchema = {
  name: string;
  type: FieldType;
  required: boolean;
  enumValues?: string[];
  examples?: string[];
};

export type InferredSchema = {
  fields: FieldSchema[];
  primaryKey: string;
  headerRow: number;
};

export type JsonValue = string | number | boolean | null;
export type JsonObject = Record<string, JsonValue>;

export type InventoryRecord = {
  id: string;
  data: JsonObject;
};

export type FilterOp = "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte";

export type Filter = {
  field: string;
  op: FilterOp;
  value: JsonValue;
};

export type QueryOpts = {
  sortField?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type Page<T> = {
  items: T[];
  total: number;
};

export type MutationOp = "create" | "update" | "delete";

export type InventoryMeta = {
  id: string;
  orgId: string;
  title: string;
  adapter: "memory" | "google_sheets";
  spreadsheetId?: string | null;
  sheetTitle?: string | null;
  schema: InferredSchema;
};

export const INVENTO_ID_FIELD = "_invento_id";

export interface InventoryStore {
  inspect(): Promise<InferredSchema>;
  query(filters?: Filter[], opts?: QueryOpts): Promise<Page<InventoryRecord>>;
  get(id: string): Promise<InventoryRecord | null>;
  create(input: JsonObject): Promise<InventoryRecord>;
  update(id: string, patch: JsonObject): Promise<InventoryRecord>;
  delete(id: string): Promise<void>;
}

export type Tenant = {
  orgId: string;
  actorId: string;
};

