import { normalizeVfsPath } from "../../vfs/path";
import { getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import type { VfsNode, VfsState } from "../../vfs/types";
import { encodeShellCompletionValue } from "./quoting";
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

const createCandidate = (
  node: VfsNode,
  directoryPrefix: string,
  token: ShellCompletionToken,
): ShellCompletionCandidate | null => {
  const completionValue = `${directoryPrefix}${node.name}`;
  const encoded = encodeShellCompletionValue(completionValue, token.quoteMode);

  if (encoded === null) {
    return null;
  }

  return {
    value: completionValue,
    displayText: node.kind === "directory" ? `${node.name}/` : node.name,
    insertionText: token.quoteMode === "unquoted" ? `${encoded} ` : encoded,
    kind: node.kind === "directory" ? "directory" : "file",
  };
};

export function getTrashEntryCompletionCandidates(
  vfsState: VfsState,
  cwdNodeId: string,
  token: ShellCompletionToken,
): readonly ShellCompletionCandidate[] {
  const cwdPath = getVfsPathForNode(vfsState, cwdNodeId);

  if (!cwdPath.ok) {
    return [];
  }

  const trashPath = getVfsPathForNode(vfsState, vfsState.specialLocations.trash);

  if (!trashPath.ok) {
    return [];
  }

  const { directoryPrefix, namePrefix } = splitPathPrefix(token.value);
  const parent = normalizeVfsPath(getParentOperand(directoryPrefix), cwdPath.value);

  if (!parent.ok || parent.value !== trashPath.value) {
    return [];
  }

  const entries = listVfsDirectory(vfsState, trashPath.value);

  if (!entries.ok) {
    return [];
  }

  return entries.value.flatMap((node): readonly ShellCompletionCandidate[] => {
    if (!node.name.startsWith(namePrefix)) {
      return [];
    }

    const candidate = createCandidate(node, directoryPrefix, token);

    return candidate ? [candidate] : [];
  });
}
