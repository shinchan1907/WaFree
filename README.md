<div align="center">

# ⚡ WaFree — Self-Hosted Multi-WhatsApp Team Dashboard & Automation Engine

<p align="center">
  <b>The open-source, self-hosted WhatsApp Web team inbox for multi-number customer support, AI auto-replies, and visual bot automation.</b>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933.svg)](https://nodejs.org/)
[![Powered by Baileys](https://img.shields.io/badge/Powered%20by-Baileys-059669.svg)](https://github.com/WhiskeySockets/Baileys)

[Features](#-key-features) • [Quick Start](#-instant-quick-start-docker) • [Light & Dark UI](#-modern-light--dark-theme-ui) • [Architecture](#-architecture) • [API Reference](#-api--socket-reference) • [Security](#-security--production-checklist)

---

</div>

## 🌟 Why WaFree?

Traditional WhatsApp Business API (WABA) solutions cost hundreds of dollars per month per agent and charge per conversation. **WaFree** gives your team a high-speed, self-hosted team inbox powered by open-source WhatsApp Web automation ([Baileys](https://github.com/WhiskeySockets/Baileys)).

- 🚀 **Zero Monthly Subscriptions** — Self-host on a $5/mo VPS or Docker container.
- 📱 **Multi-Number Architecture** — Connect unlimited WhatsApp / WhatsApp Business phones via QR code.
- 🎨 **Modern Light & Dark Theme UI** — Ultra-sleek, responsive SaaS design with instant theme toggling.
- 🤖 **Visual Bot Builder** — Drag-and-drop n8n-style canvas (Trigger → Condition → AI Reply → Tag → Delay → Status).
- 🧠 **Bring Your Own AI** — Native OpenAI, Anthropic, Groq, DeepSeek, Ollama, and OpenRouter integration.
- 🔒 **Role-Based Access Control** — Admins have total control; Executives only see their assigned accounts.

---

## ✨ Key Features

| Area | Features & Capability |
|---|---|
| **Multi-Account Inbox** | Link unlimited WhatsApp numbers simultaneously via QR scan. Color-coded account identifiers everywhere in the unified sidebar. |
| **Team & Granular Access** | Role breakdown: **Admin** (full system governance) and **Executive** (support agent). Assign specific agents to specific numbers. |
| **Sleek Light & Dark UI** | Clean light mode default with modern emerald accents (`#059669`), crisp typography (`Inter`), chat bubbles, day markers, and quick theme toggle. |
| **Workflow State Machine** | Conversations flow smoothly through **Pending ➔ On-going ➔ Resolved**. Incoming customer messages auto-reopen pending tickets. |
| **Visual Bot Builder** | Interactive canvas built with React Flow: set keyword/any triggers, regex filters, dynamic delays, tag modifications, and LLM responses. |
| **Smart AI Automation** | Connect OpenAI / DeepSeek / Ollama / Groq with customized system prompts, context awareness, and per-contact cooldown safety limits. |
| **Quick Replies (`/`)** | Type `/` in the message composer to instantly insert canned text responses (global or account-scoped). |
| **Native Message Scheduler** | Schedule future messages with background tick delivery even if agents are offline. Admin control with live status and cancellation. |
| **Instant Webhooks** | Outbound real-time notifications to Slack, n8n, Discord, or custom REST endpoints on logout, connection change, or delivery failure. |
| **Zero-Config Onboarding** | Guided 30-second setup wizard on initial launch to create the super-admin account and notification webhooks. |

---

## ⚡ Instant Quick Start (Docker)

Deploy the complete stack (Express API + Baileys Engine + React Web SPA + SQLite WAL) in under 60 seconds:

```bash
# 1. Clone repository
git clone https://github.com/shinchan1907/WaFree.git wafree
cd wafree

# 2. Setup environment secret (recommended)
cp .env.example .env

# 3. Launch single-container stack
docker compose up -d
```

Open **`http://your-server-ip:4000`** → setup wizard launches → create admin credentials → start connecting WhatsApp numbers!

> 💾 **Data Persistence**: All session data, SQLite databases, and media live securely inside the `wafree_data` volume across container updates.

---

## 🎨 Modern Light & Dark Theme UI

WaFree comes out of the box with an enterprise-grade design system:
- ☀️ **Light Theme (Default)**: Crisp slate backgrounds, clean card elevation, readable typography, and emerald brand accents.
- 🌙 **Dark Theme**: Deep dark palette designed for low-light support environments.
- 🌓 **Instant Toggle**: Click the theme toggle button in the bottom rail or header navigation to switch instantly.

---

## 🔧 Local Development Setup

### Prerequisites
- **Node.js**: 22+
- **npm**: 10+

### Steps

```bash
# Terminal 1 — Backend Express Server (Port 4000)
cd server
npm install
npm run dev

# Terminal 2 — Frontend React App (Port 5173 with Vite hot reload)
cd web
npm install
npm run dev
```

The Vite dev server automatically proxies `/api` and `/socket.io` to port `4000`.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WaFree System Architecture                         │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐               ┌───────────────────────────┐
   │ React 18 SPA (Web)    │               │ Node.js 22 Express Engine │
   │ ├─ Light & Dark Theme │ ◄── REST ──►  │ ├─ Auth & Role Guard      │
   │ ├─ Socket.IO Client   │ ◄── WS ────►  │ ├─ Baileys Session Pool  │
   │ └─ React Flow Canvas  │               │ ├─ Automation Engine      │
   └───────────────────────┘               │ ├─ Scheduler & Webhooks   │
                                           │ └─ SQLite + WAL           │
                                           └─────────────┬─────────────┘
                                                         │
                                                         ▼
                                           ┌───────────────────────────┐
                                           │ WhatsApp Web Protocol     │
                                           │ (Multi-Device Linked Sockets)│
                                           └───────────────────────────┘
```

- **Persistence Layer**: Single-file SQLite database with Write-Ahead Logging (`better-sqlite3`).
- **Session Manager**: Isolated Baileys authentication credentials under `DATA_DIR/sessions/<account_id>`.
- **Realtime Pipeline**: Socket.IO broadcasts message updates, QR code rotation, and connection status changes to authenticated UI clients.

---

## 🔌 API & Socket Reference

### Core REST Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/setup/status` | Public | Check if setup wizard is completed |
| `POST` | `/api/setup` | Public | Complete setup & create super-admin |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT token |
| `GET` | `/api/accounts` | Authenticated | List accessible WhatsApp accounts |
| `POST` | `/api/accounts/:id/connect` | Admin | Request QR code connection socket |
| `GET` | `/api/accounts/:id/chats` | Account Access | Retrieve chat list for account |
| `POST` | `/api/accounts/:id/messages` | Account Access | Send outbound message |
| `POST` | `/api/accounts/:id/messages/schedule` | Account Access | Schedule delayed message send |
| `GET` | `/api/automation/bots` | Admin | List bot flow configurations |
| `PATCH` | `/api/automation/bots/:id` | Admin | Update bot flow React Flow nodes |

---

## 🔒 Security & Production Checklist

1. **JWT Secret**: Always generate a cryptographically strong `JWT_SECRET` in `.env`:
   ```bash
   openssl rand -hex 32
   ```
2. **Reverse Proxy & TLS**: Always place WaFree behind a TLS reverse proxy (Caddy, Nginx, or Cloudflare) with HTTPS enabled.
3. **QR Protection**: QR code socket events grant full account access and are restricted exclusively to Admin roles.
4. **API Key Encryption**: AI API keys and Webhook Secrets are masked in UI and REST responses.

---

## 🤝 Contributing

We welcome community contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide before submitting Pull Requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Ensure type safety passes (`cd server && npm run typecheck`, `cd web && npm run build`)
4. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  <b>Built with ❤️ by the open-source community. If you find WaFree useful, please give it a ⭐ star!</b>
</p>
