import { describe, expect, it } from "vitest";
import { getKWriteShortcut } from "./keyboardShortcuts";

const event = (overrides: Partial<Parameters<typeof getKWriteShortcut>[0]> = {}) => ({
  key: "n",
  ctrlKey: true,
  metaKey: false,
  altKey: true,
  shiftKey: false,
  ...overrides,
});

describe("KWrite local shortcuts", () => {
  it("recognizes Ctrl+Alt+N and keeps Ctrl+O, Ctrl+S, and Ctrl+Shift+S with Save As priority", () => {
    expect(getKWriteShortcut(event())).toBe("new");
    expect(getKWriteShortcut(event({ key: "o", altKey: false }))).toBe("open");
    expect(getKWriteShortcut(event({ key: "s", altKey: false }))).toBe("save");
    expect(getKWriteShortcut(event({ key: "S", altKey: false, shiftKey: true }))).toBe("save-as");
  });

  it("does not claim browser-reserved Ctrl+N, ordinary typing, or unrelated modifiers", () => {
    expect(getKWriteShortcut(event({ altKey: false }))).toBeNull();
    expect(getKWriteShortcut(event({ ctrlKey: false, altKey: false, key: "n" }))).toBeNull();
    expect(getKWriteShortcut(event({ ctrlKey: false, altKey: false, shiftKey: true, key: "N" }))).toBeNull();
    expect(getKWriteShortcut(event({ shiftKey: true }))).toBeNull();
    expect(getKWriteShortcut(event({ metaKey: true }))).toBeNull();
  });
});
