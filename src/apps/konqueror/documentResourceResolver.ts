import { getVfsDirname, normalizeVfsPath } from "../../vfs/path";
import { getVfsFileAssetUrl } from "../../vfs/fileContent";
import { resolveVfsPath } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { getKonquerorImageSource, isKonquerorImageFile } from "./imagePreviewModel";

export type KonquerorDocumentResourceReference =
  | { readonly kind: "vfs"; readonly path: string }
  | { readonly kind: "external"; readonly url: string }
  | { readonly kind: "fragment"; readonly fragment: string }
  | { readonly kind: "unsupported" };

const schemePattern = /^[a-z][a-z0-9+.-]*:/i;

export function resolveDocumentResourceReference(documentPath: string, reference: string): KonquerorDocumentResourceReference {
  if (reference.length === 0) return { kind: "unsupported" };
  if (reference.startsWith("#")) return { kind: "fragment", fragment: reference.slice(1) };

  const fragmentIndex = reference.indexOf("#");
  const pathReference = fragmentIndex >= 0 ? reference.slice(0, fragmentIndex) : reference;
  if (pathReference.length === 0 || pathReference.includes("?")) return { kind: "unsupported" };

  if (schemePattern.test(pathReference)) {
    try {
      const url = new URL(pathReference);
      return url.protocol === "https:" && url.hostname.length > 0
        ? { kind: "external", url: url.href }
        : { kind: "unsupported" };
    } catch {
      return { kind: "unsupported" };
    }
  }

  const normalized = normalizeVfsPath(pathReference, getVfsDirname(documentPath));
  return normalized.ok ? { kind: "vfs", path: normalized.value } : { kind: "unsupported" };
}

export function getKonquerorDocumentImageSource(state: VfsState, documentPath: string, reference: string): string | null {
  const resolved = resolveDocumentResourceReference(documentPath, reference);
  if (resolved.kind !== "vfs") return null;
  const target = resolveVfsPath(state, resolved.path);
  return target.ok && target.value.kind === "file" && isKonquerorImageFile(target.value)
    ? getKonquerorImageSource(target.value)
    : null;
}

/** Resolves document media to the same browser-safe VFS asset or HTTPS source boundary. */
export function getKonquerorDocumentResourceSource(state: VfsState | null, documentPath: string, reference: string): string | null {
  const resolved = resolveDocumentResourceReference(documentPath, reference);
  if (resolved.kind === "external") return resolved.url;
  if (resolved.kind !== "vfs" || state === null) return null;
  const target = resolveVfsPath(state, resolved.path);
  const assetUrl = target.ok && target.value.kind === "file" ? getVfsFileAssetUrl(target.value) : null;
  return assetUrl !== null && !assetUrl.toLowerCase().startsWith("data:") ? assetUrl : null;
}
