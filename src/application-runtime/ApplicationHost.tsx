import { useContext, useEffect } from "react";
import { getApplicationDefinition } from "./applicationRegistry";
import { useApplicationRuntime } from "./ApplicationRuntimeContext";
import { WindowManagerContext } from "../window-manager/useWindowManager";
import type { DesktopWindow } from "../window-manager/types";
import { useI18n } from "../i18n/useI18n";

type ApplicationHostProps = {
  desktopWindow: Pick<DesktopWindow, "id" | "appId" | "isActive" | "focusRequestId">;
};

export function ApplicationHost({ desktopWindow }: ApplicationHostProps) {
  const { appId, focusRequestId = 0, id: windowId, isActive = false } = desktopWindow;
  const definition = getApplicationDefinition(appId);
  const applicationRuntime = useApplicationRuntime();
  const windowManager = useContext(WindowManagerContext);
  const { t } = useI18n();

  useEffect(() => {
    if (definition?.titleKey !== undefined) {
      windowManager?.setWindowTitle?.(windowId, t(definition.titleKey));
    }
  }, [definition, t, windowId, windowManager]);

  if (!definition) {
    return (
      <div className="application-host-error" role="status">
        Unknown application: {appId}
      </div>
    );
  }

  return <>{definition.render({
    appId,
    windowId,
    isActive,
    focusRequestId,
    launchRequest: applicationRuntime?.getLaunchRequestForWindow(windowId) ?? null,
    closeRequest: applicationRuntime?.getCloseRequestForWindow(windowId) ?? null,
    requestWindowClose: () => applicationRuntime?.requestWindowClose(windowId),
    commitWindowClose: (requestId) => applicationRuntime?.commitWindowClose(windowId, requestId),
    cancelWindowClose: (requestId) => applicationRuntime?.cancelWindowClose(windowId, requestId),
    setWindowTitle: (title) => windowManager?.setWindowTitle?.(windowId, title),
  })}</>;
}
