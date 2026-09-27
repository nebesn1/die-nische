import { describe, expect, it } from "vitest";
import { initialKonquerorFileUndoState, konquerorFileUndoReducer } from "./fileUndoHistory";

const entry = { kind: "create" as const, roots: [] };

describe("Konqueror file undo history", () => {
  it("is strict LIFO and only removes a record after a successful matching completion", () => {
    const first = konquerorFileUndoReducer(initialKonquerorFileUndoState, { type: "record", record: { id: "one", entry } });
    const second = konquerorFileUndoReducer(first, { type: "record", record: { id: "two", entry } });
    const started = konquerorFileUndoReducer(second, { type: "begin" });
    const failed = konquerorFileUndoReducer(started, { type: "failed" });
    const completed = konquerorFileUndoReducer(failed, { type: "complete", id: "two" });

    expect(failed.entries.map((record) => record.id)).toEqual(["one", "two"]);
    expect(completed.entries.map((record) => record.id)).toEqual(["one"]);
  });
});
