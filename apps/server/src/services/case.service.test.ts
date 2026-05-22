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

test("normalizes AI locator expressions and input text fields", () => {
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
    "  - step_id: admin_input_username",
    "    name: admin 输入新用户名",
    "    type: web_input",
    "    session: admin",
    "    target: \"${loc.admin_profile_username}\"",
    "    text: test_admin_updated"
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ target?: string; value?: string; text?: string }> };
  assert.equal(validation.valid, true);
  assert.equal(parsed.steps[0]?.target, "admin_profile_username");
  assert.equal(parsed.steps[0]?.value, "test_admin_updated");
  assert.equal(parsed.steps[0]?.text, undefined);
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
  assert.equal(parsed.defaults?.step_timeout_ms, 20000);
  assert.equal(parsed.defaults?.wait_for_network, true);
});

test("removes generated db_clean steps from AI drafts", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: generated_db_case",
    "case_name: AI 生成 DB 用例",
    "mode: hybrid",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: cleanup_user",
    "    name: 清理测试数据",
    "    type: db_clean",
    "    sql: \"delete from user where id = ?\"",
    "    params:",
    "      - \"${var.user_id}\"",
    "  - step_id: assert_user",
    "    name: 只读核对用户",
    "    type: db_assert",
    "    sql: \"select id from user where id = ?\"",
    "    params:",
    "      - \"${var.user_id}\"",
    "    expected:",
    "      id: \"${var.user_id}\""
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ type?: string }> };
  assert.equal(validation.valid, true);
  assert.equal(parsed.steps.some((step) => step.type === "db_clean"), false);
  assert.equal(parsed.steps.some((step) => step.type === "db_assert"), true);
});

test("drops unsafe generated DB assertions with unknown env vars", () => {
  const service = new CaseService({} as ScenarioOrchestrator, process.cwd());
  const normalized = service.normalizeGeneratedYaml([
    "case_id: admin_profile_update",
    "case_name: admin 修改资料",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "    username: \"${env.ADMIN_USERNAME}\"",
    "    password: \"${env.ADMIN_PASSWORD}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: admin_login",
    "    name: admin 登录",
    "    type: flow_login",
    "    session: admin",
    "    username: \"${session.username}\"",
    "    password: \"${session.password}\"",
    "  - step_id: verify_db",
    "    name: 验证数据库落库",
    "    type: db_assert",
    "    session: user",
    "    sql: \"SELECT username FROM admin_user WHERE id = ?\"",
    "    params:",
    "      - \"${env.ADMIN_USER_ID}\"",
    "    expected: test_admin_001"
  ].join("\n"));

  const validation = service.validateContent(normalized);
  const parsed = YAML.parse(normalized) as { steps: Array<{ type?: string; session?: string }> };
  assert.equal(validation.valid, true);
  assert.equal(parsed.steps.some((step) => step.type === "db_assert"), false);
  assert.equal(JSON.stringify(parsed).includes("ADMIN_USER_ID"), false);
  assert.equal(parsed.steps.some((step) => step.session === "user"), false);
});

test("new case templates include runtime defaults", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-defaults-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  const service = new CaseService({} as ScenarioOrchestrator, rootDir);

  const result = await service.createCase({
    caseId: "admin_login_defaults",
    caseName: "admin 登录默认配置",
    template: "admin_login"
  });

  const parsed = YAML.parse(result.content) as { defaults?: { step_timeout_ms?: number; wait_for_network?: boolean } };
  assert.equal(result.valid, true);
  assert.equal(parsed.defaults?.step_timeout_ms, 20000);
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

test("saves case attachments under uploads by case id with a safe relative path", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-attachment-"));
  const service = new CaseService({} as ScenarioOrchestrator, rootDir);

  const result = await service.saveAttachment({
    caseId: "upload_case",
    fileName: "../身份证 front.png",
    base64: Buffer.from("fixture").toString("base64")
  });

  assert.equal(result.file.startsWith("uploads/cases/upload_case/"), true);
  assert.equal(result.file.includes(".."), false);
  assert.equal(result.file.endsWith(".png"), true);
  assert.equal(await fs.readFile(path.join(rootDir, result.file), "utf8"), "fixture");
});

