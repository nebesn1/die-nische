import type { VfsFileNode, VfsNode, VfsState } from "../../vfs/types";

export type KonquerorFileIconId = "text-file" | "markdown-file" | "html-file" | "image-file" | "video-file" | "music-file";

export type KonquerorNodeIconId =
  | "folder"
  | "home"
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos"
  | "trash"
  | "cdrom"
  | "floppy"
  | KonquerorFileIconId;

const TEXT_FILE_EXTENSIONS = new Set(["txt"]);
const MARKDOWN_FILE_EXTENSIONS = new Set(["md"]);
const HTML_FILE_EXTENSIONS = new Set(["html", "htm"]);
const IMAGE_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"]);
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "webm", "ogv"]);
const MUSIC_FILE_EXTENSIONS = new Set(["mp3", "ogg", "oga", "wav"]);

const getFileExtension = (name: string): string | null => {
  const match = /\.([^.]+)$/.exec(name);
  return match?.[1].toLowerCase() ?? null;
};

function getFileIconId(node: VfsFileNode): KonquerorFileIconId {
  const extension = getFileExtension(node.name);

  if (extension && TEXT_FILE_EXTENSIONS.has(extension)) return "text-file";
  if (extension && MARKDOWN_FILE_EXTENSIONS.has(extension)) return "markdown-file";
  if (extension && HTML_FILE_EXTENSIONS.has(extension)) return "html-file";
  if (extension && IMAGE_FILE_EXTENSIONS.has(extension)) return "image-file";
  if (extension && VIDEO_FILE_EXTENSIONS.has(extension)) return "video-file";
  if (extension && MUSIC_FILE_EXTENSIONS.has(extension)) return "music-file";

  const mimeType = node.mimeType.toLowerCase();
  if (mimeType === "text/markdown") return "markdown-file";
  if (mimeType === "text/html") return "html-file";
  if (mimeType.startsWith("image/")) return "image-file";
  if (mimeType.startsWith("video/")) return "video-file";
  if (mimeType.startsWith("audio/")) return "music-file";

  return "text-file";
}

export function getKonquerorNodeIconId(node: VfsNode, state: VfsState): KonquerorNodeIconId {
  if (node.id === state.specialLocations.home) {
    return "home";
  }

  if (node.id === state.specialLocations.desktopDirectory) {
    return "desktop";
  }

  if (node.id === state.specialLocations.documents) {
    return "documents";
  }

  if (node.id === state.specialLocations.downloads) {
    return "downloads";
  }

  if (node.id === state.specialLocations.music) {
    return "music";
  }

  if (node.id === state.specialLocations.pictures) {
    return "pictures";
  }

  if (node.id === state.specialLocations.videos) {
    return "videos";
  }

  if (node.id === state.specialLocations.trash) {
    return "trash";
  }

  if (node.id === state.specialLocations.cdrom) {
    return "cdrom";
  }

  if (node.id === state.specialLocations.floppy) {
    return "floppy";
  }

  return node.kind === "directory" ? "folder" : node.kind === "file" ? getFileIconId(node) : "text-file";
}
