import type { VfsNodeId, VfsState } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import type { VfsNode } from "../../vfs/types";
import {
  normalizeVfsSearchFileType,
  type VfsSearchFileType,
  type VfsSearchQuery,
  type VfsSearchSizeComparator,
  type VfsSearchSizeFilter,
  type VfsSearchTimeRange,
} from "../../vfs/vfsSearch";

export type KFindTab = "name-location" | "contents" | "properties";

export const K_FIND_FILE_TYPE_OPTIONS: readonly { readonly value: VfsSearchFileType; readonly label: string }[] = [
  { value: "all", label: "All Files & Folders" },
  { value: "files", label: "Files" },
  { value: "folders", label: "Folders" },
  { value: "text-files", label: "Text Files" },
];

export type KFindPreviousUnit = "hours" | "days" | "weeks";
export type KFindSizeComparator = "none" | VfsSearchSizeComparator;
export type KFindSizeUnit = "bytes" | "kb" | "mb";

export const K_FIND_PREVIOUS_UNIT_OPTIONS: readonly { readonly value: KFindPreviousUnit; readonly label: string }[] = [
  { value: "hours", label: "hour(s)" },
  { value: "days", label: "day(s)" },
  { value: "weeks", label: "week(s)" },
];

export const K_FIND_SIZE_COMPARATOR_OPTIONS: readonly { readonly value: KFindSizeComparator; readonly label: string }[] = [
  { value: "none", label: "(none)" },
  { value: "at-least", label: "At Least" },
  { value: "at-most", label: "At Most" },
  { value: "equal", label: "Equal To" },
];

export const K_FIND_SIZE_UNIT_OPTIONS: readonly { readonly value: KFindSizeUnit; readonly label: string }[] = [
  { value: "bytes", label: "Bytes" },
  { value: "kb", label: "KB" },
  { value: "mb", label: "MB" },
];

export interface KFindQuery {
  readonly nameLocation: {
    readonly locationNodeId: VfsNodeId;
    readonly namePattern: string;
    readonly includeSubdirectories: boolean;
    readonly caseSensitive: boolean;
  };
  readonly contents: {
    readonly fileType: VfsSearchFileType;
    readonly containingText: string;
    readonly caseSensitive: boolean;
  };
  readonly properties: {
    readonly time: {
      readonly enabled: boolean;
      readonly mode: "between" | "previous";
      readonly fromDate: string;
      readonly toDate: string;
      readonly previousValue: string;
      readonly previousUnit: KFindPreviousUnit;
    };
    readonly size: {
      readonly comparator: KFindSizeComparator;
      readonly value: string;
      readonly unit: KFindSizeUnit;
    };
    readonly owner: string;
    readonly group: string;
  };
}

export type KFindPropertiesFilters = {
  readonly timeRange: VfsSearchTimeRange | null;
  readonly sizeFilter: VfsSearchSizeFilter | null;
};

export type KFindPropertiesValidation =
  | { readonly ok: true; readonly value: KFindPropertiesFilters }
  | { readonly ok: false; readonly message: "Invalid date range." | "Invalid previous period." | "Invalid file size." };

const EMPTY_PROPERTIES_FILTERS: KFindPropertiesFilters = { timeRange: null, sizeFilter: null };

export type KFindSearchState =
  | { readonly type: "idle" }
  | {
    readonly type: "searching" | "completed" | "cancelled";
    readonly resultNodeIds: readonly VfsNodeId[];
    readonly firstMatchingLineByNodeId: Readonly<Record<VfsNodeId, string>>;
  }
  | {
    readonly type: "error";
    readonly message: string;
    readonly resultNodeIds?: readonly VfsNodeId[];
    readonly firstMatchingLineByNodeId?: Readonly<Record<VfsNodeId, string>>;
  };

export const initialKFindSearchState: KFindSearchState = { type: "idle" };

export function createInitialKFindQuery(state: VfsState): KFindQuery {
  return {
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
  };
}

