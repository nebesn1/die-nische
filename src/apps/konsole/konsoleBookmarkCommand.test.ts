import { describe, expect, it } from "vitest";
import { createInitialShellSession } from "../../shell";
import { createInitialVfsState } from "../../vfs/initialState";
import { buildKonsoleBookmarkCdCommand, getKonsoleBookmarkDraft, quoteKonsoleBookmarkLocation } from "./konsoleBookmarkCommand";

describe("Konsole bookmark commands", () => {
  it("uses the active shell cwd for the canonical stored directory path", () => {
    const session = createInitialShellSession(createInitialVfsState(), "/home/user/Documents");

    expect(getKonsoleBookmarkDraft(createInitialVfsState(), session)).toEqual({
      name: "/home/user/Documents/",
      location: "/home/user/Documents/",
      comment: "",
    });
  });

  it("builds a cd command with shell-safe single-quote escaping", () => {
    expect(quoteKonsoleBookmarkLocation("/home/user/Project Files/"))
      .toBe("'/home/user/Project Files/'");
    expect(buildKonsoleBookmarkCdCommand("/home/user/O'Reilly/"))
      .toBe("cd '/home/user/O'\\''Reilly/'");
  });
});
