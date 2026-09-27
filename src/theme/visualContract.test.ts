import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readThemeFile = (fileName: string): string => {
  return readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
};

const readSourceFile = (relativePath: string): string => {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
};

describe("visual CSS contracts", () => {
  it("centralizes the KDE Classic surface, button, menubar, Kicker, and titlebar tokens", () => {
    const tokens = readThemeFile("tokens.css");
    const controls = readThemeFile("controls.css");
    const kde3 = readThemeFile("kde3.css");

    expect(tokens).toContain("--kde-surface: #dedbd3;");
    expect(tokens).toContain("--kde-button-top: #fbfaf7;");
    expect(tokens).toContain("--kde-button-bottom: #d4d1c9;");
    expect(tokens).toContain("--kde-chrome-top: #ffffff;");
    expect(tokens).toContain("--kde-chrome-bottom: #c8c5bd;");
    expect(tokens).toContain("--kde-menubar-top: var(--kde-chrome-top);");
    expect(tokens).toContain("--kde-menubar-bottom: var(--kde-chrome-bottom);");
    expect(tokens).toContain("--kde-kicker-top: #aaa69e;");
    expect(tokens).toContain("--kde-kicker-light: #ffffff;");
    expect(tokens).toContain("--kde-kicker-bottom: #ffffff;");
    expect(tokens).toContain("--kde-kicker-gradient-stop: 66%;");
    expect(tokens).toContain("--kde-kicker-launcher-icon-size: 32px;");
    expect(tokens).toContain("--kde-kicker-clipboard-icon-size: 23px;");
    expect(tokens).toContain("--kde-kicker-launcher-idle: transparent;");
    expect(tokens).toContain("--kde-kicker-launcher-pressed-top: #b9b5ad;");
    expect(tokens).toContain("--kde-titlebar-active: #07579b;");
    expect(tokens).toContain("--kde-titlebar-inactive: #d7d4cd;");
    expect(tokens).toContain("--kde-caption-button-size: 15px;");
    expect(tokens).toContain("--kde-caption-button-gap: 4px;");
    expect(tokens).toContain("--kde-caption-button-cluster-background: #aaa69e;");
    expect(tokens).toContain("--kde-caption-button-cluster-padding: 1px 3px;");
    expect(tokens).toContain("--kde-caption-button-cluster-margin: -1px -3px -2px 0;");
    expect(tokens).toContain("--kde-caption-button-cluster-margin-maximized: -1px -3px -2px 0;");
    expect(tokens).toContain("--kde-caption-button-cluster-align: stretch;");
    expect(tokens).toContain("--kde-caption-button-outer-light: #f3f1eb;");
    expect(tokens).toContain("--kde-caption-button-outer-dark: #77736b;");
    expect(tokens).toContain("--kde-caption-button-outline: var(--kde-border-dark);");
    expect(tokens).toContain("--kde-caption-button-glyph-size: 10px;");
    expect(tokens).toContain("--kde-caption-button-glyph-stroke: 2px;");
    expect(tokens).toContain("--kde-caption-button-glyph-color: #111111;");
    expect(tokens).toContain("--kde-button-background: linear-gradient(180deg, var(--kde-button-top), var(--kde-button-bottom));");
    expect(tokens).toContain("--kde-chrome-background: linear-gradient(180deg, var(--kde-chrome-top), var(--kde-chrome-bottom));");
    expect(controls).toMatch(/\.kde-raised\s*\{[\s\S]*?background: var\(--kde-button-background\);/);
    expect(controls).toMatch(/\.kde-chrome-surface\s*\{[\s\S]*?background: var\(--kde-chrome-background\);/);
    const caption = kde3.slice(kde3.indexOf(".window-control {"), kde3.indexOf(".window-control:hover"));
    const pressedCaption = kde3.slice(kde3.indexOf(".window-control:active {"), kde3.indexOf(".window-control:focus-visible"));
    expect(caption).toContain("background: var(--kde-caption-button-background);");
    expect(caption).toContain("var(--kde-caption-button-border-light)");
    expect(caption).toContain("width: var(--kde-caption-button-size);");
    expect(caption).toContain("height: var(--kde-caption-button-size);");
    expect(kde3).toMatch(/\.window-controls\s*\{[\s\S]*?gap: var\(--kde-caption-button-gap\);[\s\S]*?background: var\(--kde-caption-button-cluster-background\);/);
    expect(kde3).toContain("margin: var(--kde-caption-button-cluster-margin);");
    expect(kde3).toMatch(/html:not\(\[data-kde-theme="redmond"\]\) \.window-frame\.is-maximized \.window-controls\s*\{[\s\S]*?margin: var\(--kde-caption-button-cluster-margin-maximized\);/);
    expect(kde3).toContain(".window-control__minimize-square");
    expect(kde3).toContain(".window-control__minimize-line");
    expect(kde3).toContain(".window-control__restore-kde");
    expect(kde3).toContain(".window-control__restore-redmond");
    expect(pressedCaption).toContain("background: var(--kde-caption-button-pressed-background);");
    expect(kde3).toContain(".window-control:focus-visible");
    expect(kde3).toContain(".window-control:disabled");
    expect(kde3).not.toContain("background: linear-gradient(#f3f1ec, var(--kde-face));");
    expect(tokens).toContain("--kde-kicker-background: linear-gradient(");
    expect(controls).toMatch(/\.kicker\s*\{[\s\S]*?background: var\(--kde-kicker-background\);/);
    expect(controls).toMatch(/\.kicker-launcher\s*\{[\s\S]*?background: var\(--kde-kicker-launcher-idle\);[\s\S]*?box-shadow: none;/);
    expect(controls).toMatch(/\.kicker-launcher:active,[\s\S]*?\.kicker-launcher\.is-active\s*\{[\s\S]*?var\(--kde-kicker-launcher-pressed-background\);/);
    expect(controls).toContain(".kicker-launcher:focus-visible");
    expect(kde3).toContain("var(--kde-active-title-background)");
    expect(kde3).toContain("var(--kde-inactive-title-background)");
  });

  it("keeps the KDE Classic caption cluster footprint while separating smaller button faces", () => {
    const tokens = readThemeFile("tokens.css");
    const redmondStart = tokens.indexOf('html[data-kde-theme="redmond"]');
    const classic = tokens.slice(0, redmondStart);
    const redmond = tokens.slice(redmondStart);
    const readPx = (source: string, token: string) => {
      const match = source.match(new RegExp(`${token}:\\s*(\\d+)px;`));
      if (!match) throw new Error(`Missing pixel token ${token}`);
      return Number(match[1]);
    };
    const readValue = (source: string, token: string) => {
      const match = source.match(new RegExp(`${token}:\\s*([^;]+);`));
      if (!match) throw new Error(`Missing token ${token}`);
      return match[1].trim();
    };
    const clusterWidth = (buttonSize: number, gap: number, padding: number) => buttonSize * 3 + gap * 2 + padding * 2;

    expect(readPx(classic, "--kde-caption-button-size")).toBe(15);
    expect(readPx(classic, "--kde-caption-button-gap")).toBe(4);
    expect(readPx(classic, "--kde-caption-button-glyph-size")).toBe(10);
    expect(readValue(classic, "--kde-caption-button-glyph-stroke")).toBe("2px");
    expect(readValue(classic, "--kde-caption-button-cluster-padding")).toBe("1px 3px");
    expect(readValue(classic, "--kde-caption-button-cluster-margin")).toBe("-1px -3px -2px 0");
    expect(readValue(classic, "--kde-caption-button-cluster-margin-maximized")).toBe("-1px -3px -2px 0");
    expect(clusterWidth(15, 4, 3)).toBe(59);
    expect(clusterWidth(15, 4, 3)).toBeGreaterThan(clusterWidth(15, 4, 1));

    expect(readPx(redmond, "--kde-caption-button-size")).toBe(16);
    expect(readPx(redmond, "--kde-caption-button-gap")).toBe(2);
    expect(readPx(redmond, "--kde-caption-button-glyph-size")).toBe(9);
    expect(readValue(redmond, "--kde-caption-button-cluster-padding")).toBe("0");
    expect(readValue(redmond, "--kde-caption-button-cluster-margin")).toBe("0");
  });

  it("aligns only the KDE Classic maximized caption cluster with the titlebar content edge", () => {
    const kde3 = readThemeFile("kde3.css");
    const tokens = readThemeFile("tokens.css");
    const redmondStart = tokens.indexOf('html[data-kde-theme="redmond"]');
    const classic = tokens.slice(0, redmondStart);
    const maximizedRule = kde3.match(/html:not\(\[data-kde-theme="redmond"\]\) \.window-frame\.is-maximized \.window-controls\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(maximizedRule).toContain("margin: var(--kde-caption-button-cluster-margin-maximized);");
    expect(classic).toContain("--kde-caption-button-cluster-margin-maximized: -1px -3px -2px 0;");
    expect(kde3).not.toMatch(/^\.window-frame\.is-maximized \.window-controls\s*\{/m);
    expect(kde3).not.toContain('html[data-kde-theme="redmond"] .window-frame.is-maximized .window-controls');
  });

  it("keeps Kicker on fixed KDE Classic shell tokens while Redmond restyles application chrome", () => {
    const tokens = readThemeFile("tokens.css");
    const controls = readThemeFile("controls.css");

    const redmond = tokens.slice(tokens.indexOf('html[data-kde-theme="redmond"]'));
    expect(redmond).toContain("--kde-caption-button-size: 16px;");
    expect(redmond).toContain("--kde-caption-button-gap: 2px;");
    expect(redmond).toContain("--kde-caption-button-cluster-background: transparent;");
    expect(redmond).toContain("--kde-caption-button-cluster-padding: 0;");
    expect(redmond).toContain("--kde-caption-button-cluster-margin: 0;");
    expect(redmond).not.toContain("--kde-caption-button-cluster-margin-maximized:");
    expect(redmond).toContain("--kde-caption-button-cluster-align: center;");
    expect(redmond).toContain("--kde-caption-button-outer-light: transparent;");
    expect(redmond).toContain("--kde-caption-button-outer-dark: transparent;");
    expect(redmond).toContain("--kde-caption-button-glyph-size: 9px;");
    expect(redmond).toContain("--kde-caption-button-glyph-stroke: 1.5px;");
    expect(redmond).not.toContain("--kde-kicker-");
    expect(readThemeFile("kde3.css")).toContain('html[data-kde-theme="redmond"] .window-control__minimize-line');
    expect(readThemeFile("kde3.css")).toContain('html[data-kde-theme="redmond"] .window-control__minimize-square');
    expect(readThemeFile("kde3.css")).toContain('html[data-kde-theme="redmond"] .window-control__restore-kde');
    expect(readThemeFile("kde3.css")).toContain('html[data-kde-theme="redmond"] .window-control__restore-redmond');
    expect(readThemeFile("kde3.css")).not.toContain('html[data-kde-theme="redmond"] .window-frame.is-maximized .window-controls');
    expect(controls).toMatch(/\.kicker\s*\{[\s\S]*?--kde-face: var\(--kde-kicker-face\);[\s\S]*?--kde-button-background: linear-gradient/);
    expect(controls).toContain(".kicker .k-menu-brand");
    expect(tokens).toContain("--kde-kicker-face: #dedbd3;");
    expect(tokens).toContain("--kde-kicker-border-dark: #57544e;");
    expect(tokens).toContain("--kde-kicker-menu-selection: #0a67ad;");
  });

  it("gives Redmond active titles a readable horizontal gradient", () => {
    const tokens = readThemeFile("tokens.css");

    expect(tokens).toContain("--kde-active-title-start: #000080;");
    expect(tokens).toContain("--kde-active-title-end: #4c8fca;");
    expect(tokens).toContain("--kde-active-title-background: linear-gradient(90deg, var(--kde-active-title-start), var(--kde-active-title-end));");
    expect(tokens).toContain("--kde-active-title-text: #ffffff;");
  });

  it("uses a strong inverted Redmond bevel and dark semantic separators", () => {
    const tokens = readThemeFile("tokens.css");
    const controls = readThemeFile("controls.css");
    const kde3 = readThemeFile("kde3.css");

    expect(tokens).toContain("--kde-button-border-light: #ffffff;");
    expect(tokens).toContain("--kde-button-border-dark: #000000;");
    expect(tokens).toContain("--kde-button-inner-light: #ffffff;");
    expect(tokens).toContain("--kde-button-inner-dark: #000000;");
    expect(tokens).toContain("--kde-button-pressed-inner-dark: #000000;");
    expect(tokens).toContain("--kde-button-pressed-inner-light: #ffffff;");
    expect(controls).toContain("inset 1px 1px 0 var(--kde-button-inner-light)");
    expect(controls).toContain("inset -1px -1px 0 var(--kde-button-inner-dark)");
    expect(controls).toContain("inset 1px 1px 0 var(--kde-button-pressed-inner-dark)");
    expect(controls).toContain("inset -1px -1px 0 var(--kde-button-pressed-inner-light)");
    expect(kde3).toContain("inset 1px 1px 0 var(--kde-caption-button-inner-light)");
    expect(kde3).toContain("inset -1px -1px 0 var(--kde-caption-button-inner-dark)");
    expect(kde3).toContain("inset 1px 1px 0 var(--kde-caption-button-pressed-inner-dark)");
    expect(kde3).toContain("inset -1px -1px 0 var(--kde-caption-button-pressed-inner-light)");
    expect(tokens).toContain("--kde-separator-dark: #000000;");
    expect(controls).toContain("border-top: 1px solid var(--kde-separator-dark);");
    expect(kde3).toMatch(/\.konqueror-menu-separator\s*\{[\s\S]*?border-top: 1px solid var\(--kde-separator-dark\);/);
    expect(kde3).toMatch(/\.toolbar-separator\s*\{[\s\S]*?border-left: 1px solid var\(--kde-separator-dark\);/);
  });

  it("keeps the KDE Classic caption outer ring uniform while preserving the Redmond bevel", () => {
    const kde3 = readThemeFile("kde3.css");
    const classicCaptionStart = kde3.indexOf('html:not([data-kde-theme="redmond"]) .window-control {');
    const classicCaption = kde3.slice(classicCaptionStart, kde3.indexOf(".window-control__glyph {", classicCaptionStart));

    expect(classicCaption).toContain("border-color: var(--kde-caption-button-outline);");
    expect(classicCaption).toContain("-1px -1px 0 var(--kde-caption-button-outline)");
    expect(classicCaption).toContain("1px 1px 0 var(--kde-caption-button-outline)");
    expect(classicCaption).toContain("html:not([data-kde-theme=\"redmond\"]) .window-control:active");
    expect(classicCaption).toContain("html:not([data-kde-theme=\"redmond\"]) .window-control:disabled");
    expect(kde3).toContain("border-color: var(--kde-caption-button-border-light) var(--kde-caption-button-border-dark) var(--kde-caption-button-border-dark) var(--kde-caption-button-border-light);");
    expect(kde3).toContain("border-color: var(--kde-caption-button-border-dark) var(--kde-caption-button-border-light) var(--kde-caption-button-border-light) var(--kde-caption-button-border-dark);");
    expect(kde3).toContain('html[data-kde-theme="redmond"] .window-control__restore-kde');
  });

  it("routes representative standard buttons through the shared KDE raised primitive", () => {
    const blog = readSourceFile("../apps/blog/Blog.tsx");
    const kfind = readSourceFile("../apps/kfind/KFind.tsx");
    const kcontrol = readSourceFile("../apps/kcontrol/KControl.tsx");
    const configurePanel = readSourceFile("../apps/kcontrol/ConfigurePanel.tsx");
    const configureClock = readSourceFile("../apps/kcontrol/ConfigureClock.tsx");
    const dialogs = `${readSourceFile("../apps/kwrite/KWriteDialogs.tsx")}\n${readSourceFile("../apps/konqueror/KonquerorInputDialog.tsx")}`;

    expect(blog).toContain('className="kde-raised blog-app__archive-button"');
    expect(blog).toContain('className="kde-raised blog-app__tags-button"');
    expect(blog).toContain('className="kde-raised blog-app__search-button"');
    expect(kfind).toContain("kde-raised kfind-action-button");
    expect(kcontrol).toContain('className="kde-raised"');
    expect(configurePanel).toContain('className="kde-raised"');
    expect(configureClock).toContain('className="kde-raised"');
    expect(dialogs).toContain("kde-raised kwrite-dialog-button");
    expect(dialogs).toContain("kde-raised konqueror-dialog-button");
  });

  it("routes application chrome through one shared surface without recoloring content inputs", () => {
    const blog = readSourceFile("../apps/blog/Blog.tsx");
    const kcalc = readSourceFile("../apps/kcalc/KCalc.tsx");
    const kcontrol = readSourceFile("../apps/kcontrol/KControl.tsx");
    const konqueror = `${readSourceFile("../apps/konqueror/KonquerorApplicationMenu.tsx")}\n${readSourceFile("../apps/konqueror/KonquerorToolbar.tsx")}\n${readSourceFile("../apps/konqueror/KonquerorLocationBar.tsx")}`;
    const konsole = readSourceFile("../apps/konsole/KonsoleMenuBar.tsx");
    const kwrite = readSourceFile("../apps/kwrite/KWrite.tsx");
    const kde3 = readThemeFile("kde3.css");

    expect(konqueror).toContain("kde-chrome-surface");
    expect(konsole).toContain("kde-chrome-surface");
    expect(kcalc).toContain("kde-chrome-surface");
    expect(kcontrol).toContain("kde-chrome-surface");
    expect(kwrite).toContain("kde-chrome-surface");
    expect(blog).toContain('className="blog-app__heading kde-chrome-surface"');
    expect(kde3).toMatch(/\.address-input\s*\{[\s\S]*?background: #ffffff;/);
    expect(kde3).toMatch(/\.kwrite-editor\s*\{[\s\S]*?background: #ffffff;/);
    expect(kde3).toMatch(/\.blog-app__content\s*\{[\s\S]*?background: #ffffff;/);
  });

  it("preserves separate K Menu/context selection roles and content surfaces", () => {
    const controls = readThemeFile("controls.css");
    const kde3 = readThemeFile("kde3.css");
    const tokens = readThemeFile("tokens.css");

    expect(controls).toMatch(/\.k-menu-item\.is-active\s*\{[\s\S]*?background: var\(--kde-kmenu-selection\);/);
    expect(tokens).toContain("--kde-kmenu-selection: #e9cf63;");
    expect(controls).toContain("background: var(--kde-menu-selection);");
    expect(kde3).toMatch(/\.konqueror-content\s*\{[\s\S]*?background: #ffffff;/);
    expect(kde3).toMatch(/\.kwrite-editor\s*\{[\s\S]*?background: #ffffff;/);
    expect(kde3).toMatch(/\.kcontrol-tree\s*\{[\s\S]*?background: #ffffff;/);
  });

  it("defines the two runtime themes without changing the shared geometry scale", () => {
    const tokens = readThemeFile("tokens.css");
    const catalog = readSourceFile("./themeCatalog.ts");

    expect(catalog).toContain('["kde-classic", "redmond"]');
    expect(catalog).toContain('label: "KDE_Classic"');
    expect(tokens).toContain('html[data-kde-theme="redmond"]');
    expect(tokens).toContain("--kde-button-background: #c0c0c0;");
    expect(tokens).toContain("--kde-active-title-background: linear-gradient(90deg, var(--kde-active-title-start), var(--kde-active-title-end));");
    expect(tokens).toContain("--kde-menu-selection: #000080;");
    expect(tokens).toContain("--kde-ui-scale: 1.4;");
  });

  it("keeps one global UI scale authority and applies it once at the desktop shell", () => {
    const tokens = readThemeFile("tokens.css");
    const kde3 = readThemeFile("kde3.css");

    expect(tokens).toContain("--kde-ui-scale: 1.4;");
    expect(tokens).toContain("--kde-effective-ui-scale: var(--kde-ui-scale);");
    expect(tokens).toContain("--kde-logical-viewport-width: calc(100vw * var(--kde-effective-ui-scale-inverse));");
    expect(tokens).toContain("--kde-logical-viewport-height: calc(100dvh * var(--kde-effective-ui-scale-inverse));");
    expect(kde3).toMatch(/\.desktop-shell\s*\{[\s\S]*?width: var\(--kde-logical-viewport-width\);[\s\S]*?height: var\(--kde-logical-viewport-height\);[\s\S]*?zoom: var\(--kde-ui-scale\);/);
  });

  it("keeps desktop icon rows tall enough for two-line labels", () => {
    const kde3 = readThemeFile("kde3.css");

    expect(kde3).toContain("grid-auto-rows: 82px");
    expect(kde3).toContain("white-space: nowrap");
    expect(kde3).toContain(".desktop-icon__label-line");
  });

  it("uses a light classic clock face instead of a black clock block", () => {
    const tokens = readThemeFile("tokens.css");
    const controls = readThemeFile("controls.css");

    expect(tokens).not.toContain("--kde-clock-background");
    expect(tokens).toContain("--kde-clock-lit: #111111");
    expect(tokens).toContain("--kde-clock-date-text: #111111");
    expect(controls).not.toContain("background: #111111");
    expect(controls).toContain("background: transparent");
    expect(controls).toContain("background: var(--kde-clock-face)");
    expect(controls).toContain("border-color: var(--kde-border-dark) var(--kde-border-highlight)");
  });

  it("keeps Konsole popup menus content-sized and bookmark labels on one line", () => {
    const kde3 = readThemeFile("kde3.css");

    expect(kde3).toMatch(/\.konsole-menu-popup\s*\{[^}]*width:\s*max-content;/s);
    expect(kde3).toMatch(/\.konsole-menu-popup button\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(kde3).toMatch(/\.konsole-bookmark-menu__submenu\s*\{[^}]*min-width:\s*152px;/s);
  });

  it("keeps scaled K Menu rows inside the popup and Run Command viewport-sized", () => {
    const controls = readThemeFile("controls.css");
    const kde3 = readThemeFile("kde3.css");

    expect(controls).toMatch(/\.k-menu-section\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
    expect(controls).toMatch(/\.k-menu-panel\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?max-height:\s*calc\(var\(--kde-logical-viewport-height\) - var\(--kde-panel-height\)\);/);
    expect(controls).toMatch(/\.k-menu-list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
    expect(controls).toMatch(/\.k-menu-submenu\.is-positioned\s*\{[\s\S]*?z-index:\s*var\(--kde-z-panel-popup\);/);
    expect(kde3).toMatch(/\.run-command-overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*var\(--kde-logical-viewport-width\);[\s\S]*?height:\s*var\(--kde-logical-viewport-height\);/);
  });
});
