export const segmentIds = ["a", "b", "c", "d", "e", "f", "g", "dot"] as const;

export type SegmentId = (typeof segmentIds)[number];
export type BaseSegmentId = Exclude<SegmentId, "dot">;

export const baseSegmentIds = ["a", "b", "c", "d", "e", "f", "g"] as const satisfies readonly BaseSegmentId[];

export const digitSegments = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "d", "e", "g"],
  3: ["a", "b", "c", "d", "g"],
  4: ["b", "c", "f", "g"],
  5: ["a", "c", "d", "f", "g"],
  6: ["a", "c", "d", "e", "f", "g"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
} as const satisfies Record<number, readonly BaseSegmentId[]>;

export type DigitValue = keyof typeof digitSegments;

export const isLitSegment = (digit: DigitValue, segment: SegmentId): boolean => {
  if (segment === "dot") {
    return false;
  }

  const litSegments: readonly BaseSegmentId[] = digitSegments[digit];
  return litSegments.includes(segment);
};
