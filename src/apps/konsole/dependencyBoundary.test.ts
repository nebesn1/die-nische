import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = new URL(".", import.meta.url);

const readSourceFiles = (directory: URL): readonly string[] => {
  const entries = readdirSync(directory);

  return entries.flatMap((entry) => {
    const filePath = join(fileURLToPath(directory), entry);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      return readSourceFiles(new URL(`${entry}/`, directory));
    }

    return (entry.endsWith(".ts") || entry.endsWith(".tsx")) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")
      ? [readFileSync(filePath, "utf8")]
      : [];
  });
};

describe("Konsole dependency boundary", () => {
  it("does not import real shell or browser storage APIs", () => {
    const source = readSourceFiles(sourceDirectory).join("\n");

    expect(source).not.toContain("child_process");
    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("navigator.clipboard");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("eval(");
    expect(source).not.toContain("new Function");
  });
});
