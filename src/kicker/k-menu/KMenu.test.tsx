import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { ApplicationUsageContext } from "../../application-runtime/ApplicationUsageContext";
import { initialApplicationUsageState } from "../../application-runtime/applicationUsage";
import type { LaunchApplicationOptions, LaunchApplicationResult } from "../../application-runtime/types";
import { KMenu } from "./KMenu";
import { KMenuButton } from "./KMenuButton";
import { KMenuPanel } from "./KMenuPanel";
import { initialKMenuState } from "./menuState";

const launchApplication = vi.fn((appId: string, options?: LaunchApplicationOptions): LaunchApplicationResult => {
  void appId;
  void options;
  return "already-active";
});
const launchNewApplicationInstance = vi.fn((appId: string, options?: LaunchApplicationOptions): LaunchApplicationResult => {
  void appId;
  void options;
  return "already-active";
});

const renderLauncherContext = (children: React.ReactNode): string =>
  renderToStaticMarkup(
    <ApplicationUsageContext.Provider value={initialApplicationUsageState}>
      <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance }}>{children}</ApplicationLauncherContext.Provider>
    </ApplicationUsageContext.Provider>,
  );

describe("KMenu SSR structure", () => {
  it("renders the closed K button without menu items", () => {
    const markup = renderLauncherContext(<KMenu />);

    expect(markup).toContain("aria-expanded=\"false\"");
    expect(markup).toContain("aria-label=\"Open K menu\"");
    expect(markup).toContain("class=\"kicker-launcher kicker-button kicker-button--k\"");
    expect(markup).not.toContain("Web Browser (Konqueror)");
  });

  it("keeps Most Used visible but empty in a fresh runtime", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{ ...initialKMenuState, isOpen: true, activeItemId: "category-editors" }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup.indexOf("Most Used Applications")).toBeLessThan(markup.indexOf("All Applications"));
    expect(markup).not.toContain('data-menu-item-id="most-used-kcontrol"');
  });

  it("renders the K button expanded state", () => {
    const markup = renderToStaticMarkup(
      <KMenuButton
        buttonRef={{ current: null }}
        controlsId="k-menu-panel"
        isOpen={true}
        onToggle={() => undefined}
      />,
    );

    expect(markup).toContain("aria-expanded=\"true\"");
    expect(markup).toContain("aria-controls=\"k-menu-panel\"");
    expect(markup).toContain("class=\"kicker-launcher kicker-button kicker-button--k is-active\"");
    expect(markup).toContain("is-active");
  });

  it("renders root menu, submenu semantics, enabled Actions, separators, and brand strip", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{
          ...initialKMenuState,
          isOpen: true,
          activeItemId: "category-internet",
          openSubmenuId: "category-internet",
        }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("class=\"panel-popup-layer k-menu-popup\"");
    expect(markup).toContain("role=\"menu\"");
    expect(markup).toContain("aria-hidden=\"true\"");
    expect(markup).toContain("KDE 3");
    expect(markup).not.toContain("KDE 3.X");
    expect(markup).not.toContain("KDE 3.3");
    expect(markup).toContain("data-menu-section-id=\"section-most-used\"");
    expect(markup).toContain("Most Used Applications");
    expect(markup).toContain("All Applications");
    expect(markup).toContain("Actions");
    expect(markup).toContain("aria-haspopup=\"menu\"");
    expect(markup).toContain("aria-expanded=\"true\"");
    expect(markup).not.toContain("Kicker bookmark opening is not implemented yet");
    expect(markup).toContain("class=\"k-menu-section\"");
    expect(markup).toContain("Web Browser (Konqueror)");
    expect(markup).toContain("aria-label=\"Konqueror\"");
  });

  it("uses the canonical project mark for the About die Nische menu entry", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{ ...initialKMenuState, isOpen: true }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain('data-menu-item-id="common-project-about"');
    expect(markup).toContain('data-k-menu-icon-id="project-about"');
    expect(markup).toContain('data-icon-family="project-about"');
    expect(markup).toContain('href="/branding/die-nische-mark.svg"');
  });

  it("renders Konsole as an enabled System application entry", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{
          ...initialKMenuState,
          isOpen: true,
          activeItemId: "category-system",
          openSubmenuId: "category-system",
        }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("Terminal Program (Konsole)");
    expect(markup).toContain("aria-label=\"Konsole\"");
    expect(markup).not.toContain("Konsole is not implemented yet");
  });

  it("renders KCalc as an enabled Utilities application entry", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{
          ...initialKMenuState,
          isOpen: true,
          activeItemId: "category-utilities",
          openSubmenuId: "category-utilities",
        }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("Scientific Calculator (KCalc)");
    expect(markup).toContain("aria-label=\"KCalc\"");
  });

  it("renders KWrite as the enabled Editors application entry", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{
          ...initialKMenuState,
          isOpen: true,
          activeItemId: "category-editors",
          openSubmenuId: "category-editors",
        }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("Text Editor (KWrite)");
    expect(markup).toContain("aria-label=\"KWrite\"");
  });

  it("keeps direct Control Center while Settings contains only Configure the Panel", () => {
    const markup = renderToStaticMarkup(
      <KMenuPanel
        menuId="k-menu-panel"
        state={{
          ...initialKMenuState,
          isOpen: true,
          activeItemId: "category-settings",
          openSubmenuId: "category-settings",
        }}
        onSetActiveItem={() => undefined}
        onOpenSubmenu={() => undefined}
        onCloseSubmenu={() => undefined}
        onCloseMenu={() => undefined}
        onLaunchApplication={() => undefined}
      />,
    );

    expect(markup).toContain("Configure the Panel");
    expect(markup).toContain("data-menu-item-id=\"settings-configure-panel\"");
    expect(markup).not.toContain("data-menu-item-id=\"settings-control-center\"");
    expect(markup).toContain("data-menu-item-id=\"all-applications-control-center\"");
  });
});
