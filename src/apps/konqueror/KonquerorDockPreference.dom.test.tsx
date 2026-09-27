// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationLaunchRequest, LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { DesktopPreferencesProvider } from "../../preferences/DesktopPreferencesContext";
import { DEFAULT_DESKTOP_PREFERENCES } from "../../preferences/desktopPreferences";
import {
  DESKTOP_PREFERENCES_STORAGE_KEY,
  createDesktopPreferencesStorage,
  parsePersistedDesktopPreferences,
  serializeDesktopPreferences,
  type DesktopPreferencesStorage,
  type DesktopPreferencesStorageBackend,
} from "../../preferences/desktopPreferencesPersistence";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;
let capturedPointerIds = new Set<number>();
let originalSetPointerCapture: PropertyDescriptor | undefined;
let originalReleasePointerCapture: PropertyDescriptor | undefined;
let originalHasPointerCapture: PropertyDescriptor | undefined;
let vfsContext: VfsContextValue;

const homeLaunchRequest: ApplicationLaunchRequest = {
  requestId: 1,
  intent: { type: "open-special-location", location: "home" },
};

const startLaunchRequest: ApplicationLaunchRequest = {
  requestId: 2,
  intent: { type: "open-konqueror-start" },
};

const trashLaunchRequest: ApplicationLaunchRequest = {
  requestId: 3,
  intent: { type: "open-special-location", location: "trash" },
};

type MemoryStorage = DesktopPreferencesStorageBackend & {
  readonly values: Map<string, string>;
  readonly setItemSpy: ReturnType<typeof vi.fn>;
};

const createMemoryStorage = (initial: Readonly<Record<string, string>> = {}): MemoryStorage => {
  const values = new Map(Object.entries(initial));
  const setItemSpy = vi.fn((key: string, value: string) => values.set(key, value));

  return {
    values,
    setItemSpy,
    getItem: (key) => values.get(key) ?? null,
    setItem: setItemSpy,
    removeItem: (key) => values.delete(key),
  };
};

const createVfsContextValue = (): VfsContextValue => {
  const state = createInitialVfsState();

  return {
    state,
    ...createVfsOperations(
      () => state,
      () => undefined,
    ),
  };
};

const rect = (left: number, top: number, right: number, bottom: number): DOMRect => ({
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
  top,
  right,
  bottom,
  left,
  toJSON: () => ({}),
}) as DOMRect;

const renderKonquerors = (
  windowIds: readonly string[],
  storage: DesktopPreferencesStorage,
  launchRequest: ApplicationLaunchRequest = homeLaunchRequest,
): void => {
  act(() => {
    reactRoot.render(
      <StrictMode>
        <DesktopPreferencesProvider storage={storage}>
          <ApplicationLauncherContext.Provider value={{
            launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
            launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
          }}>
            <VfsContext.Provider value={vfsContext}>
              {windowIds.map((windowId, index) => (
                <Konqueror key={windowId} windowId={windowId} launchRequest={launchRequest} isActive={index === 0} focusRequestId={index === 0 ? 1 : 0} />
              ))}
            </VfsContext.Provider>
          </ApplicationLauncherContext.Provider>
        </DesktopPreferencesProvider>
      </StrictMode>,
    );
  });
};

const getApplication = (index: number): HTMLElement => {
  const application = container.querySelectorAll<HTMLElement>(".konqueror-application")[index];
  if (!application) throw new Error(`Missing Konqueror application ${index}`);
  return application;
};

const getGrip = (application: HTMLElement, band: "toolbar" | "location"): HTMLElement => {
  const grip = application.querySelector<HTMLElement>(`[data-konqueror-dock-grip='${band}']`);
  if (!grip) throw new Error(`Missing ${band} grip`);
  return grip;
};

const getDockOrder = (application: HTMLElement): string | undefined =>
  application.querySelector<HTMLElement>(".konqueror-dock-area")?.dataset.dockOrder;

const getResourceViewMode = (application: HTMLElement): string | undefined =>
  application.querySelector<HTMLElement>("[data-resource-view]")?.dataset.resourceView;

