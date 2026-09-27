import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ApplicationRuntimeProvider } from "../application-runtime/ApplicationRuntimeProvider";
import { createInitialApplicationWindows } from "../application-runtime/initialApplications";
import { useApplicationLauncher } from "../application-runtime/useApplicationLauncher";
import { Kicker } from "../kicker/Kicker";
import { WindowMenuProvider } from "../window-manager/window-menu/WindowMenuProvider";
import { useWindowManager } from "../window-manager/useWindowManager";
import { WindowManagerProvider } from "../window-manager/WindowManagerProvider";
import { DesktopPreferencesProvider } from "../preferences/DesktopPreferencesContext";
import { KCalcConstantsProvider } from "../apps/kcalc/KCalcConstantsContext";
import { KonquerorBookmarksProvider } from "../apps/konqueror/KonquerorBookmarksContext";
import { KonsoleBookmarksProvider } from "../apps/konsole/KonsoleBookmarksContext";
import { KWriteRecentFilesProvider } from "../apps/kwrite/KWriteRecentFilesContext";
import { useDesktopPreferences } from "../preferences/useDesktopPreferences";
import { useVfs } from "../vfs/useVfs";
import { useI18n } from "../i18n/useI18n";
import { defaultKonquerorCommandEnvironment } from "../apps/konqueror/commandTypes";
import { KonquerorClipboardProvider } from "../apps/konqueror/KonquerorClipboardContext";
import { KonquerorFileUndoProvider } from "../apps/konqueror/KonquerorFileUndoContext";
import { KonquerorPrintProvider } from "../apps/konqueror/KonquerorPrintContext";
import { KonquerorDragDropProvider } from "../apps/konqueror/KonquerorDragDropContext";
import { initialKonquerorClipboardState } from "../apps/konqueror/clipboardState";
import { emptyKonquerorTrash } from "../apps/konqueror/trashActionController";
import { DesktopBackgroundSurface } from "./DesktopBackgroundSurface";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { DesktopEmptyTrashConfirmation } from "./DesktopEmptyTrashConfirmation";
import { DesktopIcons } from "./DesktopIcons";
import { DesktopPopupLayer } from "./DesktopPopupLayer";
import { DesktopTransientPopupLayer, DesktopTransientPopupProvider } from "./DesktopTransientPopupLayer";
import { DesktopSessionOverlay } from "./DesktopSessionOverlay";
import { DesktopSessionProvider } from "./DesktopSessionContext";
import { DesktopWindowLayer } from "./DesktopWindowLayer";
import { PublishedArticleRouteController } from "./PublishedArticleRouteController";
import { PublishedSearchRouteController } from "./PublishedSearchRouteController";
import { PublishedTagRouteController } from "./PublishedTagRouteController";
import { getDesktopIconDefinition, getDesktopIconLaunchRequest, type RegisteredDesktopIconId } from "./desktopIconModel";
import {
  desktopIconSelectionReducer,
  getDesktopIconIds,
  initialDesktopIconSelectionState,
} from "./desktopIconState";
import type { DesktopContextMenuAction, DesktopContextMenuState } from "./desktopContextMenuModel";
import { WindowPopupLayer } from "./WindowPopupLayer";
import { useDesktopSession } from "./useDesktopSession";
import { RunCommandDialog } from "../kicker/k-menu/RunCommandDialog";
import { getRunCommandPlan } from "../kicker/k-menu/runCommand";
import { executeRunCommandPlan } from "../kicker/k-menu/runCommandExecution";
import { createControlCenterOpenIntent } from "../apps/kcontrol/controlCenterLaunchIntent";
import {
  extractWebDesktopSelection,
  isKeyboardSelectionKey,
  isLiveSelectionTarget,
  KLIPPER_KEYBOARD_SELECTION_SETTLE_MS,
  shouldRecordKlipperSelection,
} from "./klipperSelection";
import { toLogicalCoordinate } from "./desktopUiScale";
import { ThemeDomAuthority } from "../theme/ThemeDomAuthority";
import { useDesktopMarqueeSelection } from "./useDesktopMarqueeSelection";
import { I18nProvider } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/messages/en";
import { ResponsiveLayoutProvider } from "./ResponsiveLayoutContext";
import { useResponsiveLayout } from "./responsiveLayoutContext";

type DesktopRunCommandError =
  | { readonly type: "translation"; readonly key: TranslationKey }
  | { readonly type: "raw"; readonly message: string };

