import { useMemo } from 'react';
import type { RunStatus, SheetPreview } from '../types';

export type TestProgressStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestProgressItem {
  sheetName: string;
  testName: string;
  status: TestProgressStatus;
}

function buildInitialItems(sheets: SheetPreview[]): TestProgressItem[] {
  return sheets.flatMap((sheet) =>
    sheet.tests.map((test) => ({
      sheetName: sheet.name,
      testName: test.testName,
      status: 'pending' as const,
    }))
  );
}

function findTestItem(
  items: TestProgressItem[],
  testName: string,
  sheetName: string
): TestProgressItem | undefined {
  return items.find((item) => item.testName === testName && item.sheetName === sheetName);
}

export function useRunProgress(
  logs: string[],
  status: RunStatus,
  sheets: SheetPreview[]
): { items: TestProgressItem[]; currentTest: TestProgressItem | null; showProgress: boolean } {
  return useMemo(() => {
    const items = buildInitialItems(sheets);
    if (items.length === 0) {
      return { items, currentTest: null, showProgress: false };
    }

    let currentSheet = items[0]?.sheetName ?? '';

    for (const log of logs) {
      const sheetMatch = log.match(/^\[SHEET\] Processing sheet: "(.+?)"/);
      if (sheetMatch) {
        currentSheet = sheetMatch[1];
      }

      const testStartMatch = log.match(/^\[TEST\] Running: "(.+?)"/);
      if (testStartMatch) {
        const item = findTestItem(items, testStartMatch[1], currentSheet);
        if (item) {
          item.status = 'running';
        }
      }

      const testEndMatch = log.match(/^\[(PASS|FAIL|SKIP)\] "(.+?)" - /);
      if (testEndMatch) {
        const outcome = testEndMatch[1];
        const item = findTestItem(items, testEndMatch[2], currentSheet);
        if (item) {
          item.status = outcome === 'PASS' ? 'passed' : outcome === 'FAIL' ? 'failed' : 'skipped';
        }
      }
    }

    if (status === 'aborted') {
      for (const item of items) {
        if (item.status === 'running') {
          item.status = 'pending';
        }
      }
    }

    const currentTest = items.find((item) => item.status === 'running') ?? null;

    return {
      items,
      currentTest,
      showProgress: status === 'running' && sheets.length > 0,
    };
  }, [logs, status, sheets]);
}
