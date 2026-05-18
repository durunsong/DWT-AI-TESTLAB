import { loadDowaletContext } from "@ai-e2e/runner";

export class DowaletContextService {
  constructor(private readonly rootDir: string) {}

  async getContext() {
    return loadDowaletContext(this.rootDir);
  }
}
