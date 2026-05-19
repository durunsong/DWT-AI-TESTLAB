import { maskSensitive, resolveVariables, type RuntimeContextState, type ScenarioStep, type StepResult } from "@ai-e2e/shared";
import { DbExecutor } from "./db-executor";

type DbRow = Record<string, unknown>;

export class DbStepExecutor {
  constructor(
    private readonly input: {
      context: { state: RuntimeContextState; setVariable: (key: string, value: string) => void };
      db: DbExecutor;
    }
  ) {}

  async execute(step: ScenarioStep): Promise<Partial<StepResult>> {
    if (step.type === "db_query") {
      return this.query(step);
    }
    if (step.type === "db_assert") {
      return this.assert(step);
    }
    if (step.type === "db_clean") {
      throw new Error("db_clean 暂未开放：当前 DB 能力只允许只读查询和断言");
    }
    throw new Error(`DB 执行器不支持步骤类型：${step.type}`);
  }

  private async query(step: ScenarioStep): Promise<Partial<StepResult>> {
    const rows = await this.executeQuery(step);
    const variable = step.save_as || step.variable;
    if (variable) {
      this.input.context.setVariable(variable, this.variableValue(rows, step.row_index ?? 0));
    }

    return {
      message: variable ? `DB 查询完成，已写入变量：${variable}` : `DB 查询完成：${rows.length} 行`,
      data: this.reportData(rows)
    };
  }

  private async assert(step: ScenarioStep): Promise<Partial<StepResult>> {
    const rows = await this.executeQuery(step);
    if (!rows.length) {
      throw new Error("DB 断言失败：查询结果为空");
    }

    const rowIndex = step.row_index ?? 0;
    const row = rows[rowIndex];
    if (!row) {
      throw new Error(`DB 断言失败：结果不存在第 ${rowIndex + 1} 行`);
    }

    if (typeof step.expected === "string") {
      const expected = resolveVariables(step.expected, this.input.context.state, step);
      const actual = JSON.stringify(row);
      if (!actual.includes(expected)) {
        throw new Error(`DB 断言失败：查询结果不包含 ${expected}`);
      }
    } else if (step.expected && typeof step.expected === "object") {
      for (const [key, rawExpected] of Object.entries(step.expected)) {
        const expected = typeof rawExpected === "string"
          ? resolveVariables(rawExpected, this.input.context.state, step)
          : rawExpected;
        const actual = row[key];
        if (String(actual ?? "") !== String(expected ?? "")) {
          throw new Error(`DB 断言失败：${key} 期望 ${String(expected)}，实际 ${String(actual)}`);
        }
      }
    } else {
      throw new Error("db_assert 必须指定 expected");
    }

    return {
      message: `DB 断言通过：${rows.length} 行`,
      data: this.reportData(rows)
    };
  }

  private async executeQuery(step: ScenarioStep): Promise<DbRow[]> {
    if (!step.sql) {
      throw new Error(`${step.type} 必须指定 sql`);
    }
    const sql = resolveVariables(step.sql, this.input.context.state, step);
    const params = (step.params ?? []).map((param) => typeof param === "string"
      ? resolveVariables(param, this.input.context.state, step)
      : param);
    return this.input.db.execute<DbRow>(sql, params);
  }

  private variableValue(rows: DbRow[], rowIndex: number): string {
    const row = rows[rowIndex];
    if (!row) {
      return "";
    }
    const values = Object.values(row);
    if (values.length === 1) {
      return String(values[0] ?? "");
    }
    return JSON.stringify(row);
  }

  private reportData(rows: DbRow[]) {
    return maskSensitive({
      rowCount: rows.length,
      rows: rows.slice(0, 5)
    });
  }
}
