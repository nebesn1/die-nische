import { describe, expect, it } from "vitest";
import { getTaskbarContextMenuEntries, getTaskbarContextMenuPosition } from "./taskbarContextMenuModel";

describe("taskbar background context menu model", () => {
  it("defines only Configure Panel, a separator, and Help", () => {
    const entries = getTaskbarContextMenuEntries();

    expect(entries.map((entry) => entry.type === "separator" ? "separator" : entry.label)).toEqual([
      "Configure Panel...",
      "separator",
      "Help",
    ]);
    expect(entries[0]).toMatchObject({ type: "application", appId: "configure-panel" });
    expect(entries[2]).toMatchObject({ type: "submenu", label: "Help" });
    expect(entries[2]?.type === "submenu" ? entries[2].children.map((entry) => entry.type === "application" ? entry.label : entry.type) : []).toEqual([
      "About KDE Panel",
      "About KDE",
    ]);
  });

  it("opens above the bottom Kicker and clamps to the full screen", () => {
    expect(getTaskbarContextMenuPosition(
      { clientX: 820, clientY: 680 },
      { width: 220, height: 84 },
      { x: 0, y: 0, width: 900, height: 686 },
    )).toEqual({ left: 680, top: 594 });
  });

  it("keeps a tall menu inside the visible screen instead of producing a negative top", () => {
    expect(getTaskbarContextMenuPosition(
      { clientX: 40, clientY: 20 },
      { width: 220, height: 900 },
      { x: 0, y: 0, width: 900, height: 686 },
    )).toEqual({ left: 40, top: 0 });
  });
});
