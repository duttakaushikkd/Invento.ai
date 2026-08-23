import { z } from "zod";
import { inspectInventory } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "Inspect the inferred schema for an inventory before querying or mutating it.",
  inputSchema: z.object({
    inventoryId: z.string().min(1),
  }),
  async execute({ inventoryId }, ctx) {
    const meta = await inspectInventory(tenantFromTool(ctx), inventoryId);
    return {
      id: meta.id,
      title: meta.title,
      adapter: meta.adapter,
      schema: meta.schema,
    };
  },
});
