import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VfsProvider } from "../vfs/VfsProvider";
import { ApplicationRuntimeContext } from "./ApplicationRuntimeContext";
import { ApplicationHost } from "./ApplicationHost";
import { WindowManagerContext, type WindowManagerContextValue } from "../window-manager/useWindowManager";
import { ApplicationLauncherContext } from "./useApplicationLauncher";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";

const windowManager: WindowManagerContextValue = {
  windows: [],
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 600, titleBarHeight: 22 },
  activateWindow: () => undefined,
  focusWindow: () => undefined,
  openWindow: () => undefined,
  moveWindow: () => undefined,
  resizeWindow: () => undefined,
  minimizeWindow: () => undefined,
  restoreWindow: () => undefined,
  maximizeWindow: () => undefined,
  restoreMaximizedWindow: () => undefined,
  toggleMaximizeWindow: () => undefined,
  closeWindow: () => undefined,
  toggleTaskbarWindow: () => undefined,
  switchDesktop: () => undefined,
  toggleShowDesktop: () => undefined,
  moveWindowToDesktop: () => undefined,
  setWorkArea: () => undefined,
};

const applicationLauncher = {
  launchApplication: () => "already-active" as const,
  launchNewApplicationInstance: () => "already-active" as const,
};

const desktopWindow = (appId: string, id = `app:${appId}`) => ({ id, appId, isActive: false, focusRequestId: 0 });

