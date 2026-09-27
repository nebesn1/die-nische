import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import { DESKTOP_PREFERENCES_STORAGE_KEY } from "../preferences/desktopPreferencesPersistence";
import { DEFAULT_THEME_ID } from "../theme/themeCatalog";
import { PROJECT_ABOUT_ICON_ID, PROJECT_BRAND, PROJECT_BRAND_MARK_PATH, PROJECT_BRAND_MARK_URL, PROJECT_DESCRIPTION, PROJECT_INDEPENDENCE_NOTICE } from "./projectIdentity";
import { ProjectAboutIcon } from "./ProjectAboutIcon";

const projectMark = readFileSync(new URL("../../public/branding/die-nische-mark.svg", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const sampleArtwork = ["nische-archway-01.svg", "nische-archway-02.svg", "nische-archway-03.svg"]
  .map((fileName) => readFileSync(new URL(`./assets/${fileName}`, import.meta.url), "utf8"));

describe("project identity", () => {
  it("uses the exact canonical project brand", () => {
    expect(PROJECT_BRAND).toBe("die Nische");
  });

  it("uses the canonical short description", () => {
    expect(PROJECT_DESCRIPTION).toBe("A KDE 3-inspired web desktop.");
  });

  it("states the independent relationship to KDE", () => {
    expect(PROJECT_INDEPENDENCE_NOTICE).toContain("independent web desktop project");
    expect(PROJECT_INDEPENDENCE_NOTICE).toContain("not affiliated with");
    expect(PROJECT_INDEPENDENCE_NOTICE).toContain("KDE e.V.");
    expect(PROJECT_INDEPENDENCE_NOTICE).toContain("KDE Community");
  });

  it("uses one independent project mark for the favicon and project About", () => {
    expect(PROJECT_BRAND_MARK_PATH).toBe("branding/die-nische-mark.svg");
    expect(PROJECT_BRAND_MARK_URL).toContain(PROJECT_BRAND_MARK_PATH);
    expect(indexHtml).toContain(`%BASE_URL%${PROJECT_BRAND_MARK_PATH}`);
    expect(projectMark).toContain("<title id=\"title\">die Nische</title>");
    expect(projectMark).not.toMatch(/KDE|Konqi|Katie|Kori|Crystal|gear/i);
    expect(projectMark).not.toContain("<text");
  });

  it("exposes one BASE_URL-safe icon identity for both project About launchers", () => {
    const markup = renderToStaticMarkup(createElement(ProjectAboutIcon, { "aria-hidden": true, focusable: false }));

    expect(PROJECT_ABOUT_ICON_ID).toBe("project-about");
    expect(markup).toContain('data-icon-family="project-about"');
    expect(markup).toContain(`href="${PROJECT_BRAND_MARK_URL}"`);
  });

  it("keeps the replacement sample artwork project-authored and mascot-free", () => {
    expect(sampleArtwork).toHaveLength(3);
    sampleArtwork.forEach((source) => {
      expect(source).toContain("<svg");
      expect(source).not.toMatch(/KDE|Konqi|Katie|Kori|Crystal|mascot/i);
    });
  });

  it("preserves stable application, theme, and preference identifiers", () => {
    expect(getApplicationDefinition("about-kde")?.appId).toBe("about-kde");
    expect(getApplicationDefinition("about-kde")?.defaultTitle).toBe("About KDE");
    expect(getApplicationDefinition("about-die-nische")?.appId).toBe("about-die-nische");
    expect(getApplicationDefinition("about-die-nische")?.defaultTitle).toBe("About die Nische");
    expect(DEFAULT_THEME_ID).toBe("kde-classic");
    expect(DESKTOP_PREFERENCES_STORAGE_KEY).toBe("kde3-web-desktop.preferences.desktop.v1");
  });
});
