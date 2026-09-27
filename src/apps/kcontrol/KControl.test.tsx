import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n/I18nProvider";
import { DEFAULT_DESKTOP_PREFERENCES } from "../../preferences/desktopPreferences";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { KControl } from "./KControl";

describe("KDE Control Center UI", () => {
  it("renders the classic dual-pane settings shell and local draft controls", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider><KControl /></DesktopPreferencesProvider>,
    );

    expect(markup).toContain("data-kcontrol-root=\"true\"");
    expect(markup).toContain("Appearance &amp; Themes");
    expect(markup).toContain("Desktop");
    expect(markup.match(/role="treeitem"[^>]*aria-expanded="false"/g)?.length).toBe(3);
    expect(markup).not.toContain(">Background<");
    expect(markup).not.toContain(">Behavior<");
    expect(markup).toContain("KDE Control Center");
    expect(markup).not.toContain(">Icons<");
    expect(markup).not.toContain(">Panel<");
    expect(markup).toContain("Defaults");
    expect(markup).toContain("Reset");
    expect(markup).toContain("Apply");
    expect(markup).toContain("Configure your desktop environment.");
    expect(markup).not.toContain("type=\"color\"");
  });

  it.each(["en", "zh-CN", "de"] as const)("keeps the historical KDE version value locale-independent for %s", (locale) => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider initialPreferences={{ ...DEFAULT_DESKTOP_PREFERENCES, locale }}>
        <I18nProvider><KControl /></I18nProvider>
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("<dd>3</dd>");
    expect(markup).not.toContain("3.X");
    expect(markup).toContain("die Nische");
  });

  it("stays preferences-only and reuses generic Runtime close callbacks", () => {
    const source = readFileSync(new URL("./KControl.tsx", import.meta.url), "utf8");
    const model = readFileSync(new URL("./controlCenterModel.ts", import.meta.url), "utf8");

    expect(source).toContain("onRequestClose");
    expect(source).toContain("isControlCenterOpenIntent");
    expect(source).toContain("getKControlPageForModule");
    expect(source).toContain('t("controlCenter.applyBeforeSwitching")');
    expect(source).toContain("onCommitClose");
    expect(source).toContain("onCancelClose");
    expect(source).toContain('t("controlCenter.applyBeforeClosing")');
    expect(source).toContain("useApplicationMenuDismissal({");
    expect(source).toContain("ref={menuBarRef}");
    expect(source).toContain('openMenu !== null && event.key === "Escape"');
    expect(source).toContain("setOpenMenu(null); onRequestClose();");
    expect(source).toContain('t("controlCenter.quit")');
    expect(source).toContain('launcher?.launchApplication("about-kcontrol")');
    expect(source).toContain('t("controlCenter.aboutKde")');
    expect(source).toContain('launcher?.launchApplication("about-kde")');
    expect(source).not.toContain("KDE Control Center - Desktop Preferences");
    expect(source).not.toContain("kcontrol-about");
    expect(source).toContain("const result = applyPreferences(draft)");
    expect(source).toContain("getKControlPersistenceNoticeKey(result)");
    expect(source).toContain('"common.settingsApplied"');
    expect(source).not.toContain("useVfs");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("document.body.style");
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("document.addEventListener");
    expect(model).not.toContain("react");
  });

  it("adapts Konqueror tree primitives instead of restoring a flat navigation list", () => {
    const treeSource = readFileSync(new URL("./KControlTree.tsx", import.meta.url), "utf8");
    const cssSource = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

    expect(treeSource).toContain("konqueror-tree-expander");
    expect(treeSource).toContain("konqueror-tree-current-branch");
    expect(treeSource).toContain("konqueror-tree-label");
    expect(cssSource).toContain("--kcontrol-navigation-width: 300px;");
    expect(cssSource).toContain("width: var(--kcontrol-navigation-width);");
    expect(cssSource).toContain("flex: 0 0 var(--kcontrol-navigation-width);");
    expect(cssSource).toContain("white-space: nowrap;");
    expect(cssSource).toContain(".kcontrol-navigation {");
    expect(cssSource).toContain("flex-direction: column;");
    expect(cssSource).toContain("padding: 7px 5px 0;");
    expect(cssSource).toContain(".kcontrol-tree {");
    expect(cssSource).toContain("flex: 1 1 auto;");
    expect(treeSource).toContain("isLastChild");
    expect(treeSource).toContain("kcontrol-tree__icon-anchor");
    expect(cssSource).toContain(".kcontrol-tree__icon-anchor.is-expanded::after");
    expect(treeSource).toContain("kcontrol-tree__expander");
    expect(cssSource).toContain(".kcontrol-tree__row > .kcontrol-tree__expander");
    expect(cssSource).toContain("flex: 0 0 var(--kde-tree-indent-step);");
    expect(cssSource).toContain("display: flex;");
    expect(cssSource).toContain("overflow: visible;");
    expect(cssSource).toContain(".kcontrol-tree__icon {");
    expect(cssSource).toContain("display: block;");
    expect(cssSource).toContain("box-sizing: border-box;");
    expect(cssSource).not.toContain("kcontrol-tree__category-expander.is-expanded");
    expect(cssSource).not.toContain(".kcontrol-tree__leaf-branch::before");
    expect(cssSource).toContain(".kcontrol-tree__icon--theme-manager::before");
    expect(treeSource).not.toContain("Icons");
    expect(treeSource).not.toContain("Panel");
  });

  it("captures checkbox values before deferred draft updates", () => {
    const source = readFileSync(new URL("./KControl.tsx", import.meta.url), "utf8");
    const panelSource = readFileSync(new URL("./PanelSettings.tsx", import.meta.url), "utf8");

    expect(source).toContain("const showDesktopIcons = event.currentTarget.checked");
    expect(source).toContain("setKControlDesktopIcons(current, showDesktopIcons)");
    expect(panelSource).not.toContain("setKControlClockDate");
    expect(panelSource).not.toContain("setKControlLcdClockLook");
    expect(panelSource).toContain("const showTasksFromAllDesktops = event.currentTarget.checked");
    expect(panelSource).toContain("setKControlShowTasksFromAllDesktops(current, showTasksFromAllDesktops)");
    expect(panelSource).toContain('t("controlCenter.showTasksFromAllDesktops")');
    expect(source).not.toContain("setKControlDesktopIcons(current, event.currentTarget.checked)");
    expect(panelSource).not.toContain("setKControlClockDate(current, event.currentTarget.checked)");
    expect(panelSource).not.toContain("setKControlLcdClockLook(current, event.currentTarget.checked)");
    expect(panelSource).not.toContain("setKControlShowTasksFromAllDesktops(current, event.currentTarget.checked)");
  });
});
