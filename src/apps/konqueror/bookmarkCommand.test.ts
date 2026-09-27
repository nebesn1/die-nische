import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createInitialKonquerorNavigationState } from "./navigationState";
import { getKonquerorActiveBookmarkDraft, getKonquerorBookmarkDraftsForTabs } from "./bookmarkCommand";
import type { KonquerorTabSession } from "./konquerorTabs";
import { defaultKonquerorImageViewState } from "./imageViewModel";
import { defaultKonquerorMediaViewState } from "./mediaViewModel";

describe("Konqueror Add Bookmark draft", () => {
  it("reuses the current tab's canonical directory and file locations with their existing tab labels", () => {
    const state = createInitialVfsState();
    const documents = createInitialKonquerorNavigationState({ type: "directory", nodeId: state.specialLocations.documents }, "/home/user/Documents");
    const notes = Object.values(state.nodesById).find((node) => node.kind === "file" && node.name === "Notes.txt");
    if (!notes || notes.kind !== "file") throw new Error("Notes fixture missing");
    const file = createInitialKonquerorNavigationState({ type: "file", nodeId: notes.id }, "/home/user/Documents/Notes.txt");

    expect(getKonquerorActiveBookmarkDraft(state, documents)).toEqual({ name: "Documents", location: "/home/user/Documents" });
    expect(getKonquerorActiveBookmarkDraft(state, file)).toEqual({ name: "Notes.txt", location: "/home/user/Documents/Notes.txt" });
  });

  it("uses the existing external-web tab label while retaining the canonical URL", () => {
    const state = createInitialVfsState();
    const navigation = createInitialKonquerorNavigationState(
      { type: "external-web", canonicalUrl: "https://example.com/path" },
      "https://example.com/path",
    );

    expect(getKonquerorActiveBookmarkDraft(state, navigation)).toEqual({ name: "example.com", location: "https://example.com/path" });
  });

  it("refuses to create a malformed bookmark when navigation has no current target", () => {
    const state = createInitialVfsState();
    const navigation = {
      ...createInitialKonquerorNavigationState({ type: "directory", nodeId: state.specialLocations.home }, "/home/user"),
      historyTargets: [],
    };

    expect(getKonquerorActiveBookmarkDraft(state, navigation)).toBeNull();
  });

  it("derives ordered drafts for directory, URL, file, and duplicate tabs without consulting active-tab state", () => {
    const state = createInitialVfsState();
    const notes = Object.values(state.nodesById).find((node) => node.kind === "file" && node.name === "Notes.txt");
    if (!notes || notes.kind !== "file") throw new Error("Notes fixture missing");
    const tabs: readonly KonquerorTabSession[] = [
      { id: "tab-1", navigationState: createInitialKonquerorNavigationState({ type: "directory", nodeId: state.specialLocations.home }, "/home/user"), expandedTreeNodeIds: [], imageViewState: defaultKonquerorImageViewState, mediaViewState: defaultKonquerorMediaViewState },
      { id: "tab-2", navigationState: createInitialKonquerorNavigationState({ type: "external-web", canonicalUrl: "https://example.com/path" }, "https://example.com/path"), expandedTreeNodeIds: [], imageViewState: defaultKonquerorImageViewState, mediaViewState: defaultKonquerorMediaViewState },
      { id: "tab-3", navigationState: createInitialKonquerorNavigationState({ type: "file", nodeId: notes.id }, "/home/user/Documents/Notes.txt"), expandedTreeNodeIds: [], imageViewState: defaultKonquerorImageViewState, mediaViewState: defaultKonquerorMediaViewState },
      { id: "tab-4", navigationState: createInitialKonquerorNavigationState({ type: "external-web", canonicalUrl: "https://example.com/path" }, "https://example.com/path"), expandedTreeNodeIds: [], imageViewState: defaultKonquerorImageViewState, mediaViewState: defaultKonquerorMediaViewState },
    ];

    expect(getKonquerorBookmarkDraftsForTabs(state, tabs)).toEqual([
      { name: "user", location: "/home/user" },
      { name: "example.com", location: "https://example.com/path" },
      { name: "Notes.txt", location: "/home/user/Documents/Notes.txt" },
      { name: "example.com", location: "https://example.com/path" },
    ]);
  });
});
