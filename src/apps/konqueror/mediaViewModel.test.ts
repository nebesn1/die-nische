import { describe, expect, it } from "vitest";
import { defaultKonquerorMediaViewState, konquerorMediaViewReducer } from "./mediaViewModel";

describe("Konqueror media view lifecycle", () => {
  it("keeps loading, playback, time, stop, and reload state explicit", () => {
    let state = konquerorMediaViewReducer(defaultKonquerorMediaViewState, { type: "start", nodeId: "clip" });
    expect(state).toMatchObject({ nodeId: "clip", status: "loading", currentTime: 0 });

    state = konquerorMediaViewReducer(state, { type: "loaded", nodeId: "clip" });
    state = konquerorMediaViewReducer(state, { type: "play", nodeId: "clip" });
    state = konquerorMediaViewReducer(state, { type: "time-update", nodeId: "clip", currentTime: 12.5 });
    expect(state).toMatchObject({ status: "playing", currentTime: 12.5 });

    state = konquerorMediaViewReducer(state, { type: "pause", nodeId: "clip" });
    expect(state.status).toBe("paused");
    state = konquerorMediaViewReducer(state, { type: "stop" });
    expect(state).toMatchObject({ status: "stopped", currentTime: 0, stopToken: 1 });

    state = konquerorMediaViewReducer(state, { type: "reload" });
    expect(state).toMatchObject({ status: "loading", currentTime: 0, reloadToken: 1 });
  });

  it("ignores stale media events and preserves per-tab identity boundaries", () => {
    const state = konquerorMediaViewReducer(
      konquerorMediaViewReducer(defaultKonquerorMediaViewState, { type: "start", nodeId: "tab-a-media" }),
      { type: "loaded", nodeId: "tab-b-media" },
    );

    expect(state).toMatchObject({ nodeId: "tab-a-media", status: "loading" });
    expect(konquerorMediaViewReducer(state, { type: "error", nodeId: "tab-b-media" })).toBe(state);
    expect(konquerorMediaViewReducer(state, { type: "time-update", nodeId: "tab-b-media", currentTime: 4 })).toBe(state);
  });

  it("does not let a pause event after Stop undo the stopped lifecycle state", () => {
    const started = konquerorMediaViewReducer(defaultKonquerorMediaViewState, { type: "start", nodeId: "clip" });
    const stopped = konquerorMediaViewReducer(started, { type: "stop" });

    expect(konquerorMediaViewReducer(stopped, { type: "pause", nodeId: "clip" })).toBe(stopped);
  });

  it("tracks metadata, buffering, seeking, volume, mute, and ended playback", () => {
    let state = konquerorMediaViewReducer(defaultKonquerorMediaViewState, { type: "start", nodeId: "clip" });
    state = konquerorMediaViewReducer(state, { type: "metadata", nodeId: "clip", duration: 120 });
    expect(state).toMatchObject({ status: "ready", duration: 120 });
    expect(konquerorMediaViewReducer(state, { type: "metadata", nodeId: "clip", duration: Number.POSITIVE_INFINITY }).duration).toBeNull();

    state = konquerorMediaViewReducer(state, { type: "waiting", nodeId: "clip" });
    expect(state.status).toBe("waiting");
    state = konquerorMediaViewReducer(state, { type: "canplay", nodeId: "clip" });
    state = konquerorMediaViewReducer(state, { type: "seek", nodeId: "clip", currentTime: 200 });
    expect(state).toMatchObject({ status: "ready", currentTime: 120 });

    state = konquerorMediaViewReducer(state, { type: "volume-change", nodeId: "clip", volume: 0.4, muted: true });
    expect(state).toMatchObject({ volume: 0.4, muted: true });
    state = konquerorMediaViewReducer(state, { type: "ended", nodeId: "clip", currentTime: 120 });
    expect(state).toMatchObject({ status: "ended", currentTime: 120 });
  });
});
