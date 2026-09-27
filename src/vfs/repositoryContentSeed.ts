import { getVfsUtf8ByteSize } from "./encoding";
import { createVfsAssetUrlFileContent, createVfsTextFileContent } from "./fileContent";
import { getVfsBasename, getVfsDirname, normalizeVfsPath, validateVfsNodeName } from "./path";
import { getVfsPathForNode } from "./queries";
import { REPOSITORY_CONTENT_MOUNT_PATHS, REPOSITORY_CONTENT_VIRTUAL_ROOT } from "./repositoryContentManifest";
import type { GeneratedVfsContentEntry, GeneratedVfsContentManifest } from "./repositoryContentManifest";
import type { VfsDirectoryNode, VfsFileNode, VfsNode, VfsNodeId, VfsState } from "./types";

const repositoryContentMountPaths = new Set<string>(REPOSITORY_CONTENT_MOUNT_PATHS);

const failManifest = (message: string): never => {
  throw new Error(`Repository content manifest error: ${message}`);
};

const requireDirectory = (node: VfsNode | undefined, virtualPath: string): VfsDirectoryNode => {
  if (!node || node.kind !== "directory") {
    throw new Error(`Repository content manifest error: Generated path '${virtualPath}' has no existing directory parent.`);
  }

  return node;
};

const getExistingPaths = (state: VfsState): Map<string, VfsNodeId> => {
  const paths = new Map<string, VfsNodeId>();

  Object.values(state.nodesById).forEach((node) => {
    const path = getVfsPathForNode(state, node.id);

    if (!path.ok) {
      throw new Error(`Repository content manifest error: Existing VFS node '${node.id}' does not have a valid canonical path.`);
    }

    const virtualPath = path.value;

    if (paths.has(virtualPath)) {
      failManifest(`Existing VFS contains duplicate path '${virtualPath}'.`);
    }

    paths.set(virtualPath, node.id);
  });

  return paths;
};

const validateEntryPath = (entry: GeneratedVfsContentEntry): void => {
  const normalized = normalizeVfsPath(entry.virtualPath);

  if (!normalized.ok || normalized.value !== entry.virtualPath) {
    failManifest(`Entry '${entry.id}' has a non-canonical virtual path '${entry.virtualPath}'.`);
  }

  if (
    entry.virtualPath !== REPOSITORY_CONTENT_VIRTUAL_ROOT &&
    !entry.virtualPath.startsWith(`${REPOSITORY_CONTENT_VIRTUAL_ROOT}/`)
  ) {
    failManifest(`Entry '${entry.id}' escapes repository content root: '${entry.virtualPath}'.`);
  }

  if (entry.virtualPath === REPOSITORY_CONTENT_VIRTUAL_ROOT && entry.parentVirtualPath !== null) {
    failManifest(`Repository content root must have a null parentVirtualPath.`);
  }

  if (entry.virtualPath !== REPOSITORY_CONTENT_VIRTUAL_ROOT) {
    const expectedParent = getVfsDirname(entry.virtualPath);

    if (entry.parentVirtualPath !== expectedParent) {
      failManifest(`Entry '${entry.virtualPath}' has parent '${entry.parentVirtualPath}', expected '${expectedParent}'.`);
    }
  }

  if (entry.name !== getVfsBasename(entry.virtualPath)) {
    failManifest(`Entry '${entry.virtualPath}' has a name that does not match its virtual path.`);
  }

  const name = validateVfsNodeName(entry.name);

  if (!name.ok) {
    failManifest(`Entry '${entry.virtualPath}' has an invalid node name.`);
  }

  if (entry.order !== undefined && !Number.isSafeInteger(entry.order)) {
    failManifest(`Entry '${entry.virtualPath}' has an invalid order value.`);
  }

  if (entry.kind === "file" && entry.source.kind === "text" && entry.size !== getVfsUtf8ByteSize(entry.source.text)) {
    failManifest(`Text file '${entry.virtualPath}' has a UTF-8 byte-size mismatch.`);
  }

  if (entry.kind === "file" && entry.source.kind === "asset-url" && (entry.source.url.length === 0 || !Number.isFinite(entry.size) || !Number.isInteger(entry.size) || entry.size < 0 || entry.mimeType.length === 0)) {
    failManifest(`Asset file '${entry.virtualPath}' requires a non-empty URL, MIME type, and non-negative integer size.`);
  }
};

