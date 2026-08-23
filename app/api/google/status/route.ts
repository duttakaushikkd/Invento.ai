import { jsonHandler } from "@/lib/api";
import { googleStatus, googleTokens } from "@/lib/inventory/engine";
import { listSpreadsheets } from "@/lib/inventory/sheets-store";

export const GET = () =>
  jsonHandler(async (tenant) => {
    const status = await googleStatus(tenant);
    if (!status.connected) return { ...status, spreadsheets: [] };
    const tokens = await googleTokens(tenant);
    const spreadsheets = tokens ? await listSpreadsheets(tokens) : [];
    return { ...status, spreadsheets };
  });
