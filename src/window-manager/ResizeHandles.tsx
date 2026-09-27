import type { PointerEvent } from "react";
import type { ResizeDirection } from "./types";

const resizeDirections = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const satisfies readonly ResizeDirection[];

type ResizeHandlesProps = {
  onResizePointerDown: (direction: ResizeDirection, event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
};

export function ResizeHandles({
  onResizePointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: ResizeHandlesProps) {
  return (
    <div
      className="resize-handles"
      aria-hidden="true"
      onPointerMove={onResizePointerMove}
      onPointerUp={onResizePointerUp}
      onPointerCancel={onResizePointerCancel}
      onLostPointerCapture={onResizePointerCancel}
    >
      {resizeDirections.map((direction) => (
        <div
          key={direction}
          className={`resize-handle resize-handle--${direction}`}
          data-resize-direction={direction}
          onPointerDown={(event) => onResizePointerDown(direction, event)}
        />
      ))}
    </div>
  );
}