/** Adapts the currently supported v1 subset to the existing synchronous VFS search engine. */
export function toVfsSearchQuery(
  query: KFindQuery,
  properties: KFindPropertiesFilters = EMPTY_PROPERTIES_FILTERS,
): VfsSearchQuery {
  return {
    rootNodeId: query.nameLocation.locationNodeId,
    namePattern: query.nameLocation.namePattern,
    includeSubdirectories: query.nameLocation.includeSubdirectories,
    fileType: normalizeVfsSearchFileType(query.contents.fileType),
    containingText: query.contents.containingText,
    nameCaseSensitive: query.nameLocation.caseSensitive,
    contentsCaseSensitive: query.contents.caseSensitive,
    timeRange: properties.timeRange,
    sizeFilter: properties.sizeFilter,
  };
}

const parseCalendarDateStart = (value: string): number | null => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (matched === null) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null;
};

const getPreviousDurationMilliseconds = (value: string, unit: KFindPreviousUnit): number | null => {
  if (value.trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unitMilliseconds = unit === "hours" ? 60 * 60 * 1000 : unit === "days" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const duration = amount * unitMilliseconds;
  return Number.isFinite(duration) ? duration : null;
};

const getSizeMultiplier = (unit: KFindSizeUnit): number => unit === "bytes" ? 1 : unit === "kb" ? 1024 : 1024 * 1024;

/** Builds validated VFS-only filters from the editable Properties draft for one Find execution. */
export function validateKFindProperties(
  properties: KFindQuery["properties"],
  searchNow: string,
): KFindPropertiesValidation {
  let timeRange: VfsSearchTimeRange | null = null;
  if (properties.time.enabled) {
    if (properties.time.mode === "between") {
      const from = parseCalendarDateStart(properties.time.fromDate);
      const to = parseCalendarDateStart(properties.time.toDate);
      if (from === null || to === null || from > to) return { ok: false, message: "Invalid date range." };
      timeRange = { startInclusiveMs: from, endInclusiveMs: to + 24 * 60 * 60 * 1000 - 1 };
    } else {
      const duration = getPreviousDurationMilliseconds(properties.time.previousValue, properties.time.previousUnit);
      const now = Date.parse(searchNow);
      if (duration === null || !Number.isFinite(now)) return { ok: false, message: "Invalid previous period." };
      timeRange = { startInclusiveMs: now - duration, endInclusiveMs: now };
    }
  }

  let sizeFilter: VfsSearchSizeFilter | null = null;
  if (properties.size.comparator !== "none") {
    if (properties.size.value.trim() === "") return { ok: false, message: "Invalid file size." };
    const value = Number(properties.size.value);
    const thresholdBytes = value * getSizeMultiplier(properties.size.unit);
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(thresholdBytes)) {
      return { ok: false, message: "Invalid file size." };
    }
    sizeFilter = { comparator: properties.size.comparator, thresholdBytes };
  }

  return { ok: true, value: { timeRange, sizeFilter } };
}

export function getKFindResultSubfolder(rootPath: string, parentPath: string): string {
  if (parentPath === rootPath) return "";

  const rootPrefix = rootPath === "/" ? "/" : `${rootPath}/`;
  return parentPath.startsWith(rootPrefix) ? parentPath.slice(rootPrefix.length) : parentPath;
}

/** Keeps a live result label presentational while the result snapshot retains canonical name/path. */
export function getKFindResultDisplayName(node: VfsNode | null, fallbackName: string): string {
  return node === null ? fallbackName : getVfsNodeDisplayName(node);
}

export function getKFindResultNodeIds(state: KFindSearchState): readonly VfsNodeId[] {
  return state.type === "searching" || state.type === "completed" || state.type === "cancelled"
    ? state.resultNodeIds
    : state.type === "error" ? state.resultNodeIds ?? [] : [];
}

export function getKFindResultFirstMatchingLine(state: KFindSearchState, nodeId: VfsNodeId): string | null {
  return state.type === "searching" || state.type === "completed" || state.type === "cancelled"
    ? state.firstMatchingLineByNodeId[nodeId] ?? null
    : state.type === "error" ? state.firstMatchingLineByNodeId?.[nodeId] ?? null : null;
}
