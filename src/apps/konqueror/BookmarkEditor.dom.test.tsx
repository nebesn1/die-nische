// @vitest-environment jsdom
import { act, StrictMode, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BookmarkEditor } from "./BookmarkEditor";
import { KonquerorBookmarksProvider } from "./KonquerorBookmarksContext";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import type { KonquerorBookmarkTree } from "./bookmarks";
import { createKonquerorBookmarksStorage, type KonquerorBookmarksStorageBackend } from "./bookmarksPersistence";

let container: HTMLDivElement;
let reactRoot: Root;

const initialBookmarks: KonquerorBookmarkTree = {
  rootChildren: [
    { id: "a", type: "bookmark", name: "Alpha", location: "https://old.example.com", comment: "first", firstViewed: "2026-01-01T00:00:00.000Z", lastViewed: "2026-01-02T00:00:00.000Z", visitCount: 2 },
    { id: "work", type: "folder", name: "Work", children: [{ id: "x", type: "bookmark", name: "X", location: "/home/user", comment: "nested", firstViewed: null, lastViewed: null, visitCount: 0 }] },
    { id: "c", type: "bookmark", name: "Charlie", location: "/home/user/Documents", comment: "", firstViewed: null, lastViewed: null, visitCount: 0 },
  ],
};

function Probe() {
  const { bookmarks } = useContext(KonquerorBookmarksContext);
  return <output data-testid="tree">{JSON.stringify(bookmarks)}</output>;
}

function ExternalBookmarkMutation() {
  const { recordVisit, updateBookmark } = useContext(KonquerorBookmarksContext);
  return <>
    <button type="button" onClick={() => updateBookmark("a", { name: "Renamed Elsewhere" })}>External Rename</button>
    <button type="button" onClick={() => recordVisit("a")}>External Visit</button>
  </>;
}

const getTree = () => JSON.parse(container.querySelector("[data-testid='tree']")?.textContent ?? "{}") as KonquerorBookmarkTree;
const click = (element: HTMLElement | null) => { if (!element) throw new Error("Missing control"); act(() => element.click()); };
const treeItem = (name: string) => [...container.querySelectorAll<HTMLElement>("[role='treeitem']")].find((row) => row.getAttribute("aria-label") === name) ?? null;
const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label || candidate.getAttribute("aria-label") === label) ?? null;
const setInput = (input: HTMLInputElement, value: string) => act(() => {
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
const blurInput = (input: HTMLInputElement) => act(() => {
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
});
const keyDownInput = (input: HTMLInputElement, key: string) => act(() => {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
});

function createMemoryStorage(): KonquerorBookmarksStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => { values.delete(key); },
  };
}

const renderEditor = (bookmarks = initialBookmarks) => {
  const storage = createMemoryStorage();
  act(() => reactRoot.render(
    <StrictMode><KonquerorBookmarksProvider initialBookmarks={bookmarks} storage={createKonquerorBookmarksStorage(() => storage)}><BookmarkEditor onRequestClose={() => undefined} /><ExternalBookmarkMutation /><Probe /></KonquerorBookmarksProvider></StrictMode>,
  ));
  return storage;
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});
afterEach(() => { act(() => reactRoot.unmount()); container.remove(); });

