import { describe, expect, it } from "vitest";
import { editKWriteDocument, loadKWriteDocument, type KWriteTextFileSnapshot } from "./documentModel";
import { getKWriteCloseSaveMode, shouldConfirmKWriteClose } from "./closeLifecycle";

const notes = (overrides: Partial<KWriteTextFileSnapshot> = {}): KWriteTextFileSnapshot => ({
  nodeId: "vfs-content-e594a065214576326cb903a5",
  name: "Notes.txt",
  path: "/home/user/Documents/Notes.txt",
  content: "Saved\n",
  modifiedAt: "2004-08-25T12:00:00.000Z",
  isInsideTrash: false,
  ...overrides,
});

describe("KWrite close lifecycle", () => {
  it("only confirms a close when the document has an unsaved local draft", () => {
    const clean = loadKWriteDocument(notes());
    const dirty = editKWriteDocument(clean, "Local\n");

    expect(shouldConfirmKWriteClose(clean)).toBe(false);
    expect(shouldConfirmKWriteClose(dirty)).toBe(true);
    expect(shouldConfirmKWriteClose({ ...clean, mode: "unavailable" })).toBe(false);
  });

  it("uses ordinary Save for writable documents and Save As rescue for recoverable dirty drafts", () => {
    const writable = editKWriteDocument(loadKWriteDocument(notes()), "Local\n");
    const untitled = editKWriteDocument({ ...writable, nodeId: null, mode: "untitled" }, "Scratch");
    const conflict = { ...writable, mode: "conflict" as const };
    const trash = { ...writable, mode: "trash-read-only" as const };
    const unavailable = { ...writable, mode: "unavailable" as const };
    const mixed = { ...writable, mode: "mixed-read-only" as const };

    expect(getKWriteCloseSaveMode(writable)).toBe("save");
    expect(getKWriteCloseSaveMode(untitled)).toBe("save-as");
    expect(getKWriteCloseSaveMode(conflict)).toBe("save-as");
    expect(getKWriteCloseSaveMode(trash)).toBe("save-as");
    expect(getKWriteCloseSaveMode(unavailable)).toBe("save-as");
    expect(getKWriteCloseSaveMode(mixed)).toBe("unavailable");
  });
});
