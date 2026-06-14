import type { RunStatus } from '../types';

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'status-idle' },
  running: { label: 'Running', className: 'status-running' },
  completed: { label: 'Completed', className: 'status-success' },
  incomplete: { label: 'Incomplete', className: 'status-warning' },
  failed: { label: 'Failed', className: 'status-error' },
  aborted: { label: 'Aborted', className: 'status-aborted' },
};

interface StatusBadgeProps {
  status: RunStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`status-badge ${config.className}`}>
      <span className="status-dot" />
      {config.label}
    </div>
  );
}
