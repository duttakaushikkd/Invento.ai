"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentChat } from "@/app/_components/agent-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryMeta, InventoryRecord } from "@/lib/inventory/types";

type GoogleStatus = {
  connected: boolean;
  email: string | null;
  spreadsheets?: { id?: string | null; name?: string | null }[];
};

export function InventoryWorkspace() {
  const [inventories, setInventories] = useState<InventoryMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [google, setGoogle] = useState<GoogleStatus>({ connected: false, email: null });
  const [sheetTitle, setSheetTitle] = useState("Sheet1");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [error, setError] = useState<string>();
  const selected = inventories.find((row) => row.id === selectedId);
  const columns = useMemo(() => selected?.schema.fields.map((field) => field.name) ?? [], [selected]);

  const refresh = useCallback(async () => {
    const [inventoryRes, googleRes] = await Promise.all([fetch("/api/inventories"), fetch("/api/google/status")]);
    const inventoryJson = (await inventoryRes.json()) as InventoryMeta[] | { error: string };
    if (Array.isArray(inventoryJson)) {
      setInventories(inventoryJson);
      setSelectedId((current) => current ?? inventoryJson[0]?.id);
    }
    if (googleRes.ok) setGoogle((await googleRes.json()) as GoogleStatus);
  }, []);

  const loadRecords = useCallback(async (inventoryId: string) => {
    const res = await fetch(`/api/inventories/${inventoryId}/records`);
    if (!res.ok) return;
    const json = (await res.json()) as { items: InventoryRecord[] };
    setRecords(json.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void loadRecords(selectedId);
  }, [selectedId, loadRecords]);

  const connectGoogle = async () => {
    const res = await fetch("/api/google/connect");
    const json = (await res.json()) as { url?: string; error?: string };
    if (json.url) window.location.href = json.url;
    else setError(json.error ?? "Google OAuth is not configured");
  };

  const attachSheet = async () => {
    setError(undefined);
    const res = await fetch("/api/inventories/connect-sheet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spreadsheetId, sheetTitle }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not attach sheet");
      return;
    }
    await refresh();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center border-b px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Invento</p>
          <h1 className="text-xl font-semibold">Schema-agnostic inventory agent</h1>
        </div>
      </header>
      {error ? <p className="border-b bg-destructive/10 px-6 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="space-y-4 border-r p-4">
          <div>
            <h2 className="mb-2 text-sm font-medium">Inventories</h2>
            <div className="space-y-2">
              {inventories.map((row) => (
                <button
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${row.id === selectedId ? "bg-secondary" : ""}`}
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  type="button"
                >
                  <div className="font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">{row.adapter}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Google Sheets</h2>
            <p className="text-xs text-muted-foreground">
              {google.connected ? `Connected as ${google.email}` : "Not connected"}
            </p>
            <Button onClick={() => void connectGoogle()} size="sm" variant="outline">
              Connect Google
            </Button>
            <Input onChange={(event) => setSpreadsheetId(event.target.value)} placeholder="Spreadsheet ID" value={spreadsheetId} />
            <Input onChange={(event) => setSheetTitle(event.target.value)} placeholder="Worksheet title" value={sheetTitle} />
            <Button onClick={() => void attachSheet()} size="sm">
              Attach sheet
            </Button>
          </div>
        </aside>
        <section className="overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">{selected?.title ?? "Records"}</h2>
            <Button onClick={() => selectedId && void loadRecords(selectedId)} size="sm" variant="outline">
              Refresh
            </Button>
          </div>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary">
                <tr>
                  {columns.map((column) => (
                    <th className="px-3 py-2 font-medium" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr className="border-t" key={record.id}>
                    {columns.map((column) => (
                      <td className="px-3 py-2" key={column}>
                        {String(record.data[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="border-l">
          <AgentChat sessionless />
        </section>
      </div>
    </div>
  );
}
