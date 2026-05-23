import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CaseService } from "./case.service";

test("lists reusable shared abilities from cases/shared yaml files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-shared-abilities-"));
  await fs.mkdir(path.join(rootDir, "cases", "shared", "common"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "cases", "shared", "kyc"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "cases", "shared", "common", "web_login.yaml"), [
    "shared_id: common/web_login",
    "name: 登录复用流程",
    "description: 打开登录页并执行 flow_login",
    "tags: [login, user, admin]",
    "params:",
    "  session:",
    "    required: true",
    "  url:",
    "    default: \"${session.login_url}\"",
    "steps:",
    "  - step_id: open_login",
    "    name: 打开登录页",
    "    type: web_open",
    "    session: \"${session}\"",
    "    url: \"${url}\"",
    "  - step_id: login",
    "    name: 执行登录",
    "    type: flow_login",
    "    session: \"${session}\"",
    ""
  ].join("\n"), "utf8");
  await fs.writeFile(path.join(rootDir, "cases", "shared", "kyc", "submit.yaml"), [
    "shared_id: kyc/submit",
    "name: KYC 提交",
    "phases:",
    "  mainSteps:",
    "    - step_id: submit_kyc",
    "      name: 提交 KYC",
    "      type: flow_submit_kyc",
    "      session: user",
    ""
  ].join("\n"), "utf8");

  const service = new CaseService({} as never, rootDir);
  const abilities = await service.listSharedAbilities();

  assert.deepEqual(abilities.map((item) => item.sharedId), ["common/web_login", "kyc/submit"]);
  assert.equal(abilities[0]?.name, "登录复用流程");
  assert.equal(abilities[0]?.file, "cases/shared/common/web_login.yaml");
  assert.deepEqual(abilities[0]?.params.map((item) => item.name), ["session", "url"]);
  assert.equal(abilities[0]?.stepCount, 2);
  assert.equal(abilities[1]?.stepCount, 1);
});
