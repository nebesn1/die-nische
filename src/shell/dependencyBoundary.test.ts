import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Shell dependency boundary", () => {
  it("keeps production shell core independent from UI, runtime, and host shell APIs", () => {
    const directory = fileURLToPath(new URL(".", import.meta.url));
    const source = readdirSync(directory, { recursive: true })
      .filter((fileName) => typeof fileName === "string")
      .filter((fileName) => fileName.endsWith(".ts"))
      .filter((fileName) => !fileName.includes(".test."))
      .map((fileName) => readFileSync(join(directory, fileName), "utf8"))
      .join("\n");

    expect(source).not.toContain("react");
    expect(source).not.toContain("window-manager");
    expect(source).not.toContain("application-runtime");
    expect(source).not.toContain("VfsProvider");
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("node:path");
    expect(source).not.toContain("eval(");
    expect(source).not.toContain("new Function");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("showOpenFilePicker");
    expect(source).not.toContain("new RegExp");
  });

  it("keeps find and tree traversal on the public VFS query boundary", () => {
    const directory = fileURLToPath(new URL(".", import.meta.url));
    const traversalSource = readFileSync(join(directory, "vfsTraversal.ts"), "utf8");

    expect(traversalSource).not.toContain("nodesById");
    expect(traversalSource).toContain("getVfsNodeById");
    expect(traversalSource).toContain("getVfsPathForNode");
    expect(traversalSource).toContain("listVfsDirectory");
  });

  it("keeps lexical basename and dirname independent from VFS queries", () => {
    const directory = fileURLToPath(new URL(".", import.meta.url));
    const source = readFileSync(join(directory, "posixPath.ts"), "utf8");

    expect(source).not.toContain("../vfs");
    expect(source).not.toContain("node:path");
    expect(source).not.toContain("react");
  });
});
