import { z } from "zod";
import { queryRecords } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "Query inventory records with optional filters. Never invent column names — inspect_schema first.",
  inputSchema: z.object({
    inventoryId: z.string().min(1),
    filters: z
      .array(
        z.object({
          field: z.string(),
          op: z.enum(["eq", "neq", "contains", "gt", "gte", "lt", "lte"]),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
        }),
      )
      .optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  async execute(input, ctx) {
    return queryRecords(tenantFromTool(ctx), input.inventoryId, input.filters ?? [], {
      sortField: input.sortField,
      sortDir: input.sortDir,
      limit: input.limit,
      offset: input.offset,
    });
  },
});
