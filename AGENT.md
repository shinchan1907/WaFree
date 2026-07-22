# AGENT.md — guide for AI coding agents working on WaFree

WaFree is a self-hosted multi-WhatsApp team dashboard: Node/Express/Baileys backend + React (Vite) frontend, SQLite storage, Socket.IO realtime. Read this before changing anything.

## Repository layout

```
server/                     Node 22, TypeScript (ESM, run with tsx — no build step)
  src/index.ts              Express + Socket.IO bootstrap, static serving of ../web/dist
  src/config.ts             Env config (PORT, DATA_DIR, JWT_SECRET, ...)
  src/db/index.ts           better-sqlite3 handle + full schema (CREATE TABLE IF NOT EXISTS)
  src/auth/                 JWT login/verify, role middleware (admin | executive)
  src/routes/               REST endpoints (one file per resource)
  src/wa/manager.ts         WaManager — one Baileys socket per WhatsApp account
  src/wa/store.ts           Persistence of chats/messages + chat upsert logic
  src/wa/messageText.ts     Extracts displayable text/preview from Baileys messages
  src/automation/           Auto-reply rules, bot flow engine, scheduler, manager wiring
  src/settings.ts           Key-value settings (webhook, AI) with secret masking
  src/notify.ts             Outbound webhook notifications
  src/ai.ts                 OpenAI-compatible chat completions client
web/                        React 18 + Vite + TypeScript, pure CSR
  src/pages/                Login, Setup (first-run wizard), ChatApp, Admin, BotEditor
  src/components/           ChatList, ChatWindow, Composer, ThemeToggle, admin/* panels
  src/ThemeContext.tsx      Light & Dark mode state management (Light theme default)
  src/api.ts                fetch wrapper (JWT header, ApiResponse envelope)
  src/socket.ts             Socket.IO client singleton
  src/styles.css            Complete stylesheet with Light theme default & [data-theme="dark"]
Dockerfile / docker-compose.yml   Single-image deploy; volume at /data
```

## Golden rules

1. **API envelope** — every endpoint returns `{ success, data, error?, meta? }`. Never break this shape; the frontend `api.ts` wrapper depends on it.
2. **Access control** — executives may only touch accounts they are assigned to. Any new account-scoped route MUST use `requireAccountAccess` (or `requireAdmin`). Socket events for an account go through `WaManager.emitAccount` (executives room + admins room).
3. **Schema changes** — add new tables/columns in `server/src/db/index.ts` using `CREATE TABLE IF NOT EXISTS` / additive `ALTER TABLE` guarded by try-catch. There is no migration framework; never break existing databases.
4. **Baileys events** — all WhatsApp side effects live in `WaManager`. Persist via `store.ts` (which dedupes on `(account_id, chat_jid, msg_id)`), then emit socket events. History-sync messages must use `saveHistorical` (no unread bumps, no automation).
5. **Automation order** — incoming customer message → bots first (`runBots`), then auto-reply rules (`runAutoReplies`), first match wins. Automated sends use user id `0`. Never trigger automation on `fromMe` or historical messages (loops!).
6. **Secrets** — `ai_api_key` / `webhook_secret` are masked as `••••••••` by `getAllSettingsMasked`; the PUT handler skips masked values. Keep that behaviour.
7. **Realtime contract** — socket events: `message:new`, `chat:updated`, `account:status`, `account:qr` (admins only — QR = full account takeover). If you add events, update both `manager.ts`/`sockets.ts` and the frontend listeners.
8. **Frontend style & theme** — use CSS variables defined in `styles.css`. The app defaults to **Light Mode**, with dynamic dark theme switching via `[data-theme="dark"]`. Theme state is managed by `ThemeContext.tsx`.
9. **ESM everywhere** — server imports use `.js` extensions (`import x from './y.js'`). tsx runs TypeScript directly; there is no build output for the server.

## Commands

```bash
# server
cd server && npm run dev        # tsx watch (auto-restart)
cd server && npm run typecheck  # tsc --noEmit — MUST pass before committing

# web
cd web && npm run dev           # Vite dev server, proxies /api + /socket.io → :4000
cd web && npm run build         # tsc --noEmit && vite build — MUST pass

# full stack
docker compose up -d --build
```

## Testing checklist for changes

- `npm run typecheck` (server) and `npm run build` (web) pass with 0 errors.
- Verify Light Mode aesthetics and Dark Mode toggle functionality.
- Login as admin AND as an executive — verify executives cannot see unassigned accounts (API returns 403, UI hides them).
- If you touched `wa/` or `automation/`: link a test number, send yourself a message, verify chat list updates in realtime and automation does not reply to `fromMe` messages.
- If you touched Docker: `docker compose up -d --build` from a clean checkout, complete the setup wizard, restart the container, confirm data survives.
