import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

const getRule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing ${selector} CSS rule`);
  return match[1];
};

const resolveSafeAxis = (viewportSize: number, imageSize: number) => ({
  offset: imageSize <= viewportSize ? (viewportSize - imageSize) / 2 : 0,
  scrollExtent: Math.max(viewportSize, imageSize),
});

describe("Konqueror image viewer safe centering", () => {
  it("centers a fitting axis and starts an overflowing axis at scroll origin", () => {
    const viewport = { width: 1000, height: 1000 };
    const image = { width: 800, height: 1400 };

    expect(resolveSafeAxis(viewport.width, image.width)).toEqual({ offset: 100, scrollExtent: 1000 });
    expect(resolveSafeAxis(viewport.height, image.height)).toEqual({ offset: 0, scrollExtent: 1400 });
    expect(resolveSafeAxis(viewport.width, 1000)).toEqual({ offset: 0, scrollExtent: 1000 });
  });

  it("re-evaluates the two axes safely when a small viewer is resized", () => {
    expect(resolveSafeAxis(1000, 800).offset).toBe(100);
    expect(resolveSafeAxis(600, 800)).toEqual({ offset: 0, scrollExtent: 800 });
    expect(resolveSafeAxis(1000, 800)).toEqual({ offset: 100, scrollExtent: 1000 });
  });

  it("implements the safe per-axis policy with flex-start and auto margins", () => {
    const viewport = getRule(".konqueror-image-view");
    const image = getRule(".konqueror-image-view__image");

    expect(viewport).toContain("display: flex");
    expect(viewport).toContain("align-items: flex-start");
    expect(viewport).toContain("justify-content: flex-start");
    expect(viewport).toContain("overflow: auto");
    expect(viewport).not.toContain("align-items: center");
    expect(viewport).not.toContain("justify-content: center");
    expect(image).toContain("flex: 0 0 auto");
    expect(image).toContain("margin: auto");
  });

  it("keeps fit and manual zoom rules intact while the shared item remains scrollable", () => {
    const fitWidth = getRule(".konqueror-image-view--fit-width");
    const fitHeight = getRule(".konqueror-image-view--fit-height .konqueror-image-view__image");
    const manualZoom = getRule(".konqueror-image-view--50 .konqueror-image-view__image,\n.konqueror-image-view--100 .konqueror-image-view__image,\n.konqueror-image-view--200 .konqueror-image-view__image");

    expect(fitWidth).toContain("align-items: flex-start");
    expect(fitHeight).toContain("height: calc(100vh - 220px)");
    expect(manualZoom).toContain("max-width: none");
    expect(manualZoom).toContain("max-height: none");
  });
});
