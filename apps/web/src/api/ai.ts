import { request } from "./request";
import { AI_REQUEST_OPTIONS } from "./timeouts";

export interface AnalyzeScreenshotInput {
  screenshotPath: string;
  runId?: string;
  stepId?: string;
  error?: string;
}

export type CaseYamlAssistMode = "write" | "continue" | "optimize" | "fix";

export interface CaseYamlAssistInput {
  mode: CaseYamlAssistMode;
  caseId?: string;
  currentYaml: string;
  instruction?: string;
  validationIssues?: Array<{ path: string; message: string }>;
  files?: AiMaterialFileInput[];
}

export interface AiMaterialFileInput {
  name: string;
  mimeType?: string;
  base64: string;
}

export interface MaterialCaseDraftInput {
  caseId: string;
  caseName: string;
  description?: string;
  templateHint?: string;
  requirement?: string;
  prdText?: string;
  docUrls?: string[];
  files?: AiMaterialFileInput[];
  sharedAbilities?: Array<{
    sharedId: string;
    name: string;
    description?: string;
    params: Array<{ name: string; required?: boolean; defaultValue?: string; description?: string }>;
    stepCount: number;
    file: string;
  }>;
}

export interface MaterialCaseDraftResult {
  prompt: string;
  content: string;
  sources: Array<{ title: string; length: number }>;
}

export function analyzeScreenshot(input: AnalyzeScreenshotInput): Promise<string> {
  return request.post<unknown, { content: string }>("/ai/analyze-screenshot", input, AI_REQUEST_OPTIONS).then((result) => result.content);
}

export function assistCaseYaml(input: CaseYamlAssistInput): Promise<string> {
  return request.post<unknown, { content: string }>("/ai/cases/assist", input, AI_REQUEST_OPTIONS).then((result) => result.content);
}

export function generateMaterialCaseDraft(input: MaterialCaseDraftInput): Promise<MaterialCaseDraftResult> {
  return request.post<unknown, MaterialCaseDraftResult>("/ai/cases/material-draft", input, AI_REQUEST_OPTIONS);
}
