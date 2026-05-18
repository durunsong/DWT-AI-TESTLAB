import { ALLOWED_TEST_ENVS, BLOCKED_ENVS, type ScenarioCase, type TestEnv } from "@ai-e2e/shared";

const productionHostPatterns = [/prod/i, /production/i, /\.com\.cn\b/i, /\.com\b/i];

export class EnvGuard {
  static assertRunnable(env: string, scenario?: ScenarioCase): asserts env is TestEnv {
    if ((BLOCKED_ENVS as readonly string[]).includes(env)) {
      throw new Error(`禁止在 ${env} 环境执行自动化流程`);
    }

    if (!(ALLOWED_TEST_ENVS as readonly string[]).includes(env)) {
      throw new Error(`不支持的执行环境：${env}，仅允许 ${ALLOWED_TEST_ENVS.join(", ")}`);
    }

    if (scenario) {
      for (const session of scenario.sessions) {
        EnvGuard.assertNonProductionUrl(session.login_url);
      }
    }
  }

  static assertNonProductionUrl(urlValue: string): void {
    if (!urlValue || urlValue.includes("${")) {
      return;
    }
    const url = new URL(urlValue);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return;
    }
    if (productionHostPatterns.some((pattern) => pattern.test(url.hostname))) {
      throw new Error(`疑似生产域名被拦截：${url.hostname}`);
    }
  }
}
