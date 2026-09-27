import type { VfsFileNode } from "../../vfs/types";
import { isKonquerorImageFile } from "./imagePreviewModel";
import { getKonquerorMediaKind } from "./mediaPreviewModel";

export type KonquerorPreviewerId = "embedded-text" | "khtml" | "markdown" | "image" | "media-audio" | "media-video";

export type KonquerorPreviewer = {
  readonly id: KonquerorPreviewerId;
  readonly label: string;
};

const EMBEDDED_TEXT: KonquerorPreviewer = {
  id: "embedded-text",
  label: "Embedded Advanced Text Editor",
};

const KHTML: KonquerorPreviewer = { id: "khtml", label: "KHTML" };
const MARKDOWN: KonquerorPreviewer = { id: "markdown", label: "Markdown Renderer" };
const IMAGE: KonquerorPreviewer = { id: "image", label: "Image Viewer" };
const MEDIA_AUDIO: KonquerorPreviewer = { id: "media-audio", label: "Audio Player" };
const MEDIA_VIDEO: KonquerorPreviewer = { id: "media-video", label: "Video Player" };

const extensionFor = (name: string): string => {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
};

export function getAvailableKonquerorPreviewers(node: VfsFileNode): readonly KonquerorPreviewer[] {
  if (isKonquerorImageFile(node)) {
    return [IMAGE];
  }

  const mediaKind = getKonquerorMediaKind(node);
  if (mediaKind === "audio") return [MEDIA_AUDIO];
  if (mediaKind === "video") return [MEDIA_VIDEO];

  switch (extensionFor(node.name)) {
    case "html":
    case "htm":
      return [KHTML, EMBEDDED_TEXT];
    case "md":
    case "markdown":
      return [MARKDOWN, EMBEDDED_TEXT];
    default:
      return [EMBEDDED_TEXT];
  }
}

export function getDefaultKonquerorPreviewer(node: VfsFileNode): KonquerorPreviewerId {
  return getAvailableKonquerorPreviewers(node)[0].id;
}

export function resolveKonquerorPreviewer(
  node: VfsFileNode,
  requestedPreviewerId: KonquerorPreviewerId | undefined,
): KonquerorPreviewerId {
  const available = getAvailableKonquerorPreviewers(node);
  return available.some((previewer) => previewer.id === requestedPreviewerId)
    ? (requestedPreviewerId as KonquerorPreviewerId)
    : available[0].id;
}

export function getKonquerorPreviewerLabel(previewerId: KonquerorPreviewerId): string {
  switch (previewerId) {
    case "image":
      return IMAGE.label;
    case "media-audio":
      return MEDIA_AUDIO.label;
    case "media-video":
      return MEDIA_VIDEO.label;
    case "khtml":
      return KHTML.label;
    case "markdown":
      return MARKDOWN.label;
    default:
      return EMBEDDED_TEXT.label;
  }
}
