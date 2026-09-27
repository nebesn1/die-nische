import { describe, expect, it } from "vitest";
import {
  canAdjustKonquerorEmbeddedContentZoom,
  defaultKonquerorEmbeddedContentState,
  getKonquerorEmbeddedContentCapabilities,
  getKonquerorEmbeddedContentZoomLevel,
  konquerorEmbeddedContentReducer,
  konquerorEmbeddedContentZoomLevels,
} from "./embeddedContentModel";
import type { KonquerorView } from "./navigationTypes";

const view = (type: KonquerorView["type"]): KonquerorView => ({ type } as KonquerorView);

describe("embedded content controls", () => {
  it("derives internal Web and Document capabilities from resolved content rather than toolbar profile alone", () => {
    expect(getKonquerorEmbeddedContentCapabilities(view("about-konqueror"), null)).toMatchObject({ kind: "internal-web", canZoom: true, canPrint: true });
    expect(getKonquerorEmbeddedContentCapabilities(view("file"), "khtml")).toMatchObject({ kind: "internal-web", canZoom: true, canPrint: true });
    expect(getKonquerorEmbeddedContentCapabilities(view("file"), "embedded-text")).toMatchObject({ kind: "document", canZoom: true, canPrint: true });
    expect(getKonquerorEmbeddedContentCapabilities(view("file"), "markdown")).toMatchObject({ kind: "document", canZoom: true, canPrint: true });
    expect(getKonquerorEmbeddedContentCapabilities(view("external-web"), null)).toMatchObject({ kind: "none", canZoom: false, canPrint: false });
    expect(getKonquerorEmbeddedContentCapabilities(view("directory"), null)).toMatchObject({ kind: "none", canZoom: false, canPrint: false });
  });

  it("uses stable discrete levels and remembers Internal Web and Document zoom independently", () => {
    expect(konquerorEmbeddedContentZoomLevels).toEqual([75, 90, 100, 110, 125, 150]);
    expect(getKonquerorEmbeddedContentZoomLevel(defaultKonquerorEmbeddedContentState, "internal-web")).toBe(100);
    expect(getKonquerorEmbeddedContentZoomLevel(defaultKonquerorEmbeddedContentState, "document")).toBe(100);

    const webAtMaximum = ["zoom-in", "zoom-in", "zoom-in"].reduce(
      (state) => konquerorEmbeddedContentReducer(state, { type: "zoom-in", kind: "internal-web" }),
      defaultKonquerorEmbeddedContentState,
    );
    const documentAtNinety = konquerorEmbeddedContentReducer(
      defaultKonquerorEmbeddedContentState,
      { type: "zoom-out", kind: "document" },
    );

    expect(getKonquerorEmbeddedContentZoomLevel(webAtMaximum, "internal-web")).toBe(150);
    expect(getKonquerorEmbeddedContentZoomLevel(webAtMaximum, "document")).toBe(100);
    expect(getKonquerorEmbeddedContentZoomLevel(documentAtNinety, "internal-web")).toBe(100);
    expect(getKonquerorEmbeddedContentZoomLevel(documentAtNinety, "document")).toBe(90);
    expect(canAdjustKonquerorEmbeddedContentZoom(webAtMaximum, "internal-web", "in")).toBe(false);
    expect(canAdjustKonquerorEmbeddedContentZoom(defaultKonquerorEmbeddedContentState, "document", "out")).toBe(true);
  });

  it("clamps at its bounds without producing an invalid zoom level", () => {
    const minimum = ["zoom-out", "zoom-out", "zoom-out"].reduce(
      (state) => konquerorEmbeddedContentReducer(state, { type: "zoom-out", kind: "document" }),
      defaultKonquerorEmbeddedContentState,
    );

    expect(getKonquerorEmbeddedContentZoomLevel(minimum, "document")).toBe(75);
    expect(canAdjustKonquerorEmbeddedContentZoom(minimum, "document", "out")).toBe(false);
    expect(konquerorEmbeddedContentReducer(minimum, { type: "zoom-out", kind: "document" })).toBe(minimum);
  });
});
