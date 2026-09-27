import { getVfsNodeById } from "../../vfs/queries";
import type { VfsState } from "../../vfs/types";
import { getKonquerorNodeIconId, type KonquerorFileIconId, type KonquerorNodeIconId } from "./nodePresentation";
import type { KonquerorLocationTarget } from "./navigationTypes";

/** A serializable location-derived icon key for the shell task surfaces. */
export type KonquerorTaskIconId = Exclude<KonquerorNodeIconId, KonquerorFileIconId> | "konqueror" | "my-computer";

export function getKonquerorTaskIconId(
  state: VfsState,
  target: KonquerorLocationTarget | null,
): KonquerorTaskIconId {
  if (!target || target.type === "about-konqueror" || target.type === "about-blank" || target.type === "external-web" || target.type === "file") {
    return "konqueror";
  }

  if (target.type === "sysinfo") {
    return "my-computer";
  }

  const node = getVfsNodeById(state, target.nodeId);
  if (!node.ok || node.value.kind !== "directory") {
    return "konqueror";
  }

  const iconId = getKonquerorNodeIconId(node.value, state);
  if (iconId === "text-file" || iconId === "markdown-file" || iconId === "html-file" || iconId === "image-file" || iconId === "video-file" || iconId === "music-file") {
    return "folder";
  }

  return iconId;
}
