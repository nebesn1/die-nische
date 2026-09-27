import { useContext } from "react";
import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { Konsole } from "./Konsole";
import { isKonsoleWorkingDirectoryIntent } from "./launchIntent";

type KonsolePrototypeProps = {
  readonly windowId?: string;
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly onRequestClose?: () => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

export function KonsolePrototype({ windowId, launchRequest = null, onRequestClose, onSetWindowTitle }: KonsolePrototypeProps) {
  const launcher = useContext(ApplicationLauncherContext);
  const initialWorkingDirectory = launchRequest && isKonsoleWorkingDirectoryIntent(launchRequest.intent)
    ? launchRequest.intent.workingDirectory
    : undefined;

  return (
    <Konsole
      initialWorkingDirectory={initialWorkingDirectory}
      windowId={windowId}
      onRequestClose={onRequestClose}
      onSetWindowTitle={onSetWindowTitle}
      onRequestNewWindow={launcher === null ? undefined : () => { launcher.launchNewApplicationInstance("konsole"); }}
      onRequestEditBookmarks={launcher === null ? undefined : () => { launcher.launchApplication("konsole-bookmark-editor"); }}
      onRequestAbout={launcher === null ? undefined : (appId) => { launcher.launchApplication(appId); }}
    />
  );
}
