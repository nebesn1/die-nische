import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
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
  validateKFindProperties,
} from "./kfindModel";

describe("KFind model", () => {
  it("starts at Home with deterministic v1 search defaults", () => {
    const state = createInitialVfsState();

    expect(createInitialKFindQuery(state)).toEqual({
      nameLocation: {
        locationNodeId: state.specialLocations.home,
        namePattern: "*",
        includeSubdirectories: true,
        caseSensitive: false,
      },
      contents: {
        fileType: "all",
        containingText: "",
        caseSensitive: false,
      },
      properties: {
        time: {
          enabled: false,
          mode: "between",
          fromDate: "",
          toDate: "",
          previousValue: "1",
          previousUnit: "days",
        },
        size: {
          comparator: "none",
          value: "",
          unit: "kb",
        },
        owner: "",
        group: "",
      },
    });
    expect(initialKFindSearchState).toEqual({ type: "idle" });
  });

  it("adapts only the currently supported shared query fields to the VFS search engine", () => {
    const state = createInitialVfsState();
    const query = createInitialKFindQuery(state);

    expect(toVfsSearchQuery({
      ...query,
      nameLocation: { ...query.nameLocation, namePattern: "*.md", includeSubdirectories: false, caseSensitive: true },
      contents: { fileType: "text-files", containingText: "KDE", caseSensitive: false },
      properties: { ...query.properties, owner: "not-used-yet" },
    })).toEqual({
      rootNodeId: state.specialLocations.home,
      namePattern: "*.md",
      includeSubdirectories: false,
      fileType: "text-files",
      containingText: "KDE",
      nameCaseSensitive: true,
      contentsCaseSensitive: false,
      timeRange: null,
      sizeFilter: null,
    });
  });

  it("keeps Name/Location and Contents case-sensitive flags independent while Properties drafts remain separate", () => {
    const state = createInitialVfsState();
    const query = createInitialKFindQuery(state);
    const nameCaseSensitive = {
      ...query,
      nameLocation: { ...query.nameLocation, caseSensitive: true },
    };
    const contentsCaseSensitive = {
      ...query,
      contents: { ...query.contents, caseSensitive: true },
    };

    expect(nameCaseSensitive.nameLocation.caseSensitive).toBe(true);
    expect(nameCaseSensitive.contents.caseSensitive).toBe(false);
    expect(contentsCaseSensitive.nameLocation.caseSensitive).toBe(false);
    expect(contentsCaseSensitive.contents.caseSensitive).toBe(true);
    expect(contentsCaseSensitive.contents.fileType).toBe("all");
    expect(contentsCaseSensitive.properties).toEqual(query.properties);
  });

  it("renders In Subfolder relative to the committed VFS search root", () => {
    expect(getKFindResultSubfolder("/home/user", "/home/user")).toBe("");
    expect(getKFindResultSubfolder("/home/user", "/home/user/Documents")).toBe("Documents");
    expect(getKFindResultSubfolder("/home/user", "/home/user/Documents/Project")).toBe("Documents/Project");
  });

  it("uses the shared VFS presentation label only for a live result name cell", () => {
    const state = createInitialVfsState();
    const node = state.nodesById["vfs-content-e594a065214576326cb903a5"];

    if (!node) throw new Error("Notes fixture missing");

    expect(getKFindResultDisplayName({ ...node, displayName: "My Notes" }, "Notes.txt")).toBe("My Notes");
    expect(getKFindResultDisplayName(node, "Notes.txt")).toBe("Notes.txt");
    expect(getKFindResultDisplayName(null, "Notes.txt")).toBe("Notes.txt");
  });

  it("exposes stable result identity for incremental, completed, and cancelled snapshots", () => {
    expect(getKFindResultNodeIds({ type: "idle" })).toEqual([]);
    expect(getKFindResultNodeIds({ type: "error", message: "Unavailable" })).toEqual([]);
    const completed = { type: "completed" as const, resultNodeIds: ["vfs-content-e594a065214576326cb903a5"], firstMatchingLineByNodeId: { "vfs-content-e594a065214576326cb903a5": "robot" } };
    expect(getKFindResultNodeIds(completed)).toEqual(["vfs-content-e594a065214576326cb903a5"]);
    expect(getKFindResultFirstMatchingLine(completed, "vfs-content-e594a065214576326cb903a5")).toBe("robot");
    expect(getKFindResultNodeIds({ ...completed, type: "searching" })).toEqual(["vfs-content-e594a065214576326cb903a5"]);
    expect(getKFindResultNodeIds({ ...completed, type: "cancelled" })).toEqual(["vfs-content-e594a065214576326cb903a5"]);
  });

  it("keeps the coarse file type draft in Contents separate from Properties", () => {
    const query = createInitialKFindQuery(createInitialVfsState());
    const foldersOnly = { ...query, contents: { ...query.contents, fileType: "folders" as const } };

    expect(toVfsSearchQuery(foldersOnly).fileType).toBe("folders");
    expect(foldersOnly.properties).toEqual(query.properties);
  });

  it("defines the exact enabled Contents file-type labels separately from their VFS values", () => {
    expect(K_FIND_FILE_TYPE_OPTIONS).toEqual([
      { value: "all", label: "All Files & Folders" },
      { value: "files", label: "Files" },
      { value: "folders", label: "Folders" },
      { value: "text-files", label: "Text Files" },
    ]);
  });

  it("defaults Properties to inactive filters and validates inclusive calendar-date ranges", () => {
    const properties = createInitialKFindQuery(createInitialVfsState()).properties;

    expect(validateKFindProperties(properties, "2026-08-11T12:00:00.000Z")).toEqual({
      ok: true,
      value: { timeRange: null, sizeFilter: null },
    });
    expect(validateKFindProperties({
      ...properties,
      time: { ...properties.time, enabled: true, fromDate: "2026-08-10", toDate: "2026-08-11" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({
      ok: true,
      value: {
        timeRange: {
          startInclusiveMs: Date.parse("2026-08-10T00:00:00.000Z"),
          endInclusiveMs: Date.parse("2026-08-11T23:59:59.999Z"),
        },
        sizeFilter: null,
      },
    });
  });

  it("rejects invalid active drafts and converts previous periods and exact byte units", () => {
    const properties = createInitialKFindQuery(createInitialVfsState()).properties;

    expect(validateKFindProperties({
      ...properties,
      time: { ...properties.time, enabled: true, fromDate: "2026-08-12", toDate: "2026-08-11" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({ ok: false, message: "Invalid date range." });
    expect(validateKFindProperties({
      ...properties,
      time: { ...properties.time, enabled: true, mode: "previous", previousValue: "0" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({ ok: false, message: "Invalid previous period." });
    expect(validateKFindProperties({
      ...properties,
      time: { ...properties.time, enabled: true, mode: "previous", previousValue: "1", previousUnit: "weeks" },
      size: { comparator: "equal", value: "1", unit: "mb" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({
      ok: true,
      value: {
        timeRange: {
          startInclusiveMs: Date.parse("2026-08-04T12:00:00.000Z"),
          endInclusiveMs: Date.parse("2026-08-11T12:00:00.000Z"),
        },
        sizeFilter: { comparator: "equal", thresholdBytes: 1024 * 1024 },
      },
    });
    expect(validateKFindProperties({
      ...properties,
      size: { comparator: "at-most", value: "", unit: "bytes" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({ ok: false, message: "Invalid file size." });
  });

  it("uses one injected search-now boundary for each supported previous unit", () => {
    const properties = createInitialKFindQuery(createInitialVfsState()).properties;
    const searchNow = "2026-08-11T12:00:00.000Z";
    const previous = (previousValue: string, previousUnit: "hours" | "days" | "weeks") => validateKFindProperties({
      ...properties,
      time: { ...properties.time, enabled: true, mode: "previous", previousValue, previousUnit },
    }, searchNow);

    expect(previous("1", "hours")).toMatchObject({ value: { timeRange: { startInclusiveMs: Date.parse("2026-08-11T11:00:00.000Z"), endInclusiveMs: Date.parse(searchNow) } } });
    expect(previous("1", "days")).toMatchObject({ value: { timeRange: { startInclusiveMs: Date.parse("2026-08-10T12:00:00.000Z"), endInclusiveMs: Date.parse(searchNow) } } });
    expect(previous("1", "weeks")).toMatchObject({ value: { timeRange: { startInclusiveMs: Date.parse("2026-08-04T12:00:00.000Z"), endInclusiveMs: Date.parse(searchNow) } } });
    expect(previous("-1", "days")).toEqual({ ok: false, message: "Invalid previous period." });
    expect(previous("", "days")).toEqual({ ok: false, message: "Invalid previous period." });
  });

  it("keeps inactive invalid drafts out of the VFS query and accepts zero-byte equality", () => {
    const properties = createInitialKFindQuery(createInitialVfsState()).properties;

    expect(validateKFindProperties({
      ...properties,
      time: { ...properties.time, fromDate: "not-a-date", toDate: "" },
      size: { comparator: "none", value: "not-a-number", unit: "kb" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({ ok: true, value: { timeRange: null, sizeFilter: null } });
    expect(validateKFindProperties({
      ...properties,
      size: { comparator: "equal", value: "0", unit: "bytes" },
    }, "2026-08-11T12:00:00.000Z")).toEqual({
      ok: true,
      value: { timeRange: null, sizeFilter: { comparator: "equal", thresholdBytes: 0 } },
    });
  });

  it("keeps Properties UI labels separate from typed predicate values", () => {
    expect(K_FIND_PREVIOUS_UNIT_OPTIONS.map((option) => option.label)).toEqual(["hour(s)", "day(s)", "week(s)"]);
    expect(K_FIND_SIZE_COMPARATOR_OPTIONS.map((option) => option.label)).toEqual(["(none)", "At Least", "At Most", "Equal To"]);
    expect(K_FIND_SIZE_UNIT_OPTIONS.map((option) => option.label)).toEqual(["Bytes", "KB", "MB"]);
  });
});
