import { generatedVfsContentManifest } from "../generated/vfsContentManifest.generated";
import { mergeRepositoryContentManifest } from "./repositoryContentSeed";
import type { VfsDirectoryNode, VfsNode, VfsNodeId, VfsState } from "./types";

export const PROJECT_EPOCH_TIMESTAMP = "2026-08-30T12:00:00.000Z";
export const INITIAL_VFS_TIMESTAMP = PROJECT_EPOCH_TIMESTAMP;

const ids = {
  root: "vfs-root",
  home: "vfs-home",
  user: "vfs-user",
  desktop: "vfs-desktop",
  documents: "vfs-documents",
  downloads: "vfs-downloads",
  music: "vfs-music",
  pictures: "vfs-pictures",
  videos: "vfs-videos",
  media: "vfs-media",
  cdrom: "vfs-cdrom",
  floppy: "vfs-floppy",
  local: "vfs-local",
  share: "vfs-share",
  trashContainer: "vfs-trash-container",
  trash: "vfs-trash-files",
} as const satisfies Record<string, VfsNodeId>;

const createDirectory = (
  id: VfsNodeId,
  name: string,
  parentId: VfsNodeId | null,
  childIds: readonly VfsNodeId[],
): VfsDirectoryNode => ({
  id,
  name,
  parentId,
  kind: "directory",
  childIds: [...childIds],
  createdAt: INITIAL_VFS_TIMESTAMP,
  modifiedAt: INITIAL_VFS_TIMESTAMP,
});

export function createInitialVfsState(): VfsState {
  const nodes: Record<VfsNodeId, VfsNode> = {
    [ids.root]: createDirectory(ids.root, "", null, [ids.home, ids.media]),
    [ids.home]: createDirectory(ids.home, "home", ids.root, [ids.user]),
    [ids.user]: createDirectory(ids.user, "user", ids.home, [
      ids.desktop,
      ids.documents,
      ids.downloads,
      ids.music,
      ids.pictures,
      ids.videos,
      ids.local,
    ]),
    [ids.desktop]: createDirectory(ids.desktop, "Desktop", ids.user, []),
    [ids.documents]: createDirectory(ids.documents, "Documents", ids.user, []),
    [ids.downloads]: createDirectory(ids.downloads, "Downloads", ids.user, []),
    [ids.music]: createDirectory(ids.music, "Music", ids.user, []),
    [ids.pictures]: createDirectory(ids.pictures, "Pictures", ids.user, []),
    [ids.videos]: createDirectory(ids.videos, "Videos", ids.user, []),
    [ids.local]: createDirectory(ids.local, ".local", ids.user, [ids.share]),
    [ids.share]: createDirectory(ids.share, "share", ids.local, [ids.trashContainer]),
    [ids.trashContainer]: createDirectory(ids.trashContainer, "Trash", ids.share, [ids.trash]),
    [ids.media]: createDirectory(ids.media, "media", ids.root, [ids.cdrom, ids.floppy]),
    [ids.cdrom]: createDirectory(ids.cdrom, "cdrom", ids.media, []),
    [ids.floppy]: createDirectory(ids.floppy, "floppy", ids.media, []),
    [ids.trash]: createDirectory(ids.trash, "files", ids.trashContainer, []),
  };

  const initialState: VfsState = {
    rootId: ids.root,
    nodesById: nodes,
    specialLocations: {
      home: ids.user,
      desktopDirectory: ids.desktop,
      documents: ids.documents,
      downloads: ids.downloads,
      music: ids.music,
      pictures: ids.pictures,
      videos: ids.videos,
      trash: ids.trash,
      cdrom: ids.cdrom,
      floppy: ids.floppy,
    },
    trashEntriesByNodeId: {},
    nextNodeSequence: 10,
    revision: 0,
  };

  return mergeRepositoryContentManifest(initialState, generatedVfsContentManifest);
}
