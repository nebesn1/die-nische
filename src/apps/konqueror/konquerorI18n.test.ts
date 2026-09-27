import { describe, expect, it } from "vitest";
import { createTranslator } from "../../i18n/translate";
import {
  translateKonquerorApplicationMenuEntries,
  translateKonquerorAvailabilityText,
  translateKonquerorContextMenuEntries,
} from "./konquerorI18n";

describe("Konqueror presentation translations", () => {
  it("translates recursive application-menu labels without changing command identity or bookmark data", () => {
    const entries = [
      { kind: "action", action: "open-bookmark", label: "Dokumente", enabled: true, title: "Dokumente", bookmarkId: "bookmark-1" },
      {
        kind: "submenu",
        id: "create-new",
        label: "Create New",
        enabled: true,
        title: "Create New",
        items: [{ kind: "action", action: "new-folder", label: "Folder", enabled: true, title: "Folder" }],
      },
    ] as const;

    const translated = translateKonquerorApplicationMenuEntries(createTranslator("zh-CN"), entries);
    expect(translated[0]).toMatchObject({ action: "open-bookmark", bookmarkId: "bookmark-1", label: "Dokumente" });
    expect(translated[1]).toMatchObject({ id: "create-new", label: "新建" });
    expect(translated[1].kind === "submenu" && translated[1].items[0]).toMatchObject({ action: "new-folder", label: "文件夹" });
  });

  it("translates context-menu presentation while preserving product names and separators", () => {
    const entries = [
      { kind: "submenu", id: "open-with", label: "Open With", enabled: true, title: "Open With", items: [{ kind: "action", action: "open-with-kwrite", label: "KWrite", enabled: true, title: "KWrite" }] },
      { kind: "separator" },
      { kind: "action", action: "copy-to", label: "Copy To", enabled: true, title: "Copy To" },
    ] as const;

    const translated = translateKonquerorContextMenuEntries(createTranslator("de"), entries);
    expect(translated[0]).toMatchObject({ id: "open-with", label: "Öffnen mit" });
    expect(translated[0].kind === "submenu" && translated[0].items[0]).toMatchObject({ label: "KWrite" });
    expect(translated[1]).toEqual({ kind: "separator" });
    expect(translated[2]).toMatchObject({ action: "copy-to", label: "Kopieren nach" });
  });

  it("retranslates domain-owned availability text without changing unknown content", () => {
    const t = createTranslator("zh-CN");

    expect(translateKonquerorAvailabilityText(t, "Finish the current operation first")).toBe("请先完成当前操作");
    expect(translateKonquerorAvailabilityText(t, "README.md")).toBe("README.md");
  });
});
