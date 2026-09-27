import { describe, expect, it } from "vitest";
import {
  clearKonsoleCompletionState,
  initialKonsoleCompletionState,
  setKonsoleCompletionCandidates,
} from "./completionState";

describe("Konsole completion state", () => {
  it("starts empty and can be cleared back to the shared empty value", () => {
    expect(initialKonsoleCompletionState).toEqual({
      contextKey: null,
      candidates: [],
    });
    expect(clearKonsoleCompletionState()).toBe(initialKonsoleCompletionState);
  });

  it("stores candidates without mutating old state", () => {
    const candidate = {
      value: "cat",
      displayText: "cat",
      insertionText: "cat ",
      kind: "command" as const,
    };
    const state = setKonsoleCompletionCandidates("command:cat", [candidate]);

    expect(state).toEqual({
      contextKey: "command:cat",
      candidates: [candidate],
    });
    expect(initialKonsoleCompletionState.candidates).toEqual([]);
  });
});
