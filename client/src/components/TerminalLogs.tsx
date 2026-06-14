import { useEffect, useRef } from 'react';

interface TerminalLogsProps {
  logs: string[];
  compact?: boolean;
}

export function TerminalLogs({ logs, compact = false }: TerminalLogsProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className={`terminal ${compact ? 'terminal-compact' : ''}`}>
      <div className="terminal-header">
        <span className="terminal-dot red" />
        <span className="terminal-dot yellow" />
        <span className="terminal-dot green" />
        <span className="terminal-title">Execution Logs</span>
      </div>
      <div className="terminal-body">
        {logs.length === 0 ? (
          <div className="terminal-line muted">Waiting for test execution...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`terminal-line ${getLogClass(log)}`}>
              {log}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function getLogClass(log: string): string {
  if (log.includes('[ERROR]') || log.includes('[FAIL]')) return 'log-error';
  if (log.includes('[PASS]')) return 'log-success';
  if (log.includes('[SKIP]')) return 'log-skip';
  if (log.includes('[ABORTED]')) return 'log-aborted';
  if (log.includes('[START]') || log.includes('[DONE]')) return 'log-highlight';
  return '';
}
