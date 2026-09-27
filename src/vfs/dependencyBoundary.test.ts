import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vfsRoot = dirname(fileURLToPath(import.meta.url));

const readSourceFiles = (directory: string): readonly string[] => {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return readSourceFiles(absolutePath);
    }

    const isRuntimeSource =
      (absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx")) && !absolutePath.includes(".test.");

    return isRuntimeSource ? [readFileSync(absolutePath, "utf8")] : [];
  });
};

describe("VFS dependency boundary", () => {
  it("does not import window-manager or application-runtime modules", () => {
    const source = readSourceFiles(vfsRoot).join("\n");

    expect(source).not.toContain("../window-manager");
    expect(source).not.toContain("../application-runtime");
  });

  it("does not call browser persistence or real file APIs", () => {
    const source = readSourceFiles(vfsRoot).join("\n");

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("showOpenFilePicker");
    expect(source).not.toContain("showSaveFilePicker");
    expect(source).not.toContain("FileSystemHandle");
  });
});
