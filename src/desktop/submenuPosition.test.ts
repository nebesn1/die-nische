import { describe, expect, it } from "vitest";
import { getSubmenuPosition } from "./submenuPosition";

const workArea = { x: 0, y: 0, width: 800, height: 600 };

describe("getSubmenuPosition", () => {
  it("keeps normal cascades attached to the triggering row", () => {
    expect(getSubmenuPosition(
      { left: 100, right: 340, top: 120 },
      { width: 180, height: 160 },
      workArea,
    )).toMatchObject({ left: 339, top: 120, opensLeft: false });
  });

  it("flips immediately to the left while retaining row alignment", () => {
    expect(getSubmenuPosition(
      { left: 650, right: 760, top: 120 },
      { width: 180, height: 160 },
      workArea,
    )).toMatchObject({ left: 471, top: 120, opensLeft: true });
  });

  it("clamps vertically without changing horizontal attachment", () => {
    expect(getSubmenuPosition(
      { left: 100, right: 340, top: 560 },
      { width: 180, height: 160 },
      workArea,
    )).toMatchObject({ left: 339, top: 440, opensLeft: false });
  });
});
