// @vitest-environment jsdom
import { act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKonsoleBookmarksStorage } from "./konsoleBookmarksPersistence";
import { KonsoleBookmarksProvider } from "./KonsoleBookmarksContext";
import { KonsoleBookmarksContext } from "./konsoleBookmarksContext";

let container: HTMLDivElement;
let root: Root;

function Consumer({ label }: { readonly label: string }) {
  const { bookmarks, addBookmark, updateBookmark } = useContext(KonsoleBookmarksContext);
  const first = bookmarks.rootChildren[0];
  return (
    <section>
      <output data-testid={`${label}-count`}>{bookmarks.rootChildren.length}</output>
      <output data-testid={`${label}-name`}>{first?.name ?? ""}</output>
      <button type="button" onClick={() => addBookmark({ name: "Added by A", location: "/home/user/", comment: "" })}>{label} add</button>
      <button type="button" onClick={() => first && updateBookmark(first.id, { name: "Renamed by B" })}>{label} rename</button>
    </section>
  );
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("KonsoleBookmarksProvider", () => {
  it("shares one independent authority across all Konsole consumers", () => {
    let nextId = 1;
    const values = new Map<string, string>();
    act(() => {
      root.render(
        <KonsoleBookmarksProvider
          storage={createKonsoleBookmarksStorage(() => ({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => { values.delete(key); } }))}
          createNodeId={() => `konsole-${nextId++}`}
        >
          <Consumer label="a" />
          <Consumer label="b" />
        </KonsoleBookmarksProvider>,
      );
    });

    act(() => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "a add")?.click());
    expect(container.querySelector("[data-testid='a-count']")?.textContent).toBe("1");
    expect(container.querySelector("[data-testid='b-name']")?.textContent).toBe("Added by A");
    act(() => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "b rename")?.click());
    expect(container.querySelector("[data-testid='a-name']")?.textContent).toBe("Renamed by B");
  });
});
