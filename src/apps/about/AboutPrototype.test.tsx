// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTranslator } from "../../i18n/translate";
import { I18nContext } from "../../i18n/I18nContext";
import type { DesktopLocale } from "../../i18n/locale";
import { HistoricalKdeAbout, ProjectAbout } from "./AboutPrototype";

let container: HTMLDivElement;
let root: Root;

const aboutProps = {
  heading: "die Nische",
  description: "A KDE 3-inspired web desktop.",
  note: "die Nische is an independent web desktop project.",
};

const renderAbout = (locale: DesktopLocale = "en") => {
    act(() => root.render(
      <I18nContext.Provider value={{ locale, t: createTranslator(locale) }}>
      <ProjectAbout {...aboutProps} />
      </I18nContext.Provider>,
  ));
};

const clickView = (view: "overview" | "legal" | "licenses") => {
  const button = container.querySelector<HTMLButtonElement>(`[data-about-view="${view}"]`);
  if (!button) throw new Error(`Missing About view button: ${view}`);
  act(() => button.click());
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("project About legal views", () => {
  it("exposes the project mark, Legal, and Licenses controls without changing the About identity", () => {
    renderAbout();
    expect(container.querySelector("[data-project-brand-mark='true']")).not.toBeNull();
    expect(container.querySelector("[data-about-view='legal']")?.textContent).toBe("Legal");
    expect(container.querySelector("[data-about-view='licenses']")?.textContent).toBe("Licenses");
    expect(container.textContent).toContain("die Nische");
    expect(container.textContent).toContain("A KDE 3-inspired web desktop.");
  });

  it("keeps Legal and Licenses summaries semantically equivalent in all supported locales", () => {
    for (const locale of ["en", "zh-CN", "de"] as const) {
      renderAbout(locale);
      clickView("legal");
      expect(container.querySelector<HTMLElement>("[data-about-panel='legal']")?.hidden).toBe(false);
      expect(container.querySelector<HTMLElement>("[data-about-panel='licenses']")?.hidden).toBe(true);
      expect(container.textContent).toContain("KDE");
      expect(container.textContent).toContain("KDE e.V.");
      expect(container.textContent).toContain("LEGAL.md");
      clickView("licenses");
      expect(container.querySelector<HTMLElement>("[data-about-panel='licenses']")?.hidden).toBe(false);
      expect(container.querySelector<HTMLElement>("[data-about-panel='legal']")?.hidden).toBe(true);
      expect(container.textContent).toContain("MIT");
      expect(container.textContent).toContain("CC BY 4.0");
      expect(container.textContent).toContain("LEGAL.md");
    }
  });
});

describe("historical KDE About", () => {
  it("keeps the About KDE identity separate from the project legal surface", () => {
    act(() => root.render(
      <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
        <HistoricalKdeAbout />
      </I18nContext.Provider>,
    ));

    expect(container.querySelector("[data-about-identity='historical-kde']")).not.toBeNull();
    expect(container.textContent).toContain("KDE 3");
    expect(container.textContent).toContain("historical recreation");
    expect(container.querySelector("[data-project-brand-mark='true']")).toBeNull();
    expect(container.querySelector("[data-about-view='overview']")).toBeNull();
    expect(container.querySelector("[data-about-view='legal']")).toBeNull();
    expect(container.querySelector("[data-about-view='licenses']")).toBeNull();
  });
});
