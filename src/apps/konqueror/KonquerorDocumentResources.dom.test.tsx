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
import { Konqueror } from "./Konqueror";

let container: HTMLDivElement;
let reactRoot: Root;

const timestamp = "2026-09-13T00:00:00.000Z";

const textFile = (id: string, name: string, parentId: string, text: string, mimeType: string): VfsFileNode => ({
  id,
  name,
  parentId,
  kind: "file",
  encoding: "utf-8",
  mimeType,
  content: { kind: "text", text },
  size: text.length,
  createdAt: timestamp,
  modifiedAt: timestamp,
});

const fixtureImage: VfsFileNode = {
  id: "phase566-image",
  name: "image.png",
  parentId: "vfs-pictures",
  kind: "file",
  encoding: "utf-8",
  mimeType: "image/png",
  content: { kind: "asset-url", url: "/assets/phase566-image.png" },
  size: 1,
  createdAt: timestamp,
  modifiedAt: timestamp,
};

const fixtureVideo: VfsFileNode = {
  id: "phase566-video",
  name: "demo.mp4",
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "video/mp4",
  content: { kind: "asset-url", url: "/assets/phase566-video.mp4" },
  size: 1,
  createdAt: timestamp,
  modifiedAt: timestamp,
};

const fixtureAudio: VfsFileNode = {
  id: "phase566-audio",
  name: "demo.mp3",
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "audio/mpeg",
  content: { kind: "asset-url", url: "/assets/phase566-audio.mp3" },
  size: 1,
  createdAt: timestamp,
  modifiedAt: timestamp,
};

const article = textFile(
  "phase566-article",
  "Article.md",
  "vfs-documents",
  "---\ntitle: Embedded Article\npublication:\n  status: draft\n---\n# Article\n\n<video controls poster=\"../Pictures/image.png\"><source src=\"./demo.mp4\" type=\"video/mp4\">Video fallback</video>\n\n<audio controls src=\"./demo.mp3\">Audio fallback</audio>\n\n![Picture](../Pictures/image.png) ![Missing](../Pictures/missing.png) ![Wrong](Notes.txt) ![Remote](https://example.com/image.png)\n\n[Notes](Notes.txt) [Pictures](../Pictures/) [Image](../Pictures/image.png) [Fragment](#part) [External](https://example.com/path) [Bad](javascript:alert(1))",
  "text/markdown",
);
const notes = textFile("phase566-notes", "Notes.txt", "vfs-documents", "Fixture notes", "text/plain");
const html = textFile(
  "phase566-html",
  "Page.html",
  "vfs-documents",
  "<h1>HTML</h1><video controls src='../Documents/demo.mp4' poster='../Pictures/image.png'><source src='../Documents/demo.mp4' type='video/mp4'>Video fallback</video><audio controls src='../Documents/demo.mp3'>Audio fallback</audio><img src='../Pictures/image.png' alt='Picture'><a href='Notes.txt'>Notes</a><a href='../Pictures/'>Pictures</a><a href='../Pictures/image.png'>Image</a><a href='https://example.com/path'>External</a><a href='javascript:alert(1)' onclick='alert(1)'>Bad</a><script>window.phase566Executed = true</script><iframe src='https://example.com'></iframe>",
  "text/html",
);

