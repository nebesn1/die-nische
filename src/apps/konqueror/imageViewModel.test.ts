import { describe, expect, it } from "vitest";
import { defaultKonquerorImageViewState, konquerorImageViewReducer } from "./imageViewModel";

describe("Konqueror image view state", () => {
  it("defaults to Fit to Window and preserves zoom while resetting rotation for a new image", () => {
    const loaded = konquerorImageViewReducer(
      konquerorImageViewReducer(defaultKonquerorImageViewState, { type: "start", nodeId: "a" }),
      { type: "loaded", nodeId: "a", dimensions: { width: 640, height: 480 } },
    );
    const adjusted = konquerorImageViewReducer(
      konquerorImageViewReducer(loaded, { type: "set-zoom", zoom: 200 }),
      { type: "rotate-right" },
    );
    const next = konquerorImageViewReducer(adjusted, { type: "start", nodeId: "b" });

    expect(defaultKonquerorImageViewState.zoom).toBe("fit-window");
    expect(next).toMatchObject({ nodeId: "b", zoom: 200, rotation: 0, status: "loading", dimensions: null });
  });

  it("keeps image load results tab-targeted and cycles rotation without an image mutation", () => {
    const started = konquerorImageViewReducer(defaultKonquerorImageViewState, { type: "start", nodeId: "a" });
    expect(konquerorImageViewReducer(started, { type: "loaded", nodeId: "other", dimensions: { width: 1, height: 1 } })).toBe(started);
    const rotated = [1, 2, 3, 4].reduce(
      (state) => konquerorImageViewReducer(state, { type: "rotate-right" }),
      started,
    );
    expect(rotated.rotation).toBe(0);
  });

  it("provides bounded manual zoom and a stoppable local load state", () => {
    const started = konquerorImageViewReducer(defaultKonquerorImageViewState, { type: "start", nodeId: "a" });
    const out = konquerorImageViewReducer(started, { type: "zoom-out" });
    const stopped = konquerorImageViewReducer(out, { type: "stop" });
    expect(out.zoom).toBe(50);
    expect(stopped.status).toBe("stopped");
  });
});
