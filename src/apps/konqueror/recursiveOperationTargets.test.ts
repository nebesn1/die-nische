import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";

const now = "2026-08-30T00:00:00.000Z";

function createHierarchy() {
  const initial = createInitialVfsState();
  const a = createVfsDirectory(initial, "/home/user/Documents", "A", { now });
  if (!a.ok) throw new Error("A fixture failed");
  const b = createVfsDirectory(a.state, "/home/user/Documents/A", "B", { now });
  if (!b.ok) throw new Error("B fixture failed");
  const bFile = createVfsTextFile(b.state, "/home/user/Documents/A/B", "B.txt", "b", { now });
  if (!bFile.ok) throw new Error("B.txt fixture failed");
  const aFile = createVfsTextFile(bFile.state, "/home/user/Documents/A", "A.txt", "a", { now });
  if (!aFile.ok) throw new Error("A.txt fixture failed");
  const cFile = createVfsTextFile(aFile.state, "/home/user/Pictures", "C.txt", "c", { now });
  if (!cFile.ok) throw new Error("C.txt fixture failed");

  return { state: cFile.state, a: a.value.id, b: b.value.id, bFile: bFile.value.id, aFile: aFile.value.id, cFile: cFile.value.id };
}

describe("Konqueror recursive operation target normalization", () => {
  it("preserves independent selected targets and their supplied visible order", () => {
    const fixture = createHierarchy();

    expect(normalizeKonquerorRecursiveOperationTargets(fixture.state, [])).toEqual({ ok: true, value: [] });
    expect(normalizeKonquerorRecursiveOperationTargets(fixture.state, [fixture.aFile, fixture.cFile]))
      .toEqual({ ok: true, value: [fixture.aFile, fixture.cFile] });
  });

  it("removes direct and deep descendants covered by a selected ancestor", () => {
    const fixture = createHierarchy();

    expect(normalizeKonquerorRecursiveOperationTargets(
      fixture.state,
      [fixture.a, fixture.b, fixture.bFile, fixture.aFile, fixture.cFile],
    )).toEqual({ ok: true, value: [fixture.a, fixture.cFile] });
    expect(normalizeKonquerorRecursiveOperationTargets(
      fixture.state,
      [fixture.bFile, fixture.a, fixture.cFile],
    )).toEqual({ ok: true, value: [fixture.a, fixture.cFile] });
  });

  it("keeps a selected child when none of its ancestors are selected", () => {
    const fixture = createHierarchy();

    expect(normalizeKonquerorRecursiveOperationTargets(fixture.state, [fixture.b, fixture.aFile, fixture.cFile]))
      .toEqual({ ok: true, value: [fixture.b, fixture.aFile, fixture.cFile] });
  });

  it("rejects actual stale roots and malformed parent ancestry instead of skipping them", () => {
    const fixture = createHierarchy();
    expect(normalizeKonquerorRecursiveOperationTargets(fixture.state, ["missing-node"])).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });

    const notes = fixture.state.nodesById["vfs-content-e594a065214576326cb903a5"];
    const welcome = fixture.state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    if (!notes || !welcome) throw new Error("Cycle fixture missing");
    const cyclic = {
      ...fixture.state,
      nodesById: {
        ...fixture.state.nodesById,
        [notes.id]: { ...notes, parentId: welcome.id },
        [welcome.id]: { ...welcome, parentId: notes.id },
      },
    };

    expect(normalizeKonquerorRecursiveOperationTargets(cyclic, [notes.id])).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
  });
});