const getResourceZoom = (application: HTMLElement): string | undefined =>
  application.querySelector<HTMLElement>("[data-resource-view]")?.dataset.resourceZoom;

const click = (element: HTMLElement | null): void => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const getMenuButton = (application: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menubar button")]
    .find((button) => button.textContent === label);

const dispatchPointer = (
  target: HTMLElement,
  type: string,
  pointerId: number,
  clientY: number,
  clientX = 20,
): void => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY, cancelable: true });
  Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: pointerId } });
  act(() => target.dispatchEvent(event));
};

const swap = (application: HTMLElement, band: "toolbar" | "location", pointerId: number, startY: number, endY: number): void => {
  const grip = getGrip(application, band);
  dispatchPointer(grip, "pointerdown", pointerId, startY);
  dispatchPointer(grip, "pointermove", pointerId, endY);
  dispatchPointer(grip, "pointerup", pointerId, endY);
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vfsContext = createVfsContextValue();
  capturedPointerIds = new Set();
  originalSetPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "setPointerCapture");
  originalReleasePointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "releasePointerCapture");
  originalHasPointerCapture = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hasPointerCapture");
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.add(pointerId),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.delete(pointerId),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: (pointerId: number) => capturedPointerIds.has(pointerId),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("konqueror-dock-area")) return rect(0, 0, 240, 60);
    if (this.dataset.konquerorDockSlot === "1") return rect(0, 0, 240, 30);
    if (this.dataset.konquerorDockSlot === "2") return rect(0, 30, 240, 60);
    return rect(0, 0, 0, 0);
  });
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
  if (originalSetPointerCapture) Object.defineProperty(HTMLElement.prototype, "setPointerCapture", originalSetPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
  if (originalReleasePointerCapture) Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", originalReleasePointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture;
  if (originalHasPointerCapture) Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", originalHasPointerCapture);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).hasPointerCapture;
});

