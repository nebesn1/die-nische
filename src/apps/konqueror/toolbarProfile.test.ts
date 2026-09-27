import { describe, expect, it } from "vitest";
import type { KonquerorView } from "./navigationTypes";
import {
  getKonquerorToolbarActionGroups,
  getKonquerorToolbarProfile,
} from "./toolbarProfile";

const view = (type: KonquerorView["type"]): KonquerorView => ({ type } as KonquerorView);

describe("Konqueror toolbar profiles", () => {
  it("derives Resource Manager from resource-browser views", () => {
    expect(getKonquerorToolbarProfile(view("directory"), null)).toBe("resource-manager");
    expect(getKonquerorToolbarProfile(view("sysinfo"), null)).toBe("resource-manager");
  });

  it("derives Web from Start Page, KHTML, and external HTTPS content", () => {
    expect(getKonquerorToolbarProfile(view("about-konqueror"), null)).toBe("web");
    expect(getKonquerorToolbarProfile(view("file"), "khtml")).toBe("web");
    expect(getKonquerorToolbarProfile(view("external-web"), null)).toBe("web");
  });

  it("derives Document from text and Markdown previews", () => {
    expect(getKonquerorToolbarProfile(view("file"), "embedded-text")).toBe("document");
    expect(getKonquerorToolbarProfile(view("file"), "markdown")).toBe("document");
  });

  it("uses the dedicated image profile with the classic image action order", () => {
    expect(getKonquerorToolbarProfile(view("file"), "image")).toBe("image");
    expect(getKonquerorToolbarActionGroups("image").flat()).toEqual([
      "up", "back", "forward", "home", "reload", "stop",
      "cut", "copy", "paste",
      "print", "previous-image", "next-image", "zoom-in", "zoom-menu", "zoom-out", "rotate-right",
    ]);
    expect(getKonquerorToolbarActionGroups("image").slice(0, 2)).toEqual([
      ["up", "back", "forward", "home"],
      ["reload", "stop"],
    ]);
  });

  it("uses a flat media profile with the required navigation, clipboard, and output order", () => {
    expect(getKonquerorToolbarProfile(view("file"), "media-audio")).toBe("media");
    expect(getKonquerorToolbarProfile(view("file"), "media-video")).toBe("media");
    expect(getKonquerorToolbarActionGroups("media").flat()).toEqual([
      "up", "back", "forward", "home", "reload", "stop",
      "cut", "copy", "paste", "print",
    ]);
  });

  it("keeps exact profile action groups independent from the view renderer", () => {
    expect(getKonquerorToolbarActionGroups("resource-manager").flat()).toEqual([
      "up", "back", "forward", "home", "reload", "stop",
      "cut", "copy", "paste", "print", "zoom-in", "zoom-out", "icon-view", "tree-view",
    ]);
    expect(getKonquerorToolbarActionGroups("web").at(-1)).toEqual(["security"]);
    expect(getKonquerorToolbarActionGroups("document").flat()).not.toContain("icon-view");
    for (const profile of ["resource-manager", "web", "document"] as const) {
      expect(getKonquerorToolbarActionGroups(profile).slice(0, 2)).toEqual([
        ["up", "back", "forward", "home"],
        ["reload", "stop"],
      ]);
    }
  });
});
