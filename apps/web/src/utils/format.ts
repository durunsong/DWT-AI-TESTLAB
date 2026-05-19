import dayjs from "dayjs";

export function formatDateTime(value?: string): string {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";
}

export function formatTime(value?: string): string {
  return value ? dayjs(value).format("HH:mm:ss") : "-";
}

export function formatDuration(value?: number): string {
  if (!value) return "-";
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

export function progressPercent(total: number, passed: number, failed: number, skipped: number): number {
  return total > 0 ? Math.round(((passed + failed + skipped) / total) * 100) : 0;
}
