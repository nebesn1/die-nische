// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../preferences/desktopPreferences";
import {
  DESKTOP_PREFERENCES_STORAGE_KEY,
  createDesktopPreferencesStorage,
  serializeDesktopPreferences,
  type DesktopPreferencesStorageBackend,
} from "../preferences/desktopPreferencesPersistence";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";
import { I18nProvider } from "./I18nProvider";
import { useI18n } from "./useI18n";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Consumer({ name }: { readonly name: string }) {
  const { t } = useI18n();
  return <output data-consumer={name}>{t("common.language")}</output>;
}

function ApplicationChromeConsumer() {
  const { t } = useI18n();
  return <output data-application-chrome>{t("kwrite.save")} / {t("konsole.session")} / {t("kcalc.settings")}</output>;
}

function LocaleProbe() {
  const { locale } = useI18n();
  return <output data-locale={locale}>{locale}</output>;
}

function LocaleApplyProbe() {
  const { applyPreferences, preferences } = useDesktopPreferences();

  return (
    <>
      <LocaleProbe />
      <button type="button" onClick={() => applyPreferences({ ...preferences, locale: "en" })}>Apply English</button>
    </>
  );
}

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): DesktopPreferencesStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map(Object.entries(initial));

  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function renderLocaleProbe(
  storage: DesktopPreferencesStorageBackend,
  probe: ReactNode = <LocaleProbe />,
): HTMLDivElement {
  const nextContainer = document.createElement("div");
  container = nextContainer;
  document.body.append(nextContainer);
  root = createRoot(nextContainer);

  act(() => root?.render(
    <DesktopPreferencesProvider storage={createDesktopPreferencesStorage(() => storage)}>
      <I18nProvider>{probe}</I18nProvider>
    </DesktopPreferencesProvider>,
  ));

  return nextContainer;
}

function LocaleController() {
  const { applyPreferences, preferences } = useDesktopPreferences();
  return (
    <button type="button" onClick={() => applyPreferences({ ...preferences, locale: "zh-CN" })}>
      Switch language
    </button>
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.documentElement.lang = "";
  vi.unstubAllGlobals();
});

describe("I18nProvider", () => {
  it("updates multiple consumers and html lang without remounting the provider tree", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <DesktopPreferencesProvider initialPreferences={DEFAULT_DESKTOP_PREFERENCES}>
        <I18nProvider>
          <Consumer name="a" />
          <Consumer name="b" />
          <ApplicationChromeConsumer />
          <LocaleController />
        </I18nProvider>
      </DesktopPreferencesProvider>,
    ));

    expect(container.querySelector('[data-consumer="a"]')?.textContent).toBe("Language");
    expect(container.querySelector("[data-application-chrome]")?.textContent).toBe("Save / Session / Settings");
    expect(document.documentElement.lang).toBe("en");

    act(() => container?.querySelector("button")?.click());
    expect(container.querySelector('[data-consumer="a"]')?.textContent).toBe("语言");
    expect(container.querySelector('[data-consumer="b"]')?.textContent).toBe("语言");
    expect(container.querySelector("[data-application-chrome]")?.textContent).toBe("保存 / 会话 / 设置");
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it.each([
    [["zh-CN"], "zh-CN"],
    [["zh"], "zh-CN"],
    [["de-DE"], "de"],
    [["fr"], "en"],
  ] as const)("bootstraps an empty preference store from browser languages %j", (languages, expected) => {
    vi.stubGlobal("navigator", { languages, language: "en-US" });
    const storage = createMemoryStorage();
    renderLocaleProbe(storage);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe(expected);
    expect(storage.values.has(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(false);
  });

  it("uses navigator.language only when navigator.languages is unavailable", () => {
    vi.stubGlobal("navigator", { language: "de-DE" });
    renderLocaleProbe(createMemoryStorage());

    expect(container?.querySelector("[data-locale]")?.textContent).toBe("de");
  });

  it.each([
    ["en", ["zh-CN"], "en"],
    ["zh-CN", ["de-DE"], "zh-CN"],
    ["de", ["en-US"], "de"],
  ] as const)("keeps valid persisted locale %s ahead of browser detection", (persistedLocale, languages, expected) => {
    vi.stubGlobal("navigator", { languages, language: languages[0] });
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({ ...DEFAULT_DESKTOP_PREFERENCES, locale: persistedLocale }),
    });
    renderLocaleProbe(storage);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe(expected);
  });

  it("uses browser detection after rejecting an explicitly invalid persisted locale", () => {
    vi.stubGlobal("navigator", { languages: ["de-DE"], language: "de-DE" });
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        preferences: { ...DEFAULT_DESKTOP_PREFERENCES, locale: "fr" },
      }),
    });
    renderLocaleProbe(storage);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe("de");
    expect(storage.values.has(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(false);
  });

  it("uses browser detection for a legacy record without a persisted locale", () => {
    vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
    const legacyPreferences = { ...DEFAULT_DESKTOP_PREFERENCES };
    delete (legacyPreferences as { locale?: "en" }).locale;
    const storage = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, preferences: legacyPreferences }),
    });
    renderLocaleProbe(storage);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe("zh-CN");
  });

  it("uses browser detection after removing a malformed preference record", () => {
    vi.stubGlobal("navigator", { languages: ["de-DE"], language: "de-DE" });
    const storage = createMemoryStorage({ [DESKTOP_PREFERENCES_STORAGE_KEY]: "{broken" });
    renderLocaleProbe(storage);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe("de");
    expect(storage.values.has(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(false);
  });

  it("keeps repeated first-visit mounts stable without persisting the detected locale", () => {
    vi.stubGlobal("navigator", { languages: ["zh"], language: "zh" });
    const storage = createMemoryStorage();
    renderLocaleProbe(storage);
    expect(container?.querySelector("[data-locale]")?.textContent).toBe("zh-CN");

    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    const remountedContainer = renderLocaleProbe(storage);

    expect(remountedContainer.querySelector("[data-locale]")?.textContent).toBe("zh-CN");
    expect(storage.values.has(DESKTOP_PREFERENCES_STORAGE_KEY)).toBe(false);
  });

  it("persists an explicit manual locale and keeps it ahead of later browser values", () => {
    vi.stubGlobal("navigator", { languages: ["de-DE"], language: "de-DE" });
    const storage = createMemoryStorage();
    renderLocaleProbe(storage, <LocaleApplyProbe />);

    expect(container?.querySelector("[data-locale]")?.textContent).toBe("de");
    act(() => container?.querySelector<HTMLButtonElement>("button")?.click());
    expect(container?.querySelector("[data-locale]")?.textContent).toBe("en");

    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
    const remountedContainer = renderLocaleProbe(storage);

    expect(remountedContainer.querySelector("[data-locale]")?.textContent).toBe("en");
  });
});
