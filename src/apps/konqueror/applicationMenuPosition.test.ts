import { describe, expect, it } from "vitest";
import { getKonquerorApplicationMenuPopupPosition } from "./applicationMenuPosition";

describe("Konqueror application-menu positioning", () => {
  it("anchors every menu to its own trigger instead of the left edge of the menubar", () => {
    const bounds = { x: 0, y: 0, width: 900, height: 686 };
    const popup = { width: 150, height: 188 };

    expect(getKonquerorApplicationMenuPopupPosition({ left: 86, bottom: 61 }, popup, bounds)).toEqual({ left: 86, top: 60 });
    expect(getKonquerorApplicationMenuPopupPosition({ left: 124, bottom: 61 }, popup, bounds)).toEqual({ left: 124, top: 60 });
    expect(getKonquerorApplicationMenuPopupPosition({ left: 164, bottom: 61 }, popup, bounds)).toEqual({ left: 164, top: 60 });
    expect(getKonquerorApplicationMenuPopupPosition({ left: 207, bottom: 61 }, popup, bounds)).toEqual({ left: 207, top: 60 });
    expect(getKonquerorApplicationMenuPopupPosition({ left: 242, bottom: 61 }, popup, bounds)).toEqual({ left: 242, top: 60 });
  });

  it("clamps to the full screen rather than the window work area", () => {
    expect(
      getKonquerorApplicationMenuPopupPosition({ left: 860, bottom: 610 }, { width: 150, height: 188 }, { x: 0, y: 0, width: 900, height: 686 }),
    ).toEqual({ left: 750, top: 498 });
    expect(
      getKonquerorApplicationMenuPopupPosition({ left: -20, bottom: -10 }, { width: 300, height: 188 }, { x: 0, y: 0, width: 180, height: 120 }),
    ).toEqual({ left: 0, top: 0 });
  });
});
