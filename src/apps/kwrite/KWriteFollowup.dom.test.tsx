// @vitest-environment jsdom
import { act, useContext, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationCloseRequest, ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { VfsContext } from "../../vfs/VfsContext";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { KWriteRecentFilesContext, KWriteRecentFilesProvider, type KWriteRecentFile } from "./KWriteRecentFilesContext";
import { KWrite } from "./KWrite";
import { createKWriteOpenTextFileIntent } from "./launchIntent";

let container: HTMLDivElement;
let reactRoot: Root;

function VfsFixture({ children, initialState }: { readonly children: ReactNode; readonly initialState?: VfsState }) {
  const [state, setState] = useState<VfsState>(() => initialState ?? createInitialVfsState());
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);
  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const notesRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: createKWriteOpenTextFileIntent("vfs-content-e594a065214576326cb903a5"),
};

const recentFiles: readonly KWriteRecentFile[] = [
  { nodeId: "vfs-content-e594a065214576326cb903a5", path: "/home/user/Documents/Notes.txt", name: "Notes.txt" },
  { nodeId: "vfs-content-76cff3ce17d8a853403179f1", path: "/home/user/Documents/Welcome.md", name: "Welcome.md" },
];

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const hover = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
};

const menuButton = (app: HTMLElement, label: string) =>
  [...app.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label) ?? null;

