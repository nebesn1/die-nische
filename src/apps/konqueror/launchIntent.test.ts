import { describe, expect, it } from "vitest";
import {
  createKonquerorOpenDirectoryIntent,
  createKonquerorOpenExternalWebIntent,
  createKonquerorOpenFileIntent,
  createKonquerorOpenLocationIntent,
  createKonquerorOpenStartIntent,
  createKonquerorOpenSysinfoIntent,
  isKonquerorOpenDirectoryIntent,
  isKonquerorOpenExternalWebIntent,
  isKonquerorOpenFileIntent,
  isKonquerorOpenLocationIntent,
  isKonquerorOpenStartIntent,
  isKonquerorOpenSysinfoIntent,
} from "./launchIntent";

describe("Konqueror launch intent", () => {
  it("creates typed Home, Documents, and Trash intents", () => {
    expect(createKonquerorOpenLocationIntent("home")).toEqual({
      type: "open-special-location",
      location: "home",
    });
    expect(createKonquerorOpenLocationIntent("trash")).toEqual({
      type: "open-special-location",
      location: "trash",
    });
    expect(createKonquerorOpenLocationIntent("documents")).toEqual({
      type: "open-special-location",
      location: "documents",
    });
  });

  it("accepts only Konqueror special-location intents", () => {
    expect(isKonquerorOpenLocationIntent({ type: "open-special-location", location: "home" })).toBe(true);
    expect(isKonquerorOpenLocationIntent({ type: "open-special-location", location: "trash" })).toBe(true);
    expect(isKonquerorOpenLocationIntent({ type: "open-special-location", location: "documents" })).toBe(true);
    expect(isKonquerorOpenLocationIntent({ type: "open-path", path: "/home/user/.local/share/Trash/files" })).toBe(false);
    expect(isKonquerorOpenLocationIntent(null)).toBe(false);
  });

  it("creates and narrows stable-node directory intents", () => {
    expect(createKonquerorOpenDirectoryIntent("vfs-documents")).toEqual({
      type: "open-directory",
      nodeId: "vfs-documents",
    });
    expect(isKonquerorOpenDirectoryIntent({ type: "open-directory", nodeId: "vfs-documents" })).toBe(true);
    expect(isKonquerorOpenDirectoryIntent({ type: "open-directory", nodeId: "" })).toBe(false);
    expect(isKonquerorOpenDirectoryIntent({ type: "open-directory", path: "/home/user/Documents" })).toBe(false);
    expect(isKonquerorOpenDirectoryIntent({ type: "open-special-location", location: "home" })).toBe(false);
  });

  it("creates stable-node file intents while allowing a current previewer to be preserved", () => {
    expect(createKonquerorOpenFileIntent("vfs-page", "embedded-text")).toEqual({
      type: "open-file",
      nodeId: "vfs-page",
      previewerId: "embedded-text",
    });
    expect(isKonquerorOpenFileIntent({ type: "open-file", nodeId: "vfs-page", previewerId: "khtml" })).toBe(true);
    expect(isKonquerorOpenFileIntent({ type: "open-file", nodeId: "vfs-page", previewerId: "unknown" })).toBe(false);
    expect(isKonquerorOpenFileIntent({ type: "open-file", nodeId: "" })).toBe(false);
  });

  it("creates a validated HTTPS external-web intent without accepting unsafe schemes", () => {
    expect(createKonquerorOpenExternalWebIntent("https://example.com/path")).toEqual({ type: "open-external-web", canonicalUrl: "https://example.com/path" });
    expect(isKonquerorOpenExternalWebIntent({ type: "open-external-web", canonicalUrl: "https://example.com/path" })).toBe(true);
    expect(isKonquerorOpenExternalWebIntent({ type: "open-external-web", canonicalUrl: "http://example.com" })).toBe(false);
    expect(isKonquerorOpenExternalWebIntent({ type: "open-external-web", canonicalUrl: "javascript:alert(1)" })).toBe(false);
  });

  it("creates and narrows the existing Konqueror sysinfo intent", () => {
    expect(createKonquerorOpenSysinfoIntent()).toEqual({ type: "open-sysinfo" });
    expect(isKonquerorOpenSysinfoIntent({ type: "open-sysinfo" })).toBe(true);
    expect(isKonquerorOpenSysinfoIntent({ type: "open-sysinfo", path: "sysinfo:/" })).toBe(true);
    expect(isKonquerorOpenSysinfoIntent({ type: "open-special-location", location: "home" })).toBe(false);
  });

  it("creates and narrows the generic Konqueror Start Page intent", () => {
    expect(createKonquerorOpenStartIntent()).toEqual({ type: "open-konqueror-start" });
    expect(isKonquerorOpenStartIntent({ type: "open-konqueror-start" })).toBe(true);
    expect(isKonquerorOpenStartIntent({ type: "open-konqueror-start", path: "about:konqueror" })).toBe(true);
    expect(isKonquerorOpenStartIntent({ type: "open-sysinfo" })).toBe(false);
  });
});
