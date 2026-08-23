import { jsonHandler } from "@/lib/api";
import {
  commitMutation,
  getRecord,
  inspectInventory,
  listInventories,
  previewMutation,
  queryRecords,
} from "@/lib/inventory/engine";
import type { Filter, MutationOp } from "@/lib/inventory/types";

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const tools = [
  { name: "list_inventories", description: "List inventories" },
  { name: "inspect_schema", description: "Inspect inventory schema" },
  { name: "query_records", description: "Query records" },
  { name: "get_record", description: "Get one record" },
  { name: "preview_mutation", description: "Dry-run a write" },
  { name: "commit_mutation", description: "Commit a previewed write" },
];

export const POST = async (request: Request) => {
  const rpc = (await request.json()) as Rpc;
  return jsonHandler(async (tenant) => {
    if (rpc.method === "tools/list") return { jsonrpc: "2.0", id: rpc.id ?? null, result: { tools } };
    if (rpc.method !== "tools/call") {
      return { jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32601, message: "Method not found" } };
    }
    const name = String(rpc.params?.name ?? "");
    const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
    let result: unknown;
    if (name === "list_inventories") result = await listInventories(tenant);
    else if (name === "inspect_schema") result = await inspectInventory(tenant, String(args.inventoryId));
    else if (name === "query_records") {
      result = await queryRecords(tenant, String(args.inventoryId), (args.filters as Filter[]) ?? [], {
        limit: Number(args.limit ?? 50),
      });
    } else if (name === "get_record") result = await getRecord(tenant, String(args.inventoryId), String(args.recordId));
    else if (name === "preview_mutation") {
      result = await previewMutation(tenant, {
        inventoryId: String(args.inventoryId),
        op: args.op as MutationOp,
        recordId: args.recordId ? String(args.recordId) : undefined,
        data: args.data as Record<string, string | number | boolean | null> | undefined,
      });
    } else if (name === "commit_mutation") result = await commitMutation(tenant, String(args.mutationId));
    else throw new Error(`Unknown tool ${name}`);
    return { jsonrpc: "2.0", id: rpc.id ?? null, result };
  });
};
