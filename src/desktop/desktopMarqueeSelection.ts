import { toLogicalCoordinate, toLogicalPoint, toLogicalRect } from "./desktopUiScale";

export type DesktopMarqueePoint = {
  readonly x: number;
  readonly y: number;
};

export type DesktopMarqueeRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

export function getNormalizedDesktopMarqueeRect(
  start: DesktopMarqueePoint,
  end: DesktopMarqueePoint,
): DesktopMarqueeRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function hasPositiveDesktopMarqueeIntersection(
  marqueeRect: DesktopMarqueeRect,
  itemRect: DesktopMarqueeRect,
): boolean {
  const intersectionWidth = Math.min(marqueeRect.right, itemRect.right) - Math.max(marqueeRect.left, itemRect.left);
  const intersectionHeight = Math.min(marqueeRect.bottom, itemRect.bottom) - Math.max(marqueeRect.top, itemRect.top);

  return intersectionWidth > 0 && intersectionHeight > 0;
}

export function getDesktopMarqueeHitIconIds(
  visibleIconIds: readonly string[],
  marqueeRect: DesktopMarqueeRect,
  itemRectsByIconId: ReadonlyMap<string, DesktopMarqueeRect>,
): readonly string[] {
  return visibleIconIds.filter((iconId) => {
    const itemRect = itemRectsByIconId.get(iconId);
    return itemRect !== undefined && hasPositiveDesktopMarqueeIntersection(marqueeRect, itemRect);
  });
}

export function getDesktopLogicalPoint(
  clientPoint: DesktopMarqueePoint,
  desktopRect: Pick<DOMRect, "left" | "top">,
): DesktopMarqueePoint {
  const logicalClientPoint = toLogicalPoint(clientPoint);
  return {
    x: logicalClientPoint.x - toLogicalCoordinate(desktopRect.left),
    y: logicalClientPoint.y - toLogicalCoordinate(desktopRect.top),
  };
}

export function getDesktopLogicalItemRect(
  itemRect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">,
  desktopRect: Pick<DOMRect, "left" | "top">,
): DesktopMarqueeRect {
  const logicalItemRect = toLogicalRect(itemRect);
  const logicalDesktopLeft = toLogicalCoordinate(desktopRect.left);
  const logicalDesktopTop = toLogicalCoordinate(desktopRect.top);
  return getNormalizedDesktopMarqueeRect(
    {
      x: logicalItemRect.left - logicalDesktopLeft,
      y: logicalItemRect.top - logicalDesktopTop,
    },
    {
      x: logicalItemRect.right - logicalDesktopLeft,
      y: logicalItemRect.bottom - logicalDesktopTop,
    },
  );
}
