import { jsonHandler } from "@/lib/api";
import { getRecord } from "@/lib/inventory/engine";

export const GET = async (_request: Request, context: { params: Promise<{ inventoryId: string; recordId: string }> }) => {
  const { inventoryId, recordId } = await context.params;
  return jsonHandler(async (tenant) => {
    const record = await getRecord(tenant, inventoryId, recordId);
    if (!record) throw new Error("Record not found");
    return record;
  });
};
