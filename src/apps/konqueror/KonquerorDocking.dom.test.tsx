// @vitest-environment jsdom
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

const homeLaunchRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: { type: "open-special-location", location: "home" },
};

let container: HTMLDivElement;
let reactRoot: Root;
let capturedPointerIds = new Set<number>();
let originalSetPointerCapture: PropertyDescriptor | undefined;
let originalReleasePointerCapture: PropertyDescriptor | undefined;
let originalHasPointerCapture: PropertyDescriptor | undefined;

const createDockFixtureState = (): VfsState => {
  const state = createInitialVfsState();
  const documents = state.nodesById["vfs-documents"];
  if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
  const html: VfsTextFileNode = {
    id: "vfs-dock-local-html",
    name: "Local.html",
    parentId: documents.id,
    kind: "file",
    encoding: "utf-8",
    mimeType: "text/html",
    content: { kind: "text", text: "<h1>Local HTML</h1>" },
    size: 19,
    createdAt: "2026-08-01T00:00:00.000Z",
    modifiedAt: "2026-08-01T00:00:00.000Z",
  };

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [documents.id]: { ...documents, childIds: [...documents.childIds, html.id] },
      [html.id]: html,
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

const renderKonqueror = (children: ReactNode, state = createDockFixtureState()) => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
        }}>
          <VfsContext.Provider value={createVfsContextValue(state)}>{children}</VfsContext.Provider>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

const rect = (left: number, top: number, right: number, bottom: number): DOMRect => ({
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
  top,
  right,
  bottom,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const dispatchPointer = (target: HTMLElement, type: string, pointerId: number, clientY: number, clientX = 20): void => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY, cancelable: true });
  Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: pointerId } });
  act(() => target.dispatchEvent(event));
};

const getApplication = (index = 0): HTMLElement => {
  const application = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!application) throw new Error("Missing Konqueror application");
  return application;
};

const getGrip = (application: HTMLElement, band: "toolbar" | "location"): HTMLElement => {
  const grip = application.querySelector<HTMLElement>(`[data-konqueror-dock-grip='${band}']`);
  if (!grip) throw new Error(`Missing ${band} dock grip`);
  return grip;
};

const drag = (application: HTMLElement, band: "toolbar" | "location", pointerId: number, startY: number, endY: number): void => {
  const grip = getGrip(application, band);
  dispatchPointer(grip, "pointerdown", pointerId, startY);
  dispatchPointer(grip, "pointermove", pointerId, endY);
  dispatchPointer(grip, "pointerup", pointerId, endY);
};

const setLocationDraft = (application: HTMLElement, value: string): HTMLInputElement => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  if (!input) throw new Error("Missing location input");
  act(() => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
};

const submitLocation = (application: HTMLElement): void => {
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");
  if (!form) throw new Error("Missing location form");
  act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
};

const submitLocationWithGo = (application: HTMLElement): void => {
  const go = application.querySelector<HTMLButtonElement>("button[aria-label='Go to location']");
  if (!go) throw new Error("Missing Go button");
  act(() => go.click());
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  capturedPointerIds = new Set();
  originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
  originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.add(pointerId),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.delete(pointerId),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.has(pointerId),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("konqueror-dock-area")) return rect(0, 0, 240, 60);
    if (this.dataset.konquerorDockSlot === "1") return rect(0, 0, 240, 30);
    if (this.dataset.konquerorDockSlot === "2") return rect(0, 30, 240, 60);
    return rect(0, 0, 0, 0);
  });
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
  if (originalSetPointerCapture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", originalSetPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  if (originalReleasePointerCapture) Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", originalReleasePointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
  if (originalHasPointerCapture) Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", originalHasPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture;
});

