import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { config } from './config.js';
import './db/index.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { accountsRouter } from './routes/accounts.js';
import { chatsRouter } from './routes/chats.js';
import { quickRepliesRouter } from './routes/quickReplies.js';
import { setupRouter } from './routes/setup.js';
import { settingsRouter } from './routes/settings.js';
import { tagsRouter } from './routes/tags.js';
import { automationRouter } from './routes/automation.js';
import { analyticsRouter } from './routes/analytics.js';
import { WaManager } from './wa/manager.js';
import { setupSockets } from './sockets.js';
import { initAutomation } from './automation/index.js';
import { startScheduler } from './automation/scheduler.js';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: config.corsOrigin } });

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

const manager = new WaManager(io);

app.use('/api/setup', setupRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/accounts', accountsRouter(manager));
app.use('/api/accounts/:accountId/chats', chatsRouter(manager));
app.use('/api/quick-replies', quickRepliesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/automation', automationRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Serve the built frontend in production (single-origin deploy).
const webDist = path.resolve(process.cwd(), '../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Central error handler — never leak internals.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[http] unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

setupSockets(io);
initAutomation(manager);
startScheduler();

server.listen(config.port, () => {
  console.log(`[server] WaFree listening on http://localhost:${config.port}`);
  manager.restoreAll().catch((err) => console.error('[wa] restore failed:', err));
});