const validateManifest = (manifest: GeneratedVfsContentManifest): void => {
  const paths = new Set<string>();
  const ids = new Set<string>();

  manifest.entries.forEach((entry) => {
    validateEntryPath(entry);

    if (paths.has(entry.virtualPath)) {
      failManifest(`Duplicate generated virtual path '${entry.virtualPath}'.`);
    }

    if (ids.has(entry.id)) {
      failManifest(`Duplicate generated node id '${entry.id}'.`);
    }

    paths.add(entry.virtualPath);
    ids.add(entry.id);
  });
};

const createDirectoryNode = (entry: Extract<GeneratedVfsContentEntry, { readonly kind: "directory" }>, parentId: VfsNodeId): VfsDirectoryNode => ({
  id: entry.id,
  name: entry.name,
  ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
  parentId,
  kind: "directory",
  childIds: [],
  createdAt: entry.created,
  modifiedAt: entry.modified,
});

const createFileNode = (entry: Extract<GeneratedVfsContentEntry, { readonly kind: "file" }>, parentId: VfsNodeId): VfsFileNode => {
  const publication = "publication" in entry ? entry.publication : undefined;

  return {
  id: entry.id,
  name: entry.name,
  ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
  parentId,
  kind: "file",
  encoding: "utf-8",
  mimeType: entry.mimeType,
  content: entry.source.kind === "text"
    ? createVfsTextFileContent(entry.source.text)
    : createVfsAssetUrlFileContent(entry.source.url),
  size: entry.size,
  ...(publication === undefined ? {} : { publication }),
  createdAt: entry.created,
  modifiedAt: entry.modified,
  };
};

/** Merges repository-owned baseline content without introducing runtime mutation semantics. */
export function mergeRepositoryContentManifest(
  initialState: VfsState,
  manifest: GeneratedVfsContentManifest,
): VfsState {
  validateManifest(manifest);

  const nodesById: Record<VfsNodeId, VfsNode> = { ...initialState.nodesById };
  const paths = getExistingPaths(initialState);

  manifest.entries.forEach((entry) => {
    const existingId = paths.get(entry.virtualPath);

    if (existingId) {
      const existing = nodesById[existingId];

      if (!repositoryContentMountPaths.has(entry.virtualPath) || entry.kind !== "directory" || existing?.kind !== "directory") {
        failManifest(`Generated path '${entry.virtualPath}' conflicts with existing platform node '${existingId}'.`);
      }

      nodesById[existingId] = {
        ...existing,
        createdAt: entry.created,
        modifiedAt: entry.modified,
      };

      return;
    }

    if (nodesById[entry.id]) {
      failManifest(`Generated node id '${entry.id}' conflicts with an existing VFS node.`);
    }

    const parentId = entry.parentVirtualPath === null ? undefined : paths.get(entry.parentVirtualPath);
    const directoryParent = requireDirectory(parentId ? nodesById[parentId] : undefined, entry.virtualPath);

    if (directoryParent.childIds.some((childId) => nodesById[childId]?.name === entry.name)) {
      failManifest(`Generated path '${entry.virtualPath}' conflicts with an existing sibling name.`);
    }

    const node = entry.kind === "directory"
      ? createDirectoryNode(entry, directoryParent.id)
      : createFileNode(entry, directoryParent.id);

    nodesById[directoryParent.id] = {
      ...directoryParent,
      childIds: [...directoryParent.childIds, node.id],
    };
    nodesById[node.id] = node;
    paths.set(entry.virtualPath, node.id);
  });

  return {
    ...initialState,
    nodesById,
  };
}
