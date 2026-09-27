// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsState } from "../../vfs/types";
import { VfsContext } from "../../vfs/VfsContext";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;

function VfsFixture({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<VfsState>(createInitialVfsState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);

  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const launchers = {
  launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
  launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
};

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const applicationAt = (index: number) => {
  const application = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!application) throw new Error("Konqueror missing");
  return application;
};

const menuButton = (application: HTMLElement, label: string) =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")]
    .find((button) => button.textContent === label) ?? null;

const menuItem = (label: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem'], button[role='menuitemcheckbox']")]
    .find((button) => button.querySelector<HTMLElement>(".konqueror-menu-label")?.textContent === label) ?? null;

const openToolbarsMenu = (application: HTMLElement) => {
  click(menuButton(application, "Settings"));
  click(menuItem("Toolbars"));
};

const toggleToolbar = (application: HTMLElement, label: string) => {
  openToolbarsMenu(application);
  click(menuItem(label));
};

const openLocationNewTab = (application: HTMLElement) => {
  click(menuButton(application, "Location"));
  click(menuItem("New Tab"));
};

const menuCheckboxes = () =>
  [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitemcheckbox']")];

const findNode = (application: HTMLElement, label: string) => {
  const node = [...application.querySelectorAll<HTMLElement>(".konqueror-tree-label, .konqueror-icon-item__label")]
    .find((candidate) => candidate.textContent === label)
    ?.closest<HTMLButtonElement>("[data-konqueror-node-id]");
  if (!node) throw new Error(`Missing ${label}`);
  return node;
};

const expectHomeSeparatedFromReload = (application: HTMLElement) => {
  const toolbar = application.querySelector(".konqueror-toolbar");
  const home = toolbar?.querySelector<HTMLButtonElement>('button[aria-label="Home"]');
  const reload = toolbar?.querySelector<HTMLButtonElement>('button[aria-label="Reload"]');
  const homeGroup = home?.parentElement;

  expect(homeGroup?.querySelector(":scope > .toolbar-separator")?.classList.contains("toolbar-separator")).toBe(true);
  expect(homeGroup?.nextElementSibling).toBe(reload?.parentElement);
};

const openNode = (node: HTMLElement) => {
  act(() => node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konqueror Settings Toolbars", () => {
  it("renders the exact checked Toolbars submenu in its KDE3 order", () => {
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="toolbars" launchRequest={{ requestId: 1, intent: { type: "open-special-location", location: "home" } }} isActive focusRequestId={1} /></VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const application = applicationAt(0);

    openToolbarsMenu(application);

    const checkboxes = menuCheckboxes();
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.map((item) => item.querySelector(".konqueror-menu-label")?.textContent)).toEqual([
      "Main Toolbar (Konqueror)",
      "Location Toolbar (Konqueror)",
    ]);
    expect(checkboxes.map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "true"]);
    expect(checkboxes.map((item) => item.querySelector(".konqueror-menu-shortcut"))).toEqual([null, null]);
  });

  it("hides each dock band without a placeholder and restores the matching checkbox state", () => {
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="toolbars" launchRequest={{ requestId: 1, intent: { type: "open-special-location", location: "home" } }} isActive focusRequestId={1} /></VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const application = applicationAt(0);

    toggleToolbar(application, "Main Toolbar (Konqueror)");
    expect(application.querySelector(".konqueror-toolbar")).toBeNull();
    expect(application.querySelector(".konqueror-addressbar")).not.toBeNull();
    expect(application.querySelectorAll(".konqueror-dock-slot")).toHaveLength(1);

    openToolbarsMenu(application);
    expect(menuCheckboxes().map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    click(menuItem("Location Toolbar (Konqueror)"));
    expect(application.querySelector(".konqueror-toolbar")).toBeNull();
    expect(application.querySelector(".konqueror-addressbar")).toBeNull();
    expect(application.querySelectorAll(".konqueror-dock-slot")).toHaveLength(0);
    expect(application.querySelector(".konqueror-content")).not.toBeNull();
    expect(application.querySelector(".konqueror-statusbar")).not.toBeNull();

    openToolbarsMenu(application);
    expect(menuCheckboxes().map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "false"]);
    click(menuItem("Main Toolbar (Konqueror)"));
    expect(application.querySelector(".konqueror-toolbar")).not.toBeNull();
    expectHomeSeparatedFromReload(application);
    expect(application.querySelector(".konqueror-addressbar")).toBeNull();
  });

  it("keeps location visibility across tab switches and uses the active tab's navigation state when shown again", () => {
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="toolbars" launchRequest={{ requestId: 1, intent: { type: "open-special-location", location: "home" } }} isActive focusRequestId={1} /></VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const application = applicationAt(0);

    toggleToolbar(application, "Location Toolbar (Konqueror)");
    expect(application.querySelector(".konqueror-addressbar")).toBeNull();
    openLocationNewTab(application);
    expect(application.querySelector(".konqueror-addressbar")).toBeNull();
    click(application.querySelector("[data-konqueror-tab-id='tab-1']"));
    openNode(findNode(application, "Documents"));
    expect(application.querySelector(".konqueror-addressbar")).toBeNull();

    click(application.querySelector("[data-konqueror-tab-id='tab-2']"));
    toggleToolbar(application, "Location Toolbar (Konqueror)");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");
    toggleToolbar(application, "Location Toolbar (Konqueror)");
    click(application.querySelector("[data-konqueror-tab-id='tab-1']"));
    toggleToolbar(application, "Location Toolbar (Konqueror)");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents");
  });

  it("keeps toolbar visibility instance-local across Konqueror windows", () => {
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture>
          <Konqueror windowId="first" launchRequest={{ requestId: 1, intent: { type: "open-special-location", location: "home" } }} isActive focusRequestId={1} />
          <Konqueror windowId="second" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: "vfs-documents" } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const first = applicationAt(0);
    const second = applicationAt(1);

    toggleToolbar(first, "Main Toolbar (Konqueror)");
    toggleToolbar(first, "Location Toolbar (Konqueror)");
    expect(first.querySelector(".konqueror-toolbar")).toBeNull();
    expect(first.querySelector(".konqueror-addressbar")).toBeNull();
    expect(second.querySelector(".konqueror-toolbar")).not.toBeNull();
    expect(second.querySelector(".konqueror-addressbar")).not.toBeNull();

    openToolbarsMenu(second);
    expect(menuCheckboxes().map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "true"]);
  });
});
