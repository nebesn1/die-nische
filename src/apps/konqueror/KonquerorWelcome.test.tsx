import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nContext } from "../../i18n/I18nContext";
import { createTranslator } from "../../i18n/translate";
import { KonquerorStartPage } from "./KonquerorWelcome";

describe("Konqueror start page identity notice", () => {
  it("keeps the historical Konqueror presentation and adds a subtle recreation notice", () => {
    const markup = renderToStaticMarkup(
      <I18nContext.Provider value={{ locale: "en", t: createTranslator("en") }}>
        <KonquerorStartPage
          onOpenHome={() => undefined}
          onOpenSettings={() => undefined}
          onOpenSysinfo={() => undefined}
          onOpenTrash={() => undefined}
        />
      </I18nContext.Provider>,
    );

    expect(markup).toContain("Conquer your Desktop!");
    expect(markup).toContain("Konqueror is your file manager and universal document viewer.");
    expect(markup).toContain("browser-based recreation inspired by the historical KDE Konqueror application");
    expect(markup).toContain("not the original KDE Konqueror application");
    expect(markup).toContain("konqueror-start-page__recreation-notice");
  });
});
