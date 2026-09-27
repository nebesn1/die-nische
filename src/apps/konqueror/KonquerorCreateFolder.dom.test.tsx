// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";

const homeLaunchRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: { type: "open-special-location", location: "home" },
};

let container: HTMLDivElement;
let reactRoot: Root;

const SharedVfsFixture = ({ children }: { readonly children: ReactNode }) => {
  const [state, setState] = useState(createInitialVfsState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);

  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
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

const getApplications = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(".konqueror-application")];

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const ctrlClick = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true })));
};

const openItemMenu = (element: HTMLElement): void => {
  const target = element.querySelector<HTMLElement>(".konqueror-directory-item-hit-target") ?? element;
  act(() => target.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 24,
    clientY: 28,
  })));
};

const openBackgroundMenu = (element: HTMLElement): void => {
  act(() => element.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 46,
  })));
};

const findNode = (application: HTMLElement, name: string): HTMLButtonElement => {
  const label = [...application.querySelectorAll<HTMLElement>(".konqueror-tree-label, .konqueror-icon-item__label")]
    .find((candidate) => candidate.textContent === name);
  const node = label?.closest<HTMLButtonElement>("[data-konqueror-node-id]") ?? null;
  if (!node) throw new Error(`Missing ${name}`);
  return node;
};

const submitFolderName = (application: HTMLElement, name: string): void => {
  const input = application.querySelector<HTMLInputElement>(".konqueror-dialog-input");
  const form = application.querySelector<HTMLFormElement>(".konqueror-input-dialog form");
  if (!input || !form) throw new Error("Create Folder dialog missing");

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

const renderKonquerors = (children: ReactNode) => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
        }}>
          <SharedVfsFixture>{children}</SharedVfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

describe("Konqueror folder item Create Folder", () => {
  it("reuses the current-directory creation dialogs through Create New", () => {
    renderKonquerors(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const [application] = getApplications();
    if (!application) throw new Error("Konqueror missing");
    const directory = application.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!directory) throw new Error("Directory view missing");

    openBackgroundMenu(directory);
    click(container.querySelector<HTMLButtonElement>("button[data-submenu-id='create-new']"));
    const createNew = container.querySelector<HTMLElement>("[aria-label='Create New submenu']");
    const createEntries = [...createNew?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []];
    expect(createEntries.map((item) => item.textContent)).toEqual(["Folder", "Text File"]);
    expect(createNew?.querySelectorAll("[role='separator']")).toHaveLength(1);

    click(createEntries.find((item) => item.textContent === "Folder") ?? null);
    submitFolderName(application, "Background Folder");
    expect(findNode(application, "Background Folder")).toBeInstanceOf(HTMLButtonElement);

    openBackgroundMenu(directory);
    click(container.querySelector<HTMLButtonElement>("button[data-submenu-id='create-new']"));
    const textFile = [...container.querySelectorAll<HTMLButtonElement>("[aria-label='Create New submenu'] button[role='menuitem']")]
      .find((item) => item.textContent === "Text File");
    click(textFile ?? null);
    expect(application.querySelector(".konqueror-input-dialog")?.textContent).toContain("Create New Text File");
  });

  it("creates only under the clicked expanded Tree folder while preserving a selected group", () => {
    renderKonquerors(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const [application] = getApplications();
    if (!application) throw new Error("Konqueror missing");
    const desktop = findNode(application, "Desktop");
    const documents = findNode(application, "Documents");
    const downloads = findNode(application, "Downloads");

    click(desktop);
    ctrlClick(documents);
    ctrlClick(downloads);
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    openItemMenu(documents);

    const menuItems = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")];
    const createFolder = menuItems.find((item) => item.textContent === "Create Folder");
    expect(menuItems.map((item) => item.textContent)).toContain("Open in New Window");
    click(createFolder ?? null);
    submitFolderName(application, "Child");

    const child = findNode(application, "Child");
    expect(child.getAttribute("data-tree-depth")).toBe("1");
    expect(application.querySelector("[aria-label='Expand Child']")).not.toBeNull();
    expect(findNode(application, "Desktop").getAttribute("aria-selected")).toBe("true");
    expect(findNode(application, "Documents").getAttribute("aria-selected")).toBe("true");
    expect(findNode(application, "Downloads").getAttribute("aria-selected")).toBe("true");
    expect(child.getAttribute("aria-selected")).toBe("false");
    expect(application.querySelector("#konqueror-location")?.getAttribute("value")).toBe("/home/user");

    openItemMenu(findNode(application, "Documents"));
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((item) => item.textContent === "Create Folder") ?? null);
    submitFolderName(application, "Child");
    expect(application.querySelector(".konqueror-input-dialog")).not.toBeNull();
    expect(application.querySelector(".konqueror-dialog-error")?.textContent).toBe("An item with this name already exists.");
  });

  it("works from Icon View and publishes only to viewers of the clicked collapsed folder", () => {
    renderKonquerors(
      <>
        <Konqueror windowId="source" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
        <Konqueror
          windowId="observer"
          launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: "vfs-documents" } }}
          isActive={false}
          focusRequestId={0}
        />
      </>,
    );
    const [source, observer] = getApplications();
    if (!source || !observer) throw new Error("Konqueror fixtures missing");

    click(source.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    const documents = findNode(source, "Documents");
    openItemMenu(documents);
    const menuItems = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")];
    click(menuItems.find((item) => item.textContent === "Create Folder") ?? null);
    submitFolderName(source, "Shared Child");

    expect(source.querySelector("[data-konqueror-node-id]")?.textContent).not.toBe("Shared Child");
    expect(findNode(observer, "Shared Child")).toBeInstanceOf(HTMLButtonElement);
  });

  it("keeps a clicked Tree folder collapsed while another window sees the new child", () => {
    renderKonquerors(
      <>
        <Konqueror windowId="source" launchRequest={homeLaunchRequest} isActive focusRequestId={1} />
        <Konqueror
          windowId="observer"
          launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: "vfs-documents" } }}
          isActive={false}
          focusRequestId={0}
        />
      </>,
    );
    const [source, observer] = getApplications();
    if (!source || !observer) throw new Error("Konqueror fixtures missing");

    openItemMenu(findNode(source, "Documents"));
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((item) => item.textContent === "Create Folder") ?? null);
    submitFolderName(source, "Collapsed Child");

    expect(source.querySelector("[aria-label='Expand Documents']")).not.toBeNull();
    expect([...source.querySelectorAll(".konqueror-tree-label")]
      .some((label) => label.textContent === "Collapsed Child")).toBe(false);
    expect(findNode(observer, "Collapsed Child")).toBeInstanceOf(HTMLButtonElement);
    click(source.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    expect(findNode(source, "Collapsed Child").getAttribute("data-tree-depth")).toBe("1");
  });

  it("does not expose Create Folder for file item requests", () => {
    renderKonquerors(<Konqueror launchRequest={homeLaunchRequest} isActive focusRequestId={1} />);
    const [application] = getApplications();
    if (!application) throw new Error("Konqueror missing");
    click(application.querySelector<HTMLElement>("[aria-label='Expand Documents']"));
    openItemMenu(findNode(application, "Notes.txt"));
    expect([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .map((item) => item.textContent)).not.toContain("Create Folder");
  });
});
