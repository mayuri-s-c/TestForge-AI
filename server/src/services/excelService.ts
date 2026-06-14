import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import type { TestCase, TestSheet } from '../types/index.js';

export const REPORT_FILENAME = 'test-report.xlsx';

const COLUMN_MAP: Record<string, keyof TestCase> = {
  'test name': 'testName',
  'testname': 'testName',
  name: 'testName',
  steps: 'steps',
  step: 'steps',
  input: 'input',
  inputs: 'input',
  'expected output': 'expectedOutput',
  expected: 'expectedOutput',
  'expected result': 'expectedOutput',
  'execution date': 'executionDate',
  'actual output': 'actualOutput',
  status: 'status',
  error: 'error',
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellValue(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value) return String((value as { text: string }).text);
  if (value instanceof Date) {
    const d = value.getDate().toString().padStart(2, '0');
    const m = (value.getMonth() + 1).toString().padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(value).trim();
}

export async function parseExcelFile(filePath: string): Promise<TestSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets: TestSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    if (!worksheet || worksheet.rowCount < 2) continue;

    const headerRow = worksheet.getRow(1);
    const columnIndex: Partial<Record<keyof TestCase, number>> = {};

    headerRow.eachCell((cell, colNumber) => {
      const header = normalizeHeader(cell.value);
      const field = COLUMN_MAP[header];
      if (field) columnIndex[field] = colNumber;
    });

    if (!columnIndex.testName || !columnIndex.steps) continue;

    const tests: TestCase[] = [];

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const testName = columnIndex.testName
        ? cellValue(row.getCell(columnIndex.testName))
        : '';
      const steps = columnIndex.steps ? cellValue(row.getCell(columnIndex.steps)) : '';

      if (!testName && !steps) continue;

      const testCase: TestCase = {
        rowIndex: rowNum,
        testName,
        steps,
        input: columnIndex.input ? cellValue(row.getCell(columnIndex.input)) : '',
        expectedOutput: columnIndex.expectedOutput
          ? cellValue(row.getCell(columnIndex.expectedOutput))
          : '',
        executionDate: columnIndex.executionDate
          ? cellValue(row.getCell(columnIndex.executionDate))
          : undefined,
        actualOutput: columnIndex.actualOutput
          ? cellValue(row.getCell(columnIndex.actualOutput))
          : undefined,
        status: columnIndex.status
          ? (cellValue(row.getCell(columnIndex.status)) as TestCase['status'])
          : undefined,
        error: columnIndex.error ? cellValue(row.getCell(columnIndex.error)) : undefined,
      };

      tests.push(testCase);
    }

    if (tests.length > 0) {
      sheets.push({ name: worksheet.name, tests });
    }
  }

  return sheets;
}

export async function writeReportFile(
  sourceFilePath: string,
  sheets: TestSheet[],
  outputDir: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourceFilePath);

  for (const sheet of sheets) {
    let worksheet = workbook.getWorksheet(sheet.name);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(sheet.name);
      worksheet.addRow([
        'Test Name',
        'Steps',
        'Input',
        'Expected Output',
        'Execution Date',
        'Actual Output',
        'Status',
        'Error',
      ]);
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => headers.push(normalizeHeader(cell.value)));

    const ensureColumn = (title: string) => {
      const normalized = normalizeHeader(title);
      let idx = headers.findIndex((h) => h === normalized);
      if (idx === -1) {
        idx = headers.length;
        headers.push(normalized);
        worksheet!.getCell(1, idx + 1).value = title;
      }
      return idx + 1;
    };

    const colTestName = ensureColumn('Test Name');
    const colSteps = ensureColumn('Steps');
    const colInput = ensureColumn('Input');
    const colExpected = ensureColumn('Expected Output');
    const colExecDate = ensureColumn('Execution Date');
    const colActual = ensureColumn('Actual Output');
    const colStatus = ensureColumn('Status');
    const colError = ensureColumn('Error');

    for (const test of sheet.tests) {
      const row = worksheet.getRow(test.rowIndex);
      row.getCell(colTestName).value = test.testName;
      row.getCell(colSteps).value = test.steps;
      row.getCell(colInput).value = test.input;
      row.getCell(colExpected).value = test.expectedOutput;
      row.getCell(colExecDate).value = test.executionDate ?? '';
      row.getCell(colActual).value = test.actualOutput ?? '';
      row.getCell(colStatus).value = test.status ?? '';
      row.getCell(colError).value = test.error ?? '';
      row.commit();
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, REPORT_FILENAME);
  await workbook.xlsx.writeFile(reportPath);
  return reportPath;
}

export function formatExecutionDate(date: Date = new Date()): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
