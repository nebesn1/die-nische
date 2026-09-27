import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { ConfigurePanel } from "./ConfigurePanel";

describe("Configure the Panel UI", () => {
  it("reuses the shared panel settings surface without a Control Center or application menu bar", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider><ConfigurePanel /></DesktopPreferencesProvider>,
    );

    expect(markup).toContain("data-configure-panel-root=\"true\"");
    expect(markup).toContain("Panel");
    expect(markup).toContain("Show tasks from all desktops");
    expect(markup).not.toContain("Show date below clock");
    expect(markup).not.toContain("LCD look");
    expect(markup).toContain("Defaults");
    expect(markup).toContain("Reset");
    expect(markup).toContain("Apply");
    expect(markup).not.toContain("data-kcontrol-root");
    expect(markup).not.toContain("Appearance &amp; Themes");
    expect(markup).not.toContain("menu bar");
    expect(markup).not.toContain(">File<");
    expect(markup).not.toContain(">Help<");
  });
});
