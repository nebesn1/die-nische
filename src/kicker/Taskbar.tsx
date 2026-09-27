import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ApplicationLauncherContext } from "../application-runtime/useApplicationLauncher";
import { createPortal } from "react-dom";
import { useApplicationMenuDismissal } from "../apps/useApplicationMenuDismissal";
import { useDesktopTransientPopupLayer } from "../desktop/DesktopTransientPopupContext";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";
import { closeShellPopups, CLOSE_SHELL_POPUPS_EVENT } from "../shell/shellPopupEvents";
import { useWindowManager } from "../window-manager/useWindowManager";
import { getWindowShellIconId } from "../window-manager/windowShellIcon";
import { TaskButton } from "./TaskButton";
import { TaskGroupButton } from "./TaskGroupButton";
import { TaskGroupPopup } from "./TaskGroupPopup";
import { getTaskGroupPopupPosition } from "./taskGroupPopupPosition";
import { groupTaskbarWindows } from "./taskbarModel";
import { getTaskbarWindowAction, selectTaskbarWindows } from "./taskbarWindowSelector";
import { TaskbarContextMenu } from "./TaskbarContextMenu";
import type { TaskbarContextMenuState } from "./taskbarContextMenuModel";
import { toLogicalCoordinate, toLogicalRect } from "../desktop/desktopUiScale";
import { useOptionalResponsiveLayout } from "../desktop/responsiveLayoutContext";
import { useI18n } from "../i18n/useI18n";