export function Desktop() {
  return (
    <ResponsiveLayoutProvider>
      <DesktopPreferencesProvider>
        <I18nProvider>
          <KCalcConstantsProvider>
            <KonquerorBookmarksProvider>
              <KonsoleBookmarksProvider>
                <KWriteRecentFilesProvider><DesktopWithProviders /></KWriteRecentFilesProvider>
              </KonsoleBookmarksProvider>
            </KonquerorBookmarksProvider>
          </KCalcConstantsProvider>
        </I18nProvider>
      </DesktopPreferencesProvider>
    </ResponsiveLayoutProvider>
  );
}

function DesktopWithProviders() {
  const { preferences } = useDesktopPreferences();

  return (
    <WindowManagerProvider initialWindows={createInitialApplicationWindows} desktopCount={preferences.desktopCount}>
      <ThemeDomAuthority />
      <ApplicationRuntimeProvider>
        <PublishedArticleRouteController />
        <PublishedSearchRouteController />
        <PublishedTagRouteController />
        <WindowMenuProvider>
          <DesktopTransientPopupProvider>
            <DesktopSessionProvider>
              <KonquerorClipboardProvider>
                <KonquerorFileUndoProvider>
                  <KonquerorDragDropProvider>
                    <KonquerorPrintProvider>
                      <DesktopWorkspace />
                    </KonquerorPrintProvider>
                  </KonquerorDragDropProvider>
                </KonquerorFileUndoProvider>
              </KonquerorClipboardProvider>
            </DesktopSessionProvider>
          </DesktopTransientPopupProvider>
        </WindowMenuProvider>
      </ApplicationRuntimeProvider>
    </WindowManagerProvider>
  );
}

