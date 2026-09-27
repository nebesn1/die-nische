import { describe, expect, it } from "vitest";
import { getKonsoleSchemaSubmenuPosition } from "./konsoleMenuPosition";

describe("Konsole schema submenu positioning", () => {
  const screen = { x: 0, y: 0, width: 900, height: 680 };

  it("opens beside its parent row when there is room", () => {
    expect(getKonsoleSchemaSubmenuPosition({ left: 100, right: 220, top: 120 }, { width: 144, height: 110 }, screen)).toEqual({
      left: 218,
      top: 117,
      opensLeft: false,
    });
  });

  it("flips left and clamps within ScreenArea at the right edge", () => {
    expect(getKonsoleSchemaSubmenuPosition({ left: 840, right: 890, top: 640 }, { width: 144, height: 110 }, screen)).toEqual({
      left: 698,
      top: 570,
      opensLeft: true,
    });
  });
});
