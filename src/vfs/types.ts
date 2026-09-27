export type VfsNodeId = string;

export interface VfsBaseNode {
  readonly id: VfsNodeId;
  readonly name: string;
  readonly displayName?: string;
  readonly parentId: VfsNodeId | null;
  readonly createdAt: string;
  readonly modifiedAt: string;
}

export interface VfsDirectoryNode extends VfsBaseNode {
  readonly kind: "directory";
  readonly childIds: readonly VfsNodeId[];
}

export interface VfsTextFileContent {
  readonly kind: "text";
  readonly text: string;
}

export interface VfsAssetUrlFileContent {
  readonly kind: "asset-url";
  readonly url: string;
}

export type VfsFileContent = VfsTextFileContent | VfsAssetUrlFileContent;

export type VfsPublicationStatus = "draft" | "published";

/** Explicit repository publishing intent; it never changes filesystem identity or lifecycle timestamps. */
export interface VfsPublicationMetadata {
  readonly status: VfsPublicationStatus;
  /** An optional authored current public route segment. v5+ repository metadata validates global route-token uniqueness. */
  readonly slug?: string;
  /** Explicit historical route segments, available in v6 repository metadata only. */
  readonly aliases?: readonly string[];
  readonly publishedAt?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
}

export interface VfsFileNode extends VfsBaseNode {
  readonly kind: "file";
  readonly encoding: "utf-8";
  readonly mimeType: string;
  readonly content: VfsFileContent;
  readonly size: number;
  readonly publication?: VfsPublicationMetadata;
}

/** A narrow file capability for operations that require UTF-8 text. */
export type VfsTextFileNode = VfsFileNode & { readonly content: VfsTextFileContent };

/** A static build asset reference; the URL is not a virtual VFS path. */
export type VfsAssetUrlFileNode = VfsFileNode & { readonly content: VfsAssetUrlFileContent };

/** A virtual identity reference. Its target is always a stable VFS NodeId, never a path. */
export interface VfsLinkNode extends VfsBaseNode {
  readonly kind: "link";
  readonly targetNodeId: VfsNodeId;
}

export type VfsNode = VfsDirectoryNode | VfsFileNode | VfsLinkNode;

export interface VfsSpecialLocations {
  readonly home: VfsNodeId;
  readonly desktopDirectory: VfsNodeId;
  readonly documents: VfsNodeId;
  readonly downloads: VfsNodeId;
  readonly music: VfsNodeId;
  readonly pictures: VfsNodeId;
  readonly videos: VfsNodeId;
  readonly trash: VfsNodeId;
  readonly cdrom: VfsNodeId;
  readonly floppy: VfsNodeId;
}

export interface VfsTrashEntry {
  readonly nodeId: VfsNodeId;
  readonly originalParentId: VfsNodeId;
  readonly originalName: string;
  readonly trashedAt: string;
}

export interface VfsState {
  readonly rootId: VfsNodeId;
  readonly nodesById: Readonly<Record<VfsNodeId, VfsNode>>;
  readonly specialLocations: VfsSpecialLocations;
  readonly trashEntriesByNodeId: Readonly<Record<VfsNodeId, VfsTrashEntry>>;
  readonly nextNodeSequence: number;
  readonly revision: number;
}

export interface VfsMutationOptions {
  readonly now: string;
}

export interface CreateVfsTextFileOptions extends VfsMutationOptions {
  readonly mimeType?: string;
}

export interface MoveVfsNodeOptions extends VfsMutationOptions {
  readonly newName?: string;
}

export interface CopyVfsNodeOptions extends VfsMutationOptions {
  readonly newName?: string;
}

export interface VfsDeleteResult {
  readonly deletedNodeIds: readonly VfsNodeId[];
}

export interface VfsBatchDeleteResult extends VfsDeleteResult {
  readonly deletedRootNodeIds: readonly VfsNodeId[];
}
