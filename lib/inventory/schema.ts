import { INVENTO_ID_FIELD, type FieldSchema, type FieldType, type FilterOp, type InferredSchema, type JsonObject, type JsonValue } from "./types";

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeHeader(raw: string, index: number): string {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/^(\d)/, "_$1");
  return cleaned.length > 0 ? cleaned : `column_${index + 1}`;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header}_${count + 1}`;
  });
}

function inferType(values: string[]): FieldType {
  const nonempty = values.filter((value) => !isBlank(value));
  if (nonempty.length === 0) return "string";
  const unique = [...new Set(nonempty)];
  if (unique.length > 0 && unique.length <= 8 && unique.length / nonempty.length <= 0.5 && unique.every((value) => value.length <= 32)) {
    return "enum";
  }
  if (nonempty.every((value) => /^(true|false|yes|no|0|1)$/i.test(value.trim()))) return "boolean";
  if (nonempty.every((value) => !Number.isNaN(Number(value.replace(/,/g, ""))))) return "number";
  if (nonempty.every((value) => !Number.isNaN(Date.parse(value)) && /\d{4}[-/]|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(value))) return "date";
  return "string";
}

export function coerceValue(value: unknown, type: FieldType): JsonValue {
  if (isBlank(value)) return null;
  const text = String(value).trim();
  if (type === "number") {
    const n = Number(text.replace(/,/g, ""));
    return Number.isNaN(n) ? text : n;
  }
  if (type === "boolean") return /^(true|yes|1)$/i.test(text);
  return text;
}

export function inferSchema(headerRow: unknown[], sampleRows: unknown[][], primaryKeyHint?: string): InferredSchema {
  const headers = uniqueHeaders(headerRow.map((cell, index) => normalizeHeader(String(cell ?? ""), index)));
  const fields: FieldSchema[] = headers.map((name, index) => {
    const column = sampleRows.map((row) => String(row[index] ?? ""));
    const nonempty = column.filter((value) => !isBlank(value));
    const type = inferType(column);
    return {
      name,
      type,
      required: nonempty.length === sampleRows.length && sampleRows.length > 0,
      enumValues: type === "enum" ? [...new Set(nonempty)] : undefined,
      examples: nonempty.slice(0, 3),
    };
  });

  const existingPk =
    (primaryKeyHint && headers.includes(primaryKeyHint) ? primaryKeyHint : undefined) ||
    (headers.includes(INVENTO_ID_FIELD) ? INVENTO_ID_FIELD : undefined) ||
    fields.find((field) => /^(id|sku|isbn|code|uid)$/i.test(field.name))?.name;

  if (!existingPk) {
    fields.unshift({ name: INVENTO_ID_FIELD, type: "string", required: true });
  }

  return { fields, primaryKey: existingPk ?? INVENTO_ID_FIELD, headerRow: 1 };
}

export function rowToObject(headers: string[], row: unknown[], schema?: InferredSchema): JsonObject {
  const data: JsonObject = {};
  headers.forEach((header, index) => {
    const field = schema?.fields.find((item) => item.name === header);
    data[header] = field ? coerceValue(row[index], field.type) : isBlank(row[index]) ? null : String(row[index]);
  });
  return data;
}

export function matchesFilter(record: JsonObject, field: string, op: FilterOp | string, value: JsonValue): boolean {
  const left = record[field];
  if (op === "eq" || op === "eq") return left === value || String(left) === String(value);
  if (op === "neq" || op === "neq") return left !== value && String(left) !== String(value);
  if (op === "contains") return String(left ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
  const ln = Number(left);
  const rn = Number(value);
  if (Number.isNaN(ln) || Number.isNaN(rn)) return false;
  if (op === "gt") return ln > rn;
  if (op === "gte") return ln >= rn;
  if (op === "lt") return ln < rn;
  if (op === "lte") return ln <= rn;
  return false;
}

export class InventoryValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = "InventoryValidationError";
  }
}

export function validateAgainstSchema(schema: InferredSchema, input: JsonObject, mode: "create" | "update"): JsonObject {
  const unknown = Object.keys(input).filter(
    (key) => key !== INVENTO_ID_FIELD && !schema.fields.some((field) => field.name === key),
  );
  if (unknown.length > 0) {
    throw new InventoryValidationError("Unknown columns are not allowed.", [`Unknown fields: ${unknown.join(", ")}`]);
  }
  const out: JsonObject = {};
  const issues: string[] = [];
  for (const field of schema.fields) {
    if (field.name === schema.primaryKey && mode === "update") continue;
    const has = Object.prototype.hasOwnProperty.call(input, field.name);
    if (mode === "create" && field.required && (!has || input[field.name] === null || input[field.name] === "")) {
      issues.push(`${field.name} is required`);
      continue;
    }
    if (!has) continue;
    const coerced = coerceValue(input[field.name], field.type);
    if (field.type === "number" && coerced !== null && typeof coerced !== "number") {
      issues.push(`${field.name} must be a number`);
      continue;
    }
    if (field.type === "enum" && coerced !== null && field.enumValues && !field.enumValues.includes(String(coerced))) {
      issues.push(`${field.name} must be one of: ${field.enumValues.join(", ")}`);
      continue;
    }
    out[field.name] = coerced;
  }
  if (issues.length > 0) throw new InventoryValidationError("Record failed schema validation.", issues);
  return out;
}
