import { describe, expect, it } from "vitest";
import { createKonsoleWorkingDirectoryIntent, isKonsoleWorkingDirectoryIntent } from "./launchIntent";

describe("Konsole working-directory launch intent", () => {
  it("keeps an absolute canonical working directory on one typed launch request", () => {
    expect(createKonsoleWorkingDirectoryIntent("/home/user/My Folder")).toEqual({
      type: "open-working-directory",
      workingDirectory: "/home/user/My Folder",
    });
    expect(isKonsoleWorkingDirectoryIntent({ type: "open-working-directory", workingDirectory: "/home/user/Documents" })).toBe(true);
  });

  it("rejects URL, relative, and unrelated launch data", () => {
    expect(isKonsoleWorkingDirectoryIntent({ type: "open-working-directory", workingDirectory: "file:///home/user/Documents" })).toBe(false);
    expect(isKonsoleWorkingDirectoryIntent({ type: "open-working-directory", workingDirectory: "Documents" })).toBe(false);
    expect(isKonsoleWorkingDirectoryIntent({ type: "open-directory", nodeId: "vfs-documents" })).toBe(false);
  });
});
