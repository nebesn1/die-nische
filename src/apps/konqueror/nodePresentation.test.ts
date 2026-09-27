import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsDirectoryNode, VfsFileNode } from "../../vfs/types";
import { getKonquerorNodeIconId } from "./nodePresentation";

describe("Konqueror node presentation", () => {
  it("chooses special location icons by node id", () => {
    const state = createInitialVfsState();

    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.home], state)).toBe("home");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.desktopDirectory], state)).toBe("desktop");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.documents], state)).toBe("documents");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.downloads], state)).toBe("downloads");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.music], state)).toBe("music");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.pictures], state)).toBe("pictures");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.videos], state)).toBe("videos");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.trash], state)).toBe("trash");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.cdrom], state)).toBe("cdrom");
    expect(getKonquerorNodeIconId(state.nodesById[state.specialLocations.floppy], state)).toBe("floppy");
  });

  it("uses generic icons for non-special folders and text files", () => {
    const state = createInitialVfsState();
    const renamedSpecial: VfsDirectoryNode = {
      ...(state.nodesById[state.specialLocations.documents] as VfsDirectoryNode),
      id: "not-special",
      name: "Documents",
    };

    expect(getKonquerorNodeIconId(renamedSpecial, state)).toBe("folder");
    expect(getKonquerorNodeIconId(state.nodesById["vfs-content-76cff3ce17d8a853403179f1"], state)).toBe("markdown-file");
  });

  it("differentiates supported file families by case-insensitive extension", () => {
    const state = createInitialVfsState();
    const file = (name: string, mimeType = "application/octet-stream"): VfsFileNode => ({
      id: `test-${name}`,
      name,
      parentId: state.rootId,
      kind: "file",
      encoding: "utf-8",
      mimeType,
      content: { kind: "text", text: "" },
      size: 0,
      createdAt: "2026-09-22T00:00:00.000Z",
      modifiedAt: "2026-09-22T00:00:00.000Z",
    });
    const cases: readonly [string, string][] = [
      ["README.TXT", "text-file"],
      ["README.MD", "markdown-file"],
      ["INDEX.HTM", "html-file"],
      ["PHOTO.JPEG", "image-file"],
      ["CLIP.WEBM", "video-file"],
      ["SONG.MP3", "music-file"],
    ];

    cases.forEach(([name, iconId]) => {
      expect(getKonquerorNodeIconId(file(name), state)).toBe(iconId);
    });
    expect(getKonquerorNodeIconId(file("unknown.bin"), state)).toBe("text-file");
  });

  it("uses MIME families when a file has no recognized extension", () => {
    const state = createInitialVfsState();
    const file = (name: string, mimeType: string): VfsFileNode => ({
      id: `mime-${name}`,
      name,
      parentId: state.rootId,
      kind: "file",
      encoding: "utf-8",
      mimeType,
      content: { kind: "asset-url", url: `/assets/${name}` },
      size: 1,
      createdAt: "2026-09-22T00:00:00.000Z",
      modifiedAt: "2026-09-22T00:00:00.000Z",
    });

    expect(getKonquerorNodeIconId(file("photo.data", "image/png"), state)).toBe("image-file");
    expect(getKonquerorNodeIconId(file("clip.data", "video/webm"), state)).toBe("video-file");
    expect(getKonquerorNodeIconId(file("track.data", "audio/ogg"), state)).toBe("music-file");
  });
});
