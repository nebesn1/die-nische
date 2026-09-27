import { describe, expect, it } from "vitest";
import {
  initialKonquerorExternalWebLoadState,
  konquerorExternalWebLoadReducer,
} from "./externalWebLoadState";

describe("Konqueror external web load state", () => {
  it("creates a fresh generation for every owned external request", () => {
    const first = konquerorExternalWebLoadReducer(initialKonquerorExternalWebLoadState, {
      type: "start",
      canonicalUrl: "https://example.com/",
    });
    const reloaded = konquerorExternalWebLoadReducer(first, {
      type: "start",
      canonicalUrl: "https://example.com/",
    });

    expect(first).toEqual({ canonicalUrl: "https://example.com/", generation: 1, status: "loading" });
    expect(reloaded).toEqual({ canonicalUrl: "https://example.com/", generation: 2, status: "loading" });
  });

  it("accepts only the exact pending iframe load and ignores stale events", () => {
    const current = konquerorExternalWebLoadReducer(
      konquerorExternalWebLoadReducer(initialKonquerorExternalWebLoadState, {
        type: "start",
        canonicalUrl: "https://example.com/",
      }),
      { type: "start", canonicalUrl: "https://example.org/" },
    );
    const stale = konquerorExternalWebLoadReducer(current, {
      type: "loaded",
      canonicalUrl: "https://example.com/",
      generation: 1,
    });
    const loaded = konquerorExternalWebLoadReducer(stale, {
      type: "loaded",
      canonicalUrl: "https://example.org/",
      generation: 2,
    });

    expect(stale).toBe(current);
    expect(loaded.status).toBe("loaded");

  });

  it("stops only a pending request and clears it when owned navigation leaves external web", () => {
    const pending = konquerorExternalWebLoadReducer(initialKonquerorExternalWebLoadState, {
      type: "start",
      canonicalUrl: "https://example.com/",
    });
    const stopped = konquerorExternalWebLoadReducer(pending, { type: "stop" });
    const cleared = konquerorExternalWebLoadReducer(stopped, { type: "clear" });

    expect(stopped).toMatchObject({ status: "stopped", canonicalUrl: "https://example.com/" });
    expect(cleared).toEqual({ canonicalUrl: null, generation: 1, status: "idle" });
  });

  it("does not let an external completion settle state after Home clears the owned request", () => {
    const pending = konquerorExternalWebLoadReducer(initialKonquerorExternalWebLoadState, {
      type: "start",
      canonicalUrl: "https://example.com/",
    });
    const atHome = konquerorExternalWebLoadReducer(pending, { type: "clear" });
    const stale = konquerorExternalWebLoadReducer(atHome, {
      type: "loaded",
      canonicalUrl: "https://example.com/",
      generation: pending.generation,
    });

    expect(stale).toBe(atHome);

  });
});
