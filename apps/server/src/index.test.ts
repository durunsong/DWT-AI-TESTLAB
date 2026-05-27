import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer, resolveServerRootDir, shouldStartHttpServer } from "./index";

test("does not start the HTTP server just because Vercel env exists", () => {
  assert.equal(shouldStartHttpServer({
    argvEntry: "/var/task/api/index.js",
    isVercel: true
  }), false);
});

test("resolves workspace root when command starts from apps/server", () => {
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const serverDir = path.resolve(workspaceRoot, "apps", "server");
  assert.equal(resolveServerRootDir(serverDir), workspaceRoot);
});

test("Vercel config targets the api function entry", async () => {
  const config = JSON.parse(await fs.readFile(path.resolve(process.cwd(), "vercel.json"), "utf8")) as {
    functions?: Record<string, unknown>;
    rewrites?: Array<{ source: string; destination: string }>;
  };

  assert.ok(config.functions?.["api/index.ts"]);
  assert.deepEqual(config.rewrites?.[0], {
    source: "/(.*)",
    destination: "/api/index"
  });
});

test("rejects unsafe cross-origin settings writes by default", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-server-origin-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  await fs.writeFile(path.join(rootDir, ".env.example"), "TEST_ENV=\n", "utf8");

  const app = await createServer({ rootDir, logger: false });
  try {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/env-files/local/content",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json"
      },
      payload: { content: "TEST_ENV=local\n" }
    });

    assert.equal(response.statusCode, 403);
    await assert.rejects(() => fs.readFile(path.join(rootDir, ".env.local"), "utf8"));
  } finally {
    await app.close();
  }
});
