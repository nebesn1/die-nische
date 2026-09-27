import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KonquerorIconView } from "./KonquerorIconView";

describe("KonquerorIconView", () => {
  it("renders stable node-id options and a selected KDE icon item at the requested zoom", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(
      <KonquerorIconView
        childrenNodes={[
          state.nodesById[state.specialLocations.documents],
          state.nodesById[state.specialLocations.downloads],
        ]}
        selectedNodeIds={[state.specialLocations.documents]}
        vfsState={state}
        onSelectNode={() => undefined}
        onClearSelection={() => undefined}
        onOpenNode={() => undefined}
        onMoveSelection={() => undefined}
        zoomLevel="large"
      />,
    );

    expect(markup).toContain("class=\"konqueror-icon-view\"");
    expect(markup).toContain("role=\"option\"");
    expect(markup).toContain("aria-selected=\"true\"");
    expect(markup).toContain("konqueror-icon-item is-selected");
    expect(markup).toContain("Documents");
    expect(markup).toContain('data-resource-view="icons"');
    expect(markup).toContain('data-resource-zoom="large"');
  });

  it("renders a presentation label while retaining stable canonical node identity", () => {
    const state = createInitialVfsState();
    const documents = state.nodesById[state.specialLocations.documents];
    if (!documents) throw new Error("Documents fixture missing");
    const displayNamed = { ...documents, displayName: "My Documents" };
    const markup = renderToStaticMarkup(
      <KonquerorIconView childrenNodes={[displayNamed]} selectedNodeIds={[]} vfsState={{ ...state, nodesById: { ...state.nodesById, [documents.id]: displayNamed } }} onSelectNode={() => undefined} onClearSelection={() => undefined} onOpenNode={() => undefined} onMoveSelection={() => undefined} />,
    );

    expect(markup).toContain("My Documents");
    expect(markup).toContain(`data-konqueror-node-id="${documents.id}"`);
  });
});
