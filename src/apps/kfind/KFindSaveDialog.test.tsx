import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KFindSaveDialog } from "./KFindSaveDialog";

const noop = () => undefined;

describe("KFind Save Results dialog", () => {
  it("renders the KDE3 VFS save surface with the fixed plain-text filter and extension control", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(<KFindSaveDialog
      dialog={{ type: "save", directoryNodeId: state.specialLocations.documents, selectedDirectoryNodeId: null, filename: "Results.txt", autoExtension: true, error: null }}
      state={state}
      onCancel={noop}
      onGoUp={noop}
      onGoHome={noop}
      onSelectDirectory={noop}
      onOpenDirectory={noop}
      onChangeFilename={noop}
      onChangeAutoExtension={noop}
      onSave={noop}
      onReplace={noop}
    />);
    expect(markup).toContain("Save Results As - KFind");
    expect(markup).toContain("Location: /home/user/Documents");
    expect(markup).toContain("Plain Text Document");
    expect(markup).toContain("Automatically select filename extension (.txt)");
    expect(markup).toContain(">Save</button>");
    expect(markup).toContain(">Cancel</button>");
    expect(markup).not.toContain("type=\"file\"");
    expect(markup).not.toContain("/home/aoi");
  });

  it("renders a single-click folder selection without changing the displayed location", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(<KFindSaveDialog
      dialog={{ type: "save", directoryNodeId: state.specialLocations.home, selectedDirectoryNodeId: state.specialLocations.documents, filename: "Results.txt", autoExtension: true, error: null }}
      state={state}
      onCancel={noop}
      onGoUp={noop}
      onGoHome={noop}
      onSelectDirectory={noop}
      onOpenDirectory={noop}
      onChangeFilename={noop}
      onChangeAutoExtension={noop}
      onSave={noop}
      onReplace={noop}
    />);

    expect(markup).toContain("Location: /home/user");
    expect(markup).toContain("is-selected");
    expect(markup).toContain("Documents");
  });

  it("renders explicit Replace/Cancel confirmation for an existing VFS text file", () => {
    const state = createInitialVfsState();
    const markup = renderToStaticMarkup(<KFindSaveDialog
      dialog={{ type: "overwrite", directoryNodeId: state.specialLocations.documents, filename: "Results.txt", targetNodeId: "vfs-content-e594a065214576326cb903a5", autoExtension: true, error: null }}
      state={state}
      onCancel={noop}
      onGoUp={noop}
      onGoHome={noop}
      onSelectDirectory={noop}
      onOpenDirectory={noop}
      onChangeFilename={noop}
      onChangeAutoExtension={noop}
      onSave={noop}
      onReplace={noop}
    />);
    expect(markup).toContain("Replace File");
    expect(markup).toContain(">Replace</button>");
    expect(markup).toContain(">Cancel</button>");
  });
});
