import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';

const PORT = Number(process.env.PORT) || 2567;

const app = express();
const httpServer = createServer(app);

const gameServer = new Server({ server: httpServer });

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

httpServer.listen(PORT, () => {
  console.log(`🟢 Linked Fighters 서버 실행 중 — http://localhost:${PORT}`);
  console.log(`💓 헬스체크 — http://localhost:${PORT}/health`);
});
