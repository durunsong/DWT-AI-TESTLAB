import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ScenarioSession, SessionName } from "@ai-e2e/shared";

interface ManagedSession {
  config: ScenarioSession;
  context?: BrowserContext;
  page?: Page;
}

export class SessionManager {
  private browser?: Browser;
  private readonly sessions = new Map<SessionName, ManagedSession>();

  constructor(
    private readonly options: {
      headless: boolean;
      slowMo: number;
      tracesDir: string;
      defaultViewport: {
        width: number;
        height: number;
      };
      browserLauncher?: () => Promise<Browser>;
    }
  ) {}

  async initialize(sessions: ScenarioSession[]): Promise<void> {
    this.browser = this.options.browserLauncher
      ? await this.options.browserLauncher()
      : await chromium.launch({
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        args: this.options.headless ? [] : ["--start-maximized"]
      });
    for (const session of sessions) {
      this.sessions.set(session.name, { config: session });
    }
  }

  async getPage(sessionName: SessionName): Promise<Page> {
    const managed = this.sessions.get(sessionName);
    if (!managed) {
      throw new Error(`未初始化会话：${sessionName}`);
    }
    if (!managed.context || !managed.page) {
      await this.createSession(managed.config);
      return this.getPage(sessionName);
    }
    if (managed.page.isClosed()) {
      try {
        managed.page = await managed.context.newPage();
      } catch {
        await this.createSession(managed.config);
        return this.getPage(sessionName);
      }
    }
    return managed.page;
  }

  async newPage(sessionName: SessionName): Promise<Page> {
    const managed = this.sessions.get(sessionName);
    if (!managed) {
      throw new Error(`未初始化会话：${sessionName}`);
    }
    if (!managed.context || !managed.page) {
      return this.getPage(sessionName);
    }

    try {
      await managed.page.close().catch(() => undefined);
      managed.page = await managed.context.newPage();
      return managed.page;
    } catch {
      await this.createSession(managed.config);
      return this.getPage(sessionName);
    }
  }

  async cookieHeader(sessionName: SessionName, url: string): Promise<string | undefined> {
    const managed = this.sessions.get(sessionName);
    if (!managed?.context) {
      return undefined;
    }
    const cookies = await managed.context.cookies(url).catch(() => []);
    const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    return header || undefined;
  }

  async saveTrace(sessionName: SessionName, runId: string): Promise<string | undefined> {
    const managed = this.sessions.get(sessionName);
    if (!managed?.context) {
      return undefined;
    }
    const tracePath = path.resolve(this.options.tracesDir, `${runId}-${sessionName}.zip`);
    await managed.context.tracing.stop({ path: tracePath }).catch(() => undefined);
    return tracePath;
  }

  async closeAll(): Promise<void> {
    for (const managed of this.sessions.values()) {
      await managed.context?.close().catch(() => undefined);
    }
    this.sessions.clear();
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
  }

  private async createSession(config: ScenarioSession): Promise<void> {
    if (!this.browser) {
      throw new Error("浏览器尚未初始化");
    }
    const existing = this.sessions.get(config.name);
    await existing?.context?.close().catch(() => undefined);
    const width = Number(process.env.BROWSER_VIEWPORT_WIDTH ?? this.options.defaultViewport.width);
    const height = Number(process.env.BROWSER_VIEWPORT_HEIGHT ?? this.options.defaultViewport.height);
    const context = await this.browser.newContext({
      viewport: this.options.headless ? { width, height } : null,
      screen: { width, height }
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    this.sessions.set(config.name, { config, context, page });
  }
}
