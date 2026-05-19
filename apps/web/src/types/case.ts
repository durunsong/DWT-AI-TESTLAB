export interface CaseItem {
  caseId: string;
  caseName: string;
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

export interface SaveCaseResult {
  saved: boolean;
  caseId?: string;
  file?: string;
  validation: CaseValidationResult;
}

export interface DeleteCaseResult {
  deleted: boolean;
  caseId: string;
  file: string;
}
