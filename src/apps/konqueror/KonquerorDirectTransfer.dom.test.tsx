// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { VfsProvider } from "../../vfs/VfsProvider";
import { VfsContext } from "../../vfs/VfsContext";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { Konqueror } from "./Konqueror";
import { KonquerorFileUndoProvider } from "./KonquerorFileUndoContext";

const homeRequest: ApplicationLaunchRequest = { requestId: 1, intent: { type: "open-special-location", location: "home" } };
const downloadsRequest: ApplicationLaunchRequest = { requestId: 2, intent: { type: "open-directory", nodeId: "vfs-downloads" } };
let container: HTMLDivElement;
let reactRoot: Root;

const SharedVfs = ({ children }: { readonly children: ReactNode }) => (
  <VfsProvider><KonquerorFileUndoProvider>{children}</KonquerorFileUndoProvider></VfsProvider>
);

function VfsFixture({ initialState, children }: { readonly initialState: VfsState; readonly children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);

  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const createBackgroundTransferFixture = () => {
  const current = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Current Folder", { now: "2026-09-09T00:00:00.000Z" });
  if (!current.ok) throw new Error("Current directory fixture failed");
  const selectedChild = createVfsTextFile(current.state, "/home/user/Documents/Current Folder", "Selected.txt", "selected", { now: "2026-09-09T00:00:00.000Z" });
  if (!selectedChild.ok) throw new Error("Selected child fixture failed");
  const other = createVfsDirectory(selectedChild.state, "/home/user", "Other Folder", { now: "2026-09-09T00:00:00.000Z" });
  if (!other.ok) throw new Error("Other directory fixture failed");
  const destination = createVfsDirectory(other.state, "/home/user", "Destination", { now: "2026-09-09T00:00:00.000Z" });
  if (!destination.ok) throw new Error("Destination directory fixture failed");
  return {
    state: destination.state,
    currentId: current.value.id,
    otherId: other.value.id,
    destinationId: destination.value.id,
  };
};

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};
const appAt = (index: number) => {
  const app = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!app) throw new Error("Missing Konqueror");
  return app;
};
const findNode = (application: HTMLElement, label: string) => {
  const text = [...application.querySelectorAll<HTMLElement>(".konqueror-tree-label, .konqueror-icon-item__label")]
    .find((candidate) => candidate.textContent === label);
  const node = text?.closest<HTMLButtonElement>("[data-konqueror-node-id]");
  if (!node) throw new Error(`Missing ${label}`);
  return node;
};
const openEdit = (application: HTMLElement) => {
  const menu = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menubar button")]
    .find((button) => button.textContent === "Edit");
  click(menu ?? null);
};
const menuAction = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
  .find((button) => button.textContent === label) ?? null;
const openBackgroundMenu = (application: HTMLElement) => {
  const surface = application.querySelector<HTMLElement>(".konqueror-directory-view");
  if (!surface) throw new Error("Missing directory surface");
  act(() => surface.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 46,
  })));
};
const openDetailCellBackgroundMenu = (node: HTMLButtonElement) => {
  const detail = node.querySelector<HTMLElement>(".konqueror-directory-cell:not(.konqueror-directory-cell--name)");
  if (!detail) throw new Error("Missing directory detail cell");
  act(() => detail.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 42,
    clientY: 48,
  })));
};
const cancelDestination = (application: HTMLElement) => {
  const cancel = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")]
    .find((button) => button.textContent === "Cancel") ?? null;
  click(cancel);
};
const submitDestination = (application: HTMLElement, destination: string) => {
  const input = application.querySelector<HTMLInputElement>(".konqueror-dialog-input");
  const form = application.querySelector<HTMLFormElement>(".konqueror-input-dialog form");
  if (!input || !form) throw new Error("Missing destination dialog");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, destination);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
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

