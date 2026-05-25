export interface CaseItem {
  caseId: string;
  caseName: string;
  caseType: string;
  description?: string;
  mode: string;
  total: number;
  valid?: boolean;
  file?: string;
}

export interface CaseDetail extends CaseItem {
  content: string;
  validation?: CaseValidationResult;
}

export type CreateCaseTemplate = "user_login" | "admin_login" | "user_admin_kyc";

export interface CreateCaseInput {
  caseId: string;
  caseName: string;
  caseType?: string;
  description?: string;
  template: CreateCaseTemplate;
}

export interface ImportYamlResult extends CaseDetail {
  saved: boolean;
}

export interface CaseValidationIssue {
  path: string;
  message: string;
}

export interface CaseValidationResult {
  valid: boolean;
  caseId?: string;
  caseName?: string;
  issues: CaseValidationIssue[];
}

export type PreflightSeverity = "error" | "warning";

export interface CasePreflightIssue {
  severity: PreflightSeverity;
  code: string;
  path: string;
  message: string;
}

export interface CasePreflightResult {
  runnable: boolean;
  caseId?: string;
  caseName?: string;
  env: string;
  summary: {
    steps: number;
    webSteps: number;
    apiSteps: number;
    dbSteps: number;
    missingEnvVars: string[];
    warnings: number;
    errors: number;
  };
  issues: CasePreflightIssue[];
}

export interface SaveCaseResult {
  saved: boolean;
  caseId?: string;
  file?: string;
  validation: CaseValidationResult;
}

export interface CaseAttachmentResult {
  name: string;
  file: string;
  sizeBytes: number;
}

export interface CaseAttachmentSearchResult {
  kind: "file" | "directory";
  name: string;
  file: string;
  sizeBytes?: number;
}

export interface SharedAbilityParam {
  name: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface SharedAbility {
  sharedId: string;
  name: string;
  description?: string;
  tags: string[];
  params: SharedAbilityParam[];
  stepCount: number;
  file: string;
}

export interface DeleteAttachmentResult {
  deleted: boolean;
  file: string;
}

export interface DeleteCaseResult {
  deleted: boolean;
  caseId: string;
  file: string;
  attachmentsDeleted?: boolean;
  attachmentsDir?: string;
}
