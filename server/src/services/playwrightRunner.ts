import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import type { PlaywrightAction, StepExecutionResult } from '../types/index.js';

export class PlaywrightRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private headless: boolean;
  private screenshotDir: string;

  constructor(headless: boolean, screenshotDir: string) {
    this.headless = headless;
    this.screenshotDir = screenshotDir;
  }

  async launch(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  getPage(): Page | null {
    return this.page;
  }

  async getPageText(): Promise<string> {
    if (!this.page) return '';
    try {
      return await this.page.evaluate(() => document.body?.innerText?.slice(0, 5000) || '');
    } catch {
      return '';
    }
  }

  async getAccessibilitySnapshot(): Promise<string> {
    if (!this.page) return '';
    try {
      const snapshot = await this.page.locator('body').ariaSnapshot();
      return snapshot.slice(0, 8000);
    } catch {
      return '';
    }
  }

  private async takeScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    await fs.mkdir(this.screenshotDir, { recursive: true });
    const filePath = path.join(this.screenshotDir, `${name}.png`);
    await this.page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  }

  private resolveSelector(selector?: string): string {
    if (!selector) return 'body';
    return selector;
  }

  async executeAction(
    action: PlaywrightAction,
    screenshotPrefix: string,
    stepIndex: number
  ): Promise<StepExecutionResult> {
    if (!this.page) {
      return {
        action,
        success: false,
        error: 'Browser is not running',
      };
    }

    try {
      const page = this.page;

      switch (action.type) {
        case 'navigate': {
          const url = action.url || action.value;
          if (!url) throw new Error('Navigate action requires a URL');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: action.timeout || 30000 });
          break;
        }
        case 'click': {
          const selector = this.resolveSelector(action.selector);
          await this.clickElement(selector, action.description);
          break;
        }
        case 'fill': {
          const selector = this.resolveSelector(action.selector);
          await this.fillElement(selector, action.value || '', action.description);
          break;
        }
        case 'type': {
          const selector = this.resolveSelector(action.selector);
          await this.typeElement(selector, action.value || '', action.description);
          break;
        }
        case 'select': {
          const selector = this.resolveSelector(action.selector);
          await page.selectOption(selector, action.value || '');
          break;
        }
        case 'press': {
          await page.keyboard.press(action.key || 'Enter');
          break;
        }
        case 'wait': {
          await page.waitForTimeout(action.timeout || 2000);
          break;
        }
        case 'hover': {
          const selector = this.resolveSelector(action.selector);
          await page.hover(selector);
          break;
        }
        case 'check': {
          const selector = this.resolveSelector(action.selector);
          await page.check(selector);
          break;
        }
        case 'uncheck': {
          const selector = this.resolveSelector(action.selector);
          await page.uncheck(selector);
          break;
        }
        case 'screenshot':
          break;
      }

      const screenshotPath = await this.takeScreenshot(`${screenshotPrefix}_step${stepIndex}`);
      const pageSnapshot = await this.getAccessibilitySnapshot();

      return {
        action,
        success: true,
        screenshotPath,
        pageSnapshot,
      };
    } catch (error) {
      let screenshotPath: string | undefined;
      try {
        screenshotPath = await this.takeScreenshot(`${screenshotPrefix}_step${stepIndex}_error`);
      } catch {
        /* ignore screenshot failure */
      }

      return {
        action,
        success: false,
        screenshotPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async clickElement(selector: string, description: string): Promise<void> {
    if (!this.page) return;
    const page = this.page;

    const strategies = [
      () => page.locator(selector).first().click({ timeout: 10000 }),
      () => page.getByRole('button', { name: description }).first().click({ timeout: 5000 }),
      () => page.getByText(description, { exact: false }).first().click({ timeout: 5000 }),
      () => page.getByLabel(description).first().click({ timeout: 5000 }),
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      try {
        await strategy();
        return;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError || new Error(`Could not click: ${description}`);
  }

  private async fillElement(selector: string, value: string, description: string): Promise<void> {
    if (!this.page) return;
    const page = this.page;

    const strategies = [
      () => page.locator(selector).first().fill(value, { timeout: 10000 }),
      () => page.getByLabel(description).first().fill(value, { timeout: 5000 }),
      () => page.getByPlaceholder(description).first().fill(value, { timeout: 5000 }),
      () => page.getByRole('textbox', { name: description }).first().fill(value, { timeout: 5000 }),
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      try {
        await strategy();
        return;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError || new Error(`Could not fill: ${description}`);
  }

  private async typeElement(selector: string, value: string, description: string): Promise<void> {
    if (!this.page) return;
    const page = this.page;

    const strategies = [
      () => page.locator(selector).first().pressSequentially(value, { timeout: 10000 }),
      () => page.getByLabel(description).first().pressSequentially(value, { timeout: 5000 }),
      () => page.getByRole('textbox', { name: description }).first().pressSequentially(value, { timeout: 5000 }),
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      try {
        await strategy();
        return;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError || new Error(`Could not type into: ${description}`);
  }
}
