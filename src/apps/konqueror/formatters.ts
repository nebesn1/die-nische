import { getVfsLinkTargetStatus } from "../../vfs/links";
import type { VfsNode, VfsState } from "../../vfs/types";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";

export function formatVfsByteSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  const kilobytes = size / 1024;

  return `${kilobytes.toFixed(1)} KB`;
}

export function formatKonquerorNodeSize(node: VfsNode): string {
  return node.kind === "file" ? formatVfsByteSize(node.size) : node.kind === "link" ? "0 B" : "-";
}

export function formatVfsModifiedTime(iso: string, options: { readonly locale?: string } = {}): string {
  return formatTimestampForLocalDisplay(iso, options);
}

export function formatKonquerorTimestamp(iso: string): string {
  return Number.isFinite(Date.parse(iso)) ? formatTimestampForLocalDisplay(iso) : "-";
}

export function getKonquerorNodeTypeLabel(node: VfsNode, state?: VfsState): string {
  if (node.kind === "directory") {
    return "Directory";
  }

  if (node.kind === "link") {
    return state && getVfsLinkTargetStatus(state, node.id).type !== "resolved" ? "Broken Link" : "Link";
  }

  if (node.mimeType === "text/plain") {
    return "Text Document";
  }

  return node.mimeType;
}
