import { createVfsError } from "./errors";
import { isVfsTextFile } from "./fileContent";
import { getVfsNodeById, getVfsPathForNode, listVfsDirectory } from "./queries";
import { fail, ok, type VfsResult } from "./result";
import type { VfsNode, VfsNodeId, VfsState, VfsTextFileNode } from "./types";

export type VfsSearchFileType = "all" | "files" | "folders" | "text-files";
export type VfsSearchSizeComparator = "at-least" | "at-most" | "equal";

export interface VfsSearchTimeRange {
  readonly startInclusiveMs: number;
  readonly endInclusiveMs: number;
}

export interface VfsSearchSizeFilter {
  readonly comparator: VfsSearchSizeComparator;
  readonly thresholdBytes: number;
}

export interface VfsSearchQuery {
  readonly rootNodeId: VfsNodeId;
  readonly namePattern: string;
  readonly includeSubdirectories: boolean;
  readonly fileType: VfsSearchFileType;
  readonly containingText: string;
  readonly nameCaseSensitive: boolean;
  readonly contentsCaseSensitive: boolean;
  readonly timeRange: VfsSearchTimeRange | null;
  readonly sizeFilter: VfsSearchSizeFilter | null;
}

export interface VfsSearchResultMetadata {
  readonly nodeId: VfsNodeId;
  readonly name: string;
  readonly path: string;
  readonly parentPath: string;
  readonly type: VfsNode["kind"];
  readonly size: number | null;
  /** A compact result-snapshot preview, not live file content. */
  readonly firstMatchingLine: string | null;
}

/** A deterministic node-id universe captured from one immutable VFS search snapshot. */
export interface VfsSearchCandidate {
  readonly nodeId: VfsNodeId;
  readonly type: VfsNode["kind"];
  readonly path: string;
}

const FIRST_MATCHING_LINE_PREVIEW_LENGTH = 160;

const normalizeForCase = (value: string, caseSensitive: boolean): string =>
  caseSensitive ? value : value.toLowerCase();

/**
 * Empty patterns match all names. Patterns with `*` or `?` use whole-name
 * wildcard matching; other patterns use literal filename substring matching.
 */
