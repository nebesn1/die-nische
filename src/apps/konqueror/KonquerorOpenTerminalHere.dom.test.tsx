// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory } from "../../vfs/mutations";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { VfsState } from "../../vfs/types";
import { VfsContext } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";

const homeLaunchRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: { type: "open-special-location", location: "home" },
};

let container: HTMLDivElement;
let reactRoot: Root;
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

function VfsFixture({ initialState, children }: { readonly initialState: VfsState; readonly children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const operations = useMemo(() => createVfsOperations(() => state, setState), [state]);

  return <VfsContext.Provider value={{ state, ...operations }}>{children}</VfsContext.Provider>;
}

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing menu control");
  act(() => element.click());
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

const openTerminalHere = (): void => {
  const actions = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((item) => item.textContent?.includes("Actions"));
  click(actions ?? null);
  const terminal = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
    .find((item) => item.textContent === "Open Terminal Here");
  click(terminal ?? null);
};

const renderKonqueror = (initialState: VfsState, launchRequest: ApplicationLaunchRequest = homeLaunchRequest): void => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance,
        }}>
          <VfsFixture initialState={initialState}>
            <Konqueror launchRequest={launchRequest} isActive focusRequestId={1} />
          </VfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  launchNewApplicationInstance = vi.fn((): LaunchApplicationResult => "opened");
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

describe("Konqueror Open Terminal Here", () => {
  it("uses the physically right-clicked folder rather than an existing selection", () => {
    renderKonqueror(createInitialVfsState());
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Konqueror fixture missing");
    const documents = findNode(application, "Documents");
    const downloads = findNode(application, "Downloads");

    click(documents);
    openItemMenu(downloads);
    openTerminalHere();

    expect(launchNewApplicationInstance).toHaveBeenCalledWith("konsole", {
      intent: { type: "open-working-directory", workingDirectory: "/home/user/Downloads" },
    });
    expect(container.querySelector(".konqueror-context-menu")).toBeNull();
  });

  it("uses the owning Konqueror current directory for background context and preserves spaces", () => {
    const created = createVfsDirectory(createInitialVfsState(), "/home/user", "My Folder", {
      now: "2026-09-05T00:00:00.000Z",
    });
    if (!created.ok) throw new Error("directory fixture failed");

    renderKonqueror(created.state, {
      requestId: 2,
      intent: { type: "open-directory", nodeId: created.value.id },
    });
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    const directory = application?.querySelector<HTMLElement>(".konqueror-directory-view");
    if (!directory) throw new Error("Directory fixture missing");

    openBackgroundMenu(directory);
    openTerminalHere();

    expect(launchNewApplicationInstance).toHaveBeenCalledWith("konsole", {
      intent: { type: "open-working-directory", workingDirectory: "/home/user/My Folder" },
    });
  });
});
