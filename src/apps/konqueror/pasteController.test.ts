import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { pasteKonquerorClipboardItems } from "./pasteController";
import { buildKonquerorClipboardEntryPlan } from "./clipboardEntryBuilder";

const now = "2026-08-03T00:00:00.000Z";
const environment = { now: () => now };
const makeStore = (initial: VfsState) => {
  let state = initial;
  return {
    get state() { return state; },
    operations: createVfsOperations(() => state, (nextState) => { state = nextState; }),
  };
};

describe("Konqueror batch paste controller", () => {
  it("copies all clipboard nodes atomically and retains a copy clipboard", () => {
    const store = makeStore(createInitialVfsState());
    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items", mode: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: store.state.specialLocations.documents },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: true, selectedNodeIds: ["vfs-node-0010", "vfs-node-0011"], shouldClearClipboard: false });
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({ ok: true, value: expect.arrayContaining([
      expect.objectContaining({ name: "Notes.txt" }), expect.objectContaining({ name: "Welcome.md" }),
    ]) });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
  });

  it("moves all cut nodes in one published transition and clears the cut clipboard", () => {
    const store = makeStore(createInitialVfsState());
    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items", mode: "cut",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: store.state.specialLocations.documents },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: true, selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"], shouldClearClipboard: true });
    expect(listVfsDirectory(store.state, "/home/user/Documents")).toMatchObject({
      ok: true,
      value: expect.not.arrayContaining([
        expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }),
        expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" }),
      ]),
    });
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({ ok: true, value: expect.arrayContaining([
      expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }), expect.objectContaining({ id: "vfs-content-76cff3ce17d8a853403179f1" }),
    ]) });
  });

  it("preserves same-directory Cut no-op and rejects the Trash as a Paste destination", () => {
    const store = makeStore(createInitialVfsState());
    const revision = store.state.revision;
    const clipboard = {
      kind: "items" as const,
      mode: "cut" as const,
      entries: [{ nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents }],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5"],
    };

    const sameDirectory = pasteKonquerorClipboardItems(
      store.state,
      clipboard,
      store.state.specialLocations.documents,
      store.operations,
      environment,
    );
    const trashDestination = pasteKonquerorClipboardItems(
      store.state,
      { ...clipboard, mode: "copy" },
      store.state.specialLocations.trash,
      store.operations,
      environment,
    );

    expect(sameDirectory).toMatchObject({ ok: true, selectedNodeIds: ["vfs-content-e594a065214576326cb903a5"], shouldClearClipboard: true });
    expect(trashDestination).toMatchObject({ ok: false, error: { code: "INVALID_DESTINATION" }, shouldClearClipboard: false });
    expect(store.state.revision).toBe(revision);
  });

  it("rejects a collision or stale member without a partial batch", () => {
    const store = makeStore(createInitialVfsState());
    const revision = store.state.revision;
    const collision = pasteKonquerorClipboardItems(store.state, {
      kind: "items", mode: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: "vfs-content-76cff3ce17d8a853403179f1", sourceParentId: store.state.specialLocations.documents },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "vfs-content-76cff3ce17d8a853403179f1"],
    }, store.state.specialLocations.documents, store.operations, environment);
    const stale = pasteKonquerorClipboardItems(store.state, {
      kind: "items", mode: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: "missing", sourceParentId: store.state.specialLocations.documents },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "missing"],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(collision).toMatchObject({ ok: false, error: { code: "ALREADY_EXISTS" }, shouldClearClipboard: false });
    expect(stale).toMatchObject({ ok: false, error: { code: "NOT_FOUND" }, shouldClearClipboard: false });
    expect(store.state.revision).toBe(revision);
  });

  it("copies cross-parent entries in frozen clipboard order and retains the clipboard", () => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", { now });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "copy",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: picture.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", picture.value.id],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: true, shouldClearClipboard: false });
    if (!result.ok) throw new Error("Cross-parent Copy failed");
    expect(result.selectedNodeIds).toHaveLength(2);
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({ ok: true, value: expect.arrayContaining([
      expect.objectContaining({ name: "Notes.txt" }),
      expect.objectContaining({ name: "Photo.txt" }),
    ]) });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
    expect(getVfsPathForNode(store.state, picture.value.id)).toMatchObject({ ok: true, value: "/home/user/Pictures/Photo.txt" });
  });

  it("moves cross-parent entries atomically and clears a successful cut clipboard", () => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", { now });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "cut",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: picture.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", picture.value.id],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: true, selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", picture.value.id], shouldClearClipboard: true });
    expect(listVfsDirectory(store.state, "/home/user/Documents")).toMatchObject({ ok: true, value: expect.not.arrayContaining([
      expect.objectContaining({ id: "vfs-content-e594a065214576326cb903a5" }),
    ]) });
    expect(listVfsDirectory(store.state, "/home/user/Pictures")).toMatchObject({ ok: true, value: expect.not.arrayContaining([
      expect.objectContaining({ id: picture.value.id }),
    ]) });
  });

  it("rejects the entire cross-parent batch when a later entry is stale", () => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", { now });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);
    const revision = store.state.revision;

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "cut",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: "missing", sourceParentId: store.state.specialLocations.pictures },
        { nodeId: picture.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", "missing", picture.value.id],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" }, shouldClearClipboard: false });
    expect(store.state.revision).toBe(revision);
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
    expect(getVfsPathForNode(store.state, picture.value.id)).toMatchObject({ ok: true, value: "/home/user/Pictures/Photo.txt" });
  });

  it("pastes an ancestor-selected copy subtree once without a duplicate selected descendant", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
    if (!folder.ok) throw new Error("A fixture failed");
    const child = createVfsTextFile(folder.state, "/home/user/Documents/A", "Child.txt", "child", { now });
    if (!child.ok) throw new Error("Child fixture failed");
    const store = makeStore(child.state);
    const plan = buildKonquerorClipboardEntryPlan(store.state, [folder.value.id, child.value.id]);
    if (!plan.ok) throw new Error("Clipboard plan failed");

    expect(plan.value.entries).toEqual([{ nodeId: folder.value.id, sourceParentId: store.state.specialLocations.documents }]);
    expect(plan.value.displayNodeIds).toEqual([folder.value.id, child.value.id]);

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "copy",
      ...plan.value,
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: true, shouldClearClipboard: false });
    if (!result.ok) throw new Error("Ancestor copy failed");
    expect(result.selectedNodeIds).toHaveLength(1);
    expect(listVfsDirectory(store.state, "/home/user/Downloads/A")).toMatchObject({
      ok: true,
      value: [expect.objectContaining({ name: "Child.txt" })],
    });
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({
      ok: true,
      value: expect.not.arrayContaining([expect.objectContaining({ name: "Child.txt" })]),
    });
  });

  it("rejects same-name entries from different source parents without publishing a partial copy", () => {
    const documentReport = createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Report.txt", "document", { now });
    if (!documentReport.ok) throw new Error("Document report fixture failed");
    const pictureReport = createVfsTextFile(documentReport.state, "/home/user/Pictures", "Report.txt", "picture", { now });
    if (!pictureReport.ok) throw new Error("Picture report fixture failed");
    const store = makeStore(pictureReport.state);
    const revision = store.state.revision;

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "copy",
      entries: [
        { nodeId: documentReport.value.id, sourceParentId: store.state.specialLocations.documents },
        { nodeId: pictureReport.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: [documentReport.value.id, pictureReport.value.id],
    }, store.state.specialLocations.downloads, store.operations, environment);

    expect(result).toMatchObject({ ok: false, error: { code: "ALREADY_EXISTS" }, shouldClearClipboard: false });
    expect(store.state.revision).toBe(revision);
    expect(listVfsDirectory(store.state, "/home/user/Downloads")).toMatchObject({
      ok: true,
      value: expect.not.arrayContaining([expect.objectContaining({ name: "Report.txt" })]),
    });
  });

  it("rejects a cross-parent Cut batch as a whole when one directory would move into its own descendant", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
    if (!folder.ok) throw new Error("A fixture failed");
    const destination = createVfsDirectory(folder.state, "/home/user/Documents/A", "Subfolder", { now });
    if (!destination.ok) throw new Error("Subfolder fixture failed");
    const picture = createVfsTextFile(destination.state, "/home/user/Pictures", "Photo.txt", "photo", { now });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);
    const revision = store.state.revision;

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "cut",
      entries: [
        { nodeId: folder.value.id, sourceParentId: store.state.specialLocations.documents },
        { nodeId: picture.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: [folder.value.id, picture.value.id],
    }, destination.value.id, store.operations, environment);

    expect(result).toMatchObject({ ok: false, shouldClearClipboard: false });
    expect(store.state.revision).toBe(revision);
    expect(getVfsPathForNode(store.state, folder.value.id)).toMatchObject({ ok: true, value: "/home/user/Documents/A" });
    expect(getVfsPathForNode(store.state, picture.value.id)).toMatchObject({ ok: true, value: "/home/user/Pictures/Photo.txt" });
  });

  it("keeps same-directory Cut no-op entries compatible with real cross-parent moves", () => {
    const picture = createVfsTextFile(createInitialVfsState(), "/home/user/Pictures", "Photo.txt", "photo", { now });
    if (!picture.ok) throw new Error("Picture fixture failed");
    const store = makeStore(picture.state);

    const result = pasteKonquerorClipboardItems(store.state, {
      kind: "items",
      mode: "cut",
      entries: [
        { nodeId: "vfs-content-e594a065214576326cb903a5", sourceParentId: store.state.specialLocations.documents },
        { nodeId: picture.value.id, sourceParentId: store.state.specialLocations.pictures },
      ],
      displayNodeIds: ["vfs-content-e594a065214576326cb903a5", picture.value.id],
    }, store.state.specialLocations.documents, store.operations, environment);

    expect(result).toMatchObject({ ok: true, selectedNodeIds: ["vfs-content-e594a065214576326cb903a5", picture.value.id], shouldClearClipboard: true });
    expect(getVfsPathForNode(store.state, "vfs-content-e594a065214576326cb903a5")).toMatchObject({ ok: true, value: "/home/user/Documents/Notes.txt" });
    expect(getVfsPathForNode(store.state, picture.value.id)).toMatchObject({ ok: true, value: "/home/user/Documents/Photo.txt" });
  });
});
