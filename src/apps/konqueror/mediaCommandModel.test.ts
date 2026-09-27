import { describe, expect, it } from "vitest";
import { getKonquerorMediaCommandAvailability } from "./mediaCommandModel";

describe("Konqueror media command availability", () => {
  it("enables Play only for a ready/paused/ended/stopped media state", () => {
    for (const status of ["ready", "paused", "ended", "stopped"] as const) {
      expect(getKonquerorMediaCommandAvailability(status, false, 0, false, false).play).toBe(true);
    }

    for (const status of ["idle", "loading", "playing", "waiting", "error"] as const) {
      expect(getKonquerorMediaCommandAvailability(status, false, 0, false, false).play).toBe(false);
    }
  });

  it("enables Pause only while media is playing or waiting", () => {
    expect(getKonquerorMediaCommandAvailability("playing", false, 0, false, false).pause).toBe(true);
    expect(getKonquerorMediaCommandAvailability("waiting", false, 0, false, false).pause).toBe(true);
    expect(getKonquerorMediaCommandAvailability("paused", false, 0, false, false).pause).toBe(false);
    expect(getKonquerorMediaCommandAvailability("error", false, 0, false, false).pause).toBe(false);
  });

  it("keeps navigation boundaries independent of playback state", () => {
    const availability = getKonquerorMediaCommandAvailability("playing", false, 4, false, true);
    expect(availability.previous).toBe(false);
    expect(availability.next).toBe(true);
    expect(availability.stop).toBe(true);
  });

  it("disables all commands for an unavailable media source", () => {
    expect(getKonquerorMediaCommandAvailability("ready", true, 0, true, true)).toEqual({
      play: false,
      pause: false,
      stop: false,
      previous: false,
      next: false,
    });
  });
});