describe("ApplicationHost", () => {
  it("renders the Konqueror Start Page through the application registry", () => {
    const markup = renderToStaticMarkup(
      <ApplicationLauncherContext.Provider value={applicationLauncher}>
        <VfsProvider>
          <ApplicationHost desktopWindow={desktopWindow("konqueror")} />
        </VfsProvider>
      </ApplicationLauncherContext.Provider>,
    );

    expect(markup).toContain("Konqueror");
    expect(markup).toContain('value=""');
    expect(markup).toContain("Conquer your Desktop!");
  });

  it("passes launch requests to applications without parsing the intent", () => {
    const markup = renderToStaticMarkup(
      <ApplicationLauncherContext.Provider value={applicationLauncher}>
        <VfsProvider>
          <ApplicationRuntimeContext.Provider
            value={{
              getLaunchRequestForWindow: () => ({
                requestId: 1,
                intent: {
                  type: "open-special-location",
                  location: "trash",
                },
              }),
              getCloseRequestForWindow: () => null,
              requestWindowClose: () => undefined,
              commitWindowClose: () => undefined,
              cancelWindowClose: () => undefined,
            }}
          >
            <ApplicationHost desktopWindow={desktopWindow("konqueror")} />
          </ApplicationRuntimeContext.Provider>
        </VfsProvider>
      </ApplicationLauncherContext.Provider>,
    );

    expect(markup).toContain("value=\"trash:/\"");
  });

  it("renders distinct reusable About presentations through the application registry", () => {
    const kdeMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-kde")} />);
    const projectMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-die-nische")} />);
    const konquerorMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-konqueror")} />);
    const kcontrolMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-kcontrol")} />);
    const panelMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-kde-panel")} />);
    const kwriteMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-kwrite")} />);
    const konsoleMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-konsole")} />);
    const kcalcMarkup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("about-kcalc")} />);

    expect(kdeMarkup).toContain('data-about-identity="historical-kde"');
    expect(kdeMarkup).toContain("KDE 3");
    expect(kdeMarkup).toContain("historical recreation");
    expect(kdeMarkup).not.toContain('data-project-brand-mark="true"');
    expect(kdeMarkup).not.toContain('data-about-view="legal"');
    expect(kdeMarkup).not.toContain('data-about-view="licenses"');
    expect(projectMarkup).toContain("die Nische");
    expect(projectMarkup).toContain("A KDE 3-inspired web desktop.");
    expect(projectMarkup).toContain("not affiliated with");
    expect(projectMarkup).toContain("KDE e.V. or the KDE Community");
    expect(projectMarkup).toContain('data-project-brand-mark="true"');
    expect(projectMarkup).toContain('data-about-view="legal"');
    expect(projectMarkup).toContain('data-about-view="licenses"');
    expect(projectMarkup).toContain('src="/branding/die-nische-mark.svg"');
    expect(kdeMarkup).not.toContain("Konqueror / File Manager and Web Browser");
    expect(konquerorMarkup).toContain("Konqueror / File Manager and Web Browser");
    expect(konquerorMarkup).toContain("filesystem navigation, tabs, bookmarks");
    expect(konquerorMarkup).not.toContain('data-project-brand-mark="true"');
    expect(kcontrolMarkup).toContain("KDE Control Center");
    expect(kcontrolMarkup).toContain("central place to configure the die Nische appearance and desktop behavior");
    expect(panelMarkup).toContain("KDE Panel");
    expect(panelMarkup).toContain("Kicker taskbar, application launchers, virtual desktop pager");
    expect(kwriteMarkup).toContain("KWrite");
    expect(kwriteMarkup).toContain("Text Editor");
    expect(konsoleMarkup).toContain("Konsole");
    expect(konsoleMarkup).toContain("Terminal Emulator");
    expect(kcalcMarkup).toContain("KCalc");
    expect(kcalcMarkup).toContain("Basic Calculator");
  });

  it("renders Konsole through the application registry", () => {
    const markup = renderToStaticMarkup(
      <VfsProvider>
        <ApplicationHost desktopWindow={desktopWindow("konsole")} />
      </VfsProvider>,
    );

    expect(markup).toContain("Konsole");
    expect(markup).toContain("user@kde3:/home/user$");
  });

  it("renders KCalc through the application registry without a VFS provider", () => {
    const markup = renderToStaticMarkup(
      <WindowManagerContext.Provider value={windowManager}>
        <ApplicationHost desktopWindow={desktopWindow("kcalc")} />
      </WindowManagerContext.Provider>,
    );

    expect(markup).toContain("Calculator display");
    expect(markup).toContain("value=\"0\"");
  });

  it("renders KWrite through the application registry with its VFS-backed editor", () => {
    const markup = renderToStaticMarkup(
      <WindowManagerContext.Provider value={windowManager}>
        <ApplicationLauncherContext.Provider value={applicationLauncher}>
          <VfsProvider>
            <ApplicationHost desktopWindow={desktopWindow("kwrite")} />
          </VfsProvider>
        </ApplicationLauncherContext.Provider>
      </WindowManagerContext.Provider>,
    );

    expect(markup).toContain("data-kwrite-root=\"true\"");
    expect(markup).toContain("Untitled");
  });

  it("renders KDE Control Center through the registry without a VFS provider", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider>
        <ApplicationHost desktopWindow={desktopWindow("kcontrol")} />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("data-kcontrol-root=\"true\"");
    expect(markup).toContain("Configure your desktop environment.");
  });

  it("renders Configure the Panel through the registry without a VFS provider", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider>
        <ApplicationHost desktopWindow={desktopWindow("configure-panel")} />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("data-configure-panel-root=\"true\"");
    expect(markup).toContain("Show tasks from all desktops");
  });

  it("renders Configure - Clock through the registry without a VFS provider", () => {
    const markup = renderToStaticMarkup(
      <DesktopPreferencesProvider>
        <ApplicationHost desktopWindow={desktopWindow("configure-clock")} />
      </DesktopPreferencesProvider>,
    );

    expect(markup).toContain("data-configure-clock-root=\"true\"");
    expect(markup).toContain("Blinking dots");
  });

  it("renders KFind through the registry with its VFS-only query surface", () => {
    const markup = renderToStaticMarkup(
      <ApplicationLauncherContext.Provider value={applicationLauncher}>
        <VfsProvider>
          <ApplicationHost desktopWindow={desktopWindow("kfind")} />
        </VfsProvider>
      </ApplicationLauncherContext.Provider>,
    );

    expect(markup).toContain("data-kfind-root=\"true\"");
    expect(markup).toContain("Name/Location");
    expect(markup).toContain("aria-label=\"KFind results\"");
  });

  it("renders a controlled unknown application message", () => {
    const markup = renderToStaticMarkup(<ApplicationHost desktopWindow={desktopWindow("missing")} />);

    expect(markup).toContain("Unknown application: missing");
  });
});
