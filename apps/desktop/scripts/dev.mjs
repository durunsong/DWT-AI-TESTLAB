import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(desktopDir, "../..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const node = process.execPath;
const webUrl = process.env.DWT_DESKTOP_DEV_SERVER_URL ?? "http://127.0.0.1:4301";

const children = new Set();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  for (const child of children) {
    child.kill();
  }
});

await run(node, ["scripts/build.mjs"], { cwd: desktopDir });

const web = spawnChild(pnpm, ["--filter", "@ai-e2e/web", "dev"], {
  cwd: rootDir,
  env: process.env
});

await waitForUrl(webUrl);

const electron = spawnChild(pnpm, ["exec", "electron", "."], {
  cwd: desktopDir,
  env: {
    ...withoutElectronRunAsNode(process.env),
    DWT_DESKTOP_DEV_SERVER_URL: webUrl
  }
});

electron.on("exit", (code) => {
  web.kill();
  process.exit(code ?? 0);
});

function spawnChild(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: "inherit" });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, options);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
      }
    });
  });
}

async function waitForUrl(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function shutdown() {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
}

function withoutElectronRunAsNode(env) {
  const nextEnv = { ...env };
  delete nextEnv.ELECTRON_RUN_AS_NODE;
  return nextEnv;
}
