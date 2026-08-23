import { jsonHandler } from "@/lib/api";
import { queryRecords } from "@/lib/inventory/engine";
import type { Filter } from "@/lib/inventory/types";

export const GET = async (request: Request, context: { params: Promise<{ inventoryId: string }> }) => {
  const { inventoryId } = await context.params;
  const url = new URL(request.url);
  const field = url.searchParams.get("field");
  const op = url.searchParams.get("op");
  const value = url.searchParams.get("value");
  const filters: Filter[] =
    field && op ? [{ field, op: op as Filter["op"], value: value ?? "" }] : [];
  return jsonHandler((tenant) =>
    queryRecords(tenant, inventoryId, filters, {
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
      sortField: url.searchParams.get("sortField") ?? undefined,
    }),
  );
};
