export type RunStatus =
  | 'not_started'
  | 'running'
  | 'completed'
  | 'incomplete'
  | 'failed'
  | 'aborted';

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface TestPreview {
  testName: string;
  steps: string;
  input: string;
  expectedOutput: string;
}

export interface SheetPreview {
  name: string;
  testCount: number;
  tests: TestPreview[];
}

export interface ScreenshotInfo {
  description: string;
  path?: string;
  success: boolean;
}

export interface TestResult {
  sheetName: string;
  testName: string;
  steps: string;
  input: string;
  expectedOutput: string;
  executionDate?: string;
  actualOutput?: string;
  status: TestStatus;
  error?: string;
  screenshots: ScreenshotInfo[];
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface UploadResponse {
  runId: string;
  fileName: string;
  status: RunStatus;
  sheets: SheetPreview[];
}

export interface StatusResponse {
  runId: string;
  status: RunStatus;
  fileName: string;
  headless: boolean;
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  hasReport: boolean;
  results: TestResult[];
  summary: RunSummary;
}
