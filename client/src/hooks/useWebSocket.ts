import { useEffect, useRef, useCallback } from 'react';
import type { RunStatus } from './types';

interface WSMessage {
  type: 'log' | 'status' | 'complete' | 'error';
  message?: string;
  status?: RunStatus;
}

export function useWebSocket(
  runId: string | null,
  onLog: (message: string) => void,
  onStatus: (status: RunStatus) => void,
  onComplete: () => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '3001' : window.location.port;
    const wsUrl = `${protocol}//${host}:${port}/ws?runId=${runId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        if (data.type === 'log' && data.message) onLog(data.message);
        if (data.type === 'status' && data.status) onStatus(data.status);
        if (data.type === 'complete') onComplete();
        if (data.type === 'error' && data.message) onLog(`[ERROR] ${data.message}`);
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, [runId, onLog, onStatus, onComplete]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
