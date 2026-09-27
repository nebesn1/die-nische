// @vitest-environment jsdom
import { act, useMemo, useState, type ReactNode } from "react";
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

const clip: VfsFileNode = {
  id: "media-test-clip",
  name: "Clip.webm",
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "video/webm",
  content: { kind: "asset-url", url: "/assets/clip.webm" },
  size: 12,
  createdAt: "2026-09-12T00:00:00.000Z",
  modifiedAt: "2026-09-12T00:00:00.000Z",
};

const audioClip: VfsFileNode = {
  ...clip,
  id: "media-test-track",
  name: "Track.mp3",
  mimeType: "audio/mpeg",
  content: { kind: "asset-url", url: "/assets/track.mp3" },
};

const createFixture = (): VfsState => {
  const state = createInitialVfsState();
  const documents = state.nodesById[state.specialLocations.documents];
  if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [documents.id]: { ...documents, childIds: [...documents.childIds, clip.id, audioClip.id] },
      [clip.id]: clip,
      [audioClip.id]: audioClip,
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

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("Konqueror embedded media viewer", () => {
  it("opens video with shared KDE controls and the flat media toolbar", () => {
    act(() => reactRoot.render(
      <ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="media-video" launchRequest={{ requestId: 1, intent: { type: "open-file", nodeId: clip.id } }} isActive focusRequestId={1} /></VfsFixture>
      </ApplicationLauncherContext.Provider>,
    ));

    const application = container.querySelector<HTMLElement>(".konqueror-application");
    const video = application?.querySelector<HTMLVideoElement>("video.konqueror-media-view__element");
    if (!application || !video) throw new Error("Video viewer missing");

    expect(video.controls).toBe(false);
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute("src")).toBe("/assets/clip.webm");
    expect(application.querySelector(".konqueror-media-view--video")).not.toBeNull();
    expect(application.querySelector(".konqueror-media-view__stage")).not.toBeNull();
    expect(application.querySelector(".konqueror-media-controls")).not.toBeNull();
    expect([...application.querySelectorAll<HTMLButtonElement>(".konqueror-media-controls__transport button")].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Previous", "Play", "Pause", "Stop", "Next",
    ]);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Previous']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Next']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Play']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Pause']")?.disabled).toBe(true);
    expect(application.querySelector("button[aria-label='Play']")).not.toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("media");
    expect([...application.querySelectorAll<HTMLButtonElement>(".konqueror-toolbar .toolbar-button")].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Up", "Back", "Forward", "Home", "Reload", "Stop", "Cut", "Copy", "Paste", "Print", "New Konqueror Window",
    ]);
    expect(application.querySelector<HTMLButtonElement>("button[aria-label='Print']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Clip.webm");

    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    act(() => video.dispatchEvent(new Event("loadedmetadata", { bubbles: true })));
    expect(application.querySelector<HTMLInputElement>("input[aria-label='Seek']")?.disabled).toBe(false);
    expect(application.querySelector(".konqueror-media-controls__time")?.textContent).toBe("00:00 / 02:00");

    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    const seek = application.querySelector<HTMLInputElement>("input[aria-label='Seek']");
    if (!seek) throw new Error("Seek control missing");
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(seek, "65");
      seek.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(video.currentTime).toBe(65);
    expect(application.querySelector(".konqueror-media-controls__time")?.textContent).toBe("01:05 / 02:00");

    act(() => video.dispatchEvent(new Event("loadeddata", { bubbles: true })));
    expect(application.querySelector(".konqueror-media-view")?.getAttribute("data-media-status")).toBe("ready");
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Play']")?.disabled).toBe(false);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Pause']")?.disabled).toBe(true);
    click(application.querySelector("button[aria-label='Play']"));
    act(() => video.dispatchEvent(new Event("play", { bubbles: true })));
    expect(application.querySelector(".konqueror-media-view")?.getAttribute("data-media-status")).toBe("playing");
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Play']")?.disabled).toBe(true);
    expect(application.querySelector<HTMLButtonElement>(".konqueror-media-controls button[aria-label='Pause']")?.disabled).toBe(false);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    const volume = application.querySelector<HTMLInputElement>("input[aria-label='Volume']");
    if (!volume) throw new Error("Volume control missing");
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(volume, "40");
      volume.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(video.volume).toBe(0.4);
    click(application.querySelector("button[aria-label='Mute']"));
    expect(application.querySelector("button[aria-label='Unmute']")).not.toBeNull();

    click([...application.querySelectorAll<HTMLButtonElement>("button[aria-label='Stop']")].at(-1) ?? null);
    expect(application.querySelector(".konqueror-media-view")?.getAttribute("data-media-status")).toBe("stopped");
    expect(video.currentTime).toBe(0);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    click(application.querySelector("button[aria-label='Reload']"));
    expect(application.querySelector(".konqueror-media-view")?.getAttribute("data-media-status")).toBe("loading");
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });

  it("shows the media-only Player menu and navigates direct media siblings through history", () => {
    act(() => reactRoot.render(
      <ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="media-player" launchRequest={{ requestId: 3, intent: { type: "open-file", nodeId: clip.id } }} isActive focusRequestId={3} /></VfsFixture>
      </ApplicationLauncherContext.Provider>,
    ));

    const application = container.querySelector<HTMLElement>(".konqueror-application");
    if (!application) throw new Error("Konqueror application missing");
    const playerTrigger = [...application.querySelectorAll<HTMLButtonElement>(".konqueror-menubar > div > button")]
      .find((button) => button.textContent === "Player");
    expect(playerTrigger).not.toBeUndefined();
    click(playerTrigger ?? null);

    const playerPopup = application.querySelector<HTMLElement>(".konqueror-menu-popup");
    if (!playerPopup) throw new Error("Player menu missing");
    expect([...playerPopup.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")].map((button) => button.textContent)).toEqual([
      "Play", "Pause", "Stop", "Next", "Previous",
    ]);
    expect(playerPopup.querySelector(".konqueror-menu-separator")).toBeNull();
    const nextMenuAction = [...playerPopup.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")]
      .find((button) => button.textContent === "Next");
    expect(nextMenuAction).not.toBeUndefined();

    click(nextMenuAction ?? null);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Track.mp3");
    expect(application.querySelector<HTMLAudioElement>("audio.konqueror-media-view__element")?.autoplay).toBe(false);
    expect(application.querySelector(".konqueror-media-view--video")).toBeNull();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    const back = application.querySelector<HTMLButtonElement>(".konqueror-toolbar button[aria-label='Back']");
    click(back);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Clip.webm");
  });

  it("opens audio through the same file route and pauses when navigation leaves the media tab", () => {
    const audioPath = getVfsPathForNode(createFixture(), audioClip.id);
    if (!audioPath.ok) throw new Error("Audio path missing");

    act(() => reactRoot.render(
      <ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture><Konqueror windowId="media-audio" launchRequest={{ requestId: 2, intent: { type: "open-file", nodeId: audioClip.id } }} isActive focusRequestId={2} /></VfsFixture>
      </ApplicationLauncherContext.Provider>,
    ));

    const application = container.querySelector<HTMLElement>(".konqueror-application");
    const audioElement = application?.querySelector<HTMLAudioElement>("audio.konqueror-media-view__element");
    if (!application || !audioElement) throw new Error("Audio viewer missing");

    expect(audioElement.controls).toBe(false);
    expect(audioElement.hasAttribute("controls")).toBe(false);
    expect(audioElement.autoplay).toBe(false);
    expect(audioElement.getAttribute("src")).not.toMatch(/^data:/);
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe(audioPath.value);
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("media");

    navigate(application, "/home/user/Documents/Welcome.md");
    expect(application.querySelector(".konqueror-media-view")).toBeNull();
    expect(application.querySelector<HTMLInputElement>("#konqueror-location")?.value).toBe("/home/user/Documents/Welcome.md");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});
