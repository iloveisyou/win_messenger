import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setupSocket } from './socket.js';
import { initAgent, shutdownAgent } from './ai/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(join(__dirname, '..', 'public')));

setupSocket(io);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initAgent();
    console.log('[Server] AI 에이전트 초기화 완료');
  } catch (err) {
    console.warn('[Server] AI 에이전트 초기화 실패 (채팅은 정상 작동):', err.message);
  }

  httpServer.listen(PORT, () => {
    console.log(`[Server] WIN Messenger 실행 중: http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await shutdownAgent();
  process.exit(0);
});

start();
