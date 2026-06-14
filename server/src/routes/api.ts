import { Router, type Request, type Response } from 'express';

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import {
  createRunFromUpload,
  executeRun,
  getRunState,
  abortRun,
} from '../services/testExecutor.js';
import { isAIConfigured, getConfiguredProvider } from '../services/aiService.js';
import { REPORT_FILENAME } from '../services/excelService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    aiConfigured: isAIConfigured(),
    aiProvider: getConfiguredProvider(),
  });
});

router.use(requireAuth);

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const headless = req.body.headless !== 'false';
    const run = await createRunFromUpload(req.file.path, req.file.originalname, headless);

    res.json({
      runId: run.runId,
      fileName: run.fileName,
      status: run.status,
      sheets: run.sheets.map((s) => ({
        name: s.name,
        testCount: s.tests.length,
        tests: s.tests.map((t) => ({
          testName: t.testName,
          steps: t.steps,
          input: t.input,
          expectedOutput: t.expectedOutput,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
});

router.post('/run/:runId', async (req: Request, res: Response) => {
  const runId = param(req.params.runId);
  const run = getRunState(runId);

  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  if (run.status === 'running') {
    res.status(400).json({ error: 'Test is already running' });
    return;
  }

  if (!isAIConfigured()) {
    res.status(500).json({
      error: 'AI not configured. Copy .env.example to .env and add your API key.',
    });
    return;
  }

  if (req.body.headless !== undefined) {
    run.headless = req.body.headless !== false;
  }

  res.json({ message: 'Execution started', runId });

  const broadcast = (global as typeof global & { wsBroadcast?: (id: string, data: object) => void }).wsBroadcast;

  executeRun(
    runId,
    (message) => {
      run.logs.push(message);
      broadcast?.(runId, { type: 'log', message });
    },
    (status) => {
      broadcast?.(runId, { type: 'status', status });
    }
  ).then((completedRun) => {
    broadcast?.(runId, {
      type: 'complete',
      status: completedRun.status,
      results: completedRun.results,
      reportPath: completedRun.reportPath,
    });
  }).catch((error) => {
    run.logs.push(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    run.status = 'failed';
    broadcast?.(runId, { type: 'error', message: String(error) });
  });
});

router.post('/abort/:runId', (req: Request, res: Response) => {
  const aborted = abortRun(param(req.params.runId));
  if (!aborted) {
    res.status(400).json({ error: 'Cannot abort - run not active' });
    return;
  }
  res.json({ message: 'Test execution aborted' });
});

router.get('/status/:runId', (req: Request, res: Response) => {
  const run = getRunState(param(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  res.json({
    runId: run.runId,
    status: run.status,
    fileName: run.fileName,
    headless: run.headless,
    logs: run.logs,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    hasReport: !!run.reportPath && run.status !== 'aborted',
    results: run.results.map((r) => ({
      sheetName: r.sheetName,
      testName: r.testCase.testName,
      steps: r.testCase.steps,
      input: r.testCase.input,
      expectedOutput: r.testCase.expectedOutput,
      executionDate: r.executionDate,
      actualOutput: r.actualOutput,
      status: r.status,
      error: r.error,
      screenshots: r.stepResults
        .filter((s) => s.screenshotPath)
        .map((s) => ({
          description: s.action.description,
          path: s.screenshotPath,
          success: s.success,
        })),
    })),
    summary: {
      total: run.results.length,
      passed: run.results.filter((r) => r.status === 'passed').length,
      failed: run.results.filter((r) => r.status === 'failed').length,
      skipped: run.results.filter((r) => r.status === 'skipped').length,
    },
  });
});

router.get('/download/xlsx/:runId', async (req: Request, res: Response) => {
  const run = getRunState(param(req.params.runId));
  if (!run?.reportPath || run.status === 'aborted') {
    res.status(404).json({ error: 'Report not available' });
    return;
  }

  try {
    await fs.access(run.reportPath);
    res.download(run.reportPath, REPORT_FILENAME);
  } catch {
    res.status(404).json({ error: 'Report file not found' });
  }
});

router.get('/download/zip/:runId', async (req: Request, res: Response) => {
  const run = getRunState(param(req.params.runId));
  if (!run?.reportPath || run.status === 'aborted') {
    res.status(404).json({ error: 'Report not available' });
    return;
  }

  const screenshotDir = path.join(process.cwd(), 'screenshots', run.runId);
  const zipName = 'test-report.zip';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  archive.pipe(res);
  archive.file(run.reportPath, { name: REPORT_FILENAME });

  try {
    const files = await fs.readdir(screenshotDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        archive.file(path.join(screenshotDir, file), { name: `screenshots/${file}` });
      }
    }
  } catch {
    /* no screenshots */
  }

  await archive.finalize();
});

router.get('/screenshot/:runId/:filename', async (req: Request, res: Response) => {
  const filePath = path.join(process.cwd(), 'screenshots', param(req.params.runId), param(req.params.filename));
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

export default router;
