import type { VfsNodeId } from "../../vfs/types";

export type KFindResultSelectionDirection = "previous" | "next";

export function getKFindResultSelection(
  visibleResultIds: readonly VfsNodeId[],
  selectedResultId: VfsNodeId | null,
  direction: KFindResultSelectionDirection,
): VfsNodeId | null {
  if (visibleResultIds.length === 0) return null;

  const currentIndex = selectedResultId === null ? -1 : visibleResultIds.indexOf(selectedResultId);
  if (currentIndex === -1) {
    return direction === "next"
      ? visibleResultIds[0] ?? null
      : visibleResultIds[visibleResultIds.length - 1] ?? null;
  }

  const nextIndex = direction === "next"
    ? Math.min(currentIndex + 1, visibleResultIds.length - 1)
    : Math.max(currentIndex - 1, 0);
  return visibleResultIds[nextIndex] ?? null;
}
