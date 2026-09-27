import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import { isWindowIconId } from "../icons/windowIconIds";
import type { DesktopWindow, WindowLauncherMetadata } from "./types";

/**
 * Selects the shell base icon for one exact window. Application components
 * report only a serializable semantic key; Shell consumers own its fallback.
 */
export function getWindowShellIconId(
  desktopWindow: DesktopWindow,
  launcherMetadataByWindowId: Readonly<Record<string, WindowLauncherMetadata | undefined>>,
): string {
  const semanticIconId = launcherMetadataByWindowId[desktopWindow.id]?.semanticIconId;

  if (semanticIconId && isWindowIconId(semanticIconId)) {
    return semanticIconId;
  }

  return getApplicationDefinition(desktopWindow.appId)?.iconId ?? desktopWindow.iconId;
}
