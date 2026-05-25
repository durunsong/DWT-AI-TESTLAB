import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PlatformSettingsService } from "./platform-settings.service";

test("reads and saves case types with default type protection", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-settings-case-types-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  const service = new PlatformSettingsService(rootDir);

  assert.equal((await service.listCaseTypes())[0]?.key, "uncategorized");

  const saved = await service.saveCaseTypes([
    { key: "uncategorized", label: "未分类", enabled: true, sort: 0 },
    { key: "smoke", label: "冒烟", enabled: true, sort: 10, description: "核心链路" }
  ]);

  assert.deepEqual(saved.map((item) => item.key), ["uncategorized", "smoke"]);
  assert.equal(JSON.parse(await fs.readFile(path.join(rootDir, "platform.config.json"), "utf8")).caseTypes[1].label, "冒烟");
});

test("validates case type key, label and duplicate keys", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-settings-case-types-invalid-"));
  const service = new PlatformSettingsService(rootDir);

  await assert.rejects(() => service.saveCaseTypes([
    { key: "Uncategorized", label: "未分类", enabled: true, sort: 0 }
  ]), /key 不合法/);
  await assert.rejects(() => service.saveCaseTypes([
    { key: "uncategorized", label: "未分类", enabled: true, sort: 0 },
    { key: "smoke", label: "", enabled: true, sort: 10 }
  ]), /label 不能为空/);
  await assert.rejects(() => service.saveCaseTypes([
    { key: "uncategorized", label: "未分类", enabled: true, sort: 0 },
    { key: "smoke", label: "冒烟", enabled: true, sort: 10 },
    { key: "smoke", label: "重复", enabled: true, sort: 20 }
  ]), /key 重复/);
});

test("prevents deleting default and referenced case types", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-settings-case-types-delete-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "cases", "scenario", "smoke_case.yaml"), [
    "case_id: smoke_case",
    "case_name: 冒烟用例",
    "case_type: smoke",
    "mode: web",
    "sessions:",
    "  - name: user",
    "    login_url: \"${env.USER_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.user.yaml",
    "steps:",
    "  - step_id: open_page",
    "    name: open page",
    "    type: web_open",
    "    session: user",
    "    url: \"${session.login_url}\"",
    ""
  ].join("\n"), "utf8");
  const service = new PlatformSettingsService(rootDir);

  await service.saveCaseTypes([
    { key: "uncategorized", label: "未分类", enabled: true, sort: 0 },
    { key: "smoke", label: "冒烟", enabled: true, sort: 10 }
  ]);

  await assert.rejects(() => service.saveCaseTypes([
    { key: "smoke", label: "冒烟", enabled: true, sort: 10 }
  ]), /默认类型 uncategorized 不可删除/);
  await assert.rejects(() => service.saveCaseTypes([
    { key: "uncategorized", label: "未分类", enabled: true, sort: 0 }
  ]), /仍被用例引用/);
});