describe("Konqueror docking", () => {
  it("keeps real bands in committed DOM order across profile navigation and external lifecycle", () => {
    renderKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const application = getApplication();
    const dockArea = application.querySelector<HTMLElement>(".konqueror-dock-area");
    if (!dockArea) throw new Error("Missing DockArea");

    expect(dockArea.dataset.dockOrder).toBe("toolbar-location");
    expect(dockArea.querySelector("[data-konqueror-dock-slot='1'] .konqueror-toolbar")).not.toBeNull();
    drag(application, "toolbar", 1, 10, 45);
    expect(dockArea.dataset.dockOrder).toBe("location-toolbar");
    expect(dockArea.querySelector("[data-konqueror-dock-slot='1'] .konqueror-addressbar")).not.toBeNull();

    const up = application.querySelector<HTMLButtonElement>("button[aria-label='Up']");
    const home = application.querySelector<HTMLButtonElement>("button[aria-label='Home']");
    act(() => up?.click());
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home");
    act(() => home?.click());
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(dockArea.dataset.dockOrder).toBe("location-toolbar");

    setLocationDraft(application, "/home/user/Documents/Welcome.md");
    submitLocation(application);
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("document");
    expect(dockArea.dataset.dockOrder).toBe("location-toolbar");

    setLocationDraft(application, "/home/user/Documents/Local.html");
    submitLocation(application);
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    expect(dockArea.dataset.dockOrder).toBe("location-toolbar");

    setLocationDraft(application, "https://www.example.com/");
    submitLocation(application);
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("1");
    expect(dockArea.dataset.dockOrder).toBe("location-toolbar");

    drag(application, "toolbar", 5, 45, 10);
    expect(application.querySelector(".konqueror-external-web-view")?.getAttribute("data-external-load-generation")).toBe("1");
    expect(dockArea.dataset.dockOrder).toBe("toolbar-location");

    setLocationDraft(application, "about:konqueror");
    submitLocation(application);
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("web");
    expect(dockArea.dataset.dockOrder).toBe("toolbar-location");
  });

  it("preserves a focused Location draft through docking and keeps Enter and Go authoritative", () => {
    renderKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const application = getApplication();
    const draft = setLocationDraft(application, "https://www.example.com/");

    drag(application, "location", 2, 45, 10);
    expect(application.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("location-toolbar");
    expect(draft.value).toBe("https://www.example.com/");
    expect(document.activeElement).toBe(draft);
    expect(application.querySelector(".konqueror-external-web-view")).toBeNull();

    submitLocation(application);
    expect(application.querySelector<HTMLIFrameElement>(".konqueror-external-web-view__frame")?.src).toBe("https://www.example.com/");
    expect(application.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("location-toolbar");

    setLocationDraft(application, "/home/user");
    submitLocationWithGo(application);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
  });

  it("keeps a rejected Location draft focused and editable for Enter and Go retries", () => {
    renderKonqueror(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const application = getApplication();
    const input = setLocationDraft(application, "/home/user/aaa");

    submitLocation(application);
    expect(input.value).toBe("/home/user");
    expect(document.activeElement).toBe(input);

    setLocationDraft(application, "/home/user/b");
    expect(input.value).toBe("/home/user/b");

    setLocationDraft(application, "/home/user/aaa");
    submitLocationWithGo(application);
    expect(input.value).toBe("/home/user");
    expect(document.activeElement).toBe(input);

    setLocationDraft(application, "/home/user/Documents");
    expect(input.value).toBe("/home/user/Documents");
    submitLocation(application);
    expect(input.value).toBe("/home/user/Documents");
    expect(application.querySelector(".konqueror-directory-view")).not.toBeNull();
  });

  it("keeps dock order per Konqueror instance and leaves a new instance at the default", () => {
    renderKonqueror(
      <>
        <Konqueror windowId="konqueror-a" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
        <Konqueror windowId="konqueror-b" launchRequest={homeLaunchRequest} isActive={false} focusRequestId={0} />
        <Konqueror windowId="konqueror-c" launchRequest={homeLaunchRequest} isActive={false} focusRequestId={0} />
      </>,
    );
    const first = getApplication(0);
    const second = getApplication(1);
    const third = getApplication(2);

    drag(first, "toolbar", 3, 10, 45);
    expect(first.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("location-toolbar");
    expect(second.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("toolbar-location");
    expect(third.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("toolbar-location");

    drag(second, "location", 4, 45, 10);
    expect(first.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("location-toolbar");
    expect(second.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("location-toolbar");
    expect(third.querySelector(".konqueror-dock-area")?.getAttribute("data-dock-order")).toBe("toolbar-location");
  });
});
