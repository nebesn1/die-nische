// @vitest-environment jsdom
import { act, StrictMode, useMemo, useState, type ReactNode } from "react";
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
let launchNewApplicationInstance: ReturnType<typeof vi.fn>;

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

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const findNode = (application: HTMLElement, name: string): HTMLButtonElement => {
  const label = [...application.querySelectorAll<HTMLElement>(".konqueror-tree-label, .konqueror-icon-item__label")]
    .find((candidate) => candidate.textContent === name);
  const node = label?.closest<HTMLButtonElement>("[data-konqueror-node-id]") ?? null;
  if (!node) throw new Error(`Missing ${name}`);
  return node;
};

const renderKonqueror = () => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <ApplicationLauncherContext.Provider value={{
          launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
          launchNewApplicationInstance,
        }}>
          <SharedVfsFixture><Konqueror windowId="konqueror-tabs" launchRequest={homeLaunchRequest} isActive focusRequestId={1} /></SharedVfsFixture>
        </ApplicationLauncherContext.Provider>
      </StrictMode>,
    );
  });
  const application = container.querySelector<HTMLElement>(".konqueror-application");
  if (!application) throw new Error("Konqueror missing");
  return application;
};

const openLocationNewTab = () => {
  click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((item) => item.textContent === "Location") ?? null);
  click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "New Tab") ?? null);
};

const openToolsMenu = () => {
  click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((item) => item.textContent === "Tools") ?? null);
};

const navigate = (application: HTMLElement, location: string) => {
  const input = application.querySelector<HTMLInputElement>("#konqueror-location");
  const form = application.querySelector<HTMLFormElement>("form[aria-label='Konqueror location bar']");
  if (!input || !form) throw new Error("Location bar missing");

  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, location);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

describe("Konqueror internal tabs", () => {
  it("keeps the first tab implicit, creates an active tab from Location, and restores the one-tab layout on close", () => {
    const application = renderKonqueror();
    expect(application.querySelector(".konqueror-tabbar")).toBeNull();

    openLocationNewTab();
    expect(application.querySelector(".konqueror-tabbar")).not.toBeNull();
    expect(application.querySelectorAll("[data-konqueror-tab-id]")).toHaveLength(2);
    expect(application.querySelector("[data-konqueror-tab-id='tab-2']")?.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector("[data-konqueror-tab-id='tab-2']")?.textContent).toBe("about:blank");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");
    expect(document.activeElement).toBe(application.querySelector("#konqueror-location"));
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();

    click(application.querySelector("button[aria-label='Close Current Tab']"));
    expect(application.querySelector(".konqueror-tabbar")).toBeNull();
    expect(application.querySelectorAll("[data-konqueror-tab-id]")).toHaveLength(0);
  });

  it("keeps location and selection on their exact tab, while New Tab is blank and Open in New Tab keeps its clicked target", () => {
    const application = renderKonqueror();
    const documents = findNode(application, "Documents");
    click(documents);
    openLocationNewTab();

    click(application.querySelector("[data-konqueror-tab-id='tab-1']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user");
    expect(findNode(application, "Documents").getAttribute("aria-selected")).toBe("true");

    click(application.querySelector("[data-konqueror-tab-id='tab-2']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");
    expect(application.querySelector(".konqueror-directory-viewport--blank")?.textContent).toBe("");
    click(application.querySelector("[data-konqueror-tab-id='tab-1']"));
    const activePictures = findNode(application, "Pictures");
    const activePicturesTarget = activePictures.querySelector<HTMLElement>(".konqueror-directory-item-hit-target") ?? activePictures;
    act(() => activePicturesTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 24, clientY: 28 })));
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Open in New Tab") ?? null);

    expect(application.querySelectorAll("[data-konqueror-tab-id]")).toHaveLength(3);
    expect(application.querySelector("[data-konqueror-tab-id='tab-3']")?.getAttribute("aria-selected")).toBe("true");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Pictures");
    expect(launchNewApplicationInstance).not.toHaveBeenCalled();
  });

  it("keeps Window tab actions window-scoped and transfers a detached TabSession through the launch intent", () => {
    const application = renderKonqueror();
    openLocationNewTab();

    click([...container.querySelectorAll<HTMLButtonElement>(".konqueror-menuitem")].find((item) => item.textContent === "Window") ?? null);
    const actions = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")];
    expect(actions.map((item) => item.textContent)).toEqual([
      "New Tab",
      "Duplicate Current Tab",
      "Detach Current Tab",
      "Close Current Tab",
    ]);
    click(actions.find((item) => item.textContent === "Detach Current Tab") ?? null);

    expect(launchNewApplicationInstance).toHaveBeenCalledWith("konqueror", {
      intent: expect.objectContaining({ type: "detach-konqueror-tab", tab: expect.objectContaining({ id: "tab-2" }) }),
    });
    expect(application.querySelector(".konqueror-tabbar")).toBeNull();
  });

  it("uses the exact active tab for Tools terminal cwd while blank tabs disable that action and Find File leaves navigation intact", () => {
    const application = renderKonqueror();

    openToolsMenu();
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Open Terminal") ?? null);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("konsole", {
      intent: { type: "open-working-directory", workingDirectory: "/home/user" },
    });

    openLocationNewTab();
    openToolsMenu();
    const blankTerminal = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Open Terminal");
    expect(blankTerminal?.disabled).toBe(true);
    const findFile = [...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Find File...");
    click(findFile ?? null);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("kfind");
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("");

    navigate(application, "/home/user/Pictures");
    openToolsMenu();
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Open Terminal") ?? null);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("konsole", {
      intent: { type: "open-working-directory", workingDirectory: "/home/user/Pictures" },
    });

    click(application.querySelector("[data-konqueror-tab-id='tab-1']"));
    openToolsMenu();
    click([...container.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].find((item) => item.textContent === "Open Terminal") ?? null);
    expect(launchNewApplicationInstance).toHaveBeenLastCalledWith("konsole", {
      intent: { type: "open-working-directory", workingDirectory: "/home/user" },
    });
  });
});
