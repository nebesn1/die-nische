import type { KonquerorExternalWebLoadState } from "./externalWebLoadState";
import type { KonquerorPreviewerId } from "./previewModel";
import type { KonquerorView } from "./navigationTypes";

export type KonquerorSecurityInfo =
  | {
      readonly kind: "internal";
      readonly location: "about:konqueror";
      readonly typeLabel: "Internal Konqueror page";
      readonly summary: "The current connection is not secured with SSL.";
    }
  | {
      readonly kind: "local-file";
      readonly location: string;
      readonly typeLabel: "Local file";
      readonly summary: "The current connection is not secured with SSL.";
    }
  | {
      readonly kind: "external-https";
      readonly location: string;
      readonly protocol: "HTTPS";
      readonly host: string;
      readonly port: string;
      readonly loadStatus: "Loading" | "Page loaded" | "Loading stopped";
      readonly summary: "The current page was requested using HTTPS.";
    };

function getExternalLoadStatusLabel(
  loadState: KonquerorExternalWebLoadState | null,
): "Loading" | "Page loaded" | "Loading stopped" {
  switch (loadState?.status) {
    case "loaded":
      return "Page loaded";
    case "stopped":
      return "Loading stopped";
    case "loading":
    case "idle":
    default:
      return "Loading";
  }
}

export function getKonquerorSecurityInfo(
  view: KonquerorView,
  previewerId: KonquerorPreviewerId | null,
  externalLoadState: KonquerorExternalWebLoadState | null,
): KonquerorSecurityInfo | null {
  if (view.type === "about-konqueror") {
    return {
      kind: "internal",
      location: "about:konqueror",
      typeLabel: "Internal Konqueror page",
      summary: "The current connection is not secured with SSL.",
    };
  }

  if (view.type === "file" && previewerId === "khtml") {
    return {
      kind: "local-file",
      location: view.path.startsWith("/") ? new URL(view.path, "file://").toString() : view.path,
      typeLabel: "Local file",
      summary: "The current connection is not secured with SSL.",
    };
  }

  if (view.type !== "external-web") {
    return null;
  }

  const url = new URL(view.canonicalUrl);

  return {
    kind: "external-https",
    location: url.toString(),
    protocol: "HTTPS",
    host: url.hostname,
    port: url.port || "443",
    loadStatus: getExternalLoadStatusLabel(externalLoadState),
    summary: "The current page was requested using HTTPS.",
  };
}
