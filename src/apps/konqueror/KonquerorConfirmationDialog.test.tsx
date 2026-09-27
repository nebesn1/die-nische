import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorConfirmationDialog } from "./KonquerorConfirmationDialog";

describe("KonquerorConfirmationDialog", () => {
  it("does not render interactive controls while closed", () => {
    const markup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{ kind: "closed" }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toBe("");
  });

  it("renders a Move to Trash alert dialog with controlled error display", () => {
    const markup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{
          kind: "move-to-trash",
          targetNodeIds: ["vfs-content-e594a065214576326cb903a5"],
          operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5"],
          targetLabel: "Notes.txt",
          error: {
            code: "ALREADY_IN_TRASH",
            message: "Already in Trash.",
          },
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("role=\"alertdialog\"");
    expect(markup).toContain("aria-modal=\"true\"");
    expect(markup).toContain("Move Notes.txt to the Trash?");
    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("Items already in the Trash cannot be changed here.");
    expect(markup).toContain("Move to Trash");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain("Delete Permanently");
  });

  it("renders permanent delete and empty Trash confirmations", () => {
    const deleteMarkup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{
          kind: "delete-permanently",
          targetNodeIds: ["vfs-content-e594a065214576326cb903a5"],
          targetLabel: "Notes.txt",
          error: null,
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{
          kind: "empty-trash",
          error: null,
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(deleteMarkup).toContain("Delete Permanently");
    expect(deleteMarkup).toContain("Permanently delete Notes.txt?");
    expect(deleteMarkup).toContain("This action cannot be undone.");
    expect(emptyMarkup).toContain("Empty Trash");
    expect(emptyMarkup).toContain("Permanently delete all items in the Trash?");
    expect(emptyMarkup).toContain("This action cannot be undone.");
  });

  it("uses operation-appropriate stale wording for Move to Trash", () => {
    const markup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{
          kind: "move-to-trash",
          targetNodeIds: ["vfs-content-e594a065214576326cb903a5"],
          operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5"],
          targetLabel: "Notes.txt",
          error: { code: "NOT_FOUND", message: "Node was not found." },
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("One or more selected items no longer exist.");
    expect(markup).not.toContain("clipboard item");
  });

  it("keeps the raw selected-count wording when the recursive mutation has fewer roots", () => {
    const markup = renderToStaticMarkup(
      <KonquerorConfirmationDialog
        confirmationState={{
          kind: "move-to-trash",
          targetNodeIds: ["vfs-project", "vfs-branch", "vfs-branch-file"],
          operationRootNodeIds: ["vfs-project"],
          targetLabel: "3 selected items",
          error: null,
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("Move 3 selected items to the Trash?");
  });
});
