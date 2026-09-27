import { getVfsUtf8ByteSize } from "./encoding";
import { isVfsAssetUrlFile, isVfsTextFile } from "./fileContent";
import { formatVfsNodeId } from "./mutations";
import { validateVfsNodeName } from "./path";
import type { VfsDirectoryNode, VfsNodeId, VfsState } from "./types";

export interface VfsInvariantViolation {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: VfsNodeId;
}

const addViolation = (
  violations: VfsInvariantViolation[],
  code: string,
  message: string,
  nodeId?: VfsNodeId,
) => {
  violations.push({ code, message, nodeId });
};

const isDirectory = (node: VfsState["nodesById"][string] | undefined): node is VfsDirectoryNode => {
  return node?.kind === "directory";
};

export function validateVfsState(state: VfsState): readonly VfsInvariantViolation[] {
  const violations: VfsInvariantViolation[] = [];
  const root = state.nodesById[state.rootId];

  if (!root) {
    addViolation(violations, "MISSING_ROOT", "rootId does not reference an existing node.", state.rootId);
  } else {
    if (root.kind !== "directory") {
      addViolation(violations, "ROOT_NOT_DIRECTORY", "Root node must be a directory.", root.id);
    }

    if (root.parentId !== null) {
      addViolation(violations, "ROOT_HAS_PARENT", "Root node parentId must be null.", root.id);
    }
  }

  Object.values(state.nodesById).forEach((node) => {
    if (node.id !== state.rootId && node.parentId === null) {
      addViolation(violations, "NON_ROOT_WITHOUT_PARENT", "Non-root nodes must have a parent.", node.id);
    }

    if (node.parentId !== null && !isDirectory(state.nodesById[node.parentId])) {
      addViolation(violations, "PARENT_NOT_DIRECTORY", "Node parentId must reference a directory.", node.id);
    }

    if (node.kind === "directory") {
      const seenChildIds = new Set<VfsNodeId>();
      const seenNames = new Set<string>();

      node.childIds.forEach((childId) => {
        if (seenChildIds.has(childId)) {
          addViolation(violations, "DUPLICATE_CHILD_ID", "Directory childIds cannot contain duplicates.", node.id);
        }

        seenChildIds.add(childId);

        const child = state.nodesById[childId];

        if (!child) {
          addViolation(violations, "MISSING_CHILD", "Directory childId does not reference an existing node.", childId);
          return;
        }

        if (child.parentId !== node.id) {
          addViolation(violations, "CHILD_PARENT_MISMATCH", "Child parentId does not match containing directory.", child.id);
        }

        if (seenNames.has(child.name)) {
          addViolation(violations, "DUPLICATE_CHILD_NAME", "Sibling node names must be unique.", child.id);
        }

        seenNames.add(child.name);
      });
    } else if (isVfsTextFile(node) && node.size !== getVfsUtf8ByteSize(node.content.text)) {
      addViolation(violations, "FILE_SIZE_MISMATCH", "Text file size must match UTF-8 content byte length.", node.id);
    } else if (isVfsAssetUrlFile(node) && (node.content.url.length === 0 || !Number.isFinite(node.size) || !Number.isInteger(node.size) || node.size < 0 || node.mimeType.length === 0)) {
      addViolation(violations, "INVALID_ASSET_FILE", "Asset files require a non-empty URL, MIME type, and non-negative integer size.", node.id);
    }
  });

  const reachable = new Set<VfsNodeId>();
  const visit = (nodeId: VfsNodeId, ancestors: Set<VfsNodeId>) => {
    if (ancestors.has(nodeId)) {
      addViolation(violations, "PARENT_CYCLE", "Directory traversal found a cycle.", nodeId);
      return;
    }

    const node = state.nodesById[nodeId];

    if (!node || reachable.has(nodeId)) {
      return;
    }

    reachable.add(nodeId);

    if (node.kind === "directory") {
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(nodeId);
      node.childIds.forEach((childId) => visit(childId, nextAncestors));
    }
  };

  visit(state.rootId, new Set());

  Object.values(state.nodesById).forEach((node) => {
    const seen = new Set<VfsNodeId>();
    let current: typeof node | undefined = node;

    while (current && current.parentId !== null) {
      if (seen.has(current.id)) {
        addViolation(violations, "PARENT_CYCLE", "Parent chain contains a cycle.", node.id);
        return;
      }

      seen.add(current.id);
      current = state.nodesById[current.parentId];
    }
  });

  Object.values(state.nodesById).forEach((node) => {
    if (!reachable.has(node.id)) {
      addViolation(violations, "ORPHAN_NODE", "Node is not reachable from root.", node.id);
    }
  });

  Object.values(state.specialLocations).forEach((nodeId) => {
    const node = state.nodesById[nodeId];

    if (!node) {
      addViolation(violations, "MISSING_SPECIAL_LOCATION", "Special location does not exist.", nodeId);
      return;
    }

    if (node.kind !== "directory") {
      addViolation(violations, "SPECIAL_LOCATION_NOT_DIRECTORY", "Special location must reference a directory.", nodeId);
    }
  });

  const trash = state.nodesById[state.specialLocations.trash];

  if (trash && trash.kind === "directory") {
    const directTrashChildren = new Set(trash.childIds);

    Object.entries(state.trashEntriesByNodeId).forEach(([entryNodeId, entry]) => {
      const node = state.nodesById[entry.nodeId];

      if (entry.nodeId !== entryNodeId) {
        addViolation(violations, "TRASH_ENTRY_KEY_MISMATCH", "Trash entry key must match entry nodeId.", entry.nodeId);
      }

      if (!node) {
        addViolation(violations, "TRASH_ENTRY_NODE_MISSING", "Trash entry nodeId does not exist.", entry.nodeId);
        return;
      }

      if (entry.nodeId === state.specialLocations.trash) {
        addViolation(violations, "TRASH_ROOT_HAS_ENTRY", "Trash root cannot have trash metadata.", entry.nodeId);
      }

      if (entry.originalParentId === entry.nodeId) {
        addViolation(violations, "TRASH_ENTRY_SELF_PARENT", "Trash entry originalParentId cannot equal nodeId.", entry.nodeId);
      }

      if (!validateVfsNodeName(entry.originalName).ok) {
        addViolation(violations, "TRASH_ENTRY_INVALID_ORIGINAL_NAME", "Trash entry originalName must be a valid node name.", entry.nodeId);
      }

      if (node.parentId !== trash.id || !directTrashChildren.has(entry.nodeId)) {
        addViolation(violations, "TRASH_ENTRY_NOT_DIRECT_CHILD", "Trash entry node must be a direct Trash child.", entry.nodeId);
      }
    });

    trash.childIds.forEach((childId) => {
      if (!state.trashEntriesByNodeId[childId]) {
        addViolation(violations, "TRASH_CHILD_MISSING_ENTRY", "Every direct Trash child must have trash metadata.", childId);
      }
    });

    Object.values(state.nodesById).forEach((node) => {
      if (state.trashEntriesByNodeId[node.id] && node.parentId !== trash.id) {
        addViolation(violations, "NON_TRASH_CHILD_HAS_ENTRY", "Only direct Trash children can have trash metadata.", node.id);
      }
    });
  } else if (Object.keys(state.trashEntriesByNodeId).length > 0) {
    addViolation(violations, "TRASH_METADATA_WITHOUT_TRASH", "Trash metadata cannot exist without a Trash directory.", state.specialLocations.trash);
  }

  const nextNodeId = formatVfsNodeId(state.nextNodeSequence);

  if (state.nodesById[nextNodeId]) {
    addViolation(violations, "NEXT_NODE_ID_COLLISION", "nextNodeSequence would generate an existing node id.", nextNodeId);
  }

  return violations;
}
