import { describe, expect, it } from "vitest";
import {
  createControlCenterOpenIntent,
  getKControlExpandedCategoriesForModule,
  getKControlPageForModule,
  isControlCenterOpenIntent,
} from "./controlCenterLaunchIntent";

describe("Control Center launch intent", () => {
  it("uses semantic module names and maps Behavior to the existing page identity", () => {
    const intent = createControlCenterOpenIntent({ module: "behavior" });

    expect(intent).toEqual({ type: "open-control-center-module", module: "behavior" });
    expect(isControlCenterOpenIntent(intent)).toBe(true);
    expect(getKControlPageForModule("behavior")).toBe("icons");
    expect(getKControlExpandedCategoriesForModule("behavior")).toEqual(["desktop"]);
    expect(getKControlExpandedCategoriesForModule("background")).toEqual(["appearance-themes"]);
    expect(getKControlExpandedCategoriesForModule("multiple-desktops")).toEqual(["desktop"]);
    expect(getKControlExpandedCategoriesForModule("language")).toEqual(["regional-accessibility"]);
    expect(isControlCenterOpenIntent({ type: "open-control-center-module", module: "icons" })).toBe(false);
  });

  it("rejects malformed or unsupported module intents", () => {
    expect(isControlCenterOpenIntent(null)).toBe(false);
    expect(isControlCenterOpenIntent({ type: "open-control-center-module", module: "unknown" })).toBe(false);
    expect(isControlCenterOpenIntent({ type: "other", module: "behavior" })).toBe(false);
  });
});
