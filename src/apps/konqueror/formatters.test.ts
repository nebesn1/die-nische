import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import type { VfsTextFileNode } from "../../vfs/types";
import { createVfsDirectory, createVfsLinks, moveVfsNodeToTrash } from "../../vfs/mutations";
import {
  formatKonquerorNodeSize,
  formatKonquerorTimestamp,
  formatVfsByteSize,
  formatVfsModifiedTime,
  getKonquerorNodeTypeLabel,
} from "./formatters";

describe("Konqueror formatters", () => {
  it("formats directory and file sizes deterministically", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    const welcome = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

    expect(formatKonquerorNodeSize(documents)).toBe("-");
    expect(formatKonquerorNodeSize(welcome)).toBe("111 B");
    expect(formatVfsByteSize(0)).toBe("0 B");
    expect(formatVfsByteSize(12)).toBe("12 B");
    expect(formatVfsByteSize(1229)).toBe("1.2 KB");
  });

  it("delegates modified timestamps to the browser-local presentation formatter", () => {
    expect(formatVfsModifiedTime("not-a-date")).toBe("not-a-date");

    const source = readFileSync(new URL("./formatters.ts", import.meta.url), "utf8");
    expect(source).toContain("formatTimestampForLocalDisplay");
    expect(source).not.toContain("getUTC");
  });

  it("uses the same local formatter with a safe Properties fallback for invalid timestamps", () => {
    expect(formatKonquerorTimestamp("2026-08-11T14:30:00.000Z")).toBe(
      formatVfsModifiedTime("2026-08-11T14:30:00.000Z"),
    );
    expect(formatKonquerorTimestamp("not-a-date")).toBe("-");
  });

  it("formats type labels", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    const welcome = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    const customFile: VfsTextFileNode = {
      ...(welcome as VfsTextFileNode),
      mimeType: "text/x-log",
    };

    expect(getKonquerorNodeTypeLabel(documents)).toBe("Directory");
    expect(getKonquerorNodeTypeLabel(welcome)).toBe("text/markdown");
    expect(getKonquerorNodeTypeLabel(customFile)).toBe("text/x-log");
  });

  it("presents Link metadata rather than target directory metadata", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Folder", {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!folder.ok) throw new Error("Folder fixture failed");
    const linked = createVfsLinks(folder.state, "vfs-downloads", [folder.value.id], {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!linked.ok) throw new Error("Link fixture failed");
    const link = linked.value[0]!;

    expect(formatKonquerorNodeSize(link)).toBe("0 B");
    expect(getKonquerorNodeTypeLabel(link, linked.state)).toBe("Link");

    const trashedTarget = moveVfsNodeToTrash(linked.state, "/home/user/Documents/Folder", {
      now: "2026-09-02T00:01:00.000Z",
    });
    if (!trashedTarget.ok) throw new Error("Trash fixture failed");
    expect(getKonquerorNodeTypeLabel(trashedTarget.state.nodesById[link.id]!, trashedTarget.state)).toBe("Broken Link");
  });
});
