import { defineTool } from "eve/tools";
import type { ToolContext } from "eve/tools";
import { tenantFromPrincipal } from "../../lib/inventory/identity";
import type { Tenant } from "../../lib/inventory/types";

export function tenantFromTool(ctx: ToolContext): Tenant {
  const auth = (ctx as { session?: { auth?: { current?: { principalId?: string; attributes?: Record<string, string> } } } }).session?.auth?.current;
  const principalId = auth?.principalId ?? auth?.attributes?.userId ?? "local-dev";
  return tenantFromPrincipal(principalId, auth?.attributes?.userId ?? principalId);
}

export { defineTool };