export function Taskbar() {
  const { t } = useI18n();
  const applicationLauncher = useContext(ApplicationLauncherContext);
  const userLaunchApplication = applicationLauncher?.launchUserApplication ?? applicationLauncher?.launchApplication ?? (() => "unknown-application" as const);
  const transientPopupLayer = useDesktopTransientPopupLayer();
  const {
    currentDesktopId,
    focusWindow,
    launcherMetadataByWindowId = {},
    lastActiveWindowIdByDesktop,
    showDesktopSessionByDesktop,
    toggleTaskbarWindow,
    windows,
    workArea,
    screenArea = workArea,
  } = useWindowManager();
  const { preferences } = useDesktopPreferences();
  const responsiveLayout = useOptionalResponsiveLayout();
  const taskbarRef = useRef<HTMLDivElement | null>(null);
  const groupPopupRef = useRef<HTMLElement | null>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [openGroupAppId, setOpenGroupAppId] = useState<string | null>(null);
  const [groupPopupPosition, setGroupPopupPosition] = useState({ left: 0, top: 0, maxHeight: 0 });
  const [contextMenuState, setContextMenuState] = useState<TaskbarContextMenuState | null>(null);
  const nextContextMenuRequestId = useRef(1);
  const taskbarWindows = selectTaskbarWindows(
    windows,
    currentDesktopId,
    preferences.showTasksFromAllDesktops,
  );
  const entries = groupTaskbarWindows(
    taskbarWindows,
    lastActiveWindowIdByDesktop[currentDesktopId],
    currentDesktopId,
  );
  const openGroup = entries.find(
    (entry) => entry.type === "group" && entry.appId === openGroupAppId,
  );

  const closeGroupPopup = useCallback((returnFocus = false) => {
    const appId = openGroupAppId;
    setOpenGroupAppId(null);
    if (returnFocus && appId) {
      window.requestAnimationFrame(() => groupButtonRefs.current[appId]?.focus());
    }
  }, [openGroupAppId]);

  useApplicationMenuDismissal({
    isOpen: openGroup !== undefined,
    menuBarRef: taskbarRef,
    popupRefs: [groupPopupRef],
    onDismiss: () => closeGroupPopup(),
  });

  useEffect(() => {
    const close = () => setOpenGroupAppId(null);
    window.addEventListener(CLOSE_SHELL_POPUPS_EVENT, close);
    return () => window.removeEventListener(CLOSE_SHELL_POPUPS_EVENT, close);
  }, []);

  useEffect(() => {
    if (openGroupAppId !== null && openGroup === undefined) {
      setOpenGroupAppId(null);
    }
  }, [openGroup, openGroupAppId]);

  useEffect(() => {
    setOpenGroupAppId(null);
  }, [currentDesktopId]);

  useEffect(() => {
    setOpenGroupAppId(null);
  }, [preferences.showTasksFromAllDesktops]);

  useEffect(() => {
    if (showDesktopSessionByDesktop[currentDesktopId] !== null) {
      setOpenGroupAppId(null);
    }
  }, [currentDesktopId, showDesktopSessionByDesktop]);

  useEffect(() => {
    if (!openGroup) {
      return;
    }

    const close = () => setOpenGroupAppId(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [openGroup]);

  useEffect(() => {
    if (responsiveLayout?.layoutMode !== "mobile") {
      return;
    }

    setOpenGroupAppId(null);
    setContextMenuState(null);
  }, [responsiveLayout?.layoutMode]);

  const toggleGroupPopup = (appId: string) => {
    if (openGroupAppId === appId) {
      closeGroupPopup();
      return;
    }

    const anchor = groupButtonRefs.current[appId];
    if (!anchor) {
      return;
    }

    const anchorRect = toLogicalRect(anchor.getBoundingClientRect());
    const popupWidth = Math.min(320, Math.max(0, screenArea.width - 8));
    closeShellPopups();
    setGroupPopupPosition(getTaskGroupPopupPosition(anchorRect, popupWidth, screenArea));
    setOpenGroupAppId(appId);
  };

  const activateTaskWindow = (desktopWindow: (typeof taskbarWindows)[number]) => {
    if (getTaskbarWindowAction(desktopWindow, currentDesktopId) === "focus-window") {
      focusWindow(desktopWindow.id);
      return;
    }

    toggleTaskbarWindow(desktopWindow.id);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;

    if (target instanceof Element && target.closest("button")) {
      return;
    }

    event.preventDefault();
    closeShellPopups();
    closeGroupPopup();
    setContextMenuState({
      requestId: nextContextMenuRequestId.current++,
      clientX: toLogicalCoordinate(event.clientX),
      clientY: toLogicalCoordinate(event.clientY),
    });
  };

  const groupPopup = openGroup && openGroup.type === "group" ? (
    <TaskGroupPopup
      appId={openGroup.appId}
      members={openGroup.windows}
      activeWindowId={openGroup.windows.find((desktopWindow) => desktopWindow.isActive)?.id ?? null}
      left={groupPopupPosition.left}
      top={groupPopupPosition.top}
      maxHeight={groupPopupPosition.maxHeight}
      popupRef={groupPopupRef}
      getWindowIconId={(desktopWindow) => getWindowShellIconId(desktopWindow, launcherMetadataByWindowId)}
      onClose={closeGroupPopup}
      onSelectWindow={(windowId) => {
        const desktopWindow = openGroup.windows.find((member) => member.id === windowId);
        if (desktopWindow) {
          activateTaskWindow(desktopWindow);
        }
        closeGroupPopup();
      }}
    />
  ) : null;

  return (
    <div
      ref={taskbarRef}
      className="taskbar"
      data-kicker-task-area="true"
      aria-label={t("kicker.taskbar")}
      style={{ "--taskbar-column-count": Math.ceil(entries.length / 2) } as CSSProperties}
      onContextMenu={handleContextMenu}
    >
      <div className="taskbar__grid">
        {entries.map((entry) => {
          if (entry.type === "window") {
            const desktopWindow = entry.window;
            return (
              <TaskButton
                key={desktopWindow.id}
                windowId={desktopWindow.id}
                title={desktopWindow.title}
                iconId={getWindowShellIconId(desktopWindow, launcherMetadataByWindowId)}
                isActive={desktopWindow.isActive}
                isMinimizable={desktopWindow.isMinimizable !== false}
                windowState={desktopWindow.state}
                onActivate={() => activateTaskWindow(desktopWindow)}
              />
            );
          }

          const representative = entry.windows.find((desktopWindow) => desktopWindow.id === entry.representativeWindowId)
            ?? entry.windows[0];
          const iconId = getWindowShellIconId(representative, launcherMetadataByWindowId);
          return (
            <TaskGroupButton
              key={entry.appId}
              ref={(element: HTMLButtonElement | null) => { groupButtonRefs.current[entry.appId] = element; }}
              appId={entry.appId}
              iconId={iconId}
              isActive={entry.windows.some((desktopWindow) => desktopWindow.isActive)}
              isOpen={openGroupAppId === entry.appId}
              title={representative.title}
              windowCount={entry.windows.length}
              representativeWindowState={representative.state}
              onToggle={() => toggleGroupPopup(entry.appId)}
            />
          );
        })}
      </div>
      {groupPopup
        ? transientPopupLayer?.layer
          ? createPortal(groupPopup, transientPopupLayer.layer)
          : groupPopup
        : null}
      <TaskbarContextMenu
        menuState={contextMenuState}
        screenArea={screenArea}
        onDismiss={() => setContextMenuState(null)}
        onLaunchApplication={userLaunchApplication}
      />
    </div>
  );
}
