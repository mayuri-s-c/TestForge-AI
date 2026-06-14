import { useMemo } from 'react';
import type { TestProgressItem } from '../hooks/useRunProgress';
import { DashboardCard } from './DashboardCard';

interface TestProgressProps {
  items: TestProgressItem[];
  currentTest: TestProgressItem | null;
  embedded?: boolean;
}

interface SheetGroup {
  name: string;
  tests: TestProgressItem[];
}

function groupBySheet(items: TestProgressItem[]): SheetGroup[] {
  const groups = new Map<string, TestProgressItem[]>();

  for (const item of items) {
    const sheetTests = groups.get(item.sheetName) ?? [];
    sheetTests.push(item);
    groups.set(item.sheetName, sheetTests);
  }

  return Array.from(groups.entries()).map(([name, tests]) => ({ name, tests }));
}

function statusLabel(status: TestProgressItem['status']): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Pending';
  }
}

function TestProgressRow({ item }: { item: TestProgressItem }) {
  const isRunning = item.status === 'running';

  return (
    <div className={`test-progress-row status-${item.status}`}>
      <div className="test-progress-row-main">
        {isRunning ? (
          <span className="test-progress-spinner" aria-hidden="true" />
        ) : (
          <span className={`test-progress-icon status-${item.status}`} aria-hidden="true">
            {item.status === 'passed' && '✓'}
            {item.status === 'failed' && '✕'}
            {item.status === 'skipped' && '−'}
            {item.status === 'pending' && '○'}
          </span>
        )}
        <span className="test-progress-name">{item.testName}</span>
      </div>
      <span className={`test-progress-status status-${item.status}`}>
        {isRunning ? 'Running steps…' : statusLabel(item.status)}
      </span>
    </div>
  );
}

export function TestProgress({ items, currentTest, embedded = false }: TestProgressProps) {
  const sheetGroups = useMemo(() => groupBySheet(items), [items]);

  const content = (
    <>
      <div className="test-progress-header">
        <div>
          {!embedded && <h2>Live Progress</h2>}
          <p className={embedded ? 'panel-desc' : undefined}>
            {currentTest
              ? <>Running <strong>{currentTest.testName}</strong> in {currentTest.sheetName}</>
              : 'Preparing next test…'}
          </p>
        </div>
        {currentTest && (
          <div className="test-progress-current">
            <span className="test-progress-spinner test-progress-spinner-lg" aria-hidden="true" />
            <span>In progress</span>
          </div>
        )}
      </div>

      <div className="test-progress-groups">
        {sheetGroups.map((group) => (
          <div key={group.name} className="test-progress-group">
            <h3>{group.name}</h3>
            <div className="test-progress-list">
              {group.tests.map((item) => (
                <TestProgressRow key={`${group.name}-${item.testName}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return <div className="test-progress-embedded" aria-live="polite">{content}</div>;
  }

  return (
    <DashboardCard title="Live Progress" subtitle="Track each test while the run is active." className="test-progress-panel">
      {content}
    </DashboardCard>
  );
}
