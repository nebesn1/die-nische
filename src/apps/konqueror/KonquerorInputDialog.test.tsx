import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VfsError } from "../../vfs/errors";
import { KonquerorInputDialog } from "./KonquerorInputDialog";

const error: VfsError = {
  code: "ALREADY_EXISTS",
  message: "Duplicate",
};

describe("KonquerorInputDialog", () => {
  it("does not render when closed", () => {
    const markup = renderToStaticMarkup(
      <KonquerorInputDialog
        dialogState={{ kind: "closed" }}
        onChangeDraft={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toBe("");
  });

  it("renders New Folder dialog with accessible structure", () => {
    const markup = renderToStaticMarkup(
      <KonquerorInputDialog
        dialogState={{
          kind: "new-folder",
          parentNodeId: "vfs-documents",
          preserveSelection: false,
          draftName: "",
          error: null,
        }}
        onChangeDraft={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("role=\"dialog\"");
    expect(markup).toContain("aria-modal=\"true\"");
    expect(markup).toContain("Create Folder");
    expect(markup).toContain("Folder name:");
    expect(markup).toContain("type=\"submit\"");
    expect(markup).toContain("OK");
    expect(markup).toContain("Cancel");
  });

  it("renders New Text File and Rename labels", () => {
    const textFileMarkup = renderToStaticMarkup(
      <KonquerorInputDialog
        dialogState={{
          kind: "new-text-file",
          parentNodeId: "vfs-documents",
          draftName: "",
          error: null,
        }}
        onChangeDraft={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    const renameMarkup = renderToStaticMarkup(
      <KonquerorInputDialog
        dialogState={{
          kind: "rename",
          targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
          originalName: "Welcome.md",
          draftName: "Welcome.md",
          error: null,
        }}
        onChangeDraft={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(textFileMarkup).toContain("Create New Text File");
    expect(textFileMarkup).toContain("File name:");
    expect(renameMarkup).toContain("Rename");
    expect(renameMarkup).toContain("New name:");
    expect(renameMarkup).toContain("value=\"Welcome.md\"");
  });

  it("renders mutation errors inside the dialog", () => {
    const markup = renderToStaticMarkup(
      <KonquerorInputDialog
        dialogState={{
          kind: "new-folder",
          parentNodeId: "vfs-documents",
          preserveSelection: false,
          draftName: "Notes.txt",
          error,
        }}
        onChangeDraft={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("role=\"alert\"");
    expect(markup).toContain("An item with this name already exists.");
  });
});
