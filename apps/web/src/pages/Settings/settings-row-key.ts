export interface EditableRowKeyInput {
  originalIndex: number;
  key?: string;
}

export function caseTypeRowKey(record: EditableRowKeyInput): string {
  return `case-type-${record.originalIndex}`;
}

export function envVariableRowKey(record: EditableRowKeyInput): string {
  return `env-variable-${record.originalIndex}`;
}
