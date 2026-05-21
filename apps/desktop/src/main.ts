import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { app, BrowserWindow, shell } from "electron";
import { startServer, type StartedServer } from "../../server/src/index";

let mainWindow: BrowserWindow | undefined;
let server: StartedServer | undefined;

void app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("before-quit", () => {
  void server?.close();
});

async function bootstrap(): Promise<void> {
  const runtimeRoot = await prepareRuntimeRoot();
  preparePlaywrightRuntime();
  server = await startServer({
    rootDir: runtimeRoot,
    host: "127.0.0.1",
    port: Number(process.env.DWT_DESKTOP_API_PORT ?? 0),
    logger: !app.isPackaged
  });

  await createMainWindow();
}

function preparePlaywrightRuntime(): void {
  if (!app.isPackaged) {
    return;
  }

  const browsersPath = path.resolve(process.resourcesPath, "playwright-browsers");
  if (existsSync(browsersPath)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
  }
}

async function createMainWindow(): Promise<void> {
  if (!server) {
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1280,
    minHeight: 760,
    show: false,
    title: "DWT Testing",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const apiBaseUrl = `${server.origin}/api`;
  const devServerUrl = process.env.DWT_DESKTOP_DEV_SERVER_URL;

  if (devServerUrl) {
    const url = new URL(devServerUrl);
    url.searchParams.set("apiBaseUrl", apiBaseUrl);
    await mainWindow.loadURL(url.toString());
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await mainWindow.loadFile(path.resolve(getWebDistDir(), "index.html"), {
    query: { apiBaseUrl }
  });
}

async function prepareRuntimeRoot(): Promise<string> {
  const runtimeRoot = app.isPackaged
    ? path.resolve(app.getPath("userData"), "workspace")
    : findWorkspaceRoot(path.resolve(__dirname, "..", "..", ".."));

  await ensureDirectories(runtimeRoot);

  if (app.isPackaged) {
    await seedRuntimeRoot(runtimeRoot);
  }

  return runtimeRoot;
}

async function ensureDirectories(runtimeRoot: string): Promise<void> {
  await Promise.all(
    ["cases", "logs", "reports", "screenshots", "traces", "uploads"].map((name) =>
      fs.mkdir(path.resolve(runtimeRoot, name), { recursive: true })
    )
  );
}

async function seedRuntimeRoot(runtimeRoot: string): Promise<void> {
  const seedDir = path.resolve(process.resourcesPath, "seed");
  await copyMissingEntries(path.resolve(seedDir, "cases"), path.resolve(runtimeRoot, "cases"));
  await copyFileIfMissing(path.resolve(seedDir, ".env.example"), path.resolve(runtimeRoot, ".env.example"));
}

async function copyMissingEntries(source: string, target: string): Promise<void> {
  if (!(await pathExists(source))) {
    return;
  }

  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.resolve(source, entry.name);
    const targetPath = path.resolve(target, entry.name);

    if (entry.isDirectory()) {
      await copyMissingEntries(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFileIfMissing(sourcePath, targetPath);
    }
  }
}

async function copyFileIfMissing(source: string, target: string): Promise<void> {
  if ((await pathExists(target)) || !(await pathExists(source))) {
    return;
  }

  await fs.copyFile(source, target);
}

async function pathExists(target: string): Promise<boolean> {
  return fs.access(target).then(
    () => true,
    () => false
  );
}

function getWebDistDir(): string {
  if (app.isPackaged) {
    return path.resolve(process.resourcesPath, "web");
  }

  return path.resolve(findWorkspaceRoot(path.resolve(__dirname, "..", "..", "..")), "apps", "web", "dist");
}

function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);
  while (true) {
    if (pathExistsSync(path.resolve(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function pathExistsSync(target: string): boolean {
  return existsSync(target);
}
