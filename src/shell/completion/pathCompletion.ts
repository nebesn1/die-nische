import { normalizeVfsPath } from "../../vfs/path";
import { getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import { isVfsNodeInsideTrash } from "../../vfs/tree";
import type { VfsNode, VfsState } from "../../vfs/types";
import { encodeShellCompletionValue } from "./quoting";
import type { ShellPathCompletionFilter } from "./context";
import type { ShellCompletionCandidate, ShellCompletionToken } from "./types";

const splitPathPrefix = (path: string): { readonly directoryPrefix: string; readonly namePrefix: string } => {
  const slashIndex = path.lastIndexOf("/");

  if (slashIndex < 0) {
    return {
      directoryPrefix: "",
      namePrefix: path,
    };
  }

  return {
    directoryPrefix: path.slice(0, slashIndex + 1),
    namePrefix: path.slice(slashIndex + 1),
  };
};

const getParentOperand = (directoryPrefix: string): string => {
  if (directoryPrefix.length === 0) {
    return ".";
  }

  if (directoryPrefix === "/") {
    return "/";
  }

  return directoryPrefix.slice(0, -1) || ".";
};

const matchesFilter = (state: VfsState, node: VfsNode, filter: ShellPathCompletionFilter): boolean => {
  if (filter === "all") {
    return true;
  }

  if (filter === "directories") {
    return node.kind === "directory";
  }

  if (filter === "writable-files") {
    return node.kind === "file" && !isVfsNodeInsideTrash(state, node.id);
  }

  return node.kind === "file";
};

export function getPathCompletionCandidates(
  vfsState: VfsState,
  cwdNodeId: string,
  token: ShellCompletionToken,
  filter: ShellPathCompletionFilter,
): readonly ShellCompletionCandidate[] {
  const cwdPath = getVfsPathForNode(vfsState, cwdNodeId);

  if (!cwdPath.ok) {
    return [];
  }

  const { directoryPrefix, namePrefix } = splitPathPrefix(token.value);
  const parentOperand = getParentOperand(directoryPrefix);
  const normalizedParent = normalizeVfsPath(parentOperand, cwdPath.value);

  if (!normalizedParent.ok) {
    return [];
  }

  const children = listVfsDirectory(vfsState, normalizedParent.value);

  if (!children.ok) {
    return [];
  }

  return children.value.flatMap((node): readonly ShellCompletionCandidate[] => {
    if (!node.name.startsWith(namePrefix) || !matchesFilter(vfsState, node, filter)) {
      return [];
    }

    const completionValue = `${directoryPrefix}${node.name}${node.kind === "directory" ? "/" : ""}`;
    const encoded = encodeShellCompletionValue(completionValue, token.quoteMode);

    if (encoded === null) {
      return [];
    }

    return [
      {
        value: completionValue,
        displayText: node.kind === "directory" ? `${node.name}/` : node.name,
        insertionText: token.quoteMode === "unquoted" && node.kind === "file" ? `${encoded} ` : encoded,
        kind: node.kind === "directory" ? "directory" : "file",
      },
    ];
  });
}
