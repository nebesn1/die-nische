import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { getVfsNodeById, getVfsPathForNode, listVfsDirectory } from "../../vfs/queries";
import { joinVfsPath, validateVfsNodeName } from "../../vfs/path";
import type { VfsNodeId, VfsState } from "../../vfs/types";
import { getVfsSearchResultMetadata, type VfsSearchResultMetadata } from "../../vfs/vfsSearch";
import { useVfs } from "../../vfs/useVfs";
import { formatVfsByteSize, formatVfsModifiedTime } from "../konqueror/formatters";
import {
  createInitialKFindQuery,
  getKFindResultDisplayName,
  getKFindResultFirstMatchingLine,
  getKFindResultSubfolder,
  getKFindResultNodeIds,
  initialKFindSearchState,
  K_FIND_FILE_TYPE_OPTIONS,
  K_FIND_PREVIOUS_UNIT_OPTIONS,
  K_FIND_SIZE_COMPARATOR_OPTIONS,
  K_FIND_SIZE_UNIT_OPTIONS,
  toVfsSearchQuery,
  type KFindTab,
  type KFindSearchState,
  validateKFindProperties,
} from "./kfindModel";
import { selectKFindBrowseDirectory } from "./browseController";
import { getKFindLocationPresentation, resolveKFindLocationInput } from "./locationModel";
import { planKFindResultOpen } from "./resultOpen";
import { getKFindResultSelection } from "./resultSelection";
import { createKFindSearchJob, runKFindSearchJob, type KFindSearchJob } from "./searchExecution";
import { getKFindSaveFilename, serializeKFindResults } from "./saveResults";
import { translateKFindMessage } from "./kfindI18n";
import { KFindSaveDialog } from "./KFindSaveDialog";
import { initialKFindSaveDialogState, type KFindSaveDialogState } from "./saveDialogModel";
import { enterVfsDialogDirectory, getVfsDialogDirectory, getVfsDialogParentDirectoryId, resolveVfsDialogTargetDirectory, selectVfsDialogDirectory } from "../../vfs/vfsDialogController";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";

type KFindBrowseState = {
  readonly directoryNodeId: VfsNodeId;
  readonly selectedNodeId: VfsNodeId | null;
  readonly error: string | null;
} | null;

type KFindProps = {
  readonly onRequestClose?: () => void;
};

const getDirectoryPath = (state: VfsState, nodeId: VfsNodeId): string | null => {
  const node = getVfsNodeById(state, nodeId);
  if (!node.ok || node.value.kind !== "directory") return null;
  const path = getVfsPathForNode(state, nodeId);
  return path.ok ? path.value : null;
};

const getSearchStatus = (search: KFindSearchState, notice: TranslationKey | null, t: ReturnType<typeof useI18n>["t"]): string => {
  if (notice !== null) return t(notice);
  if (search.type === "error") return translateKFindMessage(search.message, t);
  if (search.type === "searching") return t("kfind.searching");
  if (search.type === "cancelled") return t("kfind.searchStopped");
  return t("kfind.ready");
};

const getResultSummary = (search: KFindSearchState, liveResultCount: number, t: ReturnType<typeof useI18n>["t"]): string => {
  if (search.type === "idle" || (search.type === "error" && getKFindResultNodeIds(search).length === 0)) return "";
  if (liveResultCount === 1) return t("kfind.oneFileFound");
  return t("kfind.filesFound", { count: liveResultCount });
};

const kFindFileTypeKeys: Readonly<Record<"all" | "files" | "folders" | "text-files", TranslationKey>> = {
  all: "kfind.option.all",
  files: "kfind.option.files",
  folders: "kfind.option.folders",
  "text-files": "kfind.option.textFiles",
};
const kFindPreviousUnitKeys: Readonly<Record<"hours" | "days" | "weeks", TranslationKey>> = {
  hours: "kfind.option.hours",
  days: "kfind.option.days",
  weeks: "kfind.option.weeks",
};
const kFindDateUnitKeys: Readonly<Record<"hours" | "days" | "weeks", TranslationKey>> = kFindPreviousUnitKeys;
const kFindSizeComparatorKeys: Readonly<Record<"none" | "at-least" | "at-most" | "equal", TranslationKey>> = {
  none: "kfind.option.none",
  "at-least": "kfind.option.atLeast",
  "at-most": "kfind.option.atMost",
  equal: "kfind.option.equal",
};
const kFindSizeUnitKeys: Readonly<Record<"bytes" | "kb" | "mb", TranslationKey>> = {
  bytes: "kfind.option.bytes",
  kb: "kfind.option.kb",
  mb: "kfind.option.mb",
};

