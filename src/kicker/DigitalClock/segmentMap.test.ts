import { describe, expect, it } from "vitest";
import { baseSegmentIds, digitSegments } from "./segmentMap";

describe("digitSegments", () => {
  it("defines complete segment mappings for 0 through 9", () => {
    const digits = Object.keys(digitSegments).map(Number).sort((a, b) => a - b);

    expect(digits).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("uses only known base segment ids", () => {
    const allowed = new Set(baseSegmentIds);

    Object.values(digitSegments).forEach((segments) => {
      expect(segments.length).toBeGreaterThan(0);
      segments.forEach((segment) => {
        expect(allowed.has(segment)).toBe(true);
      });
    });
  });
});
