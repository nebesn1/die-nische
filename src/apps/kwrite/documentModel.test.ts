import { describe, expect, it } from "vitest";
import {
  canSaveKWriteDocument,
  editKWriteDocument,
  getKWriteDocumentBaseTitle,
  getKWriteDocumentStatus,
  initialKWriteDocumentState,
  loadKWriteDocument,
  requestKWriteDocument,
  revertKWriteDocument,
  saveSucceededKWriteDocument,
  synchronizeKWriteDocument,
  type KWriteTextFileSnapshot,
} from "./documentModel";

const notes = (overrides: Partial<KWriteTextFileSnapshot> = {}): KWriteTextFileSnapshot => ({
  nodeId: "vfs-content-e594a065214576326cb903a5",
  name: "Notes.txt",
  path: "/home/user/Documents/Notes.txt",
  content: "First\n",
  modifiedAt: "2003-04-06T12:30:00.000Z",
  isInsideTrash: false,
  ...overrides,
});

describe("KWrite document model", () => {
  it("starts as an unsaved Untitled scratch document and derives dirty from the baseline", () => {
    const dirty = editKWriteDocument(initialKWriteDocumentState, "scratch");
    const secondEdit = editKWriteDocument(dirty, "scratch text");
    const clean = editKWriteDocument(dirty, "");

    expect(initialKWriteDocumentState).toMatchObject({ mode: "untitled", nodeId: null, draft: "", dirty: false });
    expect(dirty.dirty).toBe(true);
    expect(secondEdit).toMatchObject({ nodeId: null, mode: "untitled", draft: "scratch text", dirty: true });
    expect(clean.dirty).toBe(false);
    expect(getKWriteDocumentStatus(initialKWriteDocumentState)).toBe("Untitled - no backing file");
  });

  it("loads, edits, saves, and reverts a text file", () => {
    const loaded = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(loaded, "Changed\n");
    const saved = saveSucceededKWriteDocument(dirty, notes({ content: "Changed\n", modifiedAt: "2003-04-06T12:31:00.000Z" }));
    const reverted = revertKWriteDocument(dirty, notes({ content: "Latest\n", modifiedAt: "2003-04-06T12:32:00.000Z" }));

    expect(loaded).toMatchObject({ nodeId: "vfs-content-e594a065214576326cb903a5", mode: "writable", dirty: false });
    expect(dirty.dirty).toBe(true);
    expect(canSaveKWriteDocument(dirty)).toBe(true);
    expect(saved).toMatchObject({ draft: "Changed\n", dirty: false, baselineModifiedAt: "2003-04-06T12:31:00.000Z" });
    expect(reverted).toMatchObject({ draft: "Latest\n", dirty: false, mode: "writable" });
  });

  it("keeps same-file sessions independent while a sibling save conflicts only with its own baseline", () => {
    const original = notes({ content: "Old\n" });
    const first = editKWriteDocument(loadKWriteDocument(original), "First edit\n");
    const second = editKWriteDocument(loadKWriteDocument(original), "Second edit\n");
    const firstSaved = saveSucceededKWriteDocument(first, notes({ content: "First edit\n", modifiedAt: "2003-04-06T12:31:00.000Z" }));
    const secondAfterSiblingSave = synchronizeKWriteDocument(
      second,
      notes({ content: "First edit\n", modifiedAt: "2003-04-06T12:31:00.000Z" }),
    );

    expect(firstSaved).toMatchObject({ draft: "First edit\n", dirty: false, mode: "writable" });
    expect(second).toMatchObject({ draft: "Second edit\n", baselineContent: "Old\n", dirty: true });
    expect(secondAfterSiblingSave).toMatchObject({ draft: "Second edit\n", baselineContent: "Old\n", dirty: true, mode: "conflict" });
  });

  it("reports unsuffixed application base captions from each document identity", () => {
    expect(getKWriteDocumentBaseTitle(initialKWriteDocumentState)).toBe("Untitled - KWrite");
    expect(getKWriteDocumentBaseTitle(loadKWriteDocument(notes({ name: "A.txt" })))).toBe("A.txt - KWrite");
  });

  it("uses a presentation label for the title while retaining the canonical save name through dirty edits", () => {
    const loaded = loadKWriteDocument(notes({ name: "article.md", displayName: "My Article" }));
    const dirty = editKWriteDocument(loaded, "Changed\n");

    expect(getKWriteDocumentBaseTitle(loaded)).toBe("My Article - KWrite");
    expect(dirty).toMatchObject({ lastKnownName: "article.md", lastKnownDisplayName: "My Article", dirty: true });
    expect(getKWriteDocumentBaseTitle(dirty)).toBe("My Article - KWrite");
  });

  it("refreshes a clean presentation label without treating metadata-only display changes as content", () => {
    const loaded = loadKWriteDocument(notes({ displayName: "First Label" }));
    const updated = synchronizeKWriteDocument(loaded, notes({ displayName: "Second Label" }));

    expect(updated).toMatchObject({ draft: "First\n", dirty: false, lastKnownName: "Notes.txt", lastKnownDisplayName: "Second Label" });
    expect(getKWriteDocumentBaseTitle(updated)).toBe("Second Label - KWrite");
  });

  it("synchronizes clean external changes and protects dirty drafts with a conflict", () => {
    const loaded = loadKWriteDocument(notes());
    const latest = notes({ content: "External\n", modifiedAt: "2003-04-06T12:31:00.000Z" });
    const cleanUpdate = synchronizeKWriteDocument(loaded, latest);
    const dirtyUpdate = synchronizeKWriteDocument(editKWriteDocument(loaded, "Local\n"), latest);

    expect(cleanUpdate).toMatchObject({ draft: "External\n", dirty: false, mode: "writable" });
    expect(dirtyUpdate).toMatchObject({ draft: "Local\n", dirty: true, mode: "conflict" });
    expect(canSaveKWriteDocument(dirtyUpdate)).toBe(false);
    expect(getKWriteDocumentStatus(dirtyUpdate)).toBe("External changes detected");
    expect(revertKWriteDocument(dirtyUpdate, latest)).toMatchObject({ draft: "External\n", dirty: false });
  });

  it("does not mistake local dirty edits for external VFS changes", () => {
    const loaded = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(loaded, "First local edit\n");
    const synchronized = synchronizeKWriteDocument(dirty, notes());

    expect(synchronized).toBe(dirty);
    expect(synchronized).toMatchObject({ draft: "First local edit\n", dirty: true, mode: "writable" });
    expect(synchronizeKWriteDocument(initialKWriteDocumentState, null)).toBe(initialKWriteDocumentState);
  });

  it("switches clean files, retains the same dirty file, and blocks a different dirty document request", () => {
    const loaded = loadKWriteDocument(notes());
    const other = notes({ nodeId: "vfs-content-76cff3ce17d8a853403179f1", name: "Welcome.md", path: "/home/user/Documents/Welcome.md" });
    const dirty = editKWriteDocument(loaded, "Local\n");

    expect(requestKWriteDocument(loaded, other)).toMatchObject({ nodeId: "vfs-content-76cff3ce17d8a853403179f1", lastKnownName: "Welcome.md" });
    expect(requestKWriteDocument(dirty, notes())).toBe(dirty);
    expect(requestKWriteDocument(dirty, other)).toMatchObject({ nodeId: "vfs-content-e594a065214576326cb903a5", draft: "Local\n", notice: "Unsaved changes prevent opening another file." });
  });

  it("keeps the stable document identity through rename and move while updating the display path", () => {
    const loaded = editKWriteDocument(loadKWriteDocument(notes()), "Local\n");
    const moved = synchronizeKWriteDocument(loaded, notes({
      name: "Renamed.txt",
      path: "/home/user/Downloads/Renamed.txt",
      modifiedAt: "2003-04-06T12:31:00.000Z",
    }));

    expect(moved).toMatchObject({
      nodeId: "vfs-content-e594a065214576326cb903a5",
      lastKnownName: "Renamed.txt",
      lastKnownPath: "/home/user/Downloads/Renamed.txt",
      draft: "Local\n",
      dirty: true,
      mode: "writable",
    });
    expect(canSaveKWriteDocument(moved)).toBe(true);
  });

  it("restores a dirty Trash document to writable when only relocation metadata changed", () => {
    const loaded = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(loaded, "Local\n");
    const trashed = synchronizeKWriteDocument(dirty, notes({
      path: "/home/user/.local/share/Trash/files/Notes.txt",
      isInsideTrash: true,
      modifiedAt: "2003-04-06T12:31:00.000Z",
    }));
    const restored = synchronizeKWriteDocument(trashed, notes({ modifiedAt: "2003-04-06T12:32:00.000Z" }));

    expect(trashed).toMatchObject({ mode: "trash-read-only", draft: "Local\n", dirty: true });
    expect(canSaveKWriteDocument(trashed)).toBe(false);
    expect(restored).toMatchObject({
      mode: "writable",
      draft: "Local\n",
      dirty: true,
      lastKnownPath: "/home/user/Documents/Notes.txt",
      baselineModifiedAt: "2003-04-06T12:32:00.000Z",
    });
    expect(canSaveKWriteDocument(restored)).toBe(true);
  });

  it("keeps clean relocation writable, but protects a real dirty external content change", () => {
    const clean = loadKWriteDocument(notes());
    const cleanTrashed = synchronizeKWriteDocument(clean, notes({ path: "/home/user/.local/share/Trash/files/Notes.txt", isInsideTrash: true, modifiedAt: "2003-04-06T12:31:00.000Z" }));
    const cleanRestored = synchronizeKWriteDocument(cleanTrashed, notes({ modifiedAt: "2003-04-06T12:32:00.000Z" }));
    const dirty = editKWriteDocument(loadKWriteDocument(notes()), "Local\n");
    const dirtyTrashed = synchronizeKWriteDocument(dirty, notes({ path: "/home/user/.local/share/Trash/files/Notes.txt", isInsideTrash: true, modifiedAt: "2003-04-06T12:31:00.000Z" }));
    const conflict = synchronizeKWriteDocument(dirtyTrashed, notes({ content: "External\n", modifiedAt: "2003-04-06T12:32:00.000Z" }));

    expect(cleanRestored).toMatchObject({ mode: "writable", dirty: false, draft: "First\n" });
    expect(conflict).toMatchObject({ mode: "conflict", dirty: true, draft: "Local\n" });
    expect(canSaveKWriteDocument(conflict)).toBe(false);
  });

  it("enforces unavailable and mixed-newline read-only states without losing local drafts", () => {
    const loaded = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(loaded, "Local\n");
    const unavailable = synchronizeKWriteDocument(dirty, null);
    const mixed = loadKWriteDocument(notes({ content: "a\nb\r\n" }));
    const restoredMixed = synchronizeKWriteDocument(
      synchronizeKWriteDocument(mixed, notes({ content: "a\nb\r\n", path: "/home/user/.local/share/Trash/files/Notes.txt", isInsideTrash: true })),
      notes({ content: "a\nb\r\n" }),
    );

    expect(unavailable).toMatchObject({ mode: "unavailable", draft: "Local\n" });
    expect(mixed.mode).toBe("mixed-read-only");
    expect(restoredMixed.mode).toBe("mixed-read-only");
    expect(canSaveKWriteDocument(mixed)).toBe(false);
    expect(editKWriteDocument(unavailable, "ignored")).toBe(unavailable);
    expect(editKWriteDocument(mixed, "ignored")).toBe(mixed);
  });
});