function DesktopWorkspace() {
  const { t } = useI18n();
  const { layoutMode, orientation } = useResponsiveLayout();
  const { preferences } = useDesktopPreferences();
  const {
    endSessionDialog,
    isLocked,
    lockSession,
    openLogout,
    recordClipboardText,
    resetGeneration,
    selectionCaptureGeneration,
  } = useDesktopSession();
  const {
    launchApplication,
    launchNewApplicationInstance,
    launchNewUserApplicationInstance,
    launchUserApplication,
  } = useApplicationLauncher();
  const userLaunchApplication = launchUserApplication ?? launchApplication;
  const userLaunchNewApplicationInstance = launchNewUserApplicationInstance ?? launchNewApplicationInstance;
  const vfs = useVfs();
  const { currentDesktopId, screenArea, workArea } = useWindowManager();
  const [desktopIconSelection, dispatchDesktopIconSelection] = useReducer(
    desktopIconSelectionReducer,
    initialDesktopIconSelectionState,
  );
  const [desktopContextMenuState, setDesktopContextMenuState] = useState<DesktopContextMenuState>(null);
  const [isEmptyTrashConfirmationOpen, setIsEmptyTrashConfirmationOpen] = useState(false);
  const [isRunCommandOpen, setIsRunCommandOpen] = useState(false);
  const [runCommandInput, setRunCommandInput] = useState("");
  const [runCommandError, setRunCommandError] = useState<DesktopRunCommandError | null>(null);
  const trashEntries = vfs.listTrashEntries();
  const canEmptyTrash = trashEntries.ok && trashEntries.value.length > 0;
  const desktopShellRef = useRef<HTMLElement | null>(null);
  const selectionSettleTimerRef = useRef<number | null>(null);
  const nextContextMenuRequestId = useRef(1);

  const clearDesktopIconSelection = () => {
    dispatchDesktopIconSelection({ type: "clear" });
  };

  const desktopMarquee = useDesktopMarqueeSelection({
    desktopRef: desktopShellRef,
    visibleIconIds: getDesktopIconIds(),
    selectedIconIds: desktopIconSelection.selectedIconIds,
    onClearSelection: clearDesktopIconSelection,
    onCommitSelection: (iconIds) => dispatchDesktopIconSelection({ type: "select-many", iconIds }),
  });

  const desktopMarqueeStyle = desktopMarquee.marqueeRect === null
    ? null
    : {
        left: desktopMarquee.marqueeRect.left,
        top: desktopMarquee.marqueeRect.top,
        width: desktopMarquee.marqueeRect.width,
        height: desktopMarquee.marqueeRect.height,
      };

  const dismissDesktopContextMenu = useCallback(() => {
    setDesktopContextMenuState(null);
  }, []);

  const closeRunCommand = useCallback(() => {
    setIsRunCommandOpen(false);
    setRunCommandError(null);
    setRunCommandInput("");
  }, []);

  const openDesktopIcon = useCallback((iconId: string) => {
    const definition = getDesktopIconDefinition(iconId);
    const request = definition ? getDesktopIconLaunchRequest(definition) : null;
    if (request) {
      (request.newInstance ? userLaunchNewApplicationInstance : userLaunchApplication)(request.appId, request.options);
    }
  }, [userLaunchApplication, userLaunchNewApplicationInstance]);

  const clearPendingSelectionCapture = useCallback(() => {
    if (selectionSettleTimerRef.current !== null) {
      window.clearTimeout(selectionSettleTimerRef.current);
      selectionSettleTimerRef.current = null;
    }
  }, []);

  const recordCurrentSelection = useCallback((target: EventTarget | null) => {
    if (isLocked || endSessionDialog !== "closed" || !shouldRecordKlipperSelection(target)) {
      return;
    }

    recordClipboardText(extractWebDesktopSelection(target));
  }, [endSessionDialog, isLocked, recordClipboardText]);

  const captureCopiedText = useCallback((event: ClipboardEvent<HTMLElement>) => {
    recordCurrentSelection(event.target);
  }, [recordCurrentSelection]);

  const capturePointerSelection = useCallback((event: PointerEvent<HTMLElement>) => {
    clearPendingSelectionCapture();
    recordCurrentSelection(event.target);
  }, [clearPendingSelectionCapture, recordCurrentSelection]);

  const captureKeyboardSelection = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!isKeyboardSelectionKey(event.key, event.shiftKey)) {
      return;
    }

    const target = event.target;
    clearPendingSelectionCapture();
    selectionSettleTimerRef.current = window.setTimeout(() => {
      selectionSettleTimerRef.current = null;

      if (isLiveSelectionTarget(target)) {
        recordCurrentSelection(target);
      }
    }, KLIPPER_KEYBOARD_SELECTION_SETTLE_MS);
  }, [clearPendingSelectionCapture, recordCurrentSelection]);

  const executeDesktopContextMenuAction = useCallback(
    (action: DesktopContextMenuAction) => {
      dismissDesktopContextMenu();

      if (action === "run-command") {
        setRunCommandError(null);
        setIsRunCommandOpen(true);
        return;
      }

      if (action === "configure-desktop") {
        userLaunchApplication("kcontrol", { intent: createControlCenterOpenIntent({ module: "behavior" }) });
        return;
      }

      if (action === "lock-session") {
        lockSession();
        return;
      }

      if (action === "logout") {
        openLogout?.();
        return;
      }

      if (action === "open-icon" && desktopContextMenuState?.kind === "icon") {
        openDesktopIcon(desktopContextMenuState.iconId);
        return;
      }

      if (action === "empty-trash") {
        setIsEmptyTrashConfirmationOpen(true);
        return;
      }

    },
    [desktopContextMenuState, dismissDesktopContextMenu, lockSession, openDesktopIcon, openLogout, userLaunchApplication],
  );

  const runCommand = useCallback(() => {
    const plan = getRunCommandPlan(vfs.state, runCommandInput);
    const result = executeRunCommandPlan(plan, {
      launchApplication: userLaunchApplication,
      launchNewApplicationInstance: userLaunchNewApplicationInstance,
    });

    if (result.type === "accepted") {
      closeRunCommand();
      return;
    }

    setRunCommandError(result.message === "Enter a command."
      ? { type: "translation", key: "runCommand.empty" }
      : result.message === "Command could not be run."
        ? { type: "translation", key: "runCommand.failed" }
        : { type: "raw", message: result.message });
  }, [closeRunCommand, runCommandInput, userLaunchApplication, userLaunchNewApplicationInstance, vfs.state]);

  useEffect(() => {
    if (!preferences.showDesktopIcons && desktopIconSelection.selectedIconId !== null) {
      dispatchDesktopIconSelection({ type: "clear" });
    }
  }, [desktopIconSelection.selectedIconId, preferences.showDesktopIcons]);

  useEffect(() => {
    dismissDesktopContextMenu();
  }, [currentDesktopId, dismissDesktopContextMenu]);

  useEffect(() => {
    if (isLocked || endSessionDialog !== "closed") {
      dismissDesktopContextMenu();
      setIsEmptyTrashConfirmationOpen(false);
      closeRunCommand();
    }
  }, [closeRunCommand, dismissDesktopContextMenu, endSessionDialog, isLocked]);

  const confirmEmptyTrash = useCallback(() => {
    emptyKonquerorTrash(vfs.state, initialKonquerorClipboardState, vfs, defaultKonquerorCommandEnvironment);
    setIsEmptyTrashConfirmationOpen(false);
  }, [vfs]);

  useEffect(() => {
    if (resetGeneration > 0) {
      clearDesktopIconSelection();
      dismissDesktopContextMenu();
    }
  }, [dismissDesktopContextMenu, resetGeneration]);

  useEffect(() => clearPendingSelectionCapture, [clearPendingSelectionCapture]);

  useEffect(() => {
    clearPendingSelectionCapture();
  }, [clearPendingSelectionCapture, selectionCaptureGeneration]);

  return (
    <main
      ref={desktopShellRef}
      className={`desktop-shell desktop-shell--background-${preferences.backgroundPreset}`}
      data-layout-mode={layoutMode}
      data-orientation={orientation}
      aria-label={t("desktop.shell")}
      onCopyCapture={captureCopiedText}
      onCutCapture={captureCopiedText}
      onPointerUpCapture={capturePointerSelection}
      onKeyUpCapture={captureKeyboardSelection}
    >
      <DesktopBackgroundSurface
        onClearSelection={clearDesktopIconSelection}
        marqueeStyle={desktopMarqueeStyle}
        onMarqueeClick={desktopMarquee.handleBackgroundClick}
        onLostPointerCapture={desktopMarquee.handleLostPointerCapture}
        onPointerCancel={desktopMarquee.handlePointerCancel}
        onPointerDown={desktopMarquee.handlePointerDown}
        onPointerMove={desktopMarquee.handlePointerMove}
        onPointerUp={desktopMarquee.handlePointerUp}
        onOpenContextMenu={(clientX, clientY) =>
          setDesktopContextMenuState({
            kind: "background",
            requestId: nextContextMenuRequestId.current++,
            desktopId: currentDesktopId,
            clientX: toLogicalCoordinate(clientX),
            clientY: toLogicalCoordinate(clientY),
          })
        }
      />
      {preferences.showDesktopIcons ? (
        <DesktopIcons
          selectedIconId={desktopIconSelection.selectedIconId}
          selectedIconIds={desktopMarquee.effectiveSelectedIconIds}
          onSelectIcon={(iconId) => dispatchDesktopIconSelection({ type: "select", iconId })}
          onClearSelection={clearDesktopIconSelection}
          onOpenIcon={openDesktopIcon}
          onOpenContextMenu={(iconId, clientX, clientY) =>
            setDesktopContextMenuState({
              kind: "icon",
              requestId: nextContextMenuRequestId.current++,
              desktopId: currentDesktopId,
              iconId: iconId as RegisteredDesktopIconId,
              clientX: toLogicalCoordinate(clientX),
              clientY: toLogicalCoordinate(clientY),
            })
          }
        />
      ) : null}
      <DesktopWindowLayer />
      <Kicker />
      <DesktopTransientPopupLayer>
        <WindowPopupLayer />
        <DesktopPopupLayer>
          <DesktopContextMenu
            menuState={desktopContextMenuState}
            containerRef={desktopShellRef}
            screenArea={screenArea ?? workArea}
            canEmptyTrash={canEmptyTrash}
            onDismiss={dismissDesktopContextMenu}
            onAction={executeDesktopContextMenuAction}
          />
          <DesktopEmptyTrashConfirmation
            isOpen={isEmptyTrashConfirmationOpen}
            onCancel={() => setIsEmptyTrashConfirmationOpen(false)}
            onConfirm={confirmEmptyTrash}
          />
          {isRunCommandOpen ? (
            <RunCommandDialog
              value={runCommandInput}
              error={runCommandError === null ? null : runCommandError.type === "translation" ? t(runCommandError.key) : runCommandError.message}
              onChange={(value) => {
                setRunCommandInput(value);
                setRunCommandError(null);
              }}
              onRun={runCommand}
              onCancel={closeRunCommand}
              onDismissError={() => setRunCommandError(null)}
            />
          ) : null}
      </DesktopPopupLayer>
      </DesktopTransientPopupLayer>
      <DesktopSessionOverlay />
    </main>
  );
}
