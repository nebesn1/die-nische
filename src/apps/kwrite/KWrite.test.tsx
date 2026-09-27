import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VfsProvider } from "../../vfs/VfsProvider";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KWrite } from "./KWrite";
import { createKWriteOpenTextFileIntent } from "./launchIntent";

const windowManager: WindowManagerContextValue = {
  windows: [],
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 600, titleBarHeight: 22 },
  activateWindow: vi.fn(), focusWindow: vi.fn(), openWindow: vi.fn(), moveWindow: vi.fn(), resizeWindow: vi.fn(),
  minimizeWindow: vi.fn(), restoreWindow: vi.fn(), maximizeWindow: vi.fn(), restoreMaximizedWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(), closeWindow: vi.fn(), toggleTaskbarWindow: vi.fn(), switchDesktop: vi.fn(),
  toggleShowDesktop: vi.fn(), moveWindowToDesktop: vi.fn(), setWorkArea: vi.fn(),
};

const renderKWrite = () => renderToStaticMarkup(
  <WindowManagerContext.Provider value={windowManager}>
    <VfsProvider><KWrite windowId="app:kwrite" /></VfsProvider>
  </WindowManagerContext.Provider>,
);

const renderKWriteFile = () => renderToStaticMarkup(
  <WindowManagerContext.Provider value={windowManager}>
    <VfsProvider>
      <KWrite
        windowId="app:kwrite"
        launchRequest={{ requestId: 1, intent: createKWriteOpenTextFileIntent("vfs-content-e594a065214576326cb903a5") }}
      />
    </VfsProvider>
  </WindowManagerContext.Provider>,
);

