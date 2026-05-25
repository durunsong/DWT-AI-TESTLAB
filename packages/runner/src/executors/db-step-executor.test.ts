import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuntimeContextState, ScenarioStep } from "@ai-e2e/shared";
import { DbStepExecutor } from "./db-step-executor";
import type { DbExecutor } from "./db-executor";

describe("DbStepExecutor", () => {
  it("runs db_query and saves a single-column value into variables", async () => {
    const saved: Record<string, string> = {};
    const executor = new DbStepExecutor({
      context: { state: state(), setVariable: (key, value) => { saved[key] = value; } },
      db: fakeDb([{ user_id: 1001 }])
    });

    const result = await executor.execute({
      step_id: "query_user",
      name: "查询用户 ID",
      type: "db_query",
      sql: "select user_id from user where mobile = ?",
      params: ["${var.user_mobile}"],
      save_as: "user_id"
    });

    assert.equal(saved.user_id, "1001");
    assert.equal(result.message, "DB 查询完成，已写入变量：user_id");
    assert.deepEqual(result.data, { rowCount: 1, rows: [{ user_id: 1001 }] });
  });

  it("asserts selected row fields", async () => {
    const executor = new DbStepExecutor({
      context: { state: state({ expected_status: "APPROVED" }), setVariable: () => undefined },
      db: fakeDb([{ status: "PENDING" }, { status: "APPROVED" }])
    });

    const result = await executor.execute({
      step_id: "assert_status",
      name: "断言审核状态",
      type: "db_assert",
      sql: "select status from kyc where user_id = ?",
      params: ["${var.user_id}"],
      row_index: 1,
      expected: { status: "${var.expected_status}" }
    });

    assert.equal(result.message, "DB 断言通过：2 行");
  });

  it("throws when field assertion fails", async () => {
    const executor = new DbStepExecutor({
      context: { state: state(), setVariable: () => undefined },
      db: fakeDb([{ status: "PENDING" }])
    });

    await assert.rejects(
      () => executor.execute({
        step_id: "assert_status",
        name: "断言审核状态",
        type: "db_assert",
        sql: "select status from kyc",
        expected: { status: "APPROVED" }
      }),
      /DB 断言失败：status 期望 APPROVED，实际 PENDING/
    );
  });

  it("does not allow db_clean", async () => {
    const executor = new DbStepExecutor({
      context: { state: state(), setVariable: () => undefined },
      db: fakeDb([])
    });

    await assert.rejects(
      () => executor.execute({
        step_id: "clean",
        name: "清理数据",
        type: "db_clean"
      } as ScenarioStep),
      /db_clean 暂未开放/
    );
  });
});

function fakeDb(rows: Array<Record<string, unknown>>): DbExecutor {
  return {
    execute: async () => rows
  } as unknown as DbExecutor;
}

function state(variables: Record<string, string> = {}): RuntimeContextState {
  return {
    runId: "run_test",
    env: "local",
    timestamp: "2026-05-19T00:00:00.000Z",
    variables: { user_id: "1001", user_mobile: "17800000000", ...variables },
    scenario: {
      case_id: "db_case",
      case_name: "DB 用例",
      case_type: "uncategorized",
      mode: "hybrid",
      sessions: [],
      locations: { file: "cases/location/login.user.yaml" },
      steps: []
    },
    sessions: {
      user: {
        name: "user",
        login_url: "${env.USER_LOGIN_URL}",
        username: "${env.USER_USERNAME}",
        password: "${env.USER_PASSWORD}"
      },
      admin: {
        name: "admin",
        login_url: "${env.ADMIN_LOGIN_URL}",
        username: "${env.ADMIN_USERNAME}",
        password: "${env.ADMIN_PASSWORD}"
      }
    }
  };
}
