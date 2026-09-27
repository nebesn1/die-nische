import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { useWindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupContext";
import { WindowOwnedPopupPortal } from "../../desktop/WindowOwnedPopupPortal";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { useDesktopPreferences } from "../../preferences/useDesktopPreferences";
import { WindowManagerContext } from "../../window-manager/useWindowManager";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import { useApplicationMenubarPolicy } from "../applicationMenubarPolicy";
import { createKWriteOpenTextFileIntent } from "../kwrite/launchIntent";
import { getVfsNodeById, getVfsPathForNode } from "../../vfs/queries";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { resolveVfsLinkTarget } from "../../vfs/links";
import { isVfsTrashRoot } from "../../vfs/trashPaths";
import { useVfs } from "../../vfs/useVfs";
import type { VfsNodeId } from "../../vfs/types";
import { getKonquerorClipboardAvailability } from "./clipboardAvailability";
import { buildKonquerorClipboardEntryPlan } from "./clipboardEntryBuilder";
import { getKonquerorClipboardMirrorUri } from "./clipboardMirror";
import { initialKonquerorClipboardState, konquerorClipboardReducer } from "./clipboardState";
import { useOptionalKonquerorClipboard } from "./useKonquerorClipboard";
import { initialKonquerorFileUndoState } from "./fileUndoHistory";
import { useOptionalKonquerorFileUndo } from "./useKonquerorFileUndo";
import type { VfsFileOperationUndoKind } from "../../vfs/fileOperationUndo";
import { getKonquerorCommandAvailability } from "./commandAvailability";
import { getKonquerorCreateChildAvailability } from "./createChildCapability";
import { initialKonquerorCommandDialogState, konquerorCommandDialogReducer } from "./commandState";
import {
  defaultKonquerorCommandEnvironment,
  type KonquerorCommandEnvironment,
} from "./commandTypes";
import { getKonquerorEditorAvailability } from "./editorAvailability";
import {
  getKonquerorEditorDraftSize,
  initialKonquerorEditorState,
  isKonquerorEditorDirty,
  konquerorEditorReducer,
} from "./editorState";
import { KonquerorConfirmationDialog } from "./KonquerorConfirmationDialog";
import { KonquerorApplicationMenu as KonquerorApplicationMenuSurface } from "./KonquerorApplicationMenu";
import { getKonquerorActiveBookmarkDraft, getKonquerorBookmarkDraftsForTabs } from "./bookmarkCommand";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import { KonquerorContextMenu } from "./KonquerorContextMenu";
import { KonquerorDropActionMenu } from "./KonquerorDropActionMenu";
import { useOptionalKonquerorDragDrop } from "./KonquerorDragDropContext";
import { toLogicalCoordinate } from "../../desktop/desktopUiScale";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";
import { KonquerorDockArea } from "./KonquerorDockArea";
import { KonquerorIconView } from "./KonquerorIconView";
import { KonquerorErrorView } from "./KonquerorErrorView";
import { KonquerorExternalWebView } from "./KonquerorExternalWebView";
import { KonquerorPreviewHost } from "./KonquerorPreviewHost";
import { getKonquerorAdjacentImageNodeId } from "./imagePreviewModel";
import { getKonquerorAdjacentMediaNodeId, isKonquerorMediaFile } from "./mediaPreviewModel";
import { canAdjustKonquerorImageZoom } from "./imageViewModel";
import { getKonquerorMediaCommandAvailability, type KonquerorMediaCommand } from "./mediaCommandModel";
import type { KonquerorMediaViewAction } from "./mediaViewModel";
import { KonquerorStartPage } from "./KonquerorWelcome";
import { KonquerorInputDialog, KonquerorTextInputDialog } from "./KonquerorInputDialog";
import {
  initialKonquerorBookmarkFolderDialogState,
  konquerorBookmarkFolderDialogReducer,
} from "./bookmarkFolderDialogState";
import type { KonquerorBookmarkFolderId } from "./bookmarks";
import { KonquerorDirectTransferDialog } from "./KonquerorDirectTransferDialog";
import { KonquerorLocationBar } from "./KonquerorLocationBar";
import { KonquerorOperationErrorView } from "./KonquerorOperationErrorView";
import { KonquerorPropertiesDialog } from "./KonquerorPropertiesDialog";
import { KonquerorSecurityDialog } from "./KonquerorSecurityDialog";
import { KonquerorStatusBar } from "./KonquerorStatusBar";
import { KonquerorSysinfoView } from "./KonquerorSysinfoView";
import { KonquerorTabBar } from "./KonquerorTabBar";
import { KonquerorToolbar } from "./KonquerorToolbar";
import { getKonquerorToolbarProfile } from "./toolbarProfile";
import {
  getKonquerorBackgroundContextMenuEntries,
  getKonquerorItemContextMenuEntries,
  getKonquerorPreviewContextMenuEntries,
  type KonquerorContextMenuAction,
  type KonquerorContextMenuState,
} from "./contextMenuModel";
import {
  initialKonquerorConfirmationState,
  initialKonquerorFileOperationState,
  konquerorConfirmationReducer,
  konquerorFileOperationReducer,
} from "./fileOperationState";
import { submitKonquerorMoveToTrash } from "./moveToTrashController";
import { normalizeKonquerorRecursiveOperationTargets } from "./recursiveOperationTargets";
import {
  buildKonquerorDragOperationPlan,
  canKonquerorAcceptFileDrop,
  executeKonquerorDropAction,
  type KonquerorDragOperationPlan,
  type KonquerorDropAction,
  type KonquerorDropActionRequest,
} from "./dragDropController";
import { submitKonquerorCommand } from "./mutationController";
import {
  createKonquerorDirectTransferRequest,
  getKonquerorDirectTransferAvailability,
  getKonquerorDirectTransferInitialDestination,
  submitKonquerorDirectTransfer,
} from "./directTransferController";
import {
  initialKonquerorDirectTransferDialogState,
  konquerorDirectTransferDialogReducer,
} from "./directTransferState";
import {
  getKonquerorCurrentPath,
  getKonquerorExternalWebParentUrl,
  findKonquerorHistoryTarget,
  getKonquerorLocationString,
  getKonquerorParentDirectoryNodeId,
  getKonquerorView,
  resolveKonquerorAbsoluteLocationTarget,
  resolveKonquerorDirectoryNodeId,
  resolveKonquerorNodeId,
  resolveKonquerorTextFileNodeId,
} from "./navigationController";
import {
  getCurrentKonquerorLocationTarget,
  getCurrentKonquerorNodeId,
  getKonquerorHistoryTargets,
  getKonquerorLocationDraft,
} from "./navigationState";
import { pasteKonquerorClipboardItems } from "./pasteController";
import { planKonquerorOpenInNewWindow } from "./openInNewWindowController";
import { planKonquerorOpenTerminalHere } from "./openTerminalHereController";
import { saveKonquerorTextFile } from "./saveTextController";
import { getKonquerorTreeKeyboardAction } from "./treeKeyboard";
import {
  createKonquerorOpenDirectoryIntent,
  createKonquerorDetachTabIntent,
  createKonquerorOpenFileIntent,
  createKonquerorOpenSysinfoIntent,
  createKonquerorOpenStartIntent,
  isKonquerorOpenDirectoryIntent,
  isKonquerorDetachTabIntent,
  isKonquerorOpenFileIntent,
  isKonquerorOpenExternalWebIntent,
  isKonquerorOpenLocationIntent,
  isKonquerorOpenStartIntent,
  isKonquerorOpenSysinfoIntent,
  type KonquerorOpenLocationIntent,
} from "./launchIntent";
import { getKonquerorNodeActivation } from "./nodeActivation";
import { getKonquerorTaskIconId } from "./taskIcon";
import { formatVfsModifiedTime } from "./formatters";
import { translateKonquerorAvailabilityText } from "./konquerorI18n";
import { getKonquerorTrashCommandAvailability } from "./trashCommandAvailability";
import {
  canAdjustKonquerorResourceZoom,
  createInitialKonquerorDirectoryViewState,
  getKonquerorAdjacentSelectionId,
  getNextKonquerorResourceZoomLevel,
  getKonquerorResourceZoomLevel,
  konquerorDirectoryViewReducer,
  sortKonquerorEntries,
  type KonquerorDirectoryViewAction,
  type KonquerorResourceViewMode,
  type KonquerorSortKey,
} from "./directoryViewModel";
import {
  canAdjustKonquerorEmbeddedContentZoom,
  defaultKonquerorEmbeddedContentState,
  getKonquerorEmbeddedContentCapabilities,
  getKonquerorEmbeddedContentZoomLevel,
  konquerorEmbeddedContentReducer,
} from "./embeddedContentModel";
import {
  initialKonquerorExternalWebLoadState,
  konquerorExternalWebLoadReducer,
} from "./externalWebLoadState";
import {
  canAdjustKonquerorExternalWebZoom,
  defaultKonquerorExternalWebZoomState,
  konquerorExternalWebZoomReducer,
} from "./externalWebZoomModel";
import type { KonquerorPrintDocument } from "./konquerorPrintContext";
import { useOptionalKonquerorPrint } from "./useKonquerorPrint";
import {
  deleteKonquerorTrashEntriesPermanently,
  emptyKonquerorTrash,
  restoreKonquerorTrashEntries,
} from "./trashActionController";
import { useKonquerorDirectoryFocusHandoff } from "./useKonquerorDirectoryFocusHandoff";
import {
  getKonquerorApplicationMenuEntries,
  toggleKonquerorApplicationMenu,
  type KonquerorApplicationMenu,
  type KonquerorApplicationMenuAction,
  type KonquerorApplicationMenuRequest,
} from "./applicationMenuModel";
import {
  KONQUEROR_ABOUT_LOCATION,
  KONQUEROR_BLANK_LOCATION,
  KONQUEROR_SYSINFO_LOCATION,
  createKonquerorAboutLocationTarget,
  createKonquerorBlankLocationTarget,
  type KonquerorLocationTarget,
  type KonquerorNavigationAction,
} from "./navigationTypes";
import { getDefaultKonquerorPreviewer, resolveKonquerorPreviewer, type KonquerorPreviewerId } from "./previewModel";
import { getKonquerorCaption, getKonquerorTabLabel } from "./konquerorCaption";
import { getKonquerorSecurityInfo, type KonquerorSecurityInfo } from "./securityInfo";
import {
  getKonquerorSelectedNodeIdsInVisibleOrder,
  getSingleKonquerorSelectedNodeId,
  isKonquerorNodeSelected,
  type KonquerorSelectionPointerIntent,
} from "./selectionModel";
import { defaultKonquerorDockOrder } from "./konquerorDockLayout";
import { getKonquerorExpandableTreeNodeIds, getKonquerorVisibleTreeRows } from "./treeProjection";
import {
  createInitialKonquerorWindowTabs,
  createKonquerorWindowTabsFromDetachedTab,
  detachKonquerorTab,
  getActiveKonquerorTab,
  konquerorTabsReducer,
} from "./konquerorTabs";

type KonquerorProps = {
  readonly windowId?: string;
  readonly commandEnvironment?: KonquerorCommandEnvironment;
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly isActive?: boolean;
  readonly focusRequestId?: number;
  readonly onRequestClose?: () => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

type InitialNavigationSeed = {
  readonly target: KonquerorLocationTarget;
  readonly homePath: string;
  readonly detachedTab?: import("./konquerorTabs").KonquerorTabSession;
};

const getSpecialLocationNodeId = (
  specialLocations: { readonly home: VfsNodeId; readonly documents: VfsNodeId; readonly trash: VfsNodeId },
  location: KonquerorOpenLocationIntent["location"],
): VfsNodeId =>
  location === "trash"
    ? specialLocations.trash
    : location === "documents"
    ? specialLocations.documents
    : specialLocations.home;

const isTextEditingTarget = (target: EventTarget | null): boolean => {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
};

export function Konqueror({
  commandEnvironment = defaultKonquerorCommandEnvironment,
  focusRequestId = 0,
  isActive = false,
  launchRequest = null,
  onRequestClose = () => undefined,
  onSetWindowTitle = () => undefined,
  windowId,
}: KonquerorProps) {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { addBookmark, addFolder, addFolderWithBookmarks, bookmarks, getNode, recordVisit } = useContext(KonquerorBookmarksContext);
  const sharedDragDrop = useOptionalKonquerorDragDrop();
  const registerDragDropExecutor = sharedDragDrop?.registerDropExecutor;
  const { launchApplication, launchNewApplicationInstance } = useApplicationLauncher();
  const windowManager = useContext(WindowManagerContext);
  const layoutMode = windowManager?.layoutMode ?? "desktop";
  const workArea = windowManager?.workArea ?? { x: 0, y: 0, width: 0, height: 0, titleBarHeight: 0 };
  const screenArea = windowManager?.screenArea ?? workArea;
  const windowPopupLayer = useWindowOwnedPopupLayer();
  const desktopSession = useOptionalDesktopSession();
  const initialNavigationSeed = useMemo<InitialNavigationSeed>(() => {
    const detachedTab = launchRequest && isKonquerorDetachTabIntent(launchRequest.intent)
      ? launchRequest.intent.tab
      : undefined;
    if (detachedTab) {
      return {
        target: getCurrentKonquerorLocationTarget(detachedTab.navigationState) ?? createKonquerorBlankLocationTarget(),
        homePath: KONQUEROR_BLANK_LOCATION,
        detachedTab,
      };
    }
    const requestedDirectoryId = launchRequest && isKonquerorOpenDirectoryIntent(launchRequest.intent)
      ? launchRequest.intent.nodeId
      : null;
    const initialLocation = launchRequest && isKonquerorOpenLocationIntent(launchRequest.intent)
      ? launchRequest.intent.location
      : "home";
    const requestedDirectory = requestedDirectoryId ? getVfsNodeById(vfs.state, requestedDirectoryId) : null;
    const requestedFileIntent = launchRequest && isKonquerorOpenFileIntent(launchRequest.intent)
      ? launchRequest.intent
      : null;
    const requestedExternalIntent = launchRequest && isKonquerorOpenExternalWebIntent(launchRequest.intent)
      ? launchRequest.intent
      : null;
    const requestedFile = requestedFileIntent
      ? getVfsNodeById(vfs.state, requestedFileIntent.nodeId)
      : null;
    const homeNodeId = requestedDirectory?.ok && requestedDirectory.value.kind === "directory"
      ? requestedDirectory.value.id
      : getSpecialLocationNodeId(vfs.state.specialLocations, initialLocation);
    const homePath = getVfsPathForNode(vfs.state, homeNodeId);

    const target: KonquerorLocationTarget = launchRequest && isKonquerorOpenSysinfoIntent(launchRequest.intent)
      ? { type: "sysinfo" }
      : launchRequest && isKonquerorOpenStartIntent(launchRequest.intent)
      ? createKonquerorAboutLocationTarget("blank")
      : requestedExternalIntent !== null
      ? { type: "external-web", canonicalUrl: requestedExternalIntent.canonicalUrl }
      : requestedFile?.ok && requestedFile.value.kind === "file"
      ? {
        type: "file",
        nodeId: requestedFile.value.id,
        previewerId: resolveKonquerorPreviewer(requestedFile.value, requestedFileIntent?.previewerId),
      }
      : launchRequest === null
      ? createKonquerorAboutLocationTarget("blank")
      : { type: "directory", nodeId: homeNodeId };

    if (target.type === "sysinfo") {
      return {
        target,
        homePath: KONQUEROR_SYSINFO_LOCATION,
      };
    }

    if (target.type === "about-konqueror") {
      return {
        target,
        homePath: KONQUEROR_ABOUT_LOCATION,
      };
    }

    if (target.type === "external-web") {
      return { target, homePath: target.canonicalUrl };
    }

    const locationPath = getKonquerorLocationString(vfs.state, target.nodeId);

    return {
      target,
      homePath: locationPath.ok ? locationPath.value : homePath.ok ? homePath.value : "/",
    };
  }, [launchRequest, vfs.state]);
  const lastHandledLaunchRequestIdRef = useRef<number | null>(
    launchRequest && (isKonquerorOpenStartIntent(launchRequest.intent) || isKonquerorDetachTabIntent(launchRequest.intent))
      ? null
      : launchRequest?.requestId ?? null,
  );
  const [tabState, dispatchTabs] = useReducer(
    konquerorTabsReducer,
    initialNavigationSeed,
    ({ target, homePath, detachedTab }) => detachedTab
      ? createKonquerorWindowTabsFromDetachedTab(detachedTab)
      : createInitialKonquerorWindowTabs(target, homePath),
  );
  const activeTab = getActiveKonquerorTab(tabState);
  const navigationState = activeTab.navigationState;
  const dispatchNavigation = useCallback((action: KonquerorNavigationAction) => {
    dispatchTabs({ type: "navigation", tabId: activeTab.id, action });
  }, [activeTab.id]);
  const dispatchImageView = useCallback((action: import("./imageViewModel").KonquerorImageViewAction) => {
    dispatchTabs({ type: "image-view", tabId: activeTab.id, action });
  }, [activeTab.id]);
  const dispatchMediaView = useCallback((action: KonquerorMediaViewAction) => {
    dispatchTabs({ type: "media-view", tabId: activeTab.id, action });
  }, [activeTab.id]);
  const [externalWebLoadState, dispatchExternalWebLoad] = useReducer(
    konquerorExternalWebLoadReducer,
    initialKonquerorExternalWebLoadState,
  );
  const [externalWebZoomState, dispatchExternalWebZoom] = useReducer(
    konquerorExternalWebZoomReducer,
    defaultKonquerorExternalWebZoomState,
  );
  const [commandDialogState, dispatchCommandDialog] = useReducer(
    konquerorCommandDialogReducer,
    initialKonquerorCommandDialogState,
  );
  const [bookmarkFolderDialogState, dispatchBookmarkFolderDialog] = useReducer(
    konquerorBookmarkFolderDialogReducer,
    initialKonquerorBookmarkFolderDialogState,
  );
  const [directTransferDialogState, dispatchDirectTransferDialog] = useReducer(
    konquerorDirectTransferDialogReducer,
    initialKonquerorDirectTransferDialogState,
  );
  const [pendingMovedCurrentDirectoryId, setPendingMovedCurrentDirectoryId] = useState<VfsNodeId | null>(null);
  const [pendingMovedCurrentFileId, setPendingMovedCurrentFileId] = useState<VfsNodeId | null>(null);
  const [editorState, dispatchEditor] = useReducer(konquerorEditorReducer, initialKonquerorEditorState);
  const sharedClipboard = useOptionalKonquerorClipboard();
  const sharedFileUndo = useOptionalKonquerorFileUndo();
  const { applyPreferences, preferences } = useDesktopPreferences();
  const [localClipboardState, dispatchLocalClipboard] = useReducer(
    konquerorClipboardReducer,
    initialKonquerorClipboardState,
  );
  const clipboardState = sharedClipboard?.state ?? localClipboardState;
  const dispatchClipboard = sharedClipboard?.dispatch ?? dispatchLocalClipboard;
  const unavailableFileUndo = useMemo(() => ({
    state: initialKonquerorFileUndoState,
    record: () => undefined,
    undo: () => ({ ok: false as const, error: { code: "NOT_FOUND" as const, message: "No shared file operation history is available." } }),
  }), []);
  const fileUndo = sharedFileUndo ?? unavailableFileUndo;
  const [confirmationState, dispatchConfirmation] = useReducer(
    konquerorConfirmationReducer,
    initialKonquerorConfirmationState,
  );
  const [fileOperationState, dispatchFileOperation] = useReducer(
    konquerorFileOperationReducer,
    initialKonquerorFileOperationState,
  );
  const [isLocationEditing, setIsLocationEditing] = useState(false);
  const [dockOrder, setDockOrder] = useState(() => preferences.konquerorDockOrder ?? defaultKonquerorDockOrder);
  const [showMainToolbar, setShowMainToolbar] = useState(true);
  const [showLocationToolbar, setShowLocationToolbar] = useState(true);
  const [propertiesNodeId, setPropertiesNodeId] = useState<VfsNodeId | null>(null);
  const [securityDialogInfo, setSecurityDialogInfo] = useState<KonquerorSecurityInfo | null>(null);
  const [contextMenuState, setContextMenuState] = useState<KonquerorContextMenuState>(null);
  const [dropActionRequest, setDropActionRequest] = useState<KonquerorDropActionRequest | null>(null);
  const [openApplicationMenu, setOpenApplicationMenu] = useState<KonquerorApplicationMenuRequest | null>(null);
  const applicationRootRef = useRef<HTMLDivElement | null>(null);
  const applicationMenuPopupRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const directorySurfaceRef = useRef<HTMLDivElement | null>(null);
  const directoryViewportRef = useRef<HTMLDivElement | null>(null);
  const previewSurfaceRef = useRef<HTMLElement | null>(null);
  const mediaCommandHandlerRef = useRef<((command: KonquerorMediaCommand) => void) | null>(null);
  const registerMediaCommand = useCallback((handler: ((command: KonquerorMediaCommand) => void) | null) => {
    mediaCommandHandlerRef.current = handler;
  }, []);
  const sysinfoSurfaceRef = useRef<HTMLDivElement | null>(null);
  const aboutSurfaceRef = useRef<HTMLDivElement | null>(null);
  const externalWebSurfaceRef = useRef<HTMLIFrameElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const securityButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuBarRef = useRef<HTMLElement | null>(null);
  const nextContextMenuRequestId = useRef(1);
  const nextDropActionRequestId = useRef(1);
  const nextApplicationMenuRequestId = useRef(1);
  const [windowDirectoryViewState, dispatchWindowDirectoryView] = useReducer(
    konquerorDirectoryViewReducer,
    {
      viewMode: preferences.konquerorResourceViewMode,
      treeZoomLevel: preferences.konquerorResourceTreeZoom,
      iconZoomLevel: preferences.konquerorResourceIconZoom,
    },
    createInitialKonquerorDirectoryViewState,
  );
  const directoryViewState = useMemo(() => ({
    ...windowDirectoryViewState,
    expandedTreeNodeIds: activeTab.expandedTreeNodeIds,
  }), [activeTab.expandedTreeNodeIds, windowDirectoryViewState]);
  const dispatchDirectoryView = useCallback((action: KonquerorDirectoryViewAction) => {
    if (action.type === "toggle-tree-expansion") {
      const expandedTreeNodeIds = activeTab.expandedTreeNodeIds.includes(action.nodeId)
        ? activeTab.expandedTreeNodeIds.filter((nodeId) => nodeId !== action.nodeId)
        : [...activeTab.expandedTreeNodeIds, action.nodeId];
      dispatchTabs({ type: "tree-expansion", tabId: activeTab.id, expandedTreeNodeIds });
      return;
    }

    if (action.type === "retain-tree-expansion") {
      const directoryNodeIds = new Set(action.directoryNodeIds);
      const expandedTreeNodeIds = activeTab.expandedTreeNodeIds.filter((nodeId) => directoryNodeIds.has(nodeId));
      if (expandedTreeNodeIds.length !== activeTab.expandedTreeNodeIds.length) {
        dispatchTabs({ type: "tree-expansion", tabId: activeTab.id, expandedTreeNodeIds });
      }
      return;
    }

    dispatchWindowDirectoryView(action);
  }, [activeTab.expandedTreeNodeIds, activeTab.id]);
  const commitDockOrder = useCallback((nextDockOrder: typeof dockOrder) => {
    if (nextDockOrder === dockOrder) {
      return;
    }

    setDockOrder(nextDockOrder);
    if (preferences.konquerorDockOrder !== nextDockOrder) {
      applyPreferences({ ...preferences, konquerorDockOrder: nextDockOrder });
    }
  }, [applyPreferences, dockOrder, preferences]);
  const setResourceViewMode = (viewMode: KonquerorResourceViewMode) => {
    if (directoryViewState.viewMode === viewMode) {
      return;
    }

    const nextVisibleNodeIds = viewMode === "tree"
      ? visibleTreeRows.map((row) => row.nodeId)
      : sortedDirectoryChildren?.map((node) => node.id) ?? [];
    dispatchNavigation({ type: "retain-selection", visibleNodeIds: nextVisibleNodeIds });
    dispatchDirectoryView({ type: "set-view-mode", viewMode });
    if (preferences.konquerorResourceViewMode !== viewMode) {
      applyPreferences({ ...preferences, konquerorResourceViewMode: viewMode });
    }
  };
  const adjustResourceZoom = useCallback((direction: "in" | "out") => {
    const currentZoom = getKonquerorResourceZoomLevel(directoryViewState);
    const nextZoom = getNextKonquerorResourceZoomLevel(currentZoom, direction);

    if (nextZoom === currentZoom) {
      return;
    }

    dispatchDirectoryView({ type: direction === "in" ? "zoom-in" : "zoom-out" });
    const preferenceField = directoryViewState.viewMode === "icons"
      ? "konquerorResourceIconZoom"
      : "konquerorResourceTreeZoom";

    if (preferences[preferenceField] !== nextZoom) {
      applyPreferences({ ...preferences, [preferenceField]: nextZoom });
    }
  }, [applyPreferences, directoryViewState, dispatchDirectoryView, preferences]);
  const [embeddedContentState, dispatchEmbeddedContent] = useReducer(
    konquerorEmbeddedContentReducer,
    defaultKonquerorEmbeddedContentState,
  );
  const konquerorPrint = useOptionalKonquerorPrint();
  const view = getKonquerorView(vfs.state, navigationState);
  useEffect(() => {
    setDropActionRequest(null);
  }, [directoryViewState.viewMode, view.type]);
  const isTrashRoot = view.type === "directory" && isVfsTrashRoot(vfs.state, view.node.id);
  const canonicalLocation = getKonquerorCurrentPath(vfs.state, navigationState);
  const currentLocationTarget = getCurrentKonquerorLocationTarget(navigationState);
  const captionLabels = useMemo(() => ({
    unavailable: t("konqueror.caption.unavailable"),
    start: t("konqueror.page.startTagline"),
    computer: t("konqueror.page.myComputer"),
    root: t("konqueror.caption.root"),
    trash: t("konqueror.page.trash"),
  }), [t]);
  const activeBookmarkDraft = useMemo(
    () => getKonquerorActiveBookmarkDraft(vfs.state, navigationState),
    [navigationState, vfs.state],
  );
  const allTabBookmarkDrafts = useMemo(
    () => getKonquerorBookmarkDraftsForTabs(vfs.state, tabState.tabs),
    [tabState.tabs, vfs.state],
  );
  const externalViewUrl = view.type === "external-web" ? view.canonicalUrl : null;
  const currentExternalLoad = externalViewUrl !== null && externalWebLoadState.canonicalUrl === externalViewUrl
    ? externalWebLoadState
    : null;
  const taskIconId = getKonquerorTaskIconId(vfs.state, currentLocationTarget);
  useEffect(() => {
    if (!windowId || !windowManager?.setWindowLauncherMetadata) {
      return;
    }

    windowManager.setWindowLauncherMetadata(windowId, {
      isHomeLocation: currentLocationTarget?.type === "directory" && currentLocationTarget.nodeId === vfs.state.specialLocations.home,
      semanticIconId: taskIconId,
    });
  }, [currentLocationTarget, taskIconId, vfs.state.specialLocations.home, windowId, windowManager]);
  const currentPath = view.type === "file-unavailable"
    ? "Unavailable"
    : view.type === "error"
    ? navigationState.locationDraft
    : canonicalLocation.ok
    ? getKonquerorLocationDraft(currentLocationTarget, canonicalLocation.value)
    : view.path;
  const aboutScrollSurfaceText = t("konqueror.page.startAria");
  const aboutScrollSurfaceLabel = aboutScrollSurfaceText.length > 0
    ? t("common.scrollSurface", { name: aboutScrollSurfaceText })
    : t("common.blankPage");
  const navigationError = navigationState.navigationError ?? (view.type === "error" ? view.error : null);
  const file = view.type === "file" ? view.node : null;
  const currentPreviewerId = file && currentLocationTarget?.type === "file"
    ? resolveKonquerorPreviewer(file, currentLocationTarget.previewerId)
    : null;
  const isImagePreview = currentPreviewerId === "image" && file !== null;
  const isMediaPreview = (currentPreviewerId === "media-audio" || currentPreviewerId === "media-video") && file !== null;
  const imageViewState = activeTab.imageViewState;
  const mediaViewState = activeTab.mediaViewState;
  const windowTitle = isImagePreview && imageViewState.status === "loaded" && imageViewState.dimensions !== null
    ? `${getVfsNodeDisplayName(file)} - ${imageViewState.dimensions.width}x${imageViewState.dimensions.height} - Konqueror`
    : getKonquerorCaption(vfs.state, currentLocationTarget, captionLabels);
  useEffect(() => {
    onSetWindowTitle(windowTitle);
  }, [onSetWindowTitle, windowTitle]);
  useEffect(() => {
    if (isImagePreview && imageViewState.nodeId !== file.id) {
      dispatchImageView({ type: "start", nodeId: file.id });
    }
  }, [dispatchImageView, file, imageViewState.nodeId, isImagePreview]);
  useEffect(() => {
    if (isMediaPreview && file !== null && mediaViewState.nodeId !== file.id) {
      dispatchMediaView({ type: "start", nodeId: file.id });
    }
  }, [dispatchMediaView, file, isMediaPreview, mediaViewState.nodeId]);
  const currentSecurityInfo = getKonquerorSecurityInfo(view, currentPreviewerId, currentExternalLoad);
  const editorAvailability = getKonquerorEditorAvailability(view, editorState);
  const editorDraftSize = getKonquerorEditorDraftSize(editorState);
  const editorSaveError = editorState.kind === "editing" ? editorState.saveError : null;
  const visibleError = navigationError;
  const operationError = fileOperationState.error;
  const statusError = editorSaveError ?? operationError ?? visibleError;
  const isEditing = editorAvailability.isEditing;
  const isCommandDialogOpen = commandDialogState.kind !== "closed";
  const isBookmarkFolderDialogOpen = bookmarkFolderDialogState.kind !== "closed";
  const isDirectTransferDialogOpen = directTransferDialogState.kind !== "closed";
  const isConfirmationOpen = confirmationState.kind !== "closed";
  const isPropertiesOpen = propertiesNodeId !== null;
  const isSecurityDialogOpen = securityDialogInfo !== null;
  const isContextMenuOpen = contextMenuState !== null;
  const isApplicationMenuOpen = openApplicationMenu !== null;
  const selectedNodeId = getSingleKonquerorSelectedNodeId(navigationState.selectedNodeIds);
  const commandAvailability = getKonquerorCommandAvailability(
    vfs.state,
    view,
    navigationState.selectedNodeIds,
  );
  const directoryChildren = view.type === "directory" ? view.children : null;
  const sortedDirectoryChildren = useMemo(
    () => (directoryChildren ? sortKonquerorEntries(directoryChildren, directoryViewState.sort) : null),
    [directoryChildren, directoryViewState.sort],
  );
  const visibleTreeRows = useMemo(
    () => view.type === "directory"
      ? getKonquerorVisibleTreeRows(vfs.state, view.node.id, directoryViewState.sort, directoryViewState.expandedTreeNodeIds)
      : [],
    [directoryViewState.expandedTreeNodeIds, directoryViewState.sort, vfs.state, view],
  );
  const activeResourceVisibleNodeIds = useMemo(
    () => directoryViewState.viewMode === "tree"
      ? visibleTreeRows.map((row) => row.nodeId)
      : sortedDirectoryChildren?.map((node) => node.id) ?? [],
    [directoryViewState.viewMode, sortedDirectoryChildren, visibleTreeRows],
  );
  const selectedNodeIdsInVisibleOrder = useMemo(
    () => getKonquerorSelectedNodeIdsInVisibleOrder(
      navigationState.selectedNodeIds,
      activeResourceVisibleNodeIds,
    ),
    [activeResourceVisibleNodeIds, navigationState.selectedNodeIds],
  );
  const clipboardAvailability = getKonquerorClipboardAvailability({
    state: vfs.state,
    view,
    selectedNodeIds: navigationState.selectedNodeIds,
    visibleNodeIds: activeResourceVisibleNodeIds,
    clipboardState,
    isEditing,
    isCommandDialogOpen,
    isConfirmationOpen,
    isPropertiesOpen,
  });
  const currentFileClipboardAvailability = getKonquerorClipboardAvailability({
    state: vfs.state,
    view,
    selectedNodeIds: (isImagePreview || isMediaPreview) && file !== null ? [file.id] : [],
    visibleNodeIds: activeResourceVisibleNodeIds,
    clipboardState,
    isEditing,
    isCommandDialogOpen,
    isConfirmationOpen,
    isPropertiesOpen,
    currentFileNodeId: (isImagePreview || isMediaPreview) && file !== null ? file.id : undefined,
  });
  const directTransferAvailability = getKonquerorDirectTransferAvailability(
    vfs.state,
    selectedNodeIdsInVisibleOrder,
    isEditing || isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen,
  );
  const backgroundDirectTransferAvailability = getKonquerorDirectTransferAvailability(
    vfs.state,
    view.type === "directory" ? [view.node.id] : [],
    isEditing || isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen,
  );
  const previewDirectTransferAvailability = getKonquerorDirectTransferAvailability(
    vfs.state,
    view.type === "file" ? [view.node.id] : [],
    isEditing || isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen,
  );
  const contextItemDirectTransferAvailability = getKonquerorDirectTransferAvailability(
    vfs.state,
    contextMenuState?.kind === "item" ? [contextMenuState.clickedNodeId] : [],
    isEditing || isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen,
  );
  const isTrashView = clipboardAvailability.isTrashView;
  const cutNodeIds = clipboardState.kind === "items" && clipboardState.mode === "cut" ? clipboardState.displayNodeIds : [];
  const isDialogBlockingCommands = isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen;
  const canCreateNewFolder =
    !isEditing && !isTrashView && !isDialogBlockingCommands && commandAvailability.canCreateNewFolder;
  const canCreateNewTextFile =
    !isEditing && !isTrashView && !isDialogBlockingCommands && commandAvailability.canCreateNewTextFile;
  const canRename = !isEditing && !isTrashView && !isDialogBlockingCommands && commandAvailability.canRename;
  const canEdit = editorAvailability.canEdit && !isTrashView && !isDialogBlockingCommands;
  const editTitle = isTrashView ? t("konqueror.availability.itemsTrashReadOnly") : translateKonquerorAvailabilityText(t, editorAvailability.editTitle);
  const trashCommandAvailability = getKonquerorTrashCommandAvailability({
    state: vfs.state,
    view,
    selectedNodeIds: navigationState.selectedNodeIds,
    visibleNodeIds: activeResourceVisibleNodeIds,
    isBlocking: isEditing || isDialogBlockingCommands,
  });
  const trashMetadataByNodeId = useMemo(() => {
    if (!isTrashRoot) {
      return {};
    }

    const entries = vfs.listTrashEntries();

    if (!entries.ok) {
      return {};
    }

    return Object.fromEntries(
      entries.value.map(({ entry, node }) => {
        const originalLocation = getVfsPathForNode(vfs.state, entry.originalParentId);

        return [
          node.id,
          {
            originalLocation: originalLocation.ok ? originalLocation.value : "Unavailable",
            deleted: formatVfsModifiedTime(entry.trashedAt, { locale }),
          },
        ];
      }),
    );
  }, [isTrashRoot, locale, vfs]);
  const isNavigationBlocked = isEditing || isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen;
  const activeTabTerminalPlan = currentLocationTarget?.type === "directory"
    ? planKonquerorOpenTerminalHere(vfs.state, currentLocationTarget.nodeId)
    : null;
  const canUndoFileOperation = !isNavigationBlocked && !fileUndo.state.isExecuting && fileUndo.state.entries.length > 0;
  const undoFileOperationTitle = canUndoFileOperation
    ? t("konqueror.availability.undoLast")
    : isNavigationBlocked
    ? t("konqueror.availability.finishCurrentOperation")
    : t("konqueror.availability.noUndo");
  const recordFileUndoOperation = useCallback((
    kind: VfsFileOperationUndoKind,
    beforeState: typeof vfs.state,
    nodeIds: readonly VfsNodeId[],
  ) => {
    const entry = vfs.createFileOperationUndoEntry(kind, beforeState, nodeIds);
    if (entry.ok && entry.value) {
      fileUndo.record(entry.value);
    }
  }, [fileUndo, vfs]);
  const isDirectoryFocusBlocked = isNavigationBlocked || isContextMenuOpen || isApplicationMenuOpen;
  const navigationDisabledTitle = isEditing
    ? translateKonquerorAvailabilityText(t, editorAvailability.navigationDisabledTitle)
    : isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen || isSecurityDialogOpen
    ? t("konqueror.availability.finishCurrentOperation")
    : undefined;
  const canGoBack = !isNavigationBlocked && Boolean(findKonquerorHistoryTarget(vfs.state, navigationState, "back"));
  const canGoForward = !isNavigationBlocked && Boolean(findKonquerorHistoryTarget(vfs.state, navigationState, "forward"));
  const parentDirectoryNodeId = getKonquerorParentDirectoryNodeId(vfs.state, navigationState);
  const externalParentUrl = currentLocationTarget?.type === "external-web"
    ? getKonquerorExternalWebParentUrl(currentLocationTarget)
    : null;
  const isAtHome = currentLocationTarget?.type === "directory" &&
    currentLocationTarget.nodeId === vfs.state.specialLocations.home;
  const canGoUp = !isNavigationBlocked && (parentDirectoryNodeId !== null || externalParentUrl !== null);
  const canGoHome = !isNavigationBlocked && !isAtHome;
  const canReload = !isNavigationBlocked && view.type !== "error" && view.type !== "file-unavailable";
  const canStop = !isNavigationBlocked && (
    (view.type === "external-web" && currentExternalLoad?.status === "loading") ||
    (isImagePreview && imageViewState.status === "loading") ||
    (isMediaPreview && ["loading", "playing", "waiting", "paused", "ended"].includes(mediaViewState.status))
  );
  const previousImageNodeId = isImagePreview && file !== null
    ? getKonquerorAdjacentImageNodeId(vfs.state, file, "previous")
    : null;
  const nextImageNodeId = isImagePreview && file !== null
    ? getKonquerorAdjacentImageNodeId(vfs.state, file, "next")
    : null;
  const previousMediaNodeId = isMediaPreview && file !== null
    ? getKonquerorAdjacentMediaNodeId(vfs.state, file, "previous", directoryViewState.sort)
    : null;
  const nextMediaNodeId = isMediaPreview && file !== null
    ? getKonquerorAdjacentMediaNodeId(vfs.state, file, "next", directoryViewState.sort)
    : null;
  const mediaCommandAvailability = getKonquerorMediaCommandAvailability(
    mediaViewState.status,
    !isMediaPreview || file === null || !isKonquerorMediaFile(file) || mediaViewState.status === "error",
    mediaViewState.currentTime,
    previousMediaNodeId !== null && !isNavigationBlocked,
    nextMediaNodeId !== null && !isNavigationBlocked,
  );
  const canSecurity = !isNavigationBlocked && currentSecurityInfo !== null;
  const pageStatus = view.type === "external-web"
    ? currentExternalLoad?.status === "loaded"
      ? t("konqueror.status.pageLoaded")
      : currentExternalLoad?.status === "stopped"
      ? t("konqueror.status.loadingStopped")
      : t("konqueror.status.loading")
    : view.type === "sysinfo" || view.type === "about-konqueror"
    ? t("konqueror.status.pageLoaded")
    : isImagePreview
    ? imageViewState.status === "loaded"
      ? t("konqueror.status.imageLoaded")
      : imageViewState.status === "stopped"
      ? t("konqueror.status.loadingStopped")
      : imageViewState.status === "error"
      ? t("konqueror.status.unableImage")
      : t("konqueror.status.loadingImage")
    : isMediaPreview
    ? mediaViewState.status === "loading"
      ? t("konqueror.status.loadingMedia")
      : mediaViewState.status === "waiting"
      ? t("konqueror.status.bufferingMedia")
      : mediaViewState.status === "playing"
      ? t("konqueror.status.playing")
      : mediaViewState.status === "paused"
      ? t("konqueror.status.paused")
      : mediaViewState.status === "ended"
      ? t("konqueror.status.playbackFinished")
      : mediaViewState.status === "error"
      ? t("konqueror.status.unableMedia")
      : mediaViewState.status === "stopped"
      ? t("konqueror.status.loadingStopped")
      : t("konqueror.status.ready")
    : view.type === "file"
    ? t("konqueror.status.readOnlyPreview")
    : view.type === "file-unavailable"
    ? t("konqueror.status.unavailable")
    : null;
  const selectedDirectoryNode =
    view.type === "directory" && selectedNodeId !== null
      ? getVfsNodeById(vfs.state, selectedNodeId)
      : null;
  const canOpen =
    !isNavigationBlocked &&
    view.type === "directory" &&
    selectedDirectoryNode?.ok === true &&
    activeResourceVisibleNodeIds.includes(selectedDirectoryNode.value.id);
  const canShowProperties = !isEditing && !isDialogBlockingCommands && selectedNodeId !== null;
  const viewControlsDisabled = isNavigationBlocked || view.type !== "directory";
  const resourceZoomLevel = getKonquerorResourceZoomLevel(directoryViewState);
  const embeddedContentCapabilities = getKonquerorEmbeddedContentCapabilities(view, currentPreviewerId);
  const embeddedContentZoomLevel = embeddedContentCapabilities.kind === "none"
    ? 100
    : getKonquerorEmbeddedContentZoomLevel(embeddedContentState, embeddedContentCapabilities.kind);
  const canResourceZoomIn = !viewControlsDisabled && canAdjustKonquerorResourceZoom(directoryViewState, "in");
  const canResourceZoomOut = !viewControlsDisabled && canAdjustKonquerorResourceZoom(directoryViewState, "out");
  const canEmbeddedZoomIn = embeddedContentCapabilities.kind !== "none" &&
    embeddedContentCapabilities.canZoom &&
    canAdjustKonquerorEmbeddedContentZoom(embeddedContentState, embeddedContentCapabilities.kind, "in");
  const canEmbeddedZoomOut = embeddedContentCapabilities.kind !== "none" &&
    embeddedContentCapabilities.canZoom &&
    canAdjustKonquerorEmbeddedContentZoom(embeddedContentState, embeddedContentCapabilities.kind, "out");
  const hasActiveExternalWebFrame = view.type === "external-web" &&
    (currentExternalLoad?.status === "loading" || currentExternalLoad?.status === "loaded");
  const canExternalZoomIn = hasActiveExternalWebFrame && canAdjustKonquerorExternalWebZoom(externalWebZoomState, "in");
  const canExternalZoomOut = hasActiveExternalWebFrame && canAdjustKonquerorExternalWebZoom(externalWebZoomState, "out");
  const canImageZoomIn = isImagePreview && canAdjustKonquerorImageZoom(imageViewState, "in");
  const canImageZoomOut = isImagePreview && canAdjustKonquerorImageZoom(imageViewState, "out");
  const canZoomIn = view.type === "directory"
    ? canResourceZoomIn
    : view.type === "external-web"
    ? canExternalZoomIn
    : isImagePreview
    ? canImageZoomIn
    : canEmbeddedZoomIn;
  const canZoomOut = view.type === "directory"
    ? canResourceZoomOut
    : view.type === "external-web"
    ? canExternalZoomOut
    : isImagePreview
    ? canImageZoomOut
    : canEmbeddedZoomOut;

  const printDocument = useMemo<KonquerorPrintDocument | null>(() => view.type === "about-konqueror"
    ? { kind: "about" }
    : view.type === "file" && currentPreviewerId !== null
    ? { kind: "file", file: view.node, previewerId: currentPreviewerId }
    : null, [currentPreviewerId, view]);
  const canPrintCurrentContent = (embeddedContentCapabilities.canPrint || isImagePreview) && konquerorPrint !== null;
  const printEmbeddedContent = useCallback(() => {
    if (!canPrintCurrentContent || !printDocument || !konquerorPrint) {
      return;
    }
    konquerorPrint.requestPrint(windowId ?? "konqueror-unmanaged", printDocument);
  }, [canPrintCurrentContent, konquerorPrint, printDocument, windowId]);
  const { requestContentFocus, requestDirectoryFocus, requestLocationInputFocus } = useKonquerorDirectoryFocusHandoff({
    applicationRootRef,
    directorySurfaceRef,
    previewSurfaceRef,
    sysinfoSurfaceRef,
    aboutSurfaceRef,
    externalWebSurfaceRef,
    locationInputRef,
    contentFocusTarget: view.type === "about-konqueror"
      ? "about-konqueror"
      : view.type === "about-blank"
      ? "about-blank"
      : view.type === "sysinfo"
      ? "sysinfo"
      : view.type === "file"
      ? "preview"
      : view.type === "external-web"
      ? "external-web"
      : "directory",
    focusRequestId,
    isActive,
    isBlocked: isDirectoryFocusBlocked,
  });
  const dismissContextMenu = useCallback((restoreDirectoryFocus = true) => {
    setContextMenuState(null);
    if (restoreDirectoryFocus) {
      requestDirectoryFocus();
    }
  }, [requestDirectoryFocus]);
  const dismissApplicationMenu = useCallback((restoreDirectoryFocus = false) => {
    setOpenApplicationMenu(null);
    if (restoreDirectoryFocus) {
      requestDirectoryFocus({ force: true });
    }
  }, [requestDirectoryFocus]);
  useApplicationMenubarPolicy(dismissApplicationMenu, layoutMode);
  useEffect(() => {
    if (!isMediaPreview && openApplicationMenu?.menu === "player") {
      dismissApplicationMenu();
    }
  }, [dismissApplicationMenu, isMediaPreview, openApplicationMenu?.menu]);
  const addCurrentTabBookmark = useCallback((parentFolderId: KonquerorBookmarkFolderId | null = null) => {
    if (isNavigationBlocked || activeBookmarkDraft === null) {
      return;
    }

    addBookmark(activeBookmarkDraft, parentFolderId);
  }, [activeBookmarkDraft, addBookmark, isNavigationBlocked]);
  useEffect(() => {
    if (windowPopupLayer?.dismissGeneration) {
      dismissContextMenu(false);
    }
  }, [dismissContextMenu, windowPopupLayer?.dismissGeneration]);
  useApplicationMenuDismissal({
    isOpen: isApplicationMenuOpen,
    menuBarRef,
    popupRefs: [applicationMenuPopupRef],
    onDismiss: () => dismissApplicationMenu(),
  });
  const closeCommandDialog = useCallback(() => {
    dispatchCommandDialog({ type: "close" });
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);
  const closeBookmarkFolderDialog = useCallback(() => {
    dispatchBookmarkFolderDialog({ type: "close" });
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);
  const submitBookmarkFolderDialog = useCallback(() => {
    if (bookmarkFolderDialogState.kind === "closed") {
      return;
    }

    const name = bookmarkFolderDialogState.draftName.trim();
    if (name.length === 0) {
      dispatchBookmarkFolderDialog({ type: "set-error", error: "invalid-name" });
      return;
    }

    const result = bookmarkFolderDialogState.intent === "bookmark-tabs-as-folder"
      ? bookmarkFolderDialogState.bookmarkDraftsSnapshot.length === 0
        ? null
        : addFolderWithBookmarks({ name }, bookmarkFolderDialogState.bookmarkDraftsSnapshot, bookmarkFolderDialogState.parentFolderId)
      : addFolder({ name }, bookmarkFolderDialogState.parentFolderId);
    if (result === null) {
      dispatchBookmarkFolderDialog({ type: "set-error", error: "no-bookmarkable-tabs" });
      return;
    }
    if (!result.ok) {
      dispatchBookmarkFolderDialog({ type: "set-error", error: "parent-unavailable" });
      return;
    }

    closeBookmarkFolderDialog();
  }, [addFolder, addFolderWithBookmarks, bookmarkFolderDialogState, closeBookmarkFolderDialog]);
  const closeDirectTransferDialog = useCallback(() => {
    dispatchDirectTransferDialog({ type: "close" });
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);
  const closeConfirmation = useCallback(() => {
    dispatchConfirmation({ type: "close" });
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);
  const closeProperties = useCallback(() => {
    setPropertiesNodeId(null);
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);
  const closeSecurityDialog = useCallback(() => {
    setSecurityDialogInfo(null);
    window.requestAnimationFrame(() => securityButtonRef.current?.focus());
  }, []);
  const closeEditor = useCallback(() => {
    dispatchEditor({ type: "close" });
    requestDirectoryFocus();
  }, [requestDirectoryFocus]);

  useEffect(() => {
    if (!isActive) {
      setOpenApplicationMenu(null);
    }
  }, [isActive]);

  const startExternalWebLoad = useCallback((canonicalUrl: string) => {
    dispatchExternalWebLoad({ type: "start", canonicalUrl });
  }, []);
  const clearExternalWebLoad = useCallback(() => {
    dispatchExternalWebLoad({ type: "clear" });
  }, []);
  const completeExternalWebLoad = useCallback((canonicalUrl: string, generation: number) => {
    dispatchExternalWebLoad({ type: "loaded", canonicalUrl, generation });
  }, []);
  useEffect(() => {
    if (externalViewUrl === null) {
      clearExternalWebLoad();
      return;
    }

    if (externalWebLoadState.canonicalUrl !== externalViewUrl) {
      startExternalWebLoad(externalViewUrl);
    }
  }, [clearExternalWebLoad, externalViewUrl, externalWebLoadState.canonicalUrl, startExternalWebLoad]);

  useEffect(() => {
    if (securityDialogInfo !== null && currentSecurityInfo?.location !== securityDialogInfo.location) {
      setSecurityDialogInfo(null);
    }
  }, [currentSecurityInfo?.location, securityDialogInfo]);

  const navigateToLocation = (location: string): boolean => {
    if (isNavigationBlocked) {
      return false;
    }

    dismissContextMenu(false);

    const target = resolveKonquerorAbsoluteLocationTarget(vfs.state, location);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: currentPath,
        error: target.error,
      });
      return false;
    }

    if (target.value.target.type === "external-web") {
      startExternalWebLoad(target.value.target.canonicalUrl);
    } else {
      clearExternalWebLoad();
    }

    dispatchNavigation({
      type: "navigate-success",
      target: target.value.target,
      path: target.value.path,
    });
    dispatchFileOperation({ type: "clear" });
    requestContentFocus({ force: true });
    return true;
  };

  const navigateToVirtualLocation = (target: Extract<KonquerorLocationTarget, { readonly type: "sysinfo" | "about-konqueror" | "about-blank" }>, path: string) => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu(false);
    clearExternalWebLoad();
    dispatchNavigation({ type: "navigate-success", target, path });
    dispatchFileOperation({ type: "clear" });
    requestContentFocus({ force: true });
  };

  const navigateToSysinfo = () => navigateToVirtualLocation({ type: "sysinfo" }, KONQUEROR_SYSINFO_LOCATION);

  const navigateToNodeId = useCallback((nodeId: VfsNodeId) => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu(false);
    const target = resolveKonquerorDirectoryNodeId(vfs.state, nodeId);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: target.error,
      });
      return;
    }

    clearExternalWebLoad();
    dispatchNavigation({
      type: "navigate-success",
      target: { type: "directory", nodeId: target.value.node.id },
      path: target.value.path,
    });
    dispatchFileOperation({ type: "clear" });
    requestDirectoryFocus({ force: true });
  }, [clearExternalWebLoad, dismissContextMenu, dispatchNavigation, isNavigationBlocked, navigationState.locationDraft, requestDirectoryFocus, vfs.state]);

  useEffect(() => {
    if (pendingMovedCurrentDirectoryId === null) {
      return;
    }

    setPendingMovedCurrentDirectoryId(null);
    navigateToNodeId(pendingMovedCurrentDirectoryId);
  }, [navigateToNodeId, pendingMovedCurrentDirectoryId, vfs.state]);

  const navigateToFileNodeId = useCallback((nodeId: VfsNodeId, requestedPreviewerId?: KonquerorPreviewerId) => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu(false);
    const target = resolveKonquerorTextFileNodeId(vfs.state, nodeId);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: target.error,
      });
      return;
    }

    const currentTarget = getCurrentKonquerorLocationTarget(navigationState);
    const previewerId = requestedPreviewerId
      ? resolveKonquerorPreviewer(target.value.node, requestedPreviewerId)
      : currentTarget?.type === "file" && currentTarget.nodeId === target.value.node.id
      ? resolveKonquerorPreviewer(target.value.node, currentTarget.previewerId)
      : getDefaultKonquerorPreviewer(target.value.node);
    clearExternalWebLoad();
    dispatchNavigation({
      type: "navigate-success",
      target: { type: "file", nodeId: target.value.node.id, previewerId },
      path: target.value.path,
    });
    dispatchFileOperation({ type: "clear" });
    requestContentFocus({ force: true });
  }, [clearExternalWebLoad, dismissContextMenu, dispatchNavigation, isNavigationBlocked, navigationState, requestContentFocus, vfs.state]);

  const navigateAdjacentImage = (direction: "previous" | "next") => {
    if (!isImagePreview || file === null || isNavigationBlocked) {
      return;
    }

    const adjacentNodeId = getKonquerorAdjacentImageNodeId(vfs.state, file, direction);
    if (adjacentNodeId !== null) {
      navigateToFileNodeId(adjacentNodeId, "image");
    }
  };

  const navigateAdjacentMedia = (direction: "previous" | "next") => {
    if (!isMediaPreview || file === null || isNavigationBlocked) {
      return;
    }

    const adjacentNodeId = getKonquerorAdjacentMediaNodeId(vfs.state, file, direction, directoryViewState.sort);
    if (adjacentNodeId !== null) {
      navigateToFileNodeId(adjacentNodeId);
    }
  };

  useEffect(() => {
    if (pendingMovedCurrentFileId === null) {
      return;
    }

    setPendingMovedCurrentFileId(null);
    navigateToFileNodeId(pendingMovedCurrentFileId);
  }, [navigateToFileNodeId, pendingMovedCurrentFileId, vfs.state]);
  const addTabForTarget = (target: KonquerorLocationTarget, path: string, focusLocation = false) => {
    if (isNavigationBlocked) {
      return;
    }

    dispatchTabs({ type: "add", target, homePath: path });
    dismissContextMenu(false);
    dismissApplicationMenu();
    dispatchFileOperation({ type: "clear" });
    if (focusLocation) {
      requestLocationInputFocus();
    } else {
      requestContentFocus({ force: true });
    }
  };
  const createBlankTab = () => {
    addTabForTarget(createKonquerorBlankLocationTarget(), KONQUEROR_BLANK_LOCATION, true);
  };
  const duplicateCurrentKonquerorTab = () => {
    if (!currentLocationTarget) {
      return;
    }

    const location = getKonquerorCurrentPath(vfs.state, navigationState);
    addTabForTarget(
      currentLocationTarget,
      location.ok ? location.value : currentPath,
      currentLocationTarget.type === "about-blank",
    );
  };
  const openNodeInNewTab = (nodeId: VfsNodeId, previewerId?: KonquerorPreviewerId) => {
    if (isNavigationBlocked) {
      return;
    }

    const target = resolveKonquerorNodeId(vfs.state, nodeId);
    if (!target.ok) {
      dispatchFileOperation({ type: "set-error", error: target.error });
      return;
    }

    addTabForTarget(
      target.value.node.kind === "directory"
        ? { type: "directory", nodeId: target.value.node.id }
        : { type: "file", nodeId: target.value.node.id, previewerId: resolveKonquerorPreviewer(target.value.node, previewerId) },
      target.value.path,
    );
  };
  const openNodesInNewWindows = (targetNodeIds: readonly VfsNodeId[], previewerId?: KonquerorPreviewerId) => {
    const plan = planKonquerorOpenInNewWindow(vfs.state, targetNodeIds);

    if (!plan.ok) {
      dispatchFileOperation({ type: "set-error", error: plan.error });
      return;
    }

    for (const intent of plan.value) {
      launchNewApplicationInstance("konqueror", {
        intent: previewerId !== undefined && intent.type === "open-file"
          ? createKonquerorOpenFileIntent(intent.nodeId, previewerId)
          : intent,
      });
    }
  };
  const openNewKonquerorWindow = () => {
    const target = currentLocationTarget;
    const intent = target?.type === "directory"
      ? createKonquerorOpenDirectoryIntent(target.nodeId)
      : target?.type === "file"
      ? createKonquerorOpenFileIntent(target.nodeId, target.previewerId)
      : target?.type === "sysinfo"
      ? createKonquerorOpenSysinfoIntent()
      : createKonquerorOpenStartIntent();
    launchNewApplicationInstance("konqueror", { intent });
  };
  const closeCurrentKonquerorTab = () => {
    if (isNavigationBlocked || tabState.tabs.length <= 1) {
      return;
    }
    dispatchTabs({ type: "close", tabId: tabState.activeTabId });
  };
  const detachCurrentKonquerorTab = () => {
    if (isNavigationBlocked) {
      return;
    }

    const detached = detachKonquerorTab(tabState, tabState.activeTabId);
    if (detached === null) {
      return;
    }

    const result = launchNewApplicationInstance("konqueror", { intent: createKonquerorDetachTabIntent(detached.tab) });
    if (result === "opened") {
      dispatchTabs({ type: "close", tabId: detached.tab.id });
    }
  };
  const openTerminalForDirectory = (directoryNodeId: VfsNodeId) => {
    const plan = planKonquerorOpenTerminalHere(vfs.state, directoryNodeId);
    if (plan.ok) {
      launchNewApplicationInstance("konsole", { intent: plan.value });
    }
  };
  const openTerminalForActiveTab = () => {
    if (isNavigationBlocked || currentLocationTarget?.type !== "directory") {
      return;
    }

    openTerminalForDirectory(currentLocationTarget.nodeId);
  };

  const activateNode = (nodeId: VfsNodeId) => {
    if (isNavigationBlocked) {
      return;
    }

    const target = resolveKonquerorNodeId(vfs.state, nodeId);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: target.error,
      });
      return;
    }

    const activation = getKonquerorNodeActivation(target.value.node);

    if (activation.type === "navigate-directory") {
      navigateToNodeId(activation.nodeId);
      return;
    }

    navigateToFileNodeId(activation.nodeId);
  };

  const navigateHistory = (direction: "back" | "forward") => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu(false);

    const historyTarget = findKonquerorHistoryTarget(vfs.state, navigationState, direction);

    if (!historyTarget) {
      return;
    }

    if (historyTarget.target.target.type === "external-web") {
      startExternalWebLoad(historyTarget.target.target.canonicalUrl);
    } else {
      clearExternalWebLoad();
    }

    dispatchNavigation({
      type: "go-history",
      historyIndex: historyTarget.historyIndex,
      path: historyTarget.target.path,
    });
    dispatchFileOperation({ type: "clear" });
    requestContentFocus({ force: true });
  };

  const navigateUp = () => {
    if (isNavigationBlocked) {
      return;
    }

    if (externalParentUrl !== null) {
      navigateToLocation(externalParentUrl);
      return;
    }

    if (!parentDirectoryNodeId) {
      return;
    }

    navigateToNodeId(parentDirectoryNodeId);
  };

  const navigateHome = () => {
    navigateToNodeId(vfs.state.specialLocations.home);
  };

  const navigateToolbarBack = () => {
    if (!canGoBack) {
      return;
    }

    navigateHistory("back");
    requestContentFocus({ force: true });
  };

  const navigateToolbarForward = () => {
    if (!canGoForward) {
      return;
    }

    navigateHistory("forward");
    requestContentFocus({ force: true });
  };

  const navigateToolbarUp = () => {
    if (!canGoUp) {
      return;
    }

    navigateUp();
    requestContentFocus({ force: true });
  };

  const navigateToolbarHome = () => {
    if (!canGoHome) {
      return;
    }

    navigateHome();
    requestContentFocus({ force: true });
  };

  const reload = () => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu();

    if (currentLocationTarget?.type === "external-web") {
      startExternalWebLoad(currentLocationTarget.canonicalUrl);
      dispatchFileOperation({ type: "clear" });
      return;
    }

    if (currentLocationTarget?.type === "about-konqueror" || currentLocationTarget?.type === "sysinfo") {
      dispatchNavigation({
        type: "reload-success",
        path: currentLocationTarget.type === "about-konqueror" ? KONQUEROR_ABOUT_LOCATION : KONQUEROR_SYSINFO_LOCATION,
      });
      dispatchFileOperation({ type: "clear" });
      return;
    }

    const currentNodeId = getCurrentKonquerorNodeId(navigationState);

    if (!currentNodeId) {
      return;
    }

    if (isImagePreview && file !== null) {
      dispatchImageView({ type: "start", nodeId: file.id });
    }
    if (isMediaPreview) {
      dispatchMediaView({ type: "reload" });
    }

    const target = resolveKonquerorNodeId(vfs.state, currentNodeId);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: target.error,
      });
      return;
    }

    dispatchNavigation({
      type: "reload-success",
      path: target.value.path,
    });
    dispatchFileOperation({ type: "clear" });
  };

  const stopLoading = () => {
    if (!canStop) {
      return;
    }

    if (isImagePreview) {
      dispatchImageView({ type: "stop" });
    } else if (isMediaPreview) {
      dispatchMediaView({ type: "stop" });
    } else {
      dispatchExternalWebLoad({ type: "stop" });
    }
  };

  const resetLocationDraft = () => {
    if (isNavigationBlocked) {
      return;
    }

    const path = getKonquerorCurrentPath(vfs.state, navigationState);
    dispatchNavigation({
      type: "reset-location-draft",
      path: path.ok ? path.value : currentPath,
    });
  };

  const selectDirectoryNode = (nodeId: VfsNodeId, intent: KonquerorSelectionPointerIntent) => {
    if (intent === "replace") {
      dispatchNavigation({ type: "replace-selection", nodeId });
      return;
    }

    if (intent === "toggle") {
      dispatchNavigation({ type: "toggle-selection", nodeId });
      return;
    }

    if (activeResourceVisibleNodeIds.length === 0) {
      return;
    }

    dispatchNavigation({
      type: intent === "replace-range" ? "replace-selection-range" : "add-selection-range",
      visibleNodeIds: activeResourceVisibleNodeIds,
      targetNodeId: nodeId,
    });
  };
  const toggleTreeExpansion = (nodeId: VfsNodeId) => {
    const row = visibleTreeRows.find((visibleRow) => visibleRow.nodeId === nodeId);
    if (view.type !== "directory" || !row?.expandable) return;
    const expandedTreeNodeIds = directoryViewState.expandedTreeNodeIds.includes(nodeId)
      ? directoryViewState.expandedTreeNodeIds.filter((id) => id !== nodeId)
      : [...directoryViewState.expandedTreeNodeIds, nodeId];
    const nextVisibleNodeIds = getKonquerorVisibleTreeRows(vfs.state, view.node.id, directoryViewState.sort, expandedTreeNodeIds)
      .map((row) => row.nodeId);
    dispatchNavigation({ type: "retain-selection", visibleNodeIds: nextVisibleNodeIds });
    dispatchDirectoryView({ type: "toggle-tree-expansion", nodeId });
  };
  const handleTreeKeyboardAction = (key: "ArrowLeft" | "ArrowRight") => {
    const action = getKonquerorTreeKeyboardAction(selectedNodeId, visibleTreeRows, key);
    if (action === null) {
      return;
    }

    if (action.type === "select") {
      dispatchNavigation({ type: "replace-selection", nodeId: action.nodeId });
      return;
    }

    toggleTreeExpansion(action.nodeId);
  };
  const openNewFolderDialog = (targetFolderNodeId?: VfsNodeId) => {
    if (isEditing || isTrashView || isDialogBlockingCommands) {
      return;
    }

    if (view.type !== "directory") {
      return;
    }

    const parentNodeId = targetFolderNodeId ?? view.node.id;
    const createChildAvailability = getKonquerorCreateChildAvailability(vfs.state, parentNodeId);

    if (!createChildAvailability.canCreateChild) {
      return;
    }

    dispatchCommandDialog({
      type: "open-new-folder",
      parentNodeId,
      preserveSelection: targetFolderNodeId !== undefined,
    });
    dispatchFileOperation({ type: "clear" });
  };
  const openNewTextFileDialog = () => {
    if (isEditing || isTrashView || isDialogBlockingCommands) {
      return;
    }

    if (view.type !== "directory") {
      return;
    }

    dispatchCommandDialog({
      type: "open-new-text-file",
      parentNodeId: view.node.id,
    });
    dispatchFileOperation({ type: "clear" });
  };
  const openRenameDialog = () => {
    if (isEditing || isTrashView || isDialogBlockingCommands) {
      return;
    }

    if (!commandAvailability.canRename || !commandAvailability.renameTargetNodeId || !commandAvailability.renameTargetName) {
      return;
    }

    dispatchCommandDialog({
      type: "open-rename",
      targetNodeId: commandAvailability.renameTargetNodeId,
      originalName: commandAvailability.renameTargetName,
    });
    dispatchFileOperation({ type: "clear" });
  };
  const openDirectTransferDialog = (
    kind: "copy" | "move",
    sourceNodeIds: readonly VfsNodeId[] = selectedNodeIdsInVisibleOrder,
    sourceKind: "selection" | "current-directory" | "current-file" | "context-item" = "selection",
    sourceLocationNodeId?: VfsNodeId,
  ) => {
    const availability = sourceKind === "current-directory"
      ? backgroundDirectTransferAvailability
      : sourceKind === "current-file"
      ? previewDirectTransferAvailability
      : sourceKind === "context-item"
      ? contextItemDirectTransferAvailability
      : directTransferAvailability;
    const defaultSourceLocationNodeId = view.type === "directory" || view.type === "file" ? view.node.id : null;
    const resolvedSourceLocationNodeId = sourceLocationNodeId ?? defaultSourceLocationNodeId;
    if (!availability.canTransfer || resolvedSourceLocationNodeId === null) {
      return;
    }

    const request = createKonquerorDirectTransferRequest(
      vfs.state,
      kind,
      windowId ?? "konqueror-unmanaged",
      resolvedSourceLocationNodeId,
      sourceNodeIds,
      sourceKind,
    );
    if (!request.ok) {
      dispatchFileOperation({ type: "set-error", error: request.error });
      return;
    }

    const destination = getKonquerorDirectTransferInitialDestination(vfs.state, resolvedSourceLocationNodeId);
    if (!destination.ok) {
      dispatchFileOperation({ type: "set-error", error: destination.error });
      return;
    }

    dispatchDirectTransferDialog({
      type: "open",
      request: request.value,
      destinationDraft: destination.value,
    });
    dispatchFileOperation({ type: "clear" });
  };
  const submitDirectTransferDialog = () => {
    if (directTransferDialogState.kind === "closed") {
      return;
    }

    const beforeState = vfs.state;
    const result = submitKonquerorDirectTransfer(
      beforeState,
      directTransferDialogState.request,
      directTransferDialogState.destinationDraft,
      vfs,
      commandEnvironment,
    );
    if (!result.ok) {
      dispatchDirectTransferDialog({ type: "set-error", error: result.error });
      return;
    }

    recordFileUndoOperation(result.operation, beforeState, result.nodeIds);

    const selectedNodeIds = directTransferDialogState.request.kind === "copy"
      ? directTransferDialogState.request.rawDraggedNodeIds
      : [];
    const movedCurrentDirectoryId = directTransferDialogState.request.kind === "move" &&
      directTransferDialogState.request.sourceKind === "current-directory"
      ? directTransferDialogState.request.sourceLocationNodeId
      : null;
    const movedCurrentFileId = directTransferDialogState.request.kind === "move" &&
      directTransferDialogState.request.sourceKind === "current-file"
      ? directTransferDialogState.request.rawDraggedNodeIds[0] ?? null
      : null;
    closeDirectTransferDialog();
    dispatchNavigation({ type: "mutation-success", path: currentPath, selectedNodeIds });
    setPendingMovedCurrentDirectoryId(movedCurrentDirectoryId);
    setPendingMovedCurrentFileId(movedCurrentFileId);
    dispatchFileOperation({ type: "set-status", statusMessage: result.statusMessage });
  };
  const openProperties = (nodeId: VfsNodeId | null = selectedNodeId) => {
    if (isEditing || isDialogBlockingCommands || nodeId === null) {
      return;
    }

    const selectedNode = getVfsNodeById(vfs.state, nodeId);

    if (!selectedNode.ok) {
      return;
    }

    setPropertiesNodeId(selectedNode.value.id);
  };
  const openWithKWrite = (nodeId: VfsNodeId) => {
    const target = resolveKonquerorTextFileNodeId(vfs.state, nodeId);

    if (!target.ok) {
      return;
    }

    launchNewApplicationInstance("kwrite", {
      intent: createKWriteOpenTextFileIntent(target.value.node.id),
    });
    dispatchFileOperation({ type: "clear" });
  };
  const saveEditor = () => {
    const result = saveKonquerorTextFile(vfs.state, editorState, vfs, commandEnvironment);

    if (!result.ok) {
      dispatchEditor({
        type: "set-save-error",
        error: result.error,
      });
      return;
    }

    const savedPath = getVfsPathForNode(vfs.state, result.value.nodeId);

    closeEditor();
    dispatchNavigation({
      type: "mutation-success",
      path: savedPath.ok ? savedPath.value : currentPath,
      selectedNodeIds: [],
    });
    dispatchFileOperation({ type: "clear" });
  };
  const submitCommandDialog = () => {
    const beforeState = vfs.state;
    const undoKind: VfsFileOperationUndoKind | null = commandDialogState.kind === "rename"
      ? "rename"
      : commandDialogState.kind === "new-folder" || commandDialogState.kind === "new-text-file"
      ? "create"
      : null;
    const preserveSelection = commandDialogState.kind === "new-folder" && commandDialogState.preserveSelection;
    const result = submitKonquerorCommand(beforeState, commandDialogState, vfs, commandEnvironment, currentPath);

    if (!result.ok) {
      dispatchCommandDialog({
        type: "set-error",
        error: result.error,
      });
      return;
    }

    if (undoKind) {
      recordFileUndoOperation(undoKind, beforeState, [result.value.nodeId]);
    }

    const currentNodeId = getCurrentKonquerorNodeId(navigationState);
    const isCurrentNodeRename = result.value.kind === "renamed" && result.value.nodeId === currentNodeId;
    const isDirectorySelection = view.type === "directory";

    closeCommandDialog();
    if (!preserveSelection) {
      dispatchNavigation({
        type: "mutation-success",
        path: isCurrentNodeRename ? result.value.renamedPath : result.value.currentPath,
        selectedNodeIds: isDirectorySelection ? [result.value.nodeId] : [],
      });
    }
    dispatchFileOperation({ type: "clear" });
  };
  const getOperationLabel = useCallback((nodeIds: readonly VfsNodeId[]) => {
    if (nodeIds.length !== 1) {
      return `${nodeIds.length} selected items`;
    }
    return vfs.state.nodesById[nodeIds[0] ?? ""]?.name ?? "selected item";
  }, [vfs.state.nodesById]);
  const activateItemDrag = (rawDraggedNodeIds: readonly VfsNodeId[]): KonquerorDragOperationPlan | null => {
    if (isNavigationBlocked || view.type !== "directory") {
      return null;
    }
    const plan = buildKonquerorDragOperationPlan(vfs.state, rawDraggedNodeIds);
    if (!plan.ok || plan.value.operationRootNodeIds.length === 0) {
      if (!plan.ok) dispatchFileOperation({ type: "set-error", error: plan.error, errorContext: "drag-drop" });
      return null;
    }
    return plan.value;
  };
  const openDropActionRequest = (
    plan: KonquerorDragOperationPlan,
    targetFolderNodeId: VfsNodeId,
    clientX: number,
    clientY: number,
  ) => {
    setDropActionRequest({
      ...plan,
      requestId: nextDropActionRequestId.current++,
      ownerWindowId: windowId ?? "konqueror-unmanaged",
      targetWindowId: windowId ?? "konqueror-unmanaged",
      targetFolderNodeId,
      clientX: toLogicalCoordinate(clientX),
      clientY: toLogicalCoordinate(clientY),
    });
  };
  const dismissDropActionRequest = () => setDropActionRequest(null);
  const executeDropActionRequest = useCallback((request: KonquerorDropActionRequest, action: Exclude<KonquerorDropAction, "cancel">) => {
    const beforeState = vfs.state;
    const result = executeKonquerorDropAction(beforeState, request, action, vfs, commandEnvironment);
    if (!result.ok) {
      dispatchFileOperation({ type: "set-error", error: result.error, errorContext: "drag-drop" });
      return;
    }
    recordFileUndoOperation(result.operation, beforeState, result.nodeIds);
    dispatchFileOperation({ type: "set-status", statusMessage: result.statusMessage });
  }, [commandEnvironment, recordFileUndoOperation, vfs]);
  const executeDropAction = (action: KonquerorDropAction) => {
    const request = dropActionRequest;
    setDropActionRequest(null);
    if (!request || action === "cancel") return;
    executeDropActionRequest(request, action);
  };
  const getClipboardAvailabilityForTargets = (
    targetNodeIds: readonly VfsNodeId[],
    currentFileNodeId?: VfsNodeId,
  ) => getKonquerorClipboardAvailability({
    state: vfs.state,
    view,
    selectedNodeIds: targetNodeIds,
    visibleNodeIds: activeResourceVisibleNodeIds,
    clipboardState,
    isEditing,
    isCommandDialogOpen,
    isConfirmationOpen,
    isPropertiesOpen,
    currentFileNodeId,
  });
  const copySelectedNode = (
    targetNodeIds: readonly VfsNodeId[] = selectedNodeIdsInVisibleOrder,
    currentFileNodeId?: VfsNodeId,
  ) => {
    if (!getClipboardAvailabilityForTargets(targetNodeIds, currentFileNodeId).canCopy || targetNodeIds.length === 0) {
      return;
    }

    const plan = buildKonquerorClipboardEntryPlan(vfs.state, targetNodeIds);
    if (!plan.ok || plan.value.entries.length === 0) {
      if (!plan.ok) {
        dispatchFileOperation({ type: "set-error", error: plan.error });
      }
      return;
    }

    dispatchClipboard({
      type: "copy",
      entries: plan.value.entries,
      displayNodeIds: plan.value.displayNodeIds,
    });
    const mirrorUri = plan.value.entries.length === 1
      ? getKonquerorClipboardMirrorUri(vfs.state, plan.value.entries[0]?.nodeId ?? "")
      : null;
    if (mirrorUri) {
      desktopSession?.recordClipboardText(mirrorUri);
    }
    dispatchFileOperation({
      type: "set-status",
      statusMessage: `Copied: ${getOperationLabel(targetNodeIds)}`,
    });
  };
  const cutSelectedNode = (
    targetNodeIds: readonly VfsNodeId[] = selectedNodeIdsInVisibleOrder,
    currentFileNodeId?: VfsNodeId,
  ) => {
    if (!getClipboardAvailabilityForTargets(targetNodeIds, currentFileNodeId).canCut || targetNodeIds.length === 0) {
      return;
    }

    const plan = buildKonquerorClipboardEntryPlan(vfs.state, targetNodeIds);
    if (!plan.ok || plan.value.entries.length === 0) {
      if (!plan.ok) {
        dispatchFileOperation({ type: "set-error", error: plan.error });
      }
      return;
    }

    dispatchClipboard({
      type: "cut",
      entries: plan.value.entries,
      displayNodeIds: plan.value.displayNodeIds,
    });
    const mirrorUri = plan.value.entries.length === 1
      ? getKonquerorClipboardMirrorUri(vfs.state, plan.value.entries[0]?.nodeId ?? "")
      : null;
    if (mirrorUri) {
      desktopSession?.recordClipboardText(mirrorUri);
    }
    dispatchFileOperation({
      type: "set-status",
      statusMessage: `Ready to move: ${getOperationLabel(targetNodeIds)}`,
    });
  };
  const pasteClipboard = () => {
    if (!clipboardAvailability.canPaste || view.type !== "directory") {
      return;
    }

    const beforeState = vfs.state;
    const result = pasteKonquerorClipboardItems(beforeState, clipboardState, view.node.id, vfs, commandEnvironment);

    if (!result.ok) {
      if (result.shouldClearClipboard) {
        dispatchClipboard({ type: "clear" });
      }

      dispatchFileOperation({
        type: "set-error",
        error: result.error,
      });
      return;
    }

    recordFileUndoOperation(clipboardState.kind === "items" && clipboardState.mode === "copy" ? "copy" : "move", beforeState, result.selectedNodeIds);

    if (result.shouldClearClipboard) {
      dispatchClipboard({ type: "clear" });
    }

    dispatchNavigation({
      type: "mutation-success",
      path: currentPath,
      selectedNodeIds: result.selectedNodeIds,
    });
    dispatchFileOperation({
      type: "set-status",
      statusMessage: result.statusMessage,
    });
  };
  const openMoveToTrashConfirmation = useCallback((
    targetNodeIds: readonly VfsNodeId[] = selectedNodeIdsInVisibleOrder,
    fromDragDrop = false,
  ) => {
    if (targetNodeIds.length === 0 || (!fromDragDrop && !clipboardAvailability.canMoveToTrash) || (fromDragDrop && (isNavigationBlocked || view.type !== "directory"))) {
      return;
    }

    let operationRootNodeIds: readonly VfsNodeId[];
    if (fromDragDrop) {
      const dragPlan = buildKonquerorDragOperationPlan(vfs.state, targetNodeIds);
      if (!dragPlan.ok) {
        dispatchFileOperation({ type: "set-error", error: dragPlan.error, errorContext: "move-to-trash" });
        return;
      }
      operationRootNodeIds = dragPlan.value.operationRootNodeIds;
    } else {
      const operationRoots = normalizeKonquerorRecursiveOperationTargets(vfs.state, targetNodeIds);
      if (!operationRoots.ok) {
        dispatchFileOperation({ type: "set-error", error: operationRoots.error, errorContext: "move-to-trash" });
        return;
      }
      operationRootNodeIds = operationRoots.value;
    }
    if (operationRootNodeIds.length === 0) return;

    closeCommandDialog();
    dispatchConfirmation({
      type: "open-move-to-trash",
      targetNodeIds,
      operationRootNodeIds,
      targetLabel: getOperationLabel(targetNodeIds),
      preserveClipboard: fromDragDrop,
    });
    dispatchFileOperation({ type: "clear" });
  }, [clipboardAvailability.canMoveToTrash, closeCommandDialog, getOperationLabel, isNavigationBlocked, selectedNodeIdsInVisibleOrder, vfs.state, view.type]);
  const dragDropExecutor = useMemo(() => ({
    executeDropAction: executeDropActionRequest,
    openMoveToTrash: (rawDraggedNodeIds: readonly VfsNodeId[]) => openMoveToTrashConfirmation(rawDraggedNodeIds, true),
  }), [executeDropActionRequest, openMoveToTrashConfirmation]);
  useEffect(() => {
    if (!registerDragDropExecutor || !windowId) return;
    return registerDragDropExecutor(windowId, dragDropExecutor);
  }, [dragDropExecutor, registerDragDropExecutor, windowId]);
  const submitMoveToTrash = () => {
    const beforeState = vfs.state;
    const result = submitKonquerorMoveToTrash(beforeState, confirmationState, clipboardState, vfs, commandEnvironment);

    if (!result.ok) {
      dispatchConfirmation({
        type: "set-error",
        error: result.error,
      });
      return;
    }

    recordFileUndoOperation("trash", beforeState, result.trashedNodeIds);

    if (result.shouldClearClipboard && confirmationState.kind === "move-to-trash" && !confirmationState.preserveClipboard) {
      dispatchClipboard({ type: "clear" });
    }

    closeConfirmation();
    dispatchNavigation({
      type: "mutation-success",
      path: currentPath,
      selectedNodeIds: [],
    });
    dispatchFileOperation({
      type: "set-status",
      statusMessage: result.statusMessage,
    });
  };
  const restoreTrashEntry = () => {
    if (!trashCommandAvailability.canRestore) {
      return;
    }

    const result = restoreKonquerorTrashEntries(
      vfs.state,
      trashCommandAvailability.selectedTrashEntryNodeIds,
      vfs,
      commandEnvironment,
    );

    if (!result.ok) {
      dispatchFileOperation({ type: "set-error", error: result.error, errorContext: "trash" });
      return;
    }

    dispatchNavigation({
      type: "mutation-success",
      path: currentPath,
      selectedNodeIds: [],
    });
    dispatchFileOperation({
      type: "set-status",
      statusMessage: result.statusMessage,
    });
  };
  const openDeletePermanentlyConfirmation = () => {
    if (
      !trashCommandAvailability.canDeletePermanently ||
      trashCommandAvailability.selectedTrashEntryNodeIds.length === 0
    ) {
      return;
    }

    dispatchConfirmation({
      type: "open-delete-permanently",
      targetNodeIds: trashCommandAvailability.selectedTrashEntryNodeIds,
      targetLabel: getOperationLabel(trashCommandAvailability.selectedTrashEntryNodeIds),
    });
    dispatchFileOperation({ type: "clear" });
  };
  const openEmptyTrashConfirmation = () => {
    if (!trashCommandAvailability.canEmptyTrash) {
      return;
    }

    dispatchConfirmation({ type: "open-empty-trash" });
    dispatchFileOperation({ type: "clear" });
  };
  const pruneDeletedHistory = useCallback((deletedNodeIds: readonly VfsNodeId[]) => {
    const homePath = getVfsPathForNode(vfs.state, vfs.state.specialLocations.home);

    dispatchNavigation({
      type: "prune-deleted-history",
      deletedNodeIds,
      fallbackNodeId: vfs.state.specialLocations.home,
      fallbackPath: homePath.ok ? homePath.value : "/home/user",
    });
  }, [dispatchNavigation, vfs.state]);
  const submitDeletePermanently = () => {
    const result = deleteKonquerorTrashEntriesPermanently(
      vfs.state,
      confirmationState,
      clipboardState,
      vfs,
      commandEnvironment,
    );

    if (!result.ok) {
      dispatchConfirmation({ type: "set-error", error: result.error });
      return;
    }

    if (result.shouldClearClipboard) {
      dispatchClipboard({ type: "clear" });
    }

    closeConfirmation();
    pruneDeletedHistory(result.deletedNodeIds);
    dispatchFileOperation({
      type: "set-status",
      statusMessage: result.statusMessage,
    });
  };
  const submitEmptyTrash = () => {
    const result = emptyKonquerorTrash(vfs.state, clipboardState, vfs, commandEnvironment);

    if (!result.ok) {
      dispatchConfirmation({ type: "set-error", error: result.error });
      return;
    }

    if (result.shouldClearClipboard) {
      dispatchClipboard({ type: "clear" });
    }

    closeConfirmation();
    pruneDeletedHistory(result.deletedNodeIds);
    dispatchFileOperation({
      type: "set-status",
      statusMessage: result.statusMessage,
    });
  };
  const submitConfirmation = () => {
    if (confirmationState.kind === "move-to-trash") {
      submitMoveToTrash();
      return;
    }

    if (confirmationState.kind === "delete-permanently") {
      submitDeletePermanently();
      return;
    }

    if (confirmationState.kind === "empty-trash") {
      submitEmptyTrash();
    }
  };
  const openItemContextMenu = (nodeId: VfsNodeId, clientX: number, clientY: number) => {
    if (isNavigationBlocked || view.type !== "directory" || !activeResourceVisibleNodeIds.includes(nodeId)) {
      return;
    }

    dismissApplicationMenu();
    dismissDropActionRequest();
    const targetNodeIds = isKonquerorNodeSelected(navigationState.selectedNodeIds, nodeId)
      ? getKonquerorSelectedNodeIdsInVisibleOrder(
          navigationState.selectedNodeIds,
          activeResourceVisibleNodeIds,
        )
      : [nodeId];
    if (!isKonquerorNodeSelected(navigationState.selectedNodeIds, nodeId)) {
      dispatchNavigation({ type: "replace-selection", nodeId });
    }
    setContextMenuState({
      kind: "item",
      requestId: nextContextMenuRequestId.current++,
      clickedNodeId: nodeId,
      targetNodeIds,
      clientX: toLogicalCoordinate(clientX),
      clientY: toLogicalCoordinate(clientY),
    });
  };
  const openBackgroundContextMenu = (clientX: number, clientY: number) => {
    if (isNavigationBlocked || view.type !== "directory") {
      return;
    }

    dismissApplicationMenu();
    dispatchNavigation({ type: "clear-selection" });
    setContextMenuState({
      kind: "background",
      requestId: nextContextMenuRequestId.current++,
      directoryNodeId: view.node.id,
      clientX: toLogicalCoordinate(clientX),
      clientY: toLogicalCoordinate(clientY),
    });
  };
  const openPreviewContextMenu = (clientX: number, clientY: number) => {
    if (isNavigationBlocked || view.type !== "file") {
      return;
    }

    dismissApplicationMenu();
    setContextMenuState({ kind: "preview", requestId: nextContextMenuRequestId.current++, nodeId: view.node.id, clientX: toLogicalCoordinate(clientX), clientY: toLogicalCoordinate(clientY) });
  };
  const contextMenuTarget =
    contextMenuState?.kind === "item"
      ? getVfsNodeById(vfs.state, contextMenuState.clickedNodeId)
      : contextMenuState?.kind === "preview"
      ? getVfsNodeById(vfs.state, contextMenuState.nodeId)
      : null;
  const contextMenuPreviewNode = useMemo(() => {
    if (!contextMenuTarget?.ok) return null;
    if (contextMenuTarget.value.kind === "file") return contextMenuTarget.value;
    if (contextMenuTarget.value.kind !== "link") return null;
    const resolved = resolveVfsLinkTarget(vfs.state, contextMenuTarget.value.id);
    return resolved.ok && resolved.value.node.kind === "file" ? resolved.value.node : null;
  }, [contextMenuTarget, vfs.state]);
  const contextMenuEntries = useMemo(() => {
    if (contextMenuState === null) {
      return [];
    }

    if (contextMenuState.kind === "preview") {
      return view.type === "file" && view.node.id === contextMenuState.nodeId && currentPreviewerId !== null
        ? getKonquerorPreviewContextMenuEntries({
            canCopyTo: previewDirectTransferAvailability.canTransfer,
            copyToTitle: previewDirectTransferAvailability.canTransfer
              ? "Copy current file to another location"
              : previewDirectTransferAvailability.title,
            canMoveTo: previewDirectTransferAvailability.canTransfer,
            moveToTitle: previewDirectTransferAvailability.canTransfer
              ? "Move current file to another location"
              : previewDirectTransferAvailability.title,
          })
        : [];
    }

    if (view.type !== "directory") {
      return [];
    }

    const availability = {
      canEdit,
      editTitle,
      canRename,
      renameTitle: isTrashView ? "Items in the Trash are read-only" : commandAvailability.renameDisabledTitle || "Rename",
      canCut: clipboardAvailability.canCut,
      cutTitle: clipboardAvailability.cutTitle,
      canCopy: clipboardAvailability.canCopy,
      copyTitle: clipboardAvailability.copyTitle,
      canPaste: clipboardAvailability.canPaste,
      pasteTitle: clipboardAvailability.pasteTitle,
      canMoveToTrash: clipboardAvailability.canMoveToTrash,
      moveToTrashTitle: clipboardAvailability.moveToTrashTitle,
      canRestore: trashCommandAvailability.canRestore,
      restoreTitle: trashCommandAvailability.restoreTitle,
      canDeletePermanently: trashCommandAvailability.canDeletePermanently,
      deletePermanentlyTitle: trashCommandAvailability.deletePermanentlyTitle,
      canEmptyTrash: trashCommandAvailability.canEmptyTrash,
      emptyTrashTitle: trashCommandAvailability.emptyTrashTitle,
      canCreateNewFolder,
      createNewFolderTitle: commandAvailability.createDisabledTitle || "Create New Folder",
      canCreateNewTextFile,
      createNewTextFileTitle: commandAvailability.createDisabledTitle || "Create New Text File",
      canGoBack,
      backTitle: canGoBack ? "Back" : navigationDisabledTitle ?? "No previous location",
      canGoForward,
      forwardTitle: canGoForward ? "Forward" : navigationDisabledTitle ?? "No forward location",
      canGoUp,
      upTitle: canGoUp ? "Up" : navigationDisabledTitle ?? "Already at Home",
      canShowCurrentDirectoryProperties: !isNavigationBlocked,
      currentDirectoryPropertiesTitle: isNavigationBlocked ? navigationDisabledTitle ?? "Finish the current operation first" : "Properties",
      canCopyTo: contextMenuState.kind === "item"
        ? contextItemDirectTransferAvailability.canTransfer
        : backgroundDirectTransferAvailability.canTransfer,
      copyToTitle: contextMenuState.kind === "item"
        ? contextItemDirectTransferAvailability.canTransfer
          ? "Copy clicked file to another location"
          : contextItemDirectTransferAvailability.title
        : backgroundDirectTransferAvailability.canTransfer ? "Copy current folder to another location" : backgroundDirectTransferAvailability.title,
      canMoveTo: contextMenuState.kind === "item"
        ? contextItemDirectTransferAvailability.canTransfer
        : backgroundDirectTransferAvailability.canTransfer,
      moveToTitle: contextMenuState.kind === "item"
        ? contextItemDirectTransferAvailability.canTransfer
          ? "Move clicked file to another location"
          : contextItemDirectTransferAvailability.title
        : backgroundDirectTransferAvailability.canTransfer ? "Move current folder to another location" : backgroundDirectTransferAvailability.title,
    };

    if (contextMenuState.kind === "background") {
      return getKonquerorBackgroundContextMenuEntries(isTrashRoot, availability, !isTrashView);
    }

    const createChildAvailability = contextMenuTarget?.ok && contextMenuState.kind === "item"
      ? getKonquerorCreateChildAvailability(vfs.state, contextMenuState.clickedNodeId)
      : null;

    return contextMenuTarget?.ok
      ? getKonquerorItemContextMenuEntries(
          isTrashRoot,
          contextMenuTarget.value,
          availability,
          createChildAvailability?.canCreateChild ?? false,
          contextMenuPreviewNode ?? undefined,
          !isTrashView,
        )
      : [];
  }, [
    clipboardAvailability,
    canEdit,
    commandAvailability,
    canCreateNewFolder,
    canCreateNewTextFile,
    canGoBack,
    canGoForward,
    canGoUp,
    backgroundDirectTransferAvailability,
    contextItemDirectTransferAvailability,
    previewDirectTransferAvailability,
    canRename,
    contextMenuState,
    contextMenuTarget,
    contextMenuPreviewNode,
    currentPreviewerId,
    editTitle,
    isTrashRoot,
    isTrashView,
    isNavigationBlocked,
    navigationDisabledTitle,
    trashCommandAvailability,
    vfs.state,
    view,
  ]);
  const executeContextMenuAction = (action: KonquerorContextMenuAction) => {
    const target = contextMenuState;
    dismissContextMenu();

    if (!target) {
      return;
    }

    switch (action) {
      case "open":
        if (target.kind === "item") {
          activateNode(target.clickedNodeId);
        } else if (target.kind === "preview") {
          navigateToFileNodeId(target.nodeId, currentPreviewerId ?? undefined);
        }
        return;
      case "open-in-new-window":
        if (target.kind === "item") {
          openNodesInNewWindows(target.targetNodeIds);
        } else if (target.kind === "preview") {
          openNodesInNewWindows([target.nodeId], currentPreviewerId ?? undefined);
        }
        return;
      case "open-in-new-tab":
        if (target.kind === "item") {
          openNodeInNewTab(target.clickedNodeId);
        } else if (target.kind === "preview") {
          openNodeInNewTab(target.nodeId, currentPreviewerId ?? undefined);
        }
        return;
      case "open-with-kwrite":
        if (target.kind === "item" || target.kind === "preview") {
          openWithKWrite(target.kind === "item" ? target.clickedNodeId : target.nodeId);
        }
        return;
      case "preview-embedded-text":
        if (target.kind === "item" || target.kind === "preview") {
          navigateToFileNodeId(target.kind === "item" ? target.clickedNodeId : target.nodeId, "embedded-text");
        }
        return;
      case "preview-khtml":
        if (target.kind === "item" || target.kind === "preview") {
          navigateToFileNodeId(target.kind === "item" ? target.clickedNodeId : target.nodeId, "khtml");
        }
        return;
      case "preview-markdown":
        if (target.kind === "item" || target.kind === "preview") {
          navigateToFileNodeId(target.kind === "item" ? target.clickedNodeId : target.nodeId, "markdown");
        }
        return;
      case "rename":
        openRenameDialog();
        return;
      case "cut":
        cutSelectedNode(target.kind === "item" ? target.targetNodeIds : undefined);
        return;
      case "copy":
        copySelectedNode(target.kind === "item" ? target.targetNodeIds : undefined);
        return;
      case "paste":
        pasteClipboard();
        return;
      case "move-to-trash":
        if (target.kind === "item") {
          openMoveToTrashConfirmation(target.targetNodeIds);
        }
        return;
      case "restore":
        restoreTrashEntry();
        return;
      case "permanent-delete":
        openDeletePermanentlyConfirmation();
        return;
      case "empty-trash":
        openEmptyTrashConfirmation();
        return;
      case "properties":
        openProperties(target.kind === "background" ? target.directoryNodeId : undefined);
        return;
      case "new-folder":
        if (target.kind === "item") {
          openNewFolderDialog(target.clickedNodeId);
        } else if (target.kind === "background") {
          openNewFolderDialog();
        }
        return;
      case "new-text-file":
        openNewTextFileDialog();
        return;
      case "back":
        navigateToolbarBack();
        return;
      case "forward":
        navigateToolbarForward();
        return;
      case "up":
        navigateToolbarUp();
        return;
      case "copy-to":
        if (target.kind === "background") {
          openDirectTransferDialog("copy", [target.directoryNodeId], "current-directory");
        } else if (target.kind === "preview") {
          const file = getVfsNodeById(vfs.state, target.nodeId);
          if (file.ok && file.value.kind === "file" && file.value.parentId !== null) {
            openDirectTransferDialog("copy", [file.value.id], "current-file", file.value.parentId);
          }
        } else if (target.kind === "item") {
          const file = getVfsNodeById(vfs.state, target.clickedNodeId);
          if (file.ok && file.value.kind === "file" && file.value.parentId !== null) {
            openDirectTransferDialog("copy", [file.value.id], "context-item", file.value.parentId);
          }
        }
        return;
      case "move-to":
        if (target.kind === "background") {
          openDirectTransferDialog("move", [target.directoryNodeId], "current-directory");
        } else if (target.kind === "preview") {
          const file = getVfsNodeById(vfs.state, target.nodeId);
          if (file.ok && file.value.kind === "file" && file.value.parentId !== null) {
            openDirectTransferDialog("move", [file.value.id], "current-file", file.value.parentId);
          }
        } else if (target.kind === "item") {
          const file = getVfsNodeById(vfs.state, target.clickedNodeId);
          if (file.ok && file.value.kind === "file" && file.value.parentId !== null) {
            openDirectTransferDialog("move", [file.value.id], "context-item", file.value.parentId);
          }
        }
        return;
      case "open-terminal-here": {
        const directoryNodeId = target.kind === "item"
          ? target.clickedNodeId
          : target.kind === "background"
          ? target.directoryNodeId
          : null;
        if (directoryNodeId !== null) {
          openTerminalForDirectory(directoryNodeId);
        }
        return;
      }
      case "edit":
        return;
    }
  };
  const toggleApplicationMenu = (menu: KonquerorApplicationMenu) => {
    if (isNavigationBlocked) {
      return;
    }

    dismissContextMenu(false);
    const nextOpenMenu = toggleKonquerorApplicationMenu(openApplicationMenu?.menu ?? null, menu);
    setOpenApplicationMenu(nextOpenMenu === null ? null : {
      menu: nextOpenMenu,
      requestId: nextApplicationMenuRequestId.current++,
    });
    if (nextOpenMenu === null) {
      requestDirectoryFocus({ force: true });
    }
  };
  const executeApplicationMenuAction = (action: KonquerorApplicationMenuAction, parentFolderId: string | null = null, bookmarkId?: string) => {
    dismissApplicationMenu();

    const selectSortKey = (key: KonquerorSortKey) => {
      if (directoryViewState.sort.key !== key) {
        dispatchDirectoryView({ type: "select-sort-key", key });
      }
    };

    switch (action) {
      case "open-bookmark": {
        if (bookmarkId === undefined) {
          return;
        }

        const bookmark = getNode(bookmarkId);
        if (bookmark?.type === "bookmark" && navigateToLocation(bookmark.location)) {
          recordVisit(bookmark.id);
        }
        return;
      }
      case "play":
      case "pause":
      case "stop":
        mediaCommandHandlerRef.current?.(action);
        return;
      case "previous":
      case "next":
        navigateAdjacentMedia(action);
        return;
      case "add-bookmark":
        addCurrentTabBookmark(parentFolderId);
        return;
      case "new-bookmark-folder":
        if (!isNavigationBlocked) {
          dispatchBookmarkFolderDialog({ type: "open", parentFolderId });
        }
        return;
      case "bookmark-tabs-as-folder":
        if (!isNavigationBlocked && allTabBookmarkDrafts.length > 0) {
          dispatchBookmarkFolderDialog({
            type: "open-bookmark-tabs-as-folder",
            parentFolderId,
            bookmarkDraftsSnapshot: allTabBookmarkDrafts,
          });
        }
        return;
      case "edit-bookmarks":
        launchApplication("bookmark-editor");
        return;
      case "new-window":
        openNewKonquerorWindow();
        return;
      case "new-tab":
        createBlankTab();
        return;
      case "open-terminal":
        openTerminalForActiveTab();
        return;
      case "find-file":
        launchNewApplicationInstance("kfind");
        return;
      case "duplicate-current-tab":
        duplicateCurrentKonquerorTab();
        return;
      case "detach-current-tab":
        detachCurrentKonquerorTab();
        return;
      case "close-current-tab":
        closeCurrentKonquerorTab();
        return;
      case "print":
        printEmbeddedContent();
        break;
      case "new-folder":
        openNewFolderDialog();
        break;
      case "new-text-file":
        openNewTextFileDialog();
        break;
      case "properties":
        openProperties();
        break;
      case "close":
        onRequestClose();
        return;
      case "undo":
        if (!canUndoFileOperation) {
          return;
        }
        {
          const result = fileUndo.undo(commandEnvironment.now());
          if (!result.ok) {
            dispatchFileOperation({ type: "set-error", error: result.error });
          } else {
            dispatchFileOperation({ type: "set-status", statusMessage: "Undid the last file operation" });
          }
        }
        return;
      case "copy-files":
        openDirectTransferDialog("copy");
        return;
      case "move-files":
        openDirectTransferDialog("move");
        return;
      case "rename":
        openRenameDialog();
        break;
      case "cut":
        cutSelectedNode();
        break;
      case "copy":
        copySelectedNode();
        break;
      case "paste":
        pasteClipboard();
        break;
      case "move-to-trash":
        openMoveToTrashConfirmation();
        break;
      case "permanent-delete":
        openDeletePermanentlyConfirmation();
        break;
      case "view-tree":
        setResourceViewMode("tree");
        break;
      case "view-icons":
        setResourceViewMode("icons");
        break;
      case "sort-name":
        selectSortKey("name");
        break;
      case "sort-size":
        selectSortKey("size");
        break;
      case "sort-type":
        selectSortKey("type");
        break;
      case "sort-modified":
        selectSortKey("modified");
        break;
      case "toggle-sort-direction":
        dispatchDirectoryView({ type: "toggle-sort-direction" });
        break;
      case "toggle-main-toolbar":
        setShowMainToolbar((visible) => !visible);
        return;
      case "toggle-location-toolbar":
        if (showLocationToolbar) {
          setIsLocationEditing(false);
          resetLocationDraft();
        }
        setShowLocationToolbar((visible) => !visible);
        return;
      case "back":
        navigateHistory("back");
        break;
      case "forward":
        navigateHistory("forward");
        break;
      case "up":
        navigateUp();
        break;
      case "home":
        navigateHome();
        break;
      case "about-konqueror":
        launchApplication("about-konqueror");
        return;
      case "about-kde":
        launchApplication("about-kde");
        return;
    }

    requestDirectoryFocus({ force: true });
  };
  const applicationMenuAvailability = {
    canUndo: canUndoFileOperation,
    undoTitle: undoFileOperationTitle,
    canPrint: embeddedContentCapabilities.canPrint && konquerorPrint !== null,
    printTitle: embeddedContentCapabilities.canPrint && konquerorPrint !== null
      ? "Print"
      : "Print is unavailable for this content",
    canCreateNewFolder,
    createNewFolderTitle: commandAvailability.createDisabledTitle || "Create New Folder",
    canCreateNewTextFile,
    createNewTextFileTitle: commandAvailability.createDisabledTitle || "Create New Text File",
    canOpen,
    openTitle: canOpen ? "Open" : "Select a file or folder first",
    canEdit,
    editTitle,
    canShowProperties,
    propertiesTitle: canShowProperties ? "Properties" : "Select a file or folder first",
    canRename,
    renameTitle: isTrashView ? "Items in the Trash are read-only" : commandAvailability.renameDisabledTitle || "Rename",
    canCut: clipboardAvailability.canCut,
    cutTitle: clipboardAvailability.cutTitle,
    canCopy: clipboardAvailability.canCopy,
    copyTitle: clipboardAvailability.copyTitle,
    canPaste: clipboardAvailability.canPaste,
    pasteTitle: clipboardAvailability.pasteTitle,
    canCopyFiles: directTransferAvailability.canTransfer,
    copyFilesTitle: directTransferAvailability.canTransfer ? "Copy Files" : directTransferAvailability.title,
    canMoveFiles: directTransferAvailability.canTransfer,
    moveFilesTitle: directTransferAvailability.canTransfer ? "Move Files" : directTransferAvailability.title,
    canMoveToTrash: clipboardAvailability.canMoveToTrash,
    moveToTrashTitle: clipboardAvailability.moveToTrashTitle,
    canRestore: trashCommandAvailability.canRestore,
    restoreTitle: trashCommandAvailability.restoreTitle,
    canDeletePermanently: trashCommandAvailability.canDeletePermanently,
    deletePermanentlyTitle: trashCommandAvailability.deletePermanentlyTitle,
    canEmptyTrash: trashCommandAvailability.canEmptyTrash,
    emptyTrashTitle: trashCommandAvailability.emptyTrashTitle,
    canGoBack,
    backTitle: canGoBack ? "Back" : navigationDisabledTitle ?? "No previous location",
    canGoForward,
    forwardTitle: canGoForward ? "Forward" : navigationDisabledTitle ?? "No forward location",
    canGoUp,
    upTitle: canGoUp ? "Up" : navigationDisabledTitle ?? (view.type === "external-web" ? "Already at site root" : "Already at Home"),
    canGoHome,
    homeTitle: canGoHome ? "Home" : navigationDisabledTitle ?? (view.type === "about-konqueror" ? "Already at Start Page" : "Already at Home"),
    viewControlsDisabled,
    canOpenTerminal: !isNavigationBlocked && activeTabTerminalPlan?.ok === true,
    openTerminalTitle: activeTabTerminalPlan?.ok
      ? "Open Terminal"
      : "Open Terminal is available only for an ordinary filesystem directory",
    canDetachCurrentTab: !isNavigationBlocked && tabState.tabs.length >= 2,
    canCloseCurrentTab: !isNavigationBlocked && tabState.tabs.length >= 2,
    canAddBookmark: !isNavigationBlocked && activeBookmarkDraft !== null,
    addBookmarkTitle: activeBookmarkDraft !== null ? "Add Bookmark" : "The current tab has no bookmarkable location",
    canCreateBookmarkFolder: !isNavigationBlocked,
    createBookmarkFolderTitle: isNavigationBlocked ? "Finish the current operation first" : "New Bookmark Folder",
    canBookmarkTabsAsFolder: !isNavigationBlocked && allTabBookmarkDrafts.length > 0,
    bookmarkTabsAsFolderTitle: allTabBookmarkDrafts.length > 0
      ? "Bookmark Tabs as Folder"
      : "No bookmarkable tabs are available",
    canEditBookmarks: true,
    editBookmarksTitle: "Edit Bookmarks",
    canMediaPlay: mediaCommandAvailability.play,
    canMediaPause: mediaCommandAvailability.pause,
    canMediaStop: mediaCommandAvailability.stop,
    canMediaPrevious: mediaCommandAvailability.previous,
    canMediaNext: mediaCommandAvailability.next,
    isMainToolbarVisible: showMainToolbar,
    isLocationToolbarVisible: showLocationToolbar,
  };
  const applicationMenuEntries = openApplicationMenu === null
    ? []
    : getKonquerorApplicationMenuEntries(
      openApplicationMenu.menu,
      applicationMenuAvailability,
      directoryViewState.viewMode,
      directoryViewState.sort,
      bookmarks.rootChildren,
    );
  useEffect(() => {
    if (!launchRequest || launchRequest.requestId === lastHandledLaunchRequestIdRef.current) {
      return;
    }

    lastHandledLaunchRequestIdRef.current = launchRequest.requestId;

    if (!isKonquerorOpenLocationIntent(launchRequest.intent) && !isKonquerorOpenDirectoryIntent(launchRequest.intent) && !isKonquerorOpenFileIntent(launchRequest.intent) && !isKonquerorOpenSysinfoIntent(launchRequest.intent) && !isKonquerorOpenStartIntent(launchRequest.intent) && !isKonquerorDetachTabIntent(launchRequest.intent)) {
      return;
    }

    if (isKonquerorDetachTabIntent(launchRequest.intent)) {
      return;
    }

    if (isEditing) {
      dispatchFileOperation({
        type: "set-blocked-launch",
        message: "Save or discard changes before opening the requested location.",
      });
      return;
    }

    if (isCommandDialogOpen || isBookmarkFolderDialogOpen || isDirectTransferDialogOpen || isConfirmationOpen || isPropertiesOpen) {
      dispatchFileOperation({
        type: "set-blocked-launch",
        message: "Finish or cancel the current operation before opening the requested location.",
      });
      return;
    }

    if (isKonquerorOpenSysinfoIntent(launchRequest.intent)) {
      clearExternalWebLoad();
      dispatchNavigation({ type: "navigate-success", target: { type: "sysinfo" }, path: KONQUEROR_SYSINFO_LOCATION });
      dismissApplicationMenu();
      dismissContextMenu();
      dispatchFileOperation({ type: "clear" });
      requestContentFocus();
      return;
    }

    if (isKonquerorOpenStartIntent(launchRequest.intent)) {
      clearExternalWebLoad();
      dispatchNavigation({
        type: "navigate-success",
        target: createKonquerorAboutLocationTarget("blank"),
        path: KONQUEROR_ABOUT_LOCATION,
      });
      dismissApplicationMenu();
      dismissContextMenu();
      dispatchFileOperation({ type: "clear" });
      requestLocationInputFocus();
      return;
    }

    if (isKonquerorOpenFileIntent(launchRequest.intent)) {
      const target = resolveKonquerorTextFileNodeId(vfs.state, launchRequest.intent.nodeId);

      if (!target.ok) {
        dispatchNavigation({
          type: "navigate-failure",
          locationDraft: navigationState.locationDraft,
          error: target.error,
        });
        return;
      }

      clearExternalWebLoad();
      dispatchNavigation({
        type: "navigate-success",
        target: {
          type: "file",
          nodeId: target.value.node.id,
          previewerId: resolveKonquerorPreviewer(target.value.node, launchRequest.intent.previewerId),
        },
        path: target.value.path,
      });
      dismissApplicationMenu();
      dismissContextMenu();
      dispatchFileOperation({ type: "clear" });
      requestContentFocus();
      return;
    }

    const nodeId = isKonquerorOpenDirectoryIntent(launchRequest.intent)
      ? launchRequest.intent.nodeId
      : getSpecialLocationNodeId(vfs.state.specialLocations, launchRequest.intent.location);
    const target = resolveKonquerorDirectoryNodeId(vfs.state, nodeId);

    if (!target.ok) {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: target.error,
      });
      return;
    }

    if (target.value.node.kind !== "directory") {
      dispatchNavigation({
        type: "navigate-failure",
        locationDraft: navigationState.locationDraft,
        error: { code: "NOT_DIRECTORY", message: "Requested location is not a directory." },
      });
      return;
    }

    clearExternalWebLoad();
    dispatchNavigation({
      type: "navigate-success",
      target: { type: "directory", nodeId: target.value.node.id },
      path: target.value.path,
    });
    dismissApplicationMenu();
    dismissContextMenu();
    dispatchFileOperation({ type: "clear" });
  }, [
    isCommandDialogOpen,
    isBookmarkFolderDialogOpen,
    isDirectTransferDialogOpen,
    isConfirmationOpen,
    isPropertiesOpen,
    isEditing,
    launchRequest,
    navigationState.locationDraft,
    clearExternalWebLoad,
    dispatchNavigation,
    dismissApplicationMenu,
    dismissContextMenu,
    requestContentFocus,
    requestLocationInputFocus,
    vfs.state,
  ]);
  useEffect(() => {
    if (view.type !== "file" || currentPreviewerId === null || currentLocationTarget?.type !== "file") {
      return;
    }
    if (currentLocationTarget.previewerId !== currentPreviewerId) {
      dispatchNavigation({
        type: "navigate-success",
        target: { type: "file", nodeId: view.node.id, previewerId: currentPreviewerId },
        path: view.path,
      });
    }
  }, [currentLocationTarget, currentPreviewerId, dispatchNavigation, view]);
  useEffect(() => {
    const currentTarget = getCurrentKonquerorLocationTarget(navigationState);
    const missingHistoryNodeIds = getKonquerorHistoryTargets(navigationState).flatMap((target) => {
      if (
        target.type === "sysinfo" ||
        target.type === "about-konqueror" ||
        target.type === "about-blank" ||
        target.type === "external-web" ||
        getVfsNodeById(vfs.state, target.nodeId).ok
      ) {
        return [];
      }

      // Keep an invalid current file target visible long enough for Back to return to
      // its prior directory. Once navigation leaves it, normal history pruning applies.
      return target.type === "file" && target === currentTarget ? [] : [target.nodeId];
    });

    if (missingHistoryNodeIds.length > 0) {
      const currentNodeId = getCurrentKonquerorNodeId(navigationState);
      const currentWasDeleted = currentNodeId !== null && missingHistoryNodeIds.includes(currentNodeId);

      pruneDeletedHistory(missingHistoryNodeIds);

      if (currentWasDeleted) {
        dispatchFileOperation({
          type: "set-status",
          statusMessage: "Current folder is no longer available; returned to Home.",
        });
      }

      return;
    }

    if (isLocationEditing) {
      return;
    }

    if (view.type === "file-unavailable") {
      if (navigationState.locationDraft !== "Unavailable") {
        dispatchNavigation({ type: "reset-location-draft", path: "Unavailable" });
      }
      return;
    }

    const canonicalPath = getKonquerorCurrentPath(vfs.state, navigationState);

    if (canonicalPath.ok) {
      const presentedPath = getKonquerorLocationDraft(currentTarget, canonicalPath.value);

      if (presentedPath !== navigationState.locationDraft) {
        dispatchNavigation({ type: "reset-location-draft", path: canonicalPath.value });
      }
    }
  }, [dispatchNavigation, isLocationEditing, navigationState, pruneDeletedHistory, vfs.state, view.type]);
  useEffect(() => {
    if (
      view.type === "directory" &&
      (navigationState.selectedNodeIds.length > 0 || navigationState.rangeAnchorNodeId !== null)
    ) {
      dispatchNavigation({
        type: "retain-selection",
        visibleNodeIds: activeResourceVisibleNodeIds,
      });
    }
  }, [activeResourceVisibleNodeIds, dispatchNavigation, navigationState.rangeAnchorNodeId, navigationState.selectedNodeIds, view.type]);
  useEffect(() => {
    dispatchDirectoryView({
      type: "retain-tree-expansion",
      directoryNodeIds: getKonquerorExpandableTreeNodeIds(vfs.state),
    });
  }, [dispatchDirectoryView, vfs.state]);
  useEffect(() => {
    if (contextMenuState === null) {
      return;
    }

    if (contextMenuState.kind === "preview") {
      if (view.type !== "file" || view.node.id !== contextMenuState.nodeId) {
        dismissContextMenu();
      }
      return;
    }

    if (view.type !== "directory") {
      dismissContextMenu();
      return;
    }

    const targetIsCurrent =
      contextMenuState.kind === "background"
        ? contextMenuState.directoryNodeId === view.node.id
        : activeResourceVisibleNodeIds.includes(contextMenuState.clickedNodeId);

    if (!targetIsCurrent) {
      dismissContextMenu();
    }
  }, [activeResourceVisibleNodeIds, contextMenuState, dismissContextMenu, view]);
  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }

    const isTextInput = isTextEditingTarget(event.target);

    if (confirmationState.kind !== "closed") {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation();
      }
      return;
    }

    if (isContextMenuOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissContextMenu();
      }
      return;
    }

    if (isPropertiesOpen) {
      return;
    }

    if (isEditing) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveEditor();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        if (editorState.kind === "editing" && editorState.saveError) {
          dispatchEditor({ type: "clear-save-error" });
          return;
        }

        if (!isKonquerorEditorDirty(editorState)) {
          closeEditor();
        }
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
      }

      return;
    }

    if (isTextInput) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && clipboardAvailability.canCopy) {
      event.preventDefault();
      copySelectedNode();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x" && clipboardAvailability.canCut) {
      event.preventDefault();
      cutSelectedNode();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && clipboardAvailability.canPaste) {
      event.preventDefault();
      pasteClipboard();
      return;
    }

    if (event.key === "Delete" && event.shiftKey && trashCommandAvailability.canDeletePermanently) {
      event.preventDefault();
      openDeletePermanentlyConfirmation();
      return;
    }

    if (event.key === "Delete" && !event.shiftKey && clipboardAvailability.canMoveToTrash) {
      event.preventDefault();
      openMoveToTrashConfirmation();
      return;
    }

    if (event.key === "Escape" && (operationError || fileOperationState.blockedLaunchMessage)) {
      event.preventDefault();
      dispatchFileOperation({ type: "clear" });
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      openRenameDialog();
    }
  };
  const handleApplicationKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      isNavigationBlocked ||
      isTextEditingTarget(event.target) ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== "b"
    ) {
      return;
    }

    event.preventDefault();
    addCurrentTabBookmark();
  };

  return (
    <div ref={applicationRootRef} className="konqueror-application" onKeyDown={handleApplicationKeyDown}>
      <KonquerorApplicationMenuSurface
        menuBarRef={menuBarRef}
        popupRef={applicationMenuPopupRef}
        screenArea={screenArea}
        openMenu={openApplicationMenu}
        entries={applicationMenuEntries}
        showPlayerMenu={isMediaPreview}
        onToggleMenu={toggleApplicationMenu}
        onAction={executeApplicationMenuAction}
        onEscape={() => dismissApplicationMenu(true)}
      />
      <KonquerorDockArea
        dockOrder={dockOrder}
        onDockOrderChange={commitDockOrder}
        showToolbar={showMainToolbar}
        showLocationBar={showLocationToolbar}
        renderToolbar={(dockGrip) => (
          <KonquerorToolbar
            profile={getKonquerorToolbarProfile(view, currentPreviewerId)}
            layoutMode={layoutMode}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            canGoUp={canGoUp}
            canGoHome={canGoHome}
            canReload={canReload}
            canStop={canStop}
            canSecurity={canSecurity}
            canPrint={canPrintCurrentContent}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            canCut={(view.type === "directory" && clipboardAvailability.canCut) || ((isImagePreview || isMediaPreview) && currentFileClipboardAvailability.canCut)}
            canCopy={(view.type === "directory" && clipboardAvailability.canCopy) || ((isImagePreview || isMediaPreview) && currentFileClipboardAvailability.canCopy)}
            canPaste={view.type === "directory" && clipboardAvailability.canPaste}
            canPreviousImage={previousImageNodeId !== null && !isNavigationBlocked}
            canNextImage={nextImageNodeId !== null && !isNavigationBlocked}
            imageZoom={imageViewState.zoom}
            cutTitle={view.type === "directory" ? clipboardAvailability.cutTitle : (isImagePreview || isMediaPreview) ? currentFileClipboardAvailability.cutTitle : "Cut is unavailable for this content"}
            copyTitle={view.type === "directory" ? clipboardAvailability.copyTitle : (isImagePreview || isMediaPreview) ? currentFileClipboardAvailability.copyTitle : "Copy is unavailable for this content"}
            pasteTitle={view.type === "directory" ? clipboardAvailability.pasteTitle : "Paste is unavailable for this content"}
            navigationDisabledTitle={navigationDisabledTitle}
            directoryViewMode={directoryViewState.viewMode}
            viewControlsDisabled={viewControlsDisabled}
            onBack={navigateToolbarBack}
            onForward={navigateToolbarForward}
            onUp={navigateToolbarUp}
            onHome={navigateToolbarHome}
            onReload={reload}
            onStop={stopLoading}
            onSecurity={() => {
              if (currentSecurityInfo !== null && canSecurity) {
                dismissContextMenu(false);
                dismissApplicationMenu();
                setSecurityDialogInfo(currentSecurityInfo);
              }
            }}
            onPrint={printEmbeddedContent}
            onCut={() => cutSelectedNode((isImagePreview || isMediaPreview) && file !== null ? [file.id] : undefined, (isImagePreview || isMediaPreview) && file !== null ? file.id : undefined)}
            onCopy={() => copySelectedNode((isImagePreview || isMediaPreview) && file !== null ? [file.id] : undefined, (isImagePreview || isMediaPreview) && file !== null ? file.id : undefined)}
            onPaste={pasteClipboard}
            onIconView={() => {
              dismissContextMenu();
              setResourceViewMode("icons");
              requestDirectoryFocus({ force: true });
            }}
            onTreeView={() => {
              dismissContextMenu();
              setResourceViewMode("tree");
              requestDirectoryFocus({ force: true });
            }}
            onZoomIn={() => {
              if (view.type === "directory") {
                adjustResourceZoom("in");
              } else if (view.type === "external-web" && hasActiveExternalWebFrame) {
                dispatchExternalWebZoom({ type: "zoom-in" });
              } else if (isImagePreview) {
                dispatchImageView({ type: "zoom-in" });
              } else if (embeddedContentCapabilities.kind !== "none") {
                dispatchEmbeddedContent({ type: "zoom-in", kind: embeddedContentCapabilities.kind });
              }
            }}
            onZoomOut={() => {
              if (view.type === "directory") {
                adjustResourceZoom("out");
              } else if (view.type === "external-web" && hasActiveExternalWebFrame) {
                dispatchExternalWebZoom({ type: "zoom-out" });
              } else if (isImagePreview) {
                dispatchImageView({ type: "zoom-out" });
              } else if (embeddedContentCapabilities.kind !== "none") {
                dispatchEmbeddedContent({ type: "zoom-out", kind: embeddedContentCapabilities.kind });
              }
            }}
            onPreviousImage={() => navigateAdjacentImage("previous")}
            onNextImage={() => navigateAdjacentImage("next")}
            onImageZoomChange={(zoom) => dispatchImageView({ type: "set-zoom", zoom })}
            onRotateRight={() => dispatchImageView({ type: "rotate-right" })}
            onNewWindow={openNewKonquerorWindow}
            securityButtonRef={securityButtonRef}
            dockGrip={dockGrip}
          />
        )}
        renderLocationBar={(dockGrip) => (
          <KonquerorLocationBar
            value={navigationState.locationDraft}
            currentPath={currentPath}
            inputRef={locationInputRef}
            onChange={(locationDraft) => dispatchNavigation({ type: "set-location-draft", locationDraft })}
            onNavigate={navigateToLocation}
            onReset={resetLocationDraft}
            onBeginEditing={() => setIsLocationEditing(true)}
            onFinishEditing={() => setIsLocationEditing(false)}
            disabled={isNavigationBlocked}
            disabledTitle={navigationDisabledTitle}
            dockGrip={dockGrip}
          />
        )}
      />
      <KonquerorTabBar
        tabs={tabState.tabs}
        activeTabId={tabState.activeTabId}
        getLabel={(tab) => getKonquerorTabLabel(vfs.state, getCurrentKonquerorLocationTarget(tab.navigationState), captionLabels)}
        onNewTab={createBlankTab}
        onSelectTab={(tabId) => {
          if (!isNavigationBlocked) {
            dispatchTabs({ type: "select", tabId });
          }
        }}
        onCloseCurrentTab={closeCurrentKonquerorTab}
        disabled={isNavigationBlocked}
      />
      <div ref={contentRef} className="konqueror-content" onKeyDown={handleContentKeyDown}>
        <KonquerorErrorView error={visibleError} />
        <KonquerorOperationErrorView
          error={operationError}
          errorContext={fileOperationState.errorContext}
          message={fileOperationState.blockedLaunchMessage}
        />
        <div
          ref={view.type === "directory" ? directoryViewportRef : view.type === "sysinfo" ? sysinfoSurfaceRef : view.type === "about-konqueror" || view.type === "about-blank" ? aboutSurfaceRef : undefined}
          className={`konqueror-directory-viewport${view.type === "sysinfo" ? " konqueror-directory-viewport--sysinfo" : ""}${view.type === "about-konqueror" ? " konqueror-directory-viewport--about" : ""}${view.type === "about-blank" ? " konqueror-directory-viewport--blank" : ""}${view.type === "file" ? " konqueror-directory-viewport--preview" : ""}${view.type === "external-web" ? " konqueror-directory-viewport--external-web" : ""}`}
          tabIndex={view.type === "sysinfo" || view.type === "about-konqueror" || view.type === "about-blank" ? -1 : undefined}
          aria-label={view.type === "sysinfo" ? t("common.scrollSurface", { name: t("konqueror.page.myComputer") }) : view.type === "about-konqueror" ? aboutScrollSurfaceLabel : view.type === "about-blank" ? t("common.blankPage") : undefined}
          onScroll={() => dismissContextMenu()}
        >
          {view.type === "directory" && sortedDirectoryChildren && directoryViewState.viewMode === "tree" ? (
            <KonquerorDirectoryView
              childrenNodes={sortedDirectoryChildren}
              windowId={windowId}
              currentDirectoryNodeId={isTrashRoot ? null : view.node.id}
              treeRows={visibleTreeRows}
              selectedNodeIds={navigationState.selectedNodeIds}
              rangeAnchorNodeId={navigationState.rangeAnchorNodeId}
              cutNodeIds={cutNodeIds}
              isTrashRoot={isTrashRoot}
              trashMetadataByNodeId={trashMetadataByNodeId}
              vfsState={vfs.state}
              sort={directoryViewState.sort}
              zoomLevel={resourceZoomLevel}
              onSelectNode={selectDirectoryNode}
              onClearSelection={() => dispatchNavigation({ type: "clear-selection" })}
              onCommitMarquee={(mode, baselineSelectedNodeIds, baselineRangeAnchorNodeId, visibleNodeIds, hitNodeIds) => {
                dispatchNavigation({
                  type: "commit-marquee-selection",
                  mode,
                  baselineSelectedNodeIds,
                  baselineRangeAnchorNodeId,
                  visibleNodeIds,
                  hitNodeIds,
                });
              }}
              onOpenNode={activateNode}
              onToggleTreeExpansion={toggleTreeExpansion}
              onTreeKeyboardAction={handleTreeKeyboardAction}
              onSelectSortKey={(key) => {
                dismissContextMenu();
                dispatchDirectoryView({ type: "select-sort-key", key });
              }}
              onMoveSelection={(direction) => {
                const nodeId = getKonquerorAdjacentSelectionId(
                  visibleTreeRows.map((row) => vfs.state.nodesById[row.nodeId]).filter((node): node is NonNullable<typeof node> => node !== undefined),
                  navigationState.selectedNodeIds,
                  direction,
                );

                if (nodeId) {
                  dispatchNavigation({ type: "replace-selection", nodeId });
                }
              }}
              onOpenItemContextMenu={openItemContextMenu}
              onOpenBackgroundContextMenu={openBackgroundContextMenu}
              canAcceptDropTarget={(nodeId) => !isNavigationBlocked && canKonquerorAcceptFileDrop(vfs.state, nodeId)}
              onActivateItemDrag={activateItemDrag}
              onDropItemDrag={openDropActionRequest}
              keyboardSurfaceRef={directorySurfaceRef}
              marqueeViewportRef={directoryViewportRef}
              layoutMode={windowManager?.layoutMode ?? "desktop"}
            />
          ) : null}
          {view.type === "directory" && sortedDirectoryChildren && directoryViewState.viewMode === "icons" ? (
            <KonquerorIconView
              childrenNodes={sortedDirectoryChildren}
              windowId={windowId}
              currentDirectoryNodeId={isTrashRoot ? null : view.node.id}
              selectedNodeIds={navigationState.selectedNodeIds}
              rangeAnchorNodeId={navigationState.rangeAnchorNodeId}
              cutNodeIds={cutNodeIds}
              isTrashRoot={isTrashRoot}
              vfsState={vfs.state}
              zoomLevel={resourceZoomLevel}
              onSelectNode={selectDirectoryNode}
              onClearSelection={() => dispatchNavigation({ type: "clear-selection" })}
              onCommitMarquee={(mode, baselineSelectedNodeIds, baselineRangeAnchorNodeId, visibleNodeIds, hitNodeIds) => {
                dispatchNavigation({
                  type: "commit-marquee-selection",
                  mode,
                  baselineSelectedNodeIds,
                  baselineRangeAnchorNodeId,
                  visibleNodeIds,
                  hitNodeIds,
                });
              }}
              onOpenNode={activateNode}
              onMoveSelection={(direction) => {
                const nodeId = getKonquerorAdjacentSelectionId(
                  sortedDirectoryChildren,
                  navigationState.selectedNodeIds,
                  direction,
                );

                if (nodeId) {
                  dispatchNavigation({ type: "replace-selection", nodeId });
                }
              }}
              onOpenItemContextMenu={openItemContextMenu}
              onOpenBackgroundContextMenu={openBackgroundContextMenu}
              canAcceptDropTarget={(nodeId) => !isNavigationBlocked && canKonquerorAcceptFileDrop(vfs.state, nodeId)}
              onActivateItemDrag={activateItemDrag}
              onDropItemDrag={openDropActionRequest}
              keyboardSurfaceRef={directorySurfaceRef}
              marqueeViewportRef={directoryViewportRef}
              layoutMode={windowManager?.layoutMode ?? "desktop"}
            />
          ) : null}
          {view.type === "file" && file ? (
            <KonquerorPreviewHost
              file={file}
              vfsState={vfs.state}
              onNavigate={navigateToLocation}
              previewerId={currentPreviewerId ?? "embedded-text"}
              previewSurfaceRef={previewSurfaceRef}
              zoomLevel={embeddedContentZoomLevel}
              onOpenContextMenu={openPreviewContextMenu}
              imageViewState={imageViewState}
              mediaViewState={mediaViewState}
              hasPreviousMedia={previousMediaNodeId !== null && !isNavigationBlocked}
              hasNextMedia={nextMediaNodeId !== null && !isNavigationBlocked}
              onNavigateAdjacentMedia={navigateAdjacentMedia}
              onRegisterMediaCommand={registerMediaCommand}
              onImageLoad={(dimensions) => {
                if (file !== null) {
                  dispatchImageView({ type: "loaded", nodeId: file.id, dimensions });
                }
              }}
              onImageError={() => {
                if (file !== null) {
                  dispatchImageView({ type: "error", nodeId: file.id });
                }
              }}
              onMediaAction={dispatchMediaView}
            />
          ) : null}
          {view.type === "external-web" ? (
            <KonquerorExternalWebView
              canonicalUrl={view.canonicalUrl}
              externalWebSurfaceRef={externalWebSurfaceRef}
              loadRequest={currentExternalLoad}
              onLoad={completeExternalWebLoad}
              zoomLevel={externalWebZoomState.zoomLevel}
            />
          ) : null}
          {view.type === "file-unavailable" ? (
            <section className="konqueror-file-view konqueror-file-view--unavailable" aria-label={t("konqueror.error.fileUnavailable")}>
              <p>{t("konqueror.error.fileGone")}</p>
            </section>
          ) : null}
          {view.type === "sysinfo" ? <KonquerorSysinfoView vfsState={vfs.state} onOpenDirectory={navigateToNodeId} /> : null}
          {view.type === "about-konqueror" ? (
            <KonquerorStartPage
              zoomLevel={embeddedContentZoomLevel}
              onOpenHome={() => navigateToNodeId(vfs.state.specialLocations.home)}
              onOpenSysinfo={navigateToSysinfo}
              onOpenTrash={() => navigateToNodeId(vfs.state.specialLocations.trash)}
              onOpenSettings={() => launchApplication("kcontrol")}
            />
          ) : null}
        </div>
        <KonquerorInputDialog
          dialogState={commandDialogState}
          onChangeDraft={(draftName) => dispatchCommandDialog({ type: "set-draft-name", draftName })}
          onCancel={closeCommandDialog}
          onSubmit={submitCommandDialog}
        />
        {bookmarkFolderDialogState.kind === "open" ? (
          <KonquerorTextInputDialog
            title={bookmarkFolderDialogState.intent === "bookmark-tabs-as-folder" ? t("konqueror.menu.bookmarkTabs") : t("konqueror.menu.newBookmarkFolder")}
            label={t("konqueror.dialog.nameLabel")}
            value={bookmarkFolderDialogState.draftName}
            error={bookmarkFolderDialogState.error === "invalid-name"
              ? t("konqueror.dialog.enterFolderName")
              : bookmarkFolderDialogState.error === "parent-unavailable"
              ? t("konqueror.dialog.targetFolderUnavailable")
              : bookmarkFolderDialogState.error === "no-bookmarkable-tabs"
              ? t("konqueror.dialog.noBookmarkableTabs")
              : undefined}
            onChange={(draftName) => dispatchBookmarkFolderDialog({ type: "set-draft-name", draftName })}
            onCancel={closeBookmarkFolderDialog}
            onSubmit={submitBookmarkFolderDialog}
          />
        ) : null}
        <KonquerorDirectTransferDialog
          dialogState={directTransferDialogState}
          onChangeDestination={(destinationDraft) => dispatchDirectTransferDialog({ type: "set-destination-draft", destinationDraft })}
          onCancel={closeDirectTransferDialog}
          onSubmit={submitDirectTransferDialog}
        />
        <KonquerorConfirmationDialog
          confirmationState={confirmationState}
          onCancel={closeConfirmation}
          onSubmit={submitConfirmation}
        />
        <KonquerorPropertiesDialog
          nodeId={propertiesNodeId}
          vfsState={vfs.state}
          onClose={closeProperties}
        />
        <KonquerorSecurityDialog securityInfo={securityDialogInfo} onClose={closeSecurityDialog} />
        <WindowOwnedPopupPortal>
          <KonquerorContextMenu
            menuState={contextMenuState}
            entries={contextMenuEntries}
            containerRef={windowPopupLayer?.popupLayerRef ?? contentRef}
            screenArea={screenArea}
            onDismiss={dismissContextMenu}
            onAction={executeContextMenuAction}
          />
          <KonquerorDropActionMenu
            request={dropActionRequest}
            containerRef={windowPopupLayer?.popupLayerRef ?? contentRef}
            screenArea={screenArea}
            onDismiss={dismissDropActionRequest}
            onAction={executeDropAction}
          />
        </WindowOwnedPopupPortal>
      </div>
      <KonquerorStatusBar
        directoryChildren={directoryChildren}
        file={file}
        selectedNodeIds={navigationState.selectedNodeIds}
        error={statusError}
        operationStatus={fileOperationState.statusMessage ?? fileOperationState.blockedLaunchMessage}
        editorStatus={editorState.kind === "editing" ? (editorAvailability.isDirty ? "dirty" : "clean") : null}
        editorDraftSize={editorDraftSize}
        pageStatus={pageStatus}
      />
    </div>
  );
}