describe("KWrite UI", () => {
  it("renders an Untitled KDE-style textarea editor with menus and status", () => {
    const markup = renderKWrite();

    expect(markup).toContain("data-kwrite-root=\"true\"");
    expect(markup).toContain("<textarea");
    expect(markup).toContain("spellCheck=\"false\"");
    expect(markup).toContain("wrap=\"off\"");
    expect(markup).toContain("Untitled - no backing file");
    expect(markup).not.toContain("contentEditable");
  });

  it("keeps document state local and the save keybinding scoped to the KWrite root", () => {
    const source = readFileSync(new URL("./KWrite.tsx", import.meta.url), "utf8");
    const model = readFileSync(new URL("./documentModel.ts", import.meta.url), "utf8");
    const controller = readFileSync(new URL("./documentController.ts", import.meta.url), "utf8");

    expect(source).toContain("onKeyDownCapture={handleKeyDown}");
    expect(source).toContain("useApplicationMenuDismissal({");
    expect(source).toContain("ref={menuBarRef}");
    expect(source).toContain('openMenu !== null && event.key === "Escape"');
    expect(source).toContain("onChange={handleEditorChange}");
    expect(source).toContain("const nextDraft = event.currentTarget.value;");
    expect(source).toContain("editKWriteDocument(current, nextDraft)");
    expect(source).not.toContain("editKWriteDocument(current, event.currentTarget.value)");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain('t("kwrite.save")');
    expect(source).toContain("Ctrl+Alt+N");
    expect(source).toContain('t("kwrite.open")');
    expect(source).toContain('t("kwrite.saveAs")');
    expect(source).toContain('t("kwrite.reload")');
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
    expect(source).not.toContain("navigator.clipboard");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("input type=\"file\"");
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("window.alert");
    expect(source).not.toContain("navigator.keyboard.lock");
    expect(source).not.toContain("Keyboard Lock");
    expect(source).not.toContain("nodesById");
    expect(model).not.toContain("react");
    expect(controller).not.toContain("nodesById");
    expect(controller).not.toContain("writeVfsTextFile");
    expect(controller).not.toContain("node:fs");
    expect(controller).not.toContain("child_process");

    const changeHandler = source.slice(
      source.indexOf("const handleEditorChange"),
      source.indexOf("const toggleMenu"),
    );

    expect(changeHandler).not.toContain("saveKWriteDocument");
    expect(changeHandler).not.toContain("writeTextFile");
    expect(changeHandler).not.toContain("launchApplication");
    expect(changeHandler).not.toContain("getKWriteTextFileSnapshot");

    expect(source).toContain("getKWriteShortcut(event)");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain('shortcut === "save-as"');
    expect(source).toContain('shortcut === "new"');
    expect(source).toContain("onClick={requestDocumentClose}");
    expect(source).toContain("setOpenMenu(null); onRequestClose();");
    expect(source).not.toContain('requestApplicationClose?.("kwrite")');
    expect(source).toContain("const [document, setDocument] = useState");
    expect(source).toContain("const [dialog, setDialog] = useState");
    expect(source).toContain("const lastHandledLaunchRequestIdRef = useRef");
    expect(source).toContain("const lastHandledCloseRequestIdRef = useRef");
    expect(source).toContain("const consumedPendingActionIdsRef = useRef");
    expect(source).not.toContain("Map<WindowId");
    expect(source).not.toContain("currentKWrite");
  });

  it("keeps File New, File Open, and Ctrl+Alt+N as current-document replacement commands", () => {
    const source = readFileSync(new URL("./KWrite.tsx", import.meta.url), "utf8");

    expect(source).toContain('requestReplacement({ type: "new" })');
    expect(source).toContain('requestReplacement({ type: "open-dialog" })');
    expect(source).toContain("shouldConfirmKWriteReplacement(document, action)");
    expect(source).toContain("completePendingAction(action, document)");
    expect(source).toContain("launchNewApplicationInstance(\"kwrite\")");
  });

  it("keeps Open Recent presentation labels content-sized and non-wrapping within KWrite only", () => {
    const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");
    const submenuRules = css.slice(css.indexOf(".kwrite-menu-popup--submenu"), css.indexOf(".kwrite-editing-dialog"));

    expect(submenuRules).toContain("width: max-content");
    expect(submenuRules).toContain("white-space: nowrap");
    expect(submenuRules).not.toMatch(/^\s*width:\s*200px;/m);
  });

  it("loads an initial open-text-file request by stable VFS node id", () => {
    const markup = renderKWriteFile();

    expect(markup).toContain("Edit Notes.txt");
    expect(markup).toContain("Notes.txt lives only in browser memory for this prototype.");
    expect(markup).toContain("/home/user/Documents/Notes.txt");
  });

  it("reports each document's base caption to the exact WindowFrame without owning collision suffixes", () => {
    const source = readFileSync(new URL("./KWrite.tsx", import.meta.url), "utf8");

    expect(source).toContain("getKWriteDocumentBaseTitle(document)");
    expect(source).toContain("onSetWindowTitle(baseTitle)");
    expect(source).not.toContain("<2>");
    expect(source).not.toContain("disambiguateWindowCaptions");
  });

  it("keeps the Edit menu simplified and renders the toolbar as a sibling between menus and editor content", () => {
    const source = readFileSync(new URL("./KWrite.tsx", import.meta.url), "utf8");
    const editMenu = source.slice(source.indexOf('aria-label={t("kwrite.editMenu")}'), source.indexOf('aria-label={t("kwrite.viewMenu")}'));

    expect(editMenu).toContain('t("kwrite.undo")');
    expect(editMenu).toContain('t("kwrite.redo")');
    expect(editMenu).toContain('t("kwrite.cut")');
    expect(editMenu).toContain('t("kwrite.copy")');
    expect(editMenu).toContain('t("kwrite.paste")');
    expect(editMenu).toContain('t("kwrite.selectAll")');
    expect(editMenu).toContain('t("kwrite.deselect")');
    expect(editMenu).toContain('t("kwrite.goToLine")');
    expect(editMenu).not.toContain("Find Next");
    expect(editMenu).not.toContain("Find Previous");
    expect(editMenu).not.toContain("Replace...");
    expect(source).toContain('className="kwrite-toolbar konqueror-toolbar kde-chrome-surface"');
    expect(source.indexOf('className="kwrite-toolbar konqueror-toolbar kde-chrome-surface"')).toBeLessThan(source.indexOf('className="kwrite-main"'));
  });
});