describe("Konqueror Edit Copy Files / Move Files", () => {
  it("opens a window-owned destination dialog only for a selection and copies directly through shared VFS", () => {
    act(() => reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <SharedVfs>
            <Konqueror windowId="source" launchRequest={homeRequest} isActive focusRequestId={1} />
            <Konqueror windowId="observer" launchRequest={downloadsRequest} isActive={false} focusRequestId={0} />
          </SharedVfs>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    ));
    const source = appAt(0);
    const observer = appAt(1);
    openEdit(source);
    expect(menuAction("Copy Files")?.disabled).toBe(true);
    expect(menuAction("Move Files")?.disabled).toBe(true);
    openEdit(source);

    click(source.querySelector("[aria-label='Expand Documents']"));
    click(findNode(source, "Notes.txt"));
    openEdit(source);
    expect(menuAction("Copy Files")?.disabled).toBe(false);
    click(menuAction("Copy Files"));
    expect(source.querySelector(".konqueror-input-dialog")?.textContent).toContain("Copy Files");
    expect(source.querySelector<HTMLInputElement>(".konqueror-dialog-input")?.value).toBe("/home/user");
    submitDestination(source, "/home/user/Downloads");

    expect(source.querySelector(".konqueror-input-dialog")).toBeNull();
    openEdit(observer);
    expect(menuAction("Undo")?.disabled).toBe(false);
    click(menuAction("Undo"));
    expect([...observer.querySelectorAll(".konqueror-tree-label, .konqueror-icon-item__label")].some((node) => node.textContent === "Notes.txt")).toBe(false);
    expect(findNode(source, "Notes.txt").getAttribute("aria-selected")).toBe("true");
  });

  it("keeps invalid destinations in the dialog and Move clears the source selection after success", () => {
    act(() => reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <SharedVfs><Konqueror windowId="source" launchRequest={homeRequest} isActive focusRequestId={1} /></SharedVfs>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    ));
    const source = appAt(0);
    click(source.querySelector("[aria-label='Expand Documents']"));
    click(findNode(source, "Welcome.md"));
    openEdit(source);
    click(menuAction("Move Files"));
    submitDestination(source, "/home/user/Documents/Welcome.md");
    expect(source.querySelector(".konqueror-dialog-error")?.textContent).toContain("not a folder");
    submitDestination(source, "/home/user/Downloads");
    expect(source.querySelector(".konqueror-input-dialog")).toBeNull();
    expect(source.querySelector("[data-konqueror-node-id='vfs-content-76cff3ce17d8a853403179f1']")).toBeNull();
  });

  it("copies the invoking current directory from the background menu rather than a selected child", () => {
    const fixture = createBackgroundTransferFixture();
    act(() => reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <VfsFixture initialState={fixture.state}>
            <Konqueror windowId="source" launchRequest={{ requestId: 3, intent: { type: "open-directory", nodeId: fixture.currentId } }} isActive focusRequestId={1} />
            <Konqueror windowId="observer" launchRequest={{ requestId: 4, intent: { type: "open-directory", nodeId: fixture.destinationId } }} isActive={false} focusRequestId={0} />
          </VfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    ));
    const source = appAt(0);
    const observer = appAt(1);
    const sourceLocation = source.querySelector<HTMLInputElement>("#konqueror-location");

    const selectedChild = findNode(source, "Selected.txt");
    click(selectedChild);
    openDetailCellBackgroundMenu(selectedChild);
    expect(source.querySelector(".konqueror-directory-row.is-selected")).toBeNull();
    expect(menuAction("Copy To")?.disabled).toBe(false);
    click(menuAction("Copy To"));
    submitDestination(source, "/home/user/Destination");

    expect(sourceLocation?.value).toBe("/home/user/Documents/Current Folder");
    expect(findNode(observer, "Current Folder")).toBeTruthy();
    expect([...observer.querySelectorAll("[data-konqueror-node-id]")].some((node) => node.textContent === "Selected.txt")).toBe(false);
  });

  it("moves the invoking current directory to its exact new path and leaves cancellation side-effect free", () => {
    const fixture = createBackgroundTransferFixture();
    act(() => reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <VfsFixture initialState={fixture.state}>
            <Konqueror windowId="source" launchRequest={{ requestId: 3, intent: { type: "open-directory", nodeId: fixture.currentId } }} isActive focusRequestId={1} />
            <Konqueror windowId="observer" launchRequest={{ requestId: 4, intent: { type: "open-directory", nodeId: fixture.destinationId } }} isActive={false} focusRequestId={0} />
          </VfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    ));
    const source = appAt(0);
    const observer = appAt(1);
    const sourceLocation = source.querySelector<HTMLInputElement>("#konqueror-location");

    openBackgroundMenu(source);
    click(menuAction("Copy To"));
    cancelDestination(source);
    openBackgroundMenu(source);
    click(menuAction("Move To"));
    cancelDestination(source);
    expect(sourceLocation?.value).toBe("/home/user/Documents/Current Folder");
    expect([...observer.querySelectorAll("[data-konqueror-node-id]")].some((node) => node.textContent === "Current Folder")).toBe(false);

    openBackgroundMenu(source);
    click(menuAction("Move To"));
    submitDestination(source, "/home/user/Destination");

    expect(sourceLocation?.value).toBe("/home/user/Destination/Current Folder");
    expect(findNode(observer, "Current Folder")).toBeTruthy();
  });

  it("uses the context menu owner as the current-directory transfer source across Konqueror instances", () => {
    const fixture = createBackgroundTransferFixture();
    act(() => reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
          <VfsFixture initialState={fixture.state}>
            <Konqueror windowId="first" launchRequest={{ requestId: 3, intent: { type: "open-directory", nodeId: fixture.currentId } }} isActive focusRequestId={1} />
            <Konqueror windowId="second" launchRequest={{ requestId: 4, intent: { type: "open-directory", nodeId: fixture.otherId } }} isActive={false} focusRequestId={0} />
            <Konqueror windowId="observer" launchRequest={{ requestId: 5, intent: { type: "open-directory", nodeId: fixture.destinationId } }} isActive={false} focusRequestId={0} />
          </VfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    ));
    const first = appAt(0);
    const second = appAt(1);
    const observer = appAt(2);
    const firstLocation = first.querySelector<HTMLInputElement>("#konqueror-location");
    const secondLocation = second.querySelector<HTMLInputElement>("#konqueror-location");

    openBackgroundMenu(second);
    click(menuAction("Copy To"));
    submitDestination(second, "/home/user/Destination");

    expect(firstLocation?.value).toBe("/home/user/Documents/Current Folder");
    expect(secondLocation?.value).toBe("/home/user/Other Folder");
    expect(findNode(observer, "Other Folder")).toBeTruthy();
    expect([...observer.querySelectorAll("[data-konqueror-node-id]")].some((node) => node.textContent === "Current Folder")).toBe(false);
  });
});
