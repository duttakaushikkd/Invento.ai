import { z } from "zod";
import { always } from "eve/tools/approval";
import { commitMutation } from "../../lib/inventory/engine";
import { defineTool, tenantFromTool } from "../lib/tenant";

export default defineTool({
  description: "Commit a previously previewed mutation after the user confirms the dry-run.",
  inputSchema: z.object({
    mutationId: z.string().min(1),
  }),
  approval: always(),
  async execute({ mutationId }, ctx) {
    return commitMutation(tenantFromTool(ctx), mutationId);
  },
});
