// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationLauncherContext, type ApplicationLauncherContextValue } from "../../application-runtime/useApplicationLauncher";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES, type DesktopPreferences } from "../../preferences/desktopPreferences";
import { I18nProvider } from "../../i18n/I18nProvider";
import { useDesktopPreferences } from "../../preferences/useDesktopPreferences";
import { KControl } from "./KControl";
import { createControlCenterOpenIntent } from "./controlCenterLaunchIntent";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function DesktopCountProbe() {
  const { preferences } = useDesktopPreferences();
  return <output data-desktop-count={preferences.desktopCount}>{preferences.desktopCount}</output>;
}

function ThemeProbe() {
  const { preferences } = useDesktopPreferences();
  return <output data-theme-id={preferences.themeId}>{preferences.themeId}</output>;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  document.documentElement.lang = "";
  window.localStorage.clear();
});

const buttonByText = (text: string): HTMLButtonElement => {
  const button = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`Missing button ${text}.`);
  return button;
};

const buttonByExactText = (text: string): HTMLButtonElement => {
  const button = [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Missing button ${text}.`);
  return button;
};

function renderControlCenter(
  onSetWindowTitle = vi.fn(),
  { launcher = null, onRequestClose = () => undefined, launchRequest = null, initialPreferences }: { readonly launcher?: ApplicationLauncherContextValue | null; readonly onRequestClose?: () => void; readonly launchRequest?: Parameters<typeof KControl>[0]["launchRequest"]; readonly initialPreferences?: DesktopPreferences } = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => root?.render(
    <ApplicationLauncherContext.Provider value={launcher}>
      <DesktopPreferencesProvider initialPreferences={initialPreferences}>
        <I18nProvider>
          <KControl launchRequest={launchRequest} onRequestClose={onRequestClose} onSetWindowTitle={onSetWindowTitle} />
        </I18nProvider>
        <DesktopCountProbe />
        <ThemeProbe />
      </DesktopPreferencesProvider>
    </ApplicationLauncherContext.Provider>,
  ));

  return onSetWindowTitle;
}

function rerenderControlCenter(launchRequest: Parameters<typeof KControl>[0]["launchRequest"] = null) {
  act(() => root?.render(
    <ApplicationLauncherContext.Provider value={null}>
      <DesktopPreferencesProvider>
        <I18nProvider>
          <KControl launchRequest={launchRequest} />
        </I18nProvider>
      </DesktopPreferencesProvider>
    </ApplicationLauncherContext.Provider>,
  ));
}

describe("Control Center home and tree navigation", () => {
  it("opens the Behavior module from the typed Configure Desktop intent", () => {
    const titles = renderControlCenter(vi.fn(), { launchRequest: { requestId: 1, intent: createControlCenterOpenIntent({ module: "behavior" }) } });

    expect(titles).toHaveBeenLastCalledWith("Behavior - Control Center");
    expect(container?.querySelector('[aria-selected="true"]')?.textContent).toContain("Behavior");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Behavior");
    expect(container?.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect([...container?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []].map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "true", null, null, "false"]);
    expect(container?.querySelector('[role="treeitem"]')?.textContent).toContain("Appearance & Themes");
    expect(container?.querySelector('[role="treeitem"]')?.nextElementSibling?.textContent).toContain("Desktop");
    expect(container?.querySelector('[role="treeitem"]')?.textContent).not.toContain("Background");
  });

  it("opens Home with no selected leaf and keeps module actions disabled", () => {
    const titles = renderControlCenter();
    const tree = container?.querySelector('[role="tree"]');

    expect(titles).toHaveBeenLastCalledWith("Control Center");
    expect(container?.querySelector("#kcontrol-home-title")?.textContent).toBe("KDE Control Center");
    expect(container?.querySelector('[aria-selected="true"]')).toBeNull();
    expect(container?.querySelector(".kcontrol-page")).toBeNull();
    expect([...tree?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []].map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "false", "false"]);
    expect(tree?.querySelectorAll('[role="treeitem"]').length).toBe(3);
    expect(tree?.textContent).toContain("Appearance & Themes");
    expect(tree?.textContent).toContain("Desktop");
    expect(tree?.textContent).toContain("Regional & Accessibility");
    expect(tree?.textContent).not.toContain("Behavior");
    expect(tree?.textContent).not.toContain("Icons");
    expect(tree?.textContent).not.toContain("Panel");
    expect(buttonByText("Defaults").disabled).toBe(true);
    expect(buttonByText("Reset").disabled).toBe(true);
    expect(buttonByText("Apply").disabled).toBe(true);
  });

  it("renders ordered tree branches and distinct scoped icons for every category and leaf", () => {
    renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByExactText("Regional & Accessibility").click());

    const rows = [...(container?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      "Appearance & Themes",
      "Background",
      "Theme Manager",
      "Desktop",
      "Behavior",
      "Multiple Desktops",
      "Regional & Accessibility",
      "Country/Region & Language",
    ]);
    expect(rows.map((row) => row.querySelector<HTMLElement>(".kcontrol-tree__icon")?.className)).toEqual([
      "kcontrol-tree__icon kcontrol-tree__icon--category kcontrol-tree__icon--appearance-themes",
      "kcontrol-tree__icon kcontrol-tree__icon--leaf kcontrol-tree__icon--background",
      "kcontrol-tree__icon kcontrol-tree__icon--leaf kcontrol-tree__icon--theme-manager",
      "kcontrol-tree__icon kcontrol-tree__icon--category kcontrol-tree__icon--desktop",
      "kcontrol-tree__icon kcontrol-tree__icon--leaf kcontrol-tree__icon--behavior",
      "kcontrol-tree__icon kcontrol-tree__icon--leaf kcontrol-tree__icon--multiple-desktops",
      "kcontrol-tree__icon kcontrol-tree__icon--category kcontrol-tree__icon--regional-accessibility",
      "kcontrol-tree__icon kcontrol-tree__icon--leaf kcontrol-tree__icon--country-region-language",
    ]);
    expect(rows.every((row) => row.querySelector(".kcontrol-tree__icon-anchor > .kcontrol-tree__icon") !== null)).toBe(true);
    expect(rows.filter((row) => row.classList.contains("kcontrol-tree__row--leaf")).map((row) => (
      row.querySelector(".konqueror-tree-current-branch")?.classList.contains("is-tee") ? "tee" : "elbow"
    ))).toEqual(["tee", "elbow", "tee", "elbow", "elbow"]);
    expect(rows.filter((row) => row.classList.contains("kcontrol-tree__row--category")).every((row) => (
      row.classList.contains("is-expanded")
    ))).toBe(true);
    expect(rows.filter((row) => row.classList.contains("kcontrol-tree__row--category")).every((row) => (
      row.querySelector(".konqueror-tree-expander")?.getAttribute("aria-expanded") === "true"
      && row.querySelector(".kcontrol-tree__icon-anchor")?.classList.contains("is-expanded")
    ))).toBe(true);
    expect(rows.filter((row) => row.classList.contains("kcontrol-tree__row--leaf")).every((row) => (
      row.querySelector(".konqueror-tree-expander") === null
      && row.getAttribute("aria-expanded") === null
    ))).toBe(true);
  });

  it("selects Background and Behavior with exact live window titles", () => {
    const titles = renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByText("Background").click());
    expect(titles).toHaveBeenLastCalledWith("Background - Control Center");
    expect(container?.querySelector('[aria-selected="true"]')?.textContent).toContain("Background");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Background");

    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByText("Behavior").click());
    expect(titles).toHaveBeenLastCalledWith("Behavior - Control Center");
    expect(container?.querySelector('[aria-selected="true"]')?.textContent).toContain("Behavior");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Behavior");
  });

  it("guards dirty module switches without discarding the current draft", () => {
    renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByText("Background").click());
    act(() => buttonByText("Teal").click());
    act(() => buttonByText("Behavior").click());

    expect(container?.querySelector('[role="alertdialog"]')?.textContent).toContain("Apply changes before switching modules?");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Background");

    act(() => buttonByExactText("Cancel").click());
    expect(container?.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Background");
    expect(container?.querySelector('.kcontrol-preset.is-selected')?.textContent).toContain("Teal");

    act(() => buttonByText("Behavior").click());
    const switchDialog = container?.querySelector<HTMLElement>('[role="alertdialog"]');
    const applySwitch = [...(switchDialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .find((button) => button.textContent === "Apply");
    if (!applySwitch) throw new Error("Missing module-switch Apply action.");
    act(() => applySwitch.click());
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Behavior");
  });

  it("restores Home and the base title when the singleton is mounted again", () => {
    const firstTitles = renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByText("Background").click());
    expect(firstTitles).toHaveBeenLastCalledWith("Background - Control Center");

    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;

    const secondTitles = renderControlCenter();
    const remountedContainer = document.querySelector<HTMLDivElement>('[data-kcontrol-root]');
    expect(secondTitles).toHaveBeenLastCalledWith("Control Center");
    expect(remountedContainer?.querySelector("#kcontrol-home-title")?.textContent).toBe("KDE Control Center");
    expect(remountedContainer?.querySelector('[aria-selected="true"]')).toBeNull();
    expect(remountedContainer?.querySelector("#kcontrol-page-title")).toBeNull();
  });

  it("expands and collapses categories and supports visible-row keyboard navigation", () => {
    renderControlCenter();
    const appearance = buttonByText("Appearance & Themes");

    expect(appearance.getAttribute("aria-expanded")).toBe("false");
    act(() => appearance.click());
    expect(appearance.getAttribute("aria-expanded")).toBe("true");
    expect(appearance.querySelector('.konqueror-tree-expander[aria-expanded="true"]')).not.toBeNull();
    expect(container?.querySelectorAll('[role="treeitem"]').length).toBe(5);
    act(() => appearance.focus());
    act(() => appearance.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })));
    expect(document.activeElement?.textContent).toContain("Background");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(document.activeElement?.textContent).toContain("Theme Manager");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })));
    expect(document.activeElement?.textContent).toContain("Desktop");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })));
    expect(document.activeElement?.textContent).toContain("Desktop");
  });

  it("selects Multiple Desktops with its own title and keeps its count as an unapplied draft", () => {
    const titles = renderControlCenter();

    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByText("Multiple Desktops").click());

    expect(titles).toHaveBeenLastCalledWith("Multiple Desktops - Control Center");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Multiple Desktops");
    const input = container?.querySelector<HTMLInputElement>('input[type="number"]');
    expect(input?.value).toBe("4");
    expect(input?.min).toBe("1");
    expect(input?.max).toBe("20");
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe("4");
    expect(buttonByText("Apply").disabled).toBe(true);

    act(() => {
      if (!input) throw new Error("Missing desktop count input.");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(buttonByText("Apply").disabled).toBe(false);
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe("4");
    act(() => buttonByText("Apply").click());
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe("2");
    act(() => buttonByText("Defaults").click());
    expect(input?.value).toBe("4");
    act(() => buttonByText("Reset").click());
    expect(input?.value).toBe("2");
  });

  it("applies the Language module live and keeps Defaults and Reset as draft operations", () => {
    renderControlCenter();
    act(() => buttonByExactText("Regional & Accessibility").click());
    act(() => buttonByText("Country/Region & Language").click());

    const chinese = container?.querySelector<HTMLInputElement>('input[value="zh-CN"]');
    if (!chinese) throw new Error("Missing Simplified Chinese option.");
    act(() => chinese.click());
    act(() => buttonByExactText("Apply").click());

    expect(document.documentElement.lang).toBe("zh-CN");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("国家/地区和语言");
    expect(container?.textContent).toContain("默认");

    const english = container?.querySelector<HTMLInputElement>('input[value="en"]');
    if (!english) throw new Error("Missing English option.");
    act(() => buttonByExactText("默认").click());
    expect(english.checked).toBe(true);
    act(() => buttonByExactText("重置").click());
    expect(chinese.checked).toBe(true);
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("retranslates the applied status across zh-CN, English, and German without remounting", () => {
    renderControlCenter(vi.fn(), {
      initialPreferences: { ...DEFAULT_DESKTOP_PREFERENCES, locale: "zh-CN" },
    });
    act(() => container?.querySelector<HTMLButtonElement>('.kcontrol-tree__row--category .kcontrol-tree__icon--regional-accessibility')?.closest("button")?.click());
    act(() => buttonByText("国家/地区和语言").click());

    const applyLocale = (locale: string, applyLabel: string) => {
      act(() => container?.querySelector<HTMLInputElement>(`input[value="${locale}"]`)?.click());
      act(() => buttonByExactText(applyLabel).click());
    };
    const notice = () => container?.querySelector(".kcontrol-notice")?.textContent;
    const actionLabels = () => [...(container?.querySelectorAll<HTMLButtonElement>(".kcontrol-actions > button") ?? [])].map((button) => button.textContent);

    applyLocale("en", "应用");
    expect(notice()).toBe("Settings applied and saved");
    expect(notice()).not.toBe("设置已应用并保存");
    expect(actionLabels()).toEqual(["Defaults", "Reset", "Apply"]);
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Country/Region & Language");

    applyLocale("de", "Apply");
    expect(notice()).toBe("Einstellungen angewendet und gespeichert");
    expect(notice()).not.toBe("Settings applied and saved");
    expect(actionLabels()).toEqual(["Standards", "Zurücksetzen", "Anwenden"]);

    applyLocale("zh-CN", "Anwenden");
    expect(notice()).toBe("设置已应用并保存");
    expect(notice()).not.toBe("Einstellungen angewendet und gespeichert");
    expect(actionLabels()).toEqual(["默认", "重置", "应用"]);
  });

  it("keeps the applied status localized when applying without changing locale", () => {
    renderControlCenter();
    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByText("Background").click());
    act(() => buttonByText("Teal").click());
    act(() => buttonByExactText("Apply").click());

    expect(container?.querySelector(".kcontrol-notice")?.textContent).toBe("Settings applied and saved");
  });

  it("keeps tree geometry slots stable for German and Simplified Chinese labels", () => {
    renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByExactText("Regional & Accessibility").click());

    const treeStructure = () => [...(container?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])].map((row) => ({
      className: [...row.classList].filter((className) => className !== "is-selected").join(" "),
      depth: row.getAttribute("style"),
      branch: row.querySelector<HTMLElement>(".konqueror-tree-current-branch")?.className ?? null,
      expander: row.querySelector<HTMLElement>(".konqueror-tree-expander")?.className ?? null,
      iconAnchor: row.querySelector<HTMLElement>(".kcontrol-tree__icon-anchor")?.className ?? null,
      icon: row.querySelector<HTMLElement>(".kcontrol-tree__icon")?.className ?? null,
      label: row.querySelector<HTMLElement>(".kcontrol-tree__label")?.className.replace(" is-selected", "") ?? null,
    }));

    const englishStructure = treeStructure();
    act(() => buttonByText("Country/Region & Language").click());
    act(() => container?.querySelector<HTMLInputElement>('input[value="de"]')?.click());
    act(() => buttonByExactText("Apply").click());

    expect(document.documentElement.lang).toBe("de");
    expect(container?.textContent).toContain("Erscheinungsbild und Design");
    expect(container?.textContent).toContain("Regionaleinstellungen und Zugangshilfen");
    expect(container?.textContent).toContain("Land/Region und Sprache");
    expect(treeStructure()).toEqual(englishStructure);

    act(() => container?.querySelector<HTMLInputElement>('input[value="zh-CN"]')?.click());
    act(() => buttonByExactText("Anwenden").click());
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(treeStructure()).toEqual(englishStructure);
  });

  it("keeps Theme Manager selection local until Apply and supports Reset and Defaults", () => {
    const titles = renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByText("Theme Manager").click());
    expect(titles).toHaveBeenLastCalledWith("Theme Manager - Control Center");
    const redmond = container?.querySelector<HTMLInputElement>('input[type="radio"][value="redmond"]');
    if (!redmond) throw new Error("Missing Redmond theme option.");

    act(() => redmond.click());
    expect(container?.querySelector('[data-theme-id="kde-classic"]')).not.toBeNull();
    expect(buttonByText("Apply").disabled).toBe(false);

    act(() => buttonByText("Reset").click());
    expect(container?.querySelector('[data-theme-id="kde-classic"]')).not.toBeNull();

    act(() => redmond.click());
    act(() => buttonByText("Apply").click());
    expect(container?.querySelector('[data-theme-id="redmond"]')).not.toBeNull();

    act(() => buttonByText("Defaults").click());
    expect(container?.querySelector('[data-theme-id="redmond"]')).not.toBeNull();
    expect(buttonByText("Apply").disabled).toBe(false);
    expect(container?.querySelector<HTMLInputElement>('input[type="radio"][value="kde-classic"]')?.checked).toBe(true);
  });

  it("keeps an editable desktop-count text draft separate from validated Apply state", () => {
    renderControlCenter();
    act(() => buttonByExactText("Desktop").click());
    act(() => buttonByText("Multiple Desktops").click());

    const input = container?.querySelector<HTMLInputElement>('input[type="number"]');
    if (!input) throw new Error("Missing desktop count input.");
    const appliedCount = container?.querySelector("[data-desktop-count]")?.textContent;
    if (!appliedCount) throw new Error("Missing applied desktop count.");

    const setInputValue = (value: string) => {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    setInputValue("1");
    expect(input.value).toBe("1");
    setInputValue("");
    expect(input.value).toBe("");
    expect(buttonByText("Apply").disabled).toBe(true);
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe(appliedCount);

    act(() => buttonByText("Defaults").click());
    expect(input.value).toBe("4");
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe(appliedCount);

    setInputValue("");
    act(() => buttonByText("Reset").click());
    expect(input.value).toBe(appliedCount);

    setInputValue("12");
    expect(buttonByText("Apply").disabled).toBe(false);
    setInputValue("21");
    expect(buttonByText("Apply").disabled).toBe(true);
    setInputValue("0");
    expect(buttonByText("Apply").disabled).toBe(true);
    setInputValue("20");
    expect(buttonByText("Apply").disabled).toBe(false);
    act(() => buttonByText("Apply").click());
    expect(container?.querySelector("[data-desktop-count]")?.textContent).toBe("20");

    setInputValue("");
    expect(buttonByText("Apply").disabled).toBe(true);
    act(() => buttonByText("Reset").click());
    expect(input.value).toBe("20");
  });

  it("uses the Konqueror-style File and Help structure while launching independent About windows", () => {
    const onRequestClose = vi.fn();
    const launchApplication = vi.fn();
    renderControlCenter(vi.fn(), {
      onRequestClose,
      launcher: { launchApplication, launchNewApplicationInstance: vi.fn() },
    });

    act(() => buttonByText("File").click());
    const fileMenu = container?.querySelector('[role="menu"][aria-label="File menu"]');
    expect([...fileMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((button) => button.textContent)).toEqual(["Quit"]);
    expect(fileMenu?.textContent).not.toContain("Close");
    act(() => buttonByText("Quit").click());
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    act(() => buttonByText("Help").click());
    const helpMenu = container?.querySelector('[role="menu"][aria-label="Help menu"]');
    expect([...helpMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((button) => button.textContent)).toEqual(["About KDE Control Center", "About KDE"]);
    act(() => buttonByText("About KDE Control Center").click());
    expect(launchApplication).toHaveBeenCalledWith("about-kcontrol");
    expect(container?.querySelector(".kcontrol-about")).toBeNull();
    expect(container?.textContent).not.toContain("KDE Control Center - Desktop Preferences");

    act(() => buttonByText("Help").click());
    act(() => buttonByExactText("About KDE").click());
    expect(launchApplication).toHaveBeenCalledWith("about-kde");

    act(() => buttonByText("File").click());
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(container?.querySelector('[role="menu"]')).toBeNull();

    act(() => buttonByText("Help").click());
    act(() => container?.querySelector("[data-kcontrol-root]")?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(container?.querySelector('[role="menu"]')).toBeNull();
  });

  it("keeps the selected module and its dynamic title unchanged when opening About KDE Control Center", () => {
    const onSetWindowTitle = vi.fn();
    const launchApplication = vi.fn();
    renderControlCenter(onSetWindowTitle, {
      launcher: { launchApplication, launchNewApplicationInstance: vi.fn() },
    });

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByText("Background").click());
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("Background - Control Center");

    act(() => buttonByText("Help").click());
    act(() => buttonByText("About KDE Control Center").click());

    expect(launchApplication).toHaveBeenCalledWith("about-kcontrol");
    expect(container?.querySelector('[aria-selected="true"]')?.textContent).toContain("Background");
    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Background");
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("Background - Control Center");
  });

  it("normalizes an existing singleton tree only for a new external module request", () => {
    renderControlCenter();

    act(() => buttonByExactText("Appearance & Themes").click());
    act(() => buttonByExactText("Regional & Accessibility").click());
    expect(container?.querySelectorAll('[role="treeitem"]').length).toBe(6);

    rerenderControlCenter({ requestId: 2, intent: createControlCenterOpenIntent({ module: "behavior" }) });

    expect(container?.querySelector("#kcontrol-page-title")?.textContent).toBe("Behavior");
    expect([...container?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []].map((row) => row.getAttribute("aria-expanded"))).toEqual(["false", "true", null, null, "false"]);
  });

  it("preserves a manually expanded tree on ordinary singleton reactivation", () => {
    renderControlCenter();
    act(() => buttonByExactText("Appearance & Themes").click());

    rerenderControlCenter();

    expect(container?.querySelector('[role="treeitem"][aria-expanded="true"]')?.textContent).toContain("Appearance & Themes");
  });
});
