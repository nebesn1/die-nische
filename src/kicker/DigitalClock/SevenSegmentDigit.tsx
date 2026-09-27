import { type BaseSegmentId, type DigitValue, isLitSegment } from "./segmentMap";

type SegmentShape = {
  id: BaseSegmentId;
  points: string;
};

const segmentShapes: readonly SegmentShape[] = [
  { id: "a", points: "5,2 21,2 24,5 21,8 5,8 2,5" },
  { id: "b", points: "22,7 25,10 25,22 22,25 19,22 19,10" },
  { id: "c", points: "22,27 25,30 25,42 22,45 19,42 19,30" },
  { id: "d", points: "5,44 21,44 24,47 21,50 5,50 2,47" },
  { id: "e", points: "4,27 7,30 7,42 4,45 1,42 1,30" },
  { id: "f", points: "4,7 7,10 7,22 4,25 1,22 1,10" },
  { id: "g", points: "5,23 21,23 24,26 21,29 5,29 2,26" },
];

type SevenSegmentDigitProps = {
  value: DigitValue;
  showDot?: boolean;
  x: number;
};

export function SevenSegmentDigit({ value, showDot = false, x }: SevenSegmentDigitProps) {
  return (
    <g transform={`translate(${x} 0)`}>
      {segmentShapes.map((segment) => (
        <polygon
          key={segment.id}
          data-segment={segment.id}
          points={segment.points}
          fill={isLitSegment(value, segment.id) ? "var(--kde-clock-lit)" : "var(--kde-clock-dim)"}
        />
      ))}
      <circle
        cx="29"
        cy="47"
        r="3"
        fill={showDot ? "var(--kde-clock-lit)" : "var(--kde-clock-dim)"}
        data-segment="dot"
      />
    </g>
  );
}
