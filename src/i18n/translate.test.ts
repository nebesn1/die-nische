import { describe, expect, it } from "vitest";
import { englishMessages } from "./messages/en";
import { simplifiedChineseMessages } from "./messages/zh-CN";
import { germanMessages } from "./messages/de";
import { translateMessage, translateMessageFromMessages } from "./translate";
import { PROJECT_BRAND, PROJECT_DESCRIPTION, PROJECT_INDEPENDENCE_NOTICE } from "../branding/projectIdentity";

describe("desktop translation lookup", () => {
  it("looks up English, Simplified Chinese, and German messages", () => {
    expect(translateMessage("en", "common.apply")).toBe("Apply");
    expect(translateMessage("zh-CN", "common.apply")).toBe("应用");
    expect(translateMessage("de", "common.apply")).toBe("Anwenden");
  });

  it("supports locale-neutral interpolation without fragment concatenation", () => {
    expect(translateMessage("en", "window.moveToDesktop", { number: 2 })).toBe("Move to Desktop 2");
    expect(translateMessage("zh-CN", "window.moveToDesktop", { number: 2 })).toBe("移动到桌面 2");
    expect(translateMessage("de", "window.moveToDesktop", { number: 2 })).toBe("Auf Arbeitsfläche 2 verschieben");
    expect(translateMessage("zh-CN", "controlCenter.countryRegionLanguage")).toBe("国家/地区和语言");
  });

  it("covers core shell and system UI labels in every supported locale", () => {
    expect(translateMessage("en", "kicker.configureClock")).toBe("Configure Clock...");
    expect(translateMessage("zh-CN", "kicker.configureClock")).toBe("配置时钟…");
    expect(translateMessage("de", "desktop.emptyTrash")).toBe("Mülleimer leeren");
    expect(translateMessage("zh-CN", "calendar.week", { number: "08" })).toBe("第 08 周");
  });

  it("keeps the die Nische project brand exact and untranslated in every locale", () => {
    for (const locale of ["en", "zh-CN", "de"] as const) {
      expect(translateMessage(locale, "desktop.shell")).toBe(PROJECT_BRAND);
      expect(translateMessage(locale, "controlCenter.webDesktop")).toBe(PROJECT_BRAND);
      expect(translateMessage(locale, "about.projectHeading")).toBe(PROJECT_BRAND);
      expect(translateMessage(locale, "about.kdeHeading")).toBe("KDE 3");
    }

    expect(translateMessage("en", "about.projectDescription")).toBe(PROJECT_DESCRIPTION);
    expect(translateMessage("en", "about.projectIndependence")).toBe(PROJECT_INDEPENDENCE_NOTICE);
    expect(translateMessage("zh-CN", "about.projectDescription")).toContain("KDE 3");
    expect(translateMessage("de", "about.projectDescription")).toContain("KDE 3");
    expect(translateMessage("en", "about.projectTitle")).toBe("About die Nische");
    expect(translateMessage("zh-CN", "about.projectTitle")).toContain("die Nische");
    expect(translateMessage("de", "about.projectTitle")).toContain("die Nische");
  });

  it("localizes the short desktop About launcher while keeping the K Menu brand label", () => {
    expect(translateMessage("en", "desktop.about")).toBe("About");
    expect(translateMessage("zh-CN", "desktop.about")).toBe("关于");
    expect(translateMessage("de", "desktop.about")).toBe("Über");
    expect(translateMessage("en", "kmenu.aboutDieNische")).toBe("About die Nische");
    expect(translateMessage("zh-CN", "kmenu.aboutDieNische")).toBe("关于 die Nische");
    expect(translateMessage("de", "kmenu.aboutDieNische")).toBe("Über die Nische");
  });

  it("covers first-party application chrome in every supported locale", () => {
    for (const locale of ["en", "zh-CN", "de"] as const) {
      expect(translateMessage(locale, "blog.archive")).not.toBe("blog.archive");
      expect(translateMessage(locale, "kfind.nameLocation")).not.toBe("kfind.nameLocation");
      expect(translateMessage(locale, "kwrite.save")).not.toBe("kwrite.save");
      expect(translateMessage(locale, "konsole.session")).not.toBe("konsole.session");
      expect(translateMessage(locale, "kcalc.settings")).not.toBe("kcalc.settings");
    }
  });

  it("uses the English dictionary as the fallback authority for missing localized keys", () => {
    expect(translateMessage("zh-CN", "kmenu.actions")).toBe("操作");
    expect(translateMessage("de", "common.defaults")).toBe("Standards");
    expect(translateMessageFromMessages({}, "kmenu.actions")).toBe("Actions");
    expect(translateMessageFromMessages({ "window.moveToDesktop": "Desktop {number}" }, "window.moveToDesktop", { number: 3 })).toBe("Desktop 3");
  });

  it("keeps all production dictionaries complete and non-empty", () => {
    for (const [key, english] of Object.entries(englishMessages)) {
      expect(simplifiedChineseMessages[key as keyof typeof simplifiedChineseMessages], key).toBeTruthy();
      expect(germanMessages[key as keyof typeof germanMessages], key).toBeTruthy();
      expect(english, key).toBeTruthy();
    }
  });
});
