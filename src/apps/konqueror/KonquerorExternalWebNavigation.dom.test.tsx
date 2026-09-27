// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;

const createVfsContextValue = (): VfsContextValue => {
  const state = createInitialVfsState();
  return {
    state,
    ...createVfsOperations(
      () => state,
      () => undefined,
    ),
  };
};

const renderKonqueror = (children: React.ReactNode): void => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
        }}>
          <VfsContext.Provider value={createVfsContextValue()}>{children}</VfsContext.Provider>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const navigate = (application: HTMLElement, value: string): void => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");

  if (!input || !form) {
    throw new Error("Missing Konqueror location bar");
  }

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

const navigateWithGo = (application: HTMLElement, value: string): void => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const goButton = application.querySelector<HTMLButtonElement>("button[aria-label='Go to location']");

  if (!input || !goButton) {
    throw new Error("Missing Konqueror location controls");
  }

  act(() => {
    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  act(() => {
    goButton.dispatchEvent(mouseDown);
    if (!mouseDown.defaultPrevented) {
      input.blur();
    }
  });
  act(() => goButton.click());
};

const click = (application: HTMLElement, label: string): void => {
  const button = application.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`);

  if (!button) {
    throw new Error(`Missing ${label} button`);
  }

  act(() => button.click());
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konqueror external web navigation", () => {
  it("commits an HTTPS address-bar submission to the embedded external-web host", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://www.example.com/");

    const input = application.querySelector<HTMLInputElement>("#konqueror-location");
    const iframe = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    const stop = application.querySelector<HTMLButtonElement>("button[aria-label='Stop']");
    if (!input || !stop) {
      throw new Error("Missing external navigation controls");
    }

    expect(iframe?.getAttribute("src")).toBe("https://www.example.com/");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-forms allow-scripts");
    expect(input.value).toBe("https://www.example.com/");
    expect(document.activeElement).toBe(iframe);
    expect(application.querySelector(".konqueror-addressbar")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    expect(application.querySelector("button[aria-label='Security']")).not.toBeNull();
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    expect(stop.disabled).toBe(false);
    expect(application.textContent).toContain("Loading...");

    act(() => iframe?.dispatchEvent(new ErrorEvent("error", { bubbles: true })));
    expect(application.querySelector(".konqueror-external-web-view__frame")).toBe(iframe);
    expect(application.textContent).toContain("Loading...");
    expect(application.textContent).not.toContain("Unable to load page.");

    click(application, "Security");
    const securityDialog = application.querySelector<HTMLElement>(".konqueror-security-dialog");
    expect(securityDialog?.textContent).toContain("KDE SSL Information - Konqueror");
    expect(securityDialog?.textContent).toContain("https://www.example.com/");
    expect(securityDialog?.textContent).toContain("Protocol:");
    expect(securityDialog?.textContent).toContain("www.example.com");
    expect(securityDialog?.textContent).toContain("443");
    expect(securityDialog?.textContent).toContain("Loading");
    expect(securityDialog?.textContent).toContain("Detailed certificate information is unavailable in this web version of Konqueror.");
    click(application, "Close KDE SSL Information");
    expect(application.querySelector(".konqueror-security-dialog")).toBeNull();
  });

  it("submits the visible draft through Go across location kinds without a blur reset", () => {
    const onSetWindowTitle = vi.fn();
    renderKonqueror(<Konqueror isActive focusRequestId={1} onSetWindowTitle={onSetWindowTitle} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigateWithGo(application, "https://www.example.com/");
    expect(application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame")?.src).toBe("https://www.example.com/");
    expect(application.textContent).not.toContain("Enter an absolute VFS path.");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");

    navigateWithGo(application, "https://example.org/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.org/");
    expect(application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame")?.src).toBe("https://example.org/");
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("example.org - Konqueror");
    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");

    navigateWithGo(application, "/home/user");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");

    navigateWithGo(application, "/home");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home");
    navigate(application, "/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Up']")?.disabled).toBe(true);

    navigate(application, "/home");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home");
    navigateWithGo(application, "/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/");

    navigateWithGo(application, "https://example.net/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.net/");
    expect(application.textContent).not.toContain("Enter an absolute VFS path.");
    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/");

    navigateWithGo(application, "about:konqueror");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    navigateWithGo(application, "example.net");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.net/");

    navigateWithGo(application, "/home/user/Documents/Welcome.md");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("document");
    navigateWithGo(application, "https://example.com/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");

    const generationBeforeSameSubmit = application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation");
    navigateWithGo(application, "https://example.com/");
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe(
      String(Number(generationBeforeSameSubmit) + 1),
    );
    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Welcome.md");

    navigateWithGo(application, "hello world");
    expect(application.textContent).toContain("Location error: Enter an absolute VFS path.");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Welcome.md");
  });

  it("gives Enter and Go the same external target, profile, and owned request generation", () => {
    renderKonqueror(
      <>
        <Konqueror windowId="konqueror-enter" isActive focusRequestId={1} />
        <Konqueror windowId="konqueror-go" isActive={false} focusRequestId={0} />
      </>,
    );
    const [enterApplication, goApplication] = Array.from(container.querySelectorAll<HTMLElement>(".konqueror-application"));
    if (!enterApplication || !goApplication) throw new Error("Missing Konqueror applications");

    navigate(enterApplication, "https://www.example.com/");
    navigateWithGo(goApplication, "https://www.example.com/");

    [enterApplication, goApplication].forEach((application) => {
      expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
      expect(application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame")?.src).toBe("https://www.example.com/");
      expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
      expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("1");
    });
  });

  it("keeps Back, Forward, URL Up, and VFS Home on Konqueror-owned targets", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://example.com/a/b/");
    click(application, "Up");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/a/");

    click(application, "Up");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Up']")?.disabled).toBe(true);

    click(application, "Home");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");

    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/");
    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/a/");
    click(application, "Forward");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://example.com/");
  });

  it("uses Home for an external stopped request and invalidates its stale completion", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://www.example.com/");
    const staleFrame = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    click(application, "Stop");
    click(application, "Home");

    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    act(() => staleFrame?.dispatchEvent(new Event("load", { bubbles: true })));
    expect(application.textContent).not.toContain("Page loaded.");

    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
  });

  it("uses Home for a pending external request before its load completion", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://example.org/");
    const staleFrame = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    click(application, "Home");

    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    act(() => staleFrame?.dispatchEvent(new Event("load", { bubbles: true })));
    expect(application.textContent).not.toContain("Page loaded.");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Stop']")?.disabled).toBe(true);
  });

  it("reloads the exact owned URL without a history entry and stops only its pending iframe", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://www.example.com/");
    const firstFrame = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    expect(firstFrame).not.toBeNull();
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("1");

    act(() => firstFrame?.dispatchEvent(new Event("load", { bubbles: true })));
    expect(application.textContent).toContain("Page loaded.");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Stop']")?.disabled).toBe(true);

    click(application, "Reload");
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("2");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");

    click(application, "Stop");
    expect(application.querySelector(".konqueror-external-web-view__frame")).toBeNull();
    expect(application.textContent).toContain("Loading stopped.");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");

    click(application, "Reload");
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("3");
    navigate(application, "https://www.example.com/");
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("4");

    click(application, "Back");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");
  });

  it("keeps parent-side external zoom across Reload, Stop, and owned navigation", () => {
    renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    const application = container.querySelector<HTMLElement>(".konqueror-application");

    if (!application) {
      throw new Error("Missing Konqueror application");
    }

    navigate(application, "https://www.example.com/");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom Out']")?.disabled).toBe(false);
    click(application, "Zoom In");
    click(application, "Zoom In");

    const zoomedViewport = application.querySelector<HTMLElement>(".konqueror-external-web-view__viewport");
    const zoomedFrame = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    expect(zoomedViewport?.getAttribute("data-external-web-zoom")).toBe("125");
    expect(zoomedFrame?.style.width).toBe("80%");
    expect(zoomedFrame?.style.height).toBe("80%");
    expect(zoomedFrame?.style.transform).toBe("scale(1.25)");
    expect(zoomedFrame?.style.transformOrigin).toBe("top left");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Cut']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Copy']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Paste']")?.disabled).toBe(true);
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();

    click(application, "Reload");
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("2");
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("125");
    click(application, "Stop");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(true);
    click(application, "Reload");
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("125");
    click(application, "Home");
    click(application, "Back");
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("125");
  });

  it("keeps external load generations, Stop state, and viewport zoom isolated between Konqueror instances", () => {
    renderKonqueror(
      <>
        <Konqueror windowId="konqueror-a" isActive focusRequestId={1} />
        <Konqueror windowId="konqueror-b" isActive focusRequestId={1} />
        <Konqueror windowId="konqueror-c" isActive focusRequestId={1} />
      </>,
    );
    const [first, second, third] = Array.from(container.querySelectorAll<HTMLElement>(".konqueror-application"));

    if (!first || !second || !third) {
      throw new Error("Missing Konqueror applications");
    }

    navigate(first, "https://example.com/");
    navigate(second, "https://example.org/");
    navigate(third, "https://example.net/");
    const secondFrame = second.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    act(() => secondFrame?.dispatchEvent(new Event("load", { bubbles: true })));
    click(first, "Zoom Out");
    click(first, "Zoom Out");
    click(second, "Zoom In");
    click(second, "Zoom In");
    click(second, "Zoom In");

    click(first, "Stop");
    expect(first.textContent).toContain("Loading stopped.");
    expect(second.textContent).toContain("Page loaded.");
    expect(third.textContent).toContain("Loading...");
    expect(first.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(true);
    expect(second.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("150");
    expect(second.querySelector<HTMLButtonElement>("button[aria-label='Stop']")?.disabled).toBe(true);

    click(second, "Reload");
    expect(second.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("2");
    expect(second.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("150");
    expect(first.querySelector(".konqueror-external-web-view__frame")).toBeNull();
    expect(third.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("100");
  });
});
