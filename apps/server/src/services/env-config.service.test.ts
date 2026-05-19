import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { EnvConfigService } from "./env-config.service";

test("EnvConfigService merges template, base and env-specific values", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-config-"));
  await fs.writeFile(path.join(rootDir, ".env.example"), "TEST_ENV=local\nUSER_LOGIN_URL=\nUSER_PASSWORD=\n", "utf8");
  await fs.writeFile(path.join(rootDir, ".env"), "USER_LOGIN_URL=http://base.local\nUSER_PASSWORD=base-password\n", "utf8");
  await fs.writeFile(path.join(rootDir, ".env.dev"), "USER_LOGIN_URL=http://dev.local\n", "utf8");

  const service = new EnvConfigService(rootDir);
  const config = await service.get("dev");

  assert.equal(config.fileName, ".env.dev");
  assert.equal(config.exists, true);
  assert.equal(config.variables.find((item) => item.key === "USER_LOGIN_URL")?.value, "http://dev.local");
  assert.equal(config.variables.find((item) => item.key === "USER_PASSWORD")?.source, "base");
  assert.deepEqual(config.missingKeys, ["TEST_ENV", "USER_PASSWORD"]);
});

test("EnvConfigService saves env files and applies selected env to process.env", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-config-"));
  await fs.writeFile(path.join(rootDir, ".env.example"), "TEST_ENV=local\nUSER_LOGIN_URL=\n", "utf8");
  await fs.writeFile(path.join(rootDir, ".env"), "USER_LOGIN_URL=http://base.local\n", "utf8");

  const service = new EnvConfigService(rootDir);
  await service.save("sit", [
    { key: "TEST_ENV", value: "sit" },
    { key: "USER_LOGIN_URL", value: "http://sit.local" }
  ]);
  await service.applyToProcess("sit");

  assert.equal(await fs.readFile(path.join(rootDir, ".env.sit"), "utf8").then((content) => content.includes("USER_LOGIN_URL=http://sit.local")), true);
  assert.equal(process.env.TEST_ENV, "sit");
  assert.equal(process.env.USER_LOGIN_URL, "http://sit.local");
});
