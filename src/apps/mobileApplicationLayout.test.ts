import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRegisteredApplications } from "../application-runtime/applicationRegistry";

const css = readFileSync(new URL("../theme/kde3.css", import.meta.url), "utf8");
const kWriteSource = readFileSync(new URL("./kwrite/KWrite.tsx", import.meta.url), "utf8");
const mobileAvailabilitySource = readFileSync(new URL("../kicker/k-menu/mobileKMenuAvailability.ts", import.meta.url), "utf8");

const mobileCss = css.slice(css.lastIndexOf("/* Other managed applications use the same logical mobile mode"));

describe("other managed application mobile layout contract", () => {
  it("audits every first-party application registered by the runtime", () => {
    expect(getRegisteredApplications().map((definition) => definition.appId)).toEqual([
      "about-kde",
      "about-die-nische",
      "about-konqueror",
      "about-kcontrol",
      "about-kde-panel",
      "about-kwrite",
      "about-konsole",
      "about-kcalc",
      "konqueror",
      "konsole",
      "kwrite",
      "kcontrol",
      "configure-panel",
      "configure-clock",
      "kfind",
      "blog",
      "blog-archive",
      "blog-tags",
      "blog-search",
      "article-reader",
      "bookmark-editor",
      "konsole-bookmark-editor",
      "kcalc",
      "calendar",
    ]);
  });

  it("uses the centralized mobile mode without a second viewport breakpoint or UA branch", () => {
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .application-menubar');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .kwrite-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .konsole-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .kcontrol-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .kfind-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .kcalc-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .blog-app');
    expect(mobileCss).toContain('.desktop-shell[data-layout-mode="mobile"] .article-reader');
    expect(css).not.toMatch(/@media\s*\(max-width:/);
    expect(css).not.toContain("window.innerWidth");
    expect(css).not.toContain("navigator.userAgent");
  });

  it("keeps KWrite toolbar selection semantic and leaves native editor state untouched", () => {
    for (const action of ["new-window", "open", "save", "save-as", "print", "close", "undo", "redo", "cut", "copy", "paste", "find", "increase-font", "decrease-font"]) {
      expect(kWriteSource).toContain(`data-kwrite-action="${action}"`);
    }

    expect(mobileCss).toContain('[data-kwrite-action="new-window"]');
    expect(mobileCss).toContain('[data-kwrite-action="save-as"]');
    expect(mobileCss).toContain('[data-kwrite-action="cut"]');
    expect(mobileCss).toContain('[data-kwrite-action="decrease-font"]');
    expect(mobileCss).toContain(".kwrite-editor");
    expect(mobileCss).toContain("overflow: auto;");
    expect(kWriteSource).toContain('wrap="off"');
  });

  it("gives each complex mobile surface an explicit shrink or scroll owner", () => {
    expect(mobileCss).toContain(".konsole-transcript-viewport");
    expect(mobileCss).toContain(".konsole-prompt");
    expect(mobileCss).toContain(".kcontrol-navigation");
    expect(mobileCss).toContain(".kcontrol-content");
    expect(mobileCss).toContain(".kfind-results__header");
    expect(mobileCss).toContain("min-width: 650px;");
    expect(mobileCss).toContain(".kcalc-button-bank");
    expect(mobileCss).toContain("--kcalc-key-width: 31px;");
    expect(mobileCss).toContain(".blog-tags__master");
    expect(mobileCss).toContain(".blog-tags__detail");
    expect(mobileCss).toContain(".article-reader__body table");
    expect(mobileCss).toContain(".kcontrol-dialog-backdrop");
    expect(mobileCss).toContain(".kfind-dialog-backdrop");
  });

  it("does not change the accepted mobile K Menu availability policy", () => {
    expect(mobileAvailabilitySource).toContain('"configure-panel"');
    expect(mobileAvailabilitySource).toContain('"kcalc"');
    expect(mobileAvailabilitySource).toContain('"kfind"');
    expect(mobileAvailabilitySource).toContain('"action-bookmarks"');
    expect(mobileAvailabilitySource).toContain('"action-quick-browser"');
    expect(mobileAvailabilitySource).toContain('"run-command"');
  });
});
