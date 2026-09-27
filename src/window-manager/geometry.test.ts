import { describe, expect, it } from "vitest";
import {
  clampNormalWindowDragBounds,
  clampWindowBounds,
  getMaximizedBounds,
  getWindowFrameEdges,
  MIN_VISIBLE_TITLEBAR_WIDTH,
  moveWindowBounds,
  resizeNormalWindowBounds,
} from "./geometry";
import type { ResizeDirection, ScreenArea, WindowBounds, WorkArea } from "./types";

const workArea: WorkArea = {
  x: 0,
  y: 0,
  width: 800,
  height: 554,
  titleBarHeight: 22,
};
const screenArea: ScreenArea = { x: 0, y: 0, width: 800, height: 600 };

const makeBounds = (bounds: Partial<WindowBounds> = {}): WindowBounds => ({
  x: 100,
  y: 80,
  width: 320,
  height: 240,
  ...bounds,
});

const resize = (
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  bounds: WindowBounds = makeBounds(),
  screen: ScreenArea = screenArea,
): WindowBounds =>
  resizeNormalWindowBounds({
    initialBounds: bounds,
    direction,
    deltaX,
    deltaY,
    minimumWidth: 200,
    minimumHeight: 160,
    screenArea: screen,
  });

describe("getMaximizedBounds", () => {
  it("uses the work area origin and dimensions", () => {
    expect(getMaximizedBounds({ x: 10, y: 8, width: 780, height: 520, titleBarHeight: 22 })).toEqual({
      x: 10,
      y: 8,
      width: 780,
      height: 520,
    });
  });

  it("does not return negative dimensions for tiny work areas", () => {
    expect(getMaximizedBounds({ x: 0, y: 0, width: -1, height: -20, titleBarHeight: 22 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("getWindowFrameEdges", () => {
  it.each([1366, 1920, 1280, 1440, 1536, 2560])(
    "keeps a maximized outer frame on both WorkArea edges at %dpx viewport width",
    (cssViewportWidth) => {
      const workArea: WorkArea = {
        x: 0,
        y: 0,
        width: cssViewportWidth / 1.4,
        height: 768 / 1.4 - 46,
        titleBarHeight: 22,
      };

      expect(getWindowFrameEdges(getMaximizedBounds(workArea), workArea)).toEqual({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      });
    },
  );

  it("preserves a fractional right edge for a contained normal window", () => {
    const workArea: WorkArea = {
      x: 0,
      y: 0,
      width: 1920 / 1.4,
      height: 1080 / 1.4 - 46,
      titleBarHeight: 22,
    };
    const bounds: WindowBounds = {
      x: workArea.width - 304,
      y: workArea.height - 218,
      width: 304,
      height: 218,
    };

    expect(getWindowFrameEdges(bounds, workArea)).toMatchObject({ left: workArea.width - 304, top: workArea.height - 218, right: 0, bottom: 0 });
  });

  it("keeps the edge sum equal to the containing WorkArea without quantizing logical values", () => {
    const workArea: WorkArea = { x: 0, y: 0, width: 975.7142857142857, height: 502.57142857142856, titleBarHeight: 22 };
    const bounds: WindowBounds = { x: 12.35, y: 23.6, width: 390.25, height: 230.75 };
    const edges = getWindowFrameEdges(bounds, workArea);

    expect(edges.left + bounds.width + edges.right).toBe(workArea.width);
    expect(edges.top + bounds.height + edges.bottom).toBe(workArea.height);
    expect(edges.left).toBe(bounds.x);
    expect(edges.top).toBe(bounds.y);
  });
});

describe("clampWindowBounds", () => {
  it("does not change a window that is inside the work area", () => {
    const bounds = makeBounds();

    expect(clampWindowBounds(bounds, workArea)).toEqual(bounds);
  });

  it("clamps x to the left boundary", () => {
    expect(clampWindowBounds(makeBounds({ x: -30 }), workArea).x).toBe(0);
  });

  it("clamps y to the top boundary", () => {
    expect(clampWindowBounds(makeBounds({ y: -12 }), workArea).y).toBe(0);
  });

  it("moves a window back when its right edge leaves the work area", () => {
    expect(clampWindowBounds(makeBounds({ x: 600 }), workArea).x).toBe(480);
  });

  it("moves a window back when its bottom enters the Kicker area", () => {
    expect(clampWindowBounds(makeBounds({ y: 430 }), workArea).y).toBe(314);
  });

  it("keeps the title bar visible when the work area is smaller than the window", () => {
    const smallWorkArea: WorkArea = {
      x: 0,
      y: 0,
      width: 260,
      height: 120,
      titleBarHeight: 22,
    };

    const clamped = clampWindowBounds(makeBounds({ x: 500, y: 500, width: 640, height: 360 }), smallWorkArea);

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(98);
    expect(clamped.y + smallWorkArea.titleBarHeight).toBeLessThanOrEqual(smallWorkArea.height);
  });
});

describe("clampNormalWindowDragBounds", () => {
  it("keeps an in-bounds normal window unchanged", () => {
    expect(clampNormalWindowDragBounds(makeBounds(), screenArea, workArea)).toEqual(makeBounds());
  });

  it("allows left and right partial off-screen positions while preserving the titlebar recovery strip", () => {
    const left = clampNormalWindowDragBounds(makeBounds({ x: -900 }), screenArea, workArea);
    const right = clampNormalWindowDragBounds(makeBounds({ x: 900 }), screenArea, workArea);

    expect(left.x).toBe(-256);
    expect(right.x).toBe(736);
    expect(left.x + left.width).toBe(MIN_VISIBLE_TITLEBAR_WIDTH);
    expect(right.x).toBe(screenArea.width - MIN_VISIBLE_TITLEBAR_WIDTH);
  });

  it("allows the body to extend below the screen while keeping the titlebar above Kicker", () => {
    const moved = clampNormalWindowDragBounds(makeBounds({ y: 900 }), screenArea, workArea);

    expect(moved.y).toBe(workArea.height - workArea.titleBarHeight);
    expect(moved.y + moved.height).toBeGreaterThan(screenArea.height);
    expect(moved.y + workArea.titleBarHeight).toBe(workArea.height);
  });

  it("blocks top off-screen movement", () => {
    expect(clampNormalWindowDragBounds(makeBounds({ y: -40 }), screenArea, workArea).y).toBe(0);
  });

  it("uses the actual narrow titlebar width instead of an impossible recovery strip", () => {
    const narrow = clampNormalWindowDragBounds(makeBounds({ x: -40, width: 40 }), screenArea, workArea);

    expect(narrow.x).toBe(0);
  });

  it("keeps a wide window recoverable after viewport shrink without forcing it fully into the work area", () => {
    const shrunkScreen: ScreenArea = { x: 0, y: 0, width: 400, height: 360 };
    const shrunkWorkArea: WorkArea = { ...workArea, width: 400, height: 314 };
    const moved = clampNormalWindowDragBounds(makeBounds({ x: 1200, y: 900, width: 960, height: 500 }), shrunkScreen, shrunkWorkArea);

    expect(moved.x).toBe(336);
    expect(moved.y).toBe(292);
    expect(moved.x).toBeGreaterThan(shrunkWorkArea.width - moved.width);
    expect(Number.isFinite(moved.x)).toBe(true);
    expect(Number.isFinite(moved.y)).toBe(true);
  });
});

describe("resizeNormalWindowBounds", () => {
  it("east increases width without changing x", () => {
    expect(resize("e", 50, 0)).toEqual({ x: 100, y: 80, width: 370, height: 240 });
  });

  it("allows east resize beyond the screen while keeping the left edge anchored", () => {
    const resized = resize("e", 500, 0);

    expect(resized).toEqual({ x: 100, y: 80, width: 820, height: 240 });
    expect(resized.x).toBe(100);
    expect(resized.x + resized.width).toBeGreaterThan(screenArea.width);
  });

  it("east cannot shrink below minimumWidth", () => {
    expect(resize("e", -500, 0)).toEqual({ x: 100, y: 80, width: 200, height: 240 });
  });

  it("west changes x and width while anchoring the initial right edge", () => {
    const resized = resize("w", -30, 0);

    expect(resized).toEqual({ x: 70, y: 80, width: 350, height: 240 });
    expect(resized.x + resized.width).toBe(420);
  });

  it("allows west resize into a recoverable partial off-screen position", () => {
    const resized = resize("w", -1_000, 0);

    expect(resized).toEqual({ x: -900, y: 80, width: 1_320, height: 240 });
    expect(resized.x + resized.width).toBe(420);
    expect(resized.x + resized.width).toBeGreaterThanOrEqual(MIN_VISIBLE_TITLEBAR_WIDTH);
  });

  it("west stops at minimumWidth", () => {
    expect(resize("w", 500, 0)).toEqual({ x: 220, y: 80, width: 200, height: 240 });
  });

  it("south increases height without changing y", () => {
    expect(resize("s", 0, 50)).toEqual({ x: 100, y: 80, width: 320, height: 290 });
  });

  it("allows south resize behind Kicker and beyond the screen while keeping the top edge anchored", () => {
    const resized = resize("s", 0, 600);

    expect(resized).toEqual({ x: 100, y: 80, width: 320, height: 840 });
    expect(resized.y).toBe(80);
    expect(resized.y + resized.height).toBeGreaterThan(screenArea.height);
  });

  it("south cannot shrink below minimumHeight", () => {
    expect(resize("s", 0, -500)).toEqual({ x: 100, y: 80, width: 320, height: 160 });
  });

  it("north changes y and height while anchoring the initial bottom edge", () => {
    const resized = resize("n", 0, -20);

    expect(resized).toEqual({ x: 100, y: 60, width: 320, height: 260 });
    expect(resized.y + resized.height).toBe(320);
  });

  it("north cannot cross the screen top boundary", () => {
    expect(resize("n", 0, -200)).toEqual({ x: 100, y: 0, width: 320, height: 320 });
  });

  it("north stops at minimumHeight", () => {
    expect(resize("n", 0, 500)).toEqual({ x: 100, y: 160, width: 320, height: 160 });
  });

  it("north-east applies north and east together", () => {
    expect(resize("ne", 50, -20)).toEqual({ x: 100, y: 60, width: 370, height: 260 });
  });

  it("south-east applies south and east together", () => {
    expect(resize("se", 900, 900)).toEqual({ x: 100, y: 80, width: 1_220, height: 1_140 });
  });

  it("south-west applies south and west together", () => {
    expect(resize("sw", -30, 50)).toEqual({ x: 70, y: 80, width: 350, height: 290 });
  });

  it("north-west applies north and west together", () => {
    expect(resize("nw", -30, -20)).toEqual({ x: 70, y: 60, width: 350, height: 260 });
  });

  it("does not produce negative dimensions for large negative deltas", () => {
    const resized = resize("se", -10_000, -10_000);

    expect(resized.width).toBeGreaterThan(0);
    expect(resized.height).toBeGreaterThan(0);
  });

  it("keeps the recovery strip when an east resize shrinks an already partial-left window", () => {
    const resized = resize("e", -900, 0, makeBounds({ x: -256, width: 320 }));

    expect(resized).toEqual({ x: -256, y: 80, width: 320, height: 240 });
    expect(resized.x + resized.width).toBe(MIN_VISIBLE_TITLEBAR_WIDTH);
  });

  it("allows oversized bounds that remain movable under the normal drag recovery policy", () => {
    const resized = resize("se", 1_500, 1_100);
    const moved = moveWindowBounds(resized, 1_500, 900, screenArea, workArea);

    expect(resized.width).toBeGreaterThan(screenArea.width);
    expect(resized.height).toBeGreaterThan(screenArea.height);
    expect(moved.x).toBe(screenArea.width - MIN_VISIBLE_TITLEBAR_WIDTH);
    expect(moved.y).toBe(workArea.height - workArea.titleBarHeight);
  });

  it("does not produce invalid geometry for non-finite pointer deltas", () => {
    const resized = resizeNormalWindowBounds({
      initialBounds: makeBounds(),
      direction: "se",
      deltaX: Number.NaN,
      deltaY: Number.POSITIVE_INFINITY,
      minimumWidth: 200,
      minimumHeight: 160,
      screenArea,
    });

    expect(Number.isNaN(resized.x)).toBe(false);
    expect(Number.isNaN(resized.y)).toBe(false);
    expect(Number.isNaN(resized.width)).toBe(false);
    expect(Number.isNaN(resized.height)).toBe(false);
    expect(Number.isFinite(resized.width)).toBe(true);
    expect(Number.isFinite(resized.height)).toBe(true);
    expect(resized.width).toBe(320);
    expect(resized.height).toBe(240);
  });

  it("returns integer pixel bounds", () => {
    expect(resize("se", 10.4, 8.6)).toEqual({ x: 100, y: 80, width: 330, height: 249 });
  });
});
