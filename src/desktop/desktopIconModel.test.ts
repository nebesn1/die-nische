import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import { PROJECT_ABOUT_ICON_ID } from "../branding/projectIdentity";
import {
  desktopIconDefinitions,
  getDesktopHomeLaunchRequest,
  getDesktopIconDefinition,
  getDesktopIconLaunchAppId,
  getDesktopIconLaunchRequest,
} from "./desktopIconModel";

describe("desktopIconDefinitions", () => {
  it("defines Trash, My Computer, Blog, then About with unique stable ids", () => {
    const ids = desktopIconDefinitions.map((definition) => definition.id);

    expect(ids).toEqual(["desktop-trash", "desktop-my-computer", "desktop-blog", "desktop-about-die-nische"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getDesktopIconDefinition("desktop-home")).toBeUndefined();
    expect(getDesktopIconDefinition("desktop-cdrom")).toBeUndefined();
    expect(getDesktopIconDefinition("desktop-floppy")).toBeUndefined();
  });

  it("defines My Computer as a new Konqueror sysinfo launcher", () => {
    const computer = getDesktopIconDefinition("desktop-my-computer");

    expect(computer?.action.type).toBe("launch-application");
    expect(computer?.action.type === "launch-application" ? computer.action.appId : undefined).toBe("konqueror");
    expect(computer?.action.type === "launch-application" ? computer.action.intent : undefined).toEqual({ type: "open-sysinfo" });
    expect(getApplicationDefinition("konqueror")).toBeDefined();
    expect(computer ? getDesktopIconLaunchAppId(computer) : null).toBe("konqueror");
    expect(computer ? getDesktopIconLaunchRequest(computer) : null).toEqual({
      appId: "konqueror",
      options: { intent: { type: "open-sysinfo" } },
      newInstance: true,
    });
  });

  it("keeps Trash as a Konqueror launcher with its existing special-location intent", () => {
    const trash = getDesktopIconDefinition("desktop-trash");

    expect(trash?.action.type).toBe("launch-application");
    expect(trash?.action.type === "launch-application" ? trash.action.intent : undefined).toEqual({
      type: "open-special-location",
      location: "trash",
    });
  });

  it("defines Blog as a code-owned singleton application launcher", () => {
    const blog = getDesktopIconDefinition("desktop-blog");

    expect(blog).toMatchObject({
      label: "Blog",
      iconId: "kwrite",
      action: { type: "launch-application", appId: "blog" },
      initialColumn: 1,
      initialRow: 3,
    });
    expect(blog ? getDesktopIconLaunchRequest(blog) : null).toEqual({ appId: "blog", newInstance: undefined });
  });

  it("defines About as the project About singleton launcher with the shared project mark", () => {
    const about = getDesktopIconDefinition("desktop-about-die-nische");

    expect(about).toMatchObject({
      label: "About",
      iconId: PROJECT_ABOUT_ICON_ID,
      action: { type: "launch-application", appId: "about-die-nische" },
      initialColumn: 1,
      initialRow: 4,
    });
    expect(about?.id).not.toBe("about-kde");
    expect(about ? getDesktopIconLaunchRequest(about) : null).toEqual({ appId: "about-die-nische", newInstance: undefined });
  });

  it("does not expose internal published-content windows as Desktop launchers", () => {
    expect(desktopIconDefinitions.map((definition) => definition.label)).not.toContain("Article Reader");
    expect(desktopIconDefinitions.map((definition) => definition.label)).not.toContain("Blog Archive");
    expect(desktopIconDefinitions.map((definition) => definition.label)).not.toContain("Blog Tags");
    expect(getDesktopIconDefinition("desktop-blog-archive")).toBeUndefined();
    expect(getDesktopIconDefinition("desktop-blog-tags")).toBeUndefined();
    expect(getDesktopIconDefinition("desktop-blog-search")).toBeUndefined();
  });

  it("uses a new Konqueror instance for the Desktop Home runtime request", () => {
    expect(getDesktopHomeLaunchRequest()).toEqual({
      appId: "konqueror",
      options: { intent: { type: "open-special-location", location: "home" } },
      newInstance: true,
    });
  });

  it("freezes the desktop icon definitions", () => {
    const computer = getDesktopIconDefinition("desktop-my-computer");

    expect(Object.isFrozen(desktopIconDefinitions)).toBe(true);
    expect(Object.isFrozen(computer)).toBe(true);
    expect(Object.isFrozen(computer?.action)).toBe(true);
    expect(Object.isFrozen(computer?.labelLines)).toBe(true);
  });
});
