import { jsonHandler } from "@/lib/api";
import { connectSheet } from "@/lib/inventory/engine";

export const POST = async (request: Request) => {
  const body = (await request.json()) as { spreadsheetId: string; sheetTitle: string; title?: string };
  return jsonHandler((tenant) => connectSheet(tenant, body));
};
