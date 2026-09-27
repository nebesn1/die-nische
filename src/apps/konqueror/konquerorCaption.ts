import { getVfsNodeById } from "../../vfs/queries";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { isVfsTrashRoot } from "../../vfs/trashPaths";
import type { VfsState } from "../../vfs/types";
import type { KonquerorLocationTarget } from "./navigationTypes";

const applicationSuffix = " - Konqueror";

export type KonquerorCaptionLabels = Readonly<{
  readonly unavailable: string;
  readonly start: string;
  readonly computer: string;
  readonly root: string;
  readonly trash: string;
}>;

const defaultCaptionLabels: KonquerorCaptionLabels = {
  unavailable: "File unavailable",
  start: "Conquer your Desktop!",
  computer: "My Computer",
  root: "Root Folder",
  trash: "Trash",
};

export function getKonquerorTabLabel(
  state: VfsState,
  target: KonquerorLocationTarget | null,
  labels: KonquerorCaptionLabels = defaultCaptionLabels,
): string {
  const caption = getKonquerorCaption(state, target, labels);
  return caption.endsWith(applicationSuffix) ? caption.slice(0, -applicationSuffix.length) : caption;
}

export function getKonquerorCaption(
  state: VfsState,
  target: KonquerorLocationTarget | null,
  labels: KonquerorCaptionLabels = defaultCaptionLabels,
): string {
  if (target === null) {
    return `${labels.unavailable}${applicationSuffix}`;
  }

  if (target.type === "about-konqueror") {
    return `${labels.start}${applicationSuffix}`;
  }

  if (target.type === "about-blank") {
    return `about:blank${applicationSuffix}`;
  }

  if (target.type === "sysinfo") {
    return `${labels.computer}${applicationSuffix}`;
  }

  if (target.type === "external-web") {
    try {
      return `${new URL(target.canonicalUrl).hostname}${applicationSuffix}`;
    } catch {
      return `${target.canonicalUrl}${applicationSuffix}`;
    }
  }

  const node = getVfsNodeById(state, target.nodeId);

  if (!node.ok) {
    return `${labels.unavailable}${applicationSuffix}`;
  }

  if (target.type === "directory" && node.value.id === state.rootId) {
    return `${labels.root}${applicationSuffix}`;
  }

  if (target.type === "directory" && isVfsTrashRoot(state, node.value.id)) {
    return `${labels.trash}${applicationSuffix}`;
  }

  return `${getVfsNodeDisplayName(node.value)}${applicationSuffix}`;
}
