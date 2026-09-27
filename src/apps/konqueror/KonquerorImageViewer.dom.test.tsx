// @vitest-environment jsdom
import { StrictMode, act, useMemo, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsFileNode, VfsState } from "../../vfs/types";
import { VfsContext } from "../../vfs/VfsContext";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { getVfsPathForNode } from "../../vfs/queries";
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;

const getProductionImage = (state: VfsState): VfsFileNode => {
  const image = Object.values(state.nodesById).find((node): node is VfsFileNode =>
    node.kind === "file" && node.parentId === state.specialLocations.pictures && node.content.kind === "asset-url",
  );
  if (!image) throw new Error("Production image missing");
  return image;
};

const productionImageId = getProductionImage(createInitialVfsState()).id;
const productionImagePath = (() => {
  const state = createInitialVfsState();
  const path = getVfsPathForNode(state, getProductionImage(state).id);
  if (!path.ok) throw new Error("Production image path missing");
  return path.value;
})();

const image = (id: string, name: string, parentId: string): VfsFileNode => ({
  id,
  name,
  parentId,
  kind: "file",
  encoding: "utf-8",
  mimeType: "image/png",
  content: { kind: "asset-url", url: "/assets/B-abc.png" },
  size: 4,
  createdAt: "2026-09-12T00:00:00.000Z",
  modifiedAt: "2026-09-12T00:00:00.000Z",
});

const createFixture = (): VfsState => {
  const state = createInitialVfsState();
  const pictures = state.nodesById["vfs-pictures"];
  const productionImage = getProductionImage(state);
  if (!pictures || pictures.kind !== "directory") throw new Error("Pictures fixture missing");
  const b = image("vfs-picture-b", "B.png", pictures.id);
  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [pictures.id]: { ...pictures, childIds: [productionImage.id, b.id] },
      [b.id]: b,
    },
  };
};

function VfsFixture({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<VfsState>(createFixture);
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

describe("Konqueror embedded image viewer", () => {
  it("opens the repository-generated image in the active tab with the dedicated classic toolbar and local viewer controls", () => {
    const setTitle = vi.fn();
    act(() => reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="images" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: productionImageId } }} isActive focusRequestId={1} onSetWindowTitle={setTitle} /></VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    ));
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Konqueror missing");
    const imageElement = application.querySelector<HTMLImageElement>(".konqueror-image-view__image");
    if (!imageElement) throw new Error("Image preview missing");

    expect(imageElement.getAttribute("src")).not.toMatch(/^data:/);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe(productionImagePath);
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("image");
    expect([...application.querySelectorAll<HTMLButtonElement>(".konqueror-toolbar .toolbar-button")].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop", "Cut", "Copy", "Paste", "Print",
      "Previous Image", "Next Image", "Zoom In", "Zoom Out", "Rotate Right", "New Konqueror Window",
    ]);
    expect(application.querySelector<HTMLSelectElement>("select[aria-label='Image zoom']")?.value).toBe("fit-window");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Previous Image']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Next Image']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Cut']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Copy']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Paste']")?.disabled).toBe(true);

    Object.defineProperties(imageElement, { naturalWidth: { value: 320 }, naturalHeight: { value: 200 } });
    act(() => imageElement.dispatchEvent(new Event("load", { bubbles: true })));
    expect(setTitle).toHaveBeenLastCalledWith(`${getProductionImage(createInitialVfsState()).name} - 320x200 - Konqueror`);

    click(application.querySelector("button[aria-label='Rotate Right']"));
    expect(application.querySelector(".konqueror-image-view")?.getAttribute("data-image-rotation")).toBe("90");
    click(application.querySelector("button[aria-label='Next Image']"));
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Pictures/B.png");
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Previous Image']")?.disabled).toBe(false);
  });

  it("keeps image zoom dimensions and toolbar transitions local to the preview surface", () => {
    const setTitle = vi.fn();
    act(() => reactRoot.render(
      <ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="image-zoom" launchRequest={{ requestId: 2, intent: { type: "open-file", nodeId: productionImageId } }} isActive focusRequestId={2} onSetWindowTitle={setTitle} /></VfsFixture>
      </ApplicationLauncherContext.Provider>,
    ));
    const application = container.querySelector<HTMLElement>(".konqueror-application");
    const imageElement = application?.querySelector<HTMLImageElement>(".konqueror-image-view__image");
    const zoom = application?.querySelector<HTMLSelectElement>("select[aria-label='Image zoom']");
    if (!application || !imageElement || !zoom) throw new Error("Image viewer controls missing");

    Object.defineProperties(imageElement, { naturalWidth: { value: 1000 }, naturalHeight: { value: 1000 } });
    act(() => imageElement.dispatchEvent(new Event("load", { bubbles: true })));
    expect(application.querySelector(".konqueror-image-view")?.getAttribute("data-image-zoom")).toBe("fit-window");
    expect(imageElement.style.width).toBe("");
    expect(imageElement.style.height).toBe("");

    act(() => {
      zoom.value = "200";
      zoom.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(application.querySelector(".konqueror-image-view")?.getAttribute("data-image-zoom")).toBe("200");
    expect(imageElement.style.width).toBe("2000px");
    expect(imageElement.style.height).toBe("2000px");

    click(application.querySelector("button[aria-label='Zoom Out']"));
    expect(application.querySelector(".konqueror-image-view")?.getAttribute("data-image-zoom")).toBe("100");
    expect(imageElement.style.width).toBe("1000px");
    expect(imageElement.style.height).toBe("1000px");
  });
});
