import type { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function DashboardCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  compact = false,
}: DashboardCardProps) {
  return (
    <section className={`dashboard-card ${compact ? 'compact' : ''} ${className}`.trim()}>
      <div className="dashboard-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="dashboard-card-action">{action}</div>}
      </div>
      <div className="dashboard-card-body">{children}</div>
    </section>
  );
}
