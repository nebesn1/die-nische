import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { KonquerorSysinfoView } from "./KonquerorSysinfoView";

describe("KonquerorSysinfoView", () => {
  it("renders the KDE-style My Computer information sections and virtual VFS labels", () => {
    const markup = renderToStaticMarkup(
      <KonquerorSysinfoView vfsState={createInitialVfsState()} onOpenDirectory={vi.fn()} />,
    );

    expect(markup).toContain("My Computer");
    expect(markup).toContain("Folders, Virtual Storage, System Information and more...");
    expect(markup).toContain("Common Folders");
    expect(markup).toContain("Disk Information");
    expect(markup).toContain("Network Status");
    expect(markup).toContain("OS Information");
    expect(markup).toContain("CPU Information");
    expect(markup).toContain("Display Info");
    expect(markup).toContain("Memory Information");
    expect(markup).toContain("KDE3 Virtual Disk");
    expect(markup).toContain("In-memory VFS");
    expect(markup).toContain("die Nische");
    expect(markup).toContain("KDE 3-inspired browser desktop");
    expect(markup).not.toContain("KDE 3.0-inspired browser desktop");
    expect(markup).toContain("Network Folders");
    expect(markup).toContain("Unavailable in web prototype");
    expect(markup).not.toContain("openSUSE");
  });
});
