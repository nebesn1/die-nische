import { DEFAULT_DESKTOP_COUNT, DEFAULT_DESKTOP_ID, normalizeDesktopCount, type DesktopId } from "../window-manager/types";

export function getPagerKeyboardTarget(
  currentDesktopId: DesktopId,
  key: string,
  desktopCount = DEFAULT_DESKTOP_COUNT,
): DesktopId | null {
  const count = normalizeDesktopCount(desktopCount);
  const columns = count === 1 ? 1 : Math.ceil(count / 2);

  if (currentDesktopId < 1 || currentDesktopId > count) {
    return null;
  }

  if (key === "Home") return DEFAULT_DESKTOP_ID;
  if (key === "End") return count;

  const index = currentDesktopId - 1;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const candidate = key === "ArrowLeft"
    ? column > 0 ? index - 1 : -1
    : key === "ArrowRight"
      ? column < columns - 1 && index + 1 < count ? index + 1 : -1
      : key === "ArrowUp"
        ? row > 0 ? index - columns : -1
        : key === "ArrowDown"
          ? index + columns < count ? index + columns : -1
          : -1;

  return candidate >= 0 && candidate < count ? candidate + 1 : null;
}

export function getDesktopButtonId(desktopId: DesktopId): string {
  return `pager-desktop-${desktopId}`;
}

export function getInitialPagerDesktopId(): DesktopId {
  return DEFAULT_DESKTOP_ID;
}
