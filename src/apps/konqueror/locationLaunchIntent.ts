import {
  createKonquerorOpenDirectoryIntent,
  createKonquerorOpenExternalWebIntent,
  createKonquerorOpenFileIntent,
  createKonquerorOpenSysinfoIntent,
  type KonquerorOpenDirectoryIntent,
  type KonquerorOpenExternalWebIntent,
  type KonquerorOpenFileIntent,
  type KonquerorOpenSysinfoIntent,
} from "./launchIntent";
import { resolveKonquerorAbsoluteLocationTarget } from "./navigationController";
import type { VfsState } from "../../vfs/types";

export type KonquerorLocationLaunchIntent =
  | KonquerorOpenDirectoryIntent
  | KonquerorOpenExternalWebIntent
  | KonquerorOpenFileIntent
  | KonquerorOpenSysinfoIntent;

/** Converts an accepted absolute Konqueror location into the existing typed launch intents. */
export function getKonquerorLocationLaunchIntent(
  vfsState: VfsState,
  location: string,
): KonquerorLocationLaunchIntent | null {
  const resolved = resolveKonquerorAbsoluteLocationTarget(vfsState, location);

  if (!resolved.ok) {
    return null;
  }

  switch (resolved.value.target.type) {
    case "directory":
      return createKonquerorOpenDirectoryIntent(resolved.value.target.nodeId);
    case "file":
      return createKonquerorOpenFileIntent(resolved.value.target.nodeId, resolved.value.target.previewerId);
    case "external-web":
      return createKonquerorOpenExternalWebIntent(resolved.value.target.canonicalUrl);
    case "sysinfo":
      return createKonquerorOpenSysinfoIntent();
    default:
      return null;
  }
}
