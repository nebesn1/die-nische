import type { VfsNodeId } from "../../vfs/types";
import type { KonquerorPreviewerId } from "./previewModel";
import type { KonquerorTabSession } from "./konquerorTabs";

export interface KonquerorOpenLocationIntent {
  readonly type: "open-special-location";
  readonly location: "home" | "documents" | "trash";
}

export interface KonquerorOpenDirectoryIntent {
  readonly type: "open-directory";
  readonly nodeId: VfsNodeId;
}

export interface KonquerorOpenFileIntent {
  readonly type: "open-file";
  readonly nodeId: VfsNodeId;
  readonly previewerId?: KonquerorPreviewerId;
}

/** A validated HTTPS target accepted by the existing Konqueror external-web view. */
export interface KonquerorOpenExternalWebIntent {
  readonly type: "open-external-web";
  readonly canonicalUrl: string;
}

export interface KonquerorOpenSysinfoIntent {
  readonly type: "open-sysinfo";
}

export interface KonquerorOpenStartIntent {
  readonly type: "open-konqueror-start";
}

/** Window-scoped launch payload used to move, rather than clone, an exact tab session. */
export interface KonquerorDetachTabIntent {
  readonly type: "detach-konqueror-tab";
  readonly tab: KonquerorTabSession;
}

export function createKonquerorOpenLocationIntent(
  location: KonquerorOpenLocationIntent["location"],
): KonquerorOpenLocationIntent {
  return {
    type: "open-special-location",
    location,
  };
}

export function isKonquerorOpenLocationIntent(value: unknown): value is KonquerorOpenLocationIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly location?: unknown };

  return (
    candidate.type === "open-special-location" &&
    (candidate.location === "home" || candidate.location === "documents" || candidate.location === "trash")
  );
}

export function createKonquerorOpenDirectoryIntent(nodeId: VfsNodeId): KonquerorOpenDirectoryIntent {
  return { type: "open-directory", nodeId };
}

export function isKonquerorOpenDirectoryIntent(value: unknown): value is KonquerorOpenDirectoryIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly nodeId?: unknown };
  return candidate.type === "open-directory" && typeof candidate.nodeId === "string" && candidate.nodeId.length > 0;
}

export function createKonquerorOpenFileIntent(
  nodeId: VfsNodeId,
  previewerId?: KonquerorPreviewerId,
): KonquerorOpenFileIntent {
  return { type: "open-file", nodeId, ...(previewerId ? { previewerId } : {}) };
}

export function isKonquerorOpenFileIntent(value: unknown): value is KonquerorOpenFileIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly nodeId?: unknown; readonly previewerId?: unknown };
  return candidate.type === "open-file" &&
    typeof candidate.nodeId === "string" &&
    candidate.nodeId.length > 0 &&
    (candidate.previewerId === undefined || candidate.previewerId === "embedded-text" || candidate.previewerId === "khtml" || candidate.previewerId === "markdown" || candidate.previewerId === "image" || candidate.previewerId === "media-audio" || candidate.previewerId === "media-video");
}

export function createKonquerorOpenExternalWebIntent(canonicalUrl: string): KonquerorOpenExternalWebIntent {
  return { type: "open-external-web", canonicalUrl };
}

export function isKonquerorOpenExternalWebIntent(value: unknown): value is KonquerorOpenExternalWebIntent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { readonly type?: unknown; readonly canonicalUrl?: unknown };
  if (candidate.type !== "open-external-web" || typeof candidate.canonicalUrl !== "string") return false;
  try {
    const url = new URL(candidate.canonicalUrl);
    return url.protocol === "https:" && url.hostname.length > 0 && url.href === candidate.canonicalUrl;
  } catch {
    return false;
  }
}

export function createKonquerorOpenSysinfoIntent(): KonquerorOpenSysinfoIntent {
  return { type: "open-sysinfo" };
}

export function isKonquerorOpenSysinfoIntent(value: unknown): value is KonquerorOpenSysinfoIntent {
  return typeof value === "object" && value !== null && (value as { readonly type?: unknown }).type === "open-sysinfo";
}

export function createKonquerorOpenStartIntent(): KonquerorOpenStartIntent {
  return { type: "open-konqueror-start" };
}

export function isKonquerorOpenStartIntent(value: unknown): value is KonquerorOpenStartIntent {
  return typeof value === "object" && value !== null && (value as { readonly type?: unknown }).type === "open-konqueror-start";
}

export function createKonquerorDetachTabIntent(tab: KonquerorTabSession): KonquerorDetachTabIntent {
  return { type: "detach-konqueror-tab", tab };
}

export function isKonquerorDetachTabIntent(value: unknown): value is KonquerorDetachTabIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly tab?: { readonly id?: unknown; readonly navigationState?: unknown } };
  return candidate.type === "detach-konqueror-tab" &&
    typeof candidate.tab?.id === "string" &&
    candidate.tab.id.startsWith("tab-") &&
    typeof candidate.tab.navigationState === "object" &&
    candidate.tab.navigationState !== null;
}
