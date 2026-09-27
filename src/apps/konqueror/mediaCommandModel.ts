import type { KonquerorMediaLoadStatus } from "./mediaViewModel";

export type KonquerorMediaCommand = "play" | "pause" | "stop" | "previous" | "next";

export type KonquerorMediaCommandAvailability = Readonly<Record<KonquerorMediaCommand, boolean>>;

export function getKonquerorMediaCommandAvailability(
  status: KonquerorMediaLoadStatus,
  disabled: boolean,
  currentTime: number,
  hasPrevious: boolean,
  hasNext: boolean,
): KonquerorMediaCommandAvailability {
  const canStop = !disabled && (
    currentTime > 0 ||
    status === "playing" ||
    status === "paused" ||
    status === "waiting" ||
    status === "ended"
  );

  return {
    play: !disabled && (status === "ready" || status === "paused" || status === "ended" || status === "stopped"),
    pause: !disabled && (status === "playing" || status === "waiting"),
    stop: canStop,
    previous: !disabled && hasPrevious,
    next: !disabled && hasNext,
  };
}