export function KFind({ onRequestClose = () => undefined }: KFindProps) {
  const { locale, t } = useI18n();
  const vfs = useVfs();
  const { launchNewApplicationInstance } = useApplicationLauncher();
  const [query, setQuery] = useState(() => createInitialKFindQuery(vfs.state));
  const [locationDraft, setLocationDraft] = useState(() => {
    const presentation = getKFindLocationPresentation(vfs.state, vfs.state.specialLocations.home);
    return presentation.ok ? presentation.value : "file:///home/user";
  });
  const [isLocationDraftDirty, setIsLocationDraftDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<KFindTab>("name-location");
  const [search, setSearch] = useState<KFindSearchState>(initialKFindSearchState);
  const [selectedResultNodeId, setSelectedResultNodeId] = useState<VfsNodeId | null>(null);
  const [browse, setBrowse] = useState<KFindBrowseState>(null);
  const [isAboutVisible, setIsAboutVisible] = useState(false);
  const [saveDialog, setSaveDialog] = useState<KFindSaveDialogState>(initialKFindSaveDialogState);
  const [statusNotice, setStatusNotice] = useState<TranslationKey | null>(null);
  const resultTableRef = useRef<HTMLDivElement | null>(null);
  const activeSearchRef = useRef<{ readonly generation: number; readonly job: KFindSearchJob } | null>(null);
  const searchGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Strict Mode rehearses effect cleanup on initial mount; each setup owns a live component again.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activeSearchRef.current) activeSearchRef.current.job.cancelled = true;
      activeSearchRef.current = null;
      searchGenerationRef.current += 1;
    };
  }, []);

  const rootPath = getDirectoryPath(vfs.state, query.nameLocation.locationNodeId);
  const rootLocation = getKFindLocationPresentation(vfs.state, query.nameLocation.locationNodeId);
  const displayedLocation = isLocationDraftDirty
    ? locationDraft
    : rootLocation.ok ? rootLocation.value : locationDraft;
  const resultNodeIds = getKFindResultNodeIds(search);
  const liveResults = useMemo<readonly VfsSearchResultMetadata[]>(
    () => resultNodeIds
      .map((nodeId) => getVfsSearchResultMetadata(vfs.state, nodeId))
      .filter((result): result is { readonly ok: true; readonly value: VfsSearchResultMetadata } => result.ok)
      .map((result) => result.value),
    [resultNodeIds, vfs.state],
  );
  const liveResultIds = liveResults.map((result) => result.nodeId);
  const resultRows = liveResults.map((result) => {
    const node = getVfsNodeById(vfs.state, result.nodeId);
    return {
      ...result,
      displayName: getKFindResultDisplayName(node.ok ? node.value : null, result.name),
      modifiedAt: node.ok ? node.value.modifiedAt : null,
    };
  });

  useEffect(() => {
    if (selectedResultNodeId !== null && !liveResultIds.includes(selectedResultNodeId)) {
      setSelectedResultNodeId(null);
    }
  }, [liveResultIds, selectedResultNodeId]);

  const getSearchState = (type: "searching" | "completed" | "cancelled", results: readonly VfsSearchResultMetadata[]): KFindSearchState => ({
    type,
    resultNodeIds: results.map((result) => result.nodeId),
    firstMatchingLineByNodeId: Object.fromEntries(results.flatMap((result) => result.firstMatchingLine === null ? [] : [[result.nodeId, result.firstMatchingLine]])),
  });

  const getErrorState = (message: string): KFindSearchState => ({
    type: "error",
    message,
    resultNodeIds: getKFindResultNodeIds(search),
    firstMatchingLineByNodeId: Object.fromEntries(getKFindResultNodeIds(search).flatMap((nodeId) => {
      const firstMatchingLine = getKFindResultFirstMatchingLine(search, nodeId);
      return firstMatchingLine === null ? [] : [[nodeId, firstMatchingLine]];
    })),
  });

  const executeSearch = () => {
    if (search.type === "searching") return;
    setStatusNotice(null);
    let nextQuery = query;
    if (isLocationDraftDirty) {
      const location = resolveKFindLocationInput(vfs.state, locationDraft);
      if (!location.ok) {
        setSelectedResultNodeId(null);
        setSearch(getErrorState(location.error.code === "NOT_DIRECTORY" ? t("kfind.locationNotFolder") : t("kfind.locationUnavailable")));
        return;
      }

      nextQuery = {
        ...query,
        nameLocation: { ...query.nameLocation, locationNodeId: location.value.nodeId },
      };
      setQuery(nextQuery);
      setLocationDraft(location.value.presentation);
      setIsLocationDraftDirty(false);
    }

    const properties = validateKFindProperties(nextQuery.properties, new Date().toISOString());
    if (!properties.ok) {
      setSelectedResultNodeId(null);
      setSearch(getErrorState(properties.message));
      return;
    }

    const searchQuery = toVfsSearchQuery(nextQuery, properties.value);
    const created = createKFindSearchJob(vfs.state, searchQuery);
    if (!created.ok) {
      setSearch(getErrorState(created.message));
      return;
    }
    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    activeSearchRef.current = { generation, job: created.job };
    setSelectedResultNodeId(null);
    setSearch(getSearchState("searching", []));
    void runKFindSearchJob(created.job, (event) => {
      const active = activeSearchRef.current;
      if (!mountedRef.current || active === null || active.generation !== generation) return;
      if (event.type === "error") {
        activeSearchRef.current = null;
        setSearch(getErrorState(event.message));
      } else if (event.type === "results") {
        setSearch(getSearchState("searching", event.results));
      } else {
        activeSearchRef.current = null;
        setSearch(getSearchState(event.type, event.results));
      }
    });
  };

  const stopSearch = () => {
    const active = activeSearchRef.current;
    if (!active) return;
    active.job.cancelled = true;
    activeSearchRef.current = null;
    searchGenerationRef.current += 1;
    setSearch((current) => current.type === "searching" ? { ...current, type: "cancelled" } : current);
  };

  const openSaveDialog = () => {
    const root = getVfsNodeById(vfs.state, query.nameLocation.locationNodeId);
    const directoryNodeId = root.ok && root.value.kind === "directory" ? root.value.id : vfs.state.specialLocations.home;
    setSaveDialog({ type: "save", directoryNodeId, selectedDirectoryNodeId: null, filename: "Results.txt", autoExtension: true, error: null });
  };

  const saveResultsTo = (directoryNodeId: VfsNodeId, filename: string, targetNodeId: VfsNodeId | null) => {
    const directory = getVfsDialogDirectory(vfs.state, directoryNodeId);
    const serialized = serializeKFindResults(vfs.state, getKFindResultNodeIds(search));
    if (!directory || !serialized.ok) {
      setSaveDialog((current) => current.type === "none" ? current : { ...current, error: serialized.ok ? t("kfind.directoryUnavailable") : t("kfind.resultsUnavailable") });
      return;
    }
    if (targetNodeId !== null) {
      const target = getVfsNodeById(vfs.state, targetNodeId);
      if (!target.ok || target.value.kind !== "file" || target.value.parentId !== directory.node.id || target.value.name !== filename) {
        setSaveDialog({ type: "save", directoryNodeId, selectedDirectoryNodeId: null, filename, autoExtension: true, error: t("kfind.replacementUnavailable") });
        return;
      }
    }
    const path = targetNodeId === null ? undefined : joinVfsPath(directory.path, filename);
    const saved = path
      ? vfs.writeTextFile(path, serialized.value, { now: new Date().toISOString() })
      : vfs.createTextFile(directory.path, filename, serialized.value, { now: new Date().toISOString(), mimeType: "text/plain" });
    if (!saved.ok) { setSaveDialog((current) => current.type === "none" ? current : { ...current, error: translateKFindMessage(saved.error.message, t) }); return; }
    setSaveDialog(initialKFindSaveDialogState);
    setStatusNotice("kfind.resultsSaved");
  };

  const submitSave = () => {
    if (saveDialog.type !== "save") return;
    const filename = getKFindSaveFilename(saveDialog.filename, saveDialog.autoExtension);
    const validName = validateVfsNodeName(filename);
    if (!validName.ok) { setSaveDialog({ ...saveDialog, error: translateKFindMessage(validName.error.message, t) }); return; }
    const targetDirectory = resolveVfsDialogTargetDirectory(
      vfs.state,
      saveDialog.directoryNodeId,
      saveDialog.selectedDirectoryNodeId,
    );
    if (!targetDirectory.ok) {
      setSaveDialog({ ...saveDialog, error: t("kfind.directoryUnavailable") });
      return;
    }
    const directory = getVfsDialogDirectory(vfs.state, targetDirectory.value);
    if (!directory) { setSaveDialog({ ...saveDialog, error: t("kfind.directoryUnavailable") }); return; }
    const existing = directory.children.find((node) => node.name === validName.value) ?? null;
    if (!existing) { saveResultsTo(directory.node.id, validName.value, null); return; }
    if (existing.kind === "directory") { setSaveDialog({ ...saveDialog, error: t("kfind.folderExists") }); return; }
    setSaveDialog({ type: "overwrite", directoryNodeId: directory.node.id, filename: validName.value, targetNodeId: existing.id, autoExtension: saveDialog.autoExtension, error: null });
  };

  const activateResult = (nodeId: VfsNodeId) => {
    const plan = planKFindResultOpen(vfs.state, nodeId);
    if (!plan.ok) {
      setSearch(getErrorState(t("kfind.selectedResultUnavailable")));
      setSelectedResultNodeId(null);
      return;
    }

    launchNewApplicationInstance(plan.value.appId, { intent: plan.value.intent });
  };

  const openBrowse = () => {
    const rootNode = getVfsNodeById(vfs.state, query.nameLocation.locationNodeId);
    setBrowse({
      directoryNodeId: rootNode.ok && rootNode.value.kind === "directory" ? rootNode.value.id : vfs.state.specialLocations.home,
      selectedNodeId: null,
      error: null,
    });
  };

  const chooseBrowseDirectory = () => {
    if (browse === null) return;

    const selected = selectKFindBrowseDirectory(vfs.state, browse.directoryNodeId, browse.selectedNodeId);
    if (!selected.ok) {
      setBrowse((current) => current === null ? current : { ...current, error: t("kfind.locationUnavailable") });
      return;
    }

    const presentation = getKFindLocationPresentation(vfs.state, selected.value);
    setQuery((current) => ({
      ...current,
      nameLocation: { ...current.nameLocation, locationNodeId: selected.value },
    }));
    if (presentation.ok) setLocationDraft(presentation.value);
    setIsLocationDraftDirty(false);
    setBrowse(null);
  };

  const navigateSaveDialogDirectory = (directoryNodeId: VfsNodeId) => {
    const next = enterVfsDialogDirectory(directoryNodeId);
    setSaveDialog((current) => current.type === "save"
      ? { ...current, directoryNodeId: next.currentDirectoryNodeId, selectedDirectoryNodeId: next.selectedDirectoryNodeId, error: null }
      : current);
  };

  const selectSaveDialogDirectory = (selectedDirectoryNodeId: VfsNodeId) => {
    setSaveDialog((current) => {
      if (current.type !== "save") return current;
      const next = selectVfsDialogDirectory(current.directoryNodeId, selectedDirectoryNodeId);
      return { ...current, selectedDirectoryNodeId: next.selectedDirectoryNodeId, error: null };
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (browse !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        setBrowse(null);
      } else if (event.key === "Enter") {
        event.preventDefault();
        chooseBrowseDirectory();
      }
      return;
    }

  };

  const handleResultKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && selectedResultNodeId !== null && liveResultIds.includes(selectedResultNodeId)) {
      event.preventDefault();
      activateResult(selectedResultNodeId);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const nextSelection = getKFindResultSelection(
      liveResultIds,
      selectedResultNodeId,
      event.key === "ArrowDown" ? "next" : "previous",
    );
    if (nextSelection !== null) {
      event.preventDefault();
      setSelectedResultNodeId(nextSelection);
    }
  };

  const browsePath = browse === null ? null : getDirectoryPath(vfs.state, browse.directoryNodeId);
  const browseListing = browsePath === null ? null : listVfsDirectory(vfs.state, browsePath);
  const browseChildren = browseListing?.ok
    ? browseListing.value.filter((node) => node.kind === "directory")
    : [];
  const browseParentId = browse === null
    ? null
    : (() => {
      const node = getVfsNodeById(vfs.state, browse.directoryNodeId);
      return node.ok ? node.value.parentId : null;
    })();

  return (
    <div className="kfind-app" data-kfind-root="true" onKeyDownCapture={handleKeyDown}>
      <form className="kfind-search-shell" onSubmit={(event) => { event.preventDefault(); executeSearch(); }} aria-hidden={browse !== null || saveDialog.type !== "none"}>
        <div className="kfind-main-column">
          <div className="kfind-tabs" role="tablist" aria-label={t("kfind.searchCriteria")}>
            <button type="button" role="tab" id="kfind-tab-name-location" aria-selected={activeTab === "name-location"} aria-controls="kfind-tabpanel" className={`kfind-tab${activeTab === "name-location" ? " is-active" : ""}`} onClick={() => setActiveTab("name-location")}>{t("kfind.nameLocation")}</button>
            <button type="button" role="tab" id="kfind-tab-contents" aria-selected={activeTab === "contents"} aria-controls="kfind-tabpanel" className={`kfind-tab${activeTab === "contents" ? " is-active" : ""}`} onClick={() => setActiveTab("contents")}>{t("kfind.contents")}</button>
            <button type="button" role="tab" id="kfind-tab-properties" aria-selected={activeTab === "properties"} aria-controls="kfind-tabpanel" className={`kfind-tab${activeTab === "properties" ? " is-active" : ""}`} onClick={() => setActiveTab("properties")}>{t("kfind.properties")}</button>
          </div>
          <section id="kfind-tabpanel" className="kfind-tabpanel" role="tabpanel" aria-labelledby={`kfind-tab-${activeTab}`}>
            {activeTab === "name-location" ? (
              <div className="kfind-criteria kfind-criteria--name-location">
                <label className="kfind-field">{t("kfind.named")}
                  <input value={query.nameLocation.namePattern} onChange={(event) => { const namePattern = event.currentTarget.value; setQuery((current) => ({ ...current, nameLocation: { ...current.nameLocation, namePattern } })); }} aria-label={t("kfind.namePattern")} />
                </label>
                <label className="kfind-field">{t("kfind.lookIn")}
                  <span className="kfind-location"><input value={displayedLocation} onChange={(event) => { setLocationDraft(event.currentTarget.value); setIsLocationDraftDirty(true); }} aria-label={t("kfind.lookInLocation")} /><button type="button" className="kde-raised" onClick={openBrowse}>{t("kfind.browse")}</button></span>
                </label>
                <div className="kfind-check-stack">
                  <label className="kfind-checkbox"><input type="checkbox" checked={query.nameLocation.includeSubdirectories} onChange={(event) => { const includeSubdirectories = event.currentTarget.checked; setQuery((current) => ({ ...current, nameLocation: { ...current.nameLocation, includeSubdirectories } })); }} />{t("kfind.includeSubfolders")}</label>
                  <label className="kfind-checkbox"><input type="checkbox" checked={query.nameLocation.caseSensitive} onChange={(event) => { const caseSensitive = event.currentTarget.checked; setQuery((current) => ({ ...current, nameLocation: { ...current.nameLocation, caseSensitive } })); }} />{t("kfind.caseSensitive")}</label>
                  <label className="kfind-checkbox"><input type="checkbox" disabled />{t("kfind.useFilesIndex")}</label>
                </div>
              </div>
            ) : null}
            {activeTab === "contents" ? (
              <div className="kfind-criteria kfind-criteria--contents">
                <label className="kfind-field">{t("kfind.fileType")}
                  <select value={query.contents.fileType} onChange={(event) => { const fileType = event.currentTarget.value; setQuery((current) => ({ ...current, contents: { ...current.contents, fileType: fileType === "files" || fileType === "folders" || fileType === "text-files" ? fileType : "all" } })); }} aria-label={t("kfind.fileTypeAria")}>
                    {K_FIND_FILE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(kFindFileTypeKeys[option.value])}</option>)}
                  </select>
                </label>
                <label className="kfind-field">{t("kfind.containingText")}
                  <input value={query.contents.containingText} onChange={(event) => { const containingText = event.currentTarget.value; setQuery((current) => ({ ...current, contents: { ...current.contents, containingText } })); }} aria-label={t("kfind.containingText")} />
                </label>
                <div className="kfind-check-stack">
                  <label className="kfind-checkbox"><input type="checkbox" checked={query.contents.caseSensitive} onChange={(event) => { const caseSensitive = event.currentTarget.checked; setQuery((current) => ({ ...current, contents: { ...current.contents, caseSensitive } })); }} />{t("kfind.caseSensitive")}</label>
                  <label className="kfind-checkbox"><input type="checkbox" disabled />{t("kfind.includeBinary")}</label>
                </div>
                <fieldset className="kfind-metainfo" disabled><legend>{t("kfind.searchMetainfo")}</legend><label><select><option>*</option></select> {t("kfind.for")}</label><input aria-label={t("kfind.metainfoQuery")} /></fieldset>
              </div>
            ) : null}
            {activeTab === "properties" ? (
              <fieldset className="kfind-criteria kfind-criteria--properties">
                <label className="kfind-checkbox"><input type="checkbox" checked={query.properties.time.enabled} onChange={(event) => { const enabled = event.currentTarget.checked; setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, enabled } } })); }} />{t("kfind.findDates")}</label>
                <div className="kfind-property-row"><label><input type="radio" name="kfind-time" disabled={!query.properties.time.enabled} checked={query.properties.time.mode === "between"} onChange={() => setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, mode: "between" } } }))} />{t("kfind.between")}</label><input type="date" aria-label={t("kfind.startDate")} disabled={!query.properties.time.enabled || query.properties.time.mode !== "between"} value={query.properties.time.fromDate} onChange={(event) => { const fromDate = event.currentTarget.value; setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, fromDate } } })); }} /><span>{t("kfind.and")}</span><input type="date" aria-label={t("kfind.endDate")} disabled={!query.properties.time.enabled || query.properties.time.mode !== "between"} value={query.properties.time.toDate} onChange={(event) => { const toDate = event.currentTarget.value; setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, toDate } } })); }} /></div>
                <div className="kfind-property-row"><label><input type="radio" name="kfind-time" disabled={!query.properties.time.enabled} checked={query.properties.time.mode === "previous"} onChange={() => setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, mode: "previous" } } }))} />{t("kfind.duringPrevious")}</label><input type="number" min="1" step="any" aria-label={t("kfind.previousAmount")} disabled={!query.properties.time.enabled || query.properties.time.mode !== "previous"} value={query.properties.time.previousValue} onChange={(event) => { const previousValue = event.currentTarget.value; setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, previousValue } } })); }} /><select aria-label={t("kfind.previousUnit")} disabled={!query.properties.time.enabled || query.properties.time.mode !== "previous"} value={query.properties.time.previousUnit} onChange={(event) => { const previousUnit = event.currentTarget.value === "hours" || event.currentTarget.value === "weeks" ? event.currentTarget.value : "days"; setQuery((current) => ({ ...current, properties: { ...current.properties, time: { ...current.properties.time, previousUnit } } })); }}>{K_FIND_PREVIOUS_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(kFindDateUnitKeys[option.value])}</option>)}</select></div>
                <div className="kfind-property-row"><label>{t("kfind.fileSizeIs")}</label><select aria-label={t("kfind.fileSizeMode")} value={query.properties.size.comparator} onChange={(event) => { const comparator = event.currentTarget.value === "at-least" || event.currentTarget.value === "at-most" || event.currentTarget.value === "equal" ? event.currentTarget.value : "none"; setQuery((current) => ({ ...current, properties: { ...current.properties, size: { ...current.properties.size, comparator } } })); }}>{K_FIND_SIZE_COMPARATOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(kFindSizeComparatorKeys[option.value])}</option>)}</select><input type="number" min="0" step="any" aria-label={t("kfind.fileSizeValue")} disabled={query.properties.size.comparator === "none"} value={query.properties.size.value} onChange={(event) => { const value = event.currentTarget.value; setQuery((current) => ({ ...current, properties: { ...current.properties, size: { ...current.properties.size, value } } })); }} /><select aria-label={t("kfind.fileSizeUnit")} disabled={query.properties.size.comparator === "none"} value={query.properties.size.unit} onChange={(event) => { const unit = event.currentTarget.value === "bytes" || event.currentTarget.value === "mb" ? event.currentTarget.value : "kb"; setQuery((current) => ({ ...current, properties: { ...current.properties, size: { ...current.properties.size, unit } } })); }}>{K_FIND_SIZE_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(kFindSizeUnitKeys[option.value])}</option>)}</select></div>
                <label className="kfind-property-input">{t("kfind.owner")}<input aria-label={t("kfind.ownerAria")} disabled value={query.properties.owner} readOnly /></label>
                <label className="kfind-property-input">{t("kfind.group")}<input aria-label={t("kfind.groupAria")} disabled value={query.properties.group} readOnly /></label>
              </fieldset>
            ) : null}
          </section>
          <section className="kfind-results" aria-label={t("kfind.results")}>
            <div ref={resultTableRef} className="kfind-results__table" role="table" tabIndex={0} aria-label={t("kfind.resultsTable")} onKeyDown={handleResultKeyDown}>
              <div className="kfind-results__header" role="row"><span>{t("kfind.name")}</span><span>{t("kfind.inSubfolder")}</span><span>{t("kfind.size")}</span><span>{t("kfind.modified")}</span><span>{t("kfind.permissions")}</span><span>{t("kfind.firstMatchingLine")}</span></div>
              {resultRows.map((result) => (
                <div
                  key={result.nodeId}
                  className={`kfind-result-row${selectedResultNodeId === result.nodeId ? " is-selected" : ""}`}
                  role="row"
                  tabIndex={-1}
                  aria-selected={selectedResultNodeId === result.nodeId}
                  onClick={() => { setSelectedResultNodeId(result.nodeId); resultTableRef.current?.focus(); }}
                  onDoubleClick={() => activateResult(result.nodeId)}
                ><span>{result.displayName}</span><span>{rootPath === null ? result.parentPath : getKFindResultSubfolder(rootPath, result.parentPath)}</span><span>{result.size === null ? "—" : formatVfsByteSize(result.size)}</span><span>{result.modifiedAt === null ? "—" : formatVfsModifiedTime(result.modifiedAt, { locale })}</span><span>—</span><span>{getKFindResultFirstMatchingLine(search, result.nodeId) ?? "—"}</span></div>
              ))}
            </div>
          </section>
        </div>
        <aside className="kfind-actions" aria-label={t("kfind.searchActions")}>
          <div className="kfind-actions__top"><button type="submit" className="kde-raised kfind-action-button kfind-action-button--primary" disabled={search.type === "searching"}>{t("kfind.find")}</button><button type="button" className="kde-raised kfind-action-button" disabled={search.type !== "searching"} onClick={stopSearch}>{t("kfind.stop")}</button><button type="button" className="kde-raised kfind-action-button" disabled={search.type === "searching" || resultNodeIds.length === 0} onClick={openSaveDialog}>{t("kfind.saveAs")}</button></div>
          <div className="kfind-actions__bottom"><button type="button" className="kde-raised kfind-action-button" onClick={() => { stopSearch(); onRequestClose(); }}>{t("kfind.close")}</button><button type="button" className="kde-raised kfind-action-button" onClick={() => setIsAboutVisible(true)}>{t("kfind.help")}</button></div>
        </aside>
      </form>
      <footer className="kfind-status" aria-live="polite"><span>{getSearchStatus(search, statusNotice, t)}</span><span>{getResultSummary(search, liveResults.length, t)}</span></footer>
      {isAboutVisible ? <div className="kfind-about" role="status"><span>{t("kfind.about")}</span><button type="button" className="kde-raised" onClick={() => setIsAboutVisible(false)}>{t("common.ok")}</button></div> : null}
      {browse !== null ? (
        <div className="kfind-dialog-backdrop">
          <section className="kfind-dialog" role="dialog" aria-modal="true" aria-label={t("kfind.selectSearchLocation")}>
            <h2>{t("kfind.selectSearchLocation")}</h2>
            <div className="kfind-dialog-location">{t("kfind.location")} {browsePath ?? t("kfind.unavailable")}</div>
            <div className="kfind-dialog-toolbar"><button type="button" className="kde-raised" disabled={browseParentId === null} onClick={() => browseParentId !== null && setBrowse(() => { const next = enterVfsDialogDirectory(browseParentId); return { directoryNodeId: next.currentDirectoryNodeId, selectedNodeId: next.selectedDirectoryNodeId, error: null }; })}>{t("kfind.up")}</button><button type="button" className="kde-raised" onClick={() => setBrowse(() => { const next = enterVfsDialogDirectory(vfs.state.specialLocations.home); return { directoryNodeId: next.currentDirectoryNodeId, selectedNodeId: next.selectedDirectoryNodeId, error: null }; })}>{t("kfind.home")}</button></div>
            <div className="kfind-directory-list" role="listbox" aria-label={t("kfind.directories")}>
              {browsePath === null ? <div className="kfind-dialog-error">{t("kfind.searchLocationUnavailable")}</div> : browseChildren.map((directory) => <button key={directory.id} type="button" role="option" aria-selected={browse.selectedNodeId === directory.id} className={browse.selectedNodeId === directory.id ? "is-selected" : ""} onClick={() => setBrowse((current) => current === null ? current : { ...current, selectedNodeId: selectVfsDialogDirectory(current.directoryNodeId, directory.id).selectedDirectoryNodeId, error: null })} onDoubleClick={() => { const next = enterVfsDialogDirectory(directory.id); setBrowse({ directoryNodeId: next.currentDirectoryNodeId, selectedNodeId: next.selectedDirectoryNodeId, error: null }); }}>{directory.name}</button>)}
            </div>
            {browse.error === null ? null : <div className="kfind-dialog-error" role="alert">{browse.error}</div>}
            <div className="kfind-dialog-actions"><button type="button" className="kde-raised" onClick={chooseBrowseDirectory}>{t("kfind.select")}</button><button type="button" className="kde-raised" onClick={() => setBrowse(null)}>{t("common.cancel")}</button></div>
          </section>
        </div>
      ) : null}
      <KFindSaveDialog
        dialog={saveDialog}
        state={vfs.state}
        onCancel={() => setSaveDialog((current) => current.type === "overwrite"
          ? { type: "save", directoryNodeId: current.directoryNodeId, selectedDirectoryNodeId: null, filename: current.filename, autoExtension: current.autoExtension, error: null }
          : initialKFindSaveDialogState)}
        onGoUp={() => {
          if (saveDialog.type === "save") {
            const parentId = getVfsDialogParentDirectoryId(vfs.state, saveDialog.directoryNodeId);
            if (parentId) navigateSaveDialogDirectory(parentId);
          }
        }}
        onGoHome={() => navigateSaveDialogDirectory(vfs.state.specialLocations.home)}
        onSelectDirectory={selectSaveDialogDirectory}
        onOpenDirectory={navigateSaveDialogDirectory}
        onChangeFilename={(filename) => saveDialog.type === "save" && setSaveDialog({ ...saveDialog, filename, error: null })}
        onChangeAutoExtension={(autoExtension) => saveDialog.type === "save" && setSaveDialog({ ...saveDialog, autoExtension, error: null })}
        onSave={submitSave}
        onReplace={() => saveDialog.type === "overwrite" && saveResultsTo(saveDialog.directoryNodeId, saveDialog.filename, saveDialog.targetNodeId)}
      />
    </div>
  );
}
