import type { VfsPublicationMetadata } from "./types";

export const REPOSITORY_CONTENT_VIRTUAL_ROOT = "/home/user";

export const REPOSITORY_CONTENT_MOUNT_PATHS = [
  REPOSITORY_CONTENT_VIRTUAL_ROOT,
  "/home/user/Desktop",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Videos",
] as const;

export interface GeneratedVfsContentDirectoryEntry {
  readonly kind: "directory";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string | null;
  readonly name: string;
  readonly displayName?: string;
  readonly created: string;
  readonly modified: string;
  readonly order?: number;
}

export interface GeneratedVfsContentTextSource {
  readonly kind: "text";
  readonly text: string;
}

export interface GeneratedVfsContentAssetUrlSource {
  readonly kind: "asset-url";
  readonly url: string;
}

export type GeneratedVfsContentFileSource = GeneratedVfsContentTextSource | GeneratedVfsContentAssetUrlSource;

export interface GeneratedVfsContentTextFileEntry {
  readonly kind: "file";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string;
  readonly name: string;
  readonly displayName?: string;
  readonly mimeType: string;
  readonly size: number;
  readonly created: string;
  readonly modified: string;
  readonly order?: number;
  readonly publication?: VfsPublicationMetadata;
  readonly source: GeneratedVfsContentTextSource;
}

export interface GeneratedVfsContentAssetFileEntry {
  readonly kind: "file";
  readonly id: string;
  readonly virtualPath: string;
  readonly parentVirtualPath: string;
  readonly name: string;
  readonly displayName?: string;
  readonly mimeType: string;
  readonly size: number;
  readonly created: string;
  readonly modified: string;
  readonly order?: number;
  readonly source: GeneratedVfsContentAssetUrlSource;
}

export type GeneratedVfsContentEntry = GeneratedVfsContentDirectoryEntry | GeneratedVfsContentTextFileEntry | GeneratedVfsContentAssetFileEntry;

export interface GeneratedVfsContentManifest {
  readonly entries: readonly GeneratedVfsContentEntry[];
}
