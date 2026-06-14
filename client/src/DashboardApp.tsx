import { useEffect, useMemo, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { StatusBadge } from './components/StatusBadge';
import { TerminalLogs } from './components/TerminalLogs';
import { TestProgress } from './components/TestProgress';
import { ResultsTable } from './components/ResultsTable';
import { StatCard } from './components/StatCard';
import { DashboardCard } from './components/DashboardCard';
import { ProgressRing } from './components/ProgressRing';
import { DownloadButton } from './components/DownloadButton';
import { useAuth } from './context/AuthContext';
import { useTestRunner } from './hooks/useTestRunner';
import { useRunProgress } from './hooks/useRunProgress';
import { useWebSocket } from './hooks/useWebSocket';
import type { TestProgressItem } from './hooks/useRunProgress';

type DashboardView = 'overview' | 'console' | 'results';

const NAV_ITEMS: { id: DashboardView; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'console', label: 'Execution Console', icon: '▣' },
  { id: 'results', label: 'Test Results', icon: '◧' },
];

function countByStatus(items: TestProgressItem[], status: TestProgressItem['status']) {
  return items.filter((item) => item.status === status).length;
}

export default function DashboardApp() {
  const { user, logout } = useAuth();
  const runner = useTestRunner();
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const { items: progressItems, currentTest, showProgress } = useRunProgress(
    runner.logs,
    runner.status,
    runner.sheets
  );

  useWebSocket(
    runner.runId,
    runner.addLog,
    runner.setStatus,
    runner.onComplete
  );

  useEffect(() => {
    runner.checkHealth();
  }, [runner.checkHealth]);

  useEffect(() => {
    if (runner.results.length > 0 && runner.status !== 'running' && runner.status !== 'aborted') {
      setActiveView('results');
    }
  }, [runner.results.length, runner.status]);

  const isRunning = runner.status === 'running';
  const canRun = !!runner.runId && !isRunning && runner.aiConfigured;
  const canStop = isRunning;
  const canViewResults = runner.results.length > 0 && runner.status !== 'aborted';
  const canDownload = runner.hasReport && runner.status !== 'aborted';

  const totalTests = useMemo(
    () => runner.sheets.reduce((sum, sheet) => sum + sheet.testCount, 0),
    [runner.sheets]
  );

  const stats = useMemo(() => {
    if (runner.summary) {
      return runner.summary;
    }

    return {
      total: progressItems.length || totalTests,
      passed: countByStatus(progressItems, 'passed'),
      failed: countByStatus(progressItems, 'failed'),
      skipped: countByStatus(progressItems, 'skipped'),
    };
  }, [runner.summary, progressItems, totalTests]);

  const completedCount = stats.passed + stats.failed + stats.skipped;
  const progressPercent = stats.total > 0 ? Math.round((completedCount / stats.total) * 100) : 0;
  const pendingCount = Math.max(stats.total - completedCount, 0);

  const handleUpload = async (file: File) => {
    try {
      await runner.uploadFile(file);
      setActiveView('overview');
    } catch (e) {
      runner.setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const handleRun = async () => {
    try {
      await runner.runTests();
      setActiveView('overview');
    } catch (e) {
      runner.setError(e instanceof Error ? e.message : 'Failed to start');
    }
  };

  const handleStop = async () => {
    try {
      await runner.stopTests();
      setActiveView('overview');
    } catch (e) {
      runner.setError(e instanceof Error ? e.message : 'Failed to stop');
    }
  };

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">QA</div>
          <div>
            <strong>AI Automation</strong>
            <span>Test Intelligence Platform</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
              disabled={item.id === 'results' && !canViewResults}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-meta">
            <span>Run Mode</span>
            <strong>{runner.headless ? 'Headless' : 'Headed'}</strong>
          </div>
          <div className="sidebar-meta">
            <span>AI Engine</span>
            <strong>{runner.aiConfigured ? 'Connected' : 'Not configured'}</strong>
          </div>
          <StatusBadge status={runner.status} />

          <div className="sidebar-user-block">
            <span>Signed in as</span>
            <strong>{user?.displayName || user?.username}</strong>
            <button type="button" className="btn btn-secondary sidebar-logout" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="dashboard-shell">
        <header className="dashboard-topbar">
          <div>
            <p className="topbar-eyebrow">Automation Control Center</p>
            <h1>
              {activeView === 'overview' && 'Run Overview'}
              {activeView === 'console' && 'Execution Console'}
              {activeView === 'results' && 'Detailed Test Results'}
            </h1>
          </div>
          <div className="topbar-actions">
            {runner.fileName && (
              <div className="topbar-pill">
                <span>Suite</span>
                <strong>{runner.fileName}</strong>
              </div>
            )}
            {runner.runId && (
              <div className="topbar-pill mono">
                <span>Run ID</span>
                <strong>{runner.runId.slice(0, 8)}</strong>
              </div>
            )}
          </div>
        </header>

        <main className="dashboard-main">
          {!runner.aiConfigured && (
            <div className="alert alert-warning">
              AI provider not configured. Copy <code>.env.example</code> to <code>.env</code> and add your OpenAI or Gemini API key.
            </div>
          )}

          {runner.error && (
            <div className="alert alert-error">
              {runner.error}
              <button onClick={() => runner.setError(null)}>×</button>
            </div>
          )}

          <section className="metrics-grid">
            <StatCard label="Total Tests" value={stats.total || totalTests || '—'} hint="Across all sheets" icon="◎" tone="primary" />
            <StatCard label="Passed" value={stats.passed} hint="Successful assertions" icon="✓" tone="success" />
            <StatCard label="Failed" value={stats.failed} hint="Needs investigation" icon="!" tone="error" />
            <StatCard label="Skipped" value={stats.skipped} hint="Not automatable" icon="−" tone="skip" />
            <StatCard label="Sheets" value={runner.sheets.length || '—'} hint="Workbook tabs loaded" icon="▤" />
            <StatCard label="Pending" value={pendingCount} hint="Waiting to execute" icon="○" tone="warning" />
          </section>

          {activeView === 'overview' && (
            <div className="dashboard-grid overview-grid">
              <DashboardCard
                title="Test Suite"
                subtitle="Upload Excel test cases with Test Name, Steps, Input, and Expected Output."
                className="span-7"
              >
                <FileUpload
                  onUpload={handleUpload}
                  disabled={isRunning}
                  fileName={runner.fileName}
                />
                {runner.sheets.length > 0 && (
                  <div className="sheet-grid">
                    {runner.sheets.map((sheet) => (
                      <div key={sheet.name} className="sheet-summary-card">
                        <div className="sheet-summary-head">
                          <strong>{sheet.name}</strong>
                          <span>{sheet.testCount} tests</span>
                        </div>
                        <div className="sheet-summary-list">
                          {sheet.tests.slice(0, 3).map((test) => (
                            <span key={test.testName}>{test.testName}</span>
                          ))}
                          {sheet.tests.length > 3 && (
                            <span className="sheet-summary-more">+{sheet.tests.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard
                title="Execution Control"
                subtitle="Configure browser mode and launch the automation run."
                className="span-5"
              >
                <div className="control-stack">
                  <div className="control-panel-block">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={runner.headless}
                        onChange={(e) => runner.setHeadless(e.target.checked)}
                        disabled={isRunning}
                      />
                      <span className="toggle-slider" />
                      <span className="toggle-copy">
                        <strong>Headless Mode</strong>
                        <span>Run Chromium without opening a visible browser window.</span>
                      </span>
                    </label>
                  </div>

                  <div className="control-actions">
                    <button className="btn btn-primary" onClick={handleRun} disabled={!canRun}>
                      ▶ Run Tests
                    </button>
                    <button className="btn btn-danger" onClick={handleStop} disabled={!canStop}>
                      ■ Stop
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setActiveView('results')}
                      disabled={!canViewResults}
                    >
                      View Results
                    </button>
                  </div>

                  <div className="run-progress-panel">
                    <ProgressRing value={progressPercent} label="Complete" />
                    <div className="run-progress-copy">
                      <strong>{isRunning ? 'Execution in progress' : 'Ready to execute'}</strong>
                      <span>
                        {currentTest
                          ? `Running ${currentTest.testName} in ${currentTest.sheetName}`
                          : `${completedCount} of ${stats.total || totalTests || 0} tests processed`}
                      </span>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>

                  {canDownload && runner.runId && (
                    <div className="download-group">
                      <DownloadButton
                        path={`/download/xlsx/${runner.runId}`}
                        filename="test-report.xlsx"
                        label="⬇ test-report.xlsx"
                      />
                      <DownloadButton
                        path={`/download/zip/${runner.runId}`}
                        filename="test-report.zip"
                        label="⬇ Report ZIP"
                      />
                    </div>
                  )}
                </div>
              </DashboardCard>

              {showProgress && (
                <DashboardCard
                  title="Live Run Timeline"
                  subtitle="Track each test as it moves from pending to completed."
                  className="span-12"
                >
                  <TestProgress items={progressItems} currentTest={currentTest} embedded />
                </DashboardCard>
              )}

              <DashboardCard
                title="Recent Console Output"
                subtitle="Latest execution logs from the current run."
                className="span-12"
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveView('console')}>
                    Open Full Console
                  </button>
                }
              >
                <TerminalLogs logs={runner.logs.slice(-8)} compact />
              </DashboardCard>
            </div>
          )}

          {activeView === 'console' && (
            <DashboardCard
              title="Execution Console"
              subtitle="Streaming logs from Playwright actions, AI planning, and test evaluation."
              className="full-height-card"
            >
              <TerminalLogs logs={runner.logs} />
            </DashboardCard>
          )}

          {activeView === 'results' && (
            <DashboardCard
              title="Test Results"
              subtitle="Review outcomes, screenshots, and export the generated report."
              action={
                canDownload && runner.runId ? (
                  <div className="download-group">
                    <DownloadButton
                      path={`/download/xlsx/${runner.runId}`}
                      filename="test-report.xlsx"
                      label="⬇ test-report.xlsx"
                    />
                    <DownloadButton
                      path={`/download/zip/${runner.runId}`}
                      filename="test-report.zip"
                      label="⬇ Report ZIP"
                    />
                  </div>
                ) : undefined
              }
            >
              {canViewResults ? (
                <ResultsTable results={runner.results} runId={runner.runId} />
              ) : (
                <div className="empty-results">Run tests to populate the results dashboard.</div>
              )}
            </DashboardCard>
          )}
        </main>
      </div>
    </div>
  );
}
