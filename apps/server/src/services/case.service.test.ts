import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ScenarioOrchestrator } from "@ai-e2e/runner";
import YAML from "yaml";
import { CaseService } from "./case.service";

test("normalizes common AI YAML field names before validation", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: admin_profile_update",
    "case_name: admin 修改资料",
    "mode: sequential",
    "sessions:",
    "  - name: admin",
    "    loginUrl: \"${env.ADMIN_LOGIN_URL}\"",
    "locations: {}",
    "steps:",
    "  - id: open_admin_login",
    "    title: 打开 admin 登录页",
    "    type: navigate",
    "    session: admin",
    "  - id: edit_profile",
    "    title: 修改资料",
    "    action: click",
    "    session: admin"
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ type?: string; username?: string; password?: string }> };
  const loginStep = parsed.steps.find((step) => step.type === "flow_login");
  assert.equal(validation.valid, true);
  assert.equal(validation.caseId, "admin_profile_update");
  assert.equal(loginStep?.username, "${session.username}");
  assert.equal(loginStep?.password, "${session.password}");
});

test("hardens AI YAML for one-pass runnable drafts", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: admin_profile_update",
    "case_name: admin 修改资料",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_open_login",
    "    name: admin 打开登录页",
    "    type: web_open",
    "    session: admin",
    "    url: \"${env.ADMIN_LOGIN_URL}/#/admin/sys/perinfo\"",
    "  - step_id: admin_upload_avatar",
    "    name: admin 上传头像",
    "    type: web_upload",
    "    session: admin",
    "    target: 上传头像",
    "    file: \"${var.AVATAR_FILE_PATH}\"",
    "  - step_id: admin_input_username",
    "    name: admin 输入用户名称",
    "    type: web_input",
    "    session: admin",
    "    target: 用户名称",
    "    value: \"${var.new_username}\""
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as {
    variables?: Record<string, string>;
    steps: Array<{ step_id: string; url?: string; type?: string }>;
  };
  assert.equal(validation.valid, true);
  assert.equal(parsed.steps[0]?.url, "${session.login_url}#/admin/sys/perinfo");
  assert.equal(parsed.steps.some((step) => step.step_id === "admin_upload_avatar"), false);
  assert.equal(parsed.variables?.new_username, "auto_${timestamp}");
});

test("inserts login page open step before first flow_login", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: admin_profile_update",
    "case_name: admin 修改资料",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_login",
    "    name: admin 登录",
    "    type: flow_login",
    "    session: admin",
    "    username: \"${session.username}\"",
    "    password: \"${session.password}\""
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ step_id: string; type: string; url?: string }> };
  assert.equal(validation.valid, true);
  assert.equal(parsed.steps[0]?.step_id, "admin_open_login");
  assert.equal(parsed.steps[0]?.type, "web_open");
  assert.equal(parsed.steps[0]?.url, "${session.login_url}");
  assert.equal(parsed.steps[1]?.step_id, "admin_login");
});

test("adds default timeout and network wait for AI drafts", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: admin_profile_update",
    "case_name: admin 修改资料",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_open_login",
    "    name: admin 打开登录页",
    "    type: web_open",
    "    session: admin",
    "    url: \"${session.login_url}\""
  ].join("\n"));

  const parsed = YAML.parse(normalized) as { defaults?: { step_timeout_ms?: number; wait_for_network?: boolean } };
  assert.equal(parsed.defaults?.step_timeout_ms, 60000);
  assert.equal(parsed.defaults?.wait_for_network, true);
});

test("preserves object expected for DB assertions in AI drafts", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: db_assert_case",
    "case_name: DB 断言",
    "mode: hybrid",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: assert_profile",
    "    name: 核对资料已落库",
    "    type: db_assert",
    "    sql: \"select nick_name from admin_user where mobile = ?\"",
    "    params:",
    "      - \"${env.ADMIN_USERNAME}\"",
    "    expected:",
    "      nick_name: \"${var.new_nick_name}\""
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ expected?: Record<string, string> }> };
  assert.equal(validation.valid, true);
  assert.deepEqual(parsed.steps[0]?.expected, { nick_name: "${var.new_nick_name}" });
});

test("deletes scenario yaml by case id", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-delete-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  const filePath = path.join(rootDir, "cases", "scenario", "delete_me.yaml");
  await fs.writeFile(filePath, [
    "case_id: delete_me",
    "case_name: 删除测试",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "    username: \"${env.ADMIN_USERNAME}\"",
    "    password: \"${env.ADMIN_PASSWORD}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_open_login",
    "    name: admin 打开登录页",
    "    type: web_open",
    "    session: admin",
    "    url: \"${session.login_url}\"",
    ""
  ].join("\n"), "utf8");

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.deleteCase("delete_me");

  assert.equal(result.deleted, true);
  assert.equal(result.caseId, "delete_me");
  assert.equal(result.file, "cases/scenario/delete_me.yaml");
  await assert.rejects(() => fs.stat(filePath));
});

test("renames scenario yaml when case_id changes on save", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-rename-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  const oldPath = path.join(rootDir, "cases", "scenario", "old_case.yaml");
  const content = [
    "case_id: old_case",
    "case_name: 旧用例",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "    username: \"${env.ADMIN_USERNAME}\"",
    "    password: \"${env.ADMIN_PASSWORD}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_open_login",
    "    name: admin 打开登录页",
    "    type: web_open",
    "    session: admin",
    "    url: \"${session.login_url}\"",
    ""
  ].join("\n");
  await fs.writeFile(oldPath, content, "utf8");

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.saveCase("old_case", content.replace("case_id: old_case", "case_id: new_case"));

  assert.equal(result.saved, true);
  assert.equal(result.caseId, "new_case");
  await assert.rejects(() => fs.stat(oldPath));
  await assert.doesNotReject(() => fs.stat(path.join(rootDir, "cases", "scenario", "new_case.yaml")));
});
