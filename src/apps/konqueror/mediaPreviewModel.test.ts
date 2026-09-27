import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsFileNode } from "../../vfs/types";
import {
  getKonquerorAdjacentMediaNodeId,
  getKonquerorMediaKind,
  getKonquerorMediaSiblingNodeIds,
  getKonquerorMediaSource,
  isKonquerorMediaFile,
} from "./mediaPreviewModel";

const media = (name: string, mimeType: string, url = `/assets/${name}`): VfsFileNode => ({
  id: name,
  name,
  parentId: "documents",
  kind: "file",
  encoding: "utf-8",
  mimeType,
  content: { kind: "asset-url", url },
  size: 12,
  createdAt: "2026-09-12T00:00:00.000Z",
  modifiedAt: "2026-09-12T00:00:00.000Z",
});

describe("Konqueror media preview model", () => {
  it("classifies the supported audio and video MIME types", () => {
    expect(getKonquerorMediaKind(media("track.mp3", "audio/mpeg"))).toBe("audio");
    expect(getKonquerorMediaKind(media("track.ogg", "AUDIO/OGG"))).toBe("audio");
    expect(getKonquerorMediaKind(media("track.oga", "audio/wav"))).toBe("audio");
    expect(getKonquerorMediaKind(media("movie.mp4", "video/mp4"))).toBe("video");
    expect(getKonquerorMediaKind(media("movie.webm", "video/webm"))).toBe("video");
    expect(getKonquerorMediaKind(media("movie.ogv", "VIDEO/OGG"))).toBe("video");
  });

  it("requires an external asset-url source and never promotes inline data into the media viewer", () => {
    const external = media("movie.webm", "video/webm", "/assets/movie.webm");
    const inline = media("movie.webm", "video/webm", "data:video/webm;base64,AA==");
    const text = { ...external, mimeType: "video/webm", content: { kind: "text" as const, text: "not media" } };

    expect(getKonquerorMediaSource(external)).toBe("/assets/movie.webm");
    expect(isKonquerorMediaFile(external)).toBe(true);
    expect(getKonquerorMediaSource(inline)).toBeNull();
    expect(isKonquerorMediaFile(inline)).toBe(false);
    expect(getKonquerorMediaKind(text)).toBeNull();
  });

  it("does not classify unsupported MIME types by filename alone", () => {
    const unsupported = media("movie.mkv", "video/x-matroska");
    const image = media("poster.mp4", "image/png");

    expect(getKonquerorMediaKind(unsupported)).toBeNull();
    expect(getKonquerorMediaKind(image)).toBeNull();
  });

  it("uses the visible directory sort order, filters non-media children, and does not wrap", () => {
    const initial = createInitialVfsState();
    const documents = initial.nodesById[stateDocumentsId(initial)];
    if (!documents || documents.kind !== "directory") throw new Error("Documents fixture missing");
    const first = media("first.mp4", "video/mp4");
    const current = media("current.webm", "video/webm");
    const last = media("last.mp3", "audio/mpeg");
    const text = { ...media("notes.md", "text/markdown"), id: "notes.md" };
    const nested = { ...documents, childIds: [last.id, first.id, text.id, current.id, "vfs-content-76cff3ce17d8a853403179f1"] };
    const state = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [documents.id]: nested,
        [first.id]: { ...first, parentId: documents.id },
        [current.id]: { ...current, parentId: documents.id },
        [last.id]: { ...last, parentId: documents.id },
        [text.id]: { ...text, parentId: documents.id },
      },
    };

    const sort = { key: "name", direction: "ascending" } as const;
    expect(getKonquerorMediaSiblingNodeIds(state, state.nodesById[current.id] as VfsFileNode, sort)).toEqual([current.id, first.id, last.id]);
    expect(getKonquerorAdjacentMediaNodeId(state, state.nodesById[current.id] as VfsFileNode, "previous", sort)).toBeNull();
    expect(getKonquerorAdjacentMediaNodeId(state, state.nodesById[current.id] as VfsFileNode, "next", sort)).toBe(first.id);
    expect(getKonquerorAdjacentMediaNodeId(state, state.nodesById[last.id] as VfsFileNode, "next", sort)).toBeNull();
  });
});

function stateDocumentsId(state: ReturnType<typeof createInitialVfsState>): string {
  return state.specialLocations.documents;
}
