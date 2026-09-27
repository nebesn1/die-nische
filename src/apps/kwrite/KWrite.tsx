import { useCallback, useContext, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "../../application-runtime/types";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import { joinVfsPath, validateVfsNodeName } from "../../vfs/path";
import { getVfsNodeById } from "../../vfs/queries";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { useVfs } from "../../vfs/useVfs";
import { KWriteDialogs } from "./KWriteDialogs";
import {
  getKWriteDialogDirectory,
  getKWriteDialogDirectoryNavigationTarget,
  getKWriteDialogNode,
  getKWriteDialogParentDirectoryId,
  getKWriteInitialDialogDirectoryId,
} from "./dialogController";
import { resolveVfsDialogTargetDirectory } from "../../vfs/vfsDialogController";
import {
  createKWriteOpenDialog,
  createKWriteSaveAsDialog,
  initialKWriteDialogState,
  navigateKWriteDialogDirectory,
  selectKWriteDialogNode,
  setKWriteDialogError,
  type KWriteDialogState,
} from "./dialogModel";
import {
  canRevertKWriteDocument,
  canSaveAsKWriteDocument,
  canSaveKWriteDocument,
  createInitialKWriteDocumentState,
  editKWriteDocument,
  getKWriteDocumentBaseTitle,
  getKWriteDocumentStatus,
  loadKWriteDocument,
  requestKWriteDocument,
  revertKWriteDocument,
  saveFailedKWriteDocument,
  saveSucceededKWriteDocument,
  synchronizeKWriteDocument,
  type KWriteDocumentState,
} from "./documentModel";
import {
  createKWriteTextFileSnapshot,
  getKWriteTextFileSnapshot,
  saveKWriteDocument,
  saveKWriteDocumentAs,
} from "./documentController";
import {
  getKWriteReplacementSaveMode,
  isKWriteSameDocumentAction,
  shouldConfirmKWriteReplacement,
  type KWritePendingAction,
  type KWritePendingReplacement,
} from "./documentLifecycle";
import { getKWriteCloseSaveMode, shouldConfirmKWriteClose } from "./closeLifecycle";
import { createKWriteOpenTextFileIntent, isKWriteOpenTextFileIntent } from "./launchIntent";
import { getKWriteShortcut } from "./keyboardShortcuts";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { KWriteIcon } from "../../icons/IconComponents";
import {
  BackIcon,
  CopyIcon,
  CutIcon,
  DiscardChangesIcon,
  FindIcon,
  FolderIcon,
  ForwardIcon,
  PasteIcon,
  PrintIcon,
  SaveIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../konqueror/icons";
import { useOptionalKonquerorPrint } from "../konqueror/useKonquerorPrint";
import { KWriteRecentFilesContext } from "./KWriteRecentFilesContext";
import {
  canRedoKWriteHistory, canUndoKWriteHistory, createKWriteHistory, defaultKWriteSearchOptions,
  findKWriteMatch, getKWriteLineSelection, recordKWriteHistory, redoKWriteHistory, undoKWriteHistory,
  type KWriteSearchOptions, type KWriteSelection,
} from "./kwriteEditing";
import type { KWriteCloseTarget } from "./dialogModel";
import { getKWriteDialogError, translateKWriteMessage } from "./kwriteI18n";
import { useI18n } from "../../i18n/useI18n";
import { APPLICATION_MENUBAR_CLASS, useApplicationMenubarPolicy } from "../applicationMenubarPolicy";

type KWriteProps = {
  readonly windowId?: string;
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly closeRequest?: ApplicationCloseRequest | null;
  readonly onRequestClose?: () => void;
  readonly onCommitClose?: (requestId: number) => void;
  readonly onCancelClose?: (requestId: number) => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

type KWriteMenu = "file" | "edit" | "view" | "help" | null;
type KWriteEditingDialog = "none" | "replace" | "go-to-line";

const defaultKWriteEditorFontSize = 13;
const minimumKWriteEditorFontSize = 8;
const maximumKWriteEditorFontSize = 32;

const getInitialDocument = (launchRequest: ApplicationLaunchRequest | null, state: VfsState): KWriteDocumentState => {
  const initial = createInitialKWriteDocumentState();

  if (!launchRequest || !isKWriteOpenTextFileIntent(launchRequest.intent)) {
    return initial;
  }

  return requestKWriteDocument(initial, getKWriteTextFileSnapshot(state, launchRequest.intent.nodeId));
};

const getSaveAsDefaultFilename = (document: KWriteDocumentState): string =>
  document.nodeId === null ? "Untitled.txt" : document.lastKnownName;

export function KWrite({
  closeRequest = null,
  launchRequest = null,
  onCancelClose = () => undefined,
  onCommitClose = () => undefined,
  onRequestClose = () => undefined,
  onSetWindowTitle = () => undefined,
  windowId,
}: KWriteProps) {
  const { t } = useI18n();
  const vfs = useVfs();
  const launcher = useContext(ApplicationLauncherContext);
  const desktopSession = useOptionalDesktopSession();
  const print = useOptionalKonquerorPrint();
  const { recentFiles, addRecentFile } = useContext(KWriteRecentFilesContext);
  const [document, setDocument] = useState(() => getInitialDocument(launchRequest, vfs.state));
  const [dialog, setDialog] = useState<KWriteDialogState>(initialKWriteDialogState);
  const [openMenu, setOpenMenu] = useState<KWriteMenu>(null);
  const [history, setHistory] = useState(() => createKWriteHistory(getInitialDocument(launchRequest, vfs.state).draft));
  const [selection, setSelection] = useState<KWriteSelection>({ start: 0, end: 0 });
  const [editingDialog, setEditingDialog] = useState<KWriteEditingDialog>("none");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const closeApplicationMenu = useCallback(() => {
    setOpenMenu(null);
    setIsRecentOpen(false);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [goToLine, setGoToLine] = useState("1");
  const [searchOptions, setSearchOptions] = useState<KWriteSearchOptions>(defaultKWriteSearchOptions);
  const [editorFontSize, setEditorFontSize] = useState(defaultKWriteEditorFontSize);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const menuBarRef = useRef<HTMLElement | null>(null);
  const lastHandledLaunchRequestIdRef = useRef<number | null>(launchRequest?.requestId ?? null);
  const lastRecordedInitialLaunchRequestIdRef = useRef<number | null>(null);
  const lastHandledCloseRequestIdRef = useRef<number | null>(null);
  const lastReportedBaseTitleRef = useRef<string | null>(null);
  const nextPendingActionIdRef = useRef(1);
  const consumedPendingActionIdsRef = useRef(new Set<number>());
  const currentSnapshot = document.nodeId === null ? null : getKWriteTextFileSnapshot(vfs.state, document.nodeId);
  const isReadOnly = document.mode !== "untitled" && document.mode !== "writable";
  const canSave = canSaveKWriteDocument(document);
  const canRevert = canRevertKWriteDocument(document);
  const hasSelection = selection.start !== selection.end;
  const canPaste = Boolean(desktopSession?.readClipboardText());
  const canPrint = print !== null;
  const canIncreaseFontSize = editorFontSize < maximumKWriteEditorFontSize;
  const canDecreaseFontSize = editorFontSize > minimumKWriteEditorFontSize;
  const getRecentFileLabel = (nodeId: VfsNodeId, fallbackPath: string): string => {
    const node = getVfsNodeById(vfs.state, nodeId);
    return node.ok ? getVfsNodeDisplayName(node.value) : fallbackPath;
  };

  const rememberSnapshot = useCallback((snapshot: ReturnType<typeof getKWriteTextFileSnapshot>) => {
    if (snapshot) addRecentFile({ nodeId: snapshot.nodeId, path: snapshot.path, name: snapshot.name });
  }, [addRecentFile]);

  useEffect(() => {
    if (
      !launchRequest
      || !isKWriteOpenTextFileIntent(launchRequest.intent)
      || launchRequest.requestId === lastRecordedInitialLaunchRequestIdRef.current
    ) {
      return;
    }

    const snapshot = getKWriteTextFileSnapshot(vfs.state, launchRequest.intent.nodeId);

    if (!snapshot || document.nodeId !== snapshot.nodeId) {
      return;
    }

    lastRecordedInitialLaunchRequestIdRef.current = launchRequest.requestId;
    rememberSnapshot(snapshot);
  }, [document.nodeId, launchRequest, rememberSnapshot, vfs.state]);

  useApplicationMenuDismissal({
    isOpen: openMenu !== null,
    menuBarRef,
    onDismiss: () => {
      setOpenMenu(null);
      setIsRecentOpen(false);
    },
  });
  useApplicationMenubarPolicy(closeApplicationMenu);

  useEffect(() => {
    if (openMenu !== "file") {
      setIsRecentOpen(false);
    }
  }, [openMenu]);

  useEffect(() => {
    const baseTitle = getKWriteDocumentBaseTitle(document);

    if (lastReportedBaseTitleRef.current === baseTitle) {
      return;
    }

    lastReportedBaseTitleRef.current = baseTitle;
    onSetWindowTitle(baseTitle);
  }, [document, onSetWindowTitle]);

  const createPendingReplacement = (action: KWritePendingAction): KWritePendingReplacement => ({
    id: nextPendingActionIdRef.current++,
    action,
  });

  const resetDocumentToUntitled = () => {
    setDocument(createInitialKWriteDocumentState());
    setHistory(createKWriteHistory(""));
    setSelection({ start: 0, end: 0 });
    setEditingDialog("none");
    setReplacementText("");
    setGoToLine("1");
    setSearchOptions(defaultKWriteSearchOptions);
    setDialog(initialKWriteDialogState);
  };

  const finishCloseTarget = (target: KWriteCloseTarget) => {
    if (target.type === "document") {
      resetDocumentToUntitled();
      return;
    }

    setDialog(initialKWriteDialogState);
    onCommitClose(target.requestId);
  };

  const cancelCloseTarget = (target: KWriteCloseTarget) => {
    if (target.type === "window") {
      onCancelClose(target.requestId);
    }
    setDialog(initialKWriteDialogState);
  };

  const requestDocumentClose = () => {
    setOpenMenu(null);
    setIsRecentOpen(false);

    if (!shouldConfirmKWriteClose(document)) {
      resetDocumentToUntitled();
      return;
    }

    setDialog({ type: "confirm-close", closeTarget: { type: "document" }, error: null });
  };

  const completePendingAction = (
    action: KWritePendingAction,
    sourceDocument: KWriteDocumentState,
    forceOpen = false,
  ) => {
    setOpenMenu(null);

    if (action.type === "new") {
      resetDocumentToUntitled();
      return;
    }

    if (action.type === "open-dialog") {
      setDialog(createKWriteOpenDialog(getKWriteInitialDialogDirectoryId(vfs.state, sourceDocument)));
      return;
    }

    const snapshot = getKWriteTextFileSnapshot(vfs.state, action.nodeId);
    setDocument((current) => forceOpen && snapshot ? loadKWriteDocument(snapshot) : requestKWriteDocument(current, snapshot));
    if (snapshot) {
      setHistory(createKWriteHistory(snapshot.content));
      setSelection({ start: 0, end: 0 });
      rememberSnapshot(snapshot);
    }
    setDialog(initialKWriteDialogState);
  };

  const requestReplacement = (action: KWritePendingAction) => {
    setOpenMenu(null);

    if (action.type === "open-node" && isKWriteSameDocumentAction(document, action)) {
      const snapshot = getKWriteTextFileSnapshot(vfs.state, action.nodeId);
      setDocument((current) => synchronizeKWriteDocument(current, snapshot));
      return;
    }

    if (shouldConfirmKWriteReplacement(document, action)) {
      setDialog({ type: "confirm-replacement", pending: createPendingReplacement(action), error: null });
      return;
    }

    completePendingAction(action, document);
  };

  const openDocument = () => requestReplacement({ type: "open-dialog" });

  const openNewWindow = () => {
    launcher?.launchNewApplicationInstance("kwrite");
    setOpenMenu(null);
  };

  useEffect(() => {
    setDocument((current) => {
      const snapshot = current.nodeId === null ? null : getKWriteTextFileSnapshot(vfs.state, current.nodeId);
      return synchronizeKWriteDocument(current, snapshot);
    });
  }, [vfs.state]);

  useEffect(() => {
    if (closeRequest || !launchRequest || launchRequest.requestId === lastHandledLaunchRequestIdRef.current) {
      return;
    }

    lastHandledLaunchRequestIdRef.current = launchRequest.requestId;

    if (!isKWriteOpenTextFileIntent(launchRequest.intent)) {
      return;
    }

    const action: KWritePendingAction = { type: "open-node", nodeId: launchRequest.intent.nodeId };

    if (isKWriteSameDocumentAction(document, action)) {
      setDocument((current) => synchronizeKWriteDocument(current, getKWriteTextFileSnapshot(vfs.state, action.nodeId)));
    } else if (shouldConfirmKWriteReplacement(document, action)) {
      setDialog({ type: "confirm-replacement", pending: createPendingReplacement(action), error: null });
    } else {
      const snapshot = getKWriteTextFileSnapshot(vfs.state, action.nodeId);
      setDocument((current) => requestKWriteDocument(current, snapshot));
      if (snapshot) {
        setHistory(createKWriteHistory(snapshot.content));
        setSelection({ start: 0, end: 0 });
        rememberSnapshot(snapshot);
      }
      setDialog(initialKWriteDialogState);
    }
  }, [closeRequest, document, launchRequest, rememberSnapshot, vfs.state]);

  useEffect(() => {
    if (!closeRequest || closeRequest.requestId === lastHandledCloseRequestIdRef.current) {
      return;
    }

    lastHandledCloseRequestIdRef.current = closeRequest.requestId;
    setOpenMenu(null);

    if (!shouldConfirmKWriteClose(document)) {
      setDialog(initialKWriteDialogState);
      onCommitClose(closeRequest.requestId);
      return;
    }

    setDialog({ type: "confirm-close", closeTarget: { type: "window", requestId: closeRequest.requestId }, error: null });
  }, [closeRequest, document, onCommitClose]);

  const saveCurrentDocument = (sourceDocument: KWriteDocumentState): KWriteDocumentState | null => {
    const current = sourceDocument.nodeId === null
      ? null
      : getKWriteTextFileSnapshot(vfs.state, sourceDocument.nodeId);
    const synchronized = synchronizeKWriteDocument(sourceDocument, current);

    if (synchronized !== sourceDocument) {
      setDocument(synchronized);
    }

    if (!canSaveKWriteDocument(synchronized)) {
      return null;
    }

    const saved = saveKWriteDocument(vfs.state, synchronized, vfs, new Date().toISOString());

    if (!saved.ok) {
      setDocument((current) => saveFailedKWriteDocument(current, saved.error.message));
      return null;
    }

    const snapshot = synchronized.nodeId === null
      ? null
      : getKWriteTextFileSnapshot(vfs.state, synchronized.nodeId);

    if (!snapshot) {
      setDocument((current) => saveFailedKWriteDocument(current, t("kwrite.fileUnavailable")));
      return null;
    }

    return saveSucceededKWriteDocument(synchronized, {
      ...snapshot,
      content: saved.file.content.text,
      modifiedAt: saved.file.modifiedAt,
      name: saved.file.name,
    });
  };

  const saveDocument = () => {
    if (!canSave) {
      return;
    }

    const saved = saveCurrentDocument(document);

    if (saved) {
      setDocument(saved);
      rememberSnapshot(getKWriteTextFileSnapshot(vfs.state, saved.nodeId!));
    }
  };

  const printDocument = () => {
    if (!print) {
      return;
    }

    print.requestPrint(windowId ?? "kwrite-unmanaged", {
      kind: "text",
      title: document.lastKnownDisplayName,
      content: document.draft,
    });
    setOpenMenu(null);
  };

  const revertDocument = () => {
    if (!canRevert) {
      return;
    }

    setDocument((current) => {
      const next = revertKWriteDocument(current, current.nodeId === null ? null : getKWriteTextFileSnapshot(vfs.state, current.nodeId));
      setHistory(createKWriteHistory(next.draft));
      setSelection({ start: 0, end: 0 });
      return next;
    });
  };

  const openSaveAsDialog = (
    pending: KWritePendingReplacement | null = null,
    closeTarget: KWriteCloseTarget | null = null,
  ) => {
    if (!canSaveAsKWriteDocument(document)) {
      return;
    }

    setOpenMenu(null);
    setDialog(createKWriteSaveAsDialog(
      getKWriteInitialDialogDirectoryId(vfs.state, document),
      getSaveAsDefaultFilename(document),
      pending,
      closeTarget,
    ));
  };

  const continueAfterSaveAs = (
    savedDocument: KWriteDocumentState,
    pending: KWritePendingReplacement | null,
    closeTarget: KWriteCloseTarget | null,
  ) => {
    if (closeTarget !== null) {
      setDocument(savedDocument);
      finishCloseTarget(closeTarget);
      return;
    }

    if (!pending) {
      setDocument(savedDocument);
      setDialog(initialKWriteDialogState);
      return;
    }

    if (consumedPendingActionIdsRef.current.has(pending.id)) {
      return;
    }

    consumedPendingActionIdsRef.current.add(pending.id);
    setDocument(savedDocument);
    completePendingAction(pending.action, savedDocument);
  };

  const saveAsTo = (
    directoryNodeId: VfsNodeId,
    filename: string,
    pending: KWritePendingReplacement | null,
    existingFileNodeId: VfsNodeId | null = null,
    closeTarget: KWriteCloseTarget | null = null,
  ) => {
    const directory = getKWriteDialogDirectory(vfs.state, directoryNodeId);

    if (!directory || directory.isInsideTrash) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kwrite.trashSaveError" }));
      return;
    }

    const existing = existingFileNodeId === null ? null : getVfsNodeById(vfs.state, existingFileNodeId);

    if (existingFileNodeId !== null) {
      if (
        !existing ||
        !existing.ok ||
        existing.value.kind !== "file" ||
        existing.value.parentId !== directory.node.id ||
        existing.value.name !== filename
      ) {
        setDialog(createKWriteSaveAsDialog(directory.node.id, filename, pending, closeTarget));
        setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kfind.replacementUnavailable" }));
        return;
      }
    }

    const targetPath = existingFileNodeId === null ? undefined : joinVfsPath(directory.path, filename);
    const saved = saveKWriteDocumentAs(
      vfs.state,
      document,
      vfs,
      { directoryPath: directory.path, name: filename, existingFilePath: targetPath },
      new Date().toISOString(),
    );

    if (!saved.ok) {
      setDialog((current) => setKWriteDialogError(current, getKWriteDialogError(saved.error.message)));
      return;
    }

    const savedDocument = saveSucceededKWriteDocument(
      document,
      createKWriteTextFileSnapshot(saved.file, joinVfsPath(directory.path, saved.file.name)),
    );
    rememberSnapshot(createKWriteTextFileSnapshot(saved.file, joinVfsPath(directory.path, saved.file.name)));
    continueAfterSaveAs(savedDocument, pending, closeTarget);
  };

  const handleSaveAs = () => {
    if (dialog.type !== "save-as") {
      return;
    }

    const validName = validateVfsNodeName(dialog.filename);

    if (!validName.ok) {
      setDialog((current) => setKWriteDialogError(current, getKWriteDialogError(validName.error.message)));
      return;
    }

    const targetDirectory = resolveVfsDialogTargetDirectory(
      vfs.state,
      dialog.directoryNodeId,
      dialog.selectedDirectoryNodeId,
    );

    if (!targetDirectory.ok) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kfind.directoryUnavailable" }));
      return;
    }

    const directory = getKWriteDialogDirectory(vfs.state, targetDirectory.value);

    if (!directory) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kfind.directoryUnavailable" }));
      return;
    }

    if (directory.isInsideTrash) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kwrite.trashSaveError" }));
      return;
    }

    const existing = directory.children.find((node) => node.name === validName.value) ?? null;

    if (!existing) {
      saveAsTo(directory.node.id, validName.value, dialog.pending, null, dialog.closeTarget);
      return;
    }

    if (existing.kind === "directory") {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kfind.folderExists" }));
      return;
    }

    if (existing.id === document.nodeId) {
      saveAsTo(directory.node.id, validName.value, dialog.pending, existing.id, dialog.closeTarget);
      return;
    }

    setDialog({
      type: "confirm-overwrite",
      directoryNodeId: directory.node.id,
      filename: validName.value,
      targetNodeId: existing.id,
      pending: dialog.pending,
      closeTarget: dialog.closeTarget,
      error: null,
    });
  };

  const handleReplacementSave = () => {
    if (dialog.type !== "confirm-replacement") {
      return;
    }

    const saveMode = getKWriteReplacementSaveMode(document);

    if (saveMode === "save-as") {
      openSaveAsDialog(dialog.pending);
      return;
    }

    if (saveMode === "unavailable") {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kwrite.saveStateError" }));
      return;
    }

    const saved = saveCurrentDocument(document);

    if (!saved) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kwrite.saveFailed" }));
      return;
    }

    if (consumedPendingActionIdsRef.current.has(dialog.pending.id)) {
      return;
    }

    consumedPendingActionIdsRef.current.add(dialog.pending.id);
    setDocument(saved);
    completePendingAction(dialog.pending.action, saved);
  };

  const handleDiscardReplacement = () => {
    if (dialog.type !== "confirm-replacement" || consumedPendingActionIdsRef.current.has(dialog.pending.id)) {
      return;
    }

    consumedPendingActionIdsRef.current.add(dialog.pending.id);
    const discarded = createInitialKWriteDocumentState();
    setDocument(discarded);
    completePendingAction(dialog.pending.action, discarded, true);
  };

  const handleCloseSave = () => {
    if (dialog.type !== "confirm-close") {
      return;
    }

    const saveMode = getKWriteCloseSaveMode(document);

    if (saveMode === "save-as") {
      openSaveAsDialog(null, dialog.closeTarget);
      return;
    }

    if (saveMode === "unavailable") {
      return;
    }

    const saved = saveCurrentDocument(document);

    if (!saved) {
      setDialog(initialKWriteDialogState);
      cancelCloseTarget(dialog.closeTarget);
      return;
    }

    setDocument(saved);
    finishCloseTarget(dialog.closeTarget);
  };

  const handleDiscardClose = () => {
    if (dialog.type !== "confirm-close") {
      return;
    }

    finishCloseTarget(dialog.closeTarget);
  };

  const handleDialogCancel = () => {
    if (dialog.type === "confirm-overwrite") {
      setDialog(createKWriteSaveAsDialog(dialog.directoryNodeId, dialog.filename, dialog.pending, dialog.closeTarget));
      return;
    }

    if (dialog.type === "confirm-close") {
      cancelCloseTarget(dialog.closeTarget);
      return;
    }

    if (dialog.type === "save-as" && dialog.closeTarget !== null) {
      cancelCloseTarget(dialog.closeTarget);
      return;
    }

    setDialog(initialKWriteDialogState);
  };

  const setDialogDirectory = (directoryNodeId: VfsNodeId) => {
    setDialog((current) => navigateKWriteDialogDirectory(current, directoryNodeId));
  };

  const handleOpenSelection = (nodeId: VfsNodeId | null) => {
    if (dialog.type !== "open" || nodeId === null) {
      return;
    }

    const directory = getKWriteDialogDirectory(vfs.state, dialog.directoryNodeId);
    const selected = directory?.children.find((node) => node.id === nodeId) ?? null;

    if (!selected) {
      setDialog((current) => setKWriteDialogError(current, { type: "translation", key: "kwrite.fileUnavailable" }));
      return;
    }

    if (selected.kind === "directory") {
      setDialogDirectory(selected.id);
      return;
    }

    completePendingAction({ type: "open-node", nodeId: selected.id }, document);
  };

  const handleDialogActivateNode = (nodeId: VfsNodeId) => {
    if (dialog.type !== "open" && dialog.type !== "save-as") {
      return;
    }

    const directoryNodeId = getKWriteDialogDirectoryNavigationTarget(vfs.state, dialog.directoryNodeId, nodeId);

    if (directoryNodeId !== null) {
      setDialogDirectory(directoryNodeId);
      return;
    }

    if (dialog.type === "open") {
      handleOpenSelection(nodeId);
    } else if (getKWriteDialogNode(vfs.state, dialog.directoryNodeId, nodeId)) {
      setDialog((current) => selectKWriteDialogNode(current, nodeId));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dialog.type === "none" && openMenu !== null && event.key === "Escape") {
      event.preventDefault();
      setOpenMenu(null);
      return;
    }

    const shortcut = getKWriteShortcut(event);

    if (!shortcut) {
      return;
    }

    event.preventDefault();

    if (dialog.type !== "none") {
      return;
    }

    if (shortcut === "save-as") {
      openSaveAsDialog();
    } else if (shortcut === "save") {
      saveDocument();
    } else if (shortcut === "new") {
      requestReplacement({ type: "new" });
    } else {
      requestReplacement({ type: "open-dialog" });
    }
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDraft = event.currentTarget.value;
    setDocument((current) => editKWriteDocument(current, nextDraft));
    setHistory((current) => recordKWriteHistory(current, nextDraft));
    setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd });
  };

  const applyEditorText = (text: string, nextSelection: KWriteSelection) => {
    setDocument((current) => editKWriteDocument(current, text));
    setHistory((current) => recordKWriteHistory(current, text));
    setSelection(nextSelection);
    requestAnimationFrame(() => { editorRef.current?.focus(); editorRef.current?.setSelectionRange(nextSelection.start, nextSelection.end); });
  };
  const applySelection = (next: KWriteSelection) => {
    setSelection(next);
    requestAnimationFrame(() => { editorRef.current?.focus(); editorRef.current?.setSelectionRange(next.start, next.end); });
  };
  const find = (backwards = searchOptions.backwards) => {
    const selectionCursor = backwards ? selection.start : selection.end;
    const cursor = Math.max(0, Math.min(document.draft.length, selectionCursor));
    const match = findKWriteMatch(document.draft, searchQuery, { ...searchOptions, backwards }, searchOptions.fromCursor ? cursor : 0);
    if (match) applySelection(match);
  };
  const replace = () => {
    const match = hasSelection && document.draft.slice(selection.start, selection.end) === searchQuery ? selection : findKWriteMatch(document.draft, searchQuery, searchOptions, selection.end);
    if (!match) return;
    const text = `${document.draft.slice(0, match.start)}${replacementText}${document.draft.slice(match.end)}`;
    applyEditorText(text, { start: match.start, end: match.start + replacementText.length });
  };
  const selectedText = document.draft.slice(selection.start, selection.end);
  const cut = () => { if (!hasSelection) return; void desktopSession?.writeClipboard(selectedText); applyEditorText(`${document.draft.slice(0, selection.start)}${document.draft.slice(selection.end)}`, { start: selection.start, end: selection.start }); };
  const copy = () => { if (hasSelection) void desktopSession?.writeClipboard(selectedText); };
  const paste = () => { const text = desktopSession?.readClipboardText(); if (text === null || text === undefined) return; applyEditorText(`${document.draft.slice(0, selection.start)}${text}${document.draft.slice(selection.end)}`, { start: selection.start + text.length, end: selection.start + text.length }); };
  const restoreHistory = (next: typeof history) => { setHistory(next); setDocument((current) => editKWriteDocument(current, next.entries[next.index]!)); applySelection({ start: 0, end: 0 }); };
  const undo = () => restoreHistory(undoKWriteHistory(history));
  const redo = () => restoreHistory(redoKWriteHistory(history));
  const openFind = () => { setIsFindOpen(true); setOpenMenu(null); };

  const toggleMenu = (menu: Exclude<KWriteMenu, null>) => {
    setOpenMenu((current) => current === menu ? null : menu);
    if (menu !== "file" || openMenu === "file") {
      setIsRecentOpen(false);
    }
  };

  const openRecentInNewWindow = (nodeId: VfsNodeId) => {
    setOpenMenu(null);
    setIsRecentOpen(false);

    if (!launcher || !getKWriteTextFileSnapshot(vfs.state, nodeId)) {
      return;
    }

    launcher.launchNewApplicationInstance("kwrite", {
      intent: createKWriteOpenTextFileIntent(nodeId),
    });
  };

  return (
    <div className="kwrite-app" tabIndex={0} onKeyDownCapture={handleKeyDown} data-kwrite-root="true">
      <nav ref={menuBarRef} className={`${APPLICATION_MENUBAR_CLASS} kwrite-menubar kde-chrome-surface`} aria-label={t("kwrite.menuBar")}>
        <div className="kwrite-menu-root">
          <button type="button" className={`kwrite-menuitem${openMenu === "file" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "file"} onClick={() => toggleMenu("file")}>{t("kwrite.file")}</button>
          {openMenu === "file" ? (
            <div
              className="kwrite-menu-popup"
              role="menu"
              aria-label={t("kwrite.fileMenu")}
              onMouseOver={(event) => {
                if (!(event.target as HTMLElement).closest(".kwrite-menu-submenu-wrap")) {
                  setIsRecentOpen(false);
                }
              }}
            >
              <button type="button" role="menuitem" onMouseEnter={() => setIsRecentOpen(false)} onClick={() => requestReplacement({ type: "new" })}>
                <span>{t("kwrite.new")}</span><span className="kwrite-menu-shortcut">Ctrl+Alt+N</span>
              </button>
              <hr className="kwrite-menu-separator" role="separator" />
              <button type="button" role="menuitem" onMouseEnter={() => setIsRecentOpen(false)} onClick={openDocument}>{t("kwrite.open")}</button>
              <div className="kwrite-menu-submenu-wrap" onMouseLeave={() => setIsRecentOpen(false)}>
                <button type="button" role="menuitem" className="kwrite-menu-submenu-trigger" aria-haspopup="menu" aria-expanded={isRecentOpen} disabled={recentFiles.length === 0} onMouseEnter={() => setIsRecentOpen(true)} onFocus={() => setIsRecentOpen(true)} onClick={() => setIsRecentOpen(true)}>{t("kwrite.openRecent")} <span>▶</span></button>
                {isRecentOpen ? <div className="kwrite-menu-popup kwrite-menu-popup--submenu" role="menu" aria-label={`${t("kwrite.openRecent")} menu`}>{recentFiles.map((file) => <button key={file.nodeId} type="button" role="menuitem" title={file.path} onClick={() => openRecentInNewWindow(file.nodeId)}>{getRecentFileLabel(file.nodeId, file.path)}</button>)}</div> : null}
              </div>
              <button type="button" role="menuitem" disabled={!canSave} onMouseEnter={() => setIsRecentOpen(false)} onClick={() => { saveDocument(); setOpenMenu(null); }}>{t("kwrite.save")}</button>
              <button type="button" role="menuitem" disabled={!canSaveAsKWriteDocument(document)} onMouseEnter={() => setIsRecentOpen(false)} onClick={() => openSaveAsDialog()}>{t("kwrite.saveAsMenu")}</button>
              <button type="button" role="menuitem" disabled={!canRevert} onMouseEnter={() => setIsRecentOpen(false)} onClick={() => { revertDocument(); setOpenMenu(null); }}>{t("kwrite.reload")}</button>
              <button type="button" role="menuitem" disabled={!canPrint} onMouseEnter={() => setIsRecentOpen(false)} onClick={printDocument}>{t("kwrite.print")}</button>
              <hr className="kwrite-menu-separator" role="separator" />
              <button type="button" role="menuitem" onMouseEnter={() => setIsRecentOpen(false)} onClick={requestDocumentClose}>{t("kwrite.close")}</button>
              <hr className="kwrite-menu-separator" role="separator" />
              <button type="button" role="menuitem" onMouseEnter={() => setIsRecentOpen(false)} onClick={() => { setOpenMenu(null); onRequestClose(); }}>{t("kwrite.quit")}</button>
            </div>
          ) : null}
        </div>
        <div className="kwrite-menu-root">
          <button type="button" className={`kwrite-menuitem${openMenu === "edit" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "edit"} onClick={() => toggleMenu("edit")}>{t("kwrite.edit")}</button>
          {openMenu === "edit" ? <div className="kwrite-menu-popup" role="menu" aria-label={t("kwrite.editMenu")}>
            <button type="button" role="menuitem" disabled={!canUndoKWriteHistory(history)} onClick={() => { undo(); setOpenMenu(null); }}>{t("kwrite.undo")}</button>
            <button type="button" role="menuitem" disabled={!canRedoKWriteHistory(history)} onClick={() => { redo(); setOpenMenu(null); }}>{t("kwrite.redo")}</button>
            <hr className="kwrite-menu-separator" role="separator" />
            <button type="button" role="menuitem" disabled={!hasSelection} onClick={() => { cut(); setOpenMenu(null); }}>{t("kwrite.cut")}</button>
            <button type="button" role="menuitem" disabled={!hasSelection} onClick={() => { copy(); setOpenMenu(null); }}>{t("kwrite.copy")}</button>
            <button type="button" role="menuitem" disabled={!canPaste} onClick={() => { paste(); setOpenMenu(null); }}>{t("kwrite.paste")}</button>
            <hr className="kwrite-menu-separator" role="separator" />
            <button type="button" role="menuitem" disabled={!document.draft} onClick={() => { applySelection({ start: 0, end: document.draft.length }); setOpenMenu(null); }}>{t("kwrite.selectAll")}</button>
            <button type="button" role="menuitem" disabled={!hasSelection} onClick={() => { applySelection({ start: selection.end, end: selection.end }); setOpenMenu(null); }}>{t("kwrite.deselect")}</button>
            <hr className="kwrite-menu-separator" role="separator" />
            <button type="button" role="menuitem" onClick={() => { setEditingDialog("go-to-line"); setOpenMenu(null); }}>{t("kwrite.goToLine")}</button>
          </div> : null}
        </div>
        <div className="kwrite-menu-root">
          <button type="button" className={`kwrite-menuitem${openMenu === "view" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "view"} onClick={() => toggleMenu("view")}>{t("kwrite.view")}</button>
           {openMenu === "view" ? <div className="kwrite-menu-popup" role="menu" aria-label={t("kwrite.viewMenu")}><button type="button" role="menuitem" disabled={!launcher} onClick={openNewWindow}>{t("kwrite.newWindow")}</button></div> : null}
        </div>
        <div className="kwrite-menu-root">
          <button type="button" className={`kwrite-menuitem${openMenu === "help" ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={openMenu === "help"} onClick={() => toggleMenu("help")}>{t("kwrite.help")}</button>
          {openMenu === "help" ? (
            <div className="kwrite-menu-popup" role="menu" aria-label={t("kwrite.helpMenu")}>
              <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kwrite"); setOpenMenu(null); }}>{t("kwrite.aboutKwrite")}</button>
              <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kde"); setOpenMenu(null); }}>{t("kwrite.aboutKde")}</button>
            </div>
          ) : null}
        </div>
      </nav>
      <div className="kwrite-toolbar konqueror-toolbar kde-chrome-surface" role="toolbar" aria-label={t("kwrite.toolbar")}>
        <span className="toolbar-grip" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="new-window" aria-label={t("kwrite.newWindow")} title={t("kwrite.newWindow")} disabled={!launcher} onClick={openNewWindow}><KWriteIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="open" aria-label={t("kwrite.openDialog")} title={t("kwrite.openDialog")} onClick={openDocument}><FolderIcon aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="save" aria-label={t("kwrite.save")} title={t("kwrite.save")} disabled={!canSave} onClick={saveDocument}><SaveIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="save-as" aria-label={t("kwrite.saveAs")} title={t("kwrite.saveAs")} disabled={!canSaveAsKWriteDocument(document)} onClick={() => openSaveAsDialog()}><SaveIcon aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="print" aria-label={t("kwrite.print")} title={t("kwrite.print")} disabled={!canPrint} onClick={printDocument}><PrintIcon aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="close" aria-label={t("kwrite.close")} title={t("kwrite.close")} onClick={requestDocumentClose}><DiscardChangesIcon aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="undo" aria-label={t("kwrite.undo")} title={t("kwrite.undo")} disabled={!canUndoKWriteHistory(history)} onClick={undo}><BackIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="redo" aria-label={t("kwrite.redo")} title={t("kwrite.redo")} disabled={!canRedoKWriteHistory(history)} onClick={redo}><ForwardIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="cut" aria-label={t("kwrite.cut")} title={t("kwrite.cut")} disabled={!hasSelection} onClick={cut}><CutIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="copy" aria-label={t("kwrite.copy")} title={t("kwrite.copy")} disabled={!hasSelection} onClick={copy}><CopyIcon aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="paste" aria-label={t("kwrite.paste")} title={t("kwrite.paste")} disabled={!canPaste} onClick={paste}><PasteIcon aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="find" aria-label={t("kwrite.find")} title={t("kwrite.find")} onClick={openFind}><FindIcon data-toolbar-icon="find" aria-hidden="true" focusable="false" /></button>
        <span className="toolbar-separator" aria-hidden="true" />
        <button type="button" className="toolbar-button" data-kwrite-action="increase-font" aria-label={t("kwrite.increaseFontSize")} title={t("kwrite.increaseFontSize")} disabled={!canIncreaseFontSize} onClick={() => setEditorFontSize((size) => Math.min(maximumKWriteEditorFontSize, size + 1))}><ZoomInIcon data-toolbar-icon="font-bigger" aria-hidden="true" focusable="false" /></button>
        <button type="button" className="toolbar-button" data-kwrite-action="decrease-font" aria-label={t("kwrite.decreaseFontSize")} title={t("kwrite.decreaseFontSize")} disabled={!canDecreaseFontSize} onClick={() => setEditorFontSize((size) => Math.max(minimumKWriteEditorFontSize, size - 1))}><ZoomOutIcon data-toolbar-icon="font-smaller" aria-hidden="true" focusable="false" /></button>
      </div>
      <main className="kwrite-main" aria-label={t("kwrite.textEditor")} aria-hidden={dialog.type !== "none" || editingDialog !== "none"}>
        <textarea
          ref={editorRef}
          className="kwrite-editor"
          aria-label={t("kwrite.editDocument", { name: document.lastKnownDisplayName })}
          value={document.draft}
          readOnly={isReadOnly || dialog.type !== "none"}
          spellCheck={false}
          wrap="off"
          style={{ fontSize: `${editorFontSize}px` }}
          onChange={handleEditorChange}
          onSelect={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
        />
      </main>
      <footer className="kwrite-statusbar" aria-live="polite">
        <span className="kwrite-statusbar__path">{currentSnapshot?.path ?? document.lastKnownPath ?? document.lastKnownName}</span>
        <span className="kwrite-statusbar__state">{translateKWriteMessage(getKWriteDocumentStatus(document), t)}</span>
      </footer>
      <KWriteDialogs
        dialog={dialog}
        state={vfs.state}
        canSaveReplacement={dialog.type === "confirm-close"
          ? getKWriteCloseSaveMode(document) !== "unavailable"
          : getKWriteReplacementSaveMode(document) !== "unavailable"}
        onCancel={handleDialogCancel}
        onDiscardReplacement={handleDiscardReplacement}
        onSaveReplacement={handleReplacementSave}
        onDiscardClose={handleDiscardClose}
        onSaveClose={handleCloseSave}
        onSelectNode={(nodeId, nodeKind) => setDialog((current) => selectKWriteDialogNode(current, nodeId, nodeKind))}
        onActivateNode={handleDialogActivateNode}
        onGoUp={() => {
          if (dialog.type === "open" || dialog.type === "save-as") {
            const parentId = getKWriteDialogParentDirectoryId(vfs.state, dialog.directoryNodeId);
            if (parentId) {
              setDialogDirectory(parentId);
            }
          }
        }}
        onGoHome={() => setDialogDirectory(vfs.state.specialLocations.home)}
        onOpenSelection={() => handleOpenSelection(dialog.type === "open" ? dialog.selectedNodeId : null)}
        onChangeFilename={(filename) => setDialog((current) => current.type === "save-as" ? { ...current, filename, error: null } : current)}
        onSaveAs={handleSaveAs}
        onReplace={() => {
          if (dialog.type === "confirm-overwrite") {
            saveAsTo(dialog.directoryNodeId, dialog.filename, dialog.pending, dialog.targetNodeId, dialog.closeTarget);
          }
        }}
      />
      {isFindOpen ? <section className="kwrite-find-surface" role="dialog" aria-label={t("kwrite.findText")}>
        <h2>{t("kwrite.findText")}</h2>
        <label>{t("kwrite.textToFind")}<input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} /></label>
        <div className="kwrite-dialog-actions"><button type="button" className="kde-raised kwrite-dialog-button" disabled={!searchQuery} onClick={() => find()}>{t("kfind.find")}</button><button type="button" className="kde-raised kwrite-dialog-button" onClick={() => setIsFindOpen(false)}>{t("kwrite.close")}</button></div>
      </section> : null}
      {editingDialog !== "none" ? <div className="kwrite-dialog-backdrop"><section className="kwrite-dialog kwrite-editing-dialog" role="dialog" aria-modal="true" aria-label={editingDialog === "replace" ? t("kwrite.replaceText") : t("kwrite.goToLine")}>
        <h2>{editingDialog === "replace" ? t("kwrite.replaceText") : t("kwrite.goToLine")}</h2>
        {editingDialog === "go-to-line" ? <label>{t("kwrite.goToLineLabel")}<input type="number" min="1" max={document.draft.split("\n").length} value={goToLine} onChange={(event) => setGoToLine(event.currentTarget.value)} /></label> : <>
          <label>{t("kwrite.textToFind")}<input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} /></label>
           {editingDialog === "replace" ? <><label>{t("kwrite.replacementText")}<input value={replacementText} onChange={(event) => setReplacementText(event.currentTarget.value)} /></label><label><input type="checkbox" disabled />{t("kwrite.usePlaceholders")} <button type="button" disabled>{t("kwrite.insertPlaceholder")}</button></label><fieldset><legend>{t("kwrite.options")}</legend>{([['caseSensitive','kfind.caseSensitive'], ['wholeWords','kwrite.wholeWords'], ['fromCursor','kwrite.fromCursor'], ['backwards','kwrite.findBackwards'], ['regularExpression','kwrite.regularExpression']] as const).map(([key,labelKey]) => <label key={key}><input type="checkbox" checked={searchOptions[key]} onChange={(event) => setSearchOptions((current) => ({ ...current, [key]: event.currentTarget.checked }))} />{t(labelKey)}{key === 'regularExpression' ? <button type="button" disabled>{t("kwrite.editRegularExpression")}</button> : null}</label>)}<label><input type="checkbox" disabled={!hasSelection} />{t("kwrite.selectedText")}</label><label><input type="checkbox" disabled />{t("kwrite.promptOnReplace")}</label></fieldset></> : null}
        </>}
        <div className="kwrite-dialog-actions"><button type="button" className="kde-raised kwrite-dialog-button" disabled={editingDialog !== "go-to-line" && !searchQuery} onClick={() => { if (editingDialog === "replace") replace(); else { const line = Number(goToLine) || 1; applySelection(getKWriteLineSelection(document.draft, line)); setEditingDialog("none"); } }}>{editingDialog === "replace" ? t("kfind.replace") : t("common.ok")}</button><button type="button" className="kde-raised kwrite-dialog-button" onClick={() => setEditingDialog("none")}>{editingDialog === "go-to-line" ? t("common.cancel") : t("kwrite.close")}</button></div>
      </section></div> : null}
    </div>
  );
}
