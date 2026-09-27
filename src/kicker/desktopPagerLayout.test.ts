import { describe, expect, it } from "vitest";
import { getDesktopPagerLayout } from "./desktopPagerLayout";

describe("desktop pager layout", () => {
  it.each([
    [1, 1, 1, [1]],
    [2, 1, 2, [1, 2]],
    [3, 2, 2, [1, 2, 3]],
    [4, 2, 2, [1, 2, 3, 4]],
    [5, 3, 2, [1, 2, 3, 4, 5]],
    [6, 3, 2, [1, 2, 3, 4, 5, 6]],
    [7, 4, 2, [1, 2, 3, 4, 5, 6, 7]],
  ])("lays out %i desktops without placeholder cells", (desktopCount, columns, rows, desktopIds) => {
    expect(getDesktopPagerLayout(desktopCount)).toMatchObject({ columns, rows, desktopIds });
  });

  it("supports arbitrary valid desktop counts with contiguous ids", () => {
    const layout = getDesktopPagerLayout(13);

    expect(layout.columns).toBe(7);
    expect(layout.rows).toBe(2);
    expect(layout.desktopIds).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
  });

  it("renders the complete supported twenty-desktop pager in two rows", () => {
    const layout = getDesktopPagerLayout(20);

    expect(layout.columns).toBe(10);
    expect(layout.rows).toBe(2);
    expect(layout.desktopIds).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});
