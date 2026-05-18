import { SENSITIVE_KEYS } from "../constants/env";

const sensitiveKeySet = new Set(SENSITIVE_KEYS.map((key) => key.toLowerCase()));

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return sensitiveKeySet.has(normalized) || normalized.includes("password") || normalized.includes("token");
}

export function maskValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return "******";
}

export function maskSensitive<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => maskSensitive(item)) as T;
  }

  if (input && typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, maskValue(value)];
      }
      return [key, maskSensitive(value)];
    });
    return Object.fromEntries(entries) as T;
  }

  return input;
}