describe("Konqueror docking and Resource view preference persistence", () => {
  it("seeds Resource instances from the saved view mode without a mount write, including Start Page to Home", () => {
    const backend = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorDockOrder: "location-toolbar",
        konquerorResourceViewMode: "icons",
        konquerorResourceTreeZoom: "small",
        konquerorResourceIconZoom: "large",
      }),
    });
    const storage = createDesktopPreferencesStorage(() => backend);

    renderKonquerors(["konqueror-a"], storage);
    expect(getDockOrder(getApplication(0))).toBe("location-toolbar");
    expect(getResourceViewMode(getApplication(0))).toBe("icons");
    expect(getResourceZoom(getApplication(0))).toBe("large");
    expect(backend.setItemSpy).not.toHaveBeenCalled();

    act(() => reactRoot.unmount());
    reactRoot = createRoot(container);
    vfsContext = createVfsContextValue();
    renderKonquerors(["konqueror-b"], storage, startLaunchRequest);
    expect(getResourceViewMode(getApplication(0))).toBeUndefined();
    click(getApplication(0).querySelector<HTMLElement>("button[aria-label='Home']"));
    expect(getResourceViewMode(getApplication(0))).toBe("icons");
    expect(getResourceZoom(getApplication(0))).toBe("large");
    expect(backend.setItemSpy).not.toHaveBeenCalled();
  });

  it("keeps Resource view mode local while explicit changes seed only future Konqueror windows", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a", "konqueror-b"], storage);
    const first = getApplication(0);
    const second = getApplication(1);

    expect(getResourceViewMode(first)).toBe("tree");
    expect(getResourceViewMode(second)).toBe("tree");
    click(first.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(getResourceViewMode(first)).toBe("icons");
    expect(getResourceViewMode(second)).toBe("tree");
    expect(backend.setItemSpy).toHaveBeenCalledTimes(1);
    click(first.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(backend.setItemSpy).toHaveBeenCalledTimes(1);

    renderKonquerors(["konqueror-a", "konqueror-b", "konqueror-c"], storage);
    expect(getResourceViewMode(getApplication(2))).toBe("icons");
    click(getApplication(0).querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(getResourceViewMode(getApplication(0))).toBe("tree");
    expect(getResourceViewMode(getApplication(2))).toBe("icons");

    renderKonquerors(["konqueror-a", "konqueror-b", "konqueror-c", "konqueror-d"], storage);
    expect(getResourceViewMode(getApplication(3))).toBe("tree");
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: { ...DEFAULT_DESKTOP_PREFERENCES, konquerorResourceViewMode: "tree" },
    });
  });

  it("uses the same persisted view-mode authority from the View menu", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a"], storage);
    const application = getApplication(0);

    click(getMenuButton(application, "View") ?? null);
    click(document.querySelector<HTMLElement>("button[data-submenu-id='view-mode']"));
    click(document.querySelector<HTMLElement>("button[role='menuitemradio'][title='Icon View']"));

    expect(getResourceViewMode(application)).toBe("icons");
    expect(backend.setItemSpy).toHaveBeenCalledTimes(1);
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: { ...DEFAULT_DESKTOP_PREFERENCES, konquerorResourceViewMode: "icons" },
    });
  });

  it("keeps dock and Resource view preferences independent while preserving separate Tree/Icon zoom", () => {
    const backend = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorDockOrder: "location-toolbar",
        konquerorResourceViewMode: "icons",
      }),
    });
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a"], storage);
    const application = getApplication(0);

    expect(getDockOrder(application)).toBe("location-toolbar");
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='normal']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='large']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='normal']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    expect(application.querySelector("[data-resource-view='tree'][data-resource-zoom='small']")).not.toBeNull();
    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(application.querySelector("[data-resource-view='icons'][data-resource-zoom='large']")).not.toBeNull();

    swap(application, "toolbar", 1, 45, 10);
    expect(getDockOrder(application)).toBe("toolbar-location");
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: {
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorDockOrder: "toolbar-location",
        konquerorResourceViewMode: "icons",
        konquerorResourceTreeZoom: "small",
        konquerorResourceIconZoom: "large",
      },
    });
  });

  it("seeds independent persisted Tree and Icon zoom defaults without writing on mount", () => {
    const backend = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorResourceViewMode: "icons",
        konquerorResourceTreeZoom: "small",
        konquerorResourceIconZoom: "extra-large",
      }),
    });
    const storage = createDesktopPreferencesStorage(() => backend);

    renderKonquerors(["konqueror-a"], storage);
    const application = getApplication(0);
    expect(getResourceViewMode(application)).toBe("icons");
    expect(getResourceZoom(application)).toBe("extra-large");
    click(application.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(getResourceViewMode(application)).toBe("tree");
    expect(getResourceZoom(application)).toBe("small");
    expect(backend.setItemSpy).toHaveBeenCalledTimes(1);
  });

  it("persists only the changed Resource zoom while open windows retain their local levels", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a", "konqueror-b"], storage);
    const first = getApplication(0);
    const second = getApplication(1);

    expect(getResourceZoom(first)).toBe("normal");
    expect(getResourceZoom(second)).toBe("normal");
    click(first.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(getResourceZoom(first)).toBe("large");
    expect(getResourceZoom(second)).toBe("normal");
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: { ...DEFAULT_DESKTOP_PREFERENCES, konquerorResourceTreeZoom: "large" },
    });

    click(first.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    expect(getResourceZoom(first)).toBe("normal");
    click(first.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(getResourceZoom(first)).toBe("large");
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: {
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorResourceViewMode: "icons",
        konquerorResourceTreeZoom: "large",
        konquerorResourceIconZoom: "large",
      },
    });

    renderKonquerors(["konqueror-a", "konqueror-b", "konqueror-c"], storage);
    const third = getApplication(2);
    expect(getResourceViewMode(third)).toBe("icons");
    expect(getResourceZoom(third)).toBe("large");
    click(third.querySelector<HTMLElement>("button[aria-label='Tree View']"));
    expect(getResourceZoom(third)).toBe("large");
  });

  it("does not write a Resource zoom preference at its boundary and retains local zoom if saving fails", () => {
    const save = vi.fn(() => ({ type: "write-failed" as const }));
    const storage: DesktopPreferencesStorage = {
      load: () => ({ type: "missing", preferences: DEFAULT_DESKTOP_PREFERENCES }),
      save,
    };
    renderKonquerors(["konqueror-a"], storage);
    const application = getApplication(0);

    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    expect(getResourceZoom(application)).toBe("small");
    expect(save).toHaveBeenCalledTimes(1);
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom Out']"));
    expect(getResourceZoom(application)).toBe("small");
    expect(save).toHaveBeenCalledTimes(1);

    click(application.querySelector<HTMLElement>("button[aria-label='Icon View']"));
    click(application.querySelector<HTMLElement>("button[aria-label='Zoom In']"));
    expect(getResourceZoom(application)).toBe("large");
    expect(save).toHaveBeenCalledTimes(3);
  });

  it("uses the persisted Resource view mode for Trash without enabling sysinfo-only controls", () => {
    const backend = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorResourceViewMode: "icons",
      }),
    });
    const storage = createDesktopPreferencesStorage(() => backend);

    renderKonquerors(["konqueror-trash"], storage, trashLaunchRequest);

    expect(getResourceViewMode(getApplication(0))).toBe("icons");
    expect(getApplication(0).querySelector<HTMLButtonElement>("button[aria-label='Icon View']")?.disabled).toBe(false);
  });

  it("keeps the local Resource view change when persistence cannot write", () => {
    const save = vi.fn(() => ({ type: "write-failed" as const }));
    const storage: DesktopPreferencesStorage = {
      load: () => ({ type: "missing", preferences: DEFAULT_DESKTOP_PREFERENCES }),
      save,
    };
    renderKonquerors(["konqueror-a"], storage);

    click(getApplication(0).querySelector<HTMLElement>("button[aria-label='Icon View']"));

    expect(getResourceViewMode(getApplication(0))).toBe("icons");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("falls back to Tree View when the preference adapter cannot read", () => {
    const storage: DesktopPreferencesStorage = {
      load: () => ({ type: "read-failed", preferences: DEFAULT_DESKTOP_PREFERENCES }),
      save: vi.fn(() => ({ type: "saved" as const })),
    };
    renderKonquerors(["konqueror-a"], storage);

    expect(getResourceViewMode(getApplication(0))).toBe("tree");
    expect(getResourceZoom(getApplication(0))).toBe("normal");
  });

  it("uses the KDE3 Toolbar/Location order when no stored preference exists", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);

    renderKonquerors(["konqueror-a"], storage);

    expect(getDockOrder(getApplication(0))).toBe("toolbar-location");
    expect(backend.setItemSpy).not.toHaveBeenCalled();
  });

  it("seeds a new instance from the persisted default without writing during mount", () => {
    const backend = createMemoryStorage({
      [DESKTOP_PREFERENCES_STORAGE_KEY]: serializeDesktopPreferences({
        ...DEFAULT_DESKTOP_PREFERENCES,
        konquerorDockOrder: "location-toolbar",
      }),
    });
    const storage = createDesktopPreferencesStorage(() => backend);

    renderKonquerors(["konqueror-a"], storage);

    expect(getDockOrder(getApplication(0))).toBe("location-toolbar");
    expect(backend.setItemSpy).not.toHaveBeenCalled();

    act(() => reactRoot.unmount());
    reactRoot = createRoot(container);
    vfsContext = createVfsContextValue();
    renderKonquerors(["konqueror-b"], storage);
    expect(getDockOrder(getApplication(0))).toBe("location-toolbar");
    expect(backend.setItemSpy).not.toHaveBeenCalled();
  });

  it("writes once only for a committed order change and never for preview or cancelled drags", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a"], storage);
    const application = getApplication(0);
    const toolbarGrip = getGrip(application, "toolbar");

    dispatchPointer(toolbarGrip, "pointerdown", 1, 10);
    dispatchPointer(toolbarGrip, "pointermove", 1, 45);
    expect(getDockOrder(application)).toBe("location-toolbar");
    expect(backend.setItemSpy).not.toHaveBeenCalled();
    dispatchPointer(toolbarGrip, "pointermove", 1, 45, 300);
    dispatchPointer(toolbarGrip, "pointerup", 1, 45, 300);
    expect(getDockOrder(application)).toBe("toolbar-location");
    expect(backend.setItemSpy).not.toHaveBeenCalled();

    dispatchPointer(toolbarGrip, "pointerdown", 2, 10);
    dispatchPointer(toolbarGrip, "pointermove", 2, 45);
    dispatchPointer(toolbarGrip, "pointercancel", 2, 45);
    expect(backend.setItemSpy).not.toHaveBeenCalled();

    dispatchPointer(toolbarGrip, "pointerdown", 3, 10);
    dispatchPointer(toolbarGrip, "pointermove", 3, 45);
    dispatchPointer(toolbarGrip, "lostpointercapture", 3, 45);
    expect(backend.setItemSpy).not.toHaveBeenCalled();

    swap(application, "toolbar", 4, 10, 45);
    expect(getDockOrder(application)).toBe("location-toolbar");
    expect(backend.setItemSpy).toHaveBeenCalledTimes(1);
    expect(parsePersistedDesktopPreferences(backend.values.get(DESKTOP_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      type: "valid",
      preferences: { ...DEFAULT_DESKTOP_PREFERENCES, konquerorDockOrder: "location-toolbar" },
    });

    swap(application, "location", 5, 10, 45);
    expect(getDockOrder(application)).toBe("toolbar-location");
    expect(backend.setItemSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps existing windows local while future instances inherit the latest saved default", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a", "konqueror-b"], storage);
    const first = getApplication(0);
    const second = getApplication(1);

    expect(getDockOrder(first)).toBe("toolbar-location");
    expect(getDockOrder(second)).toBe("toolbar-location");
    swap(first, "toolbar", 1, 10, 45);
    expect(getDockOrder(first)).toBe("location-toolbar");
    expect(getDockOrder(second)).toBe("toolbar-location");

    renderKonquerors(["konqueror-a", "konqueror-b", "konqueror-c"], storage);
    expect(getDockOrder(getApplication(0))).toBe("location-toolbar");
    expect(getDockOrder(getApplication(1))).toBe("toolbar-location");
    expect(getDockOrder(getApplication(2))).toBe("location-toolbar");

    swap(getApplication(0), "location", 2, 10, 45);
    renderKonquerors(["konqueror-a", "konqueror-b", "konqueror-c", "konqueror-d"], storage);
    expect(getDockOrder(getApplication(0))).toBe("toolbar-location");
    expect(getDockOrder(getApplication(1))).toBe("toolbar-location");
    expect(getDockOrder(getApplication(2))).toBe("location-toolbar");
    expect(getDockOrder(getApplication(3))).toBe("toolbar-location");
  });

  it("keeps the local committed order when persistence cannot write", () => {
    const save = vi.fn(() => ({ type: "write-failed" as const }));
    const storage: DesktopPreferencesStorage = {
      load: () => ({ type: "missing", preferences: DEFAULT_DESKTOP_PREFERENCES }),
      save,
    };
    renderKonquerors(["konqueror-a"], storage);

    swap(getApplication(0), "toolbar", 1, 10, 45);

    expect(getDockOrder(getApplication(0))).toBe("location-toolbar");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not persist a preview when its owner unmounts", () => {
    const backend = createMemoryStorage();
    const storage = createDesktopPreferencesStorage(() => backend);
    renderKonquerors(["konqueror-a"], storage);
    const grip = getGrip(getApplication(0), "toolbar");

    dispatchPointer(grip, "pointerdown", 1, 10);
    dispatchPointer(grip, "pointermove", 1, 45);
    act(() => reactRoot.render(<div />));

    expect(backend.setItemSpy).not.toHaveBeenCalled();
  });
});
