import { describe, expect, it } from "vitest";
import {
  getKonquerorMarqueeHitNodeIds,
  getNormalizedKonquerorMarqueeRect,
  hasPositiveKonquerorMarqueeIntersection,
} from "./marqueeSelection";

describe("Konqueror marquee geometry", () => {
  it("normalizes every drag direction and preserves zero-sized rectangles", () => {
    expect(getNormalizedKonquerorMarqueeRect({ x: 2, y: 3 }, { x: 8, y: 10 })).toMatchObject({ left: 2, top: 3, right: 8, bottom: 10, width: 6, height: 7 });
    expect(getNormalizedKonquerorMarqueeRect({ x: 8, y: 10 }, { x: 2, y: 3 })).toMatchObject({ left: 2, top: 3, right: 8, bottom: 10 });
    expect(getNormalizedKonquerorMarqueeRect({ x: 8, y: 3 }, { x: 2, y: 10 })).toMatchObject({ left: 2, top: 3, right: 8, bottom: 10 });
    expect(getNormalizedKonquerorMarqueeRect({ x: 2, y: 10 }, { x: 8, y: 3 })).toMatchObject({ left: 2, top: 3, right: 8, bottom: 10 });
    expect(getNormalizedKonquerorMarqueeRect({ x: 2, y: 3 }, { x: 2, y: 9 }).width).toBe(0);
    expect(getNormalizedKonquerorMarqueeRect({ x: 2, y: 3 }, { x: 9, y: 3 }).height).toBe(0);
  });

  it("uses positive-area intersection only", () => {
    const marquee = getNormalizedKonquerorMarqueeRect({ x: 10, y: 10 }, { x: 30, y: 30 });

    expect(hasPositiveKonquerorMarqueeIntersection(marquee, getNormalizedKonquerorMarqueeRect({ x: 12, y: 12 }, { x: 18, y: 18 }))).toBe(true);
    expect(hasPositiveKonquerorMarqueeIntersection(marquee, getNormalizedKonquerorMarqueeRect({ x: 5, y: 5 }, { x: 35, y: 35 }))).toBe(true);
    expect(hasPositiveKonquerorMarqueeIntersection(marquee, getNormalizedKonquerorMarqueeRect({ x: 30, y: 12 }, { x: 36, y: 18 }))).toBe(false);
    expect(hasPositiveKonquerorMarqueeIntersection(marquee, getNormalizedKonquerorMarqueeRect({ x: 12, y: 30 }, { x: 18, y: 36 }))).toBe(false);
  });

  it("returns hits in the supplied visible order rather than geometry enumeration order", () => {
    const rect = getNormalizedKonquerorMarqueeRect({ x: 0, y: 0 }, { x: 100, y: 100 });
    const itemRectsByNodeId = new Map([
      ["a", getNormalizedKonquerorMarqueeRect({ x: 10, y: 10 }, { x: 20, y: 20 })],
      ["c", getNormalizedKonquerorMarqueeRect({ x: 30, y: 10 }, { x: 40, y: 20 })],
      ["b", getNormalizedKonquerorMarqueeRect({ x: 50, y: 10 }, { x: 60, y: 20 })],
    ]);

    expect(getKonquerorMarqueeHitNodeIds(["d", "a", "c", "b"], rect, itemRectsByNodeId)).toEqual(["a", "c", "b"]);
  });
});
