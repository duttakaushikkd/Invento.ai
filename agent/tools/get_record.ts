import { z } from "zod";
import { getRecord } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "Fetch a single inventory record by stable id.",
  inputSchema: z.object({
    inventoryId: z.string().min(1),
    recordId: z.string().min(1),
  }),
  async execute({ inventoryId, recordId }, ctx) {
    const record = await getRecord(tenantFromTool(ctx), inventoryId, recordId);
    if (!record) throw new Error("Record not found");
    return record;
  },
});
