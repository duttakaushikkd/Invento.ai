import { jsonHandler } from "@/lib/api";
import { googleTokens } from "@/lib/inventory/engine";
import { listWorksheets } from "@/lib/inventory/sheets-store";

export const GET = async (request: Request) => {
  const spreadsheetId = new URL(request.url).searchParams.get("spreadsheetId");
  if (!spreadsheetId) return Response.json({ error: "spreadsheetId required" }, { status: 400 });
  return jsonHandler(async (tenant) => {
    const tokens = await googleTokens(tenant);
    if (!tokens) throw new Error("Google is not connected");
    return { worksheets: await listWorksheets(tokens, spreadsheetId) };
  });
};
