import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KonquerorPropertiesDialog } from "./KonquerorPropertiesDialog";

describe("KonquerorPropertiesDialog", () => {
  it("renders a KDE3 read-only metadata dialog for the selected stable node", () => {
    const markup = renderToStaticMarkup(
      <KonquerorPropertiesDialog nodeId="vfs-content-e594a065214576326cb903a5" vfsState={createInitialVfsState()} onClose={() => undefined} />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Properties for &quot;Notes.txt&quot;');
    expect(markup).toContain("Type:");
    expect(markup).toContain("Text Document");
    expect(markup).toContain("Location:");
    expect(markup).toContain("/home/user/Documents");
    expect(markup).toContain("Full path:");
    expect(markup).toContain("/home/user/Documents/Notes.txt");
    expect(markup).toContain("Created:");
    expect(markup).toContain("Modified:");
    expect(markup).toContain(">OK<");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<textarea");
  });

  it("shows a controlled unavailable state without rebinding to another selection", () => {
    const markup = renderToStaticMarkup(
      <KonquerorPropertiesDialog nodeId="missing-node" vfsState={createInitialVfsState()} onClose={() => undefined} />,
    );

    expect(markup).toContain(">Properties<");
    expect(markup).toContain("This item is no longer available.");
    expect(markup).toContain(">OK<");
  });

  it("does not render while closed", () => {
    expect(
      renderToStaticMarkup(
        <KonquerorPropertiesDialog nodeId={null} vfsState={createInitialVfsState()} onClose={() => undefined} />,
      ),
    ).toBe("");
  });
});
