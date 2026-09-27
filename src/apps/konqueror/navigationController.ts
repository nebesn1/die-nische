import type { VfsError } from "../../vfs/errors";
import { getVfsDirname } from "../../vfs/path";
import { resolveVfsLinkTarget } from "../../vfs/links";
import { getVfsNodeById, getVfsPathForNode, listVfsDirectory, resolveVfsPath } from "../../vfs/queries";
import { fail, ok, type VfsResult } from "../../vfs/result";
import {
  getKonquerorTrashLocation,
  KONQUEROR_TRASH_LOCATION,
  VFS_TRASH_FILES_PATH,
} from "../../vfs/trashPaths";
import type { VfsDirectoryNode, VfsFileNode, VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import {
  getCurrentKonquerorLocationTarget,
  getCurrentKonquerorNodeId,
  getKonquerorHistoryTargets,
} from "./navigationState";
import {
  KONQUEROR_SYSINFO_LOCATION,
  KONQUEROR_ABOUT_LOCATION,
  KONQUEROR_BLANK_LOCATION,
  createKonquerorAboutLocationTarget,
  createKonquerorBlankLocationTarget,
  type KonquerorExternalWebLocationTarget,
  type KonquerorLocationTarget,
  type KonquerorNavigationState,
  type KonquerorResolvedHistoryTarget,
  type KonquerorResolvedLocation,
  type KonquerorView,
} from "./navigationTypes";
import { getDefaultKonquerorPreviewer } from "./previewModel";

export function getKonquerorCurrentPath(
  state: VfsState,
  navigationState: KonquerorNavigationState,
): VfsResult<string> {
  const currentTarget = getCurrentKonquerorLocationTarget(navigationState);

  if (currentTarget?.type === "sysinfo") {
    return ok(KONQUEROR_SYSINFO_LOCATION);
  }

  if (currentTarget?.type === "about-konqueror") {
    return ok(KONQUEROR_ABOUT_LOCATION);
  }

  if (currentTarget?.type === "about-blank") {
    return ok(KONQUEROR_BLANK_LOCATION);
  }

  if (currentTarget?.type === "external-web") {
    return ok(currentTarget.canonicalUrl);
  }

  const currentNodeId = getCurrentKonquerorNodeId(navigationState);

  if (!currentNodeId) {
    return fail({
      code: "NOT_FOUND",
      message: "Konqueror history does not reference a current node.",
    });
  }

  return getKonquerorLocationString(state, currentNodeId);
}

export function getKonquerorLocationString(state: VfsState, nodeId: VfsNodeId): VfsResult<string> {
  const trashLocation = getKonquerorTrashLocation(state, nodeId);

  return trashLocation === null ? getVfsPathForNode(state, nodeId) : ok(trashLocation);
}

const resolveKonquerorTrashLocation = (
  state: VfsState,
  location: string,
): VfsResult<KonquerorResolvedLocation> => {
  const relativePath = location.slice(KONQUEROR_TRASH_LOCATION.length);

  // Keep the protocol rooted at the Trash files directory. VFS resolution normally
  // accepts `..`, but `trash:/` must never expose its hidden backend ancestors.
  if (
    relativePath.startsWith("/") ||
    relativePath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return fail({ code: "INVALID_PATH", message: "Unsupported location.", path: location });
  }

  const node = resolveVfsPath(state, relativePath.length === 0 ? "." : relativePath, VFS_TRASH_FILES_PATH);

  if (!node.ok) {
    return node;
  }

  return resolveKonquerorResourceNode(state, node.value);
};

const toKonquerorLocationTarget = (node: VfsDirectoryNode | VfsFileNode): KonquerorLocationTarget =>
  node.kind === "directory"
    ? { type: "directory", nodeId: node.id }
    : { type: "file", nodeId: node.id, previewerId: getDefaultKonquerorPreviewer(node) };

const resolveKonquerorResourceNode = (
  state: VfsState,
  node: VfsNode,
): VfsResult<KonquerorResolvedLocation> => {
  if (node.kind === "link") {
    const target = resolveVfsLinkTarget(state, node.id);
    if (!target.ok) return target;
    if (target.value.node.kind === "link") {
      return fail({ code: "INVALID_PATH", message: "The link target cannot be resolved.", nodeId: node.id });
    }
    return ok({ node: target.value.node, path: target.value.path });
  }

  const path = getKonquerorLocationString(state, node.id);
  return path.ok ? ok({ node, path: path.value }) : path;
};

const resolveExternalWebLocation = (location: string): VfsResult<{ readonly target: KonquerorLocationTarget; readonly path: string }> | null => {
  let url: URL;

  try {
    url = new URL(location);
  } catch {
    if (location.startsWith("/") || location.startsWith(".") || location.includes(":")) {
      return null;
    }

    try {
      url = new URL(`https://${location}`);
    } catch {
      return null;
    }

    if (!url.hostname.includes(".")) {
      return null;
    }
  }

  if (url.protocol === "https:" && url.hostname.length > 0) {
    return ok({ target: { type: "external-web", canonicalUrl: url.href }, path: url.href });
  }

  return fail({ code: "INVALID_PATH", message: "Unsupported location.", path: location });
};

export function resolveKonquerorAbsoluteLocationTarget(
  state: VfsState,
  location: string,
): VfsResult<{ readonly target: KonquerorLocationTarget; readonly path: string }> {
  if (location === KONQUEROR_ABOUT_LOCATION) {
    return ok({ target: createKonquerorAboutLocationTarget("canonical"), path: KONQUEROR_ABOUT_LOCATION });
  }

  if (location === KONQUEROR_BLANK_LOCATION) {
    return ok({ target: createKonquerorBlankLocationTarget(), path: KONQUEROR_BLANK_LOCATION });
  }

  if (location === KONQUEROR_SYSINFO_LOCATION) {
    return ok({ target: { type: "sysinfo" }, path: KONQUEROR_SYSINFO_LOCATION });
  }

  if (location.startsWith(KONQUEROR_TRASH_LOCATION)) {
    const target = resolveKonquerorTrashLocation(state, location);
    return target.ok ? ok({ target: toKonquerorLocationTarget(target.value.node), path: target.value.path }) : target;
  }

  const externalWebLocation = resolveExternalWebLocation(location);
  if (externalWebLocation !== null) {
    return externalWebLocation;
  }

  if (location.includes(":")) {
    return fail({ code: "INVALID_PATH", message: "Unsupported location.", path: location });
  }

  const target = resolveKonquerorAbsoluteLocation(state, location);
  return target.ok ? ok({ target: toKonquerorLocationTarget(target.value.node), path: target.value.path }) : target;
}

export function resolveKonquerorLocation(
  state: VfsState,
  navigationState: KonquerorNavigationState,
  location: string,
): VfsResult<KonquerorResolvedLocation> {
  const currentNodeId = getCurrentKonquerorNodeId(navigationState);
  const currentNode = currentNodeId ? getVfsNodeById(state, currentNodeId) : null;
  const currentPath = currentNodeId ? getVfsPathForNode(state, currentNodeId) : null;

  if (!currentNode?.ok) {
    return fail({
      code: "NOT_FOUND",
      message: "Current Konqueror location no longer exists.",
      nodeId: currentNodeId ?? undefined,
    });
  }

  if (!currentPath?.ok) {
    return currentPath ?? fail({ code: "NOT_FOUND", message: "Current Konqueror location has no path." });
  }

  const cwd = currentNode.value.kind === "directory" ? currentPath.value : getVfsDirname(currentPath.value);
  const node = resolveVfsPath(state, location, cwd);

  if (!node.ok) {
    return node;
  }

  return resolveKonquerorResourceNode(state, node.value);
}

export function resolveKonquerorAbsoluteDirectoryLocation(
  state: VfsState,
  location: string,
): VfsResult<KonquerorResolvedLocation> {
  if (!location.startsWith("/")) {
    return fail({
      code: "INVALID_PATH",
      message: "Enter an absolute VFS path.",
      path: location,
    });
  }

  const node = resolveVfsPath(state, location);

  if (!node.ok) {
    return node;
  }

  const target = resolveKonquerorResourceNode(state, node.value);
  if (!target.ok) {
    return target;
  }

  if (target.value.node.kind !== "directory") {
    return fail({
      code: "NOT_DIRECTORY",
      message: "Location is not a directory.",
      path: location,
      nodeId: target.value.node.id,
    });
  }

  return target;
}

export function resolveKonquerorAbsoluteLocation(
  state: VfsState,
  location: string,
): VfsResult<KonquerorResolvedLocation> {
  if (!location.startsWith("/")) {
    return fail({
      code: "INVALID_PATH",
      message: "Enter an absolute VFS path.",
      path: location,
    });
  }

  const node = resolveVfsPath(state, location);

  if (!node.ok) {
    return node;
  }

  return resolveKonquerorResourceNode(state, node.value);
}

export function resolveKonquerorNodeId(
  state: VfsState,
  nodeId: VfsNodeId,
): VfsResult<KonquerorResolvedLocation> {
  const node = getVfsNodeById(state, nodeId);

  if (!node.ok) {
    return node;
  }

  return resolveKonquerorResourceNode(state, node.value);
}

export function resolveKonquerorDirectoryNodeId(
  state: VfsState,
  nodeId: VfsNodeId,
): VfsResult<{ readonly node: VfsDirectoryNode; readonly path: string }> {
  const target = resolveKonquerorNodeId(state, nodeId);

  if (!target.ok) {
    return target;
  }

  if (target.value.node.kind !== "directory") {
    return fail({
      code: "NOT_DIRECTORY",
      message: "Location is not a directory.",
      nodeId,
    });
  }

  return ok({ node: target.value.node, path: target.value.path });
}

export function resolveKonquerorTextFileNodeId(
  state: VfsState,
  nodeId: VfsNodeId,
): VfsResult<{ readonly node: VfsFileNode; readonly path: string }> {
  const target = resolveKonquerorNodeId(state, nodeId);

  if (!target.ok) {
    return target;
  }

  if (target.value.node.kind !== "file") {
    return fail({
      code: "IS_DIRECTORY",
      message: "This location is a directory.",
      nodeId,
    });
  }

  return ok({ node: target.value.node, path: target.value.path });
}

export function findKonquerorHistoryTarget(
  state: VfsState,
  navigationState: KonquerorNavigationState,
  direction: "back" | "forward",
): { readonly historyIndex: number; readonly target: KonquerorResolvedHistoryTarget } | null {
  const increment = direction === "back" ? -1 : 1;
  const historyTargets = getKonquerorHistoryTargets(navigationState);

  for (
    let historyIndex = navigationState.historyIndex + increment;
    historyIndex >= 0 && historyIndex < historyTargets.length;
    historyIndex += increment
  ) {
    const historyTarget = historyTargets[historyIndex];

    if (!historyTarget) {
      continue;
    }

    if (historyTarget.type === "about-konqueror") {
      return { historyIndex, target: { target: historyTarget, path: KONQUEROR_ABOUT_LOCATION } };
    }

    if (historyTarget.type === "about-blank") {
      return { historyIndex, target: { target: historyTarget, path: KONQUEROR_BLANK_LOCATION } };
    }

    if (historyTarget.type === "sysinfo") {
      return { historyIndex, target: { target: historyTarget, path: KONQUEROR_SYSINFO_LOCATION } };
    }

    if (historyTarget.type === "external-web") {
      return { historyIndex, target: { target: historyTarget, path: historyTarget.canonicalUrl } };
    }

    if (historyTarget.type === "directory") {
      const target = resolveKonquerorDirectoryNodeId(state, historyTarget.nodeId);

      if (target.ok) {
        return {
          historyIndex,
          target: { target: historyTarget, path: target.value.path, node: target.value.node },
        };
      }
    } else {
      const target = resolveKonquerorTextFileNodeId(state, historyTarget.nodeId);

      if (target.ok) {
        return {
          historyIndex,
          target: { target: historyTarget, path: target.value.path, node: target.value.node },
        };
      }
    }
  }

  return null;
}

export function getKonquerorParentDirectoryNodeId(
  state: VfsState,
  navigationState: KonquerorNavigationState,
): VfsNodeId | null {
  const currentNodeId = getCurrentKonquerorNodeId(navigationState);

  if (!currentNodeId || currentNodeId === state.specialLocations.trash) {
    return null;
  }

  const current = getVfsNodeById(state, currentNodeId);

  if (!current.ok || current.value.parentId === null) {
    return null;
  }

  const parent = getVfsNodeById(state, current.value.parentId);
  return parent.ok && parent.value.kind === "directory" ? parent.value.id : null;
}

export function getKonquerorExternalWebParentUrl(
  target: KonquerorExternalWebLocationTarget,
): string | null {
  let url: URL;

  try {
    url = new URL(target.canonicalUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname.length === 0) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  segments.pop();
  url.pathname = segments.length === 0 ? "/" : `/${segments.join("/")}/`;
  url.search = "";
  url.hash = "";

  return url.href;
}

export function getKonquerorView(state: VfsState, navigationState: KonquerorNavigationState): KonquerorView {
  const currentTarget = getCurrentKonquerorLocationTarget(navigationState);

  if (currentTarget?.type === "about-konqueror") {
    return { type: "about-konqueror", path: KONQUEROR_ABOUT_LOCATION };
  }

  if (currentTarget?.type === "about-blank") {
    return { type: "about-blank", path: KONQUEROR_BLANK_LOCATION };
  }

  if (currentTarget?.type === "sysinfo") {
    return { type: "sysinfo", path: KONQUEROR_SYSINFO_LOCATION };
  }

  if (currentTarget?.type === "external-web") {
    return { type: "external-web", canonicalUrl: currentTarget.canonicalUrl, path: currentTarget.canonicalUrl };
  }

  const currentNodeId = getCurrentKonquerorNodeId(navigationState);

  if (!currentNodeId) {
    return {
      type: "error",
      error: {
        code: "NOT_FOUND",
        message: "Konqueror history does not reference a current node.",
      },
    };
  }

  const node = getVfsNodeById(state, currentNodeId);

  if (!node.ok) {
    if (getCurrentKonquerorLocationTarget(navigationState)?.type === "file") {
      return { type: "file-unavailable", nodeId: currentNodeId };
    }

    return {
      type: "error",
      error: node.error,
    };
  }

  const path = getVfsPathForNode(state, node.value.id);

  if (!path.ok) {
    return {
      type: "error",
      error: path.error,
    };
  }

  if (node.value.kind === "directory") {
    const children = listVfsDirectory(state, path.value);

    if (!children.ok) {
      return {
        type: "error",
        error: children.error,
      };
    }

    return {
      type: "directory",
      node: node.value,
      path: path.value,
      children: node.value.id === state.specialLocations.trash
        ? children.value
        : children.value.filter((child) => !child.name.startsWith(".")),
    };
  }

  if (node.value.kind !== "file") {
    return {
      type: "error",
      error: { code: "INVALID_PATH", message: "The link target cannot be resolved.", nodeId: node.value.id },
    };
  }

  return {
    type: "file",
    node: node.value,
    path: path.value,
  };
}

export function formatKonquerorNavigationError(error: VfsError): string {
  switch (error.code) {
    case "NOT_FOUND":
      return "The file or folder does not exist.";
    case "NOT_DIRECTORY":
      return error.message === "Location is not a directory."
        ? error.message
        : "A path component is not a directory.";
    case "INVALID_PATH":
      return error.message === "Enter an absolute VFS path." || error.message === "Unsupported location."
        ? error.message
        : "The location is not a valid VFS path.";
    case "IS_DIRECTORY":
      return "This location is a directory.";
    case "INVALID_NAME":
      return "The name is not valid.";
    case "ALREADY_EXISTS":
      return "A file or folder already exists with that name.";
    case "ROOT_OPERATION_FORBIDDEN":
      return "The root folder cannot be changed.";
    default:
      return error.message;
  }
}
