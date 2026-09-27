import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KonquerorDirectoryView } from "./KonquerorDirectoryView";

describe("KonquerorDirectoryView", () => {
  it("renders the former detailed list as Tree View without changing node-id selection or headers", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView
        childrenNodes={[state.nodesById[state.specialLocations.documents]]}
        selectedNodeIds={[state.specialLocations.documents]}
        vfsState={state}
        zoomLevel="extra-large"
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
      />,
    );

    expect(markup).toContain('data-resource-view="tree"');
    expect(markup).toContain('data-resource-zoom="extra-large"');
    expect(markup).toContain('aria-label="Tree View contents"');
    expect(markup).toContain("Name");
    expect(markup).toContain("Size");
    expect(markup).toContain("Type");
    expect(markup).toContain("Modified");
    expect(markup).toContain('aria-selected="true"');
  });

  it("uses displayName in the Name presentation without changing the row node id", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    if (!documents) throw new Error("Documents fixture missing");
    const displayNamed = { ...documents, displayName: "My Documents" };
    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView childrenNodes={[displayNamed]} selectedNodeIds={[]} vfsState={{ ...state, nodesById: { ...state.nodesById, [documents.id]: displayNamed } }} onSelectNode={() => undefined} onClearSelection={() => undefined} onOpenNode={() => undefined} />,
    );

    expect(markup).toContain('class="konqueror-tree-label">My Documents</span>');
    expect(markup).toContain(`data-konqueror-node-id="${documents.id}"`);
  });

  it("renders metadata-driven connector segments and name-only selection inside the Name cell", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    const downloads = state.nodesById[state.specialLocations.downloads];
    const notes = state.nodesById["vfs-content-e594a065214576326cb903a5"];
    const welcome = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];
    if (!documents || !downloads || !notes || !welcome) throw new Error("Tree fixture missing");

    const markup = renderToStaticMarkup(
      <KonquerorDirectoryView
        childrenNodes={[documents, downloads, notes, welcome]}
        treeRows={[
          { nodeId: documents.id, parentId: state.specialLocations.home, depth: 0, expandable: true, expanded: true, hasChildren: true, isLastSibling: false, ancestorContinuation: [] },
          { nodeId: notes.id, parentId: documents.id, depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: false, ancestorContinuation: [true] },
          { nodeId: welcome.id, parentId: documents.id, depth: 1, expandable: false, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [true] },
          { nodeId: downloads.id, parentId: state.specialLocations.home, depth: 0, expandable: true, expanded: false, hasChildren: false, isLastSibling: true, ancestorContinuation: [] },
        ]}
        selectedNodeIds={[notes.id]}
        vfsState={state}
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
      />,
    );

    expect(markup).toContain('data-tree-current-branch="tee"');
    expect(markup).toContain('data-tree-current-branch="elbow"');
    expect(markup).not.toContain('data-tree-current-branch="root"');
    expect(markup).toContain('data-tree-ancestor-level="0" data-tree-continues="true"');
    expect((markup.match(/data-konqueror-node-id/g) ?? [])).toHaveLength(4);
    expect((markup.match(/data-tree-expander-slot="true"/g) ?? [])).toHaveLength(4);
    expect((markup.match(/class="konqueror-tree-expander"/g) ?? [])).toHaveLength(2);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('class="konqueror-directory-row is-selected"');
    expect(markup).toContain('class="konqueror-tree-label is-selected"');
    expect((markup.match(/konqueror-directory-item-hit-target/g) ?? [])).toHaveLength(4);
    expect(markup).toContain('class="konqueror-tree-label">Documents</span>');
    expect(markup).not.toContain("[+]");
    expect(markup).not.toContain("[-]");
  });
});
