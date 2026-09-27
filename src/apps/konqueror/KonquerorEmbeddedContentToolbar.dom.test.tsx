// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { StrictMode, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsState, VfsTextFileNode } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";
import { KonquerorPrintProvider } from "./KonquerorPrintContext";

let container: HTMLDivElement;
let reactRoot: Root;

const createContentFixtureState = (): VfsState => {
  const state = createInitialVfsState();
  const documents = state.nodesById["vfs-documents"];
  if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");

  const createTextNode = (id: string, name: string, mimeType: string, content: string): VfsTextFileNode => ({
    id,
    name,
    parentId: documents.id,
    kind: "file",
    encoding: "utf-8",
    mimeType,
    content: { kind: "text", text: content },
    size: content.length,
    createdAt: "2026-08-01T00:00:00.000Z",
    modifiedAt: "2026-08-01T00:00:00.000Z",
  });
  const html = createTextNode("vfs-local-html", "Local.html", "text/html", "<h1>Local HTML</h1><script>alert(1)</script>");
  const markdown = createTextNode("vfs-readme-md", "Readme.md", "text/markdown", "# Rendered Markdown\n\nContent");

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [documents.id]: { ...documents, childIds: [...documents.childIds, html.id, markdown.id] },
      [html.id]: html,
      [markdown.id]: markdown,
    },
  };
};

const createVfsContextValue = (state: VfsState): VfsContextValue => ({
  state,
  ...createVfsOperations(
    () => state,
    () => undefined,
  ),
});

const renderKonqueror = (children: ReactNode, state = createContentFixtureState()) => {
  reactRoot.render(
    <StrictMode>
      <ApplicationLauncherContext.Provider value={{
        launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
        launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
      }}>
        <VfsContext.Provider value={createVfsContextValue(state)}>
          <KonquerorPrintProvider>{children}</KonquerorPrintProvider>
        </VfsContext.Provider>
      </ApplicationLauncherContext.Provider>
    </StrictMode>,
  );
};

const navigate = (application: HTMLElement, value: string): void => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");
  if (!input || !form) throw new Error("Missing Konqueror location controls");

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

