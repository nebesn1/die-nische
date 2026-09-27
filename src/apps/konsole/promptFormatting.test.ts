import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { getKonsolePromptPath, formatKonsolePrompt } from "./promptFormatting";

describe("Konsole prompt formatting", () => {
  it("uses fixed virtual user and host names", () => {
    expect(formatKonsolePrompt("/home/user")).toBe("user@kde3:/home/user$");
  });

  it("derives the prompt path from VFS node id", () => {
    const state = createInitialVfsState();

    expect(getKonsolePromptPath(state, state.specialLocations.home)).toBe("/home/user");
  });

  it("does not crash when cwd is unavailable", () => {
    const state = createInitialVfsState();

    expect(getKonsolePromptPath(state, "missing-node")).toBe("(unavailable)");
  });
});
