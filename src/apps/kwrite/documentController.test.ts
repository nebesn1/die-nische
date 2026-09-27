import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsOperations } from "../../vfs/vfsOperations";
import { createVfsDirectory, moveVfsNodeToTrash, renameVfsNode, restoreVfsNodeFromTrash } from "../../vfs/mutations";
import { getVfsNodeById } from "../../vfs/queries";
import { canSaveKWriteDocument, editKWriteDocument, loadKWriteDocument, synchronizeKWriteDocument } from "./documentModel";
import { getKWriteTextFileSnapshot, saveKWriteDocument, saveKWriteDocumentAs } from "./documentController";

const now = "2003-04-06T12:30:00.000Z";

describe("KWrite document controller", () => {
  it("does not expose asset-backed files as KWrite text document snapshots", () => {
    const state = createInitialVfsState();

    expect(getKWriteTextFileSnapshot(state, "vfs-picture-a")).toBeNull();
  });

  it("uses public queries and the Provider write command with serialized line endings", () => {
    let state = createInitialVfsState();
    const operations = createVfsOperations(
      () => state,
      (next) => { state = next; },
    );
    const snapshot = getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5");

    if (!snapshot) {
      throw new Error("Notes fixture missing");
    }

    const document = editKWriteDocument(loadKWriteDocument({ ...snapshot, content: "One\r\n" }), "One\nTwo\n");
    const saved = saveKWriteDocument(state, document, operations, now);

    expect(saved).toMatchObject({ ok: true, file: { id: "vfs-content-e594a065214576326cb903a5", content: { kind: "text", text: "One\r\nTwo\r\n" }, modifiedAt: now } });
    expect(state.revision).toBe(1);
  });

  it("keeps a display-named document's save target canonical", () => {
    let state = createInitialVfsState();
    const original = state.nodesById["vfs-content-e594a065214576326cb903a5"];

    if (!original || original.kind !== "file") {
      throw new Error("Notes fixture missing");
    }

    state = {
      ...state,
      nodesById: { ...state.nodesById, [original.id]: { ...original, displayName: "My Notes" } },
    };
    const operations = createVfsOperations(
      () => state,
      (next) => { state = next; },
    );
    const snapshot = getKWriteTextFileSnapshot(state, original.id);

    if (!snapshot) throw new Error("display-named snapshot missing");

    const saved = saveKWriteDocument(state, editKWriteDocument(loadKWriteDocument(snapshot), "Updated\n"), operations, now);

    expect(snapshot).toMatchObject({ name: "Notes.txt", displayName: "My Notes", path: "/home/user/Documents/Notes.txt" });
    expect(saved).toMatchObject({ ok: true, file: { id: original.id, name: "Notes.txt" } });
    expect(getKWriteTextFileSnapshot(state, original.id)).toMatchObject({ name: "Notes.txt", displayName: "My Notes", path: "/home/user/Documents/Notes.txt" });
  });

  it("tracks the same node across rename and rejects Trash saves", () => {
    const initial = createInitialVfsState();
    const renamed = renameVfsNode(initial, "/home/user/Documents/Notes.txt", "Renamed.txt", { now });

    if (!renamed.ok) {
      throw new Error("rename fixture failed");
    }

    const renamedSnapshot = getKWriteTextFileSnapshot(renamed.state, "vfs-content-e594a065214576326cb903a5");
    const trashed = moveVfsNodeToTrash(renamed.state, "/home/user/Documents/Renamed.txt", { now });

    if (!renamedSnapshot || !trashed.ok) {
      throw new Error("snapshot fixture failed");
    }

    const dirty = editKWriteDocument(loadKWriteDocument(renamedSnapshot), "Local\n");
    const failed = saveKWriteDocument(trashed.state, dirty, createVfsOperations(() => trashed.state, () => undefined), now);

    expect(renamedSnapshot.path).toBe("/home/user/Documents/Renamed.txt");
    expect(failed).toMatchObject({ ok: false, error: { code: "ALREADY_IN_TRASH" } });
  });

  it("permits saving a retained dirty draft after Trash and Restore only changed metadata", () => {
    let state = createInitialVfsState();
    const original = getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5");

    if (!original) {
      throw new Error("Notes fixture missing");
    }

    const local = editKWriteDocument(loadKWriteDocument(original), "LOCAL\n");
    const trashed = moveVfsNodeToTrash(state, original.path, { now: "2003-04-06T12:31:00.000Z" });

    if (!trashed.ok) {
      throw new Error("Trash fixture failed");
    }

    const trashSnapshot = getKWriteTextFileSnapshot(trashed.state, "vfs-content-e594a065214576326cb903a5");
    const trashDocument = synchronizeKWriteDocument(local, trashSnapshot);
    const restored = restoreVfsNodeFromTrash(trashed.state, "vfs-content-e594a065214576326cb903a5", { now: "2003-04-06T12:32:00.000Z" });

    if (!restored.ok) {
      throw new Error("Restore fixture failed");
    }

    state = restored.state;
    const restoredSnapshot = getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5");
    const restoredDocument = synchronizeKWriteDocument(trashDocument, restoredSnapshot);
    const operations = createVfsOperations(
      () => state,
      (next) => { state = next; },
    );
    const saved = saveKWriteDocument(state, restoredDocument, operations, "2003-04-06T12:33:00.000Z");

    expect(trashDocument).toMatchObject({ mode: "trash-read-only", draft: "LOCAL\n", dirty: true });
    expect(trashSnapshot).toMatchObject({ content: original.content, modifiedAt: "2003-04-06T12:31:00.000Z" });
    expect(restoredSnapshot).toMatchObject({ content: original.content, modifiedAt: "2003-04-06T12:32:00.000Z" });
    expect(restoredDocument).toMatchObject({ mode: "writable", draft: "LOCAL\n", dirty: true, lastKnownPath: original.path });
    expect(canSaveKWriteDocument(restoredDocument)).toBe(true);
    expect(saved).toMatchObject({ ok: true, file: { id: "vfs-content-e594a065214576326cb903a5", content: { kind: "text", text: "LOCAL\n" } } });
    expect(state.revision).toBe(3);
  });

  it("creates Save As content atomically and replaces an explicit existing text-file target", () => {
    let state = createInitialVfsState();
    const operations = createVfsOperations(
      () => state,
      (next) => { state = next; },
    );
    const notes = getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5");

    if (!notes) {
      throw new Error("Notes fixture missing");
    }

    const document = editKWriteDocument(loadKWriteDocument({ ...notes, content: "One\r\n" }), "One\nTwo\n");
    const created = saveKWriteDocumentAs(
      state,
      document,
      operations,
      { directoryPath: "/home/user/Documents", name: "Copy" },
      "2004-08-25T12:31:00.000Z",
    );

    expect(created).toMatchObject({ ok: true, file: { name: "Copy", content: { kind: "text", text: "One\r\nTwo\r\n" } } });
    expect(state.revision).toBe(1);

    if (!created.ok) {
      throw new Error("Save As create failed");
    }

    expect(getVfsNodeById(state, created.file.id)).toMatchObject({ ok: true, value: { size: 10 } });

    const replaced = saveKWriteDocumentAs(
      state,
      document,
      operations,
      { directoryPath: "/home/user/Documents", name: "Welcome.md", existingFilePath: "/home/user/Documents/Welcome.md" },
      "2004-08-25T12:32:00.000Z",
    );

    expect(replaced).toMatchObject({ ok: true, file: { id: "vfs-content-76cff3ce17d8a853403179f1", content: { kind: "text", text: "One\r\nTwo\r\n" } } });
    expect(state.revision).toBe(2);
  });

  it("creates Save As content in the current nested directory identity", () => {
    let state = createInitialVfsState();
    const folder = createVfsDirectory(state, "/home/user/Documents", "test", { now: "2004-08-25T12:31:00.000Z" });

    if (!folder.ok) {
      throw new Error("nested folder fixture failed");
    }

    state = folder.state;
    const operations = createVfsOperations(
      () => state,
      (next) => { state = next; },
    );
    const document = editKWriteDocument(loadKWriteDocument(getKWriteTextFileSnapshot(state, "vfs-content-e594a065214576326cb903a5")!), "Nested\n");
    const saved = saveKWriteDocumentAs(
      state,
      document,
      operations,
      { directoryPath: "/home/user/Documents/test", name: "Nested.txt" },
      "2004-08-25T12:32:00.000Z",
    );

    expect(saved).toMatchObject({ ok: true, file: { name: "Nested.txt", parentId: folder.value.id, content: { kind: "text", text: "Nested\n" } } });
    expect(getKWriteTextFileSnapshot(state, saved.ok ? saved.file.id : "missing")?.path).toBe("/home/user/Documents/test/Nested.txt");
  });

  it("preserves publication when saving its file but never inherits it through Save As", () => {
    let state = createInitialVfsState();
    const original = state.nodesById["vfs-content-e594a065214576326cb903a5"];
    if (!original || original.kind !== "file") throw new Error("Notes fixture missing");
    const publication = { status: "published" as const, publishedAt: "2026-09-10T08:00:00.000Z", summary: "Notes", tags: ["KDE 3"] };
    state = { ...state, nodesById: { ...state.nodesById, [original.id]: { ...original, publication } } };
    const operations = createVfsOperations(() => state, (next) => { state = next; });
    const snapshot = getKWriteTextFileSnapshot(state, original.id);
    if (!snapshot) throw new Error("Published snapshot missing");
    const document = editKWriteDocument(loadKWriteDocument(snapshot), "Updated\n");

    const saved = saveKWriteDocument(state, document, operations, "2004-08-25T12:32:00.000Z");
    const savedAs = saveKWriteDocumentAs(
      state,
      document,
      operations,
      { directoryPath: "/home/user/Documents", name: "Published Copy.txt" },
      "2004-08-25T12:33:00.000Z",
    );

    expect(saved).toMatchObject({ ok: true, file: { publication } });
    expect(savedAs).toMatchObject({ ok: true, file: { name: "Published Copy.txt" } });
    expect(savedAs.ok ? savedAs.file.publication : undefined).toBeUndefined();
  });
});
