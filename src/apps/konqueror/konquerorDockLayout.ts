export type KonquerorDockBand = "toolbar" | "location";

export type KonquerorDockOrder = "toolbar-location" | "location-toolbar";

export type KonquerorDockSlotBounds = {
  readonly top: number;
  readonly bottom: number;
};

export const KONQUEROR_DOCK_DRAG_THRESHOLD = 4;

export const defaultKonquerorDockOrder: KonquerorDockOrder = "toolbar-location";

export function getKonquerorDockBands(order: KonquerorDockOrder): readonly [KonquerorDockBand, KonquerorDockBand] {
  return order === "toolbar-location" ? ["toolbar", "location"] : ["location", "toolbar"];
}

export function swapKonquerorDockOrder(order: KonquerorDockOrder): KonquerorDockOrder {
  return order === "toolbar-location" ? "location-toolbar" : "toolbar-location";
}

export function getKonquerorDockSlotForClientY(
  clientY: number,
  firstSlot: KonquerorDockSlotBounds,
  secondSlot: KonquerorDockSlotBounds,
): 0 | 1 {
  const firstCenter = (firstSlot.top + firstSlot.bottom) / 2;
  const secondCenter = (secondSlot.top + secondSlot.bottom) / 2;

  return clientY <= (firstCenter + secondCenter) / 2 ? 0 : 1;
}

export function resolveKonquerorDockPreview(
  order: KonquerorDockOrder,
  sourceBand: KonquerorDockBand,
  clientY: number,
  firstSlot: KonquerorDockSlotBounds,
  secondSlot: KonquerorDockSlotBounds,
): KonquerorDockOrder {
  const sourceSlot = getKonquerorDockBands(order).indexOf(sourceBand);
  const targetSlot = getKonquerorDockSlotForClientY(clientY, firstSlot, secondSlot);

  return sourceSlot === targetSlot ? order : swapKonquerorDockOrder(order);
}
