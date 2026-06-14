# AI Automation

An AI-powered test automation platform that reads test cases from Excel spreadsheets, executes them using Playwright browser automation, evaluates results with OpenAI or Google Gemini, and produces updated reports with screenshots.

## Features

- **Excel-based test cases** — Upload `.xlsx` files with columns: Test Name, Steps, Input, Expected Output
- **Multi-sheet support** — Process multiple tabs/sheets sequentially
- **AI-driven execution** — Converts plain English steps into Playwright browser actions
- **Smart status evaluation** — Passed (≥80% match), Failed (<80% or errors), Skipped (ununderstood steps)
- **Real-time terminal logs** — Watch test execution live via WebSocket
- **Screenshot capture** — Screenshot taken after every action
- **Report generation** — Updated Excel with Execution Date, Actual Output, Status, Error columns
- **Download options** — Download updated `.xlsx` or ZIP (xlsx + screenshots)
- **Headless/Headed mode** — Toggle browser visibility (default: headless)

## Quick Start

### 1. Install dependencies

```bash
cd ai-test-runner
npm install
```

### 2. Configure AI provider

```bash
cp .env.example .env
```

Edit `.env` and set your API key:

**Option A — OpenAI (default)**
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Option B — Google Gemini**
```
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-2.0-flash
```

### 3. Create a sample test file (optional)

```bash
npx tsx sample/createSample.ts
```

This creates `sample/sample_test_cases.xlsx`.

### 4. Run the application

```bash
npm run dev
```

- **Frontend UI (dev)**: http://localhost:5173 — use this during development (Vite hot reload)
- **Backend API**: http://localhost:3001 — REST API and WebSocket only in dev; serves both UI and API after `npm run build && npm start`

## Excel Format

Each sheet must have a header row with these columns (case-insensitive):

| Column | Description |
|--------|-------------|
| Test Name | Short name/idea for the test |
| Steps | Plain English description of what to test and how |
| Input | URLs, usernames, passwords, or any data needed |
| Expected Output | What should happen after performing the steps |

After execution, these columns are added/updated:

| Column | Description |
|--------|-------------|
| Execution Date | DD/MM/YYYY format |
| Actual Output | Plain English description of what was observed |
| Status | `passed`, `failed`, or `skipped` |
| Error | Detailed error logs if something went wrong |

### Status Rules

- **Passed** — Actual output matches ≥80% of expected output
- **Failed** — Match <80%, or an error occurred during execution
- **Skipped** — Steps contain technical terms the AI cannot automate (API calls, DB queries, Cypress code, etc.)

## UI Workflow

1. Upload your `.xlsx` test paper (drag & drop or click)
2. Toggle **Headless Mode** if you want to see the browser (off = headed)
3. Click **Run Tests** to start execution
4. Watch live logs in the terminal panel
5. Click **View Results** to see the results table with screenshots
6. Download the updated `.xlsx` report or ZIP archive

**Stop Test** — Aborts execution; no report is generated.

## Project Structure

```
ai-test-runner/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # UI components
│       └── hooks/          # State & WebSocket hooks
├── server/                 # Express backend
│   └── src/
│       ├── services/
│       │   ├── aiService.ts        # OpenAI / Gemini integration
│       │   ├── excelService.ts     # Excel read/write
│       │   ├── playwrightRunner.ts # Browser automation
│       │   └── testExecutor.ts     # Test orchestration
│       └── routes/api.ts           # REST API
├── uploads/                # Uploaded test files
├── reports/                # Generated report files
├── screenshots/          # Step screenshots per run
└── sample/                 # Sample test case generator
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check & AI config status |
| POST | `/api/upload` | Upload Excel file |
| POST | `/api/run/:runId` | Start test execution |
| POST | `/api/abort/:runId` | Abort running tests |
| GET | `/api/status/:runId` | Get run status & results |
| GET | `/api/download/xlsx/:runId` | Download updated Excel |
| GET | `/api/download/zip/:runId` | Download ZIP (xlsx + screenshots) |
| GET | `/api/screenshot/:runId/:filename` | View a screenshot |

## Production Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | `openai` or `gemini` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model |
| `PORT` | `3001` | Server port |

## License

MIT
