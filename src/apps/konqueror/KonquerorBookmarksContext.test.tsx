// @vitest-environment jsdom
import { StrictMode, act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KonquerorBookmarksProvider } from "./KonquerorBookmarksContext";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import { createKonquerorBookmarksStorage, type KonquerorBookmarksStorageBackend } from "./bookmarksPersistence";

let container: HTMLDivElement;
let reactRoot: Root;

function createMemoryStorage(): KonquerorBookmarksStorageBackend & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function BookmarkProbe() {
  const bookmarks = useContext(KonquerorBookmarksContext);
  const visitTarget = bookmarks.getNode("bookmark-2");
  return (
    <section>
      <output data-testid="root-count">{bookmarks.bookmarks.rootChildren.length}</output>
      <output data-testid="visit-count">{visitTarget?.type === "bookmark" ? visitTarget.visitCount : -1}</output>
      <button type="button" onClick={() => bookmarks.addFolder({ name: "Work" })}>Add folder</button>
      <button type="button" onClick={() => bookmarks.addBookmark({ name: "Example", location: "https://example.com" }, "bookmark-1")}>Add bookmark</button>
      <button type="button" onClick={() => bookmarks.recordVisit("bookmark-2")}>Visit bookmark</button>
    </section>
  );
}

function SharedAuthorityProbe({ consumer }: { readonly consumer: "a" | "b" }) {
  const bookmarks = useContext(KonquerorBookmarksContext);
  const sharedBookmark = bookmarks.getNode("bookmark-1");
  return (
    <section>
      <output data-testid={`${consumer}-count`}>{bookmarks.bookmarks.rootChildren.length}</output>
      <output data-testid={`${consumer}-name`}>{sharedBookmark?.type === "bookmark" ? sharedBookmark.name : "missing"}</output>
      {consumer === "a" ? (
        <button type="button" onClick={() => bookmarks.addBookmark({ name: "Created by A", location: "https://example.com" })}>A add bookmark</button>
      ) : (
        <button type="button" onClick={() => bookmarks.updateBookmark("bookmark-1", { name: "Updated by B" })}>B rename bookmark</button>
      )}
    </section>
  );
}

const click = (label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Missing ${label}`);
  act(() => button.click());
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
});

describe("KonquerorBookmarksProvider", () => {
  it("owns one write-through bookmark tree for all future Konqueror bookmark surfaces", () => {
    const memoryStorage = createMemoryStorage();
    let nextId = 1;

    act(() => {
      reactRoot.render(
        <StrictMode>
          <KonquerorBookmarksProvider
            storage={createKonquerorBookmarksStorage(() => memoryStorage)}
            createNodeId={() => `bookmark-${nextId++}`}
            now={() => "2026-09-07T00:00:00.000Z"}
          >
            <BookmarkProbe />
          </KonquerorBookmarksProvider>
        </StrictMode>,
      );
    });

    click("Add folder");
    click("Add bookmark");
    click("Visit bookmark");

    expect(container.querySelector("[data-testid='root-count']")?.textContent).toBe("1");
    expect(container.querySelector("[data-testid='visit-count']")?.textContent).toBe("1");
    const persisted = [...memoryStorage.values.values()][0];
    expect(persisted).toContain('"id":"bookmark-1"');
    expect(persisted).toContain('"id":"bookmark-2"');
    expect(persisted).toContain('"visitCount":1');
  });

  it("shares one authoritative bookmark state between independent consumers", () => {
    let nextId = 1;

    act(() => {
      reactRoot.render(
        <KonquerorBookmarksProvider
          storage={createKonquerorBookmarksStorage(() => createMemoryStorage())}
          createNodeId={() => `bookmark-${nextId++}`}
        >
          <SharedAuthorityProbe consumer="a" />
          <SharedAuthorityProbe consumer="b" />
        </KonquerorBookmarksProvider>,
      );
    });

    click("A add bookmark");
    expect(container.querySelector("[data-testid='a-count']")?.textContent).toBe("1");
    expect(container.querySelector("[data-testid='b-count']")?.textContent).toBe("1");
    expect(container.querySelector("[data-testid='b-name']")?.textContent).toBe("Created by A");

    click("B rename bookmark");
    expect(container.querySelector("[data-testid='a-name']")?.textContent).toBe("Updated by B");
    expect(container.querySelector("[data-testid='b-name']")?.textContent).toBe("Updated by B");
  });
});
