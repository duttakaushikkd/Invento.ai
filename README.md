# Invento

Schema-agnostic inventory agent. Connect any Google Sheet (or use the demo warehouse), inspect its columns, then query and mutate rows through chat, REST, or MCP. Writes always preview before commit.

## Stack

- eve agent + Next.js web chat
- Neon Postgres control plane
- Google Sheets adapter
- Vercel AI Gateway

## Setup

1. Node 24 (`nvm use 24`)
2. `npm install`
3. `vercel env pull .env.local --yes`
4. Optional Google OAuth: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
5. `npx drizzle-kit push`
6. `npm run dev`

Open **http://localhost:3000**. The demo inventory is available immediately, or connect Google Sheets.

## Surfaces

- Web: `/` table + agent
- REST: `/api/inventories`, `/api/mutations/preview`, `/api/mutations/:id/commit`
- MCP JSON-RPC: `POST /api/mcp`
