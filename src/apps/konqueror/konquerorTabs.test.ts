import { describe, expect, it } from "vitest";
import {
  addKonquerorTab,
  closeKonquerorTab,
  createInitialKonquerorWindowTabs,
  createKonquerorWindowTabsFromDetachedTab,
  detachKonquerorTab,
  getActiveKonquerorTab,
  selectKonquerorTab,
  updateKonquerorTabNavigation,
  updateKonquerorTabImageView,
} from "./konquerorTabs";

const documents = { type: "directory" as const, nodeId: "documents" };
const pictures = { type: "directory" as const, nodeId: "pictures" };

describe("Konqueror tab sessions", () => {
  it("creates one stable implicit tab and gives a new tab an independent history root", () => {
    const initial = createInitialKonquerorWindowTabs(documents, "/home/user/Documents");
    const tabs = addKonquerorTab(initial, pictures, "/home/user/Pictures");

    expect(initial.tabs).toHaveLength(1);
    expect(initial.activeTabId).toBe("tab-1");
    expect(tabs.tabs.map((tab) => tab.id)).toEqual(["tab-1", "tab-2"]);
    expect(getActiveKonquerorTab(tabs).navigationState.historyTargets).toEqual([pictures]);
  });

  it("keeps navigation and selection isolated by TabId", () => {
    const initial = createInitialKonquerorWindowTabs(documents, "/home/user/Documents");
    const tabs = addKonquerorTab(initial, pictures, "/home/user/Pictures");
    const updated = updateKonquerorTabNavigation(tabs, "tab-1", { type: "replace-selection", nodeId: "readme" });
    const selected = updateKonquerorTabNavigation(updated, "tab-2", { type: "replace-selection", nodeId: "photo" });

    expect(selected.tabs[0]?.navigationState.selectedNodeIds).toEqual(["readme"]);
    expect(selected.tabs[1]?.navigationState.selectedNodeIds).toEqual(["photo"]);
  });

  it("selects stable sessions and closes the active tab to its left neighbor without reaching zero tabs", () => {
    const first = createInitialKonquerorWindowTabs(documents, "/home/user/Documents");
    const second = addKonquerorTab(first, pictures, "/home/user/Pictures");
    const third = addKonquerorTab(second, { type: "directory", nodeId: "home" }, "/home/user");
    const selected = selectKonquerorTab(third, "tab-2");
    const closed = closeKonquerorTab(selected, "tab-2");
    const final = closeKonquerorTab(closed, "tab-1");

    expect(closed.activeTabId).toBe("tab-1");
    expect(closed.tabs.map((tab) => tab.id)).toEqual(["tab-1", "tab-3"]);
    expect(final.tabs).toHaveLength(1);
    expect(closeKonquerorTab(final, final.activeTabId)).toBe(final);
  });

  it("detaches the exact tab session without cloning history, selection, expansion, or TabId", () => {
    const initial = createInitialKonquerorWindowTabs(documents, "/home/user/Documents");
    const tabs = updateKonquerorTabNavigation(
      addKonquerorTab(initial, pictures, "/home/user/Pictures"),
      "tab-2",
      { type: "replace-selection", nodeId: "photo" },
    );
    const expanded = {
      ...tabs,
      tabs: tabs.tabs.map((tab) => tab.id === "tab-2" ? { ...tab, expandedTreeNodeIds: ["pictures"] } : tab),
    };
    const detached = detachKonquerorTab(expanded, "tab-2");
    if (detached === null) throw new Error("Expected a detachable session");
    const destination = createKonquerorWindowTabsFromDetachedTab(detached.tab);

    expect(detached.source.tabs.map((tab) => tab.id)).toEqual(["tab-1"]);
    expect(destination.activeTabId).toBe("tab-2");
    expect(destination.tabs[0]).toBe(detached.tab);
    expect(destination.tabs[0]?.navigationState.selectedNodeIds).toEqual(["photo"]);
    expect(destination.tabs[0]?.expandedTreeNodeIds).toEqual(["pictures"]);
    expect(detachKonquerorTab(initial, "tab-1")).toBeNull();
  });

  it("keeps image zoom and rotation local to the exact tab session", () => {
    const initial = addKonquerorTab(createInitialKonquerorWindowTabs(documents, "/home/user/Documents"), pictures, "/home/user/Pictures");
    const started = updateKonquerorTabImageView(initial, "tab-2", { type: "start", nodeId: "image-a" });
    const adjusted = updateKonquerorTabImageView(started, "tab-2", { type: "set-zoom", zoom: 200 });
    const rotated = updateKonquerorTabImageView(adjusted, "tab-2", { type: "rotate-right" });

    expect(rotated.tabs[0]?.imageViewState).toEqual(initial.tabs[0]?.imageViewState);
    expect(rotated.tabs[1]?.imageViewState).toMatchObject({ nodeId: "image-a", zoom: 200, rotation: 90 });
  });
});
