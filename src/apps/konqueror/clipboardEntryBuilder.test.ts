import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { buildKonquerorClipboardEntryPlan } from "./clipboardEntryBuilder";

const now = "2026-08-30T00:00:00.000Z";

function createHierarchy() {
  const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
  if (!folder.ok) throw new Error("A fixture failed");
  const nested = createVfsDirectory(folder.state, "/home/user/Documents/A", "B", { now });
  if (!nested.ok) throw new Error("B fixture failed");
  const nestedFile = createVfsTextFile(nested.state, "/home/user/Documents/A/B", "B.txt", "b", { now });
  if (!nestedFile.ok) throw new Error("B.txt fixture failed");
  const picture = createVfsTextFile(nestedFile.state, "/home/user/Pictures", "C.txt", "c", { now });
  if (!picture.ok) throw new Error("C.txt fixture failed");

  return { state: picture.state, folder: folder.value.id, nested: nested.value.id, nestedFile: nestedFile.value.id, picture: picture.value.id };
}

describe("Konqueror clipboard entry planning", () => {
  it("keeps an empty selection empty", () => {
    expect(buildKonquerorClipboardEntryPlan(createInitialVfsState(), [])).toEqual({
      ok: true,
      value: { entries: [], displayNodeIds: [] },
    });
  });

  it("captures one source parent per ordered cross-parent operation root", () => {
    const fixture = createHierarchy();

    expect(buildKonquerorClipboardEntryPlan(fixture.state, [fixture.picture, fixture.nestedFile])).toEqual({
      ok: true,
      value: {
        entries: [
          { nodeId: fixture.picture, sourceParentId: fixture.state.specialLocations.pictures },
          { nodeId: fixture.nestedFile, sourceParentId: fixture.nested },
        ],
        displayNodeIds: [fixture.picture, fixture.nestedFile],
      },
    });
  });

  it("normalizes ancestor-covered descendants for mutation entries while preserving raw display selection", () => {
    const fixture = createHierarchy();

    expect(buildKonquerorClipboardEntryPlan(fixture.state, [fixture.folder, fixture.nested, fixture.nestedFile, fixture.picture])).toEqual({
      ok: true,
      value: {
        entries: [
          { nodeId: fixture.folder, sourceParentId: fixture.state.specialLocations.documents },
          { nodeId: fixture.picture, sourceParentId: fixture.state.specialLocations.pictures },
        ],
        displayNodeIds: [fixture.folder, fixture.nested, fixture.nestedFile, fixture.picture],
      },
    });
  });

  it("rejects a stale selected root instead of building an eligible subset", () => {
    const fixture = createHierarchy();

    expect(buildKonquerorClipboardEntryPlan(fixture.state, [fixture.folder, "missing-node"])).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
