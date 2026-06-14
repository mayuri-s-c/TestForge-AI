import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const server = createServer(app);

const wsClients = new Map<string, Set<WebSocket>>();

const wsBroadcast = (runId: string, data: object) => {
  const clients = wsClients.get(runId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};

(global as typeof global & { wsBroadcast: typeof wsBroadcast }).wsBroadcast = wsBroadcast;

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const runId = url.searchParams.get('runId');

  if (!runId) {
    ws.close(1008, 'runId required');
    return;
  }

  if (!wsClients.has(runId)) {
    wsClients.set(runId, new Set());
  }
  wsClients.get(runId)!.add(ws);

  ws.on('close', () => {
    wsClients.get(runId)?.delete(ws);
    if (wsClients.get(runId)?.size === 0) {
      wsClients.delete(runId);
    }
  });
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Client not built. Run npm run build:client' });
    });
  });
}

server.listen(PORT, () => {
  console.log(`AI Automation server running on http://localhost:${PORT}`);
  console.log(`AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
});