describe("Bookmark Editor", () => {
  it("renders the synthetic root and mixed tree, with Bookmark fields and read-only visit metadata", () => {
    renderEditor();
    expect([...container.querySelectorAll("[role='treeitem']")].map((row) => row.getAttribute("aria-label"))).toEqual(["Bookmarks", "Alpha", "Work", "Charlie"]);
    click(treeItem("Alpha"));
    const inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    expect(inputs.map((input) => input.value)).toEqual(["Alpha", "https://old.example.com", "first"]);
    expect(container.querySelector(".bookmark-editor-details")?.textContent).toContain("Times visited:2");
  });

  it("updates Bookmark fields by ID without changing visit metadata and rejects blank required values", () => {
    renderEditor();
    click(treeItem("Alpha"));
    const inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[0]!, "  Example Website  ");
    blurInput(inputs[0]!);
    const afterName = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(afterName[1]!, " https://new.example.com ");
    blurInput(afterName[1]!);
    const afterLocation = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(afterLocation[2]!, "updated comment");
    blurInput(afterLocation[2]!);
    expect(getTree().rootChildren[0]).toMatchObject({ id: "a", name: "Example Website", location: "https://new.example.com", comment: "updated comment", visitCount: 2, firstViewed: "2026-01-01T00:00:00.000Z" });
    const afterComment = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(afterComment[0]!, "   ");
    blurInput(afterComment[0]!);
    expect(getTree().rootChildren[0]).toMatchObject({ id: "a", name: "Example Website" });
  });

  it("restores Bookmark Name, Location, and Comment on Escape without committing their stale DOM drafts", () => {
    const storage = renderEditor();
    click(treeItem("Alpha"));
    let inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[0]!, "Discarded Name");
    keyDownInput(inputs[0]!, "Escape");
    inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    expect(inputs[0]?.value).toBe("Alpha");

    setInput(inputs[1]!, "https://discarded.example.com");
    keyDownInput(inputs[1]!, "Escape");
    inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    expect(inputs[1]?.value).toBe("https://old.example.com");

    setInput(inputs[2]!, "discarded comment");
    keyDownInput(inputs[2]!, "Escape");
    expect([...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")][2]?.value).toBe("first");
    expect(getTree().rootChildren[0]).toEqual(initialBookmarks.rootChildren[0]);
    expect([...storage.values.values()].some((value) => value.includes("Discarded Name") || value.includes("discarded.example.com") || value.includes("discarded comment"))).toBe(false);
  });

  it("keeps Escape suppression field-local while normal blur and Enter still commit", () => {
    renderEditor();
    click(treeItem("Alpha"));
    let inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[0]!, "Discarded Name");
    keyDownInput(inputs[0]!, "Escape");
    inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[1]!, "https://committed.example.com");
    blurInput(inputs[1]!);
    inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[2]!, "committed with Enter");
    keyDownInput(inputs[2]!, "Enter");
    expect(getTree().rootChildren[0]).toMatchObject({ name: "Alpha", location: "https://committed.example.com", comment: "committed with Enter" });

    click(treeItem("Charlie"));
    inputs = [...container.querySelectorAll<HTMLInputElement>(".bookmark-editor-details input")];
    setInput(inputs[0]!, "Renamed Charlie");
    blurInput(inputs[0]!);
    expect(getTree().rootChildren[2]).toMatchObject({ id: "c", name: "Renamed Charlie" });
  });

  it("restores Folder Name on Escape through the shared detail-field cancellation path", () => {
    renderEditor();
    click(treeItem("Work"));
    const name = container.querySelector<HTMLInputElement>(".bookmark-editor-details input");
    if (!name) throw new Error("Folder name input missing");
    setInput(name, "Discarded Work");
    keyDownInput(name, "Escape");
    expect(container.querySelector<HTMLInputElement>(".bookmark-editor-details input")?.value).toBe("Work");
    expect(getTree().rootChildren[1]).toMatchObject({ id: "work", name: "Work" });
  });

  it("preserves an external visit while Escape discards the current Name draft", () => {
    const storage = renderEditor();
    click(treeItem("Alpha"));
    const name = container.querySelector<HTMLInputElement>(".bookmark-editor-details input");
    if (!name) throw new Error("Name input missing");
    setInput(name, "Discarded after visit");
    click(button("External Visit"));
    keyDownInput(name, "Escape");
    expect(getTree().rootChildren[0]).toMatchObject({ id: "a", name: "Alpha", firstViewed: "2026-01-01T00:00:00.000Z", lastViewed: expect.any(String), visitCount: 3 });
    expect(container.querySelector<HTMLInputElement>(".bookmark-editor-details input")?.value).toBe("Alpha");
    const persisted = createKonquerorBookmarksStorage(() => storage).load();
    expect(persisted.type === "loaded" && persisted.bookmarks.rootChildren[0]).toMatchObject({ id: "a", name: "Alpha", visitCount: 3 });
  });

  it("creates a Folder against root, Folder, or Bookmark parent semantics", () => {
    renderEditor();
    click(button("New Folder"));
    setInput(container.querySelector<HTMLInputElement>(".konqueror-dialog-input")!, "Root Folder");
    click(button("OK"));
    expect(getTree().rootChildren.at(-1)).toMatchObject({ type: "folder", name: "Root Folder" });

    click(treeItem("Alpha"));
    click(button("New Folder"));
    setInput(container.querySelector<HTMLInputElement>(".konqueror-dialog-input")!, "Sibling Folder");
    click(button("OK"));
    expect(getTree().rootChildren.at(-1)).toMatchObject({ type: "folder", name: "Sibling Folder" });

    click(treeItem("Work"));
    click(button("New Folder"));
    setInput(container.querySelector<HTMLInputElement>(".konqueror-dialog-input")!, "Child Folder");
    click(button("OK"));
    const work = getTree().rootChildren.find((node) => node.id === "work");
    expect(work?.type === "folder" && work.children.at(-1)).toMatchObject({ type: "folder", name: "Child Folder" });
  });

  it("deletes an exact subtree only after confirmation and keeps stable selection through mixed reorder", () => {
    renderEditor();
    click(treeItem("Charlie"));
    click(button("Move Up"));
    expect(getTree().rootChildren.map((node) => node.id)).toEqual(["a", "c", "work"]);
    expect(container.querySelector("[role='treeitem'][aria-selected='true']")?.getAttribute("aria-label")).toBe("Charlie");

    click(treeItem("Work"));
    click(button("Delete"));
    expect(getTree().rootChildren.some((node) => node.id === "work")).toBe(true);
    click(container.querySelector(".konqueror-confirmation-dialog .konqueror-dialog-button"));
    expect(getTree().rootChildren.some((node) => node.id === "work")).toBe(false);
  });

  it("filters with ancestor context without mutating the shared tree and disables reorder while searching", () => {
    renderEditor();
    const search = container.querySelector<HTMLInputElement>(".bookmark-editor-search input");
    if (!search) throw new Error("Search missing");
    setInput(search, "nested");
    expect([...container.querySelectorAll("[role='treeitem']")].map((row) => row.getAttribute("aria-label"))).toEqual(["Bookmarks", "Work", "X"]);
    click(treeItem("X"));
    expect(button("Move Up")?.disabled).toBe(true);
    expect(getTree()).toEqual(initialBookmarks);
  });

  it("keeps the empty root useful and exposes stable disabled toolbar states", () => {
    renderEditor({ rootChildren: [] });
    expect([...container.querySelectorAll("[role='treeitem']")].map((row) => row.getAttribute("aria-label"))).toEqual(["Bookmarks"]);
    expect(button("New Folder")?.disabled).toBe(false);
    expect(button("Delete")?.disabled).toBe(true);
    expect(button("Move Up")?.disabled).toBe(true);
    expect(button("Move Down")?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".bookmark-editor-details input")?.value).toBe("Bookmarks");
  });

  it("derives Move Up and Move Down strictly from the selected sibling position", () => {
    renderEditor();
    click(treeItem("Alpha"));
    expect(button("Move Up")?.disabled).toBe(true);
    expect(button("Move Down")?.disabled).toBe(false);
    click(treeItem("Work"));
    expect(button("Move Up")?.disabled).toBe(false);
    expect(button("Move Down")?.disabled).toBe(false);
    click(treeItem("Charlie"));
    expect(button("Move Up")?.disabled).toBe(false);
    expect(button("Move Down")?.disabled).toBe(true);
  });

  it("shows a no-results state without changing the Store and restores the tree when search clears", () => {
    renderEditor();
    const search = container.querySelector<HTMLInputElement>(".bookmark-editor-search input");
    if (!search) throw new Error("Search missing");
    setInput(search, "not-a-bookmark");
    expect(container.querySelector(".bookmark-editor-tree__empty")?.textContent).toBe("No bookmarks found.");
    expect(getTree()).toEqual(initialBookmarks);
    setInput(search, "");
    expect(container.querySelector(".bookmark-editor-tree__empty")).toBeNull();
    expect([...container.querySelectorAll("[role='treeitem']")].map((row) => row.getAttribute("aria-label"))).toEqual(["Bookmarks", "Alpha", "Work", "Charlie"]);
  });

  it("preserves a local field draft through an external visit and never writes it to a different selection", () => {
    renderEditor();
    click(treeItem("Alpha"));
    const name = container.querySelector<HTMLInputElement>(".bookmark-editor-details input");
    if (!name) throw new Error("Name input missing");
    setInput(name, "Uncommitted Alpha");
    click(button("External Visit"));
    expect(name.value).toBe("Uncommitted Alpha");
    expect(container.querySelector(".bookmark-editor-details")?.textContent).toContain("Times visited:3");
    click(treeItem("Charlie"));
    expect(getTree().rootChildren[0]).toMatchObject({ id: "a", name: "Alpha" });
    expect(container.querySelector<HTMLInputElement>(".bookmark-editor-details input")?.value).toBe("Charlie");
  });

  it("live-syncs an externally changed selected Bookmark without editor-induced visit recording", () => {
    renderEditor();
    click(treeItem("Alpha"));
    click(button("External Rename"));
    expect(treeItem("Renamed Elsewhere")).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>(".bookmark-editor-details input")?.value).toBe("Renamed Elsewhere");
    expect(getTree().rootChildren[0]).toMatchObject({ visitCount: 2 });
    click(button("External Visit"));
    expect(container.querySelector(".bookmark-editor-details")?.textContent).toContain("Times visited:3");
  });
});
