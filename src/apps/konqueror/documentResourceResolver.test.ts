import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsFileNode, VfsState } from "../../vfs/types";
import { getKonquerorDocumentImageSource, getKonquerorDocumentResourceSource, resolveDocumentResourceReference } from "./documentResourceResolver";

const fixtureImage: VfsFileNode = {
  id: "phase566-image",
  name: "image.png",
  parentId: "vfs-pictures",
  kind: "file",
  encoding: "utf-8",
  mimeType: "image/png",
  content: { kind: "asset-url", url: "/assets/phase566-image.png" },
  size: 1,
  createdAt: "2026-09-13T00:00:00.000Z",
  modifiedAt: "2026-09-13T00:00:00.000Z",
};
const fixtureImageParentId = "vfs-pictures";
const fixtureVideo: VfsFileNode = {
  id: "phase566-video",
  name: "demo.mp4",
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "video/mp4",
  content: { kind: "asset-url", url: "/assets/phase566-video.mp4" },
  size: 1,
  createdAt: "2026-09-13T00:00:00.000Z",
  modifiedAt: "2026-09-13T00:00:00.000Z",
};

const createFixture = (): VfsState => {
  const state = createInitialVfsState();
  const pictures = state.nodesById[fixtureImageParentId];
  const documents = state.nodesById["vfs-documents"];
  if (!pictures || pictures.kind !== "directory" || !documents || documents.kind !== "directory") throw new Error("Document fixtures missing");
  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [pictures.id]: { ...pictures, childIds: [...pictures.childIds, fixtureImage.id] },
      [documents.id]: { ...documents, childIds: [...documents.childIds, fixtureVideo.id] },
      [fixtureImage.id]: fixtureImage,
      [fixtureVideo.id]: fixtureVideo,
    },
  };
};

describe("Konqueror document resource references", () => {
  it("resolves relative, absolute, and dot-segment VFS paths from the document parent", () => {
    const documentPath = "/home/user/Documents/Projects/2026/Post.md";
    expect(resolveDocumentResourceReference(documentPath, "../../../Pictures/image.png")).toEqual({ kind: "vfs", path: "/home/user/Pictures/image.png" });
    expect(resolveDocumentResourceReference(documentPath, "./nested/../Post.md")).toEqual({ kind: "vfs", path: "/home/user/Documents/Projects/2026/Post.md" });
    expect(resolveDocumentResourceReference(documentPath, "/home/user/Documents/Notes.txt")).toEqual({ kind: "vfs", path: "/home/user/Documents/Notes.txt" });
  });

  it("classifies HTTPS separately and blocks fragments, queries, and dangerous schemes", () => {
    expect(resolveDocumentResourceReference("/home/user/Documents/Article.md", "https://example.com/path")).toEqual({ kind: "external", url: "https://example.com/path" });
    expect(resolveDocumentResourceReference("/home/user/Documents/Article.md", "#section")).toEqual({ kind: "fragment", fragment: "section" });
    ["javascript:alert(1)", "data:image/png;base64,x", "file:///tmp/x", "Notes.txt?x=1", ""].forEach((reference) => {
      expect(resolveDocumentResourceReference("/home/user/Documents/Article.md", reference)).toEqual({ kind: "unsupported" });
    });
  });

  it("uses the shared VFS image capability and never turns missing or text nodes into browser sources", () => {
    const state = createFixture();
    expect(getKonquerorDocumentImageSource(state, "/home/user/Documents/Article.md", "../Pictures/image.png")).toBe("/assets/phase566-image.png");
    expect(getKonquerorDocumentImageSource(state, "/home/user/Documents/Article.md", "Notes.txt")).toBeNull();
    expect(getKonquerorDocumentImageSource(state, "/home/user/Documents/Article.md", "../Pictures/missing.png")).toBeNull();
  });

  it("resolves VFS asset-url media and HTTPS media without promoting text or unsafe references", () => {
    const state = createFixture();
    expect(getKonquerorDocumentResourceSource(state, "/home/user/Documents/Article.md", "./demo.mp4")).toBe("/assets/phase566-video.mp4");
    expect(getKonquerorDocumentResourceSource(state, "/home/user/Documents/Article.md", "https://example.com/demo.mp4")).toBe("https://example.com/demo.mp4");
    expect(getKonquerorDocumentResourceSource(state, "/home/user/Documents/Article.md", "Notes.txt")).toBeNull();
    expect(getKonquerorDocumentResourceSource(state, "/home/user/Documents/Article.md", "javascript:alert(1)")).toBeNull();
    expect(getKonquerorDocumentResourceSource({ ...state, nodesById: { ...state.nodesById, [fixtureVideo.id]: { ...fixtureVideo, content: { kind: "asset-url", url: "data:video/mp4;base64,AA==" } } } }, "/home/user/Documents/Article.md", "./demo.mp4")).toBeNull();
  });

  it("uses the latest VFS snapshot rather than caching resolved image nodes", () => {
    const state = createFixture();
    const pictures = state.nodesById[fixtureImageParentId];
    if (!pictures || pictures.kind !== "directory") throw new Error("Pictures fixture missing");
    const nodesWithoutImage = { ...state.nodesById };
    delete nodesWithoutImage[fixtureImage.id];
    const withoutImage: VfsState = {
      ...state,
      nodesById: {
        ...nodesWithoutImage,
        [pictures.id]: { ...pictures, childIds: pictures.childIds.filter((childId: string) => childId !== fixtureImage.id) },
      },
    };

    expect(getKonquerorDocumentImageSource(state, "/home/user/Documents/Article.md", "../Pictures/image.png")).not.toBeNull();
    expect(getKonquerorDocumentImageSource(withoutImage, "/home/user/Documents/Article.md", "../Pictures/image.png")).toBeNull();
  });
});
