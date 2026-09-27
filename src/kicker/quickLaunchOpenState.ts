import type { DesktopId, DesktopWindow, WindowLauncherMetadata } from "../window-manager/types";

export function getQuickLaunchOpenState(
  windows: readonly DesktopWindow[],
  currentDesktopId: DesktopId,
  launcherMetadataByWindowId: Readonly<Record<string, WindowLauncherMetadata | undefined>> = {},
): { readonly konqueror: boolean; readonly home: boolean } {
  const currentDesktopKonquerors = windows.filter(
    (desktopWindow) => desktopWindow.appId === "konqueror" && desktopWindow.desktopId === currentDesktopId,
  );

  return {
    konqueror: currentDesktopKonquerors.length > 0,
    home: currentDesktopKonquerors.some((desktopWindow) => launcherMetadataByWindowId[desktopWindow.id]?.isHomeLocation),
  };
}
