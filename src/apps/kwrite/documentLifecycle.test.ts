import { describe, expect, it } from "vitest";
import { editKWriteDocument, loadKWriteDocument, type KWriteTextFileSnapshot } from "./documentModel";
import {
  getKWriteReplacementMessage,
  getKWriteReplacementSaveMode,
  isKWriteSameDocumentAction,
  shouldConfirmKWriteReplacement,
} from "./documentLifecycle";

const notes = (overrides: Partial<KWriteTextFileSnapshot> = {}): KWriteTextFileSnapshot => ({
  nodeId: "vfs-content-e594a065214576326cb903a5",
  name: "Notes.txt",
  path: "/home/user/Documents/Notes.txt",
  content: "Saved\n",
  modifiedAt: "2004-08-25T12:00:00.000Z",
  isInsideTrash: false,
  ...overrides,
});

describe("KWrite document replacement lifecycle", () => {
  it("does not confirm clean replacements and confirms dirty New, Open, and different-file requests", () => {
    const clean = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(clean, "Local\n");

    expect(shouldConfirmKWriteReplacement(clean, { type: "new" })).toBe(false);
    expect(shouldConfirmKWriteReplacement(dirty, { type: "new" })).toBe(true);
    expect(shouldConfirmKWriteReplacement(dirty, { type: "open-dialog" })).toBe(true);
    expect(shouldConfirmKWriteReplacement(dirty, { type: "open-node", nodeId: "vfs-content-76cff3ce17d8a853403179f1" })).toBe(true);
  });

  it("retains a dirty same-file document without a replacement prompt", () => {
    const dirty = editKWriteDocument(loadKWriteDocument(notes()), "Local\n");
    const action = { type: "open-node", nodeId: "vfs-content-e594a065214576326cb903a5" } as const;

    expect(isKWriteSameDocumentAction(dirty, action)).toBe(true);
    expect(shouldConfirmKWriteReplacement(dirty, action)).toBe(false);
  });

  it("chooses ordinary Save only for writable files and Save As for recoverable drafts", () => {
    const writable = editKWriteDocument(loadKWriteDocument(notes()), "Local\n");
    const untitled = editKWriteDocument({ ...writable, nodeId: null, mode: "untitled" }, "Scratch");
    const conflict = { ...writable, mode: "conflict" as const };
    const mixed = { ...writable, mode: "mixed-read-only" as const };

    expect(getKWriteReplacementSaveMode(writable)).toBe("save");
    expect(getKWriteReplacementSaveMode(untitled)).toBe("save-as");
    expect(getKWriteReplacementSaveMode(conflict)).toBe("save-as");
    expect(getKWriteReplacementSaveMode(mixed)).toBe("unavailable");
  });

  it("uses deterministic user-facing replacement messages", () => {
    expect(getKWriteReplacementMessage({ type: "new" })).toBe("Save changes before creating a new document?");
    expect(getKWriteReplacementMessage({ type: "open-dialog" })).toBe("Save changes before opening another document?");
    expect(getKWriteReplacementMessage({ type: "open-node", nodeId: "vfs-content-e594a065214576326cb903a5" })).toBe("Save changes before opening another document?");
  });
});
