import { z } from "zod";
import { inspectInventory } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "Pull the latest schema and rows from the source sheet into Invento.",
  inputSchema: z.object({
    inventoryId: z.string().min(1),
  }),
  async execute({ inventoryId }, ctx) {
    const meta = await inspectInventory(tenantFromTool(ctx), inventoryId);
    return { id: meta.id, title: meta.title, schema: meta.schema, synced: true };
  },
});
