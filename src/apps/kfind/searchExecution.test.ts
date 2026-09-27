import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsTextFile } from "../../vfs/mutations";
import type { VfsState } from "../../vfs/types";
import { createInitialKFindQuery, toVfsSearchQuery } from "./kfindModel";
import { createKFindSearchJob, runKFindSearchJob } from "./searchExecution";
import { searchVfs } from "../../vfs/vfsSearch";

const expectMutation = <T,>(result: { ok: true; state: VfsState; value: T } | { ok: false }): { state: VfsState; value: T } => {
  if (!result.ok) throw new Error("Expected mutation");
  return result;
};

describe("KFind cooperative search execution", () => {
  it("matches the canonical synchronous result set for the default production Home query", async () => {
    const extra = expectMutation(createVfsTextFile(createInitialVfsState(), "/home/user/Documents", "Author Content.md", "# extra", { now: "2026-09-13T00:00:00.000Z" }));
    const state = extra.state;
    const query = toVfsSearchQuery(createInitialKFindQuery(state));
    const synchronous = searchVfs(state, query);
    if (!synchronous.ok) throw new Error(synchronous.error.message);
    const created = createKFindSearchJob(state, query);
    if (!created.ok) throw new Error(created.message);
    const events: { type: string; resultIds: readonly string[] }[] = [];
    await runKFindSearchJob(created.job, (event) => {
      if ("results" in event) events.push({ type: event.type, resultIds: event.results.map((result) => result.nodeId) });
    }, async () => undefined);

    expect(created.job.candidateIds).toHaveLength(synchronous.value.length);
    expect(events.at(-1)).toEqual({ type: "completed", resultIds: synchronous.value.map((result) => result.nodeId) });
    expect(events.at(-1)?.resultIds).toContain(state.specialLocations.documents);
    expect(events.at(-1)?.resultIds).toContain(state.specialLocations.downloads);
    expect(events.at(-1)?.resultIds).toContain(extra.value.id);
    expect(events.at(-1)?.resultIds).not.toContain(state.specialLocations.cdrom);
    expect(new Set(created.job.candidateIds).size).toBe(created.job.candidateIds.length);
  });

  it("captures immutable candidates and publishes ordered partial results before completion", async () => {
    let state = createInitialVfsState();
    for (let index = 0; index < 15; index += 1) {
      state = expectMutation(createVfsTextFile(state, "/home/user/Documents", `Batch${index}.txt`, "robot", { now: "2026-08-12T00:00:00.000Z" })).state;
    }
    const query = { ...createInitialKFindQuery(state), nameLocation: { ...createInitialKFindQuery(state).nameLocation, locationNodeId: state.specialLocations.documents } };
    const created = createKFindSearchJob(state, toVfsSearchQuery(query));
    if (!created.ok) throw new Error(created.message);
    const events: string[] = [];
    await runKFindSearchJob(created.job, (event) => events.push(`${event.type}:${"results" in event ? event.results.length : 0}`), async () => undefined);
    expect(events[0]).toBe("results:12");
    expect(events.at(-1)).toBe(`completed:${created.job.candidateIds.length}`);
  });

  it("stops after a yielded batch and preserves already-published matches", async () => {
    let state = createInitialVfsState();
    for (let index = 0; index < 20; index += 1) state = expectMutation(createVfsTextFile(state, "/home/user/Documents", `Stop${index}.txt`, "robot", { now: "2026-08-12T00:00:00.000Z" })).state;
    const query = { ...createInitialKFindQuery(state), nameLocation: { ...createInitialKFindQuery(state).nameLocation, locationNodeId: state.specialLocations.documents } };
    const created = createKFindSearchJob(state, toVfsSearchQuery(query));
    if (!created.ok) throw new Error(created.message);
    const events: { type: string; count: number }[] = [];
    await runKFindSearchJob(created.job, (event) => events.push({ type: event.type, count: "results" in event ? event.results.length : 0 }), async () => { created.job.cancelled = true; });
    expect(events).toEqual([{ type: "results", count: 12 }, { type: "cancelled", count: 12 }]);
  });

  it("keeps concurrent jobs independent when one instance is stopped", async () => {
    let state = createInitialVfsState();
    for (let index = 0; index < 20; index += 1) state = expectMutation(createVfsTextFile(state, "/home/user/Documents", `Concurrent${index}.txt`, "robot", { now: "2026-08-12T00:00:00.000Z" })).state;
    const query = {
      ...createInitialKFindQuery(state),
      nameLocation: { ...createInitialKFindQuery(state).nameLocation, locationNodeId: state.specialLocations.documents },
    };
    const first = createKFindSearchJob(state, toVfsSearchQuery(query));
    const second = createKFindSearchJob(state, toVfsSearchQuery(query));
    if (!first.ok || !second.ok) throw new Error("Expected independent KFind jobs");
    const firstEvents: string[] = [];
    const secondEvents: string[] = [];

    await Promise.all([
      runKFindSearchJob(first.job, (event) => firstEvents.push(event.type), async () => { first.job.cancelled = true; }),
      runKFindSearchJob(second.job, (event) => secondEvents.push(event.type), async () => undefined),
    ]);

    expect(firstEvents.at(-1)).toBe("cancelled");
    expect(secondEvents.at(-1)).toBe("completed");
    expect(first.job.cancelled).toBe(true);
    expect(second.job.cancelled).toBe(false);
  });

  it("completes empty candidate and no-match searches instead of remaining in searching", async () => {
    const state = createInitialVfsState();
    const emptyQuery = { ...toVfsSearchQuery(createInitialKFindQuery(state)), rootNodeId: state.specialLocations.desktopDirectory };
    const empty = createKFindSearchJob(state, emptyQuery);
    if (!empty.ok) throw new Error(empty.message);
    const emptyEvents: string[] = [];
    await runKFindSearchJob(empty.job, (event) => emptyEvents.push(event.type), async () => undefined);
    expect(emptyEvents).toEqual(["completed"]);

    const noMatchQuery = { ...toVfsSearchQuery(createInitialKFindQuery(state)), namePattern: "NoSuchNode" };
    const noMatch = createKFindSearchJob(state, noMatchQuery);
    if (!noMatch.ok) throw new Error(noMatch.message);
    const noMatchEvents: { type: string; count: number }[] = [];
    await runKFindSearchJob(noMatch.job, (event) => noMatchEvents.push({ type: event.type, count: "results" in event ? event.results.length : 0 }), async () => undefined);
    expect(noMatchEvents.at(-1)).toEqual({ type: "completed", count: 0 });
  });
});
