import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

const getRule = (selector: string): string => {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing ${selector} CSS rule`);
  return match[1];
};

describe("Konqueror dock width contract", () => {
  it("stretches the DockArea and both physical slots across the owning Konqueror width", () => {
    const dockArea = getRule(".konqueror-dock-area");
    const dockSlot = getRule(".konqueror-dock-slot");

    expect(dockArea).toContain("width: 100%");
    expect(dockArea).toContain("align-self: stretch");
    expect(dockArea).toContain("flex-direction: column");
    expect(dockSlot).toContain("width: 100%");
    expect(dockSlot).toContain("align-self: stretch");
    expect(dockSlot).toContain("flex-direction: column");
  });

  it("keeps the bands and their existing flexible contents inside the full-width slots", () => {
    const dockBand = getRule(".konqueror-dock-slot > .konqueror-toolbar,\\n.konqueror-dock-slot > .konqueror-addressbar");
    const toolbarSpacer = getRule(".toolbar-spacer");
    const locationInput = getRule(".address-input");
    const grip = getRule(".toolbar-grip");

    expect(dockBand).toContain("width: 100%");
    expect(dockBand).toContain("min-width: 0");
    expect(toolbarSpacer).toContain("flex: 1 1 auto");
    expect(locationInput).toContain("flex: 1");
    expect(grip).toContain("min-width: 11px");
  });
});
