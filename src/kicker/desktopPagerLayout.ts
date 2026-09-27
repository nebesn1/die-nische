import { getDesktopIds, normalizeDesktopCount, type DesktopId } from "../window-manager/types";

export type DesktopPagerLayout = {
  readonly columns: number;
  readonly rows: 1 | 2;
  readonly desktopIds: readonly DesktopId[];
  readonly singleDesktop: boolean;
};

export function getDesktopPagerLayout(desktopCount: number): DesktopPagerLayout {
  const count = normalizeDesktopCount(desktopCount);

  return {
    columns: count === 1 ? 1 : Math.ceil(count / 2),
    rows: count === 1 ? 1 : 2,
    desktopIds: getDesktopIds(count),
    singleDesktop: count === 1,
  };
}
