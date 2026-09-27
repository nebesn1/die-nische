import { describe, expect, it } from "vitest";
import {
  MOBILE_LAYOUT_MAX_LOGICAL_WIDTH,
  areResponsiveLayoutsEqual,
  deriveResponsiveLayout,
} from "./responsiveLayout";

describe("responsive layout model", () => {
  it("classifies the requested phone, tablet, and desktop viewport matrix in logical pixels", () => {
    const cases = [
      [320, 568, "mobile", "portrait"],
      [360, 800, "mobile", "portrait"],
      [390, 844, "mobile", "portrait"],
      [412, 915, "mobile", "portrait"],
      [430, 932, "mobile", "portrait"],
      [568, 320, "mobile", "landscape"],
      [800, 360, "desktop", "landscape"],
      [844, 390, "desktop", "landscape"],
      [768, 1024, "desktop", "portrait"],
      [820, 1180, "desktop", "portrait"],
      [1024, 768, "desktop", "landscape"],
      [1366, 768, "desktop", "landscape"],
      [1920, 1080, "desktop", "landscape"],
    ] as const;

    for (const [width, height, expectedMode, expectedOrientation] of cases) {
      const layout = deriveResponsiveLayout({
        cssViewportWidth: width,
        cssViewportHeight: height,
        uiScale: 1.4,
        panelHeight: 46,
      });

      expect(layout.layoutMode, `${width}x${height} mode`).toBe(expectedMode);
      expect(layout.orientation, `${width}x${height} orientation`).toBe(expectedOrientation);
      expect(layout.logicalViewportWidth).toBeCloseTo(width / 1.4);
      expect(layout.logicalViewportHeight).toBeCloseTo(height / 1.4);
      expect(layout.logicalWorkAreaHeight).toBeCloseTo(Math.max(0, height / 1.4 - 46));
    }
  });

  it("uses an inclusive logical-width mobile boundary and geometry-based orientation", () => {
    const atBoundary = deriveResponsiveLayout({
      cssViewportWidth: MOBILE_LAYOUT_MAX_LOGICAL_WIDTH,
      cssViewportHeight: 600,
      uiScale: 1,
      panelHeight: 46,
    });
    const justOver = deriveResponsiveLayout({
      cssViewportWidth: MOBILE_LAYOUT_MAX_LOGICAL_WIDTH + 1,
      cssViewportHeight: 600,
      uiScale: 1,
      panelHeight: 46,
    });
    const square = deriveResponsiveLayout({
      cssViewportWidth: 600,
      cssViewportHeight: 600,
      uiScale: 1,
      panelHeight: 46,
    });

    expect(atBoundary.layoutMode).toBe("mobile");
    expect(justOver.layoutMode).toBe("desktop");
    expect(square.orientation).toBe("portrait");
  });

  it("uses only the internal KDE scale for logical width across supported scale values", () => {
    const cssWidth = 1024;

    expect(deriveResponsiveLayout({ cssViewportWidth: cssWidth, cssViewportHeight: 768, uiScale: 1, panelHeight: 46 }).logicalViewportWidth)
      .toBe(1024);
    expect(deriveResponsiveLayout({ cssViewportWidth: cssWidth, cssViewportHeight: 768, uiScale: 1.4, panelHeight: 46 }).logicalViewportWidth)
      .toBeCloseTo(1024 / 1.4);
    expect(deriveResponsiveLayout({ cssViewportWidth: cssWidth, cssViewportHeight: 768, uiScale: 2, panelHeight: 46 }).logicalViewportWidth)
      .toBe(512);
  });

  it("converts CSS safe-area values into the same logical space without applying them to work-area geometry", () => {
    const layout = deriveResponsiveLayout({
      cssViewportWidth: 390,
      cssViewportHeight: 844,
      uiScale: 1.4,
      panelHeight: 46,
      titleBarHeight: 22,
      safeAreaInsetsCss: { top: 28, right: 14, bottom: 42, left: 7 },
    });

    expect(layout.safeAreaInsets.top).toBeCloseTo(20);
    expect(layout.safeAreaInsets.right).toBeCloseTo(10);
    expect(layout.safeAreaInsets.bottom).toBeCloseTo(30);
    expect(layout.safeAreaInsets.left).toBeCloseTo(5);
    expect(layout.logicalWorkAreaWidth).toBe(layout.logicalViewportWidth);
    expect(layout.logicalWorkAreaHeight).toBe(layout.logicalViewportHeight - 46);
    expect(layout.titleBarHeight).toBe(22);
  });

  it("normalizes invalid numeric inputs to deterministic safe geometry", () => {
    const layout = deriveResponsiveLayout({
      cssViewportWidth: Number.NaN,
      cssViewportHeight: -20,
      uiScale: 0,
      panelHeight: Number.POSITIVE_INFINITY,
    });

    expect(layout.uiScale).toBe(1);
    expect(layout.logicalViewportWidth).toBe(0);
    expect(layout.logicalViewportHeight).toBe(0);
    expect(layout.logicalWorkAreaHeight).toBe(0);
    expect(layout.orientation).toBe("portrait");
  });

  it("compares complete snapshots so unchanged resize notifications preserve state identity", () => {
    const input = {
      cssViewportWidth: 390,
      cssViewportHeight: 844,
      uiScale: 1.4,
      panelHeight: 46,
      titleBarHeight: 22,
    } as const;
    const first = deriveResponsiveLayout(input);
    const second = deriveResponsiveLayout(input);

    expect(areResponsiveLayoutsEqual(first, second)).toBe(true);
    expect(areResponsiveLayoutsEqual(first, { ...second, orientation: "landscape" })).toBe(false);
    expect(areResponsiveLayoutsEqual(first, {
      ...second,
      safeAreaInsets: { ...second.safeAreaInsets, bottom: 1 },
    })).toBe(false);
  });
});
