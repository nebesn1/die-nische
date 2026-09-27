import type { VfsNodeId } from "../../vfs/types";
import { normalizeKonquerorSelection, type KonquerorSelectedNodeIds } from "./selectionModel";

export type KonquerorMarqueeSelectionMode = "replace" | "add";

export type KonquerorMarqueePoint = {
  readonly x: number;
  readonly y: number;
};

export type KonquerorMarqueeRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

export function getNormalizedKonquerorMarqueeRect(
  start: KonquerorMarqueePoint,
  end: KonquerorMarqueePoint,
): KonquerorMarqueeRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function hasPositiveKonquerorMarqueeIntersection(
  marqueeRect: KonquerorMarqueeRect,
  itemRect: KonquerorMarqueeRect,
): boolean {
  const intersectionWidth = Math.min(marqueeRect.right, itemRect.right) - Math.max(marqueeRect.left, itemRect.left);
  const intersectionHeight = Math.min(marqueeRect.bottom, itemRect.bottom) - Math.max(marqueeRect.top, itemRect.top);

  return intersectionWidth > 0 && intersectionHeight > 0;
}

export function getKonquerorMarqueeHitNodeIds(
  visibleNodeIds: readonly VfsNodeId[],
  marqueeRect: KonquerorMarqueeRect,
  itemRectsByNodeId: ReadonlyMap<VfsNodeId, KonquerorMarqueeRect>,
): KonquerorSelectedNodeIds {
  return normalizeKonquerorSelection(
    visibleNodeIds.filter((nodeId) => {
      const itemRect = itemRectsByNodeId.get(nodeId);
      return itemRect !== undefined && hasPositiveKonquerorMarqueeIntersection(marqueeRect, itemRect);
    }),
  );
}
