import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LaunchApplicationResult } from "../../application-runtime/types";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { createInitialVfsState } from "../../vfs/initialState";
import { VfsContext, type VfsContextValue } from "../../vfs/VfsContext";
import { createVfsOperations } from "../../vfs/vfsOperations";
import type { VfsState } from "../../vfs/types";
import { KFind } from "./KFind";

const makeVfsContextValue = (state: VfsState): VfsContextValue => ({
  state,
  ...createVfsOperations(
    () => state,
    () => undefined,
  ),
});

const renderKFind = (state = createInitialVfsState()) => renderToStaticMarkup(
  <ApplicationLauncherContext.Provider value={{
    launchApplication: vi.fn((): LaunchApplicationResult => "already-active"),
    launchNewApplicationInstance: vi.fn((): LaunchApplicationResult => "already-active"),
  }}>
    <VfsContext.Provider value={makeVfsContextValue(state)}>
      <KFind />
    </VfsContext.Provider>
  </ApplicationLauncherContext.Provider>,
);

describe("KFind", () => {
  it("renders the KDE3 Name/Location shell with deterministic defaults", () => {
    const markup = renderKFind();

    expect(markup).toContain("data-kfind-root=\"true\"");
    expect(markup).not.toContain("aria-label=\"KFind menu bar\"");
    expect(markup).not.toContain("aria-label=\"File menu\"");
    expect(markup).not.toContain("aria-label=\"Help menu\"");
    expect(markup).not.toContain("aria-haspopup=\"menu\"");
    expect(markup).toContain("role=\"tablist\"");
    expect(markup).toContain(">Name/Location</button>");
    expect(markup).toContain(">Contents</button>");
    expect(markup).toContain(">Properties</button>");
    expect(markup).toContain("Named:");
    expect(markup).toContain("Look in:");
    expect(markup).toContain("aria-label=\"Look in location\"");
    expect(markup).toContain("value=\"file:///home/user\"");
    expect(markup).toContain("value=\"*\"");
    expect(markup).toContain("Include subfolders");
    expect(markup).toContain("Use files index");
    expect(markup).toContain("aria-label=\"KFind results\"");
    expect(markup).toContain("In Subfolder");
    expect(markup).toContain("First Matching Line");
    expect(markup).toContain("Ready.");
  });

  it("uses normal form controls with idle Find enabled and Stop/Save As disabled", () => {
    const markup = renderKFind();

    expect(markup).toContain("aria-label=\"Name pattern\"");
    expect(markup).toContain("type=\"checkbox\"");
    expect(markup).toContain(">Find</button>");
    expect(markup).toContain("disabled=\"\"");
    expect(markup).toContain(">Stop</button>");
    expect(markup).toContain(">Save As...</button>");
    expect(markup).toContain(">Close</button>");
    expect(markup).toContain(">Help</button>");
    expect(markup).not.toContain("type=\"file\"");
  });

  it("keeps one shared result set outside the tab panel, executes immutable jobs, and opens every result in a new Konqueror instance", () => {
    const source = readFileSync(new URL("./KFind.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [activeTab, setActiveTab] = useState<KFindTab>(\"name-location\")");
    expect(source).toContain("resolveKFindLocationInput(vfs.state, locationDraft)");
    expect(source).toContain("validateKFindProperties(nextQuery.properties, new Date().toISOString())");
    expect(source).toContain("createKFindSearchJob(vfs.state, searchQuery)");
    expect(source).toContain("runKFindSearchJob(created.job");
    expect(source).toContain("searchGenerationRef");
    expect(source).toContain("mountedRef.current = true;");
    expect(source).toContain("getKFindLocationPresentation");
    expect(source).toContain('aria-label={t("kfind.lookInLocation")}');
    expect(source).toContain("getKFindResultSubfolder(rootPath, result.parentPath)");
    expect(source).toContain("getKFindResultDisplayName(node.ok ? node.value : null, result.name)");
    expect(source).toContain(">{result.displayName}</span><span>{rootPath === null ? result.parentPath");
    expect(source).toContain("kfind-tabpanel");
    expect(source.indexOf('className="kfind-results"')).toBeGreaterThan(source.indexOf("kfind-tabpanel"));
    expect(source).toContain('t("kfind.fileType")');
    expect(source).toContain("K_FIND_FILE_TYPE_OPTIONS");
    expect(source).toContain("value={query.contents.fileType}");
    expect(source).not.toContain("<select disabled aria-label=\"File type\"");
    expect(source).toContain('t("kfind.containingText")');
    expect(source).toContain("getKFindResultFirstMatchingLine(search, result.nodeId)");
    expect(source).toContain('t("kfind.includeBinary")');
    expect(source).toContain('t("kfind.searchMetainfo")');
    expect(source).toContain("<fieldset className=\"kfind-metainfo\" disabled>");
    expect(source).toContain('t("kfind.findDates")');
    expect(source).toContain("validateKFindProperties(nextQuery.properties, new Date().toISOString())");
    expect(source).toContain('aria-label={t("kfind.startDate")}');
    expect(source).toContain('aria-label={t("kfind.previousAmount")}');
    expect(source).toContain('aria-label={t("kfind.fileSizeMode")}');
    expect(source).toContain("K_FIND_SIZE_COMPARATOR_OPTIONS");
    expect(source).toContain("K_FIND_SIZE_UNIT_OPTIONS");
    expect(source).not.toContain("<fieldset className=\"kfind-criteria kfind-criteria--properties\" disabled>");
    expect(source).toContain('t("kfind.owner")');
    expect(source).toContain('t("kfind.group")');
    expect(source).toContain('aria-label={t("kfind.ownerAria")}');
    expect(source).toContain('aria-label={t("kfind.groupAria")}');
    expect(source).toContain("disabled={search.type !== \"searching\"}");
    expect(source).toContain("planKFindResultOpen(vfs.state, nodeId)");
    expect(source).toContain("launchNewApplicationInstance(plan.value.appId, { intent: plan.value.intent })");
    expect(source).not.toContain('launchApplication("konqueror"');
    expect(source).not.toContain('launchApplication("kwrite"');
    expect(source).not.toContain("createKWriteOpenTextFileIntent");
    expect(source).toContain("getKFindResultSelection");
    expect(source).not.toContain("useApplicationMenuDismissal");
    expect(source).not.toContain("kfind-menubar");
    expect(source).not.toContain("executeShellInput");
    expect(source).toContain("serializeKFindResults");
    expect(source).not.toContain("moveNode(");
    expect(source).not.toContain("deleteNode");
    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).not.toContain("new Worker");
    expect(source).not.toContain("showOpenFilePicker");
    expect(source).not.toContain("showDirectoryPicker");
    expect(source).not.toContain("eval(");
    expect(source).not.toContain("new Function");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("keeps tab criteria in normal layout flow and reserves a full Permissions header column", () => {
    const stylesheet = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

    expect(stylesheet).not.toContain(".kfind-menubar");
    expect(stylesheet).not.toContain(".kfind-menu-popup");
    expect(stylesheet).toContain(".kfind-tabpanel {\n  min-height: 150px;\n  flex: 0 0 auto;");
    expect(stylesheet).not.toContain(".kfind-criteria {\n  height: 100%;");
    expect(stylesheet).toContain(".kfind-criteria--contents .kfind-field {\n  grid-template-columns: 116px minmax(0, 1fr);\n  white-space: nowrap;");
    expect(stylesheet).toContain(".kfind-criteria--contents .kfind-metainfo {\n  display: grid;");
    expect(stylesheet).toContain("margin: 3px 0 0;");
    expect(stylesheet).toContain("72px 112px 108px minmax(130px, 1.45fr)");
  });

  it("keeps Browse as an app-local directory chooser rather than a browser picker", () => {
    const source = readFileSync(new URL("./KFind.tsx", import.meta.url), "utf8");

    expect(source).toContain('t("kfind.selectSearchLocation")');
    expect(source).toContain("directoryNodeId");
    expect(source).toContain("browse.directoryNodeId");
    expect(source).toContain("selectKFindBrowseDirectory");
    expect(source).toContain("specialLocations.home");
    expect(source).not.toContain("showDirectoryPicker");
    expect(source).not.toContain("showOpenFilePicker");
    expect(source).not.toContain("input type=\"file\"");
  });

  it("keeps query, dialogs, results, and search jobs local to each mounted KFind instance", () => {
    const source = readFileSync(new URL("./KFind.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [query, setQuery] = useState");
    expect(source).toContain("const [activeTab, setActiveTab]");
    expect(source).toContain("const [search, setSearch]");
    expect(source).toContain("const [browse, setBrowse]");
    expect(source).toContain("const [saveDialog, setSaveDialog]");
    expect(source).toContain("const activeSearchRef = useRef");
    expect(source).toContain("const searchGenerationRef = useRef(0)");
    expect(source).toContain("if (activeSearchRef.current) activeSearchRef.current.job.cancelled = true;");
    expect(source).not.toContain("currentKFind");
    expect(source).not.toContain("Map<WindowId");
  });

  it("stores the save notice as a translation key so a later locale switch can re-render it", () => {
    const source = readFileSync(new URL("./KFind.tsx", import.meta.url), "utf8");

    expect(source).toContain("useState<TranslationKey | null>(null)");
    expect(source).toContain('setStatusNotice("kfind.resultsSaved")');
    expect(source).not.toContain('setStatusNotice(t("kfind.resultsSaved"))');
  });
});
