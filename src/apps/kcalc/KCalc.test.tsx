import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WindowManagerContext, type WindowManagerContextValue } from "../../window-manager/useWindowManager";
import { KCalc } from "./KCalc";

const applicationRegistrySource = readFileSync(new URL("../../application-runtime/applicationRegistry.tsx", import.meta.url), "utf8");
const kcalcPrototypeSource = readFileSync(new URL("./KCalcPrototype.tsx", import.meta.url), "utf8");
const kdeThemeSource = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

const windowManager: WindowManagerContextValue = {
  windows: [],
  currentDesktopId: 1,
  lastActiveWindowIdByDesktop: { 1: null, 2: null, 3: null, 4: null },
  showDesktopSessionByDesktop: { 1: null, 2: null, 3: null, 4: null },
  workArea: { x: 0, y: 0, width: 900, height: 600, titleBarHeight: 22 },
  activateWindow: vi.fn(),
  focusWindow: vi.fn(),
  openWindow: vi.fn(),
  moveWindow: vi.fn(),
  resizeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  restoreWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  restoreMaximizedWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  toggleTaskbarWindow: vi.fn(),
  switchDesktop: vi.fn(),
  toggleShowDesktop: vi.fn(),
  moveWindowToDesktop: vi.fn(),
  setWorkArea: vi.fn(),
};

const renderKCalc = () => renderToStaticMarkup(
  <WindowManagerContext.Provider value={windowManager}>
    <KCalc windowId="app:kcalc" />
  </WindowManagerContext.Provider>,
);

