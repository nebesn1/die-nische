import { createInitialVfsState } from "./initialState";
import type { VfsDirectoryNode, VfsState } from "./types";

/** Creates the fixed system tree without repository-seeded content entries. */
export function createVfsTestStateWithoutRepositoryContent(): VfsState {
  const state = createInitialVfsState();
  const repositoryNodeIds = new Set(
    Object.keys(state.nodesById).filter((nodeId) => nodeId.startsWith("vfs-content-")),
  );

  if (repositoryNodeIds.size === 0) return state;

  const nodesById = Object.fromEntries(
    Object.entries(state.nodesById)
      .filter(([nodeId]) => !repositoryNodeIds.has(nodeId))
      .map(([nodeId, node]) => [
        nodeId,
        node.kind === "directory"
          ? { ...node, childIds: node.childIds.filter((childId) => !repositoryNodeIds.has(childId)) } satisfies VfsDirectoryNode
          : node,
      ]),
  );

  return { ...state, nodesById };
}
