import { describe, expect, it } from "vitest";
import type { VfsTextFileNode } from "../../vfs/types";
import type { KonquerorView } from "./navigationTypes";
import { getKonquerorSecurityInfo } from "./securityInfo";

const localHtmlNode: VfsTextFileNode = {
  id: "vfs-local-html",
  name: "Local page.html",
  parentId: "vfs-documents",
  kind: "file",
  encoding: "utf-8",
  mimeType: "text/html",
  content: { kind: "text", text: "<h1>Local</h1>" },
  size: 14,
  createdAt: "2026-08-01T00:00:00.000Z",
  modifiedAt: "2026-08-01T00:00:00.000Z",
};

describe("Konqueror security information", () => {
  it("classifies about:konqueror as an internal non-SSL page", () => {
    const info = getKonquerorSecurityInfo(
      { type: "about-konqueror", path: "about:konqueror" },
      null,
      null,
    );

    expect(info).toEqual({
      kind: "internal",
      location: "about:konqueror",
      typeLabel: "Internal Konqueror page",
      summary: "The current connection is not secured with SSL.",
    });
  });

  it("classifies local KHTML by its resolved file location without TLS fields", () => {
    const info = getKonquerorSecurityInfo(
      { type: "file", node: localHtmlNode, path: "/home/user/Documents/Local page.html" },
      "khtml",
      null,
    );

    expect(info).toEqual({
      kind: "local-file",
      location: "file:///home/user/Documents/Local%20page.html",
      typeLabel: "Local file",
      summary: "The current connection is not secured with SSL.",
    });
    expect(info).not.toHaveProperty("protocol");
    expect(info).not.toHaveProperty("certificate");
  });

  it("derives HTTPS host, canonical location, and default or explicit port from the owned URL", () => {
    const defaultPort = getKonquerorSecurityInfo(
      { type: "external-web", canonicalUrl: "https://www.example.com/path?q=one#fragment", path: "https://www.example.com/path?q=one#fragment" },
      null,
      { canonicalUrl: "https://www.example.com/path?q=one#fragment", generation: 1, status: "loading" },
    );
    const explicitPort = getKonquerorSecurityInfo(
      { type: "external-web", canonicalUrl: "https://example.com:8443/path", path: "https://example.com:8443/path" },
      null,
      { canonicalUrl: "https://example.com:8443/path", generation: 2, status: "loaded" },
    );

    expect(defaultPort).toMatchObject({
      kind: "external-https",
      location: "https://www.example.com/path?q=one#fragment",
      protocol: "HTTPS",
      host: "www.example.com",
      port: "443",
      loadStatus: "Loading",
    });
    expect(explicitPort).toMatchObject({ host: "example.com", port: "8443", loadStatus: "Page loaded" });
    expect(defaultPort).not.toHaveProperty("cipher");
    expect(defaultPort).not.toHaveProperty("certificate");
  });

  it("reports only the known owned external load lifecycle", () => {
    const view: Extract<KonquerorView, { readonly type: "external-web" }> = {
      type: "external-web",
      canonicalUrl: "https://example.com/",
      path: "https://example.com/",
    };

    expect(getKonquerorSecurityInfo(view, null, { canonicalUrl: view.canonicalUrl, generation: 1, status: "loaded" }))
      .toMatchObject({ loadStatus: "Page loaded" });
    expect(getKonquerorSecurityInfo(view, null, { canonicalUrl: view.canonicalUrl, generation: 1, status: "stopped" }))
      .toMatchObject({ loadStatus: "Loading stopped" });
  });

  it("does not expose Security for document or resource views", () => {
    const documentView: KonquerorView = {
      type: "file",
      node: { ...localHtmlNode, mimeType: "text/plain" },
      path: "/home/user/Documents/Notes.txt",
    };

    expect(getKonquerorSecurityInfo(documentView, "embedded-text", null)).toBeNull();
    expect(getKonquerorSecurityInfo({ type: "sysinfo", path: "sysinfo:/" }, null, null)).toBeNull();
  });
});
