import type { VfsNodeId, VfsState } from "../../vfs/types";
import {
  collectVfsSearchCandidates,
  matchVfsSearchCandidate,
  type VfsSearchQuery,
  type VfsSearchResultMetadata,
} from "../../vfs/vfsSearch";

export const K_FIND_SEARCH_BATCH_SIZE = 12;

export type KFindSearchExecutionEvent =
  | { readonly type: "results"; readonly results: readonly VfsSearchResultMetadata[] }
  | { readonly type: "completed"; readonly results: readonly VfsSearchResultMetadata[] }
  | { readonly type: "cancelled"; readonly results: readonly VfsSearchResultMetadata[] }
  | { readonly type: "error"; readonly message: string };

export type KFindSearchJob = {
  readonly snapshot: VfsState;
  readonly query: VfsSearchQuery;
  readonly candidateIds: readonly VfsNodeId[];
  cancelled: boolean;
};

export type KFindYieldControl = () => Promise<void>;

export const yieldKFindSearchControl: KFindYieldControl = () => new Promise((resolve) => {
  window.setTimeout(resolve, 0);
});

export function createKFindSearchJob(snapshot: VfsState, query: VfsSearchQuery):
  | { readonly ok: true; readonly job: KFindSearchJob }
  | { readonly ok: false; readonly message: string } {
  const candidates = collectVfsSearchCandidates(snapshot, query);
  if (!candidates.ok) return { ok: false, message: candidates.error.message };
  return { ok: true, job: { snapshot, query, candidateIds: candidates.value.map((candidate) => candidate.nodeId), cancelled: false } };
}

/** Runs one immutable VFS snapshot cooperatively, publishing deterministic partial matches. */
export async function runKFindSearchJob(
  job: KFindSearchJob,
  onEvent: (event: KFindSearchExecutionEvent) => void,
  yieldControl: KFindYieldControl = yieldKFindSearchControl,
): Promise<void> {
  const results: VfsSearchResultMetadata[] = [];
  try {
    for (let index = 0; index < job.candidateIds.length; index += K_FIND_SEARCH_BATCH_SIZE) {
      if (job.cancelled) {
        onEvent({ type: "cancelled", results: [...results] });
        return;
      }
      const batch = job.candidateIds.slice(index, index + K_FIND_SEARCH_BATCH_SIZE);
      for (const nodeId of batch) {
        const matched = matchVfsSearchCandidate(job.snapshot, job.query, nodeId);
        if (!matched.ok) {
          onEvent({ type: "error", message: matched.error.message });
          return;
        }
        if (matched.value !== null) results.push(matched.value);
      }
      onEvent({ type: "results", results: [...results] });
      if (index + K_FIND_SEARCH_BATCH_SIZE < job.candidateIds.length) await yieldControl();
    }
    onEvent(job.cancelled ? { type: "cancelled", results: [...results] } : { type: "completed", results: [...results] });
  } catch {
    onEvent({ type: "error", message: "Search failed." });
  }
}
