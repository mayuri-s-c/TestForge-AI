interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'skip';
  icon?: string;
}

export function StatCard({ label, value, hint, tone = 'default', icon }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value">{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}
