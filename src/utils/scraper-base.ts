import puppeteer, { Browser, Page } from 'puppeteer';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected delay: number;

  constructor(delay = 3000) {
    this.delay = delay;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    this.page = await this.browser.newPage();

    // Set user agent to look more human
    await this.page.setUserAgent(
      process.env.USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport
    await this.page.setViewport({ width: 1366, height: 768 });

    // Remove webdriver detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  protected async sleep(ms?: number) {
    const sleepTime = ms || this.delay;
    return new Promise(resolve => setTimeout(resolve, sleepTime));
  }

  protected async safeClick(selector: string) {
    if (!this.page) throw new Error('Page not initialized');

    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      await this.sleep(1000);
    } catch (error) {
      console.warn(`Could not click selector ${selector}:`, error);
    }
  }

  protected async safeGetText(selector: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const element = await this.page.$(selector);
      if (element) {
        return await this.page.evaluate(el => el.textContent?.trim() || '', element);
      }
      return null;
    } catch (error) {
      console.warn(`Could not get text from selector ${selector}:`, error);
      return null;
    }
  }

  protected async safeGetAttribute(selector: string, attribute: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const element = await this.page.$(selector);
      if (element) {
        return await this.page.evaluate((el, attr) => el.getAttribute(attr), element, attribute);
      }
      return null;
    } catch (error) {
      console.warn(`Could not get attribute ${attribute} from selector ${selector}:`, error);
      return null;
    }
  }

  protected async getAllTexts(selector: string): Promise<string[]> {
    if (!this.page) return [];

    try {
      return await this.page.$$eval(selector, elements =>
        elements.map(el => el.textContent?.trim() || '').filter(text => text.length > 0)
      );
    } catch (error) {
      console.warn(`Could not get texts from selector ${selector}:`, error);
      return [];
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  abstract scrapeProperties(searchUrl: string, maxPages?: number): Promise<any[]>;
}