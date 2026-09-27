import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");
const konquerorSource = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");
const marqueeSource = readFileSync(new URL("./useKonquerorDirectoryMarquee.ts", import.meta.url), "utf8");
const itemDragSource = readFileSync(new URL("./useKonquerorItemDrag.ts", import.meta.url), "utf8");

describe("Konqueror mobile layout contract", () => {
  it("uses the shared layout mode for mobile chrome instead of a second width breakpoint", () => {
    expect(css).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] \.application-menubar\s*\{[\s\S]*?display:\s*none;/);
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-menubar');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-toolbar');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-addressbar');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-tabbar');
    expect(css).not.toContain("@media (max-width:");
  });

  it("keeps mobile application menus semantic and leaves popup menus outside the hidden menubar policy", () => {
    expect(konquerorSource).toContain("useApplicationMenubarPolicy");
    expect(konquerorSource).toContain("dismissApplicationMenu");
    expect(konquerorSource).toContain("layoutMode={layoutMode}");
    expect(readFileSync(new URL("../applicationMenubarPolicy.ts", import.meta.url), "utf8")).toContain("APPLICATION_MENUBAR_CLASS");
  });

  it("keeps details columns scrollable while making icon view fit the mobile width", () => {
    expect(css).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] \.konqueror-directory-view\s*\{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] \.konqueror-directory-header,[\s\S]*?min-width:\s*510px;/);
    expect(css).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] \.konqueror-icon-view\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?grid-template-columns:\s*repeat\(auto-fill, minmax\(88px, 1fr\)\);/);
  });

  it("keeps dialogs, properties, Bookmark Editor and built-in content within the mobile client area", () => {
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-dialog-backdrop');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-properties-dialog__metadata');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .bookmark-editor-details');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-image-view__image');
    expect(css).toContain('.desktop-shell[data-layout-mode="mobile"] .konqueror-media-view__stage');
  });

  it("stacks sysinfo sections in mobile while preserving the desktop grid and scroll owner", () => {
    const sysinfoSource = readFileSync(new URL("./KonquerorSysinfoView.tsx", import.meta.url), "utf8");

    expect(css).toContain(".konqueror-sysinfo__columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toMatch(/\.desktop-shell\[data-layout-mode="mobile"\] \.konqueror-sysinfo__columns\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.konqueror-directory-viewport\s*\{[\s\S]*?overflow:\s*auto;/);
    expect(sysinfoSource).toContain("konqueror-sysinfo__columns");
    expect(sysinfoSource).toContain("konqueror-sysinfo__column");
    expect(sysinfoSource).toContain("konqueror-sysinfo__section");
    expect(sysinfoSource).toContain("InfoSection");
  });

  it("keeps embedded document and article media responsive without cropping", () => {
    expect(css).toMatch(/\.article-reader__body video,[\s\S]*?\.konqueror-preview-document__canvas video \{[^}]*max-width:\s*100%;[^}]*height:\s*auto;/);
    expect(css).toMatch(/\.article-reader__body audio,[\s\S]*?\.konqueror-preview-document__canvas audio \{[^}]*width:\s*100%;[^}]*max-width:\s*100%;/);
    expect(css).not.toContain(".article-reader__body video { object-fit: cover;");
    expect(css).not.toContain(".konqueror-preview-document__canvas video { object-fit: cover;");
  });

  it("passes the centralized layout mode to both resource view variants", () => {
    expect(konquerorSource).toContain('layoutMode={windowManager?.layoutMode ?? "desktop"}');
    expect(konquerorSource).toContain("<KonquerorDirectoryView");
    expect(konquerorSource).toContain("<KonquerorIconView");
  });

  it("keeps desktop marquee and drag state machines out of touch scrolling", () => {
    expect(marqueeSource).toContain("isTouchLikePointer(event.pointerType)");
    expect(itemDragSource).toContain("isTouchLikePointer(event.pointerType)");
  });
});
