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

const openFileContentMenu = (application: HTMLElement) => {
  const preview = application.querySelector<HTMLElement>(".konqueror-file-view, .konqueror-preview-document");
  if (!preview) throw new Error("File preview missing");
  act(() => preview.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 48,
    clientY: 52,
  })));
};

const cancelDestination = (application: HTMLElement) => {
  click([...application.querySelectorAll<HTMLButtonElement>(".konqueror-dialog-button")]
    .find((button) => button.textContent === "Cancel") ?? null);
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

const navigate = (application: HTMLElement, location: string) => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");
  if (!input || !form) throw new Error("Location bar missing");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, location);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

const openLocationNewTab = (application: HTMLElement) => {
  click([...application.querySelectorAll<HTMLButtonElement>(".konqueror-menubar button")]
    .find((button) => button.textContent === "Location") ?? null);
  click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((button) => button.textContent === "New Tab") ?? null);
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

describe("Konqueror file-content Copy To / Move To", () => {
  it("shows only the existing Open With submenu followed by Copy To and Move To", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="preview" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" } }} isActive focusRequestId={1} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const preview = applicationAt(0);

    openFileContentMenu(preview);
    expect([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].map((entry) => entry.textContent)).toEqual([
      "Open With▶", "Copy To", "Move To",
    ]);
    expect(menuAction("Open")).toBeNull();
    expect(menuAction("Open in New Window")).toBeNull();
    expect(menuAction("Open in New Tab")).toBeNull();
    expect(menuAction("Preview in")).toBeNull();
    expect(menuAction("Open with")).toBeNull();
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((entry) => entry.textContent === "Open With▶") ?? null);
    expect(menuAction("KWrite")).not.toBeNull();
  });

  it("copies the current file without navigation and leaves cancellation side-effect free", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="preview" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" } }} isActive focusRequestId={1} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const preview = applicationAt(0);
    const observer = applicationAt(1);
    const location = preview.querySelector<HTMLInputElement>("#konqueror-location");

    openFileContentMenu(preview);
    click(menuAction("Copy To"));
    cancelDestination(preview);
    expect(location?.value).toBe("/home/user/Documents/Welcome.md");
    expect(() => findNode(observer, "Welcome.md")).toThrow();

    openFileContentMenu(preview);
    click(menuAction("Copy To"));
    submitDestination(preview, "/home/user/Backup");
    expect(location?.value).toBe("/home/user/Documents/Welcome.md");
    expect(preview.querySelector(".konqueror-preview-document--markdown")?.textContent).toContain("Welcome to die Nische");
    expect(findNode(observer, "Welcome.md")).toBeTruthy();
  });

  it("moves the stable current file ID and recovers the invoking preview at its new location", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="preview" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" } }} isActive focusRequestId={1} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const preview = applicationAt(0);
    const observer = applicationAt(1);
    const location = preview.querySelector<HTMLInputElement>("#konqueror-location");

    openFileContentMenu(preview);
    click(menuAction("Move To"));
    expect(preview.querySelector<HTMLInputElement>(".konqueror-dialog-input")?.value).toBe("/home/user/Documents");
    cancelDestination(preview);
    expect(location?.value).toBe("/home/user/Documents/Welcome.md");

    openFileContentMenu(preview);
    click(menuAction("Move To"));
    submitDestination(preview, "/home/user/Backup");

    expect(location?.value).toBe("/home/user/Backup/Welcome.md");
    expect(preview.querySelector(".konqueror-preview-document--markdown")?.textContent).toContain("Welcome to die Nische");
    expect(findNode(observer, "Welcome.md")).toBeTruthy();
    openFileContentMenu(preview);
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((entry) => entry.textContent === "Open With▶") ?? null);
    expect(menuAction("KWrite")).not.toBeNull();
  });

  it("uses the invoking Konqueror instance's current file without touching another instance", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="first" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" } }} isActive focusRequestId={1} />
          <Konqueror windowId="second" launchRequest={{ requestId: 2, intent: { type: "open-file", nodeId: "vfs-content-e594a065214576326cb903a5" } }} isActive={false} focusRequestId={0} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 3, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const first = applicationAt(0);
    const second = applicationAt(1);
    const observer = applicationAt(2);
    const firstLocation = first.querySelector<HTMLInputElement>("#konqueror-location");
    const secondLocation = second.querySelector<HTMLInputElement>("#konqueror-location");

    openFileContentMenu(second);
    click(menuAction("Copy To"));
    submitDestination(second, "/home/user/Backup");

    expect(firstLocation?.value).toBe("/home/user/Documents/Welcome.md");
    expect(secondLocation?.value).toBe("/home/user/Documents/Notes.txt");
    expect(findNode(observer, "Notes.txt")).toBeTruthy();
    expect(() => findNode(observer, "Welcome.md")).toThrow();

    navigate(second, "/home/user/Documents/Welcome.md");
    expect(secondLocation?.value).toBe("/home/user/Documents/Welcome.md");
  });

  it("uses the active tab's current file and preserves its inactive file tab", () => {
    const fixture = createFixture();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture initialState={fixture.state}>
          <Konqueror windowId="tabs" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: "vfs-content-76cff3ce17d8a853403179f1" } }} isActive focusRequestId={1} />
          <Konqueror windowId="observer" launchRequest={{ requestId: 2, intent: { type: "open-directory", nodeId: fixture.backupId } }} isActive={false} focusRequestId={0} />
        </VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const tabs = applicationAt(0);
    const observer = applicationAt(1);

    openLocationNewTab(tabs);
    navigate(tabs, "/home/user/Documents/Notes.txt");
    expect(tabs.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Notes.txt");
    openFileContentMenu(tabs);
    click(menuAction("Copy To"));
    submitDestination(tabs, "/home/user/Backup");

    expect(findNode(observer, "Notes.txt")).toBeTruthy();
    click(tabs.querySelector("[data-konqueror-tab-id='tab-1']"));
    expect(tabs.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Welcome.md");
  });
});