describe("KCalc UI", () => {
  it("renders the KDE3 display, menu bar, and complete keypad", () => {
    const markup = renderKCalc();

    expect(markup).toContain("data-kcalc-root=\"true\"");
    expect(markup).toContain("data-window-id=\"app:kcalc\"");
    expect(markup).toContain("aria-label=\"Calculator display\"");
    expect(markup).toContain("readOnly=\"\"");
    expect(markup).toContain("value=\"0\"");
    expect(markup).toContain(">File<");
    expect(markup).toContain(">Edit<");
    expect(markup).toContain(">Constants<");
    expect(markup).toContain(">Settings<");
    expect(markup).toContain("Help");
    expect(markup).not.toContain(">Calculator<");
    expect(markup).toContain(">Dec<");
    expect(markup).toContain(">NORM<");
    expect(markup).toContain(">Inv<");
    expect(markup).toContain(">xʸ<");
    expect(markup).not.toContain(">Angle<");
    expect(markup).not.toContain(">Base<");
    expect(markup).not.toContain(">Hyp<");
    expect(markup).not.toContain(">C1<");
    expect(markup).toContain("class=\"kde-raised kcalc-key\"");
    expect(markup).toContain("aria-label=\"Equals\"");
    expect(markup).toContain("class=\"kde-raised kcalc-key kcalc-key--zero\"");
    expect(markup).toContain("class=\"kde-raised kcalc-key kcalc-key--equals\"");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("contentEditable");
  });

  it("consumes the active WindowManager focus request only after the exact calculator root owns DOM focus", () => {
    const source = readFileSync(new URL("./KCalc.tsx", import.meta.url), "utf8");

    expect(applicationRegistrySource).toContain("windowId={context.windowId}");
    expect(applicationRegistrySource).toContain("isActive={context.isActive}");
    expect(applicationRegistrySource).toContain("focusRequestId={context.focusRequestId}");
    expect(kcalcPrototypeSource).toContain("windowId={windowId}");
    expect(kcalcPrototypeSource).toContain("isActive={isActive}");
    expect(kcalcPrototypeSource).toContain("focusRequestId={focusRequestId}");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("data-window-id={windowId}");
    expect(source).toContain("focusRequestStateRef");
    expect(source).toContain("shouldScheduleKCalcFocus");
    expect(source).toContain("beginKCalcFocusRequest");
    expect(source).toContain("cancelKCalcFocusRequest");
    expect(source).toContain("completeKCalcFocusRequest");
    expect(source).toContain("window.requestAnimationFrame");
    expect(source).toContain("calculatorRoot.focus({ preventScroll: true })");
    expect(source).toContain("document.activeElement === calculatorRoot");
    expect(source.indexOf("document.activeElement === calculatorRoot")).toBeGreaterThan(
      source.indexOf("calculatorRoot.focus({ preventScroll: true })"),
    );
    expect(source).toContain("window.cancelAnimationFrame(animationFrameId)");
    expect(source).not.toContain("document.addEventListener");
    expect(source).not.toContain("window.addEventListener");
  });

  it("uses the KDE3 compact matrix with descriptor-backed Base Scientific and memory command execution", () => {
    const source = readFileSync(new URL("./KCalc.tsx", import.meta.url), "utf8");

    expect(source).toContain("const coreKeypad");
    expect(source).toContain("kcalcBaseScientificCommandSlots");
    expect(source).toContain("kcalcScienceCommandSlots");
    expect(source).toContain("kcalcStatisticsCommandSlots");
    expect(source).toContain("kcalcConstantsCommandSlots");
    expect(source).toContain("kcalcMemoryAddCommandSlot");
    expect(source).toContain("kcalcMemoryRecallCommandSlot");
    expect(source).toContain("kcalcMemoryStoreCommandSlot");
    expect(source).toContain("kcalcMemoryClearCommandSlot");
    expect(source).toContain("kcalcPercentCommandSlot");
    expect(source).toContain("resolveKCalcCommandSurface(slot, mode.inverse, isCommandEnabled)");
    expect(source).toContain("getKCalcConstantSlotIdForCommand(commandId)");
    expect(source).toContain("getKCalcConstantSlot(constants, slotId).value");
    expect(source).toMatch(/getCalculatorActionForCommand\(commandId,\s*\{\s*angleUnit:\s*mode\.angleUnit,\s*numberBase:\s*mode\.numberBase,\s*constantValue,\s*\}\)/);
    expect(source).toContain("getKCalcConstantValueFromCalculatorState(calculator)");
    expect(source).toContain("storeConstant(slotId, value)");
    expect(source).toContain("isCalculatorCommandEnabled(calculator, commandId)");
    expect(source).toContain('data-kcalc-layout-module="base-scientific"');
    expect(source).toContain('data-kcalc-layout-module="core-calculator"');
    for (const label of ["/", "×", "-", "C", "AC", "7", "8", "9", "+", "(", ")", "4", "5", "6", "1", "2", "3", "=", "0", ".", "±"]) {
      expect(source).toContain(`label: "${label}"`);
    }
    expect(source).toContain("{ commandSlot: kcalcMemoryAddCommandSlot }");
    expect(source).toContain('{ label: "C", action: { type: "clear-entry" }, ariaLabel: "Clear entry" }');
    expect(source).toContain('{ label: "×", action: { type: "operator", operator: "*" }, ariaLabel: "Multiply" }');
    expect(source).toContain('{ label: "AC", action: { type: "clear" }, ariaLabel: "Clear" }');
    expect(source).toContain('{ label: "±", action: { type: "toggle-sign" }, ariaLabel: "Toggle sign" }');
    expect(source).toContain('{ label: "0", action: { type: "digit", digit: "0" }, className: "kcalc-key--zero" }');
    expect(source).toContain('{ label: "=", action: { type: "equals" }, className: "kcalc-key--equals", ariaLabel: "Equals" }');
    expect(source).toContain('aria-pressed={mode.inverse}');
    expect(source).toContain('toggleKCalcInverse(current)');
    for (const unavailableLabel of ["(", ")"]) {
      expect(source).toContain(`{ label: "${unavailableLabel}", disabled: true }`);
    }
    expect(source.match(/type: "equals"/g)).toHaveLength(1);
    expect(source.match(/digit: "0"/g)).toHaveLength(1);
    expect(kdeThemeSource).toContain(".kcalc-key--plus {\n  grid-column: 4;\n  grid-row: 2 / span 2;");
    expect(kdeThemeSource).toContain(".kcalc-key--equals {\n  grid-column: 4;\n  grid-row: 4 / span 2;");
    expect(kdeThemeSource).toContain(".kcalc-key--zero {\n  grid-column: 1 / span 2;");
    expect(kdeThemeSource).toContain("grid-template-columns: repeat(6, var(--kcalc-key-width));");
    expect(kdeThemeSource).toContain("--kcalc-key-width: 35px;");
    expect(kdeThemeSource).toContain("--kcalc-key-height: 24px;");
    expect(kdeThemeSource).toContain("--kcalc-button-bank-height:");
    expect(kdeThemeSource).toContain(".kcalc-top-control-band {\n  display: flex;\n  min-width: var(--kcalc-grid-width);\n  min-height: var(--kcalc-top-control-height);\n  align-items: center;");
    expect(kdeThemeSource).toContain("grid-template-rows: repeat(5, minmax(0, 1fr));");
    expect(kdeThemeSource).toContain(".kcalc-optional-panel {");
    expect(kdeThemeSource).toContain("grid-template-rows: repeat(6, minmax(0, 1fr));");
    expect(kdeThemeSource).toContain(".kcalc-settings-menu {\n  width: max-content;\n  min-width: 236px;");
    expect(kdeThemeSource).toContain(".kcalc-settings-menu button {\n  white-space: nowrap;");
    expect(kdeThemeSource).toContain(".kcalc-math-label sub {");
    expect(kdeThemeSource).toContain("top: 3px;");
    expect(kdeThemeSource).toContain(".kcalc-math-label sup {");
    expect(kdeThemeSource).toContain("top: -2px;");
    expect(kdeThemeSource).toContain("--kcalc-status-memory-width: 15px;");
    expect(kdeThemeSource).toContain("var(--kcalc-status-mode-width)");
    expect(kdeThemeSource).toContain("white-space: nowrap;");
    expect(kdeThemeSource).not.toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(kdeThemeSource).not.toContain("background: linear-gradient(#d7ebf8, #9db9cf);");
    expect(kdeThemeSource).toContain("text-align: right;");
  });

  it("keeps calculation state component-local and keyboard handling application-local", () => {
    const source = readFileSync(new URL("./KCalc.tsx", import.meta.url), "utf8");
    const coreSource = readFileSync(new URL("./calculatorCore.ts", import.meta.url), "utf8");

    expect(source).toContain("useState(initialCalculatorState)");
    expect(source).toContain("useState(initialKCalcOptionalPanels)");
    expect(source).toContain("useState(initialKCalcModeState)");
    expect(source).toContain("getKCalcStatusIndicators(mode, optionalPanels, calculator.memoryValue)");
    expect(source).toContain('data-kcalc-layout="top-control-band"');
    expect(source).toContain('data-kcalc-layout="button-bank"');
    expect(source).toContain('data-kcalc-layout="status-strip"');
    expect(source).toContain('data-kcalc-button-bank-height="shared"');
    expect(source).toContain("data-kcalc-status-slot=\"memory\"");
    expect(source).toContain("toggleKCalcOptionalPanel(current, panel)");
    expect(source).toContain("showAllKCalcOptionalPanels()");
    expect(source).toContain("hideAllKCalcOptionalPanels()");
    expect(source).toContain("KCalcOptionalPanelColumn");
    expect(source).not.toContain("Map<WindowId");
    expect(source).not.toContain("currentCalculator");
    expect(source).toContain("onKeyDown={handleKeyDown}");
    expect(source).toContain("getCalculatorActionForKey");
    expect(source).toContain("getCalculatorActionForCommand");
    expect(source).toContain("isCalculatorCommandEnabled");
    expect(source).toContain("useApplicationMenuDismissal({");
    expect(source).toContain("ref={menuBarRef}");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("constantCatalogRequest !== null");
    expect(source).toContain("setOpenPopup(null); onRequestClose();");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("indexedDB");
    expect(source).toContain("useWindowManager");
    expect(source).toContain("resizeNormalWindowBounds");
    expect(source).toContain("getKCalcRequiredWidth(optionalPanels)");
    expect(source).toContain("getKCalcContentFitWidth(");
    expect(source).toContain('executeEditCommand("edit-copy")');
    expect(source).toContain('aria-description={t("kcalc.copyDisplay")}');
    expect(source).toContain("toLogicalRect(event.currentTarget.getBoundingClientRect())");
    expect(source).toContain("toLogicalRect(popup.getBoundingClientRect())");
    expect(source).toContain("WindowOwnedPopupPortal");
    expect(source).toContain("useMeasuredPopupPosition");
    expect(source).toContain('getCalculatorActionForCommand("built-in-constant-recall"');
    expect(source).toContain("builtInConstantValue: constant.value.value");
    expect(source).toContain("kcalcBuiltInConstantCategories");
    expect(source).toContain("openConstantContextMenu");
    expect(source).toContain("updateConstants");
    expect(source).toContain('visibility: "hidden", pointerEvents: "none"');
    expect(source).not.toContain("ResizeObserver");
    expect(source).not.toContain("querySelector(");
    expect(source).not.toContain("useVfs");
    expect(source).not.toContain("Konsole");
    expect(source).not.toContain("eval(");
    expect(source).not.toContain("Function(");
    expect(coreSource).not.toContain("react");
    expect(coreSource).not.toContain("useVfs");
    expect(coreSource).not.toContain("node:fs");
    expect(coreSource).not.toContain("child_process");
    expect(coreSource).not.toContain("eval(");
    expect(coreSource).not.toContain("Function(");
  });

  it("routes Edit history and clipboard commands through command ids with captured Base context", () => {
    const source = readFileSync(new URL("./KCalc.tsx", import.meta.url), "utf8");
    const coreSource = readFileSync(new URL("./calculatorCore.ts", import.meta.url), "utf8");

    expect(source).toContain("useOptionalDesktopSession");
    expect(source).toContain("getKCalcClipboardText(calculator, mode.numberBase)");
    expect(source).toContain("getCalculatorActionForCommand(commandId, {");
    expect(source).toContain("clipboardText,");
    expect(source).toContain("getEditShortcutCommand");
    expect(source).toContain("isEditableKCalcTarget(event.target)");
    expect(source).toContain('commandId === "edit-undo" || commandId === "edit-redo"');
    expect(source).not.toContain("navigator.clipboard.readText");
    expect(coreSource).toContain('case "edit-paste":');
    expect(coreSource).toContain('type: "clipboard-paste"');
    expect(coreSource).toContain('case "edit-undo":');
    expect(coreSource).toContain('type: "history-undo"');
    expect(coreSource).toContain('case "edit-redo":');
    expect(coreSource).toContain('type: "history-redo"');
    expect(coreSource).not.toContain('buttonText === "Copy"');
  });
});
