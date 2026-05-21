import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { preflightScenarioContent } from "./scenario-preflight";

describe("preflightScenarioContent", () => {
  it("reports missing env vars and unknown location keys before run", async () => {
    const rootDir = await tempWorkspace();
    delete process.env.USER_LOGIN_URL;
    delete process.env.USER_USERNAME;
    delete process.env.USER_PASSWORD;

    const result = await preflightScenarioContent({
      rootDir,
      content: scenarioYaml({
        sessions: [
          "  - name: user",
          "    login_url: \"${env.USER_LOGIN_URL}\"",
          "    username: \"${env.USER_USERNAME}\"",
          "    password: \"${env.USER_PASSWORD}\""
        ],
        steps: [
          "  - step_id: open",
          "    name: open",
          "    type: web_open",
          "    session: user",
          "    url: \"${session.login_url}\"",
          "  - step_id: click_missing",
          "    name: click",
          "    type: web_click",
          "    session: user",
          "    target: missing_button"
        ]
      })
    });

    assert.equal(result.runnable, false);
    assert.deepEqual(result.summary.missingEnvVars, ["USER_LOGIN_URL", "USER_PASSWORD", "USER_USERNAME"]);
    assert.equal(result.issues.some((issue) => issue.code === "location_key_missing" && issue.severity === "warning"), true);
  });

  it("requires API base url for api-only relative requests", async () => {
    const rootDir = await tempWorkspace();
    const previous = process.env.API_BASE_URL;
    delete process.env.API_BASE_URL;

    try {
      const result = await preflightScenarioContent({
        rootDir,
        content: scenarioYaml({
          sessions: [
            "  - name: user",
            "    login_url: \"https://example.test/login\""
          ],
          steps: [
            "  - step_id: query",
            "    name: query",
            "    type: api_assert",
            "    url: /api/users",
            "    expected:",
            "      code: \"0000\""
          ]
        })
      });

      assert.equal(result.runnable, false);
      assert.equal(result.summary.apiSteps, 1);
      assert.equal(result.issues.some((issue) => issue.code === "api_base_url_missing"), true);
    } finally {
      if (previous === undefined) {
        delete process.env.API_BASE_URL;
      } else {
        process.env.API_BASE_URL = previous;
      }
    }
  });

  it("passes for an absolute API assertion with strong expected fields", async () => {
    const rootDir = await tempWorkspace();
    const result = await preflightScenarioContent({
      rootDir,
      content: scenarioYaml({
        sessions: [
          "  - name: user",
          "    login_url: \"https://example.test/login\""
        ],
        steps: [
          "  - step_id: query",
          "    name: query",
          "    type: api_assert",
          "    url: https://api.example.test/users",
          "    expected_status: 200",
          "    expected:",
          "      code: \"0000\""
        ]
      })
    });

    assert.equal(result.runnable, true);
    assert.equal(result.summary.apiSteps, 1);
    assert.equal(result.summary.errors, 0);
  });
});

async function tempWorkspace(): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-preflight-"));
  await fs.mkdir(path.join(rootDir, "cases", "location"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "cases", "location", "login.user.yaml"), [
    "known_button:",
    "  text: Known",
    ""
  ].join("\n"), "utf8");
  return rootDir;
}

function scenarioYaml(input: { sessions: string[]; steps: string[] }): string {
  return [
    "case_id: preflight_case",
    "case_name: Preflight Case",
    "mode: web",
    "sessions:",
    ...input.sessions,
    "locations:",
    "  file: cases/location/login.user.yaml",
    "steps:",
    ...input.steps,
    ""
  ].join("\n");
}