const menuAction = (app: HTMLElement, label: string) =>
  [...app.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((button) => button.textContent === label) ?? null;

const dialogButton = (label: string) =>
  [...container.querySelectorAll<HTMLButtonElement>(".kwrite-dialog-button")].find((button) => button.textContent === label) ?? null;

const changeText = (app: HTMLElement, value: string) => {
  const editor = app.querySelector<HTMLTextAreaElement>("textarea");
  if (!editor) throw new Error("Editor missing");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(editor, value);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const appAt = (index: number) => {
  const app = container.querySelectorAll<HTMLElement>("[data-kwrite-root='true']")[index];
  if (!app) throw new Error("KWrite missing");
  return app;
};

function KWriteFixture({
  children,
  recent = [],
  initialState,
}: {
  readonly children: ReactNode;
  readonly recent?: readonly KWriteRecentFile[];
  readonly initialState?: VfsState;
}) {
  return <KWriteRecentFilesContext.Provider value={{ recentFiles: recent, addRecentFile: vi.fn() }}>
    <VfsFixture initialState={initialState}>{children}</VfsFixture>
  </KWriteRecentFilesContext.Provider>;
}

function RecentProbe() {
  const { recentFiles } = useContext(KWriteRecentFilesContext);
  return <output data-testid="recent-files">{recentFiles.map((file) => file.nodeId).join(",")}</output>;
}

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

describe("KWrite Open Recent and Close/Quit follow-up", () => {
  it("opens Open Recent on hover, resets it when File closes, and keeps canonical fallback labels single-line by contract", () => {
    act(() => reactRoot.render(<KWriteFixture recent={recentFiles}><KWrite launchRequest={notesRequest} /></KWriteFixture>));
    const app = appAt(0);

    click(menuButton(app, "File"));
    expect(app.querySelector("[aria-label='Open Recent menu']")).toBeNull();
    hover(menuAction(app, "Open Recent ▶"));
    expect(app.querySelector("[aria-label='Open Recent menu']")?.textContent).toContain("Notes.txt");
    expect(app.querySelector("[aria-label='Open Recent menu']")?.textContent).toContain("Welcome.md");

    hover(menuAction(app, "Save"));
    expect(app.querySelector("[aria-label='Open Recent menu']")).toBeNull();
    hover(menuAction(app, "Open Recent ▶"));
    click(menuButton(app, "File"));
    click(menuButton(app, "File"));
    expect(app.querySelector("[aria-label='Open Recent menu']")).toBeNull();
  });

  it("renders resolvable recent entries with their current displayName while keeping canonical path identity", () => {
    const state = createInitialVfsState();
    const notes = state.nodesById["vfs-content-e594a065214576326cb903a5"];
    const welcome = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    if (!notes || !welcome) throw new Error("recent fixtures missing");
    const displayNamedState: VfsState = {
      ...state,
      nodesById: {
        ...state.nodesById,
        [notes.id]: { ...notes, displayName: "Project" },
        [welcome.id]: { ...welcome, displayName: "Project" },
      },
    };
    const launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");

    act(() => reactRoot.render(<ApplicationLauncherContext.Provider value={{
      launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
      launchNewApplicationInstance,
    }}><KWriteFixture initialState={displayNamedState} recent={recentFiles}><KWrite launchRequest={notesRequest} /></KWriteFixture></ApplicationLauncherContext.Provider>));
    const app = appAt(0);
    click(menuButton(app, "File"));
    hover(menuAction(app, "Open Recent ▶"));
    const recentMenu = app.querySelector("[aria-label='Open Recent menu']");
    const entries = [...recentMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []];

    expect(entries.map((entry) => entry.textContent)).toEqual(["Project", "Project"]);
    expect(entries.map((entry) => entry.title)).toEqual(["/home/user/Documents/Notes.txt", "/home/user/Documents/Welcome.md"]);
    click(entries[1] ?? null);
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("kwrite", {
      intent: createKWriteOpenTextFileIntent("vfs-content-76cff3ce17d8a853403179f1"),
    });
  });

  it("reports a displayName title while Save As continues to prefill the canonical filename", () => {
    const state = createInitialVfsState();
    const notes = state.nodesById["vfs-content-e594a065214576326cb903a5"];
    if (!notes) throw new Error("Notes fixture missing");
    const displayNamedState: VfsState = {
      ...state,
      nodesById: { ...state.nodesById, [notes.id]: { ...notes, displayName: "My Notes" } },
    };
    const setWindowTitle = vi.fn();

    act(() => reactRoot.render(<KWriteFixture initialState={displayNamedState}><KWrite launchRequest={notesRequest} onSetWindowTitle={setWindowTitle} /></KWriteFixture>));
    const app = appAt(0);
    expect(setWindowTitle).toHaveBeenLastCalledWith("My Notes - KWrite");
    expect(app.querySelector("textarea")?.getAttribute("aria-label")).toBe("Edit My Notes");
    expect(app.querySelector(".kwrite-statusbar__path")?.textContent).toBe("/home/user/Documents/Notes.txt");

    click(menuButton(app, "File"));
    click(menuAction(app, "Save As..."));
    expect(app.querySelector<HTMLInputElement>(".kwrite-dialog-filename input")?.value).toBe("Notes.txt");
  });

  it("closes a clean document into Untitled without closing its KWrite instance", () => {
    const requestClose = vi.fn();
    act(() => reactRoot.render(<KWriteFixture><KWrite launchRequest={notesRequest} onRequestClose={requestClose} /></KWriteFixture>));
    const app = appAt(0);

    click(menuButton(app, "File"));
    click(menuAction(app, "Close"));
    expect(app.querySelector("textarea")?.value).toBe("");
    expect(app.textContent).toContain("Untitled - no backing file");
    expect(requestClose).not.toHaveBeenCalled();
  });

  it("keeps a dirty document on Cancel and resets it on Discard", () => {
    act(() => reactRoot.render(<KWriteFixture><KWrite launchRequest={notesRequest} /></KWriteFixture>));
    const app = appAt(0);
    changeText(app, "Changed");

    click(menuButton(app, "File"));
    click(menuAction(app, "Close"));
    click(dialogButton("Cancel"));
    expect(app.querySelector("textarea")?.value).toBe("Changed");

    click(menuButton(app, "File"));
    click(menuAction(app, "Close"));
    click(dialogButton("Discard"));
    expect(app.querySelector("textarea")?.value).toBe("");
    expect(app.textContent).toContain("Untitled - no backing file");
  });

  it("saves a dirty document before closing it into Untitled", () => {
    act(() => reactRoot.render(<KWriteFixture><KWrite launchRequest={notesRequest} /></KWriteFixture>));
    const app = appAt(0);
    changeText(app, "Saved from Close\n");
    click(menuButton(app, "File"));
    click(menuAction(app, "Close"));
    click(dialogButton("Save"));

    expect(app.querySelector("textarea")?.value).toBe("");
    expect(app.textContent).toContain("Untitled - no backing file");
  });

  it("keeps Close document-local and Quit instance-local across two KWrite instances", () => {
    const quitA = vi.fn();
    const quitB = vi.fn();
    act(() => reactRoot.render(<KWriteFixture>
      <KWrite launchRequest={notesRequest} onRequestClose={quitA} />
      <KWrite launchRequest={{ requestId: 2, intent: createKWriteOpenTextFileIntent("vfs-content-76cff3ce17d8a853403179f1") }} onRequestClose={quitB} />
    </KWriteFixture>));
    const first = appAt(0);
    const second = appAt(1);

    click(menuButton(first, "File"));
    click(menuAction(first, "Close"));
    expect(first.textContent).toContain("Untitled - no backing file");
    expect(second.querySelector("textarea")?.value).toContain("# Welcome to die Nische");

    click(menuButton(first, "File"));
    click(menuAction(first, "Quit"));
    expect(quitA).toHaveBeenCalledTimes(1);
    expect(quitB).not.toHaveBeenCalled();
    expect(second.querySelector("textarea")?.value).toContain("# Welcome to die Nische");
  });

  it("uses the same dirty guard for a window close request as File Quit", () => {
    const commitClose = vi.fn();
    const cancelClose = vi.fn();

    function CloseRequestFixture() {
      const [closeRequest, setCloseRequest] = useState<ApplicationCloseRequest | null>(null);
      return <>
        <button type="button" onClick={() => setCloseRequest({ requestId: 9 })}>Frame close</button>
        <KWrite launchRequest={notesRequest} closeRequest={closeRequest} onCommitClose={commitClose} onCancelClose={cancelClose} />
      </>;
    }

    act(() => reactRoot.render(<KWriteFixture><CloseRequestFixture /></KWriteFixture>));
    const app = appAt(0);
    changeText(app, "Changed");
    click([...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Frame close") ?? null);
    click(dialogButton("Cancel"));
    expect(cancelClose).toHaveBeenCalledWith(9);
    expect(commitClose).not.toHaveBeenCalled();
  });

  it("keeps a dirty invoking instance open on Quit Cancel and closes only that request on Discard", () => {
    const commitClose = vi.fn();
    const cancelClose = vi.fn();

    function QuitFlowFixture() {
      const [nextRequestId, setNextRequestId] = useState(1);
      const [closeRequest, setCloseRequest] = useState<ApplicationCloseRequest | null>(null);
      return <KWrite
        launchRequest={notesRequest}
        closeRequest={closeRequest}
        onRequestClose={() => {
          setCloseRequest({ requestId: nextRequestId });
          setNextRequestId((current) => current + 1);
        }}
        onCommitClose={commitClose}
        onCancelClose={cancelClose}
      />;
    }

    act(() => reactRoot.render(<KWriteFixture><QuitFlowFixture /></KWriteFixture>));
    const app = appAt(0);
    changeText(app, "Changed");
    click(menuButton(app, "File"));
    click(menuAction(app, "Quit"));
    click(dialogButton("Cancel"));
    expect(cancelClose).toHaveBeenCalledWith(1);
    expect(app.querySelector("textarea")?.value).toBe("Changed");

    click(menuButton(app, "File"));
    click(menuAction(app, "Quit"));
    click(dialogButton("Discard"));
    expect(commitClose).toHaveBeenCalledWith(2);
  });

  it("keeps View New Window routed through the existing runtime launcher", () => {
    const launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
    act(() => reactRoot.render(<ApplicationLauncherContext.Provider value={{
      launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
      launchNewApplicationInstance,
    }}><KWriteFixture><KWrite /></KWriteFixture></ApplicationLauncherContext.Provider>));
    const app = appAt(0);

    click(menuButton(app, "View"));
    click(menuAction(app, "New Window"));
    expect(launchNewApplicationInstance).toHaveBeenCalledWith("kwrite");
  });

  it("records only successfully adopted external text-file launch targets in shared recent history", () => {
    function ExternalLaunchFixture() {
      const [request, setRequest] = useState<ApplicationLaunchRequest>(notesRequest);
      return <>
        <button type="button" onClick={() => setRequest({ requestId: 2, intent: createKWriteOpenTextFileIntent("missing-file") })}>Open missing</button>
        <KWrite launchRequest={request} />
        <RecentProbe />
      </>;
    }

    act(() => reactRoot.render(<KWriteRecentFilesProvider><VfsFixture><ExternalLaunchFixture /></VfsFixture></KWriteRecentFilesProvider>));

    expect(container.querySelector("[data-testid='recent-files']")?.textContent).toBe("vfs-content-e594a065214576326cb903a5");
    click([...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Open missing") ?? null);
    expect(container.querySelector("[data-testid='recent-files']")?.textContent).toBe("vfs-content-e594a065214576326cb903a5");
  });

  it("opens a recent file through the same new-instance intent while preserving the invoking document", () => {
    const launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
    act(() => reactRoot.render(<ApplicationLauncherContext.Provider value={{
      launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
      launchNewApplicationInstance,
    }}><KWriteFixture recent={recentFiles}><KWrite launchRequest={notesRequest} /></KWriteFixture></ApplicationLauncherContext.Provider>));
    const app = appAt(0);
    const originalText = app.querySelector("textarea")?.value;

    click(menuButton(app, "File"));
    hover(menuAction(app, "Open Recent ▶"));
    click(menuAction(app, "Welcome.md"));

    expect(launchNewApplicationInstance).toHaveBeenCalledWith("kwrite", {
      intent: createKWriteOpenTextFileIntent("vfs-content-76cff3ce17d8a853403179f1"),
    });
    expect(app.querySelector("textarea")?.value).toBe(originalText);
  });

  it("refreshes shared recent order only after the launched KWrite instance adopts its backing file", () => {
    function RecentLaunchFixture() {
      const [recentRequest, setRecentRequest] = useState<ApplicationLaunchRequest | null>(null);
      const launcher = useMemo(() => ({
        launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
        launchNewApplicationInstance: (_appId: string, options?: { readonly intent?: unknown }): LaunchApplicationResult => {
          setRecentRequest({ requestId: 3, intent: options?.intent });
          return "opened";
        },
      }), []);

      return <ApplicationLauncherContext.Provider value={launcher}>
        <KWrite launchRequest={{ requestId: 1, intent: createKWriteOpenTextFileIntent("vfs-content-76cff3ce17d8a853403179f1") }} />
        <KWrite launchRequest={{ requestId: 2, intent: createKWriteOpenTextFileIntent("vfs-content-e594a065214576326cb903a5") }} />
        {recentRequest ? <KWrite launchRequest={recentRequest} /> : null}
        <RecentProbe />
      </ApplicationLauncherContext.Provider>;
    }

    act(() => reactRoot.render(<KWriteRecentFilesProvider><VfsFixture><RecentLaunchFixture /></VfsFixture></KWriteRecentFilesProvider>));
    const first = appAt(1);
    expect(container.querySelector("[data-testid='recent-files']")?.textContent).toBe("vfs-content-e594a065214576326cb903a5,vfs-content-76cff3ce17d8a853403179f1");

    click(menuButton(first, "File"));
    hover(menuAction(first, "Open Recent ▶"));
    click(menuAction(first, "Welcome.md"));

    expect(container.querySelector("[data-testid='recent-files']")?.textContent).toBe("vfs-content-76cff3ce17d8a853403179f1,vfs-content-e594a065214576326cb903a5");
    expect(appAt(1).querySelector("textarea")?.value).toContain("Notes.txt");
    expect(appAt(2).querySelector("textarea")?.value).toContain("# Welcome to die Nische");
  });
});
