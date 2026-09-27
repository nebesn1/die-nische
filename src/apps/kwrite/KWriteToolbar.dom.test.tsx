// @vitest-environment jsdom
import { act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { DesktopSessionContext, type DesktopSessionContextValue } from "../../desktop/desktopSessionContext";
import { VfsContext } from "../../vfs/VfsContext";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { KonquerorPrintContext } from "../konqueror/konquerorPrintContext";
import { KWriteRecentFilesContext } from "./KWriteRecentFilesContext";
import { KWrite } from "./KWrite";
import { createKWriteOpenTextFileIntent } from "./launchIntent";

let container: HTMLDivElement;
let reactRoot: Root;

const clipboardSession = (clipboardText: string | null = null): DesktopSessionContextValue => ({
  isLocked: false,
  endSessionDialog: "closed",
  isClipboardOpen: false,
  clipboardHistory: [],
  currentClipboardText: clipboardText,
  hasClipboardText: clipboardText !== null,
  clipboardStatus: null,
  selectionCaptureGeneration: 0,
  resetGeneration: 0,
  lockSession: vi.fn(), unlockSession: vi.fn(), openEndSession: vi.fn(), requestEndSession: vi.fn(), returnToEndSessionOptions: vi.fn(), closeEndSession: vi.fn(), confirmEndSession: vi.fn(), toggleClipboard: vi.fn(), closeClipboard: vi.fn(), recordClipboardText: vi.fn(), readClipboardText: () => clipboardText, writeClipboard: vi.fn(async () => undefined), clearClipboardHistory: vi.fn(),
});

function VfsFixture({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<VfsState>(createInitialVfsState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

function Fixture({ children, printRequest = vi.fn() }: { readonly children: ReactNode; readonly printRequest?: ReturnType<typeof vi.fn> }) {
  return <KonquerorPrintContext.Provider value={{ requestPrint: printRequest }}>
    <DesktopSessionContext.Provider value={clipboardSession("clipboard")}>
      <KWriteRecentFilesContext.Provider value={{ recentFiles: [], addRecentFile: vi.fn() }}>
        <VfsFixture>{children}</VfsFixture>
      </KWriteRecentFilesContext.Provider>
    </DesktopSessionContext.Provider>
  </KonquerorPrintContext.Provider>;
}

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const setInput = (input: HTMLInputElement, value: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const setEditorText = (editor: HTMLTextAreaElement, value: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(editor, value);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const appAt = (index = 0): HTMLElement => {
  const app = container.querySelectorAll<HTMLElement>("[data-kwrite-root='true']")[index];
  if (!app) throw new Error("KWrite missing");
  return app;
};

const toolbarButton = (app: HTMLElement, label: string) => app.querySelector<HTMLButtonElement>(`.kwrite-toolbar button[aria-label='${label}']`);
const topMenu = (app: HTMLElement, label: string) => [...app.querySelectorAll<HTMLButtonElement>(".kwrite-menubar > .kwrite-menu-root > button")].find((button) => button.textContent === label) ?? null;
const menuAction = (app: HTMLElement, label: string) => [...app.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((button) => button.textContent === label) ?? null;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("KWrite main toolbar", () => {
  it("renders the exact KDE3 toolbar order, separators, and simplified Edit menu", () => {
    act(() => reactRoot.render(<Fixture><KWrite /></Fixture>));
    const app = appAt();
    const toolbar = app.querySelector(".kwrite-toolbar");
    expect(toolbar).not.toBeNull();
    expect([...toolbar!.children].map((child) => child.classList.contains("toolbar-grip") ? "grip" : child.classList.contains("toolbar-separator") ? "|" : child.getAttribute("aria-label"))).toEqual([
      "grip", "New Window", "Open", "|", "Save", "Save As", "|", "Print", "|", "Close", "|", "Undo", "Redo", "Cut", "Copy", "Paste", "|", "Find", "|", "Increase Font Size", "Decrease Font Size",
    ]);

    click(topMenu(app, "Edit"));
    const editMenu = app.querySelector("[aria-label='Edit menu']");
    expect([...editMenu!.querySelectorAll<HTMLButtonElement>("button")].map((button) => button.textContent)).toEqual([
      "Undo", "Redo", "Cut", "Copy", "Paste", "Select All", "Deselect", "Go to Line...",
    ]);
    expect(editMenu?.textContent).not.toContain("Find");
    expect(editMenu?.textContent).not.toContain("Replace");
    expect(toolbarButton(app, "Find")?.querySelector("[data-toolbar-icon='find']")).not.toBeNull();
    expect(toolbarButton(app, "Increase Font Size")?.querySelector("[data-toolbar-icon='font-bigger']")).not.toBeNull();
    expect(toolbarButton(app, "Decrease Font Size")?.querySelector("[data-toolbar-icon='font-smaller']")).not.toBeNull();
  });

  it("marks toolbar actions with stable ids for the shared mobile presentation", () => {
    act(() => reactRoot.render(<Fixture><KWrite /></Fixture>));
    const app = appAt();
    const actions = [...app.querySelectorAll<HTMLButtonElement>(".kwrite-toolbar [data-kwrite-action]")];

    expect(actions.map((button) => button.dataset.kwriteAction)).toEqual([
      "new-window",
      "open",
      "save",
      "save-as",
      "print",
      "close",
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "find",
      "increase-font",
      "decrease-font",
    ]);
  });

  it("routes the exact Help order to Runtime About windows without an inline KWrite panel", () => {
    const launchApplication = vi.fn((): LaunchApplicationResult => "opened");
    act(() => reactRoot.render(
      <ApplicationLauncherContext.Provider value={{ launchApplication, launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "opened") }}>
        <Fixture><KWrite /></Fixture>
      </ApplicationLauncherContext.Provider>,
    ));
    const app = appAt();

    click(topMenu(app, "Help"));
    const helpMenu = app.querySelector("[aria-label='Help menu']");
    expect([...helpMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []].map((button) => button.textContent)).toEqual(["About KWrite", "About KDE"]);
    click(menuAction(app, "About KWrite"));
    expect(launchApplication).toHaveBeenCalledWith("about-kwrite");
    expect(app.querySelector(".kwrite-about")).toBeNull();
    setEditorText(app.querySelector<HTMLTextAreaElement>("textarea")!, "still editable");
    expect(app.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("still editable");

    click(topMenu(app, "Help"));
    click(menuAction(app, "About KDE"));
    expect(launchApplication).toHaveBeenCalledWith("about-kde");
  });

  it("routes toolbar New Window, Open, Print, and Close through the existing command boundaries", () => {
    const launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
    const requestPrint = vi.fn();
    act(() => reactRoot.render(<ApplicationLauncherContext.Provider value={{ launchApplication: vi.fn((): LaunchApplicationResult => "already-active"), launchNewApplicationInstance }}><Fixture printRequest={requestPrint}><KWrite windowId="kwrite-toolbar" launchRequest={{ requestId: 1, intent: createKWriteOpenTextFileIntent("vfs-content-e594a065214576326cb903a5") }} /></Fixture></ApplicationLauncherContext.Provider>));
    const app = appAt();

    click(toolbarButton(app, "New Window"));
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("kwrite");
    click(toolbarButton(app, "Open"));
    expect([...app.querySelectorAll(".kwrite-dialog h2")].some((heading) => heading.textContent === "Open File")).toBe(true);
    click([...app.querySelectorAll<HTMLButtonElement>(".kwrite-dialog-button")].find((button) => button.textContent === "Cancel") ?? null);
    click(toolbarButton(app, "Print"));
    expect(requestPrint).toHaveBeenCalledWith("kwrite-toolbar", {
      kind: "text",
      title: "Notes.txt",
      content: expect.stringContaining("Notes.txt lives only"),
    });
    click(toolbarButton(app, "Close"));
    expect(app.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
    expect(app.textContent).toContain("Untitled - no backing file");
  });

  it("shares editor history and clipboard availability with the toolbar actions", () => {
    act(() => reactRoot.render(<Fixture><KWrite /></Fixture>));
    const app = appAt();
    const editor = app.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(toolbarButton(app, "Undo")?.disabled).toBe(true);
    expect(toolbarButton(app, "Redo")?.disabled).toBe(true);
    expect(toolbarButton(app, "Paste")?.disabled).toBe(false);
    setEditorText(editor, "draft");
    expect(toolbarButton(app, "Undo")?.disabled).toBe(false);
    click(toolbarButton(app, "Undo"));
    expect(editor.value).toBe("");
    expect(toolbarButton(app, "Redo")?.disabled).toBe(false);
    click(toolbarButton(app, "Redo"));
    expect(editor.value).toBe("draft");
    click(toolbarButton(app, "Paste"));
    expect(editor.value).toBe("clipboarddraft");
  });

  it("keeps compact Find modeless while editing live text, then repeats forward and wraps", () => {
    act(() => reactRoot.render(<Fixture><KWrite /><KWrite /></Fixture>));
    const first = appAt(0);
    const second = appAt(1);
    const firstEditor = first.querySelector<HTMLTextAreaElement>("textarea")!;
    setEditorText(firstEditor, "one two one");

    click(toolbarButton(first, "Find"));
    const firstDialog = first.querySelector("[aria-label='Find Text - KWrite']")!;
    expect(firstDialog.querySelector("fieldset")).toBeNull();
    expect(firstDialog.getAttribute("aria-modal")).toBeNull();
    expect(first.querySelector(".kwrite-dialog-backdrop")).toBeNull();
    expect(first.querySelector("main")?.getAttribute("aria-hidden")).toBe("false");
    const firstInput = firstDialog.querySelector<HTMLInputElement>("input")!;
    setInput(firstInput, "one");
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(firstEditor.selectionStart).toBe(0);
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(firstEditor.selectionStart).toBe(8);
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(firstEditor.selectionStart).toBe(0);
    setEditorText(firstEditor, "one test two one");
    expect(first.querySelector("[aria-label='Find Text - KWrite']")).not.toBeNull();
    setInput(firstInput, "test");
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(firstEditor.selectionStart).toBe(4);
    expect(second.querySelector("[aria-label='Find Text - KWrite']")).toBeNull();
  });

  it("keeps Find queries isolated per KWrite and closes only its own surface", () => {
    act(() => reactRoot.render(<Fixture><KWrite /><KWrite /></Fixture>));
    const first = appAt(0);
    const second = appAt(1);
    const firstEditor = first.querySelector<HTMLTextAreaElement>("textarea")!;
    const secondEditor = second.querySelector<HTMLTextAreaElement>("textarea")!;
    setEditorText(firstEditor, "alpha");
    setEditorText(secondEditor, "beta");
    click(toolbarButton(first, "Find"));
    click(toolbarButton(second, "Find"));
    const firstDialog = first.querySelector("[aria-label='Find Text - KWrite']")!;
    const secondDialog = second.querySelector("[aria-label='Find Text - KWrite']")!;
    setInput(firstDialog.querySelector<HTMLInputElement>("input")!, "alpha");
    setInput(secondDialog.querySelector<HTMLInputElement>("input")!, "beta");
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    click([...secondDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(firstEditor.selectionStart).toBe(0);
    expect(secondEditor.selectionStart).toBe(0);
    click([...firstDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Close") ?? null);
    expect(first.querySelector("[aria-label='Find Text - KWrite']")).toBeNull();
    expect(second.querySelector("[aria-label='Find Text - KWrite']")).not.toBeNull();
    expect(firstEditor.value).toBe("alpha");
  });

  it("retains modeless Find across document replacement and removes it with its owner", () => {
    function ClosableKWrite() {
      const [isOpen, setIsOpen] = useState(true);
      return isOpen ? <KWrite onRequestClose={() => setIsOpen(false)} /> : null;
    }

    act(() => reactRoot.render(<Fixture><ClosableKWrite /></Fixture>));
    const app = appAt();
    click(toolbarButton(app, "Find"));
    click(topMenu(app, "File"));
    click(menuAction(app, "Close"));
    const editor = app.querySelector<HTMLTextAreaElement>("textarea")!;
    setEditorText(editor, "new document text");
    const findDialog = app.querySelector("[aria-label='Find Text - KWrite']")!;
    setInput(findDialog.querySelector<HTMLInputElement>("input")!, "text");
    click([...findDialog.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Find") ?? null);
    expect(editor.selectionStart).toBe(13);
    click(topMenu(app, "File"));
    click(menuAction(app, "Quit"));
    expect(container.querySelector("[data-kwrite-root='true']")).toBeNull();
    expect(container.querySelector("[aria-label='Find Text - KWrite']")).toBeNull();
  });

  it("keeps font size local, bounded, and separate from document content", () => {
    act(() => reactRoot.render(<Fixture><KWrite /><KWrite /></Fixture>));
    const first = appAt(0);
    const second = appAt(1);
    const firstEditor = first.querySelector<HTMLTextAreaElement>("textarea")!;
    const secondEditor = second.querySelector<HTMLTextAreaElement>("textarea")!;
    setEditorText(firstEditor, "unchanged");
    const historyText = firstEditor.value;
    expect(firstEditor.style.fontSize).toBe("13px");
    click(toolbarButton(first, "Increase Font Size"));
    expect(firstEditor.style.fontSize).toBe("14px");
    expect(secondEditor.style.fontSize).toBe("13px");
    expect(firstEditor.value).toBe(historyText);
    for (let count = 0; count < 18; count += 1) click(toolbarButton(first, "Increase Font Size"));
    expect(firstEditor.style.fontSize).toBe("32px");
    expect(toolbarButton(first, "Increase Font Size")?.disabled).toBe(true);
    for (let count = 0; count < 24; count += 1) click(toolbarButton(first, "Decrease Font Size"));
    expect(firstEditor.style.fontSize).toBe("8px");
    expect(toolbarButton(first, "Decrease Font Size")?.disabled).toBe(true);
    expect(firstEditor.value).toBe(historyText);
  });
});
