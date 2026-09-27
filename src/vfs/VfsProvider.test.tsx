import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "./initialState";
import { useVfs } from "./useVfs";
import { VfsProvider } from "./VfsProvider";
import { createVfsOperations } from "./vfsOperations";
import type { VfsState } from "./types";

const now = "2026-08-02T00:00:00.000Z";

const expectOk = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected ok result");
  }

  return result.value;
};

function SnapshotConsumer({ label }: { label: string }) {
  const { state, readTextFile } = useVfs();
  const welcome = readTextFile("/home/user/Documents/Welcome.md");

  return (
    <span data-label={label} data-revision={state.revision} data-root={state.rootId}>
      {welcome.ok ? welcome.value.name : "missing"}
    </span>
  );
}

function MissingProviderConsumer() {
  useVfs();
  return <span>never</span>;
}

describe("VfsProvider and operations", () => {
  it("exposes the initial state to consumers", () => {
    const markup = renderToStaticMarkup(
      <VfsProvider>
        <SnapshotConsumer label="one" />
      </VfsProvider>,
    );

    expect(markup).toContain("data-revision=\"0\"");
    expect(markup).toContain("data-root=\"vfs-root\"");
    expect(markup).toContain("Welcome.md");
  });

  it("lets two consumers read the same provider state", () => {
    const markup = renderToStaticMarkup(
      <VfsProvider>
        <SnapshotConsumer label="one" />
        <SnapshotConsumer label="two" />
      </VfsProvider>,
    );

    expect((markup.match(/data-root="vfs-root"/g) ?? []).length).toBe(2);
  });

  it("throws a clear development error outside the provider", () => {
    expect(() => renderToStaticMarkup(<MissingProviderConsumer />)).toThrow(
      "useVfs must be used inside VfsProvider",
    );
  });

  it("applies commands atomically against the latest shared state", () => {
    let currentState: VfsState = createInitialVfsState();
    const operations = createVfsOperations(
      () => currentState,
      (nextState) => {
        currentState = nextState;
      },
    );

    const created = operations.createTextFile("/home/user/Documents", "Shared.txt", "shared", { now });
    const listed = operations.listDirectory("/home/user/Documents");

    expect(created.ok).toBe(true);
    expect(expectOk(listed).map((node) => node.name)).toContain("Shared.txt");
    expect(currentState.revision).toBe(1);
  });

  it("appends text through provider operations against the latest shared state", () => {
    let currentState: VfsState = createInitialVfsState();
    const operations = createVfsOperations(
      () => currentState,
      (nextState) => {
        currentState = nextState;
      },
    );

    const created = operations.createTextFile("/home/user/Documents", "Log.txt", "", { now });
    const first = operations.appendTextFile("/home/user/Documents/Log.txt", "First\n", { now });
    const second = operations.appendTextFile("/home/user/Documents/Log.txt", "Second\n", { now });
    const read = operations.readTextFile("/home/user/Documents/Log.txt");
    const failed = operations.appendTextFile("/home/user/Documents", "no", { now });

    expect(created.ok).toBe(true);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(expectOk(read).content.text).toBe("First\nSecond\n");
    expect(currentState.revision).toBe(3);
    expect(failed).toMatchObject({ ok: false, error: { code: "IS_DIRECTORY" } });
    expect(expectOk(operations.readTextFile("/home/user/Documents/Log.txt")).content.text).toBe("First\nSecond\n");
  });

  it("applies relocation and Trash commands against the latest shared state", () => {
    let currentState: VfsState = createInitialVfsState();
    const operations = createVfsOperations(
      () => currentState,
      (nextState) => {
        currentState = nextState;
      },
    );

    const created = operations.createDirectory("/home/user/Documents", "Project", { now });
    const copied = operations.copyNode("/home/user/Documents/Project", "/home/user/Downloads", {
      now,
      newName: "Project Copy",
    });
    const moved = operations.moveNode("/home/user/Downloads/Project Copy", "/home/user/Music", { now });
    const trashed = operations.moveNodeToTrash("/home/user/Music/Project Copy", { now });
    const trashEntries = operations.listTrashEntries();

    expect(created.ok).toBe(true);
    expect(copied.ok).toBe(true);
    expect(moved.ok).toBe(true);
    expect(trashed.ok).toBe(true);
    expect(expectOk(trashEntries).map(({ entry }) => entry.originalName)).toEqual(["Project Copy"]);
    expect(currentState.revision).toBe(4);
  });

  it("restores, permanently deletes, and empties Trash through provider operations", () => {
    let currentState: VfsState = createInitialVfsState();
    const operations = createVfsOperations(
      () => currentState,
      (nextState) => {
        currentState = nextState;
      },
    );

    operations.createTextFile("/home/user/Documents", "One.txt", "one", { now });
    operations.createTextFile("/home/user/Documents", "Two.txt", "two", { now });
    const one = operations.moveNodeToTrash("/home/user/Documents/One.txt", { now });
    const two = operations.moveNodeToTrash("/home/user/Documents/Two.txt", { now });

    if (!one.ok || !two.ok) {
      throw new Error("fixture trash failed");
    }

    expect(operations.getTrashEntry(one.value.id)).toMatchObject({ ok: true, value: { originalName: "One.txt" } });
    expect(operations.restoreNodeFromTrash(one.value.id, { now }).ok).toBe(true);
    expect(operations.deleteNodePermanently(two.value.id, { now })).toMatchObject({
      ok: true,
      value: { deletedNodeIds: [two.value.id] },
    });
    expect(operations.emptyTrash({ now })).toMatchObject({
      ok: true,
      value: { deletedNodeIds: [] },
    });
    expect(operations.resolvePath("/home/user/Documents/One.txt")).toMatchObject({ ok: true });
  });

  it("does not commit failed commands", () => {
    let currentState: VfsState = createInitialVfsState();
    const initialReference = currentState;
    const operations = createVfsOperations(
      () => currentState,
      (nextState) => {
        currentState = nextState;
      },
    );
    const failed = operations.createTextFile("/home/user/Documents", "Welcome.md", "duplicate", { now });

    expect(failed).toMatchObject({ ok: false, error: { code: "ALREADY_EXISTS" } });
    expect(currentState).toBe(initialReference);
  });

  it("resets to the initial state when a new provider store is created", () => {
    let firstState: VfsState = createInitialVfsState();
    const firstOperations = createVfsOperations(
      () => firstState,
      (nextState) => {
        firstState = nextState;
      },
    );

    firstOperations.createDirectory("/home/user/Documents", "Temporary", { now });

    const secondState = createInitialVfsState();

    expect(firstState.revision).toBe(1);
    expect(secondState.revision).toBe(0);
    expect(secondState.nodesById["vfs-node-0010"]).toBeUndefined();
  });

  it("does not duplicate initial nodes under StrictMode-style double initialization", () => {
    const first = createInitialVfsState();
    const second = createInitialVfsState();

    expect(Object.keys(first.nodesById)).toHaveLength(Object.keys(second.nodesById).length);
    expect(Object.keys(first.nodesById)).toEqual(Object.keys(second.nodesById));
  });
});
