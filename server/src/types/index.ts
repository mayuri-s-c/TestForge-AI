export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface TestCase {
  rowIndex: number;
  testName: string;
  steps: string;
  input: string;
  expectedOutput: string;
  executionDate?: string;
  actualOutput?: string;
  status?: TestStatus;
  error?: string;
}

export interface TestSheet {
  name: string;
  tests: TestCase[];
}

export interface PlaywrightAction {
  type: 'navigate' | 'click' | 'fill' | 'type' | 'select' | 'press' | 'wait' | 'screenshot' | 'hover' | 'check' | 'uncheck';
  description: string;
  selector?: string;
  value?: string;
  url?: string;
  key?: string;
  timeout?: number;
}

export interface StepExecutionResult {
  action: PlaywrightAction;
  success: boolean;
  screenshotPath?: string;
  error?: string;
  pageSnapshot?: string;
}

export interface TestExecutionResult {
  testCase: TestCase;
  sheetName: string;
  stepResults: StepExecutionResult[];
  actualOutput: string;
  status: TestStatus;
  error?: string;
  executionDate: string;
}

export type RunStatus =
  | 'not_started'
  | 'running'
  | 'completed'
  | 'incomplete'
  | 'failed'
  | 'aborted';

export interface TestRunState {
  runId: string;
  status: RunStatus;
  fileName: string;
  headless: boolean;
  sheets: TestSheet[];
  results: TestExecutionResult[];
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  reportPath?: string;
  aborted: boolean;
}

export interface AIActionPlan {
  actions: PlaywrightAction[];
  skipped: boolean;
  skipReason?: string;
  understood: boolean;
}

export interface AIEvaluation {
  actualOutput: string;
  matchPercentage: number;
  status: TestStatus;
  reasoning: string;
}
