import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AIActionPlan,
  AIEvaluation,
  PlaywrightAction,
  TestCase,
} from '../types/index.js';

type AIProvider = 'openai' | 'gemini';

function getProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  return provider === 'gemini' ? 'gemini' : 'openai';
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  return response.choices[0]?.message?.content || '{}';
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { text: `${systemPrompt}\n\n${userPrompt}` },
  ]);
  return result.response.text();
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getProvider();
  if (provider === 'gemini') return callGemini(systemPrompt, userPrompt);
  return callOpenAI(systemPrompt, userPrompt);
}

function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

const ACTION_PLAN_SYSTEM = `You are a test automation assistant that converts plain English test steps into Playwright browser actions.

Rules:
- Convert steps into a sequence of simple browser actions
- Use CSS selectors or Playwright-friendly selectors (role, text, placeholder)
- If input data contains URLs, usernames, passwords, use them in actions
- If steps contain technical jargon that cannot be understood or automated (API endpoints, database queries, unit test frameworks, Cypress-specific code, etc.), mark as skipped
- Do NOT use technical terminology in descriptions - keep them simple
- Each action needs: type, description, and relevant fields (selector, value, url, key)
- Valid action types: navigate, click, fill, type, select, press, wait, screenshot, hover, check, uncheck
- Return valid JSON only`;

export async function planTestActions(testCase: TestCase): Promise<AIActionPlan> {
  const userPrompt = `Convert this test case into Playwright actions:

Test Name: ${testCase.testName}
Steps: ${testCase.steps}
Input: ${testCase.input}
Expected Output: ${testCase.expectedOutput}

Return JSON with this structure:
{
  "understood": true/false,
  "skipped": true/false,
  "skipReason": "reason if skipped",
  "actions": [
    {
      "type": "navigate|click|fill|type|select|press|wait|screenshot|hover|check|uncheck",
      "description": "simple plain English description",
      "selector": "optional CSS or text selector",
      "value": "optional value to fill/select",
      "url": "optional URL for navigate",
      "key": "optional key for press",
      "timeout": optional milliseconds for wait
    }
  ]
}`;

  try {
    const response = await callAI(ACTION_PLAN_SYSTEM, userPrompt);
    const parsed = parseJSON<AIActionPlan>(response);

    if (!parsed.actions) parsed.actions = [];
    if (parsed.skipped) {
      return {
        actions: [],
        skipped: true,
        skipReason: parsed.skipReason || 'Test steps could not be understood or automated',
        understood: false,
      };
    }

    if (!parsed.understood || parsed.actions.length === 0) {
      return {
        actions: [],
        skipped: true,
        skipReason: parsed.skipReason || 'No actionable steps could be derived from the test description',
        understood: false,
      };
    }

    return {
      actions: parsed.actions,
      skipped: false,
      understood: true,
    };
  } catch (error) {
    return {
      actions: [],
      skipped: true,
      skipReason: `Could not process test steps: ${error instanceof Error ? error.message : String(error)}`,
      understood: false,
    };
  }
}

const EVALUATION_SYSTEM = `You are a test result evaluator. Compare expected output with what actually happened in the browser.

Rules:
- Write actual output in simple plain English (2-4 sentences max)
- No technical jargon, stack traces, or code
- Describe what was seen on screen and whether it matches expectations
- Calculate matchPercentage (0-100) based on semantic similarity
- Status rules:
  - "passed" if matchPercentage >= 80
  - "failed" if matchPercentage < 80
  - "skipped" only if explicitly told the test was skipped
- Return valid JSON only`;

export async function evaluateTestResult(
  testCase: TestCase,
  stepSummaries: string[],
  pageContent: string,
  hadErrors: boolean,
  errorMessage?: string,
  forcedSkip?: string
): Promise<AIEvaluation> {
  if (forcedSkip) {
    return {
      actualOutput: forcedSkip,
      matchPercentage: 0,
      status: 'skipped',
      reasoning: forcedSkip,
    };
  }

  if (hadErrors) {
    const userPrompt = `Test: ${testCase.testName}
Expected Output: ${testCase.expectedOutput}
Steps performed: ${stepSummaries.join('; ')}
Error occurred: ${errorMessage || 'Unknown error'}
Page content snippet: ${pageContent.slice(0, 2000)}

Return JSON: { "actualOutput": "...", "matchPercentage": 0-100, "status": "failed", "reasoning": "..." }`;

    try {
      const response = await callAI(EVALUATION_SYSTEM, userPrompt);
      const parsed = parseJSON<AIEvaluation>(response);
      return { ...parsed, status: 'failed', matchPercentage: Math.min(parsed.matchPercentage, 79) };
    } catch {
      return {
        actualOutput: `The test could not finish because something went wrong while running it. ${errorMessage || ''}`.trim(),
        matchPercentage: 0,
        status: 'failed',
        reasoning: errorMessage || 'Execution error',
      };
    }
  }

  const userPrompt = `Test: ${testCase.testName}
Expected Output: ${testCase.expectedOutput}
Steps performed: ${stepSummaries.join('; ')}
Page content snippet: ${pageContent.slice(0, 3000)}

Return JSON: { "actualOutput": "simple plain English result", "matchPercentage": 0-100, "status": "passed|failed", "reasoning": "brief reason" }`;

  try {
    const response = await callAI(EVALUATION_SYSTEM, userPrompt);
    const parsed = parseJSON<AIEvaluation>(response);
    const status = parsed.matchPercentage >= 80 ? 'passed' : 'failed';
    return { ...parsed, status };
  } catch (error) {
    return {
      actualOutput: 'The test ran but the result could not be evaluated automatically.',
      matchPercentage: 0,
      status: 'failed',
      reasoning: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function generateSelectorFromSnapshot(
  description: string,
  snapshot: string
): Promise<string | null> {
  const systemPrompt = `Given a page accessibility snapshot and an element description, return the best CSS selector or Playwright locator string. Return JSON: { "selector": "..." }`;
  const userPrompt = `Find selector for: ${description}\n\nSnapshot:\n${snapshot.slice(0, 4000)}`;

  try {
    const response = await callAI(systemPrompt, userPrompt);
    const parsed = parseJSON<{ selector: string }>(response);
    return parsed.selector || null;
  } catch {
    return null;
  }
}

export function getConfiguredProvider(): string {
  return getProvider();
}

export function isAIConfigured(): boolean {
  const provider = getProvider();
  if (provider === 'gemini') return !!process.env.GEMINI_API_KEY;
  return !!process.env.OPENAI_API_KEY;
}
