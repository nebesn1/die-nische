import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { isVfsTextFile } from "../../vfs/fileContent";
import type { KonquerorEditorState } from "./editorTypes";
import { KonquerorTextEditor } from "./KonquerorTextEditor";

const file = (() => {
  const state = createInitialVfsState();
  const node = state.nodesById["vfs-content-76cff3ce17d8a853403179f1"];

  if (!isVfsTextFile(node)) {
    throw new Error("fixture file missing");
  }

  return node;
})();

const renderEditor = (editorState: Extract<KonquerorEditorState, { readonly kind: "editing" }>) =>
  renderToStaticMarkup(
    <KonquerorTextEditor
      file={file}
      editorState={editorState}
      draftSize={editorState.draftContent.length}
      onChangeDraft={() => undefined}
      onSave={() => undefined}
      onDiscardClean={() => undefined}
      onClearError={() => undefined}
    />,
  );

describe("KonquerorTextEditor", () => {
  it("renders a controlled textarea instead of a read-only pre", () => {
    const markup = renderEditor({
      kind: "editing",
      targetNodeId: file.id,
      originalContent: file.content.text,
      draftContent: "Changed",
      originalModifiedAt: file.modifiedAt,
      saveError: null,
    });

    expect(markup).toContain("<textarea");
    expect(markup).toContain("aria-label=\"Edit Welcome.md\"");
    expect(markup).toContain("Changed");
    expect(markup).toContain("Unsaved changes");
    expect(markup).not.toContain("<pre");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
  });

  it("renders save errors with alert semantics", () => {
    const markup = renderEditor({
      kind: "editing",
      targetNodeId: file.id,
      originalContent: file.content.text,
      draftContent: "Changed",
      originalModifiedAt: file.modifiedAt,
      saveError: {
        code: "NOT_FOUND",
        message: "Missing",
      },
    });

    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("The file no longer exists.");
  });
});
