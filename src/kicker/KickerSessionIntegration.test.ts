import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const kicker = readSource("./Kicker.tsx");
const clipboard = readSource("./ClipboardApplet.tsx");
const session = readSource("../desktop/DesktopSessionContext.tsx");
const overlay = readSource("../desktop/DesktopSessionOverlay.tsx");
const desktop = readSource("../desktop/Desktop.tsx");
const konqueror = readSource("../apps/konqueror/Konqueror.tsx");
const controls = readSource("../theme/controls.css");
const tokens = readSource("../theme/tokens.css");
const kde3 = readSource("../theme/kde3.css");

describe("Kicker taskbar and right-side applets", () => {
  it("keeps the taskbar background hit target scoped away from Kicker controls", () => {
    expect(kicker).toContain("<KMenu />");
    expect(kicker).toContain("<QuickLaunch />");
    expect(kicker).toContain("<VirtualDesktopPager />");
    expect(kicker).toContain("<Taskbar />");
    expect(kicker).toContain("<ClipboardApplet />");
    expect(kicker).toContain("<DigitalClock />");
    expect(kicker.indexOf("<Taskbar />")).toBeLessThan(kicker.indexOf("<ClipboardApplet />"));
    expect(kicker).not.toContain("kicker-spacer");
    expect(readSource("./Taskbar.tsx")).toContain("target.closest(\"button\")");
    expect(readSource("./Taskbar.tsx")).toContain("onContextMenu={handleContextMenu}");
    expect(readSource("./Taskbar.tsx")).toContain('data-kicker-task-area="true"');
    expect(readSource("./TaskbarContextMenu.tsx")).toContain("submenuBounds={screenArea}");
    expect(readSource("./TaskbarContextMenu.tsx")).toContain('menuVariant="context"');
    expect(readSource("./DigitalClock/ClockContextMenu.tsx")).toContain('menuVariant="context"');
    expect(controls).toContain(".k-menu-item.is-active");
    expect(controls).toContain("background: var(--kde-kmenu-selection);");
    expect(controls).toContain(".k-menu-popup--context .k-menu-item.is-active");
    expect(controls).toContain("background: var(--kde-menu-selection);");
    expect(controls).toContain(".taskbar {");
    expect(controls).toContain("flex: 1 1 0");
    expect(controls).not.toContain(".kicker-spacer");
    expect(controls).toContain(".taskbar-context-menu-panel .k-menu-submenu");
    expect(controls).toContain("z-index: var(--kde-z-panel-popup)");
  });

  it("keeps the panel attached to the viewport and preserves a shrinkable central task area", () => {
    expect(controls).toMatch(/\.kicker\s*\{[\s\S]*?position: fixed;[\s\S]*?bottom: 0;/);
    expect(controls).toContain(".kicker > .clipboard-applet");
    expect(controls).toContain(".kicker > .digital-clock");
    expect(controls).toContain("flex: 0 0 auto;");
    expect(controls).toMatch(/\.taskbar\s*\{[\s\S]*?min-width: 0;[\s\S]*?flex: 1 1 0;/);
    expect(kde3).toContain("min-width: min(720px, var(--kde-logical-viewport-width));");
    expect(kde3).toContain("min-height: min(520px, var(--kde-logical-viewport-height));");
    expect(kde3).not.toContain("min-width: 720px;");
    expect(kde3).not.toContain("min-height: 520px;");
  });

  it("uses KDE-style two-row column-major task layout without changing task sequence", () => {
    expect(controls).toContain("grid-template-rows: repeat(2, minmax(0, 1fr))");
    expect(controls).toContain("grid-auto-flow: column");
    expect(controls).toContain("grid-template-columns: repeat(var(--taskbar-column-count)");
    expect(controls).not.toContain("nth-child");
  });

  it("keeps Clipboard as the only Kicker utility applet before the clock", () => {
    expect(kicker).toContain("<ClipboardApplet />");
    expect(kicker).not.toContain("<SystemTray />");
    expect(kicker).not.toContain("SessionApplets");
    expect(kicker).not.toContain("Lock Session");
    expect(kicker).not.toContain("End Session");
    expect(controls).not.toContain(".session-applets");
    expect(controls).not.toContain(".kicker-session-button__icon");
    expect(controls).toContain(".kicker-utility-button--clipboard");
    expect(controls).toContain(".kicker-launcher");
    expect(clipboard).toContain("kicker-launcher kicker-utility-button");
    expect(kicker.indexOf("<DigitalClock />")).toBeGreaterThan(kicker.indexOf("<ClipboardApplet />"));
  });

  it("keeps Klipper as a session-only text and virtual VFS URI clipboard tool", () => {
    expect(clipboard).toContain('t("kicker.klipperTool")');
    expect(clipboard).toContain('t("kicker.clearClipboard")');
    expect(clipboard).not.toContain("Read Clipboard");
    expect(session).not.toContain("readText");
    expect(clipboard).not.toContain("readText");
    expect(desktop).toContain("onCopyCapture={captureCopiedText}");
    expect(desktop).toContain("onCutCapture={captureCopiedText}");
    expect(desktop).toContain("onPointerUpCapture={capturePointerSelection}");
    expect(desktop).toContain("onKeyUpCapture={captureKeyboardSelection}");
    expect(desktop).toContain("clearPendingSelectionCapture();\n    recordCurrentSelection(event.target);");
    expect(desktop).not.toContain('addEventListener("copy"');
    expect(desktop).not.toContain('addEventListener("cut"');
    expect(desktop).not.toContain("preventDefault()");
    expect(desktop).not.toContain('addEventListener("selectionchange"');
    expect(desktop).not.toContain('addEventListener("keyup"');
    expect(desktop).not.toContain('addEventListener("mouseup"');
    expect(konqueror).toContain("getKonquerorClipboardMirrorUri");
    expect(konqueror).toContain("desktopSession?.recordClipboardText(mirrorUri)");
    expect(konqueror.match(/desktopSession\?\.recordClipboardText\(mirrorUri\)/g)).toHaveLength(2);
    expect(session).not.toContain("setInterval");
    expect(session).not.toContain("localStorage");
    expect(session).not.toContain("indexedDB");
    expect(session).not.toContain("console.log");
  });

  it("makes lock and end-session shell overlays authoritative without browser dialogs or OS controls", () => {
    expect(overlay).toContain('t("session.locked")');
    expect(overlay).toContain('t("session.endCurrent")');
    expect(overlay).toContain('t("session.unavailable")');
    expect(overlay).not.toContain("window.confirm");
    expect(overlay).not.toContain("window.alert");
    expect(overlay).not.toContain("location.reload");
    expect(overlay).not.toContain("password");
    expect(kde3).toContain(".session-lock-overlay");
    expect(kde3).toContain("var(--kde-z-system-overlay)");
  });

  it("keeps End Session Escape local, focused, and layered by dialog state", () => {
    expect(overlay).toContain("endSessionPrimaryRef.current?.focus()");
    expect(overlay).toContain("returnToEndSessionOptions()");
    expect(overlay).not.toContain('addEventListener("keydown"');
    expect(overlay).not.toContain("document.onkeydown");
  });

  it("uses compact, centered 14px task icons without changing the grid model", () => {
    expect(controls).toContain("width: 14px");
    expect(controls).toContain("height: 14px");
    expect(controls).toContain("flex: 0 0 14px");
    expect(controls).toContain("align-self: center");
    expect(controls).toContain("grid-auto-flow: column");
  });

  it("removes the session shortcut focus targets without changing Clipboard dimensions", () => {
    expect(kicker).not.toContain('aria-label="Lock Session"');
    expect(kicker).not.toContain('aria-label="End Session"');
    expect(kicker).not.toContain("lockSession");
    expect(kicker).not.toContain("openEndSession");
    expect(controls).toContain(".kicker-utility-button--clipboard");
    expect(controls).toContain("width: 28px");
    expect(controls).toContain("height: 36px");
    expect(controls).toContain(".task-button svg");
  });

  it("keeps the Kicker bright at the bottom and enlarges only the Clipboard glyph", () => {
    expect(tokens).toContain("--kde-kicker-top: #aaa69e;");
    expect(tokens).toContain("--kde-kicker-light: #ffffff;");
    expect(tokens).toContain("--kde-kicker-bottom: #ffffff;");
    expect(tokens).toContain("--kde-kicker-gradient-stop: 66%;");
    expect(tokens).toContain("--kde-kicker-launcher-icon-size: 32px;");
    expect(tokens).toContain("--kde-kicker-clipboard-icon-size: 23px;");
    expect(tokens).toContain("--kde-kicker-background: linear-gradient(");
    expect(controls).toMatch(/\.kicker\s*\{[\s\S]*?background: var\(--kde-kicker-background\);/);
    expect(controls).toMatch(/\.kicker-utility-button--clipboard\s*\{[\s\S]*?width: 28px;[\s\S]*?height: 36px;/);
    expect(controls).toMatch(/\.kicker-utility-button--clipboard svg\s*\{[\s\S]*?width: var\(--kde-kicker-clipboard-icon-size\);[\s\S]*?height: var\(--kde-kicker-clipboard-icon-size\);/);
    expect(controls).toMatch(/\.kicker-button--k svg\s*\{[\s\S]*?width: var\(--kde-kicker-launcher-icon-size\);[\s\S]*?height: var\(--kde-kicker-launcher-icon-size\);/);
    expect(controls).toContain(".quick-launch .kicker-button");
    expect(controls).toContain("padding: 1px;");
    expect(controls).toContain("flex: 0 0 auto;");
    expect(kde3).toContain("--kde-ui-scale");
  });

  it("clears and closes Klipper history without touching the VFS file clipboard", () => {
    expect(session).toContain('case "clear-clipboard-history"');
    expect(session).toContain("isClipboardOpen: false");
    expect(session).toContain("clipboardStatus: null");
    expect(clipboard).toContain("disabled={clipboardHistory.length === 0}");
    expect(clipboard).toContain("data-klipper-ignore-selection");
    expect(clipboard).not.toContain("Clipboard history cleared.");
    expect(clipboard).not.toContain("dispatchClipboard");
    expect(clipboard).not.toContain("pasteClipboard");
  });
});