const createFixture = (): VfsState => {
  const state = createInitialVfsState();
  const documents = state.nodesById["vfs-documents"];
  const pictures = state.nodesById["vfs-pictures"];
  if (!documents || documents.kind !== "directory" || !pictures || pictures.kind !== "directory") {
    throw new Error("Phase 5.66 VFS fixture locations missing");
  }
  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [documents.id]: { ...documents, childIds: [article.id, notes.id, html.id, fixtureVideo.id, fixtureAudio.id] },
      [pictures.id]: { ...pictures, childIds: [fixtureImage.id] },
      [article.id]: article,
      [notes.id]: notes,
      [html.id]: html,
      [fixtureVideo.id]: fixtureVideo,
      [fixtureAudio.id]: fixtureAudio,
      [fixtureImage.id]: fixtureImage,
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

const renderKonquerors = (...fileIds: readonly string[]) => {
  act(() => {
    reactRoot.render(
      <StrictMode><ApplicationLauncherContext.Provider value={launchers}>
        <VfsFixture>{fileIds.map((nodeId, index) => (
          <Konqueror key={nodeId} windowId={`phase566-${index}`} launchRequest={{ requestId: index + 1, intent: { type: "open-file", nodeId } }} isActive focusRequestId={index + 1} />
        ))}</VfsFixture>
      </ApplicationLauncherContext.Provider></StrictMode>,
    );
  });
  return [...container.querySelectorAll<HTMLElement>(".konqueror-application")];
};

const click = (element: HTMLElement | null) => {
  if (!element) throw new Error("Missing control");
  act(() => element.click());
};

const location = (application: HTMLElement) => application.querySelector<HTMLInputElement>("#konqueror-location")?.value;

const link = (application: HTMLElement, href: string) => application.querySelector<HTMLAnchorElement>(`a[href='${href}']`);

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

describe("Konqueror Markdown and HTML VFS resources", () => {
  it("renders Markdown VFS images in the document view without exposing the VFS reference to the browser", () => {
    const [application] = renderKonquerors(article.id);
    if (!application) throw new Error("Konqueror missing");

    const image = application.querySelector<HTMLImageElement>("img[alt='Picture']");
    expect(image?.getAttribute("src")).toBe("/assets/phase566-image.png");
    expect(image?.getAttribute("src")).not.toBe("../Pictures/image.png");
    expect([...application.querySelectorAll(".konqueror-preview-image-placeholder")].map((placeholder) => placeholder.textContent)).toEqual([
      "[Image: Missing]",
      "[Image: Wrong]",
      "[Image: Remote]",
    ]);
    expect(application.querySelector("a[href='#part']")).toBeNull();
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("document");
    expect(location(application)).toBe("/home/user/Documents/Article.md");
  });

  it("uses the normal same-tab navigation pipeline for Markdown file, directory, and image links", () => {
    const [application] = renderKonquerors(article.id);
    if (!application) throw new Error("Konqueror missing");

    click(link(application, "/home/user/Documents/Notes.txt"));
    expect(location(application)).toBe("/home/user/Documents/Notes.txt");
    expect(application.textContent).toContain("Fixture notes");
    click(application.querySelector("button[aria-label='Back']"));
    expect(location(application)).toBe("/home/user/Documents/Article.md");

    click(link(application, "/home/user/Pictures"));
    expect(location(application)).toBe("/home/user/Pictures");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("resource-manager");
    click(application.querySelector("button[aria-label='Back']"));

    click(link(application, "/home/user/Pictures/image.png"));
    expect(location(application)).toBe("/home/user/Pictures/image.png");
    expect(application.querySelector(".konqueror-toolbar")?.getAttribute("data-toolbar-profile")).toBe("image");
    click(application.querySelector("button[aria-label='Back']"));
    expect(location(application)).toBe("/home/user/Documents/Article.md");
  });

  it("renders HTML VFS images and keeps its sanitizer and unsupported-reference boundaries", () => {
    const [application] = renderKonquerors(html.id);
    if (!application) throw new Error("Konqueror missing");

    expect(application.querySelector<HTMLImageElement>("img[alt='Picture']")?.getAttribute("src")).toBe("/assets/phase566-image.png");
    expect(application.querySelector("script")).toBeNull();
    expect(application.querySelector("iframe")).toBeNull();
    expect(application.querySelector("a[href^='javascript:']")).toBeNull();
    expect(application.textContent).not.toContain("window.phase566Executed");
    expect(application.querySelector(".konqueror-preview-link")?.textContent).toBe("Bad");

    click(link(application, "/home/user/Documents/Notes.txt"));
    expect(location(application)).toBe("/home/user/Documents/Notes.txt");
    click(application.querySelector("button[aria-label='Back']"));
    click(link(application, "/home/user/Pictures"));
    expect(location(application)).toBe("/home/user/Pictures");
    click(application.querySelector("button[aria-label='Back']"));
    click(link(application, "/home/user/Pictures/image.png"));
    expect(application.querySelector(".konqueror-image-view")).not.toBeNull();
    click(application.querySelector("button[aria-label='Back']"));
    click(link(application, "https://example.com/path"));
    expect(location(application)).toBe("https://example.com/path");
    expect(application.querySelector(".konqueror-external-web-view__frame")).not.toBeNull();
  });

  it("renders explicit Markdown and HTML media through the shared asset-url boundary", () => {
    const [markdownApplication, htmlApplication] = renderKonquerors(article.id, html.id);
    if (!markdownApplication || !htmlApplication) throw new Error("Konqueror missing");

    const markdownVideo = markdownApplication.querySelector<HTMLVideoElement>("video");
    expect(markdownVideo?.getAttribute("src")).toBeNull();
    expect(markdownVideo?.getAttribute("poster")).toBe("/assets/phase566-image.png");
    expect(markdownVideo?.querySelector("source")?.getAttribute("src")).toBe("/assets/phase566-video.mp4");
    expect(markdownApplication.querySelector("audio")?.getAttribute("src")).toBe("/assets/phase566-audio.mp3");
    expect(markdownApplication.querySelector("video[autoplay], audio[autoplay]")).toBeNull();
    expect(markdownApplication.textContent).toContain("Video fallback");
    expect(markdownApplication.textContent).toContain("Audio fallback");
    expect(markdownApplication.querySelector(".konqueror-preview-document__canvas")?.textContent).not.toContain("publication");
    expect(markdownApplication.querySelector(".konqueror-preview-document__canvas")?.textContent).not.toContain("Embedded Article");

    const htmlVideo = htmlApplication.querySelector<HTMLVideoElement>("video");
    expect(htmlVideo?.getAttribute("src")).toBe("/assets/phase566-video.mp4");
    expect(htmlVideo?.getAttribute("poster")).toBe("/assets/phase566-image.png");
    expect(htmlVideo?.querySelector("source")?.getAttribute("src")).toBe("/assets/phase566-video.mp4");
    expect(htmlApplication.querySelector("audio")?.getAttribute("src")).toBe("/assets/phase566-audio.mp3");
    expect(htmlApplication.querySelector("video[onclick], audio[onclick]")).toBeNull();
  });

  it("keeps document-link navigation local to the invoking Konqueror instance", () => {
    const [applicationA, applicationB] = renderKonquerors(article.id, html.id);
    if (!applicationA || !applicationB) throw new Error("Konqueror instances missing");

    click(link(applicationB, "/home/user/Documents/Notes.txt"));
    expect(location(applicationB)).toBe("/home/user/Documents/Notes.txt");
    expect(location(applicationA)).toBe("/home/user/Documents/Article.md");
  });
});
