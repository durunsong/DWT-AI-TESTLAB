export type TestEnv = "local" | "dev" | "sit" | "prod";

export interface EnvVariable {
  key: string;
  value: string;
  comment?: string;
  source: "file" | "base" | "template";
  sensitive: boolean;
}

export interface EnvFileConfig {
  env: TestEnv;
  fileName: string;
  exists: boolean;
  updatedAt?: string;
  variables: EnvVariable[];
  missingKeys: string[];
}

export interface EnvFileContent {
  env: TestEnv;
  fileName: string;
  exists: boolean;
  updatedAt?: string;
  content: string;
}

export interface RunSettings {
  env: TestEnv;
  headless: boolean;
  slowMo: number;
  trace: boolean;
  screenshot: boolean;
}
