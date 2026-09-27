// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { ConfigurePanel } from "./ConfigurePanel";

describe("Configure Panel applied surface", () => {
  it("keeps clock settings out of the panel configuration window", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider><ConfigurePanel /></DesktopPreferencesProvider>,
    );

    expect(markup).toContain("Show tasks from all desktops");
    expect(markup).not.toContain("Show date below clock");
    expect(markup).not.toContain("LCD look");
  });
});