test("lists existing case attachments under uploads by case id", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-attachment-list-"));
  const attachmentDir = path.join(rootDir, "uploads", "cases", "admin_zilkiaoxiugai001");
  await fs.mkdir(attachmentDir, { recursive: true });
  await fs.writeFile(path.join(attachmentDir, "favicon.png"), "png", "utf8");
  await fs.mkdir(path.join(attachmentDir, "nested"), { recursive: true });

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.listAttachments("admin_zilkiaoxiugai001");

  assert.deepEqual(result, [
    {
      name: "favicon.png",
      file: "uploads/cases/admin_zilkiaoxiugai001/favicon.png",
      sizeBytes: 3
    }
  ]);
});

test("deletes one case attachment by safe relative path", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-attachment-delete-"));
  const attachmentDir = path.join(rootDir, "uploads", "cases", "admin_zilkiaoxiugai001");
  await fs.mkdir(attachmentDir, { recursive: true });
  const attachmentPath = path.join(attachmentDir, "license.png");
  await fs.writeFile(attachmentPath, "png", "utf8");

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.deleteAttachment("admin_zilkiaoxiugai001", "uploads/cases/admin_zilkiaoxiugai001/license.png");

  assert.deepEqual(result, {
    deleted: true,
    file: "uploads/cases/admin_zilkiaoxiugai001/license.png"
  });
  await assert.rejects(() => fs.stat(attachmentPath));
});

test("searches case attachment files and folders safely", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-attachment-search-"));
  const caseDir = path.join(rootDir, "uploads", "cases", "admin_zilkiaoxiugai001");
  await fs.mkdir(path.join(caseDir, "company"), { recursive: true });
  await fs.writeFile(path.join(caseDir, "company", "license.png"), "png", "utf8");
  await fs.writeFile(path.join(caseDir, "bank-account.png"), "bank", "utf8");

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.searchAttachments({ query: "company", caseId: "admin_zilkiaoxiugai001" });

  assert.deepEqual(result.map((item) => ({ kind: item.kind, file: item.file })), [
    { kind: "directory", file: "uploads/cases/admin_zilkiaoxiugai001/company" },
    { kind: "file", file: "uploads/cases/admin_zilkiaoxiugai001/company/license.png" }
  ]);
});

test("deletes case attachments only when requested while deleting a case", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-case-delete-with-attachments-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "uploads", "cases", "delete_me"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "uploads", "cases", "delete_me", "license.png"), "png", "utf8");
  await fs.writeFile(path.join(rootDir, "cases", "scenario", "delete_me.yaml"), [
    "case_id: delete_me",
    "case_name: delete me",
    "mode: web",
    "sessions:",
    "  - name: admin",
    "    login_url: \"${env.ADMIN_LOGIN_URL}\"",
    "    username: \"${env.ADMIN_USERNAME}\"",
    "    password: \"${env.ADMIN_PASSWORD}\"",
    "locations:",
    "  file: cases/location/login.admin.yaml",
    "steps:",
    "  - step_id: open_admin_login",
    "    name: open admin login",
    "    type: web_open",
    "    session: admin",
    "    url: \"${session.login_url}\"",
    ""
  ].join("\n"), "utf8");

  const service = new CaseService({} as ScenarioOrchestrator, rootDir);
  const result = await service.deleteCase("delete_me", { deleteAttachments: true });

  assert.equal(result.deleted, true);
  assert.equal(result.attachmentsDeleted, true);
  assert.equal(result.attachmentsDir, "uploads/cases/delete_me");
  await assert.rejects(() => fs.stat(path.join(rootDir, "uploads", "cases", "delete_me")));
});
