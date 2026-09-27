import { describe, expect, it } from "vitest";
import {
  getApplicationDefinition,
  getRegisteredApplications,
  hasApplication,
  isApplicationMostUsedEligible,
} from "./applicationRegistry";
import { getApplicationInstancePolicy } from "./instancePolicy";

describe("applicationRegistry", () => {
  it("registers Calendar as a singleton Clock-only utility without Most Used eligibility", () => {
    const definition = getApplicationDefinition("calendar");

    expect(definition).toMatchObject({
      name: "Calendar",
      defaultTitle: "Calendar",
      iconId: "calendar",
      instancePolicy: "singleton",
      isMostUsedEligible: false,
      window: {
        bounds: { width: 304, height: 218 },
        isMinimizable: false,
        alwaysOnTop: true,
      },
    });
    expect(isApplicationMostUsedEligible("calendar")).toBe(false);
  });

  it("returns the Konqueror definition", () => {
    const definition = getApplicationDefinition("konqueror");

    expect(definition?.name).toBe("Konqueror");
    expect(definition?.defaultLaunchIntent).toEqual({ type: "open-konqueror-start" });
  });

  it("registers the independent singleton Runtime About windows", () => {
    const expectedAboutApplications = [
      ["about-kde", "About KDE", "about"],
      ["about-die-nische", "About die Nische", "about"],
      ["about-konqueror", "About Konqueror", "konqueror"],
      ["about-kcontrol", "About KDE Control Center", "kcontrol"],
      ["about-kde-panel", "About KDE Panel", "about"],
      ["about-kwrite", "About KWrite", "kwrite"],
      ["about-konsole", "About Konsole", "konsole"],
      ["about-kcalc", "About KCalc", "kcalc"],
    ] as const;

    expectedAboutApplications.forEach(([appId, title, iconId]) => {
      const definition = getApplicationDefinition(appId);
      expect(definition?.name).toBe(title);
      expect(definition?.defaultTitle).toBe(title);
      expect(definition?.iconId).toBe(iconId);
      expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    });
  });

  it("returns the Konsole definition", () => {
    const definition = getApplicationDefinition("konsole");

    expect(definition?.name).toBe("Konsole");
    expect(definition?.defaultTitle).toBe("Konsole");
    expect(definition?.iconId).toBe("konsole");
    expect(getApplicationInstancePolicy(definition)).toBe("multiple");
  });

  it("returns the KCalc multiple-instance definition", () => {
    const definition = getApplicationDefinition("kcalc");

    expect(definition?.name).toBe("KCalc");
    expect(definition?.defaultTitle).toBe("KCalc");
    expect(definition?.iconId).toBe("kcalc");
    expect(getApplicationInstancePolicy(definition)).toBe("multiple");
    expect(definition?.window.bounds).toEqual({ x: 330, y: 105, width: 273, height: 282 });
    expect(definition?.window.minimumWidth).toBe(273);
    expect(definition?.window.minimumHeight).toBe(282);
  });

  it("returns the KWrite single-document multiple-instance definition", () => {
    const definition = getApplicationDefinition("kwrite");

    expect(definition?.name).toBe("KWrite");
    expect(definition?.defaultTitle).toBe("Untitled - KWrite");
    expect(definition?.iconId).toBe("kwrite");
    expect(getApplicationInstancePolicy(definition)).toBe("multiple");
    expect(definition?.closeBehavior).toBe("application-guarded");
    expect(definition?.window.bounds).toEqual({ x: 230, y: 62, width: 720, height: 560 });
    expect(definition?.window.minimumWidth).toBe(420);
    expect(definition?.window.minimumHeight).toBe(300);
  });

  it("returns KDE Control Center as a guarded singleton application", () => {
    const definition = getApplicationDefinition("kcontrol");

    expect(definition?.name).toBe("KDE Control Center");
    expect(definition?.defaultTitle).toBe("Control Center");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.closeBehavior).toBe("application-guarded");
    expect(definition?.window.bounds).toEqual({ x: 190, y: 70, width: 680, height: 500 });
    expect(definition?.window.minimumWidth).toBe(520);
    expect(definition?.window.minimumHeight).toBe(360);
  });

  it("registers Configure the Panel as a guarded singleton application", () => {
    const definition = getApplicationDefinition("configure-panel");

    expect(definition?.name).toBe("Configure the Panel");
    expect(definition?.defaultTitle).toBe("Configure the Panel");
    expect(definition?.iconId).toBe("panel-settings");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.closeBehavior).toBe("application-guarded");
    expect(definition?.window.bounds).toEqual({ x: 270, y: 110, width: 460, height: 300 });
    expect(definition?.window.minimumWidth).toBe(360);
    expect(definition?.window.minimumHeight).toBe(250);
  });

  it("registers Configure - Clock as a guarded singleton utility outside Most Used", () => {
    const definition = getApplicationDefinition("configure-clock");

    expect(definition).toMatchObject({
      name: "Configure - Clock",
      defaultTitle: "Configure - Clock",
      iconId: "panel-settings",
      instancePolicy: "singleton",
      closeBehavior: "application-guarded",
      isMostUsedEligible: false,
      window: { isResizable: true },
    });
    expect(isApplicationMostUsedEligible("configure-clock")).toBe(false);
  });

  it("returns KFind as an immediate multiple-instance application", () => {
    const definition = getApplicationDefinition("kfind");

    expect(definition?.name).toBe("Find Files/Folders");
    expect(definition?.defaultTitle).toBe("Find Files/Folders");
    expect(definition?.iconId).toBe("kfind");
    expect(getApplicationInstancePolicy(definition)).toBe("multiple");
    expect(definition?.closeBehavior ?? "immediate").toBe("immediate");
    expect(definition?.window.bounds).toEqual({ x: 140, y: 90, width: 760, height: 540 });
    expect(definition?.window.minimumWidth).toBe(620);
    expect(definition?.window.minimumHeight).toBe(420);
  });

  it("registers Blog as a resizable singleton published-content index", () => {
    const definition = getApplicationDefinition("blog");

    expect(definition?.name).toBe("Blog");
    expect(definition?.defaultTitle).toBe("Blog");
    expect(definition?.iconId).toBe("kwrite");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 265, y: 90, width: 660, height: 480 });
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers Blog Archive as a resizable singleton without a Desktop launcher", () => {
    const definition = getApplicationDefinition("blog-archive");

    expect(definition?.name).toBe("Blog Archive");
    expect(definition?.defaultTitle).toBe("Blog Archive");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 250, y: 80, width: 680, height: 520 });
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers Blog Tags as a resizable singleton tag-browser window", () => {
    const definition = getApplicationDefinition("blog-tags");

    expect(definition?.name).toBe("Blog Tags");
    expect(definition?.defaultTitle).toBe("Blog Tags");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 240, y: 85, width: 700, height: 520 });
    expect(definition?.window.minimumWidth).toBe(480);
    expect(definition?.window.minimumHeight).toBe(300);
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers Blog Search as a resizable singleton metadata-search window without a Desktop launcher", () => {
    const definition = getApplicationDefinition("blog-search");

    expect(definition?.name).toBe("Blog Search");
    expect(definition?.defaultTitle).toBe("Blog Search");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 230, y: 75, width: 700, height: 520 });
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers Article Reader as a resizable multi-instance publishing detail window", () => {
    const definition = getApplicationDefinition("article-reader");

    expect(definition?.name).toBe("Article Reader");
    expect(definition?.defaultTitle).toBe("Article Reader");
    expect(definition?.iconId).toBe("kwrite");
    expect(getApplicationInstancePolicy(definition)).toBe("multiple");
    expect(definition?.window.bounds).toEqual({ x: 215, y: 70, width: 760, height: 600 });
    expect(definition?.window.minimumWidth).toBe(420);
    expect(definition?.window.minimumHeight).toBe(280);
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers Bookmark Editor as a resizable singleton utility window", () => {
    const definition = getApplicationDefinition("bookmark-editor");

    expect(definition?.name).toBe("Bookmark Editor");
    expect(definition?.defaultTitle).toBe("Bookmark Editor");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 250, y: 95, width: 640, height: 470 });
    expect(definition?.window.isResizable).toBe(true);
  });

  it("registers the independent Konsole Bookmark Editor as a singleton utility window", () => {
    const definition = getApplicationDefinition("konsole-bookmark-editor");

    expect(definition?.name).toBe("Bookmark Editor");
    expect(definition?.iconId).toBe("konsole");
    expect(getApplicationInstancePolicy(definition)).toBe("singleton");
    expect(definition?.window.bounds).toEqual({ x: 250, y: 95, width: 640, height: 470 });
  });

  it("keeps existing applications on the default immediate close policy", () => {
    expect(getApplicationDefinition("kcalc")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("konsole")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("konqueror")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-kde")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-die-nische")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-konqueror")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-kcontrol")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-kwrite")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-konsole")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("about-kcalc")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("kfind")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("blog")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("blog-archive")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("blog-tags")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("blog-search")?.closeBehavior ?? "immediate").toBe("immediate");
    expect(getApplicationDefinition("article-reader")?.closeBehavior ?? "immediate").toBe("immediate");
  });

  it("uses unique app ids", () => {
    const appIds = getRegisteredApplications().map((definition) => definition.appId);

    expect(new Set(appIds).size).toBe(appIds.length);
  });

  it("keeps historical and project About identities as distinct singleton applications", () => {
    const historical = getApplicationDefinition("about-kde");
    const project = getApplicationDefinition("about-die-nische");

    expect(historical?.appId).toBe("about-kde");
    expect(historical?.defaultTitle).toBe("About KDE");
    expect(project?.appId).toBe("about-die-nische");
    expect(project?.defaultTitle).toBe("About die Nische");
    expect(getApplicationInstancePolicy(historical)).toBe("singleton");
    expect(getApplicationInstancePolicy(project)).toBe("singleton");
    expect(historical).not.toBe(project);
  });

  it("keeps Konqueror, Konsole, KCalc, KFind, KWrite, and Article Reader multiple", () => {
    expect(getApplicationDefinition("konqueror")?.instancePolicy).toBe("multiple");
    expect(getApplicationDefinition("konsole")?.instancePolicy).toBe("multiple");
    expect(getApplicationDefinition("kcalc")?.instancePolicy).toBe("multiple");
    expect(getApplicationDefinition("kfind")?.instancePolicy).toBe("multiple");
    expect(getApplicationDefinition("kwrite")?.instancePolicy).toBe("multiple");
    expect(getApplicationDefinition("article-reader")?.instancePolicy).toBe("multiple");
    getRegisteredApplications()
      .filter((definition) => (
        definition.appId !== "konqueror"
        && definition.appId !== "konsole"
        && definition.appId !== "kcalc"
        && definition.appId !== "kfind"
        && definition.appId !== "kwrite"
        && definition.appId !== "article-reader"
      ))
      .forEach((definition) => expect(definition.instancePolicy).toBe("singleton"));
  });

  it("defaults incomplete test definitions to the legacy singleton policy", () => {
    expect(getApplicationInstancePolicy({})).toBe("singleton");
    expect(getApplicationInstancePolicy({ instancePolicy: "multiple" })).toBe("multiple");
  });

  it("returns undefined for an unknown app id", () => {
    expect(getApplicationDefinition("missing-app")).toBeUndefined();
    expect(hasApplication("missing-app")).toBe(false);
  });

  it("does not mutate definitions during lookup", () => {
    const before = getApplicationDefinition("konqueror");
    const after = getApplicationDefinition("konqueror");

    expect(after).toBe(before);
    expect(after?.window.bounds).toEqual({ x: 500, y: 2, width: 650, height: 600 });
  });

  it("exposes frozen application definitions", () => {
    const definition = getApplicationDefinition("about-kde");

    expect(Object.isFrozen(getRegisteredApplications())).toBe(true);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition?.window)).toBe(true);
    expect(Object.isFrozen(definition?.window.bounds)).toBe(true);
  });

  it("defines correct minimum sizes", () => {
    expect(getApplicationDefinition("konqueror")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("konqueror")?.window.minimumHeight).toBe(280);
    expect(getApplicationDefinition("about-kde")?.window.minimumWidth).toBe(280);
    expect(getApplicationDefinition("about-die-nische")?.window.minimumWidth).toBe(280);
    expect(getApplicationDefinition("about-kde")?.window.minimumHeight).toBe(180);
    expect(getApplicationDefinition("about-konqueror")?.window.minimumWidth).toBe(280);
    expect(getApplicationDefinition("about-konqueror")?.window.minimumHeight).toBe(180);
    expect(getApplicationDefinition("about-kcontrol")?.window.minimumWidth).toBe(280);
    expect(getApplicationDefinition("about-kwrite")?.window.minimumWidth).toBe(280);
    expect(getApplicationDefinition("about-konsole")?.window.minimumHeight).toBe(180);
    expect(getApplicationDefinition("about-kcalc")?.window.isResizable).toBe(true);
    expect(getApplicationDefinition("konsole")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("konsole")?.window.minimumHeight).toBe(260);
    expect(getApplicationDefinition("kcalc")?.window.minimumWidth).toBe(273);
    expect(getApplicationDefinition("kcalc")?.window.minimumHeight).toBe(282);
    expect(getApplicationDefinition("kwrite")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("kwrite")?.window.minimumHeight).toBe(300);
    expect(getApplicationDefinition("kfind")?.window.minimumWidth).toBe(620);
    expect(getApplicationDefinition("kfind")?.window.minimumHeight).toBe(420);
    expect(getApplicationDefinition("blog")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("blog")?.window.minimumHeight).toBe(280);
    expect(getApplicationDefinition("blog-archive")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("blog-archive")?.window.minimumHeight).toBe(280);
    expect(getApplicationDefinition("article-reader")?.window.minimumWidth).toBe(420);
    expect(getApplicationDefinition("article-reader")?.window.minimumHeight).toBe(280);
  });

  it("defines Konsole's preferred window size", () => {
    expect(getApplicationDefinition("konsole")?.window.bounds.width).toBe(700);
    expect(getApplicationDefinition("konsole")?.window.bounds.height).toBe(460);
  });

  it("defines KCalc as movable fixed-size and not maximizable", () => {
    const kcalc = getApplicationDefinition("kcalc");

    expect(kcalc?.window.isResizable).toBe(false);
    expect(kcalc?.window.isMaximizable).toBe(false);
    expect(getApplicationDefinition("konsole")?.window.isMaximizable).toBeUndefined();
  });

  it("defines Konqueror's initial height sizing policy only for Konqueror", () => {
    expect(getApplicationDefinition("konqueror")?.window.initialSizing?.maximumWorkAreaHeightRatio).toBe(0.72);
    expect(getApplicationDefinition("about-kde")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-die-nische")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-konqueror")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-kcontrol")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-kwrite")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-konsole")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("about-kcalc")?.window.initialSizing).toBeUndefined();
    expect(getApplicationDefinition("konsole")?.window.initialSizing).toBeUndefined();
  });
});
