import { describe, expect, it } from "vitest";
import {
  defaultKonquerorDockOrder,
  getKonquerorDockBands,
  getKonquerorDockSlotForClientY,
  resolveKonquerorDockPreview,
  swapKonquerorDockOrder,
} from "./konquerorDockLayout";

const firstSlot = { top: 20, bottom: 48 };
const secondSlot = { top: 48, bottom: 78 };

describe("Konqueror dock layout", () => {
  it("defaults to Toolbar above Location and swaps deterministically", () => {
    expect(defaultKonquerorDockOrder).toBe("toolbar-location");
    expect(getKonquerorDockBands(defaultKonquerorDockOrder)).toEqual(["toolbar", "location"]);
    expect(swapKonquerorDockOrder(defaultKonquerorDockOrder)).toBe("location-toolbar");
    expect(swapKonquerorDockOrder("location-toolbar")).toBe("toolbar-location");
  });

  it("uses measured slot geometry to resolve the upper and lower target zones", () => {
    expect(getKonquerorDockSlotForClientY(30, firstSlot, secondSlot)).toBe(0);
    expect(getKonquerorDockSlotForClientY(65, firstSlot, secondSlot)).toBe(1);
    expect(resolveKonquerorDockPreview("toolbar-location", "toolbar", 30, firstSlot, secondSlot)).toBe(
      "toolbar-location",
    );
    expect(resolveKonquerorDockPreview("toolbar-location", "toolbar", 65, firstSlot, secondSlot)).toBe(
      "location-toolbar",
    );
  });

  it("returns to the committed order when a band moves back into its original slot", () => {
    expect(resolveKonquerorDockPreview("location-toolbar", "location", 30, firstSlot, secondSlot)).toBe(
      "location-toolbar",
    );
    expect(resolveKonquerorDockPreview("location-toolbar", "location", 65, firstSlot, secondSlot)).toBe(
      "toolbar-location",
    );
  });
});
