import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionManager } from "./session-manager";
import type { ScenarioSession } from "@ai-e2e/shared";
import type { Browser } from "playwright";

test("initialize records sessions without opening pages until they are requested", async () => {
  const browser = new FakeBrowser();
  const manager = new SessionManager({
    headless: true,
    slowMo: 0,
    tracesDir: "traces",
    videosDir: "videos",
    defaultViewport: { width: 1920, height: 1080 },
    browserLauncher: async () => browser as unknown as Browser
  });
  const sessions: ScenarioSession[] = [
    { name: "user", login_url: "http://user/login" },
    { name: "admin", login_url: "http://admin/login" }
  ];

  await manager.initialize(sessions);

  assert.equal(browser.contexts.length, 0);

  await manager.getPage("user");

  assert.equal(browser.contexts.length, 1);
  assert.equal(browser.contexts[0]?.pages.length, 1);

  await manager.closeAll();
});

test("newPage replaces the managed page without leaving the previous page open", async () => {
  const browser = new FakeBrowser();
  const manager = new SessionManager({
    headless: true,
    slowMo: 0,
    tracesDir: "traces",
    videosDir: "videos",
    defaultViewport: { width: 1920, height: 1080 },
    browserLauncher: async () => browser as unknown as Browser
  });

  await manager.initialize([{ name: "admin", login_url: "http://admin/login" }]);
  const firstPage = await manager.getPage("admin");
  const replacementPage = await manager.newPage("admin");

  assert.notEqual(replacementPage, firstPage);
  assert.equal(firstPage.isClosed(), true);
  assert.equal(browser.contexts.length, 1);
  assert.equal(browser.contexts[0]?.pages.length, 2);

  await manager.closeAll();
});

test("records video into the configured directory when video mode is enabled", async () => {
  const previous = process.env.VIDEO;
  process.env.VIDEO = "on";
  const browser = new FakeBrowser();
  const manager = new SessionManager({
    headless: true,
    slowMo: 0,
    tracesDir: "traces",
    videosDir: "videos/run_a",
    defaultViewport: { width: 1920, height: 1080 },
    browserLauncher: async () => browser as unknown as Browser
  });

  try {
    await manager.initialize([{ name: "user", login_url: "http://user/login" }]);
    await manager.getPage("user");

    assert.deepEqual(browser.contexts[0]?.options.recordVideo, { dir: "videos/run_a", size: { width: 1920, height: 1080 } });
  } finally {
    if (previous === undefined) {
      delete process.env.VIDEO;
    } else {
      process.env.VIDEO = previous;
    }
    await manager.closeAll();
  }
});

test("uses the real fullscreen window viewport for headed browser runs", async () => {
  const browser = new FakeBrowser();
  const manager = new SessionManager({
    headless: false,
    slowMo: 0,
    tracesDir: "traces",
    videosDir: "videos/run_a",
    defaultViewport: { width: 1280, height: 720 },
    browserLauncher: async () => browser as unknown as Browser
  });

  await manager.initialize([{ name: "user", login_url: "http://user/login" }]);
  await manager.getPage("user");

  assert.equal(browser.contexts[0]?.options.viewport, null);
  assert.equal(browser.contexts[0]?.options.screen, undefined);
  assert.deepEqual(browser.contexts[0]?.options.recordVideo, { dir: "videos/run_a", size: { width: 1280, height: 720 } });

  await manager.closeAll();
});

test("does not record video when video mode is off", async () => {
  const previous = process.env.VIDEO;
  process.env.VIDEO = "off";
  const browser = new FakeBrowser();
  const manager = new SessionManager({
    headless: true,
    slowMo: 0,
    tracesDir: "traces",
    videosDir: "videos/run_a",
    defaultViewport: { width: 1920, height: 1080 },
    browserLauncher: async () => browser as unknown as Browser
  });

  try {
    await manager.initialize([{ name: "user", login_url: "http://user/login" }]);
    await manager.getPage("user");

    assert.equal(browser.contexts[0]?.options.recordVideo, undefined);
  } finally {
    if (previous === undefined) {
      delete process.env.VIDEO;
    } else {
      process.env.VIDEO = previous;
    }
    await manager.closeAll();
  }
});

class FakeBrowser {
  readonly contexts: FakeBrowserContext[] = [];
  closed = false;

  async newContext(options: Record<string, unknown> = {}): Promise<FakeBrowserContext> {
    const context = new FakeBrowserContext(options);
    this.contexts.push(context);
    return context;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeBrowserContext {
  readonly pages: FakePage[] = [];
  readonly tracing = {
    start: async () => undefined,
    stop: async () => undefined
  };
  closed = false;

  constructor(readonly options: Record<string, unknown>) {}

  async newPage(): Promise<FakePage> {
    const page = new FakePage();
    this.pages.push(page);
    return page;
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const page of this.pages) {
      await page.close();
    }
  }
}

class FakePage {
  private closed = false;

  isClosed(): boolean {
    return this.closed;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
