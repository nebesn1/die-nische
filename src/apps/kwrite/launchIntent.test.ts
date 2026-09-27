import { describe, expect, it } from "vitest";
import { createKWriteOpenTextFileIntent, isKWriteOpenTextFileIntent } from "./launchIntent";

describe("KWrite launch intent", () => {
  it("creates and narrows stable text-file node intents", () => {
    expect(createKWriteOpenTextFileIntent("node:notes")).toEqual({ type: "open-text-file", nodeId: "node:notes" });
    expect(isKWriteOpenTextFileIntent({ type: "open-text-file", nodeId: "node:notes" })).toBe(true);
    expect(isKWriteOpenTextFileIntent({ type: "open-text-file", path: "/home/user/Notes.txt" })).toBe(false);
    expect(isKWriteOpenTextFileIntent({ type: "open-special-location", location: "home" })).toBe(false);
  });
});
