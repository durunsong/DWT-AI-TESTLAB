export class ApiExecutor {
  async execute(): Promise<never> {
    throw new Error("P0 阶段暂未启用 API 校验，请在 API_ENABLED=true 后扩展 ApiExecutor");
  }
}
