import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { expandShellPathOperand } from "./path";

describe("Shell path operand expansion", () => {
  it("expands only the current Web Desktop user's leading tilde forms", () => {
    const state = createInitialVfsState();

    expect(expandShellPathOperand(state, "~")).toBe("/home/user");
    expect(expandShellPathOperand(state, "~/")).toBe("/home/user/");
    expect(expandShellPathOperand(state, "~/Documents")).toBe("/home/user/Documents");
    expect(expandShellPathOperand(state, "~/Videos")).toBe("/home/user/Videos");
    expect(expandShellPathOperand(state, "~/.local/share/Trash/files")).toBe(
      "/home/user/.local/share/Trash/files",
    );
  });

  it("does not perform broad replacement or multi-user expansion", () => {
    const state = createInitialVfsState();

    expect(expandShellPathOperand(state, "abc~def")).toBe("abc~def");
    expect(expandShellPathOperand(state, "~otheruser")).toBe("~otheruser");
    expect(expandShellPathOperand(state, "trash:/")).toBe("trash:/");
    expect(expandShellPathOperand(state, "/trash")).toBe("/trash");
  });
});
