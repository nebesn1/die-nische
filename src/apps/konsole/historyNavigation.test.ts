import { describe, expect, it } from "vitest";
import {
  initialKonsoleHistoryNavigationState,
  moveKonsoleHistoryNext,
  moveKonsoleHistoryPrevious,
  resetKonsoleHistoryNavigation,
} from "./historyNavigation";

describe("Konsole history navigation", () => {
  it("starts with no cursor", () => {
    expect(initialKonsoleHistoryNavigationState).toEqual({
      cursor: null,
      draftBeforeNavigation: "",
    });
  });

  it("returns the same draft when history is empty", () => {
    const moved = moveKonsoleHistoryPrevious(initialKonsoleHistoryNavigationState, [], "draft");

    expect(moved.draft).toBe("draft");
    expect(moved.state).toBe(initialKonsoleHistoryNavigationState);
  });

  it("moves to the newest history entry first and keeps the previous draft", () => {
    const moved = moveKonsoleHistoryPrevious(
      initialKonsoleHistoryNavigationState,
      ["pwd", "ls", "cat Welcome.md"],
      "unfinished",
    );

    expect(moved.draft).toBe("cat Welcome.md");
    expect(moved.state).toEqual({
      cursor: 2,
      draftBeforeNavigation: "unfinished",
    });
  });

  it("moves to older entries and stops at the oldest boundary", () => {
    const first = moveKonsoleHistoryPrevious(initialKonsoleHistoryNavigationState, ["pwd", "ls"], "");
    const second = moveKonsoleHistoryPrevious(first.state, ["pwd", "ls"], first.draft);
    const third = moveKonsoleHistoryPrevious(second.state, ["pwd", "ls"], second.draft);

    expect(second.draft).toBe("pwd");
    expect(third.draft).toBe("pwd");
    expect(third.state.cursor).toBe(0);
  });

  it("moves forward through history and restores the pre-navigation draft", () => {
    const previous = moveKonsoleHistoryPrevious(
      initialKonsoleHistoryNavigationState,
      ["pwd", "ls"],
      "work in progress",
    );
    const oldest = moveKonsoleHistoryPrevious(previous.state, ["pwd", "ls"], previous.draft);
    const newer = moveKonsoleHistoryNext(oldest.state, ["pwd", "ls"], oldest.draft);
    const restored = moveKonsoleHistoryNext(newer.state, ["pwd", "ls"], newer.draft);

    expect(newer.draft).toBe("ls");
    expect(restored.draft).toBe("work in progress");
    expect(restored.state.cursor).toBeNull();
  });

  it("keeps duplicate commands as distinct history entries", () => {
    const newest = moveKonsoleHistoryPrevious(initialKonsoleHistoryNavigationState, ["pwd", "pwd"], "");
    const older = moveKonsoleHistoryPrevious(newest.state, ["pwd", "pwd"], newest.draft);

    expect(newest.state.cursor).toBe(1);
    expect(older.state.cursor).toBe(0);
    expect(newest.draft).toBe("pwd");
    expect(older.draft).toBe("pwd");
  });

  it("resets without mutating old state", () => {
    const previous = moveKonsoleHistoryPrevious(initialKonsoleHistoryNavigationState, ["pwd"], "draft");
    const reset = resetKonsoleHistoryNavigation();

    expect(reset).toBe(initialKonsoleHistoryNavigationState);
    expect(previous.state).toEqual({
      cursor: 0,
      draftBeforeNavigation: "draft",
    });
  });
});
