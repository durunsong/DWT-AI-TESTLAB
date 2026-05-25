export function formatVideoTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function clampVideoTime(value: number, duration: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, safeValue);
  }
  return Math.min(Math.max(0, safeValue), duration);
}

export function resolveVideoSliderValue(options: { currentTime: number; seekTime: number; seeking: boolean; duration: number }): number {
  return clampVideoTime(options.seeking ? options.seekTime : options.currentTime, options.duration);
}
