import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsTextFile } from "../../vfs/mutations";
import { buildKonquerorClipboardEntryPlan } from "./clipboardEntryBuilder";
import { planKonquerorOpenInNewWindow } from "./openInNewWindowController";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";

const now = "2026-08-31T00:00:00.000Z";

function createOperationMatrixFixture() {
  const a = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "A", { now });
  if (!a.ok) throw new Error("A fixture failed");
  const b = createVfsDirectory(a.state, "/home/user/Documents/A", "B", { now });
  if (!b.ok) throw new Error("B fixture failed");
  const bFile = createVfsTextFile(b.state, "/home/user/Documents/A/B", "B.txt", "b", { now });
  if (!bFile.ok) throw new Error("B.txt fixture failed");
  const c = createVfsDirectory(bFile.state, "/home/user/Pictures", "C", { now });
  if (!c.ok) throw new Error("C fixture failed");
  const cFile = createVfsTextFile(c.state, "/home/user/Pictures/C", "C.txt", "c", { now });
  if (!cFile.ok) throw new Error("C.txt fixture failed");
  const d = createVfsTextFile(cFile.state, "/home/user", "D.txt", "d", { now });
  if (!d.ok) throw new Error("D.txt fixture failed");

  return { state: d.state, a: a.value.id, b: b.value.id, bFile: bFile.value.id, c: c.value.id, cFile: cFile.value.id, d: d.value.id };
}

describe("Konqueror hierarchical operation matrix", () => {
  it("normalizes recursive mutation roots but keeps every explicit Multi-Open target in supplied Tree order", () => {
    const fixture = createOperationMatrixFixture();
    const selectedInVisibleOrder = [fixture.a, fixture.b, fixture.bFile, fixture.c, fixture.cFile, fixture.d];

    expect(normalizeKonquerorRecursiveOperationTargets(fixture.state, selectedInVisibleOrder)).toEqual({
      ok: true,
      value: [fixture.a, fixture.c, fixture.d],
    });
    expect(buildKonquerorClipboardEntryPlan(fixture.state, selectedInVisibleOrder)).toEqual({
      ok: true,
      value: {
        entries: [
          { nodeId: fixture.a, sourceParentId: fixture.state.specialLocations.documents },
          { nodeId: fixture.c, sourceParentId: fixture.state.specialLocations.pictures },
          { nodeId: fixture.d, sourceParentId: fixture.state.specialLocations.home },
        ],
        displayNodeIds: selectedInVisibleOrder,
      },
    });
    expect(planKonquerorOpenInNewWindow(fixture.state, selectedInVisibleOrder)).toEqual({
      ok: true,
      value: [
        { type: "open-directory", nodeId: fixture.a },
        { type: "open-directory", nodeId: fixture.b },
        { type: "open-file", nodeId: fixture.bFile },
        { type: "open-directory", nodeId: fixture.c },
        { type: "open-file", nodeId: fixture.cFile },
        { type: "open-file", nodeId: fixture.d },
      ],
    });
  });
});
