import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { createVfsDirectory, createVfsLinks, createVfsTextFile, moveVfsNodeToTrash } from "../../vfs/mutations";
import { getKonquerorExpandableTreeNodeIds, getKonquerorVisibleTreeRows } from "./treeProjection";

const sort = { key: "name", direction: "ascending" } as const;

describe("Konqueror visible Tree projection", () => {
  it("keeps an eight-level branch on the fixed metadata grid without moving later root siblings", () => {
    const now = "2026-08-31T00:00:00.000Z";
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    let state = createInitialVfsState();
    const initialDocumentNodeIds = getKonquerorVisibleTreeRows(state, state.specialLocations.documents, sort, []).map((row) => row.nodeId);
    let parentPath = "/home/user/Documents";
    const directoryIds: string[] = [];

    for (const name of names) {
      const directory = createVfsDirectory(state, parentPath, name, { now });
      if (!directory.ok) throw new Error(`${name} fixture failed`);
      state = directory.state;
      directoryIds.push(directory.value.id);
      parentPath = `${parentPath}/${name}`;
    }
    const leaf = createVfsTextFile(state, parentPath, "H.txt", "h", { now });
    if (!leaf.ok) throw new Error("H.txt fixture failed");

    const rows = getKonquerorVisibleTreeRows(
      leaf.state,
      leaf.state.specialLocations.documents,
      sort,
      directoryIds,
    );
    const deepLeaf = rows.find((row) => row.nodeId === leaf.value.id);

    expect(rows.map((row) => row.nodeId)).toEqual([...directoryIds, leaf.value.id, ...initialDocumentNodeIds]);
    expect(deepLeaf).toMatchObject({
      parentId: directoryIds.at(-1),
      depth: 7,
      isLastSibling: true,
      ancestorContinuation: [true, false, false, false, false, false, false],
    });
    expect(rows.filter((row) => directoryIds.includes(row.nodeId)).every((row) => row.expandable && row.expanded)).toBe(true);
  });

  it("projects only root children until a directory expands", () => {
    const state = createInitialVfsState();
    const root = state.specialLocations.documents;
    const childIds = getKonquerorVisibleTreeRows(state, root, sort, []).map((row) => row.nodeId);
    expect(getKonquerorVisibleTreeRows(state, root, sort, []).map((row) => row.nodeId)).toEqual(childIds);
    expect(getKonquerorVisibleTreeRows(state, root, sort, [root]).map((row) => row.nodeId)).toEqual(childIds);
  });

  it("presents directory Links as leaves without borrowing target children", () => {
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Pictures", "Folder", {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!folder.ok) throw new Error("Folder fixture failed");
    const child = createVfsTextFile(folder.state, "/home/user/Pictures/Folder", "Child.txt", "child", {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!child.ok) throw new Error("Child fixture failed");
    const link = createVfsLinks(child.state, child.state.specialLocations.documents, [folder.value.id], {
      now: "2026-09-02T00:00:00.000Z",
    });
    if (!link.ok) throw new Error("Link fixture failed");

    const rows = getKonquerorVisibleTreeRows(
      link.state,
      link.state.specialLocations.documents,
      sort,
      [folder.value.id, link.value[0]!.id],
    );
    expect(rows.find((row) => row.nodeId === link.value[0]!.id)).toMatchObject({
      expandable: false,
      expanded: false,
      hasChildren: false,
    });
    expect(rows.some((row) => row.parentId === link.value[0]!.id)).toBe(false);
  });

  it("keeps recursive expanded branches in depth-first sibling-sorted order", () => {
    const state = createInitialVfsState();
    const project = {
      id: "project", name: "Project", parentId: state.specialLocations.documents, kind: "directory" as const,
      childIds: ["z", "x"], createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
    };
    const x = { id: "x", name: "X", parentId: project.id, kind: "file" as const, encoding: "utf-8" as const, mimeType: "text/plain", content: { kind: "text" as const, text: "" }, size: 0, createdAt: project.createdAt, modifiedAt: project.modifiedAt };
    const z = { ...x, id: "z", name: "Z" };
    const documents = state.nodesById[state.specialLocations.documents];
    if (documents?.kind !== "directory") throw new Error("Documents fixture missing");
    const initialDocumentNodeIds = getKonquerorVisibleTreeRows(state, documents.id, sort, []).map((row) => row.nodeId);
    const fixture = { ...state, nodesById: { ...state.nodesById, [project.id]: project, x, z, [documents.id]: { ...documents, childIds: [...documents.childIds, project.id] } } };
    const rows = getKonquerorVisibleTreeRows(fixture, documents.id, sort, [project.id]);
    expect(rows.map((row) => row.nodeId)).toEqual([project.id, "x", "z", ...initialDocumentNodeIds]);
    expect(rows.find((row) => row.nodeId === project.id)).toMatchObject({ depth: 0, expandable: true, expanded: true });
    expect(rows.find((row) => row.nodeId === "x")).toMatchObject({ parentId: project.id, depth: 1, isLastSibling: false, ancestorContinuation: [true] });
  });

  it("keeps an expanded empty directory eligible for live child projection", () => {
    const now = "2026-08-30T00:00:00.000Z";
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", { now });
    if (!folder.ok) throw new Error("Project fixture failed");
    const initialDocumentNodeIds = getKonquerorVisibleTreeRows(folder.state, folder.state.specialLocations.documents, sort, [])
      .filter((row) => row.nodeId !== folder.value.id)
      .map((row) => row.nodeId);
    const collapsed = getKonquerorVisibleTreeRows(folder.state, folder.state.specialLocations.documents, sort, []);
    expect(collapsed.find((row) => row.nodeId === folder.value.id)).toMatchObject({ expandable: true, expanded: false, hasChildren: false });

    const expanded = getKonquerorVisibleTreeRows(folder.state, folder.state.specialLocations.documents, sort, [folder.value.id]);
    expect(expanded.map((row) => row.nodeId)).toEqual([folder.value.id, ...initialDocumentNodeIds]);
    expect(expanded.find((row) => row.nodeId === folder.value.id)).toMatchObject({ expandable: true, expanded: true, hasChildren: false });
    expect(getKonquerorExpandableTreeNodeIds(folder.state)).toContain(folder.value.id);

    const first = createVfsTextFile(folder.state, "/home/user/Documents/Project", "A.txt", "a", { now });
    if (!first.ok) throw new Error("First child fixture failed");
    expect(getKonquerorVisibleTreeRows(first.state, first.state.specialLocations.documents, sort, []).map((row) => row.nodeId))
      .toEqual([folder.value.id, ...initialDocumentNodeIds]);
    expect(getKonquerorVisibleTreeRows(first.state, first.state.specialLocations.documents, sort, []).find((row) => row.nodeId === folder.value.id))
      .toMatchObject({ expandable: true, expanded: false, hasChildren: true });
    expect(getKonquerorVisibleTreeRows(first.state, first.state.specialLocations.documents, sort, [folder.value.id]).map((row) => row.nodeId))
      .toEqual([folder.value.id, first.value.id, ...initialDocumentNodeIds]);

    const emptyAgain = moveVfsNodeToTrash(first.state, "/home/user/Documents/Project/A.txt", { now });
    if (!emptyAgain.ok) throw new Error("Child removal fixture failed");
    expect(getKonquerorVisibleTreeRows(emptyAgain.state, emptyAgain.state.specialLocations.documents, sort, [folder.value.id]).find((row) => row.nodeId === folder.value.id))
      .toMatchObject({ expandable: true, expanded: true, hasChildren: false });
    expect(getKonquerorExpandableTreeNodeIds(emptyAgain.state)).toContain(folder.value.id);

    const { [folder.value.id]: removedFolder, ...nodesById } = emptyAgain.state.nodesById;
    expect(removedFolder).toBeDefined();
    expect(getKonquerorExpandableTreeNodeIds({ ...emptyAgain.state, nodesById })).not.toContain(folder.value.id);

    const fileInstead = {
      ...emptyAgain.state.nodesById["vfs-content-e594a065214576326cb903a5"],
      id: folder.value.id,
      parentId: emptyAgain.state.specialLocations.documents,
    };
    expect(getKonquerorExpandableTreeNodeIds({
      ...emptyAgain.state,
      nodesById: { ...emptyAgain.state.nodesById, [folder.value.id]: fileInstead },
    })).not.toContain(folder.value.id);
  });

  it("keeps an expanded nested empty directory through parent collapse and re-expansion", () => {
    const now = "2026-08-30T00:00:00.000Z";
    const parent = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Project", { now });
    if (!parent.ok) throw new Error("Parent fixture failed");
    const empty = createVfsDirectory(parent.state, "/home/user/Documents/Project", "Empty", { now });
    if (!empty.ok) throw new Error("Empty fixture failed");
    const initialDocumentNodeIds = getKonquerorVisibleTreeRows(empty.state, empty.state.specialLocations.documents, sort, [])
      .filter((row) => row.nodeId !== parent.value.id)
      .map((row) => row.nodeId);

    const expanded = getKonquerorVisibleTreeRows(
      empty.state,
      empty.state.specialLocations.documents,
      sort,
      [parent.value.id, empty.value.id],
    );
    expect(expanded.map((row) => row.nodeId)).toEqual([parent.value.id, empty.value.id, ...initialDocumentNodeIds]);
    expect(expanded.find((row) => row.nodeId === empty.value.id)).toMatchObject({ expandable: true, expanded: true, hasChildren: false, depth: 1 });

    const collapsed = getKonquerorVisibleTreeRows(empty.state, empty.state.specialLocations.documents, sort, [empty.value.id]);
    expect(collapsed.map((row) => row.nodeId)).toEqual([parent.value.id, ...initialDocumentNodeIds]);
    expect(getKonquerorVisibleTreeRows(empty.state, empty.state.specialLocations.documents, sort, [parent.value.id, empty.value.id]))
      .toEqual(expanded);
  });

  it("keeps empty directory expansion available for ordinary Trash hierarchy descendants", () => {
    const now = "2026-08-30T00:00:00.000Z";
    const folder = createVfsDirectory(createInitialVfsState(), "/home/user/Documents", "Empty", { now });
    if (!folder.ok) throw new Error("Empty Trash fixture failed");
    const trashed = moveVfsNodeToTrash(folder.state, "/home/user/Documents/Empty", { now });
    if (!trashed.ok) throw new Error("Trash fixture failed");

    expect(getKonquerorVisibleTreeRows(trashed.state, trashed.state.specialLocations.trash, sort, []).find((row) => row.nodeId === folder.value.id))
      .toMatchObject({ expandable: true, expanded: false, hasChildren: false });
    expect(getKonquerorVisibleTreeRows(trashed.state, trashed.state.specialLocations.trash, sort, [folder.value.id]).find((row) => row.nodeId === folder.value.id))
      .toMatchObject({ expandable: true, expanded: true, hasChildren: false });
  });
});
