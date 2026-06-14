import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseExcelFile, writeReportFile, formatExecutionDate } from './excelService.js';
import { clearPreviousRunArtifacts } from './cleanupService.js';
import { planTestActions, evaluateTestResult, isAIConfigured } from './aiService.js';
import { PlaywrightRunner } from './playwrightRunner.js';
import type {
  TestRunState,
  TestExecutionResult,
  TestCase,
  RunStatus,
} from '../types/index.js';

type LogCallback = (message: string) => void;
type StatusCallback = (status: RunStatus) => void;

const activeRuns = new Map<string, TestRunState>();

function resolveRunStatus(failed: number, skipped: number): RunStatus {
  if (failed > 0) return 'failed';
  if (skipped > 0) return 'incomplete';
  return 'completed';
}

export function getRunState(runId: string): TestRunState | undefined {
  return activeRuns.get(runId);
}

export function abortRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.status !== 'running') return false;
  run.aborted = true;
  run.status = 'aborted';
  run.logs.push('[ABORTED] Test execution stopped by user');
  return true;
}

export async function createRunFromUpload(
  filePath: string,
  fileName: string,
  headless: boolean
): Promise<TestRunState> {
  await clearPreviousRunArtifacts(filePath);
  activeRuns.clear();

  const sheets = await parseExcelFile(filePath);
  if (sheets.length === 0) {
    throw new Error('No valid test sheets found. Ensure columns: Test Name, Steps, Input, Expected Output');
  }

  const runId = uuidv4();
  const run: TestRunState = {
    runId,
    status: 'not_started',
    fileName,
    headless,
    sheets,
    results: [],
    logs: [`[INFO] Loaded ${sheets.length} sheet(s) with ${sheets.reduce((a, s) => a + s.tests.length, 0)} test(s)`],
    aborted: false,
  };

  (run as TestRunState & { sourceFilePath: string }).sourceFilePath = filePath;
  activeRuns.set(runId, run);
  return run;
}

