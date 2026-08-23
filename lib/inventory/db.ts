import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { InferredSchema, JsonObject } from "./types";

export const googleConnections = pgTable("google_connections", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  googleEmail: text("google_email"),
  encryptedTokens: text("encrypted_tokens").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventories = pgTable("inventories", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  title: text("title").notNull(),
  adapter: text("adapter").notNull(),
  spreadsheetId: text("spreadsheet_id"),
  sheetTitle: text("sheet_title"),
  schemaJson: jsonb("schema_json").$type<InferredSchema>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recordCache = pgTable("record_cache", {
  id: text("id").primaryKey(),
  inventoryId: text("inventory_id").notNull(),
  externalId: text("external_id").notNull(),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  rowNumber: integer("row_number"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mutationRequests = pgTable("mutation_requests", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  inventoryId: text("inventory_id").notNull(),
  op: text("op").notNull(),
  recordId: text("record_id"),
  proposed: jsonb("proposed").$type<JsonObject>().notNull(),
  before: jsonb("before").$type<JsonObject | null>(),
  status: text("status").notNull(),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  inventoryId: text("inventory_id"),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgSettings = pgTable("org_settings", {
  orgId: text("org_id").primaryKey(),
  autoApplySmallWrites: boolean("auto_apply_small_writes").default(false).notNull(),
});

let dbSingleton: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!dbSingleton) {
    dbSingleton = drizzle(neon(url));
  }
  return dbSingleton;
}

export function newId(): string {
  return randomUUID();
}
