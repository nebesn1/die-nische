import { describe, expect, it } from "vitest";
import type { VfsTextFileNode } from "../../vfs/types";
import { getAvailableKonquerorPreviewers, getDefaultKonquerorPreviewer, resolveKonquerorPreviewer } from "./previewModel";

const file = (name: string): VfsTextFileNode => ({
  id: name,
  name,
  parentId: "documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "text/plain",
  content: { kind: "text", text: "text" },
  size: 4,
  createdAt: "2026-08-01T00:00:00.000Z",
  modifiedAt: "2026-08-01T00:00:00.000Z",
});

describe("Konqueror Previewer model", () => {
  it("keeps every VFS text file eligible for the Embedded Advanced Text Editor", () => {
    expect(getAvailableKonquerorPreviewers(file("README")).map((previewer) => previewer.id)).toEqual(["embedded-text"]);
    expect(getAvailableKonquerorPreviewers(file("notes.data")).map((previewer) => previewer.id)).toEqual(["embedded-text"]);
    expect(getDefaultKonquerorPreviewer(file("LICENSE"))).toBe("embedded-text");
  });

  it("uses case-insensitive HTML and Markdown filename preferences without changing file association", () => {
    expect(getAvailableKonquerorPreviewers(file("INDEX.HTML")).map((previewer) => previewer.id)).toEqual(["khtml", "embedded-text"]);
    expect(getDefaultKonquerorPreviewer(file("page.htm"))).toBe("khtml");
    expect(getAvailableKonquerorPreviewers(file("README.MD")).map((previewer) => previewer.id)).toEqual(["markdown", "embedded-text"]);
    expect(getDefaultKonquerorPreviewer(file("guide.markdown"))).toBe("markdown");
  });

  it("preserves a valid explicit viewer and falls back only when a rename invalidates it", () => {
    expect(resolveKonquerorPreviewer(file("page.html"), "embedded-text")).toBe("embedded-text");
    expect(resolveKonquerorPreviewer(file("page.txt"), "khtml")).toBe("embedded-text");
    expect(resolveKonquerorPreviewer(file("README.txt"), "markdown")).toBe("embedded-text");
  });

  it("chooses the MIME-based image viewer before filename-derived text preferences", () => {
    const image = { ...file("misleading.txt"), mimeType: "image/png", content: { kind: "asset-url" as const, url: "data:image/png;base64,AA==" } };
    expect(getAvailableKonquerorPreviewers(image).map((previewer) => previewer.id)).toEqual(["image"]);
    expect(getDefaultKonquerorPreviewer(image)).toBe("image");
    expect(resolveKonquerorPreviewer(image, "embedded-text")).toBe("image");
  });

  it("chooses MIME-based audio and video viewers without consulting filename extensions", () => {
    const audio = { ...file("track.bin"), mimeType: "audio/mpeg", content: { kind: "asset-url" as const, url: "/assets/track.mp3" } };
    const video = { ...file("clip.data"), mimeType: "video/webm", content: { kind: "asset-url" as const, url: "/assets/clip.webm" } };

    expect(getAvailableKonquerorPreviewers(audio).map((previewer) => previewer.id)).toEqual(["media-audio"]);
    expect(getDefaultKonquerorPreviewer(audio)).toBe("media-audio");
    expect(getAvailableKonquerorPreviewers(video).map((previewer) => previewer.id)).toEqual(["media-video"]);
    expect(getDefaultKonquerorPreviewer(video)).toBe("media-video");
  });
});
