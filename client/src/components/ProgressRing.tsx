interface ProgressRingProps {
  value: number;
  label: string;
}

export function ProgressRing({ value, label }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="progress-ring" aria-label={`${label}: ${clamped}%`}>
      <svg viewBox="0 0 100 100" role="img">
        <circle className="progress-ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="progress-ring-fill"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="progress-ring-center">
        <strong>{clamped}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
