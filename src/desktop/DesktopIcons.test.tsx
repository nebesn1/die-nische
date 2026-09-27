import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nContext } from "../i18n/I18nContext";
import { createTranslator } from "../i18n/translate";
import type { DesktopLocale } from "../i18n/locale";
import { createInitialVfsState } from "../vfs/initialState";
import { moveVfsNodeToTrash } from "../vfs/mutations";
import type { VfsState } from "../vfs/types";
import { createVfsOperations } from "../vfs/vfsOperations";
import { VfsContext } from "../vfs/VfsContext";
import { DesktopIcons } from "./DesktopIcons";

const makeVfsContextValue = (state: VfsState) => ({
  state,
  ...createVfsOperations(
    () => state,
    () => undefined,
  ),
});

const renderDesktopIcons = (selectedIconId: string | null = null, state: VfsState = createInitialVfsState()): string =>
  renderToStaticMarkup(
    <VfsContext.Provider value={makeVfsContextValue(state)}>
      <DesktopIcons
        selectedIconId={selectedIconId}
        onSelectIcon={() => undefined}
        onClearSelection={() => undefined}
        onOpenIcon={() => undefined}
        onOpenContextMenu={() => undefined}
      />
    </VfsContext.Provider>,
  );

const renderDesktopIconsForLocale = (locale: DesktopLocale): string =>
  renderToStaticMarkup(
    <I18nContext.Provider value={{ locale, t: createTranslator(locale) }}>
      <VfsContext.Provider value={makeVfsContextValue(createInitialVfsState())}>
        <DesktopIcons
          selectedIconId={null}
          onSelectIcon={() => undefined}
          onClearSelection={() => undefined}
          onOpenIcon={() => undefined}
          onOpenContextMenu={() => undefined}
        />
      </VfsContext.Provider>
    </I18nContext.Provider>,
  );

describe("DesktopIcons SSR structure", () => {
  it("renders a labelled desktop icon group", () => {
    const markup = renderDesktopIcons();

    expect(markup).toContain("role=\"group\"");
    expect(markup).toContain("aria-label=\"Desktop icons\"");
  });

  it("renders Trash, My Computer, Blog, and About in stable desktop order", () => {
    const markup = renderDesktopIcons();

    expect(markup.match(/<button/g)).toHaveLength(4);
    expect(markup).toContain("data-desktop-icon-id=\"desktop-trash\"");
    expect(markup).toContain("data-desktop-icon-id=\"desktop-my-computer\"");
    expect(markup).toContain("data-desktop-icon-id=\"desktop-blog\"");
    expect(markup).toContain("data-desktop-icon-id=\"desktop-about-die-nische\"");
    expect(markup.indexOf("desktop-trash")).toBeLessThan(markup.indexOf("desktop-my-computer"));
    expect(markup.indexOf("desktop-my-computer")).toBeLessThan(markup.indexOf("desktop-blog"));
    expect(markup.indexOf("desktop-blog")).toBeLessThan(markup.indexOf("desktop-about-die-nische"));
    expect(markup).not.toContain("CD/DVD-ROM Device");
    expect(markup).not.toContain("Floppy Device");
  });

  it("marks My Computer selected and the remaining launchers unselected", () => {
    const markup = renderDesktopIcons("desktop-my-computer");

    expect(markup).toContain("class=\"desktop-icon is-selected\"");
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it("marks Trash icon empty and full state from the shared VFS", () => {
    const emptyMarkup = renderDesktopIcons();
    const trashed = moveVfsNodeToTrash(createInitialVfsState(), "/home/user/Documents/Notes.txt", {
      now: "2026-08-03T00:00:00.000Z",
    });

    if (!trashed.ok) {
      throw new Error("trash fixture failed");
    }

    const fullMarkup = renderDesktopIcons(null, trashed.state);

    expect(emptyMarkup).toContain("data-trash-state=\"empty\"");
    expect(fullMarkup).toContain("data-trash-state=\"full\"");
  });

  it("renders My Computer as the second-row classic icon", () => {
    const markup = renderDesktopIcons();

    expect(markup).toContain("aria-label=\"My Computer\"");
    expect(markup).toContain("grid-row:2");
    expect(markup.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("renders Blog as the third-row code-owned launcher", () => {
    const markup = renderDesktopIcons();

    expect(markup).toContain("aria-label=\"Blog\"");
    expect(markup).toContain("grid-row:3");
  });

  it("renders About as the fourth-row project launcher with the canonical mark", () => {
    const markup = renderDesktopIcons();

    expect(markup).toContain('aria-label="About"');
    expect(markup).toContain('data-desktop-icon-id="desktop-about-die-nische"');
    expect(markup).toContain('data-icon-family="project-about"');
    expect(markup).toContain('href="/branding/die-nische-mark.svg"');
    expect(markup).toContain("grid-row:4");
  });

  it("localizes the About launcher label without changing its identity", () => {
    expect(renderDesktopIconsForLocale("en")).toContain('aria-label="About"');
    expect(renderDesktopIconsForLocale("zh-CN")).toContain('aria-label="关于"');
    expect(renderDesktopIconsForLocale("de")).toContain('aria-label="Über"');
    expect(renderDesktopIconsForLocale("de")).toContain('data-desktop-icon-id="desktop-about-die-nische"');
  });
});
