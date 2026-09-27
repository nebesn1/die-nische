export function normalizeKonquerorVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampKonquerorMediaTime(value: number, duration: number | null): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.max(0, value);
  return duration !== null ? Math.min(duration, normalized) : normalized;
}

export function formatKonquerorMediaTime(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "--:--";

  const totalSeconds = Math.floor(value);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
