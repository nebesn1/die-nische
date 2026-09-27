import { describe, expect, it } from "vitest";
import { getKMenuSubmenuPosition } from "./submenuPosition";

const workArea = { x: 0, y: 0, width: 800, height: 600 };

describe("getKMenuSubmenuPosition", () => {
  it("prefers opening right while aligning the submenu with its triggering row", () => {
    expect(getKMenuSubmenuPosition(
      { left: 100, right: 338, top: 180 },
      { width: 238, height: 160 },
      workArea,
    )).toMatchObject({ left: 337, top: 180, opensLeft: false });
  });

  it("flips left while retaining row alignment when there is enough vertical space", () => {
    expect(getKMenuSubmenuPosition(
      { left: 650, right: 760, top: 180 },
      { width: 238, height: 160 },
      workArea,
    )).toMatchObject({ left: 413, top: 180, opensLeft: true });
  });

  it("clamps upward only when the aligned cascade would overflow below", () => {
    expect(getKMenuSubmenuPosition(
      { left: 650, right: 760, top: 560 },
      { width: 238, height: 180 },
      workArea,
    )).toMatchObject({ left: 413, top: 420, opensLeft: true });
  });

  it("keeps an oversized submenu within the work area through an explicit max-height", () => {
    expect(getKMenuSubmenuPosition(
      { left: 30, right: 120, top: 210 },
      { width: 238, height: 900 },
      workArea,
    )).toEqual({ left: 119, top: 0, maxHeight: 600, opensLeft: false });
  });

  it("clamps a top-overflowing trigger to the work-area top", () => {
    expect(getKMenuSubmenuPosition(
      { left: 30, right: 120, top: -20 },
      { width: 238, height: 160 },
      workArea,
    )).toMatchObject({ left: 119, top: 0, opensLeft: false });
  });
});
