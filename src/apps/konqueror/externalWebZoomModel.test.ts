import { describe, expect, it } from "vitest";
import {
  canAdjustKonquerorExternalWebZoom,
  defaultKonquerorExternalWebZoomState,
  getKonquerorExternalWebZoomGeometry,
  konquerorExternalWebZoomReducer,
} from "./externalWebZoomModel";

describe("Konqueror external web zoom", () => {
  it("uses the established discrete levels with an independent default of 100%", () => {
    expect(defaultKonquerorExternalWebZoomState).toEqual({ zoomLevel: 100 });

    const enlarged = ["zoom-in", "zoom-in"].reduce(
      (state) => konquerorExternalWebZoomReducer(state, { type: "zoom-in" }),
      defaultKonquerorExternalWebZoomState,
    );
    const reduced = ["zoom-out", "zoom-out"].reduce(
      (state) => konquerorExternalWebZoomReducer(state, { type: "zoom-out" }),
      defaultKonquerorExternalWebZoomState,
    );

    expect(enlarged.zoomLevel).toBe(125);
    expect(reduced.zoomLevel).toBe(75);
  });

  it("clamps at 75% and 150% without producing an invalid level", () => {
    const minimum = ["zoom-out", "zoom-out", "zoom-out"].reduce(
      (state) => konquerorExternalWebZoomReducer(state, { type: "zoom-out" }),
      defaultKonquerorExternalWebZoomState,
    );
    const maximum = ["zoom-in", "zoom-in", "zoom-in"].reduce(
      (state) => konquerorExternalWebZoomReducer(state, { type: "zoom-in" }),
      defaultKonquerorExternalWebZoomState,
    );

    expect(minimum.zoomLevel).toBe(75);
    expect(maximum.zoomLevel).toBe(150);
    expect(canAdjustKonquerorExternalWebZoom(minimum, "out")).toBe(false);
    expect(canAdjustKonquerorExternalWebZoom(maximum, "in")).toBe(false);
    expect(konquerorExternalWebZoomReducer(minimum, { type: "zoom-out" })).toBe(minimum);
  });

  it("uses inverse iframe dimensions so the scaled viewport still fills its fixed parent", () => {
    expect(getKonquerorExternalWebZoomGeometry(100)).toEqual({
      scale: 1,
      layoutWidthPercent: 100,
      layoutHeightPercent: 100,
    });
    expect(getKonquerorExternalWebZoomGeometry(125)).toEqual({
      scale: 1.25,
      layoutWidthPercent: 80,
      layoutHeightPercent: 80,
    });
    expect(getKonquerorExternalWebZoomGeometry(75)).toEqual({
      scale: 0.75,
      layoutWidthPercent: 133.333333,
      layoutHeightPercent: 133.333333,
    });
  });
});
