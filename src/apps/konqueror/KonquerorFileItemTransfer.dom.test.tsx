// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { VfsContext } from "../../vfs/VfsContext";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;

function VfsFixture({ initialState, children }: { readonly initialState: VfsState; readonly children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const createFixture = () => {
  const backup = createVfsDirectory(createInitialVfsState(), "/home/user", "Backup", { now: "2026-09-10T00:00:00.000Z" });
  if (!backup.ok) throw new Error("Backup fixture failed");
  return { state: backup.state, backupId: backup.value.id };
};

const launchers = {
  launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
  launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened"),
};

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const ctrlClick = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true })));
};

const applicationAt = (index: number) => {
  const application = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!application) throw new Error("Konqueror missing");
  return application;
};

const findNode = (application: HTMLElement, label: string) => {
  const node = [...application.querySelectorAll<HTMLElement>(".konqueror-tree-label, .konqueror-icon-item__label")]
    .find((candidate) => candidate.textContent === label)
    ?.closest<HTMLButtonElement>("[data-konqueror-node-id]");
  if (!node) throw new Error(`Missing ${label}`);
  return node;
};

const menuAction = (label: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((button) => button.textContent === label) ?? null;

const menuLabels = () => [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
  .map((button) => button.textContent ?? "");

const openItemContextMenu = (node: HTMLElement) => {
  const target = node.querySelector<HTMLElement>(".konqueror-directory-item-hit-target") ?? node;
  act(() => target.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 48,
    clientY: 52,
  })));
};

const submitDestination = (application: HTMLElement, destination: string) => {
  const input = application.querySelector<HTMLInputElement>(".konqueror-dialog-input");
  const form = application.querySelector<HTMLFormElement>(".konqueror-input-dialog form");
  if (!input || !form) throw new Error("Destination dialog missing");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, destination);
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

describe("Konqueror file-item Copy To / Move To", () => {
  it("uses the exact KDE3 file-item order and exposes its Open With and Preview In submenus", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="files" launchRequest={{ requestId: 1, intent: { type: "open-directory", nodeId: "vfs-documents" } }} isActive focusRequestId={1} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const files = applicationAt(0);

    openItemContextMenu(findNode(files, "Notes.txt"));
    expect(menuLabels()).toEqual([
      "Open in New Window", "Open in New Tab", "Cut", "Copy", "Rename", "Move to Trash",
      "Open With▶", "Preview In▶", "Copy To", "Move To", "Properties",
    ]);
    expect(menuAction("Open")).toBeNull();
    expect(menuAction("Open with")).toBeNull();
    expect(menuAction("Preview in")).toBeNull();
    click(menuAction("Open With▶"));
    expect(menuAction("KWrite")).not.toBeNull();
  });

  it("freezes the clicked file instead of the selected group when copying from Tree View", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="files" launchRequest={{ requestId: 1, intent: { type: "open-directory", nodeId: "vfs-documents" } }} isActive focusRequestId={1} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const files = applicationAt(0);
    const observer = applicationAt(1);
    const welcome = findNode(files, "Welcome.md");
    const notes = findNode(files, "Notes.txt");

    click(welcome);
    ctrlClick(notes);
    openItemContextMenu(notes);
    click(menuAction("Copy To"));
    submitDestination(files, "/home/user/Backup");

    expect(files.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents");
    expect(findNode(observer, "Notes.txt")).toBeTruthy();
    expect(() => findNode(observer, "Welcome.md")).toThrow();
  });

  it("moves only the clicked file without following it away from the current directory", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="files" launchRequest={{ requestId: 1, intent: { type: "open-directory", nodeId: "vfs-documents" } }} isActive focusRequestId={1} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const files = applicationAt(0);
    const observer = applicationAt(1);

    openItemContextMenu(findNode(files, "Notes.txt"));
    click(menuAction("Move To"));
    submitDestination(files, "/home/user/Backup");

    expect(files.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents");
    expect(() => findNode(files, "Notes.txt")).toThrow();
    expect(findNode(observer, "Notes.txt")).toBeTruthy();
  });

  it("routes the same file-item menu through Icon View and the invoking Konqueror instance", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="first" launchRequest={{ requestId: 1, intent: { type: "open-directory", nodeId: "vfs-home" } }} isActive focusRequestId={1} />
          <Konqueror windowId="second" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: "vfs-documents" } }} isActive={false} focusRequestId={0} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 3, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const first = applicationAt(0);
    const second = applicationAt(1);
    const observer = applicationAt(2);

    click(second.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    openItemContextMenu(findNode(second, "Notes.txt"));
    expect(menuLabels()).toEqual([
      "Open in New Window", "Open in New Tab", "Cut", "Copy", "Rename", "Move to Trash",
      "Open With▶", "Preview In▶", "Copy To", "Move To", "Properties",
    ]);
    click(menuAction("Copy To"));
    submitDestination(second, "/home/user/Backup");

    expect(first.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home");
    expect(second.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents");
    expect(findNode(observer, "Notes.txt")).toBeTruthy();
  });
});
