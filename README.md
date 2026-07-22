# WaFree — Multi-WhatsApp Team Dashboard

**Self-hosted, multi-number WhatsApp inbox for teams.** Link any number of WhatsApp / WhatsApp Business phones by QR, give your executives their own logins, and manage every conversation from one WhatsApp-Web-style dashboard — with statuses, tags, quick replies, scheduling, auto-replies, AI and a visual bot builder.

> Think "WABA-style team inbox", but self-hosted and free — powered by [Baileys](https://github.com/WhiskeySockets/Baileys) (the open-source WhatsApp Web protocol library).

---

## ✨ Features

| Area | What you get |
|---|---|
| **Multi-account** | Link unlimited WhatsApp numbers via QR (Linked Devices). Each account gets a label + color identifier everywhere in the UI. |
| **Team & roles** | **Admin** (full control) and **Executive** (agent) roles. Assign 1, 2 or more agents per WhatsApp account — executives only ever see their assigned numbers. |
| **Familiar UI** | WhatsApp Web-style dark interface: chat list, unread badges, bubbles, day separators, group sender names, full stored chat history with pagination. |
| **Workflow states** | Every chat is **Pending / On-going / Resolved**, with filter tabs and per-chat agent assignment. Incoming messages automatically re-open resolved chats. |
| **Tags** | Color-coded labels ("Lead", "VIP", "Complaint"…) on any conversation. |
| **Quick replies** | Type `/` in the composer to insert canned responses (global or per-account). |
| **Message scheduling** | Schedule any message from the clock icon; the server delivers it even if the agent is offline. Admin overview with cancel. |
| **Auto-replies** | Keyword or catch-all rules, per-account or global, fixed text **or AI-generated**, with per-contact cooldowns. |
| **Bot builder** | n8n-style drag-and-drop flow canvas: Trigger → Condition → Reply / AI Reply / Delay / Add Tag / Set Status. |
| **AI integration** | Bring any OpenAI-compatible API (OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Ollama, LM Studio…) with your own system prompt. |
| **Notifications** | Webhook alerts (Slack / n8n / Discord / custom) when an account logs out, connects, or a scheduled message fails. |
| **Onboarding** | First run shows a guided setup wizard — create the admin account and webhook in 30 seconds. No config files needed. |

## 🚀 Quick start (Docker)

```bash
git clone <your-repo-url> wafree && cd wafree

# optional but recommended for production:
cp .env.example .env        # then set JWT_SECRET (openssl rand -hex 32)

docker compose up -d
```

Open **http://your-server:4000** → the setup wizard appears → create your admin → done.

All state (database + WhatsApp sessions) lives in the `wafree_data` Docker volume, so `docker compose down && up` keeps everything.

### Updating

```bash
git pull
docker compose up -d --build
```

## 🔧 Local development (no Docker)

Requirements: Node.js 22+

```bash
# Terminal 1 — API + WhatsApp engine (http://localhost:4000)
cd server && npm install && npm run dev

# Terminal 2 — React frontend with hot reload (http://localhost:5173)
cd web && npm install && npm run dev
```

The Vite dev server proxies `/api` and `/socket.io` to port 4000. In production the Node server serves the built frontend itself (single origin, no CORS pain).

## 📖 Using WaFree

1. **Link a WhatsApp** — Admin → WhatsApp Accounts → *Add account* → *Connect / Scan QR* → on the phone: WhatsApp → Linked devices → Link a device.
2. **Add your team** — Admin → Team & Access → add executives, then click agent pills on each account card to assign them (respects the per-account agent limit).
3. **Work the inbox** — agents log in, see only their assigned numbers on the left rail, reply, set Pending/On-going/Resolved, tag conversations, `/`-insert quick replies, schedule messages with the clock icon.
4. **Automate** — Admin → Automation for auto-reply rules, Admin → Bot Builder for visual flows, Admin → Settings for AI + webhooks.

### Webhook payloads

`POST` JSON to your configured URL, with optional `X-WaFree-Secret` header:

```json
{
  "event": "account.logged_out",
  "timestamp": "2026-07-22T10:15:00.000Z",
  "account": { "id": 1, "label": "Sales", "phone": "919000000000" },
  "message": "WhatsApp session was logged out. Re-scan the QR code to reconnect."
}
```

Events: `account.connected` · `account.logged_out` · `scheduled.failed` · `test`

## 🏗 Architecture

```
┌───────────────┐   REST + Socket.IO   ┌──────────────────────────────┐
│  React (CSR)  │ ◄──────────────────► │  Node.js / Express            │
│  Vite build,  │                      │  ├─ Auth (JWT, bcrypt, roles) │
│  served as    │                      │  ├─ Baileys session manager   │
│  static files │                      │  │   (one socket per number)  │
└───────────────┘                      │  ├─ Automation engine         │
                                       │  │   (rules → bots → AI)      │
                                       │  ├─ Scheduler (20s tick)      │
                                       │  └─ SQLite (better-sqlite3)   │
                                       └──────────────────────────────┘
```

- **Fully client-side rendered** frontend — the server only ships static files and JSON.
- **SQLite + WAL** — zero-maintenance persistence; messages, chats, users, rules and flows in one file.
- **Session state** — Baileys multi-file auth per account under `DATA_DIR/sessions/<id>`; restored automatically on boot.

## ⚠️ Important disclaimer

WaFree uses the **unofficial** WhatsApp Web protocol via Baileys. This is not endorsed by WhatsApp/Meta and violates their Terms of Service; numbers can be **banned**, especially for bulk or unsolicited messaging. Use it for legitimate 1-to-1 customer conversations, at your own risk. For mission-critical messaging, use the official WhatsApp Business API.

## 🔒 Security notes

- Set a strong `JWT_SECRET` in production (`openssl rand -hex 32`).
- Run behind HTTPS (Caddy/Traefik/nginx reverse proxy) before exposing publicly.
- QR codes grant **full account access** — they are shown to admins only.
- API keys and webhook secrets are stored server-side and masked in the UI.

## License

MIT
