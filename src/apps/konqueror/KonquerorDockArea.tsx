import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  KONQUEROR_DOCK_DRAG_THRESHOLD,
  getKonquerorDockBands,
  resolveKonquerorDockPreview,
  type KonquerorDockBand,
  type KonquerorDockOrder,
} from "./konquerorDockLayout";

type KonquerorDockAreaProps = {
  readonly dockOrder: KonquerorDockOrder;
  readonly onDockOrderChange: (order: KonquerorDockOrder) => void;
  readonly showToolbar?: boolean;
  readonly showLocationBar?: boolean;
  readonly renderToolbar: (grip: ReactNode) => ReactNode;
  readonly renderLocationBar: (grip: ReactNode) => ReactNode;
};

type DockDragSession = {
  readonly pointerId: number;
  readonly sourceBand: KonquerorDockBand;
  readonly startClientY: number;
  readonly captureElement: HTMLElement;
  hasCrossedThreshold: boolean;
  previewOrder: KonquerorDockOrder;
};

const isPrimaryPointer = (event: PointerEvent<HTMLElement>): boolean => event.isPrimary && event.button === 0;

const containsPoint = (element: HTMLElement, clientX: number, clientY: number): boolean => {
  const bounds = element.getBoundingClientRect();

  return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
};

export function KonquerorDockArea({
  dockOrder,
  onDockOrderChange,
  renderLocationBar,
  renderToolbar,
  showLocationBar = true,
  showToolbar = true,
}: KonquerorDockAreaProps) {
  const dockAreaRef = useRef<HTMLDivElement | null>(null);
  const firstSlotRef = useRef<HTMLDivElement | null>(null);
  const secondSlotRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DockDragSession | null>(null);
  const [previewOrder, setPreviewOrder] = useState<KonquerorDockOrder | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clearDragSession = useCallback(() => {
    const dragSession = dragSessionRef.current;

    dragSessionRef.current = null;
    if (dragSession?.captureElement.hasPointerCapture(dragSession.pointerId)) {
      dragSession.captureElement.releasePointerCapture(dragSession.pointerId);
    }

    setIsDragging(false);
    setPreviewOrder(null);
  }, []);

  useEffect(() => clearDragSession, [clearDragSession]);

  const handleGripPointerDown = (sourceBand: KonquerorDockBand, event: PointerEvent<HTMLElement>) => {
    if (!isPrimaryPointer(event) || dragSessionRef.current) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSessionRef.current = {
      pointerId: event.pointerId,
      sourceBand,
      startClientY: event.clientY,
      captureElement: event.currentTarget,
      hasCrossedThreshold: false,
      previewOrder: dockOrder,
    };
  };

  const handleGripPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    if (!dragSession.hasCrossedThreshold) {
      if (Math.abs(event.clientY - dragSession.startClientY) < KONQUEROR_DOCK_DRAG_THRESHOLD) {
        return;
      }

      dragSession.hasCrossedThreshold = true;
      setIsDragging(true);
    }

    const firstSlot = firstSlotRef.current;
    const secondSlot = secondSlotRef.current;
    const dockArea = dockAreaRef.current;

    if (!firstSlot || !secondSlot || !dockArea) {
      return;
    }

    event.preventDefault();
    if (!containsPoint(dockArea, event.clientX, event.clientY)) {
      dragSession.previewOrder = dockOrder;
      setPreviewOrder(null);
      return;
    }

    const nextPreviewOrder = resolveKonquerorDockPreview(
      dockOrder,
      dragSession.sourceBand,
      event.clientY,
      firstSlot.getBoundingClientRect(),
      secondSlot.getBoundingClientRect(),
    );
    dragSession.previewOrder = nextPreviewOrder;
    setPreviewOrder(nextPreviewOrder === dockOrder ? null : nextPreviewOrder);
  };

  const finishGripPointer = (event: PointerEvent<HTMLElement>) => {
    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    const isValidDrop = dragSession.hasCrossedThreshold && dockAreaRef.current !== null &&
      containsPoint(dockAreaRef.current, event.clientX, event.clientY);

    if (isValidDrop && dragSession.previewOrder !== dockOrder) {
      onDockOrderChange(dragSession.previewOrder);
    }

    clearDragSession();
  };

  const cancelGripPointer = (event: PointerEvent<HTMLElement>) => {
    if (dragSessionRef.current?.pointerId === event.pointerId) {
      clearDragSession();
    }
  };

  const visibleOrder = previewOrder ?? dockOrder;
  const bands = getKonquerorDockBands(visibleOrder).filter((band) =>
    band === "toolbar" ? showToolbar : showLocationBar,
  );
  const canReorderBands = bands.length === 2;
  const renderGrip = (band: KonquerorDockBand) => (
    <span
      className="toolbar-grip konqueror-dock-grip"
      data-konqueror-dock-grip={band}
      aria-hidden="true"
      onPointerDown={(event) => handleGripPointerDown(band, event)}
      onPointerMove={handleGripPointerMove}
      onPointerUp={finishGripPointer}
      onPointerCancel={cancelGripPointer}
      onLostPointerCapture={cancelGripPointer}
    />
  );

  return (
    <div
      ref={dockAreaRef}
      className="konqueror-dock-area"
      data-dock-order={visibleOrder}
      data-dock-dragging={isDragging ? "true" : "false"}
    >
      {bands.map((band, index) => (
        <div
          key={band}
          ref={index === 0 ? firstSlotRef : secondSlotRef}
          className="konqueror-dock-slot"
          data-konqueror-dock-slot={index + 1}
        >
          {band === "toolbar"
            ? renderToolbar(canReorderBands ? renderGrip(band) : undefined)
            : renderLocationBar(canReorderBands ? renderGrip(band) : undefined)}
        </div>
      ))}
    </div>
  );
}
