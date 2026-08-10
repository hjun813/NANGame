import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SpikeRoom } from './rooms/SpikeRoom';
import { CombatRoom } from './rooms/CombatRoom';
import { isOriginAllowed, isSpikeRoomEnabled, parseAllowedOrigins } from './config';

const PORT = Number(process.env.PORT) || 2567;
const HOST = process.env.HOST?.trim() || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS, NODE_ENV);
if (NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('[server] ALLOWED_ORIGINS is empty; browser WebSocket connections will be rejected');
}

const app = express();
if (NODE_ENV === 'production') app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin, allowedOrigins, NODE_ENV) && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(isOriginAllowed(origin, allowedOrigins, NODE_ENV) ? 204 : 403);
    return;
  }
  next();
});
const httpServer = createServer(app);

const gameServer = new Server({
  gracefullyShutdown: false,
  transport: new WebSocketTransport({
    server: httpServer,
    verifyClient: (info: { origin: string }) => {
      const allowed = isOriginAllowed(info.origin, allowedOrigins, NODE_ENV);
      if (!allowed) console.warn(`[server] rejected websocket origin=${info.origin || '<none>'}`);
      return allowed;
    },
  }),
});
if (isSpikeRoomEnabled()) gameServer.define('spike_room', SpikeRoom);
gameServer.define('combat_room', CombatRoom);

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nan-game-server' });
});

httpServer.listen(PORT, HOST, () => {
  console.info(`[server] listening host=${HOST} port=${PORT} env=${NODE_ENV}`);
  console.info(`[server] health=http://${HOST}:${PORT}/health origins=${allowedOrigins.length}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[server] shutdown signal=${signal}`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  try {
    await gameServer.gracefullyShutdown(false);
    process.exit(0);
  } catch (error) {
    console.error('[server] graceful shutdown failed', error);
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection', reason);
});