export async function executeRun(
  runId: string,
  onLog: LogCallback,
  onStatus: StatusCallback
): Promise<TestRunState> {
  const run = activeRuns.get(runId);
  if (!run) throw new Error('Run not found');

  if (!isAIConfigured()) {
    throw new Error('AI provider not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env');
  }

  const sourceFilePath = (run as TestRunState & { sourceFilePath?: string }).sourceFilePath;
  if (!sourceFilePath) throw new Error('Source file path missing');

  await clearPreviousRunArtifacts(sourceFilePath);
  run.results = [];
  run.reportPath = undefined;
  run.completedAt = undefined;
  run.logs = [];

  run.status = 'running';
  run.startedAt = new Date().toISOString();
  run.aborted = false;
  onStatus('running');
  onLog('[START] Test execution started');
  onLog('[CLEANUP] Cleared previous uploads, reports, and screenshots');

  const projectRoot = path.resolve(process.cwd());
  const screenshotBase = path.join(projectRoot, 'screenshots', runId);
  const reportsDir = path.join(projectRoot, 'reports');

  let runner: PlaywrightRunner | null = null;
  let hadFatalError = false;

  try {
    runner = new PlaywrightRunner(run.headless, screenshotBase);
    await runner.launch();
    onLog(`[BROWSER] Launched Chromium (${run.headless ? 'headless' : 'headed'} mode)`);

    for (const sheet of run.sheets) {
      if (run.aborted) break;
      onLog(`[SHEET] Processing sheet: "${sheet.name}" (${sheet.tests.length} tests)`);

      for (const testCase of sheet.tests) {
        if (run.aborted) break;

        onLog(`[TEST] Running: "${testCase.testName}"`);
        const result = await executeSingleTest(
          testCase,
          sheet.name,
          runner,
          screenshotBase,
          runId,
          onLog
        );

        run.results.push(result);
        updateTestCaseInSheet(sheet, result);

        const statusIcon = result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL';
        onLog(`[${statusIcon}] "${testCase.testName}" - ${result.status.toUpperCase()}`);
      }
    }

    if (run.aborted) {
      run.status = 'aborted';
      onStatus('aborted');
      onLog('[ABORTED] Execution aborted - no report generated');
      return run;
    }

    const reportPath = await writeReportFile(sourceFilePath, run.sheets, reportsDir);
    run.reportPath = reportPath;
    run.completedAt = new Date().toISOString();

    const failed = run.results.filter((r) => r.status === 'failed').length;
    const passed = run.results.filter((r) => r.status === 'passed').length;
    const skipped = run.results.filter((r) => r.status === 'skipped').length;

    run.status = resolveRunStatus(failed, skipped);
    onStatus(run.status);
    onLog(`[DONE] Execution complete: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    onLog(`[REPORT] Saved to ${reportPath}`);
  } catch (error) {
    hadFatalError = true;
    run.status = 'failed';
    onStatus('failed');
    const msg = error instanceof Error ? error.message : String(error);
    onLog(`[ERROR] Fatal error: ${msg}`);
  } finally {
    if (runner) {
      await runner.close();
      onLog('[BROWSER] Browser closed');
    }
  }

  if (hadFatalError && !run.aborted) {
    run.logs.push('[INFO] Run failed before completion - partial results may be available');
  }

  return run;
}

async function executeSingleTest(
  testCase: TestCase,
  sheetName: string,
  runner: PlaywrightRunner,
  screenshotBase: string,
  runId: string,
  onLog: LogCallback
): Promise<TestExecutionResult> {
  const executionDate = formatExecutionDate();
  const safeName = testCase.testName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);

  onLog(`  [AI] Planning actions for "${testCase.testName}"...`);
  const plan = await planTestActions(testCase);

  if (plan.skipped) {
    onLog(`  [SKIP] ${plan.skipReason}`);
    return {
      testCase: {
        ...testCase,
        executionDate,
        actualOutput: plan.skipReason || 'Test was skipped because steps could not be understood',
        status: 'skipped',
        error: '',
      },
      sheetName,
      stepResults: [],
      actualOutput: plan.skipReason || 'Test was skipped',
      status: 'skipped',
      executionDate,
    };
  }

  onLog(`  [AI] Generated ${plan.actions.length} action(s)`);
  const stepResults = [];
  const stepSummaries: string[] = [];
  let hadErrors = false;
  let lastError = '';

  for (let i = 0; i < plan.actions.length; i++) {
    const action = plan.actions[i];
    onLog(`  [STEP ${i + 1}] ${action.description} (${action.type})`);

    const prefix = `${runId}_${safeName}`;
    const result = await runner.executeAction(action, prefix, i + 1);
    stepResults.push(result);

    if (result.success) {
      stepSummaries.push(action.description);
      onLog(`  [STEP ${i + 1}] OK`);
    } else {
      hadErrors = true;
      lastError = result.error || 'Step failed';
      stepSummaries.push(`${action.description} - failed`);
      onLog(`  [STEP ${i + 1}] FAILED: ${lastError}`);
      break;
    }
  }

  const pageContent = await runner.getPageText();
  onLog(`  [AI] Evaluating result...`);

  const evaluation = await evaluateTestResult(
    testCase,
    stepSummaries,
    pageContent,
    hadErrors,
    lastError
  );

  return {
    testCase: {
      ...testCase,
      executionDate,
      actualOutput: evaluation.actualOutput,
      status: evaluation.status,
      error: hadErrors ? lastError : '',
    },
    sheetName,
    stepResults,
    actualOutput: evaluation.actualOutput,
    status: evaluation.status,
    error: hadErrors ? lastError : undefined,
    executionDate,
  };
}

function updateTestCaseInSheet(
  sheet: { tests: TestCase[] },
  result: TestExecutionResult
): void {
  const idx = sheet.tests.findIndex((t) => t.rowIndex === result.testCase.rowIndex);
  if (idx >= 0) {
    sheet.tests[idx] = result.testCase;
  }
}

export function getAllRuns(): TestRunState[] {
  return Array.from(activeRuns.values());
}
