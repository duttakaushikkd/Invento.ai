import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/inventory/db.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "",
  },
});
