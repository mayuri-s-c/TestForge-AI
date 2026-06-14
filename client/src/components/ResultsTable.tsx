import { useEffect, useMemo, useState } from 'react';
import type { TestResult } from '../types';
import { getAuthenticatedUrl } from '../lib/apiClient';

interface ResultsTableProps {
  results: TestResult[];
  runId: string | null;
}

interface SheetGroup {
  name: string;
  results: TestResult[];
}

function statusClass(status: string): string {
  return `result-status status-${status}`;
}

function groupResultsBySheet(results: TestResult[]): SheetGroup[] {
  const groups = new Map<string, TestResult[]>();

  for (const result of results) {
    const sheetResults = groups.get(result.sheetName) ?? [];
    sheetResults.push(result);
    groups.set(result.sheetName, sheetResults);
  }

  return Array.from(groups.entries()).map(([name, sheetResults]) => ({
    name,
    results: sheetResults,
  }));
}

function ResultCard({ result, runId }: { result: TestResult; runId: string | null }) {
  return (
    <div className="result-card">
      <div className="result-header">
        <h3>{result.testName}</h3>
        <span className={statusClass(result.status)}>{result.status.toUpperCase()}</span>
      </div>
      {result.executionDate && (
        <div className="result-meta">
          <span>Date: {result.executionDate}</span>
        </div>
      )}

      <div className="result-grid">
        <div className="result-field">
          <label>Steps</label>
          <p>{result.steps}</p>
        </div>
        <div className="result-field">
          <label>Input</label>
          <p>{result.input || '—'}</p>
        </div>
        <div className="result-field">
          <label>Expected Output</label>
          <p>{result.expectedOutput}</p>
        </div>
        <div className="result-field">
          <label>Actual Output</label>
          <p>{result.actualOutput || '—'}</p>
        </div>
        {result.error && (
          <div className="result-field error-field">
            <label>Error</label>
            <p>{result.error}</p>
          </div>
        )}
      </div>

      {result.screenshots.length > 0 && (
        <div className="screenshots-section">
          <h4>Step Screenshots</h4>
          <div className="screenshots-grid">
            {result.screenshots.map((shot, sIdx) => {
              const filename = shot.path?.split('/').pop();
                  const src = runId && filename
                    ? getAuthenticatedUrl(`/screenshot/${runId}/${filename}`)
                    : undefined;
              return (
                <div key={sIdx} className="screenshot-item">
                  <div className="screenshot-label">
                    Step {sIdx + 1}: {shot.description}
                    {!shot.success && <span className="shot-fail"> (failed)</span>}
                  </div>
                  {src ? (
                    <img src={src} alt={`Step ${sIdx + 1}`} loading="lazy" />
                  ) : (
                    <div className="screenshot-placeholder">No preview</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SheetTabLabel({ group }: { group: SheetGroup }) {
  const passed = group.results.filter((r) => r.status === 'passed').length;
  const failed = group.results.filter((r) => r.status === 'failed').length;
  const skipped = group.results.filter((r) => r.status === 'skipped').length;

  return (
    <span className="sheet-tab-label">
      <span className="sheet-tab-name">{group.name}</span>
      <span className="sheet-tab-count">{group.results.length} tests</span>
      <span className="sheet-tab-summary">
        {passed > 0 && <span className="sheet-tab-stat passed">{passed} passed</span>}
        {failed > 0 && <span className="sheet-tab-stat failed">{failed} failed</span>}
        {skipped > 0 && <span className="sheet-tab-stat skipped">{skipped} skipped</span>}
      </span>
    </span>
  );
}

export function ResultsTable({ results, runId }: ResultsTableProps) {
  const sheetGroups = useMemo(() => groupResultsBySheet(results), [results]);
  const [activeSheet, setActiveSheet] = useState(sheetGroups[0]?.name ?? '');

  useEffect(() => {
    if (sheetGroups.length === 0) {
      setActiveSheet('');
      return;
    }

    const sheetStillExists = sheetGroups.some((group) => group.name === activeSheet);
    if (!sheetStillExists) {
      setActiveSheet(sheetGroups[0].name);
    }
  }, [sheetGroups, activeSheet]);

  if (results.length === 0) {
    return <div className="empty-results">No results yet. Run tests to see results here.</div>;
  }

  const activeGroup = sheetGroups.find((group) => group.name === activeSheet) ?? sheetGroups[0];
  const showTabs = sheetGroups.length > 1;

  return (
    <div className="results-container">
      {showTabs && (
        <div className="sheet-tabs" role="tablist" aria-label="Sheet results">
          {sheetGroups.map((group) => {
            const isActive = group.name === activeGroup.name;
            return (
              <button
                key={group.name}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`sheet-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSheet(group.name)}
              >
                <SheetTabLabel group={group} />
              </button>
            );
          })}
        </div>
      )}

      <div
        className="sheet-results"
        role="tabpanel"
        aria-label={showTabs ? `${activeGroup.name} results` : 'Test results'}
      >
        {!showTabs && (
          <div className="sheet-results-heading">
            <h3>{activeGroup.name}</h3>
            <span className="sheet-results-count">{activeGroup.results.length} tests</span>
          </div>
        )}

        {activeGroup.results.map((result, idx) => (
          <ResultCard key={`${result.testName}-${idx}`} result={result} runId={runId} />
        ))}
      </div>
    </div>
  );
}