const navigateWithGo = (application: HTMLElement, value: string): void => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const goButton = application.querySelector<HTMLButtonElement>("button[aria-label='Go to location']");
  if (!input || !goButton) throw new Error("Missing Konqueror location controls");

  act(() => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
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

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
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

describe("Konqueror embedded content toolbar", () => {
  it("uses the shared Go submission authority from local KHTML without constraining the next location type", () => {
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");

    navigate(application, "/home/user/Documents/Local.html");
    expect(application.querySelector(".konqueror-preview-document--khtml")).not.toBeNull();

    navigateWithGo(application, "https://www.example.com/");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
    expect(application.querySelector(".konqueror-external-web-view__frame")).not.toBeNull();
    expect(application.textContent).not.toContain("Enter an absolute VFS path.");
  });

  it("enables Security only for owned Web content and presents local/about information without TLS claims", () => {
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");

    const security = application.querySelector<HTMLButtonElement>("button[aria-label='Security']");
    expect(security?.disabled).toBe(false);
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();
    click(security);
    expect(application.querySelector(".konqueror-security-dialog")?.textContent).toContain("about:konqueror");
    expect(application.querySelector(".konqueror-security-dialog")?.textContent).toContain("Internal Konqueror page");
    click(application.querySelector("button[aria-label='Close KDE SSL Information']"));

    navigate(application, "/home/user/Documents/Local.html");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();
    click(application.querySelector("button[aria-label='Security']"));
    expect(application.querySelector(".konqueror-security-dialog")?.textContent).toContain("file:///home/user/Documents/Local.html");
    expect(application.querySelector(".konqueror-security-dialog")?.textContent).toContain("Local file");
    expect(application.querySelector(".konqueror-security-dialog")?.textContent).not.toContain("Certificate Information");
    click(application.querySelector("button[aria-label='Close KDE SSL Information']"));

    navigate(application, "/home/user/Documents/Readme.md");
    expect(application.querySelector("button[aria-label='Security']")).toBeNull();
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();
  });

  it("keeps Security dialogs owned by their exact Konqueror instances", () => {
    act(() => {
      renderKonqueror(
        <>
          <Konqueror windowId="konqueror-security-a" isActive focusRequestId={1} />
          <Konqueror windowId="konqueror-security-b" isActive focusRequestId={1} />
        </>,
      );
    });
    const [first, second] = Array.from(container.querySelectorAll<HTMLElement>(".konqueror-application"));
    if (!first || !second) throw new Error("Missing Konqueror applications");

    navigate(first, "https://example.com/");
    navigate(second, "/home/user/Documents/Local.html");
    click(first.querySelector("button[aria-label='Security']"));
    click(second.querySelector("button[aria-label='Security']"));

    expect(first.querySelector(".konqueror-security-dialog")?.textContent).toContain("example.com");
    expect(second.querySelector(".konqueror-security-dialog")?.textContent).toContain("file:///home/user/Documents/Local.html");
    click(first.querySelector("button[aria-label='Close KDE SSL Information']"));
    expect(first.querySelector(".konqueror-security-dialog")).toBeNull();
    expect(second.querySelector(".konqueror-security-dialog")).not.toBeNull();
  });

  it("uses VFS Home from all five primary content modes without conflating their toolbar profiles", () => {
    const onSetWindowTitle = vi.fn();
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} onSetWindowTitle={onSetWindowTitle} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");

    expect(application.textContent).toContain("Home Folder");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Home']")?.disabled).toBe(false);
    click(application.querySelector("button[aria-label='Zoom In']"));
    click(application.querySelector("button[aria-label='Zoom In']"));
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("user - Konqueror");
    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector(".konqueror-start-page[data-content-zoom='125']")).not.toBeNull();
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");
    click(application.querySelector("button[aria-label='Forward']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");

    navigate(application, "/home/user/Documents");
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");

    navigate(application, "/home/user/Documents/Local.html");
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Local.html");

    navigate(application, "/home/user/Documents/Readme.md");
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Readme.md");

    navigate(application, "/home/user/Documents/Welcome.md");
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Welcome.md");

    navigate(application, "https://www.example.com/");
    click(application.querySelector("button[aria-label='Home']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
  });

  it("keeps Internal Web and Document zoom independent across content navigation", () => {
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");

    expect(application.querySelector(".konqueror-start-page[data-content-zoom='100']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(false);
    click(application.querySelector("button[aria-label='Zoom In']"));
    click(application.querySelector("button[aria-label='Zoom In']"));
    click(application.querySelector("button[aria-label='Zoom In']"));
    expect(application.querySelector(".konqueror-start-page[data-content-zoom='150']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(true);

    navigate(application, "/home/user/Documents/Local.html");
    expect(application.querySelector(".konqueror-preview-document--khtml[data-content-zoom='150']")).not.toBeNull();
    expect(application.querySelector("script")).toBeNull();
    click(application.querySelector("button[aria-label='Reload']"));
    expect(application.querySelector(".konqueror-preview-document--khtml[data-content-zoom='150']")).not.toBeNull();

    navigate(application, "/home/user/Documents/Readme.md");
    expect(application.querySelector(".konqueror-preview-document--markdown[data-content-zoom='100']")).not.toBeNull();
    click(application.querySelector("button[aria-label='Zoom Out']"));
    expect(application.querySelector(".konqueror-preview-document--markdown[data-content-zoom='90']")).not.toBeNull();

    navigate(application, "/home/user/Documents/Welcome.md");
    expect(application.querySelector(".konqueror-preview-document--markdown[data-content-zoom='90']")).not.toBeNull();
    navigate(application, "/home/user/Documents/Local.html");
    expect(application.querySelector(".konqueror-preview-document--khtml[data-content-zoom='150']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
  });

  it("preserves owned history, profiles, and independent presentation state across the final five content modes", () => {
    const onSetWindowTitle = vi.fn();
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} onSetWindowTitle={onSetWindowTitle} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");

    // Start Page -> Resource -> Text -> local KHTML -> external HTTPS -> Resource.
    expect(application.querySelector(".konqueror-start-page[data-content-zoom='100']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Home']")?.disabled).toBe(false);

    navigate(application, "/home/user");
    click(application.querySelector("button[aria-label='Zoom Out']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");

    navigate(application, "/home/user/Documents/Welcome.md");
    click(application.querySelector("button[aria-label='Zoom Out']"));
    expect(application.querySelector(".konqueror-preview-document--markdown[data-content-zoom='90']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("document");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(false);

    navigate(application, "/home/user/Documents/Local.html");
    click(application.querySelector("button[aria-label='Zoom In']"));
    click(application.querySelector("button[aria-label='Zoom In']"));
    expect(application.querySelector(".konqueror-preview-document--khtml[data-content-zoom='125']")).not.toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(false);

    navigate(application, "https://www.example.com/");
    click(application.querySelector("button[aria-label='Zoom Out']"));
    const externalFrame = application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame");
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("90");
    expect(externalFrame?.getAttribute("sandbox")).toBe("allow-forms allow-scripts");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    expect(onSetWindowTitle).toHaveBeenLastCalledWith("www.example.com - Konqueror");

    navigate(application, "/home/user/Documents");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();

    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("https://www.example.com/");
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("90");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(true);

    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector(".konqueror-preview-document--khtml[data-content-zoom='125']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");

    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector(".konqueror-preview-document--markdown[data-content-zoom='90']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("document");

    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();

    click(application.querySelector("button[aria-label='Back']"));
    expect(application.querySelector(".konqueror-start-page[data-content-zoom='125']")).not.toBeNull();
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");

    click(application.querySelector("button[aria-label='Forward']"));
    click(application.querySelector("button[aria-label='Forward']"));
    click(application.querySelector("button[aria-label='Forward']"));
    click(application.querySelector("button[aria-label='Forward']"));
    click(application.querySelector("button[aria-label='Forward']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents");
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
  });

  it("keeps external HTTPS Print disabled while routing Zoom through the parent-owned iframe viewport", () => {
    act(() => {
      renderKonqueror(<Konqueror isActive focusRequestId={1} />);
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Missing Konqueror application");
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    navigate(application, "https://www.example.com/");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom In']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Zoom Out']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(true);
    expect(application.querySelector("button[aria-label='Download']")).toBeNull();
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Security']")?.disabled).toBe(false);
    click(application.querySelector("button[aria-label='Zoom In']"));
    expect(application.querySelector(".konqueror-external-web-view__viewport")?.getAttribute("data-external-web-zoom")).toBe("110");
    expect(application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame")?.style.transform).toBe("scale(1.1)");
    click(application.querySelector("button[aria-label='Print']"));
    expect(print).not.toHaveBeenCalled();
  });

  it("prints only the clicked Konqueror embedded target once and clears after the native lifecycle", () => {
    const state = createContentFixtureState();
    const htmlRequest: ApplicationLaunchRequest = {
      requestId: 1,
      intent: { type: "open-file", nodeId: "vfs-local-html", previewerId: "khtml" },
    };
    const markdownRequest: ApplicationLaunchRequest = {
      requestId: 2,
      intent: { type: "open-file", nodeId: "vfs-readme-md", previewerId: "markdown" },
    };

    act(() => {
      renderKonqueror(
        <>
          <Konqueror windowId="konqueror-html" launchRequest={htmlRequest} isActive focusRequestId={1} />
          <Konqueror windowId="konqueror-markdown" launchRequest={markdownRequest} isActive={false} focusRequestId={0} />
        </>,
        state,
      );
    });
    const applications = container.querySelectorAll<HTMLElement>(".konqueror-application");
    const printSurface = container.querySelector<HTMLElement>(".konqueror-print-surface");
    const first = applications[0];
    const second = applications[1];
    if (!first || !second || !printSurface) throw new Error("Missing Konqueror instances or print surface");
    expect(first.contains(printSurface)).toBe(false);
    expect(second.contains(printSurface)).toBe(false);
    expect(printSurface.parentElement).toBe(container);
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      if (print.mock.calls.length === 1) {
        expect(printSurface.dataset.printRequestId).toBe("1");
        expect(printSurface.dataset.printWindowId).toBe("konqueror-html");
        expect(printSurface.textContent).toContain("Local HTML");
        expect(printSurface.textContent).not.toContain("Rendered Markdown");
      } else {
        expect(printSurface.dataset.printRequestId).toBe("2");
        expect(printSurface.dataset.printWindowId).toBe("konqueror-markdown");
        expect(printSurface.textContent).toContain("Rendered Markdown");
        expect(printSurface.textContent).not.toContain("Local HTML");
      }
    });

    click(first.querySelector("button[aria-label='Print']"));
    click(first.querySelector("button[aria-label='Print']"));
    expect(print).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(printSurface.dataset.printRequestId).toBeUndefined();

    click(second.querySelector("button[aria-label='Print']"));
    expect(print).toHaveBeenCalledTimes(2);
    expect(printSurface.dataset.printRequestId).toBe("2");
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(printSurface.dataset.printRequestId).toBeUndefined();
  });

  it("keeps print isolation in CSS without replacing the desktop DOM or applying transform scaling", () => {
    const source = readFileSync("src/theme/kde3.css", "utf8");
    const applicationSource = readFileSync("src/apps/konqueror/Konqueror.tsx", "utf8");

    expect(source).toContain("@media print");
    expect(source).toContain(".konqueror-print-surface[data-print-request-id]");
    expect(source).toContain("html,\n  body,\n  #root");
    expect(source).toContain(".desktop-shell {\n    display: none !important;");
    expect(source).not.toContain(".konqueror-application[data-konqueror-print-target]");
    expect(source).toContain("white-space: pre-wrap");
    expect(source).toContain("overflow-wrap: anywhere");
    expect(source).toContain("zoom: 1 !important");
    expect(source).not.toContain("transform: scale(");
    expect(applicationSource).not.toContain("window.print()");
    expect(applicationSource).not.toContain("document.body.innerHTML");
    expect(applicationSource).not.toContain("window.open(");
  });
});
