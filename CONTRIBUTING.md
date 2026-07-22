# Contributing to WaFree

Thank you for considering contributing to **WaFree**! Community contributions help keep WaFree robust, open-source, and accessible to team support teams worldwide.

## 🤝 Code of Conduct

Please help us maintain a friendly, respectful, and inclusive environment. Treat all contributors and users with courtesy and respect.

---

## 🛠 Local Development Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/WaFree.git
   cd WaFree
   ```

2. **Install Dependencies**:
   ```bash
   cd server && npm install
   cd ../web && npm install
   ```

3. **Start Development Servers**:
   ```bash
   # Terminal 1 — Backend Express Server (tsx watch)
   cd server && npm run dev

   # Terminal 2 — Frontend React App (Vite Dev Server)
   cd web && npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

---

## 📐 Architecture Guidelines

- **API Response Envelope**: Every REST endpoint MUST return JSON wrapped in `{ success: boolean, data?: any, error?: string }`.
- **Role Control**: Endpoints scoped to a specific WhatsApp account MUST enforce `requireAccountAccess` or `requireAdmin`.
- **TypeScript Strictness**: Always ensure `npm run typecheck` in `/server` and `npm run build` in `/web` pass without errors.
- **Theme Variables**: Use standard CSS custom properties defined in `web/src/styles.css` (`var(--bg-panel)`, `var(--text-primary)`, `var(--teal)`). Never hardcode fixed dark/light colors without CSS variable abstraction.
- **Database Schema**: Modify `server/src/db/index.ts` using additive `CREATE TABLE IF NOT EXISTS` or guarded `ALTER TABLE` statements.

---

## 🧪 Testing Checklist Before PR

Before opening a Pull Request, please run:

```bash
# Server Typecheck
cd server && npm run typecheck

# Frontend Build
cd web && npm run build
```

Ensure:
- Both commands exit with status code `0`.
- No broken API contracts or unhandled promise rejections occur.
- Theme switching works smoothly in both Light Mode and Dark Mode.

---

## 📬 Submitting a Pull Request

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Commit your changes with clear messages:
   ```bash
   git commit -m "feat(web): add light mode theme toggle button"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
4. Open a Pull Request on the main `shinchan1907/WaFree` repository.

Thank you for contributing! 🚀
