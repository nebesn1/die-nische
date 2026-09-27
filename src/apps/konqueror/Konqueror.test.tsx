import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createVfsDirectory, moveVfsNodeToTrash } from "../../vfs/mutations";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createInitialVfsState } from "../../vfs/initialState";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import type { VfsState } from "../../vfs/types";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";
import { KonquerorFileView } from "./KonquerorFileView";
import { Konqueror } from "./Konqueror";
import { KonquerorPrintProvider } from "./KonquerorPrintContext";
import { formatVfsModifiedTime } from "./formatters";

const makeVfsContextValue = (state: VfsState): VfsContextValue => ({
  state,
  ...createVfsOperations(
    () => state,
    () => undefined,
  ),
});

const renderWithVfs = (state: VfsState, launchRequest: ApplicationLaunchRequest | null = null) =>
  renderToStaticMarkup(
    <ApplicationLauncherContext.Provider value={{
      launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
      launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
    }}>
      <VfsContext.Provider value={makeVfsContextValue(state)}>
        <KonquerorPrintProvider>
          <Konqueror launchRequest={launchRequest} />
        </KonquerorPrintProvider>
      </VfsContext.Provider>
    </ApplicationLauncherContext.Provider>,
  );

describe("Konqueror VFS browser", () => {
  it("opens KWrite explicitly in a new instance with the resolved stable file id", () => {
    const source = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(source).toContain("launchNewApplicationInstance(\"kwrite\", {");
    expect(source).toContain("intent: createKWriteOpenTextFileIntent(target.value.node.id)");
    expect(source).not.toContain('launchApplication("kwrite"');
  });

  it("launches the shared Bookmark Editor through the normal singleton application runtime", () => {
    const source = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(source).toContain('case "edit-bookmarks"');
    expect(source).toContain('launchApplication("bookmark-editor")');
  });

  it("renders a blank-address Start Page as the default generic Konqueror location", () => {
    const state = createInitialVfsState();
    const markup = renderWithVfs(state);

    expect(markup).toContain("aria-label=\"Konqueror toolbar\"");
    expect(markup).toContain('data-toolbar-profile="web"');
    expect(markup).toContain("aria-label=\"Back\"");
    expect(markup).toContain("aria-label=\"Forward\"");
    expect(markup).toContain("aria-label=\"Up\"");
    expect(markup).toContain("aria-label=\"Home\"");
    expect(markup).toContain("aria-label=\"Reload\"");
    expect(markup).toContain("aria-label=\"Stop\"");
    expect(markup).toContain("aria-label=\"Cut\"");
    expect(markup).toContain("aria-label=\"Copy\"");
    expect(markup).toContain("aria-label=\"Paste\"");
    expect(markup).toContain("aria-label=\"Print\"");
    expect(markup).toContain("aria-label=\"Zoom In\"");
    expect(markup).toContain("aria-label=\"Security\"");
    expect(markup).not.toContain("aria-label=\"Download\"");
    expect(markup).toContain("aria-label=\"New Konqueror Window\"");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).toContain("id=\"konqueror-location\"");
    expect(markup).toContain("value=\"\"");
    expect(markup).toContain("Conquer your Desktop!");
    expect(markup).toContain('class="konqueror-print-surface"');
    expect(markup).toContain('data-content-zoom="100"');
    expect(markup).not.toMatch(/aria-label="Print"[^>]*disabled=""/);
    expect(markup).toContain("Starting Points");
    expect(markup).toContain("Page loaded.");
  });

  it("renders Provider fixture data instead of a hardcoded directory list", () => {
    const initial = createInitialVfsState();
    const created = createVfsDirectory(initial, "/home/user", "Projects", {
      now: "2026-08-03T00:00:00.000Z",
    });

    if (!created.ok) {
      throw new Error("fixture mutation failed");
    }

    const markup = renderWithVfs(created.state, {
      requestId: 7,
      intent: { type: "open-special-location", location: "home" },
    });

    expect(markup).toContain("Projects");
    expect(markup).toContain("7 Items");
  });

  it("uses launch requests for initial special locations and renders Trash metadata", () => {
    const trashed = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", {
      now: "2026-08-03T00:00:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("trash fixture failed");
    }

    const markup = renderWithVfs(trashed.state, {
      requestId: 1,
      intent: {
        type: "open-special-location",
        location: "trash",
      },
    });
    const documentsIntentMarkup = renderWithVfs(trashed.state, {
      requestId: 2,
      intent: {
        type: "open-special-location",
        location: "documents",
      },
    });

    expect(markup).toContain("value=\"trash:/\"");
    expect(markup).toContain("Original Location");
    expect(markup).toContain("Deleted");
    expect(markup).toContain("/home/user/Documents");
    expect(markup).toContain(formatVfsModifiedTime("2026-08-03T00:00:00.000Z"));
    expect(markup).toContain("Notes.txt");
    expect(markup).toContain('data-resource-view="tree"');
    expect(markup).toMatch(/aria-label="Tree View"[^>]*aria-pressed="true"/);
    expect(documentsIntentMarkup).toContain("value=\"/home/user/Documents\"");
  });

  it("uses a stable-node open-directory launch intent without requiring a path snapshot", () => {
    const state = createInitialVfsState();
    const markup = renderWithVfs(state, {
      requestId: 3,
      intent: {
        type: "open-directory",
        nodeId: state.specialLocations.documents,
      },
    });

    expect(markup).toContain("value=\"/home/user/Documents\"");
    expect(markup).toContain("Welcome.md");
    expect(markup).toContain("Notes.txt");
  });

  it("uses a stable-node open-file launch intent with the requested current previewer", () => {
    const state = createInitialVfsState();
    const notes = Object.values(state.nodesById).find((node) => node.kind === "file" && node.name === "Notes.txt");
    if (!notes || notes.kind !== "file" || notes.content.kind !== "text") throw new Error("Notes fixture missing");

    const markup = renderWithVfs(state, {
      requestId: 31,
      intent: { type: "open-file", nodeId: notes.id, previewerId: "embedded-text" },
    });

    expect(markup).toContain("Read-only preview");
    expect(markup).toContain(notes.content.text);
  });

  it("renders sysinfo as a programmatically focusable native scroll surface", () => {
    const markup = renderWithVfs(createInitialVfsState(), {
      requestId: 4,
      intent: { type: "open-sysinfo" },
    });

    expect(markup).toContain('class="konqueror-directory-viewport konqueror-directory-viewport--sysinfo"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('aria-label="My Computer scroll surface"');
    expect(markup).toContain('data-toolbar-profile="resource-manager"');
    expect(markup).toMatch(/aria-label="Tree View"[^>]*disabled=""/);
    expect(markup).toMatch(/aria-label="Zoom In"[^>]*disabled=""/);
  });

  it("renders about:konqueror as the local programmatically focusable Start Page surface", () => {
    const markup = renderWithVfs(createInitialVfsState(), {
      requestId: 5,
      intent: { type: "open-konqueror-start" },
    });

    expect(markup).toContain('class="konqueror-directory-viewport konqueror-directory-viewport--about"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('aria-label="Conquer your Desktop start page scroll surface"');
    expect(markup).toContain("Home Folder");
    expect(markup).toContain("Storage Media");
    expect(markup).toContain("Trash");
    expect(markup).toContain("Settings");
    expect(markup).toContain("Network Folders");
    expect(markup).toContain("Applications");
    expect(markup).toContain('disabled=""');
  });

  it("renders directory options with aria-selected and stable node ids", () => {
    const state = createInitialVfsState();
    const children = [
      state.nodesById[state.specialLocations.documents],
      state.nodesById[state.specialLocations.downloads],
    ];
    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView
        childrenNodes={children}
        selectedNodeIds={[state.specialLocations.documents]}
        cutNodeIds={[state.specialLocations.downloads]}
        vfsState={state}
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
      />,
    );

    expect(markup).toContain("role=\"listbox\"");
    expect(markup).toContain("role=\"option\"");
    expect(markup).toContain("aria-selected=\"true\"");
    expect(markup).toContain("class=\"konqueror-directory-row is-selected\"");
    expect(markup).toContain("is-cut-pending");
    expect(markup).toContain("data-cut-pending=\"true\"");
    expect(markup).toContain("Documents");
    expect(markup).toContain("Directory");
  });

  it("renders empty directories without creation controls", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView
        childrenNodes={[]}
        selectedNodeIds={[]}
        isTrashRoot={false}
        vfsState={state}
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
      />,
    );

    expect(markup).toContain("This folder is empty.");
    expect(markup).not.toContain("New Folder");
    expect(markup).not.toContain("New File");
  });

  it("renders the Trash root empty state with read-only wording", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView
        childrenNodes={[]}
        selectedNodeIds={[]}
        isTrashRoot
        vfsState={state}
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
      />,
    );

    expect(markup).toContain("The Trash is empty.");
    expect(markup).not.toContain("This folder is empty.");
  });

  it("renders a focusable read-only text preview with pre and no edit controls", () => {
    const state = createInitialVfsState();
    const file = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    if (file.kind !== "file") {
      throw new Error("fixture file missing");
    }

    const markup = renderToStaticMarkup(<KonquerorFileView file={file} />);

    expect(markup).toContain("<pre");
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("read-only text preview");
    expect(markup).toContain("# Welcome to die Nische");
    expect(markup).toContain("text/markdown");
    expect(markup).toContain("111 B");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Save");
    expect(markup).not.toContain("contenteditable");
  });

  it("does not use dangerous HTML rendering or VFS mutations in Konqueror source", () => {
    const source = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");
    const dialogSource = readFileSync(new URL("./KonquerorInputDialog.tsx", import.meta.url), "utf8");
    const confirmationSource = readFileSync(new URL("./KonquerorConfirmationDialog.tsx", import.meta.url), "utf8");
    const propertiesSource = readFileSync(new URL("./KonquerorPropertiesDialog.tsx", import.meta.url), "utf8");
    const propertiesModelSource = readFileSync(new URL("./filePropertiesModel.ts", import.meta.url), "utf8");
    const contextMenuSource = readFileSync(new URL("./KonquerorContextMenu.tsx", import.meta.url), "utf8");
    const contextMenuModelSource = readFileSync(new URL("./contextMenuModel.ts", import.meta.url), "utf8");
    const applicationMenuSource = readFileSync(new URL("./KonquerorApplicationMenu.tsx", import.meta.url), "utf8");
    const applicationMenuModelSource = readFileSync(new URL("./applicationMenuModel.ts", import.meta.url), "utf8");

    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("createInitialVfsState");
    expect(source).not.toContain("navigator.clipboard");
    expect(source).not.toContain("restoreNodeFromTrash(");
    expect(source).not.toContain("deleteNodePermanently(");
    expect(source).not.toContain("emptyTrash(");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("window.history");
    expect(source).not.toContain("history.pushState");
    expect(source).not.toContain('document.addEventListener("keydown"');
    expect(source).not.toContain('window.addEventListener("keydown"');
    expect(source).not.toContain("showOpenFilePicker");
    expect(`${source}\n${dialogSource}\n${confirmationSource}\n${propertiesSource}`).not.toContain("prompt(");
    expect(`${source}\n${dialogSource}\n${confirmationSource}\n${propertiesSource}`).not.toContain("alert(");
    expect(`${source}\n${dialogSource}\n${confirmationSource}\n${propertiesSource}`).not.toContain("confirm(");
    expect(propertiesSource).not.toContain("nodesById");
    expect(propertiesModelSource).toContain("getVfsNodeById");
    expect(propertiesModelSource).toContain("getVfsPathForNode");
    expect(propertiesModelSource).not.toContain("writeVfsTextFile");
    expect(propertiesModelSource).not.toContain("renameVfsNode");
    expect(source).not.toContain('document.addEventListener("contextmenu"');
    expect(source).not.toContain("window.oncontextmenu");
    expect(contextMenuSource).not.toContain("moveVfsNode");
    expect(contextMenuSource).not.toContain("createVfsTextFile");
    expect(contextMenuModelSource).not.toContain("nodesById");
    expect(contextMenuModelSource).not.toContain("localStorage");
    expect(applicationMenuSource).not.toContain("createVfs");
    expect(applicationMenuSource).not.toContain("renameVfs");
    expect(applicationMenuSource).not.toContain("moveVfs");
    expect(applicationMenuSource).not.toContain("document.addEventListener");
    expect(applicationMenuModelSource).not.toContain("localStorage");
    expect(applicationMenuModelSource).not.toContain("sessionStorage");
    expect(applicationMenuModelSource).not.toContain("indexedDB");
  });

  it("uses one local Location/Edit/View surface and dispatches it through existing Konqueror command paths", () => {
    const source = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(source).toContain("KonquerorApplicationMenu");
    expect(source).toContain("useApplicationMenuDismissal");
    expect(source).toContain("dismissContextMenu(false)");
    expect(source).toContain("getKonquerorApplicationMenuEntries");
    expect(source).toContain("printEmbeddedContent()");
    expect(source).toContain("openNewFolderDialog()");
    expect(source).toContain("openNewTextFileDialog()");
    expect(source).toContain("openProperties()");
    expect(source).toContain("copySelectedNode()");
    expect(source).toContain("openDeletePermanentlyConfirmation()");
    expect(source).toContain("navigateHistory(\"back\")");
    expect(source).toContain('launchApplication("about-konqueror")');
    expect(source).toContain('launchApplication("about-kde")');
    expect(source).toContain("onRequestClose()");
    expect(source).toContain('dispatchDirectoryView({ type: "toggle-sort-direction" })');
    expect(source).toContain("if (directoryViewState.sort.key !== key)");
    expect(source).toContain("dismissApplicationMenu();\n    dismissContextMenu();");
  });

  it("feeds the same inline Edit availability into Context Menu and Application Menu", () => {
    const source = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");

    expect(source).toContain("const canEdit = editorAvailability.canEdit && !isTrashView && !isDialogBlockingCommands;");
    expect(source).toContain("const editTitle = isTrashView ? t(\"konqueror.availability.itemsTrashReadOnly\") : translateKonquerorAvailabilityText(t, editorAvailability.editTitle);");
    expect(source).toContain("const availability = {\n      canEdit,\n      editTitle,");
    expect(source).toContain("canEdit,\n    editTitle,\n    canShowProperties");
    expect(source).not.toContain("canEdit={canEdit}");
    expect(source).not.toContain("editTitle={editTitle}");
  });
});
