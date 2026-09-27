import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsFileNode, VfsState } from "../../vfs/types";
import {
  getKonquerorAdjacentImageNodeId,
  getKonquerorImageSiblingNodeIds,
  getKonquerorImageSource,
  isKonquerorImageFile,
} from "./imagePreviewModel";

const png = (id: string, name: string, parentId: string): VfsFileNode => ({
  id,
  name,
  parentId,
  kind: "file",
  encoding: "utf-8",
  mimeType: "image/png",
  content: { kind: "asset-url", url: "/assets/A-abc.png" },
  size: 4,
  createdAt: "2026-09-12T00:00:00.000Z",
  modifiedAt: "2026-09-12T00:00:00.000Z",
});

describe("Konqueror image preview model", () => {
  it("keeps repository Pictures artwork on the shared external asset-url image path", () => {
    const state = createInitialVfsState();
    const pictures = state.nodesById[state.specialLocations.pictures];
    if (!pictures || pictures.kind !== "directory") throw new Error("Pictures fixture missing");

    const repositoryImages = pictures.childIds
      .map((id) => state.nodesById[id])
      .filter((node): node is VfsFileNode => node?.kind === "file" && node.mimeType === "image/png");

    expect(repositoryImages.map((node) => node.name)).toEqual([
      "nische-archway-01.png",
      "nische-archway-02.png",
      "nische-archway-03.png",
    ]);
    repositoryImages.forEach((node) => {
      expect(isKonquerorImageFile(node)).toBe(true);
      expect(getKonquerorImageSource(node)).toContain(`/content/home/user/Pictures/${node.name}?no-inline`);
      expect(getKonquerorImageSource(node)).not.toMatch(/^data:/);
    });
  });

  it("recognizes supported image MIME types from asset URLs while retaining matching legacy data URLs", () => {
    const image = png("image", "A.png", "pictures");
    expect(isKonquerorImageFile(image)).toBe(true);
    expect(getKonquerorImageSource(image)).toBe("/assets/A-abc.png");
    expect(getKonquerorImageSource({ ...image, content: { kind: "text", text: "data:image/png;base64,AA==" } })).toBe("data:image/png;base64,AA==");
    expect(getKonquerorImageSource({ ...image, content: { kind: "text", text: "/home/user/Pictures/A.png" } })).toBeNull();
    expect(isKonquerorImageFile({ ...image, mimeType: "text/plain" })).toBe(false);
  });

  it("derives previous and next images from parent child order without wrapping or sorting", () => {
    const initial = createInitialVfsState();
    const pictures = initial.nodesById["vfs-pictures"];
    if (!pictures || pictures.kind !== "directory") throw new Error("Pictures fixture missing");
    const first = png("first", "Z.png", pictures.id);
    const second = png("second", "A.png", pictures.id);
    const third = png("third", "M.png", pictures.id);
    const state: VfsState = {
      ...initial,
      nodesById: {
        ...initial.nodesById,
        [pictures.id]: { ...pictures, childIds: [first.id, "vfs-content-76cff3ce17d8a853403179f1", second.id, third.id] },
        [first.id]: first,
        [second.id]: second,
        [third.id]: third,
      },
    };

    expect(getKonquerorImageSiblingNodeIds(state, second)).toEqual([first.id, second.id, third.id]);
    expect(getKonquerorAdjacentImageNodeId(state, first, "previous")).toBeNull();
    expect(getKonquerorAdjacentImageNodeId(state, first, "next")).toBe(second.id);
    expect(getKonquerorAdjacentImageNodeId(state, second, "previous")).toBe(first.id);
    expect(getKonquerorAdjacentImageNodeId(state, third, "next")).toBeNull();
  });
});