export function matchesVfsNamePattern(name: string, pattern: string, caseSensitive = false): boolean {
  const normalizedName = normalizeForCase(name, caseSensitive);
  const normalizedPattern = normalizeForCase(pattern, caseSensitive);

  if (normalizedPattern === "") return true;
  if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
    return normalizedName.includes(normalizedPattern);
  }

  const candidate = [...normalizedName];
  const wildcard = [...normalizedPattern];
  const previous = new Array<boolean>(wildcard.length + 1).fill(false);
  const current = new Array<boolean>(wildcard.length + 1).fill(false);

  previous[0] = true;
  for (let index = 1; index <= wildcard.length; index += 1) {
    previous[index] = wildcard[index - 1] === "*" && previous[index - 1];
  }

  for (const character of candidate) {
    current[0] = false;
    for (let index = 1; index <= wildcard.length; index += 1) {
      const token = wildcard[index - 1];
      current[index] = token === "*"
        ? current[index - 1] || previous[index]
        : (token === "?" || token === character) && previous[index - 1];
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[wildcard.length];
}

export function matchesVfsTextContent(content: string, query: string, caseSensitive = false): boolean {
  return query === "" || normalizeForCase(content, caseSensitive).includes(normalizeForCase(query, caseSensitive));
}

export function hasVfsTextSearchQuery(query: string): boolean {
  return query.trim() !== "";
}

export function normalizeVfsSearchFileType(fileType: string): VfsSearchFileType {
  return fileType === "files" || fileType === "folders" || fileType === "text-files" ? fileType : "all";
}

export function isVfsTextSearchableNode(node: VfsNode): node is VfsTextFileNode {
  return isVfsTextFile(node);
}

export function matchesVfsSearchFileType(node: VfsNode, fileType: string): boolean {
  switch (normalizeVfsSearchFileType(fileType)) {
    case "files":
      return node.kind === "file";
    case "folders":
      return node.kind === "directory";
    case "text-files":
      return isVfsTextSearchableNode(node);
    case "all":
      return true;
  }
}

export function matchesVfsSearchTimeRange(node: VfsNode, timeRange: VfsSearchTimeRange | null): boolean {
  if (timeRange === null) return true;

  const matchesTimestamp = (timestamp: string): boolean => {
    const milliseconds = Date.parse(timestamp);
    return Number.isFinite(milliseconds)
      && milliseconds >= timeRange.startInclusiveMs
      && milliseconds <= timeRange.endInclusiveMs;
  };

  return matchesTimestamp(node.createdAt) || matchesTimestamp(node.modifiedAt);
}

export function matchesVfsSearchSizeFilter(node: VfsNode, sizeFilter: VfsSearchSizeFilter | null): boolean {
  if (sizeFilter === null) return true;
  if (node.kind !== "file") return false;

  switch (sizeFilter.comparator) {
    case "at-least":
      return node.size >= sizeFilter.thresholdBytes;
    case "at-most":
      return node.size <= sizeFilter.thresholdBytes;
    case "equal":
      return node.size === sizeFilter.thresholdBytes;
  }
}

export function findVfsFirstMatchingLine(content: string, query: string, caseSensitive = false): string | null {
  if (!hasVfsTextSearchQuery(query)) return null;

  let lineStart = 0;
  while (lineStart <= content.length) {
    const lineBreak = content.slice(lineStart).search(/\r\n|\r|\n/);
    const lineEnd = lineBreak === -1 ? content.length : lineStart + lineBreak;
    const line = content.slice(lineStart, lineEnd);
    if (matchesVfsTextContent(line, query, caseSensitive)) {
      return line.length > FIRST_MATCHING_LINE_PREVIEW_LENGTH
        ? `${line.slice(0, FIRST_MATCHING_LINE_PREVIEW_LENGTH - 3)}...`
        : line;
    }

    if (lineBreak === -1) break;
    lineStart = lineEnd + (content.startsWith("\r\n", lineEnd) ? 2 : 1);
  }

  return null;
}

const compareCandidates = (left: VfsSearchCandidate, right: VfsSearchCandidate): number => {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
};

export function getVfsSearchResultMetadata(
  state: VfsState,
  nodeId: VfsNodeId,
): VfsResult<VfsSearchResultMetadata> {
  const node = getVfsNodeById(state, nodeId);
  if (!node.ok) return node;

  const path = getVfsPathForNode(state, nodeId);
  if (!path.ok) return path;

  const parentPath = node.value.parentId === null
    ? ok("/")
    : getVfsPathForNode(state, node.value.parentId);
  if (!parentPath.ok) return parentPath;

  return ok({
    nodeId,
    name: node.value.id === state.rootId ? "/" : node.value.name,
    path: path.value,
    parentPath: parentPath.value,
    type: node.value.kind,
    size: node.value.kind === "file" ? node.value.size : null,
    firstMatchingLine: null,
  });
}

export function collectVfsSearchCandidates(
  state: VfsState,
  query: Pick<VfsSearchQuery, "rootNodeId" | "includeSubdirectories">,
): VfsResult<readonly VfsSearchCandidate[]> {
  const root = getVfsNodeById(state, query.rootNodeId);
  if (!root.ok) return root;
  if (root.value.kind !== "directory") {
    return fail(createVfsError("NOT_DIRECTORY", "Search location is not a directory.", { nodeId: query.rootNodeId }));
  }

  const visited = new Set<VfsNodeId>([query.rootNodeId]);
  const candidates: VfsSearchCandidate[] = [];
  const visit = (directoryId: VfsNodeId): VfsResult<void> => {
    const path = getVfsPathForNode(state, directoryId);
    if (!path.ok) return path;
    const children = listVfsDirectory(state, path.value);
    if (!children.ok) return children;

    for (const child of children.value) {
      if (visited.has(child.id)) {
        return fail(createVfsError("INVALID_PATH", "VFS child cycle detected.", { nodeId: child.id }));
      }
      visited.add(child.id);
      const childPath = getVfsPathForNode(state, child.id);
      if (!childPath.ok) return childPath;
      candidates.push({ nodeId: child.id, type: child.kind, path: childPath.value });
      if (query.includeSubdirectories && child.kind === "directory") {
        const nested = visit(child.id);
        if (!nested.ok) return nested;
      }
    }
    return ok(undefined);
  };

  const traversed = visit(query.rootNodeId);
  return traversed.ok ? ok([...candidates].sort(compareCandidates)) : traversed;
}

/** Applies the complete typed query to one candidate from the captured VFS snapshot. */
export function matchVfsSearchCandidate(
  state: VfsState,
  query: VfsSearchQuery,
  nodeId: VfsNodeId,
): VfsResult<VfsSearchResultMetadata | null> {
  const node = getVfsNodeById(state, nodeId);
  if (!node.ok) return node;

  const nameMatches = matchesVfsNamePattern(node.value.name, query.namePattern, query.nameCaseSensitive);
  const typeMatches = matchesVfsSearchFileType(node.value, query.fileType);
  const timeMatches = matchesVfsSearchTimeRange(node.value, query.timeRange);
  const sizeMatches = matchesVfsSearchSizeFilter(node.value, query.sizeFilter);
  const hasContentQuery = hasVfsTextSearchQuery(query.containingText);
  const contentMatches = isVfsTextSearchableNode(node.value)
    && matchesVfsTextContent(node.value.content.text, query.containingText, query.contentsCaseSensitive);

  if (!nameMatches || !typeMatches || !timeMatches || !sizeMatches || (hasContentQuery && !contentMatches)) {
    return ok(null);
  }

  const metadata = getVfsSearchResultMetadata(state, nodeId);
  if (!metadata.ok) return metadata;
  return ok({
    ...metadata.value,
    firstMatchingLine: contentMatches
      ? findVfsFirstMatchingLine(node.value.content.text, query.containingText, query.contentsCaseSensitive)
      : null,
  });
}

export function searchVfs(state: VfsState, query: VfsSearchQuery): VfsResult<readonly VfsSearchResultMetadata[]> {
  const candidates = collectVfsSearchCandidates(state, query);
  if (!candidates.ok) return candidates;

  const matches: VfsSearchResultMetadata[] = [];
  for (const candidate of candidates.value) {
    const matched = matchVfsSearchCandidate(state, query, candidate.nodeId);
    if (!matched.ok) return matched;
    if (matched.value !== null) matches.push(matched.value);
  }
  return ok(matches);
}
