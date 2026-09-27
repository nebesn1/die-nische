import { describe, expect, it } from "vitest";
import {
  getVfsBasename,
  getVfsDirname,
  joinVfsPath,
  normalizeVfsPath,
  splitVfsPath,
  validateVfsNodeName,
} from "./path";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

describe("VFS path utilities", () => {
  it("normalizes absolute POSIX paths", () => {
    expect(expectOk(normalizeVfsPath("/"))).toBe("/");
    expect(expectOk(normalizeVfsPath("//home///user/./Documents/"))).toBe("/home/user/Documents");
    expect(expectOk(normalizeVfsPath("/home/user/Documents/../Downloads"))).toBe("/home/user/Downloads");
    expect(expectOk(normalizeVfsPath("/../../home"))).toBe("/home");
  });

  it("resolves relative and empty paths against an absolute cwd", () => {
    expect(expectOk(normalizeVfsPath("Documents/Welcome.md", "/home/user"))).toBe(
      "/home/user/Documents/Welcome.md",
    );
    expect(expectOk(normalizeVfsPath("", "/home/user"))).toBe("/home/user");
  });

  it("rejects invalid cwd and Windows-style paths", () => {
    expect(normalizeVfsPath("Documents", "home/user")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    expect(normalizeVfsPath("C:\\Users\\aoi")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    expect(normalizeVfsPath("C:/Users/aoi")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    expect(normalizeVfsPath("/home\\user")).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATH" },
    });
  });

  it("keeps case and exposes basename dirname split and join helpers", () => {
    expect(expectOk(normalizeVfsPath("/Home/User/Readme.txt"))).toBe("/Home/User/Readme.txt");
    expect(getVfsBasename("/home/user/Documents/Welcome.md")).toBe("Welcome.md");
    expect(getVfsBasename("/")).toBe("/");
    expect(getVfsDirname("/home/user/Documents/Welcome.md")).toBe("/home/user/Documents");
    expect(getVfsDirname("/")).toBe("/");
    expect(splitVfsPath("/home/user/Documents")).toEqual(["home", "user", "Documents"]);
    expect(joinVfsPath("/home", "user", "..", "user", "Documents")).toBe("/home/user/Documents");
  });

  it("rejects an actually empty filename field without trimming and permits literal quote characters", () => {
    expect(validateVfsNodeName("")).toMatchObject({ ok: false, error: { code: "INVALID_NAME" } });
    expect(validateVfsNodeName(".")).toMatchObject({ ok: false, error: { code: "INVALID_NAME" } });
    expect(validateVfsNodeName("..")).toMatchObject({ ok: false, error: { code: "INVALID_NAME" } });
    expect(validateVfsNodeName("a/b")).toMatchObject({ ok: false, error: { code: "INVALID_NAME" } });
    expect(validateVfsNodeName("a\0b")).toMatchObject({ ok: false, error: { code: "INVALID_NAME" } });
    expect(expectOk(validateVfsNodeName(".hidden"))).toBe(".hidden");
    expect(expectOk(validateVfsNodeName("  spaced  "))).toBe("  spaced  ");
    expect(expectOk(validateVfsNodeName('""'))).toBe('""');
  });
});
