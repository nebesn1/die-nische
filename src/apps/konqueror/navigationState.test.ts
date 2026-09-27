import { describe, expect, it } from "vitest";
import type { VfsError } from "../../vfs/errors";
import { createKonquerorAboutLocationTarget, createKonquerorBlankLocationTarget } from "./navigationTypes";
import {
  canNavigateBack,
  canNavigateForward,
  createInitialKonquerorNavigationState,
  getCurrentKonquerorLocationTarget,
  getCurrentKonquerorNodeId,
  getKonquerorHistoryTargets,
  konquerorNavigationReducer,
  removeDeletedNodesFromKonquerorHistory,
} from "./navigationState";

const error: VfsError = { code: "NOT_FOUND", message: "Missing" };
const directory = (nodeId: string) => ({ type: "directory" as const, nodeId });
const file = (nodeId: string) => ({ type: "file" as const, nodeId });
const externalWeb = (canonicalUrl: string) => ({ type: "external-web" as const, canonicalUrl });

describe("Konqueror navigation state", () => {
  it("keeps about:blank as a distinct history node with an empty location presentation", () => {
    const blank = createInitialKonquerorNavigationState(createKonquerorBlankLocationTarget(), "about:blank");
    const documents = konquerorNavigationReducer(blank, {
      type: "navigate-success",
      target: directory("vfs-documents"),
      path: "/home/user/Documents",
    });
    const back = konquerorNavigationReducer(documents, { type: "go-back", path: "about:blank" });

    expect(blank.historyTargets).toEqual([createKonquerorBlankLocationTarget()]);
    expect(blank.locationDraft).toBe("");
    expect(back.locationDraft).toBe("");
    expect(getCurrentKonquerorLocationTarget(back)).toEqual(createKonquerorBlankLocationTarget());
  });
  it("stores about:konqueror as a virtual history target and dedupes repeat navigation", () => {
    const initial = createInitialKonquerorNavigationState(directory("vfs-documents"), "/home/user/Documents");
    const about = konquerorNavigationReducer(initial, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("canonical"),
      path: "about:konqueror",
    });
    const repeated = konquerorNavigationReducer(about, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("canonical"),
      path: "about:konqueror",
    });

    expect(about.historyTargets).toEqual([directory("vfs-documents"), createKonquerorAboutLocationTarget("canonical")]);
    expect(repeated.historyTargets).toEqual(about.historyTargets);
    expect(repeated.historyIndex).toBe(1);
  });

  it("creates initial Home navigation with one stable directory target", () => {
    const state = createInitialKonquerorNavigationState("vfs-user", "/home/user");

    expect(state.historyTargets).toEqual([directory("vfs-user")]);
    expect(getCurrentKonquerorNodeId(state)).toBe("vfs-user");
    expect(state.locationDraft).toBe("/home/user");
    expect(state.rangeAnchorNodeId).toBeNull();
  });

  it("appends directory navigation, clears transient state, and never duplicates the current target", () => {
    const state = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      selectedNodeIds: ["vfs-documents"],
      rangeAnchorNodeId: "vfs-documents",
      navigationError: error,
    };
    const next = konquerorNavigationReducer(state, {
      type: "navigate-success",
      target: directory("vfs-documents"),
      path: "/home/user/Documents",
    });
    const duplicate = konquerorNavigationReducer(next, {
      type: "navigate-success",
      target: directory("vfs-documents"),
      path: "/home/user/Documents",
    });

    expect(next.historyTargets).toEqual([directory("vfs-user"), directory("vfs-documents")]);
    expect(next.selectedNodeIds).toEqual([]);
    expect(next.rangeAnchorNodeId).toBeNull();
    expect(next.navigationError).toBeNull();
    expect(duplicate.historyTargets).toBe(next.historyTargets);
  });

  it("stores sysinfo as a virtual target without a VFS node id", () => {
    const state = createInitialKonquerorNavigationState("vfs-user", "/home/user");
    const sysinfo = konquerorNavigationReducer(state, {
      type: "navigate-success",
      target: { type: "sysinfo" },
      path: "sysinfo:/",
    });

    expect(getKonquerorHistoryTargets(sysinfo)).toEqual([directory("vfs-user"), { type: "sysinfo" }]);
    expect(getCurrentKonquerorLocationTarget(sysinfo)).toEqual({ type: "sysinfo" });
    expect(getCurrentKonquerorNodeId(sysinfo)).toBeNull();
  });

  it("keeps canonical external URLs as separate virtual history targets", () => {
    const state = createInitialKonquerorNavigationState(createKonquerorAboutLocationTarget("canonical"), "about:konqueror");
    const first = externalWeb("https://www.example.com/");
    const external = konquerorNavigationReducer(state, {
      type: "navigate-success",
      target: first,
      path: first.canonicalUrl,
    });
    const repeated = konquerorNavigationReducer(external, {
      type: "navigate-success",
      target: externalWeb("https://www.example.com/"),
      path: "https://www.example.com/",
    });
    const another = konquerorNavigationReducer(repeated, {
      type: "navigate-success",
      target: externalWeb("https://example.com/path"),
      path: "https://example.com/path",
    });

    expect(external.locationDraft).toBe("https://www.example.com/");
    expect(getCurrentKonquerorNodeId(external)).toBeNull();
    expect(repeated.historyTargets).toBe(external.historyTargets);
    expect(another.historyTargets).toEqual([
      createKonquerorAboutLocationTarget("canonical"),
      first,
      externalWeb("https://example.com/path"),
    ]);
  });

  it("keeps separate Konqueror navigation reducers isolated across external and VFS locations", () => {
    const external = konquerorNavigationReducer(
      createInitialKonquerorNavigationState(createKonquerorAboutLocationTarget("canonical"), "about:konqueror"),
      {
        type: "navigate-success",
        target: externalWeb("https://www.example.com/"),
        path: "https://www.example.com/",
      },
    );
    const directoryState = createInitialKonquerorNavigationState("vfs-user", "/home/user");

    expect(getCurrentKonquerorLocationTarget(external)).toEqual(externalWeb("https://www.example.com/"));
    expect(external.locationDraft).toBe("https://www.example.com/");
    expect(getCurrentKonquerorLocationTarget(directoryState)).toEqual(directory("vfs-user"));
    expect(directoryState.locationDraft).toBe("/home/user");
  });

  it("keeps Start Page identity while replacing only its address presentation", () => {
    const initial = createInitialKonquerorNavigationState(directory("vfs-documents"), "/home/user/Documents");
    const blank = konquerorNavigationReducer(initial, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("blank"),
      path: "about:konqueror",
    });
    const canonical = konquerorNavigationReducer(blank, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("canonical"),
      path: "about:konqueror",
    });

    expect(blank.historyTargets).toEqual([directory("vfs-documents"), createKonquerorAboutLocationTarget("blank")]);
    expect(blank.locationDraft).toBe("");
    expect(canonical.historyTargets).toEqual([directory("vfs-documents"), createKonquerorAboutLocationTarget("canonical")]);
    expect(canonical.historyTargets).toHaveLength(2);
    expect(canonical.locationDraft).toBe("about:konqueror");
  });

  it("derives a blank initial draft from a generic Start Page target", () => {
    const state = createInitialKonquerorNavigationState(
      createKonquerorAboutLocationTarget("blank"),
      "about:konqueror",
    );

    expect(state.historyTargets).toEqual([createKonquerorAboutLocationTarget("blank")]);
    expect(state.locationDraft).toBe("");
  });

  it("restores each Start Page address presentation through Back, Forward, and reset", () => {
    const documents = createInitialKonquerorNavigationState(directory("vfs-documents"), "/home/user/Documents");
    const blank = konquerorNavigationReducer(documents, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("blank"),
      path: "about:konqueror",
    });
    const trash = konquerorNavigationReducer(blank, {
      type: "navigate-success",
      target: directory("vfs-trash"),
      path: "trash:/",
    });
    const back = konquerorNavigationReducer(trash, { type: "go-back", path: "about:konqueror" });
    const forward = konquerorNavigationReducer(back, { type: "go-forward", path: "trash:/" });
    const canonical = konquerorNavigationReducer(documents, {
      type: "navigate-success",
      target: createKonquerorAboutLocationTarget("canonical"),
      path: "about:konqueror",
    });
    const canonicalTrash = konquerorNavigationReducer(canonical, {
      type: "navigate-success",
      target: directory("vfs-trash"),
      path: "trash:/",
    });
    const canonicalBack = konquerorNavigationReducer(canonicalTrash, { type: "go-back", path: "about:konqueror" });
    const canonicalReset = konquerorNavigationReducer(
      { ...canonical, locationDraft: "edited" },
      { type: "reset-location-draft", path: "about:konqueror" },
    );
    const blankReset = konquerorNavigationReducer(
      { ...back, locationDraft: "edited" },
      { type: "reset-location-draft", path: "about:konqueror" },
    );

    expect(back.locationDraft).toBe("");
    expect(forward.locationDraft).toBe("trash:/");
    expect(canonicalBack.locationDraft).toBe("about:konqueror");
    expect(canonicalReset.locationDraft).toBe("about:konqueror");
    expect(blankReset.locationDraft).toBe("");
  });

  it("stores a file preview as a stable node-id target without duplicating the current file", () => {
    const initial = createInitialKonquerorNavigationState("vfs-documents", "/home/user/Documents");
    const preview = konquerorNavigationReducer(initial, {
      type: "navigate-success",
      target: file("vfs-content-76cff3ce17d8a853403179f1"),
      path: "/home/user/Documents/Welcome.md",
    });
    const duplicate = konquerorNavigationReducer(preview, {
      type: "navigate-success",
      target: file("vfs-content-76cff3ce17d8a853403179f1"),
      path: "/home/user/Documents/Welcome.md",
    });

    expect(getCurrentKonquerorLocationTarget(preview)).toEqual(file("vfs-content-76cff3ce17d8a853403179f1"));
    expect(getCurrentKonquerorNodeId(preview)).toBe("vfs-content-76cff3ce17d8a853403179f1");
    expect(preview.historyTargets).toEqual([directory("vfs-documents"), file("vfs-content-76cff3ce17d8a853403179f1")]);
    expect(duplicate.historyTargets).toBe(preview.historyTargets);
  });

  it("replaces the current file Previewer without adding a history location", () => {
    const initial = createInitialKonquerorNavigationState("vfs-documents", "/home/user/Documents");
    const khtml = konquerorNavigationReducer(initial, {
      type: "navigate-success",
      target: { type: "file", nodeId: "vfs-page", previewerId: "khtml" },
      path: "/home/user/Documents/page.html",
    });
    const source = konquerorNavigationReducer(khtml, {
      type: "navigate-success",
      target: { type: "file", nodeId: "vfs-page", previewerId: "embedded-text" },
      path: "/home/user/Documents/page.html",
    });
    const back = konquerorNavigationReducer(source, { type: "go-back", path: "/home/user/Documents" });
    const forward = konquerorNavigationReducer(back, { type: "go-forward", path: "/home/user/Documents/page.html" });

    expect(source.historyTargets).toHaveLength(2);
    expect(getCurrentKonquerorLocationTarget(source)).toEqual({ type: "file", nodeId: "vfs-page", previewerId: "embedded-text" });
    expect(getCurrentKonquerorLocationTarget(forward)).toEqual({ type: "file", nodeId: "vfs-page", previewerId: "embedded-text" });
  });

  it("truncates forward targets when navigating from the middle", () => {
    const state = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      historyTargets: [directory("vfs-user"), directory("vfs-documents"), { type: "sysinfo" } as const],
      historyIndex: 1,
    };
    const next = konquerorNavigationReducer(state, {
      type: "navigate-success",
      target: directory("vfs-downloads"),
      path: "/home/user/Downloads",
    });

    expect(next.historyTargets).toEqual([directory("vfs-user"), directory("vfs-documents"), directory("vfs-downloads")]);
    expect(next.historyIndex).toBe(2);
  });

  it("moves over mixed Back/Forward history without creating entries", () => {
    const state = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      historyTargets: [directory("vfs-user"), directory("vfs-documents"), { type: "sysinfo" } as const],
      historyIndex: 2,
      selectedNodeIds: ["vfs-documents"],
      rangeAnchorNodeId: "vfs-documents",
      navigationError: error,
    };
    const back = konquerorNavigationReducer(state, { type: "go-back", path: "/home/user/Documents" });
    const forward = konquerorNavigationReducer(back, { type: "go-forward", path: "sysinfo:/" });

    expect(back.historyTargets).toBe(state.historyTargets);
    expect(back.historyIndex).toBe(1);
    expect(back.selectedNodeIds).toEqual([]);
    expect(back.rangeAnchorNodeId).toBeNull();
    expect(forward.historyTargets).toBe(state.historyTargets);
    expect(forward.historyIndex).toBe(2);
  });

  it("keeps boundary navigation actions as no-ops", () => {
    const state = createInitialKonquerorNavigationState("vfs-user", "/home/user");

    expect(canNavigateBack(state)).toBe(false);
    expect(canNavigateForward(state)).toBe(false);
    expect(konquerorNavigationReducer(state, { type: "go-back", path: "/" })).toBe(state);
    expect(konquerorNavigationReducer(state, { type: "go-forward", path: "/" })).toBe(state);
  });

  it("keeps selection, draft reset, reload, and mutation transitions outside history", () => {
    const state = createInitialKonquerorNavigationState("vfs-user", "/home/user");
    const selected = konquerorNavigationReducer(state, { type: "replace-selection", nodeId: "vfs-documents" });
    const reset = konquerorNavigationReducer(selected, { type: "reset-location-draft", path: "/home/user" });
    const reloaded = konquerorNavigationReducer(reset, { type: "reload-success", path: "/home/user" });
    const mutation = konquerorNavigationReducer(reloaded, {
      type: "mutation-success",
      path: "/home/user",
      selectedNodeIds: ["vfs-documents"],
    });

    expect(reloaded.historyTargets).toBe(state.historyTargets);
    expect(reloaded.selectedNodeIds).toEqual(["vfs-documents"]);
    expect(reloaded.rangeAnchorNodeId).toBe("vfs-documents");
    expect(mutation.historyTargets).toBe(state.historyTargets);
    expect(mutation.selectedNodeIds).toEqual(["vfs-documents"]);
    expect(mutation.rangeAnchorNodeId).toBe("vfs-documents");
  });

  it("toggles multi-selection and clears all membership through the shared no-op-safe action", () => {
    const selected = konquerorNavigationReducer(
      createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      { type: "replace-selection", nodeId: "vfs-documents" },
    );
    const multiSelected = konquerorNavigationReducer(selected, { type: "toggle-selection", nodeId: "vfs-downloads" });
    const toggledOff = konquerorNavigationReducer(multiSelected, { type: "toggle-selection", nodeId: "vfs-documents" });
    const cleared = konquerorNavigationReducer(multiSelected, { type: "clear-selection" });
    const clearedAgain = konquerorNavigationReducer(cleared, { type: "clear-selection" });

    expect(multiSelected.selectedNodeIds).toEqual(["vfs-documents", "vfs-downloads"]);
    expect(multiSelected.rangeAnchorNodeId).toBe("vfs-downloads");
    expect(toggledOff.selectedNodeIds).toEqual(["vfs-downloads"]);
    expect(toggledOff.rangeAnchorNodeId).toBe("vfs-documents");
    expect(cleared.selectedNodeIds).toEqual([]);
    expect(cleared.rangeAnchorNodeId).toBeNull();
    expect(clearedAgain).toBe(cleared);
  });

  it("keeps a stable range anchor across Shift ranges and replaces selection inclusively", () => {
    const visibleNodeIds = ["a", "b", "c", "d", "e", "f"];
    const anchored = konquerorNavigationReducer(
      createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      { type: "replace-selection", nodeId: "b" },
    );
    const expanded = konquerorNavigationReducer(anchored, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "e",
    });
    const shrunk = konquerorNavigationReducer(expanded, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "c",
    });
    const extended = konquerorNavigationReducer(shrunk, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "f",
    });
    const reverseAnchor = konquerorNavigationReducer(anchored, { type: "replace-selection", nodeId: "e" });
    const reversed = konquerorNavigationReducer(reverseAnchor, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "b",
    });

    expect(expanded.selectedNodeIds).toEqual(["b", "c", "d", "e"]);
    expect(expanded.rangeAnchorNodeId).toBe("b");
    expect(shrunk.selectedNodeIds).toEqual(["b", "c"]);
    expect(shrunk.rangeAnchorNodeId).toBe("b");
    expect(extended.selectedNodeIds).toEqual(["b", "c", "d", "e", "f"]);
    expect(extended.rangeAnchorNodeId).toBe("b");
    expect(reversed.selectedNodeIds).toEqual(["b", "c", "d", "e"]);
    expect(reversed.rangeAnchorNodeId).toBe("e");
  });

  it("adds Ctrl+Shift ranges without toggling existing members and falls back safely without a valid anchor", () => {
    const visibleNodeIds = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const anchored = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      selectedNodeIds: ["a", "c"],
      rangeAnchorNodeId: "c",
    };
    const added = konquerorNavigationReducer(anchored, {
      type: "add-selection-range",
      visibleNodeIds,
      targetNodeId: "f",
    });
    const extended = konquerorNavigationReducer(added, {
      type: "add-selection-range",
      visibleNodeIds,
      targetNodeId: "h",
    });
    const noAnchor = konquerorNavigationReducer(createInitialKonquerorNavigationState("vfs-user", "/home/user"), {
      type: "add-selection-range",
      visibleNodeIds,
      targetNodeId: "d",
    });
    const invalidAnchor = konquerorNavigationReducer(
      { ...anchored, rangeAnchorNodeId: "missing" },
      { type: "replace-selection-range", visibleNodeIds, targetNodeId: "d" },
    );

    expect(added.selectedNodeIds).toEqual(["a", "c", "d", "e", "f"]);
    expect(added.rangeAnchorNodeId).toBe("c");
    expect(extended.selectedNodeIds).toEqual(["a", "c", "d", "e", "f", "g", "h"]);
    expect(extended.rangeAnchorNodeId).toBe("c");
    expect(noAnchor.selectedNodeIds).toEqual(["d"]);
    expect(noAnchor.rangeAnchorNodeId).toBe("d");
    expect(invalidAnchor.selectedNodeIds).toEqual(["d"]);
    expect(invalidAnchor.rangeAnchorNodeId).toBe("d");
  });

  it("preserves a Ctrl-toggle anchor after deselecting the last item until the selection context is cleared", () => {
    const visibleNodeIds = ["a", "b", "c", "d"];
    const selected = konquerorNavigationReducer(
      createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      { type: "replace-selection", nodeId: "a" },
    );
    const emptyWithAnchor = konquerorNavigationReducer(selected, { type: "toggle-selection", nodeId: "a" });
    const range = konquerorNavigationReducer(emptyWithAnchor, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "d",
    });
    const cleared = konquerorNavigationReducer(range, { type: "clear-selection" });
    const afterClear = konquerorNavigationReducer(cleared, {
      type: "replace-selection-range",
      visibleNodeIds,
      targetNodeId: "d",
    });

    expect(emptyWithAnchor.selectedNodeIds).toEqual([]);
    expect(emptyWithAnchor.rangeAnchorNodeId).toBe("a");
    expect(range.selectedNodeIds).toEqual(["a", "b", "c", "d"]);
    expect(cleared.rangeAnchorNodeId).toBeNull();
    expect(afterClear.selectedNodeIds).toEqual(["d"]);
    expect(afterClear.rangeAnchorNodeId).toBe("d");
  });

  it("commits plain marquee replacement and Ctrl marquee addition without fabricating anchors", () => {
    const state = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      selectedNodeIds: ["a", "b"],
      rangeAnchorNodeId: "b",
    };
    const plain = konquerorNavigationReducer(state, {
      type: "commit-marquee-selection",
      mode: "replace",
      baselineSelectedNodeIds: state.selectedNodeIds,
      baselineRangeAnchorNodeId: state.rangeAnchorNodeId,
      visibleNodeIds: ["a", "b", "c", "d"],
      hitNodeIds: ["c", "d"],
    });
    const additive = konquerorNavigationReducer(state, {
      type: "commit-marquee-selection",
      mode: "add",
      baselineSelectedNodeIds: state.selectedNodeIds,
      baselineRangeAnchorNodeId: state.rangeAnchorNodeId,
      visibleNodeIds: ["a", "b", "c", "d"],
      hitNodeIds: ["c", "d"],
    });
    const emptyAdditive = konquerorNavigationReducer(state, {
      type: "commit-marquee-selection",
      mode: "add",
      baselineSelectedNodeIds: state.selectedNodeIds,
      baselineRangeAnchorNodeId: state.rangeAnchorNodeId,
      visibleNodeIds: ["a", "b", "c", "d"],
      hitNodeIds: [],
    });
    const invalidAdditiveAnchor = konquerorNavigationReducer(state, {
      type: "commit-marquee-selection",
      mode: "add",
      baselineSelectedNodeIds: state.selectedNodeIds,
      baselineRangeAnchorNodeId: "missing",
      visibleNodeIds: ["a", "b", "c", "d"],
      hitNodeIds: ["d"],
    });

    expect(plain.selectedNodeIds).toEqual(["c", "d"]);
    expect(plain.rangeAnchorNodeId).toBeNull();
    expect(additive.selectedNodeIds).toEqual(["a", "b", "c", "d"]);
    expect(additive.rangeAnchorNodeId).toBe("b");
    expect(emptyAdditive.selectedNodeIds).toEqual(["a", "b"]);
    expect(emptyAdditive.rangeAnchorNodeId).toBe("b");
    expect(invalidAdditiveAnchor.rangeAnchorNodeId).toBeNull();

    const rangeAfterAdditive = konquerorNavigationReducer(additive, {
      type: "replace-selection-range",
      visibleNodeIds: ["a", "b", "c", "d", "e"],
      targetNodeId: "e",
    });
    const rangeAfterPlain = konquerorNavigationReducer(plain, {
      type: "replace-selection-range",
      visibleNodeIds: ["a", "b", "c", "d", "e"],
      targetNodeId: "e",
    });

    expect(rangeAfterAdditive.selectedNodeIds).toEqual(["b", "c", "d", "e"]);
    expect(rangeAfterAdditive.rangeAnchorNodeId).toBe("b");
    expect(rangeAfterPlain.selectedNodeIds).toEqual(["e"]);
    expect(rangeAfterPlain.rangeAnchorNodeId).toBe("e");
  });

  it("retains a valid reload anchor while removing only invalid selection context", () => {
    const state = {
      ...createInitialKonquerorNavigationState("vfs-user", "/home/user"),
      selectedNodeIds: ["a", "b", "c"],
      rangeAnchorNodeId: "b",
    };
    const retained = konquerorNavigationReducer(state, {
      type: "retain-selection",
      visibleNodeIds: ["a", "b"],
    });
    const invalidAnchor = konquerorNavigationReducer(retained, {
      type: "retain-selection",
      visibleNodeIds: ["a"],
    });

    expect(retained.selectedNodeIds).toEqual(["a", "b"]);
    expect(retained.rangeAnchorNodeId).toBe("b");
    expect(invalidAnchor.selectedNodeIds).toEqual(["a"]);
    expect(invalidAnchor.rangeAnchorNodeId).toBeNull();
  });

  it("restores a failed navigation to its supplied committed presentation while preserving current history", () => {
    const state = createInitialKonquerorNavigationState("vfs-user", "/home/user");
    const failed = konquerorNavigationReducer(
      { ...state, locationDraft: "/does-not-exist" },
      { type: "navigate-failure", locationDraft: "/home/user", error },
    );
    const retry = konquerorNavigationReducer(failed, {
      type: "set-location-draft",
      locationDraft: "/home/user/Documents",
    });
    const failedAgain = konquerorNavigationReducer(retry, {
      type: "navigate-failure",
      locationDraft: "/home/user",
      error,
    });

    expect(failed.historyTargets).toBe(state.historyTargets);
    expect(failed.locationDraft).toBe("/home/user");
    expect(failed.navigationError).toBe(error);
    expect(retry.locationDraft).toBe("/home/user/Documents");
    expect(retry.navigationError).toBeNull();
    expect(failedAgain.locationDraft).toBe("/home/user");
    expect(failedAgain.navigationError).toBe(error);
  });

  it("keeps blank and canonical Start Page recovery one-shot and editable", () => {
    const blank = createInitialKonquerorNavigationState(createKonquerorAboutLocationTarget("blank"), "about:konqueror");
    const blankFailure = konquerorNavigationReducer(
      { ...blank, locationDraft: "/does-not-exist" },
      { type: "navigate-failure", locationDraft: "", error },
    );
    const blankRetry = konquerorNavigationReducer(blankFailure, { type: "set-location-draft", locationDraft: "/home/user" });
    const canonical = createInitialKonquerorNavigationState(createKonquerorAboutLocationTarget("canonical"), "about:konqueror");
    const canonicalReset = konquerorNavigationReducer(
      { ...canonical, locationDraft: "edited" },
      { type: "reset-location-draft", path: "about:konqueror" },
    );
    const canonicalRetry = konquerorNavigationReducer(canonicalReset, { type: "set-location-draft", locationDraft: "next" });

    expect(blankFailure.locationDraft).toBe("");
    expect(blankFailure.navigationError).toBe(error);
    expect(blankRetry.locationDraft).toBe("/home/user");
    expect(blankRetry.navigationError).toBeNull();
    expect(canonicalReset.locationDraft).toBe("about:konqueror");
    expect(canonicalRetry.locationDraft).toBe("next");
  });

  it("prunes deleted directory targets while preserving virtual and a surviving current target", () => {
    const state = {
      historyTargets: [directory("vfs-home"), { type: "sysinfo" } as const, externalWeb("https://example.com/"), directory("deleted"), directory("vfs-documents")],
      historyIndex: 4,
      selectedNodeIds: ["deleted"],
      rangeAnchorNodeId: "deleted",
      locationDraft: "/home/user/Documents",
      navigationError: null,
    };
    const pruned = removeDeletedNodesFromKonquerorHistory(state, ["deleted"], "vfs-home", "/home/user");

    expect(pruned.historyTargets).toEqual([directory("vfs-home"), { type: "sysinfo" }, externalWeb("https://example.com/"), directory("vfs-documents")]);
    expect(pruned.historyIndex).toBe(3);
    expect(pruned.selectedNodeIds).toEqual([]);
    expect(pruned.rangeAnchorNodeId).toBeNull();
  });

  it("falls back to Home when the current directory target is deleted", () => {
    const state = {
      historyTargets: [directory("vfs-home"), directory("vfs-trash"), directory("deleted")],
      historyIndex: 2,
      selectedNodeIds: ["deleted"],
      rangeAnchorNodeId: "deleted",
      locationDraft: "/home/user/.local/share/Trash/files/deleted",
      navigationError: null,
    };

    expect(removeDeletedNodesFromKonquerorHistory(state, ["deleted"], "vfs-home", "/home/user")).toMatchObject({
      historyTargets: [directory("vfs-home"), directory("vfs-trash")],
      historyIndex: 0,
      locationDraft: "/home/user",
    });
  });
});
