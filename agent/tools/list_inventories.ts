import { z } from "zod";
import { listInventories } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "List inventories the current user can access.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const inventories = await listInventories(tenantFromTool(ctx));
    return {
      inventories: inventories.map((row) => ({
        id: row.id,
        title: row.title,
        adapter: row.adapter,
        spreadsheetId: row.spreadsheetId,
        sheetTitle: row.sheetTitle,
      })),
    };
  },
});
