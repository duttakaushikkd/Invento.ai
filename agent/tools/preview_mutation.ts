import { z } from "zod";
import { always } from "eve/tools/approval";
import { previewMutation } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

const jsonValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export default defineTool({
  description:
    "Preview a create, update, or delete. Does not write until commit_mutation runs after the user confirms.",
  inputSchema: z.object({
    inventoryId: z.string().min(1),
    op: z.enum(["create", "update", "delete"]),
    recordId: z.string().optional(),
    data: z.record(z.string(), jsonValue).optional(),
    idempotencyKey: z.string().optional(),
  }),
  approval: always(),
  async execute(input, ctx) {
    return previewMutation(tenantFromTool(ctx), input);
  },
});
