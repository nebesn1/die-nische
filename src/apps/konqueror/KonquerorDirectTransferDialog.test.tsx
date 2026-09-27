import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorDirectTransferDialog } from "./KonquerorDirectTransferDialog";

const copyState = {
  kind: "open" as const,
  request: {
    kind: "copy" as const,
    sourceKind: "selection" as const,
    ownerWindowId: "konqueror-a",
    sourceLocationNodeId: "vfs-documents",
    rawDraggedNodeIds: ["vfs-content-e594a065214576326cb903a5"],
    operationRootNodeIds: ["vfs-content-e594a065214576326cb903a5"],
    sourceParentIdsByNodeId: { "vfs-content-e594a065214576326cb903a5": "vfs-documents" },
  },
  destinationDraft: "/home/user/Documents",
  error: null,
};

describe("KonquerorDirectTransferDialog", () => {
  it("uses one compact destination dialog for Copy and Move", () => {
    const copyMarkup = renderToStaticMarkup(
      <KonquerorDirectTransferDialog dialogState={copyState} onChangeDestination={() => undefined} onCancel={() => undefined} onSubmit={() => undefined} />,
    );
    const moveMarkup = renderToStaticMarkup(
      <KonquerorDirectTransferDialog dialogState={{ ...copyState, request: { ...copyState.request, kind: "move" } }} onChangeDestination={() => undefined} onCancel={() => undefined} onSubmit={() => undefined} />,
    );

    expect(copyMarkup).toContain("Copy Files");
    expect(moveMarkup).toContain("Move Files");
    expect(copyMarkup).toContain("Destination folder:");
    expect(copyMarkup).toContain('value="/home/user/Documents"');
    expect(copyMarkup).toContain("role=\"dialog\"");
    expect(copyMarkup).not.toContain("Browse");
  });
});
