import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { getRunCommandPlan } from "./runCommand";

describe("getRunCommandPlan", () => {
  const vfsState = createInitialVfsState();

  it("plans registered application aliases as browser-runtime application launches", () => {
    expect(getRunCommandPlan(vfsState, "kwrite")).toEqual({ type: "application", appId: "kwrite" });
    expect(getRunCommandPlan(vfsState, " kcalc ")).toEqual({ type: "application", appId: "kcalc" });
  });

  it("reuses the VFS and Konqueror location bridge for paths, home expansion, and HTTPS URLs", () => {
    expect(getRunCommandPlan(vfsState, "/home/user/Documents")).toEqual({
      type: "location",
      intent: { type: "open-directory", nodeId: "vfs-documents" },
    });
    expect(getRunCommandPlan(vfsState, "~/Documents")).toEqual({
      type: "location",
      intent: { type: "open-directory", nodeId: "vfs-documents" },
    });
    expect(getRunCommandPlan(vfsState, "https://example.com")).toEqual({
      type: "location",
      intent: { type: "open-external-web", canonicalUrl: "https://example.com/" },
    });
  });

  it("uses only the in-browser shell and preserves its visible failure boundary", () => {
    expect(getRunCommandPlan(vfsState, "pwd")).toEqual({ type: "shell" });
    expect(getRunCommandPlan(vfsState, "does-not-exist")).toMatchObject({
      type: "error",
      message: "does-not-exist: command not found",
    });
    expect(getRunCommandPlan(vfsState, "")).toEqual({ type: "error", message: "Enter a command." });
  });
});
