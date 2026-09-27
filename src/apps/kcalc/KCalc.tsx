import { useCallback, useContext, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ApplicationLauncherContext } from "../../application-runtime/useApplicationLauncher";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import { getApplicationMenuPopupPosition } from "../applicationMenuPosition";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import { WindowOwnedPopupPortal } from "../../desktop/WindowOwnedPopupPortal";
import { useWindowOwnedPopupLayer } from "../../desktop/WindowOwnedPopupContext";
import { resizeNormalWindowBounds } from "../../window-manager/geometry";
import { useWindowManager } from "../../window-manager/useWindowManager";
import { APPLICATION_MENUBAR_CLASS, useApplicationMenubarPolicy } from "../applicationMenubarPolicy";
import {
  beginKCalcFocusRequest,
  cancelKCalcFocusRequest,
  completeKCalcFocusRequest,
  initialKCalcFocusRequestState,
  shouldScheduleKCalcFocus,
} from "./kcalcFocusRequest";
import {
  getCalculatorActionForCommand,
  getCalculatorActionForKey,
  getKCalcClipboardText,
  getKCalcConstantValueFromCalculatorState,
  initialCalculatorState,
  isCalculatorActionEnabled,
  isCalculatorCommandEnabled,
  reduceCalculator,
  type CalculatorAction,
} from "./calculatorCore";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { isKCalcRadixDigit, getKCalcRadix } from "./kcalcRadix";
import { isKCalcScientificCommand } from "./kcalcScientificMath";
import { toLogicalCoordinate, toLogicalRect } from "../../desktop/desktopUiScale";
import {
  hideAllKCalcOptionalPanels,
  initialKCalcOptionalPanels,
  kcalcOptionalPanelMenuItems,
  showAllKCalcOptionalPanels,
  toggleKCalcOptionalPanel,
  type KCalcOptionalPanel,
} from "./kcalcOptionalPanels";
import { getKCalcContentFitWidth, getKCalcRequiredWidth } from "./kcalcLayoutGeometry";
import {
  applyKCalcModeCommand,
  clearKCalcInverse,
  getKCalcStatusIndicators,
  initialKCalcModeState,
  isKCalcModeCommand,
  kcalcAngleMenuItems,
  kcalcBaseSelectorItems,
  setKCalcAngleUnit,
  setKCalcNumberBase,
  toggleKCalcInverse,
  type KCalcAngleUnit,
  type KCalcNumberBase,
} from "./kcalcModeState";
import {
  getKCalcScienceSlotToggleState,
  kcalcBaseScientificCommandSlots,
  kcalcConstantsCommandSlots,
  kcalcLogicCommandSlots,
  kcalcMemoryAddCommandSlot,
  kcalcMemoryClearCommandSlot,
  kcalcMemoryRecallCommandSlot,
  kcalcMemoryStoreCommandSlot,
  kcalcPercentCommandSlot,
  kcalcScienceCommandSlots,
  kcalcScientificEntryCommandSlot,
  kcalcStatisticsCommandSlots,
  resolveKCalcCommandSurface,
  resolveKCalcScienceCommandSurface,
  type KCalcCommandLabel,
  type KCalcCommandId,
  type KCalcCommandSurfaceDescriptor,
  type KCalcCommandSurfaceSlot,
} from "./kcalcCommandSurface";
import {
  getKCalcConstantSlot,
  getKCalcConstantSlotIdForCommand,
  cloneKCalcConstantRegistry,
  formatKCalcConstantValue,
  parseKCalcConfiguredConstantValue,
  setKCalcConstant,
  setKCalcConstantName,
  isKCalcConstantRecallCommand,
  isKCalcConstantStoreCommand,
  type KCalcConstantRegistry,
  type KCalcConstantSlotId,
} from "./kcalcConstants";
import { useKCalcConstants } from "./useKCalcConstants";
import {
  kcalcBuiltInConstantCategories,
  type KCalcBuiltInConstant,
  type KCalcBuiltInConstantCategoryId,
} from "./kcalcBuiltInConstants";
import { getKCalcConstantsSubmenuPosition } from "./kcalcConstantsMenuPosition";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";

type KCalcProps = {
  readonly windowId?: string;
  readonly isActive?: boolean;
  readonly focusRequestId?: number;
  readonly onRequestClose?: () => void;
};

type KCalcMenu = "file" | "edit" | "constants" | "settings" | "help";

type KCalcPopup = KCalcMenu | "angle";

type KCalcPopupRequest = {
  readonly popup: KCalcPopup;
  readonly requestId: number;
  readonly trigger: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
  };
};

const kcalcMenuKeys: Readonly<Record<KCalcMenu, TranslationKey>> = {
  file: "kcalc.file",
  edit: "kcalc.edit",
  constants: "kcalc.constants",
  settings: "kcalc.settings",
  help: "kcalc.help",
};

const kcalcConstantCategoryKeys: Readonly<Record<KCalcBuiltInConstantCategoryId, TranslationKey>> = {
  mathematics: "kcalc.category.mathematics",
  electromagnetism: "kcalc.category.electromagnetism",
  "atomic-nuclear": "kcalc.category.atomicNuclear",
  thermodynamics: "kcalc.category.thermodynamics",
  gravitation: "kcalc.category.gravitation",
};

const kcalcOptionalPanelKeys: Readonly<Record<KCalcOptionalPanel, TranslationKey>> = {
  scienceEngineering: "kcalc.scienceButtons",
  statistics: "kcalc.statButtons",
  logic: "kcalc.logicButtons",
  constants: "kcalc.constantButtons",
};

const kcalcOptionalPanelMenuKeys: Readonly<Record<KCalcOptionalPanel, TranslationKey>> = {
  scienceEngineering: "kcalc.scienceButtonsMenu",
  statistics: "kcalc.statButtonsMenu",
  logic: "kcalc.logicButtonsMenu",
  constants: "kcalc.constantButtonsMenu",
};

const kcalcCommandAriaKeys: Readonly<Partial<Record<KCalcCommandId, TranslationKey>>> = {
  sin: "kcalc.command.sine",
  asin: "kcalc.command.arcSine",
  sinh: "kcalc.command.hyperbolicSine",
  asinh: "kcalc.command.inverseHyperbolicSine",
  cos: "kcalc.command.cosine",
  acos: "kcalc.command.arcCosine",
  cosh: "kcalc.command.hyperbolicCosine",
  acosh: "kcalc.command.inverseHyperbolicCosine",
  tan: "kcalc.command.tangent",
  atan: "kcalc.command.arcTangent",
  tanh: "kcalc.command.hyperbolicTangent",
  atanh: "kcalc.command.inverseHyperbolicTangent",
  log10: "kcalc.command.logarithm",
  pow10: "kcalc.command.power10",
  ln: "kcalc.command.naturalLogarithm",
  exp: "kcalc.command.exponential",
  hyp: "kcalc.command.hyperbolic",
  "stat-count": "kcalc.command.numberData",
  "stat-sum": "kcalc.command.sumData",
  "stat-mean": "kcalc.command.mean",
  "stat-sum-squares": "kcalc.command.sumSquares",
  "stat-sample-standard-deviation": "kcalc.command.sampleDeviation",
  "stat-population-standard-deviation": "kcalc.command.populationDeviation",
  "stat-median": "kcalc.command.median",
  "stat-enter-data": "kcalc.command.enterData",
  "stat-delete-data": "kcalc.command.deleteData",
  "stat-clear": "kcalc.command.clearStatistics",
  "stat-clear-inverse-noop": "kcalc.command.exitInverse",
  "logic-and": "kcalc.command.and",
  "logic-or": "kcalc.command.or",
  "logic-xor": "kcalc.command.xor",
  "logic-left-shift": "kcalc.command.leftShift",
  "logic-right-shift": "kcalc.command.rightShift",
  "logic-complement": "kcalc.command.complement",
  mod: "kcalc.command.modulo",
  "int-div": "kcalc.command.integerDivision",
  reciprocal: "kcalc.command.reciprocal",
  factorial: "kcalc.command.factorial",
  square: "kcalc.command.square",
  cube: "kcalc.command.cube",
  sqrt: "kcalc.command.squareRoot",
  cuberoot: "kcalc.command.cubeRoot",
  power: "kcalc.command.power",
  "inverse-power": "kcalc.command.inversePower",
  "memory-recall": "kcalc.command.memoryRecall",
  "memory-store": "kcalc.command.memoryStore",
  "memory-add": "kcalc.command.memoryAdd",
  "memory-subtract": "kcalc.command.memorySubtract",
  "memory-clear": "kcalc.command.memoryClear",
  percent: "kcalc.command.percent",
};

const kcalcCoreAriaKeys: Readonly<Record<string, TranslationKey>> = {
  Divide: "kcalc.command.divide",
  Multiply: "kcalc.command.multiply",
  Subtract: "kcalc.command.subtract",
  "Clear entry": "kcalc.command.clearEntry",
  Clear: "kcalc.command.clear",
  Add: "kcalc.command.add",
  Equals: "kcalc.command.equals",
  "Decimal point": "kcalc.command.decimal",
  "Toggle sign": "kcalc.command.toggleSign",
};

const getKCalcCommandAriaLabel = (command: KCalcCommandSurfaceDescriptor, t: ReturnType<typeof useI18n>["t"]): string => {
  const key = kcalcCommandAriaKeys[command.commandId];
  if (key !== undefined) return t(key);
  if (command.ariaLabel.startsWith("Recall constant ")) {
    return t("kcalc.command.recallConstant", { name: command.ariaLabel.slice("Recall constant ".length) });
  }
  if (command.commandId.startsWith("constant-")) {
    return t("kcalc.command.constant", { number: command.commandId.slice("constant-".length) });
  }
  if (command.commandId.startsWith("store-constant-")) {
    return t("kcalc.command.storeConstant", { number: command.commandId.slice("store-constant-".length) });
  }
  return command.ariaLabel;
};

const getKCalcCoreAriaLabel = (label: string, t: ReturnType<typeof useI18n>["t"]): string => {
  const key = kcalcCoreAriaKeys[label];
  return key === undefined ? label : t(key);
};

type KCalcEditCommandId = "edit-undo" | "edit-redo" | "edit-copy" | "edit-cut" | "edit-paste";

type KCalcEditMenuItem = Readonly<{
  readonly commandId: KCalcEditCommandId;
  readonly label: "Undo" | "Redo" | "Cut" | "Copy" | "Paste";
  readonly shortcut: "Ctrl+Z" | "Ctrl+Shift+Z" | "Ctrl+X" | "Ctrl+C" | "Ctrl+V";
}>;

const kcalcHistoryEditMenuItems: readonly KCalcEditMenuItem[] = [
  { commandId: "edit-undo", label: "Undo", shortcut: "Ctrl+Z" },
  { commandId: "edit-redo", label: "Redo", shortcut: "Ctrl+Shift+Z" },
];

const kcalcClipboardEditMenuItems: readonly KCalcEditMenuItem[] = [
  { commandId: "edit-cut", label: "Cut", shortcut: "Ctrl+X" },
  { commandId: "edit-copy", label: "Copy", shortcut: "Ctrl+C" },
  { commandId: "edit-paste", label: "Paste", shortcut: "Ctrl+V" },
];

const getEditShortcutCommand = (event: KeyboardEvent<HTMLElement>): KCalcEditCommandId | null => {
  if (!event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  switch (event.key.toLowerCase()) {
    case "z":
      return event.shiftKey ? "edit-redo" : "edit-undo";
    case "x":
      return event.shiftKey ? null : "edit-cut";
    case "c":
      return event.shiftKey ? null : "edit-copy";
    case "v":
      return event.shiftKey ? null : "edit-paste";
    default:
      return null;
  }
};

const isEditableKCalcTarget = (target: EventTarget | null): boolean => target instanceof HTMLElement
  && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable);

type KCalcPopupTrigger = KCalcPopupRequest["trigger"];

type KCalcConstantCatalogOwner = "top-menu" | "context-menu" | "configuration";

type KCalcConstantCatalogRequest = Readonly<{
  owner: KCalcConstantCatalogOwner;
  slotId?: KCalcConstantSlotId;
  requestId: number;
  trigger: KCalcPopupTrigger;
}>;

type KCalcConstantCatalogSubmenuRequest = KCalcConstantCatalogRequest & Readonly<{
  categoryId: KCalcBuiltInConstantCategoryId;
}>;

type KCalcConstantContextRequest = Readonly<{
  slotId: KCalcConstantSlotId;
  requestId: number;
  trigger: KCalcPopupTrigger;
}>;

type KCalcConstantNameDialog = Readonly<{
  slotId: KCalcConstantSlotId;
  value: string;
}>;

const kcalcDisplayBaseLabels: Readonly<Record<KCalcNumberBase, string>> = {
  decimal: "Dec",
  hex: "Hex",
  octal: "Oct",
  binary: "Bin",
};

type KCalcKey = {
  readonly label?: string;
  readonly action?: CalculatorAction;
  readonly className?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly commandSlot?: KCalcCommandSurfaceSlot;
};

const coreKeypad: readonly KCalcKey[] = [
  { commandSlot: kcalcScientificEntryCommandSlot },
  { label: "/", action: { type: "operator", operator: "/" }, ariaLabel: "Divide" },
  { label: "×", action: { type: "operator", operator: "*" }, ariaLabel: "Multiply" },
  { label: "-", action: { type: "operator", operator: "-" }, ariaLabel: "Subtract" },
  { label: "C", action: { type: "clear-entry" }, ariaLabel: "Clear entry" },
  { label: "AC", action: { type: "clear" }, ariaLabel: "Clear" },
  { label: "7", action: { type: "digit", digit: "7" } },
  { label: "8", action: { type: "digit", digit: "8" } },
  { label: "9", action: { type: "digit", digit: "9" } },
  { label: "+", action: { type: "operator", operator: "+" }, className: "kcalc-key--plus", ariaLabel: "Add" },
  { label: "(", disabled: true },
  { label: ")", disabled: true },
  { label: "4", action: { type: "digit", digit: "4" } },
  { label: "5", action: { type: "digit", digit: "5" } },
  { label: "6", action: { type: "digit", digit: "6" } },
  { commandSlot: kcalcMemoryRecallCommandSlot },
  { commandSlot: kcalcMemoryStoreCommandSlot },
  { label: "1", action: { type: "digit", digit: "1" } },
  { label: "2", action: { type: "digit", digit: "2" } },
  { label: "3", action: { type: "digit", digit: "3" } },
  { label: "=", action: { type: "equals" }, className: "kcalc-key--equals", ariaLabel: "Equals" },
  { commandSlot: kcalcMemoryAddCommandSlot },
  { commandSlot: kcalcMemoryClearCommandSlot },
  { label: "0", action: { type: "digit", digit: "0" }, className: "kcalc-key--zero" },
  { label: ".", action: { type: "decimal" }, ariaLabel: "Decimal point" },
  { commandSlot: kcalcPercentCommandSlot },
  { label: "±", action: { type: "toggle-sign" }, ariaLabel: "Toggle sign" },
];

const withKCalcNumberBase = (action: CalculatorAction, numberBase: KCalcNumberBase): CalculatorAction => {
  switch (action.type) {
    case "digit":
    case "decimal":
    case "operator":
    case "equals":
      return { ...action, numberBase };
    default:
      return action;
  }
};

const isKCalcKeyActionEnabledForBase = (
  calculator: Parameters<typeof isCalculatorActionEnabled>[0],
  action: CalculatorAction | undefined,
  numberBase: KCalcNumberBase,
): boolean => {
  if (action?.type === "digit") {
    return isKCalcRadixDigit(action.digit, getKCalcRadix(numberBase));
  }

  return (action?.type !== "decimal" || numberBase === "decimal")
    && (action === undefined || isCalculatorActionEnabled(calculator, action));
};

type KCalcOptionalPanelColumnProps<TSlot extends KCalcCommandSurfaceSlot = KCalcCommandSurfaceSlot> = {
  readonly panel: "science" | "statistics" | "logic-operations" | "logic-digits" | "constants";
  readonly label: string;
  readonly slots: readonly TSlot[];
  readonly resolveCommand: (slot: TSlot) => KCalcCommandSurfaceDescriptor;
  readonly getSlotToggleState?: (slot: TSlot) => boolean | undefined;
  readonly getCommandTitle?: (slot: TSlot, command: KCalcCommandSurfaceDescriptor) => string | undefined;
  readonly onCommand: (event: MouseEvent<HTMLButtonElement>, command: KCalcCommandSurfaceDescriptor) => void;
  readonly onSlotContextMenu?: (event: MouseEvent<HTMLButtonElement>, slot: TSlot) => void;
};

function KCalcCommandLabelPresentation({ label }: { readonly label: KCalcCommandLabel }) {
  switch (label.kind) {
    case "text":
      return <>{label.text}</>;
    case "superscript":
      return <span className="kcalc-math-label">{label.base}<sup>{label.exponent}</sup></span>;
    case "sigma":
      return <span className="kcalc-math-label kcalc-math-label--subscript">σ<sub>{label.subscript}</sub></span>;
    case "sum":
      return <span className="kcalc-math-label">Σx{label.exponent === undefined ? null : <sup>{label.exponent}</sup>}</span>;
  }
}

function KCalcOptionalPanelColumn<TSlot extends KCalcCommandSurfaceSlot>({
  panel,
  label,
  slots,
  resolveCommand,
  getSlotToggleState,
  getCommandTitle,
  onCommand,
  onSlotContextMenu,
}: KCalcOptionalPanelColumnProps<TSlot>) {
  const { t } = useI18n();
  return (
    <section
      className={`kcalc-optional-panel kcalc-optional-panel--${panel}`}
      aria-label={label}
      data-kcalc-layout-module={panel}
      data-kcalc-row-count="6"
      data-kcalc-button-bank-height="shared"
    >
      {slots.map((slot) => {
        const command = resolveCommand(slot);
        const toggleState = getSlotToggleState?.(slot);

        return (
        <button
          key={slot.slotId}
          type="button"
          className={`kde-raised kcalc-key${toggleState ? " is-active" : ""}`}
          data-kcalc-command-slot={slot.slotId}
          data-kcalc-command-id={command.commandId}
          disabled={!command.enabled}
          aria-label={getKCalcCommandAriaLabel(command, t)}
          aria-pressed={toggleState}
          title={getCommandTitle?.(slot, command)}
          onClick={command.enabled ? (event) => onCommand(event, command) : undefined}
          onContextMenu={onSlotContextMenu === undefined ? undefined : (event) => onSlotContextMenu(event, slot)}
        >
          <KCalcCommandLabelPresentation label={command.label} />
        </button>
        );
      })}
    </section>
  );
}

type KCalcRadixDigitPanelProps = {
  readonly numberBase: KCalcNumberBase;
  readonly onDigit: (event: MouseEvent<HTMLButtonElement>, digit: string) => void;
};

function KCalcRadixDigitPanel({ numberBase, onDigit }: KCalcRadixDigitPanelProps) {
  const { t } = useI18n();
  return (
    <section
      className="kcalc-optional-panel kcalc-optional-panel--logic-digits"
      aria-label={t("kcalc.hexDigits")}
      data-kcalc-layout-module="logic-digits"
      data-kcalc-row-count="6"
      data-kcalc-button-bank-height="shared"
    >
      {["A", "B", "C", "D", "E", "F"].map((digit) => {
        const enabled = isKCalcRadixDigit(digit, getKCalcRadix(numberBase));

        return (
          <button
            key={digit}
            type="button"
            className="kde-raised kcalc-key"
            data-kcalc-radix-digit={digit}
            disabled={!enabled}
            onClick={enabled ? (event) => onDigit(event, digit) : undefined}
          >
            {digit}
          </button>
        );
      })}
    </section>
  );
}

type KCalcBaseSelectorProps = {
  readonly numberBase: KCalcNumberBase;
  readonly onSelectNumberBase: (numberBase: KCalcNumberBase) => void;
};

function KCalcBaseSelector({ numberBase, onSelectNumberBase }: KCalcBaseSelectorProps) {
  const { t } = useI18n();
  return (
    <fieldset className="kcalc-base-selector" aria-label={t("kcalc.baseSelector")}>
      <legend className="kcalc-base-selector__title">{t("kcalc.base")}</legend>
      <div className="kcalc-base-selector__options" role="radiogroup" aria-label={t("kcalc.numberBase")}>
        {kcalcBaseSelectorItems.map(({ base, label }) => (
          <button
            key={base}
            type="button"
            className="kcalc-base-option"
            data-kcalc-base-option={label.toLowerCase()}
            aria-checked={numberBase === base}
            role="radio"
            onClick={() => onSelectNumberBase(base)}
          >
            <span className="kcalc-radio-mark" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function KCalc({ windowId, isActive = false, focusRequestId = 0, onRequestClose = () => undefined }: KCalcProps) {
  const { t } = useI18n();
  const launcher = useContext(ApplicationLauncherContext);
  const { constants, storeConstant, updateConstants } = useKCalcConstants();
  const desktopSession = useOptionalDesktopSession();
  const { fitWindowToContent, layoutMode, screenArea, windows, workArea } = useWindowManager();
  const windowPopupLayer = useWindowOwnedPopupLayer();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuBarRef = useRef<HTMLElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const constantCatalogRef = useRef<HTMLDivElement | null>(null);
  const constantCatalogSubmenuRef = useRef<HTMLDivElement | null>(null);
  const constantContextMenuRef = useRef<HTMLDivElement | null>(null);
  const focusRequestStateRef = useRef(initialKCalcFocusRequestState);
  const nextPopupRequestId = useRef(1);
  const [calculator, setCalculator] = useState(initialCalculatorState);
  const [optionalPanels, setOptionalPanels] = useState(initialKCalcOptionalPanels);
  const [mode, setMode] = useState(initialKCalcModeState);
  const [openPopup, setOpenPopup] = useState<KCalcPopupRequest | null>(null);
  const [constantCatalogRequest, setConstantCatalogRequest] = useState<KCalcConstantCatalogRequest | null>(null);
  const [constantCatalogSubmenuRequest, setConstantCatalogSubmenuRequest] = useState<KCalcConstantCatalogSubmenuRequest | null>(null);
  const [constantContextRequest, setConstantContextRequest] = useState<KCalcConstantContextRequest | null>(null);
  const [constantNameDialog, setConstantNameDialog] = useState<KCalcConstantNameDialog | null>(null);
  const [isConfigureConstantsVisible, setIsConfigureConstantsVisible] = useState(false);
  const [configurationDraft, setConfigurationDraft] = useState<KCalcConstantRegistry | null>(null);
  const [configurationValueText, setConfigurationValueText] = useState<Readonly<Record<KCalcConstantSlotId, string>> | null>(null);
  const closeApplicationMenubar = useCallback(() => {
    setOpenPopup((current) => current?.popup === "angle" ? current : null);
    setConstantCatalogRequest((current) => current?.owner === "top-menu" ? null : current);
    setConstantCatalogSubmenuRequest((current) => current?.owner === "top-menu" ? null : current);
  }, []);
  const currentWindow = windowId === undefined ? undefined : windows.find((desktopWindow) => desktopWindow.id === windowId);
  const requiredWidth = getKCalcRequiredWidth(optionalPanels);
  const effectiveScreenArea = screenArea ?? workArea;
  const resolveMenuPopupPosition = useCallback((popup: HTMLElement, request: KCalcPopupRequest) => {
    return getApplicationMenuPopupPosition(
      request.trigger,
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      effectiveScreenArea,
    );
  }, [effectiveScreenArea]);
  const { isPositioned: isMenuPopupPositioned, position: menuPopupPosition } = useMeasuredPopupPosition(
    openPopup,
    menuPopupRef,
    resolveMenuPopupPosition,
  );
  const resolveConstantCatalogPosition = useCallback((popup: HTMLElement, request: KCalcConstantCatalogRequest) => {
    const popupBounds = toLogicalRect(popup.getBoundingClientRect());
    const bounds = { width: popupBounds.width, height: popupBounds.height };

    return request.owner === "top-menu"
      ? getApplicationMenuPopupPosition(request.trigger, bounds, effectiveScreenArea)
      : getKCalcConstantsSubmenuPosition(request.trigger, bounds, effectiveScreenArea);
  }, [effectiveScreenArea]);
  const { isPositioned: isConstantCatalogPositioned, position: constantCatalogPosition } = useMeasuredPopupPosition(
    constantCatalogRequest,
    constantCatalogRef,
    resolveConstantCatalogPosition,
  );
  const resolveConstantCatalogSubmenuPosition = useCallback((popup: HTMLElement, request: KCalcConstantCatalogSubmenuRequest) =>
    getKCalcConstantsSubmenuPosition(
      request.trigger,
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      effectiveScreenArea,
    ), [effectiveScreenArea]);
  const { isPositioned: isConstantCatalogSubmenuPositioned, position: constantCatalogSubmenuPosition } = useMeasuredPopupPosition(
    constantCatalogSubmenuRequest,
    constantCatalogSubmenuRef,
    resolveConstantCatalogSubmenuPosition,
  );
  const resolveConstantContextPosition = useCallback((popup: HTMLElement, request: KCalcConstantContextRequest) =>
    getApplicationMenuPopupPosition(
      request.trigger,
      (() => {
        const bounds = toLogicalRect(popup.getBoundingClientRect());
        return { width: bounds.width, height: bounds.height };
      })(),
      effectiveScreenArea,
    ), [effectiveScreenArea]);
  const { isPositioned: isConstantContextPositioned, position: constantContextPosition } = useMeasuredPopupPosition(
    constantContextRequest,
    constantContextMenuRef,
    resolveConstantContextPosition,
  );

  useEffect(() => {
    if (!shouldScheduleKCalcFocus(focusRequestStateRef.current, isActive, focusRequestId) || typeof window === "undefined") {
      return;
    }

    focusRequestStateRef.current = beginKCalcFocusRequest(focusRequestStateRef.current, focusRequestId);
    const animationFrameId = window.requestAnimationFrame(() => {
      const calculatorRoot = rootRef.current;

      if (!calculatorRoot) {
        focusRequestStateRef.current = completeKCalcFocusRequest(focusRequestStateRef.current, focusRequestId, false);
        return;
      }

      calculatorRoot.focus({ preventScroll: true });
      focusRequestStateRef.current = completeKCalcFocusRequest(
        focusRequestStateRef.current,
        focusRequestId,
        document.activeElement === calculatorRoot,
      );
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      focusRequestStateRef.current = cancelKCalcFocusRequest(focusRequestStateRef.current, focusRequestId);
    };
  }, [focusRequestId, isActive]);

  useEffect(() => {
    if (!windowId || !currentWindow || currentWindow.state !== "normal") {
      return;
    }

    const nextWidth = getKCalcContentFitWidth(
      currentWindow.bounds.width,
      requiredWidth,
    );

    if (nextWidth === null) {
      return;
    }

    const resizedBounds = resizeNormalWindowBounds({
      initialBounds: currentWindow.bounds,
      direction: "e",
      deltaX: nextWidth - currentWindow.bounds.width,
      deltaY: 0,
      minimumWidth: currentWindow.minimumWidth,
      minimumHeight: currentWindow.minimumHeight,
      screenArea: screenArea ?? {
        x: workArea.x,
        y: workArea.y,
        width: workArea.width,
        height: workArea.height,
      },
    });

    fitWindowToContent?.(windowId, resizedBounds);
  }, [currentWindow, fitWindowToContent, requiredWidth, screenArea, windowId, workArea]);

  useApplicationMenuDismissal({
    isOpen: openPopup !== null || constantCatalogRequest !== null || constantContextRequest !== null,
    menuBarRef,
    popupRefs: [menuPopupRef, constantCatalogRef, constantCatalogSubmenuRef, constantContextMenuRef],
    onDismiss: () => {
      setOpenPopup(null);
      setConstantCatalogRequest(null);
      setConstantCatalogSubmenuRequest(null);
      setConstantContextRequest(null);
    },
  });
  useApplicationMenubarPolicy(closeApplicationMenubar, layoutMode ?? "desktop");

  useEffect(() => {
    if (windowPopupLayer?.dismissGeneration) {
      setOpenPopup(null);
      setConstantCatalogRequest(null);
      setConstantCatalogSubmenuRequest(null);
      setConstantContextRequest(null);
      setConstantNameDialog(null);
      setIsConfigureConstantsVisible(false);
    }
  }, [windowPopupLayer?.dismissGeneration]);

  const dispatchAction = (action: CalculatorAction) => {
    setCalculator((current) => reduceCalculator(current, action));
  };

  const getEditCommandEnabled = (commandId: KCalcEditCommandId): boolean => {
    if (commandId === "edit-undo" || commandId === "edit-redo") {
      return isCalculatorActionEnabled(calculator, getCalculatorActionForCommand(commandId, {
        angleUnit: mode.angleUnit,
        numberBase: mode.numberBase,
      })!);
    }

    if (desktopSession === null) {
      return false;
    }

    if (commandId === "edit-paste") {
      return desktopSession.hasClipboardText;
    }

    return getKCalcClipboardText(calculator, mode.numberBase) !== null;
  };

  const executeEditCommand = (commandId: KCalcEditCommandId, trigger?: HTMLButtonElement) => {
    if (!getEditCommandEnabled(commandId)) {
      return;
    }

    const clipboardText = commandId === "edit-paste" ? desktopSession?.readClipboardText() ?? undefined : undefined;
    const action = getCalculatorActionForCommand(commandId, {
      angleUnit: mode.angleUnit,
      numberBase: mode.numberBase,
      clipboardText,
    });

    if (action === null) {
      return;
    }

    if (commandId === "edit-copy" || commandId === "edit-cut") {
      if (desktopSession === null) {
        return;
      }

      const text = getKCalcClipboardText(calculator, mode.numberBase);

      if (text === null) {
        return;
      }

      void desktopSession.writeClipboard(text);
    }

    trigger?.focus();
    executeCalculatorAction(action);
    setOpenPopup(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  const handleDisplayClick = (event: MouseEvent<HTMLInputElement>) => {
    if (event.button !== 0 || event.detail > 1) {
      return;
    }

    executeEditCommand("edit-copy");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((openPopup !== null || constantCatalogRequest !== null || constantContextRequest !== null) && event.key === "Escape") {
      event.preventDefault();
      setOpenPopup(null);
      setConstantCatalogRequest(null);
      setConstantCatalogSubmenuRequest(null);
      setConstantContextRequest(null);
      return;
    }

    const editCommand = getEditShortcutCommand(event);

    if (editCommand !== null) {
      if (!isActive || isEditableKCalcTarget(event.target)) {
        return;
      }

      if (getEditCommandEnabled(editCommand)) {
        event.preventDefault();
        executeEditCommand(editCommand);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const action = getCalculatorActionForKey(event.key, mode.numberBase);

    if (action === null) {
      return;
    }

    event.preventDefault();
    executeCalculatorAction(action);
  };

  const executeCalculatorAction = (action: CalculatorAction) => {
    dispatchAction(action);

    if (action.type === "clear") {
      setMode(clearKCalcInverse);
    }
  };

  const handleKeypadClick = (event: MouseEvent<HTMLButtonElement>, action: CalculatorAction) => {
    event.currentTarget.focus();
    executeCalculatorAction(action);
  };

  const handleCommandClick = (event: MouseEvent<HTMLButtonElement>, command: KCalcCommandSurfaceDescriptor) => {
    const commandId = command.commandId;

    if (isKCalcModeCommand(commandId)) {
      event.currentTarget.focus();
      setMode((current) => applyKCalcModeCommand(current, commandId));
      return;
    }

    const slotId = getKCalcConstantSlotIdForCommand(commandId);
    const constantValue = isKCalcConstantRecallCommand(commandId) && slotId !== null
      ? getKCalcConstantSlot(constants, slotId).value
      : undefined;
    const action = getCalculatorActionForCommand(commandId, {
      angleUnit: mode.angleUnit,
      numberBase: mode.numberBase,
      constantValue,
    });

    if (action !== null) {
      if (isKCalcConstantStoreCommand(commandId) && slotId !== null) {
        const value = getKCalcConstantValueFromCalculatorState(calculator);

        if (value === null) {
          return;
        }

        storeConstant(slotId, value);
      }

      handleKeypadClick(event, action);

      if (command.consumesInverse) {
        setMode(clearKCalcInverse);
      }
    }
  };

  const isCommandEnabled = (commandId: KCalcCommandId) => {
    if (isKCalcModeCommand(commandId)) {
      return mode.numberBase === "decimal";
    }

    return (!isKCalcScientificCommand(commandId) || mode.numberBase === "decimal")
      && isCalculatorCommandEnabled(calculator, commandId);
  };

const toPopupTrigger = (rect: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">): KCalcPopupTrigger => ({
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  });

  const closeConstantPopups = () => {
    setOpenPopup(null);
    setConstantCatalogRequest(null);
    setConstantCatalogSubmenuRequest(null);
    setConstantContextRequest(null);
  };

  const openConstantCatalog = (
    owner: KCalcConstantCatalogOwner,
    event: MouseEvent<HTMLElement>,
    slotId?: KCalcConstantSlotId,
  ) => {
    const trigger = toLogicalRect(event.currentTarget.getBoundingClientRect());
    setConstantCatalogRequest({ owner, slotId, requestId: nextPopupRequestId.current++, trigger: toPopupTrigger(trigger) });
    setConstantCatalogSubmenuRequest(null);
  };

  const openConstantCatalogCategory = (
    categoryId: KCalcBuiltInConstantCategoryId,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const catalogRequest = constantCatalogRequest ?? (openPopup?.popup === "constants" ? {
      owner: "top-menu" as const,
      requestId: openPopup.requestId,
      trigger: openPopup.trigger,
    } : null);

    if (catalogRequest === null) {
      return;
    }

    setConstantCatalogSubmenuRequest({
      ...catalogRequest,
      categoryId,
      requestId: nextPopupRequestId.current++,
      trigger: toPopupTrigger(toLogicalRect(event.currentTarget.getBoundingClientRect())),
    });
  };

  const selectBuiltInConstant = (constant: KCalcBuiltInConstant) => {
    const owner = constantCatalogSubmenuRequest?.owner ?? constantCatalogRequest?.owner;
    const slotId = constantCatalogSubmenuRequest?.slotId ?? constantCatalogRequest?.slotId;

    if (owner === "top-menu") {
      const action = getCalculatorActionForCommand("built-in-constant-recall", {
        angleUnit: mode.angleUnit,
        numberBase: mode.numberBase,
        builtInConstantValue: constant.value.value,
      });

      if (action !== null) {
        dispatchAction(action);
        setMode(clearKCalcInverse);
      }
    } else if (owner === "context-menu" && slotId !== undefined) {
      updateConstants(setKCalcConstant(constants, slotId, { name: constant.label, value: constant.value }));
    } else if (owner === "configuration" && slotId !== undefined) {
      setConfigurationDraft((current) => current === null ? current : setKCalcConstant(current, slotId, {
        name: constant.label,
        value: constant.value,
      }));
      setConfigurationValueText((current) => current === null ? current : {
        ...current,
        [slotId]: constant.canonicalValue,
      });
    }

    closeConstantPopups();
    rootRef.current?.focus({ preventScroll: true });
  };

  const openConstantContextMenu = (event: MouseEvent<HTMLButtonElement>, slotId: KCalcConstantSlotId) => {
    event.preventDefault();
    const point = { left: toLogicalCoordinate(event.clientX), right: toLogicalCoordinate(event.clientX), top: toLogicalCoordinate(event.clientY), bottom: toLogicalCoordinate(event.clientY), width: 0, height: 0 };
    setOpenPopup(null);
    setConstantCatalogRequest(null);
    setConstantCatalogSubmenuRequest(null);
    setConstantContextRequest({ slotId, requestId: nextPopupRequestId.current++, trigger: point });
  };

  const openConstantNameDialog = () => {
    if (constantContextRequest === null) {
      return;
    }

    const slot = getKCalcConstantSlot(constants, constantContextRequest.slotId);
    setConstantNameDialog({ slotId: slot.id, value: slot.name });
    setConstantContextRequest(null);
    setConstantCatalogRequest(null);
    setConstantCatalogSubmenuRequest(null);
  };

  const confirmConstantName = () => {
    if (constantNameDialog === null || constantNameDialog.value.trim().length === 0 || constantNameDialog.value.length > 6) {
      return;
    }

    updateConstants(setKCalcConstantName(constants, constantNameDialog.slotId, constantNameDialog.value));
    setConstantNameDialog(null);
  };

  const openConfigureConstants = () => {
    const draft = cloneKCalcConstantRegistry(constants);
    setConfigurationDraft(draft);
    setConfigurationValueText(Object.fromEntries(draft.map((slot) => [slot.id, formatKCalcConstantValue(slot.value)])) as Record<KCalcConstantSlotId, string>);
    setIsConfigureConstantsVisible(true);
    closeConstantPopups();
  };

  const isConfigurationDraftValid = (draft: KCalcConstantRegistry | null): boolean => draft !== null
    && configurationValueText !== null
    && draft.every((slot) =>
      slot.name.trim().length > 0
      && slot.name.length <= 6
      && parseKCalcConfiguredConstantValue(configurationValueText[slot.id]) !== null,
    );

  const applyConfigurationDraft = () => {
    if (configurationDraft === null || !isConfigurationDraftValid(configurationDraft)) {
      return;
    }

    updateConstants(configurationDraft.map((slot) => ({
      ...slot,
      value: parseKCalcConfiguredConstantValue(configurationValueText?.[slot.id] ?? "")!,
    })));
  };

  const updateConfigurationName = (slotId: KCalcConstantSlotId, event: ChangeEvent<HTMLInputElement>) => {
    const name = event.currentTarget.value.slice(0, 6);
    setConfigurationDraft((current) => current === null ? current : setKCalcConstantName(current, slotId, name));
  };

  const updateConfigurationValue = (slotId: KCalcConstantSlotId, event: ChangeEvent<HTMLInputElement>) => {
    const text = event.currentTarget.value;
    setConfigurationValueText((current) => current === null ? current : { ...current, [slotId]: text });
    const parsed = parseKCalcConfiguredConstantValue(text);

    if (parsed === null) {
      return;
    }

    setConfigurationDraft((current) => current === null ? current : setKCalcConstant(current, slotId, {
      name: getKCalcConstantSlot(current, slotId).name,
      value: parsed,
    }));
  };

  const togglePopup = (popup: KCalcPopup, event: MouseEvent<HTMLButtonElement>) => {
    if (openPopup?.popup === popup) {
      closeConstantPopups();
      return;
    }

    const trigger = toLogicalRect(event.currentTarget.getBoundingClientRect());
    setConstantCatalogRequest(null);
    setConstantCatalogSubmenuRequest(null);
    setConstantContextRequest(null);
    setOpenPopup({
      popup,
      requestId: nextPopupRequestId.current++,
      trigger: toPopupTrigger(trigger),
    });
  };

  const toggleOptionalPanel = (panel: KCalcOptionalPanel) => {
    setOptionalPanels((current) => toggleKCalcOptionalPanel(current, panel));
    setOpenPopup(null);
  };

  const showAllOptionalPanels = () => {
    setOptionalPanels(showAllKCalcOptionalPanels());
    setOpenPopup(null);
  };

  const hideAllOptionalPanels = () => {
    setOptionalPanels(hideAllKCalcOptionalPanels());
    setOpenPopup(null);
  };

  const selectAngleUnit = (angleUnit: KCalcAngleUnit) => {
    setMode((current) => setKCalcAngleUnit(current, angleUnit));
    setOpenPopup(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  const selectNumberBase = (numberBase: KCalcNumberBase) => {
    dispatchAction({ type: "set-base", numberBase });
    setMode((current) => setKCalcNumberBase(current, numberBase));
  };

  const activeMenu = openPopup?.popup === "angle" ? null : openPopup?.popup ?? null;
  const popupRequest = openPopup;
  const statusIndicators = getKCalcStatusIndicators(mode, optionalPanels, calculator.memoryValue);
  const popup = popupRequest === null ? null : activeMenu !== null ? (
    <div
      ref={menuPopupRef}
      className={`kcalc-menu-popup${activeMenu === "settings" ? " kcalc-settings-menu" : ""}${activeMenu === "edit" ? " kcalc-edit-menu" : ""}`}
      role="menu"
      aria-label={`${t(kcalcMenuKeys[activeMenu])} menu`}
      data-menu-request-id={popupRequest.requestId}
      data-window-id={windowId}
      data-positioned={isMenuPopupPositioned}
      style={menuPopupPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {activeMenu === "file" ? (
        <button type="button" role="menuitem" onClick={() => { setOpenPopup(null); onRequestClose(); }}>
          {t("kcalc.close")}
        </button>
      ) : null}
      {activeMenu === "edit" ? (
        <>
          {kcalcHistoryEditMenuItems.map((item) => (
            <button
              key={item.commandId}
              type="button"
              role="menuitem"
              data-kcalc-edit-command={item.commandId}
              disabled={!getEditCommandEnabled(item.commandId)}
              onClick={(event) => executeEditCommand(item.commandId, event.currentTarget)}
            >
              {t(`kcalc.${item.label.toLowerCase()}` as TranslationKey)}<span className="kcalc-menu-shortcut">{item.shortcut}</span>
            </button>
          ))}
          <div className="kcalc-menu-separator" role="separator" />
          {kcalcClipboardEditMenuItems.map((item) => (
            <button
              key={item.commandId}
              type="button"
              role="menuitem"
              data-kcalc-edit-command={item.commandId}
              disabled={!getEditCommandEnabled(item.commandId)}
              onClick={(event) => executeEditCommand(item.commandId, event.currentTarget)}
            >
              {t(`kcalc.${item.label.toLowerCase()}` as TranslationKey)}<span className="kcalc-menu-shortcut">{item.shortcut}</span>
            </button>
          ))}
        </>
      ) : null}
      {activeMenu === "constants" ? (
        <>
          {kcalcBuiltInConstantCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="menuitem"
              className="kcalc-menu-popup__submenu-trigger"
              data-kcalc-constant-category={category.id}
              aria-haspopup="menu"
              aria-expanded={constantCatalogSubmenuRequest?.owner === "top-menu" && constantCatalogSubmenuRequest.categoryId === category.id}
              onPointerEnter={(event) => openConstantCatalogCategory(category.id, event)}
              onClick={(event) => openConstantCatalogCategory(category.id, event)}
            >
              <span>{t(kcalcConstantCategoryKeys[category.id])}</span><span className="kcalc-menu-popup__submenu-arrow" aria-hidden="true">&#9654;</span>
            </button>
          ))}
        </>
      ) : null}
      {activeMenu === "settings" ? (
        <>
          {kcalcOptionalPanelMenuItems.map((item) => (
            <button
              key={item.panel}
              type="button"
              role="menuitemcheckbox"
              aria-checked={optionalPanels[item.panel]}
              onClick={() => toggleOptionalPanel(item.panel)}
            >
              <span className="kcalc-menu-check" aria-hidden="true">{optionalPanels[item.panel] ? "✓" : ""}</span>
              {t(kcalcOptionalPanelMenuKeys[item.panel])}
            </button>
          ))}
          <div className="kcalc-menu-separator" role="separator" />
          <button type="button" role="menuitem" onClick={showAllOptionalPanels}>{t("kcalc.showAll")}</button>
          <button type="button" role="menuitem" onClick={hideAllOptionalPanels}>{t("kcalc.hideAll")}</button>
          <div className="kcalc-menu-separator" role="separator" />
          <button type="button" role="menuitem" disabled>{t("kcalc.configureShortcuts")}</button>
          <button type="button" role="menuitem" onClick={openConfigureConstants}>{t("kcalc.configure")}</button>
        </>
      ) : null}
      {activeMenu === "help" ? (
        <>
          <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kcalc"); setOpenPopup(null); }}>{t("kcalc.aboutKcalc")}</button>
          <button type="button" role="menuitem" onClick={() => { launcher?.launchApplication("about-kde"); setOpenPopup(null); }}>{t("kcalc.aboutKde")}</button>
        </>
      ) : null}
    </div>
  ) : (
    <div
      ref={menuPopupRef}
      className="kcalc-menu-popup kcalc-angle-menu"
      role="menu"
      aria-label={t("kcalc.angleMenu")}
      data-menu-request-id={popupRequest.requestId}
      data-window-id={windowId}
      data-positioned={isMenuPopupPositioned}
      style={menuPopupPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {kcalcAngleMenuItems.map(({ unit }) => (
        <button
          key={unit}
          type="button"
          role="menuitemradio"
          aria-checked={mode.angleUnit === unit}
          onClick={() => selectAngleUnit(unit)}
        >
          <span className="kcalc-menu-check" aria-hidden="true">{mode.angleUnit === unit ? "✓" : ""}</span>
          {t(`kcalc.angle.${unit}` as TranslationKey)}
        </button>
      ))}
    </div>
  );
  const activeConstantCategory = constantCatalogSubmenuRequest === null
    ? null
    : kcalcBuiltInConstantCategories.find((category) => category.id === constantCatalogSubmenuRequest.categoryId) ?? null;
  const constantCatalogPopup = constantCatalogRequest === null ? null : (
    <div
      ref={constantCatalogRef}
      className="kcalc-menu-popup kcalc-constants-catalog-menu"
      role="menu"
      aria-label={t("kcalc.constantsCatalog")}
      data-window-id={windowId}
      data-menu-request-id={constantCatalogRequest.requestId}
      data-positioned={isConstantCatalogPositioned}
      style={constantCatalogPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {kcalcBuiltInConstantCategories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="menuitem"
          className="kcalc-menu-popup__submenu-trigger"
          data-kcalc-constant-category={category.id}
          aria-haspopup="menu"
          aria-expanded={constantCatalogSubmenuRequest?.categoryId === category.id}
          onPointerEnter={(event) => openConstantCatalogCategory(category.id, event)}
          onClick={(event) => openConstantCatalogCategory(category.id, event)}
        >
          <span>{t(kcalcConstantCategoryKeys[category.id])}</span><span className="kcalc-menu-popup__submenu-arrow" aria-hidden="true">&#9654;</span>
        </button>
      ))}
    </div>
  );
  const constantCatalogSubmenu = activeConstantCategory === null ? null : (
    <div
      ref={constantCatalogSubmenuRef}
      className="kcalc-menu-popup kcalc-constants-catalog-submenu"
      role="menu"
      aria-label={t("kcalc.categoryConstants", { category: t(kcalcConstantCategoryKeys[activeConstantCategory.id]) })}
      data-window-id={windowId}
      data-menu-request-id={constantCatalogSubmenuRequest?.requestId}
      data-positioned={isConstantCatalogSubmenuPositioned}
      style={constantCatalogSubmenuPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      {activeConstantCategory.constants.map((constant) => (
        <button key={constant.id} type="button" role="menuitem" data-kcalc-built-in-constant={constant.id} onClick={() => selectBuiltInConstant(constant)}>
          {constant.label}
        </button>
      ))}
    </div>
  );
  const constantContextPopup = constantContextRequest === null ? null : (
    <div
      ref={constantContextMenuRef}
      className="kcalc-menu-popup kcalc-constants-context-menu"
      role="menu"
      aria-label={t("kcalc.constantMenu", { slot: constantContextRequest.slotId })}
      data-window-id={windowId}
      data-menu-request-id={constantContextRequest.requestId}
      data-positioned={isConstantContextPositioned}
      style={constantContextPosition ?? { visibility: "hidden", pointerEvents: "none" }}
    >
      <button type="button" role="menuitem" onClick={openConstantNameDialog}>{t("kcalc.setName")}</button>
      <button
        type="button"
        role="menuitem"
        className="kcalc-menu-popup__submenu-trigger"
        aria-haspopup="menu"
        aria-expanded={constantCatalogRequest?.owner === "context-menu"}
        onPointerEnter={(event) => openConstantCatalog("context-menu", event, constantContextRequest.slotId)}
        onClick={(event) => openConstantCatalog("context-menu", event, constantContextRequest.slotId)}
      >
        <span>{t("kcalc.chooseFromList")}</span><span className="kcalc-menu-popup__submenu-arrow" aria-hidden="true">&#9654;</span>
      </button>
    </div>
  );
  const constantNameDialogPopup = constantNameDialog === null ? null : (
    <div className="kcalc-constants-dialog-backdrop">
      <section className="kcalc-constants-dialog kcalc-constants-name-dialog" role="dialog" aria-modal="true" aria-label={t("kcalc.newConstantName")}>
        <h2>{t("kcalc.newConstantName")}</h2>
        <label>{t("kcalc.newName")}<input value={constantNameDialog.value} maxLength={6} onChange={(event) => setConstantNameDialog({ ...constantNameDialog, value: event.currentTarget.value })} /></label>
        {constantNameDialog.value.trim().length === 0 ? <p className="kcalc-constants-dialog__error" role="alert">{t("kcalc.nameRequired")}</p> : null}
        <div className="kcalc-constants-dialog__actions">
          <button type="button" className="kde-raised" disabled={constantNameDialog.value.trim().length === 0} onClick={confirmConstantName}>{t("common.ok")}</button>
          <button type="button" className="kde-raised" onClick={() => setConstantNameDialog(null)}>{t("common.cancel")}</button>
        </div>
      </section>
    </div>
  );
  const configureConstantsDialog = !isConfigureConstantsVisible || configurationDraft === null ? null : (
    <div className="kcalc-constants-dialog-backdrop">
      <section className="kcalc-constants-dialog" role="dialog" aria-modal="true" aria-label={t("kcalc.configureConstants")}>
        <h2>{t("kcalc.configureConstants")}</h2>
        <div className="kcalc-constants-dialog__rows">
          {configurationDraft.map((slot) => (
            <div key={slot.id} className="kcalc-constants-dialog__row" data-kcalc-constant-config-slot={slot.id}>
              <strong>{slot.id.replace("constant-", "C")}</strong>
              <label>{t("kcalc.newName")}<input value={slot.name} maxLength={6} onChange={(event) => updateConfigurationName(slot.id, event)} /></label>
              <label>{t("kcalc.value")}<input value={configurationValueText?.[slot.id] ?? formatKCalcConstantValue(slot.value)} maxLength={40} onChange={(event) => updateConfigurationValue(slot.id, event)} /></label>
              <button type="button" className="kde-raised" onClick={(event) => openConstantCatalog("configuration", event, slot.id)}>{t("kcalc.predefined")}</button>
            </div>
          ))}
        </div>
        {!isConfigurationDraftValid(configurationDraft) ? <p className="kcalc-constants-dialog__error" role="alert">{t("kcalc.invalidConstants")}</p> : null}
        <div className="kcalc-constants-dialog__actions">
          <button type="button" className="kde-raised" disabled={!isConfigurationDraftValid(configurationDraft)} onClick={applyConfigurationDraft}>{t("common.apply")}</button>
          <button type="button" className="kde-raised" disabled={!isConfigurationDraftValid(configurationDraft)} onClick={() => { applyConfigurationDraft(); setIsConfigureConstantsVisible(false); setConfigurationDraft(null); setConfigurationValueText(null); }}>{t("common.ok")}</button>
          <button type="button" className="kde-raised" onClick={() => { setIsConfigureConstantsVisible(false); setConfigurationDraft(null); setConfigurationValueText(null); closeConstantPopups(); }}>{t("common.cancel")}</button>
        </div>
      </section>
    </div>
  );

  return (
    <div
      className="kcalc-app"
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-kcalc-root="true"
      data-window-id={windowId}
    >
      <nav ref={menuBarRef} className={`${APPLICATION_MENUBAR_CLASS} kcalc-menubar kde-chrome-surface`} aria-label={t("kcalc.menuBar")}>
        <div className="kcalc-menu-root">
          <button
            type="button"
            className={`kcalc-menuitem${activeMenu === "file" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "file"}
            onClick={(event) => togglePopup("file", event)}
          >
            {t("kcalc.file")}
          </button>
        </div>
        <div className="kcalc-menu-root">
          <button
            type="button"
            className={`kcalc-menuitem${activeMenu === "edit" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "edit"}
            onClick={(event) => togglePopup("edit", event)}
          >
            {t("kcalc.edit")}
          </button>
        </div>
        <div className="kcalc-menu-root">
          <button
            type="button"
            className={`kcalc-menuitem${activeMenu === "constants" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "constants"}
            onClick={(event) => togglePopup("constants", event)}
          >
            {t("kcalc.constants")}
          </button>
        </div>
        <div className="kcalc-menu-root">
          <button
            type="button"
            className={`kcalc-menuitem${activeMenu === "settings" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "settings"}
            onClick={(event) => togglePopup("settings", event)}
          >
            {t("kcalc.settings")}
          </button>
        </div>
        <div className="kcalc-menu-root">
          <button
            type="button"
            className={`kcalc-menuitem${activeMenu === "help" ? " is-active" : ""}`}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "help"}
            onClick={(event) => togglePopup("help", event)}
          >
            {t("kcalc.help")}
          </button>
        </div>
      </nav>
      {popup || constantCatalogPopup || constantCatalogSubmenu || constantContextPopup || constantNameDialogPopup || configureConstantsDialog ? (
        <WindowOwnedPopupPortal>
          {popup}
          {constantCatalogPopup}
          {constantCatalogSubmenu}
          {constantContextPopup}
          {constantNameDialogPopup}
          {configureConstantsDialog}
        </WindowOwnedPopupPortal>
      ) : null}
      <main className="kcalc-main" aria-label={t("kcalc.calculator")}>
        <div className="kcalc-control-cluster">
          <div className="kcalc-top-control-band" data-kcalc-layout="top-control-band">
            {optionalPanels.scienceEngineering ? (
              <button
                type="button"
                className={`kde-raised kcalc-auxiliary-selector${openPopup?.popup === "angle" ? " is-active" : ""}`}
                aria-label={t("kcalc.angleSelector")}
                aria-haspopup="menu"
                aria-expanded={openPopup?.popup === "angle"}
                onClick={(event) => togglePopup("angle", event)}
              >
                {t("kcalc.angle")}
              </button>
            ) : null}
            {optionalPanels.logic ? <KCalcBaseSelector numberBase={mode.numberBase} onSelectNumberBase={selectNumberBase} /> : null}
            <button
              type="button"
              className={`kde-raised kcalc-key kcalc-key--inverse${mode.inverse ? " is-active" : ""}`}
              aria-pressed={mode.inverse}
              onClick={() => setMode((current) => toggleKCalcInverse(current))}
            >
              Inv
            </button>
            <div className="kcalc-display-panel">
              <span className="kcalc-display-mode" aria-label={`${kcalcDisplayBaseLabels[mode.numberBase]} ${t("kcalc.calculationMode").toLocaleLowerCase()}`}>
                {kcalcDisplayBaseLabels[mode.numberBase]}
              </span>
              <input
                className="kcalc-display"
                aria-label={t("kcalc.display")}
                aria-description={t("kcalc.copyDisplay")}
                aria-live="polite"
                readOnly
                tabIndex={-1}
                title={t("kcalc.copyDisplay")}
                value={calculator.display}
                onClick={handleDisplayClick}
              />
            </div>
          </div>
          <div className="kcalc-button-bank" data-kcalc-layout="button-bank">
            {optionalPanels.statistics ? (
              <KCalcOptionalPanelColumn
                panel="statistics"
                label={t(kcalcOptionalPanelKeys.statistics)}
                slots={kcalcStatisticsCommandSlots}
                resolveCommand={(slot) => resolveKCalcCommandSurface(slot, mode.inverse, isCommandEnabled)}
                onCommand={handleCommandClick}
              />
            ) : null}
            {optionalPanels.scienceEngineering ? (
              <KCalcOptionalPanelColumn
                panel="science"
                label={t(kcalcOptionalPanelKeys.scienceEngineering)}
                slots={kcalcScienceCommandSlots}
                resolveCommand={(slot) => resolveKCalcScienceCommandSurface(slot, mode, isCommandEnabled)}
                getSlotToggleState={(slot) => getKCalcScienceSlotToggleState(slot, mode)}
                onCommand={handleCommandClick}
              />
            ) : null}
            {optionalPanels.logic ? (
              <KCalcOptionalPanelColumn
                panel="logic-operations"
                label={t(kcalcOptionalPanelKeys.logic)}
                slots={kcalcLogicCommandSlots}
                resolveCommand={(slot) => resolveKCalcCommandSurface(slot, mode.inverse, isCommandEnabled)}
                onCommand={handleCommandClick}
              />
            ) : null}
            <section
              className="kcalc-base-scientific-column"
              aria-label={t("kcalc.baseScientificButtons")}
              data-kcalc-layout-module="base-scientific"
              data-kcalc-row-count="6"
              data-kcalc-button-bank-height="shared"
            >
              {kcalcBaseScientificCommandSlots.map((slot) => {
                const command = resolveKCalcCommandSurface(slot, mode.inverse, isCommandEnabled);

                return (
                  <button
                    key={slot.slotId}
                    type="button"
                    className={`kde-raised kcalc-key${slot.slotId === "base-power" ? " kcalc-key--power" : ""}`}
                    data-kcalc-command-slot={slot.slotId}
                    data-kcalc-command-id={command.commandId}
                    aria-label={getKCalcCommandAriaLabel(command, t)}
                    disabled={!command.enabled}
                    onClick={command.enabled ? (event) => handleCommandClick(event, command) : undefined}
                  >
                    <KCalcCommandLabelPresentation label={command.label} />
                  </button>
                );
              })}
            </section>
            {optionalPanels.logic ? (
              <KCalcRadixDigitPanel
                numberBase={mode.numberBase}
                onDigit={(event, digit) => handleKeypadClick(event, {
                  type: "digit",
                  digit,
                  numberBase: mode.numberBase,
                })}
              />
            ) : null}
            {optionalPanels.constants ? (
              <KCalcOptionalPanelColumn
                panel="constants"
                label={t(kcalcOptionalPanelKeys.constants)}
                slots={kcalcConstantsCommandSlots}
                resolveCommand={(slot) => {
                  const command = resolveKCalcCommandSurface(slot, mode.inverse, isCommandEnabled);
                  const slotId = getKCalcConstantSlotIdForCommand(command.commandId);

                  return slotId === null || !isKCalcConstantRecallCommand(command.commandId)
                    ? command
                    : {
                      ...command,
                      label: { kind: "text" as const, text: getKCalcConstantSlot(constants, slotId).name },
                      ariaLabel: `Recall constant ${getKCalcConstantSlot(constants, slotId).name}`,
                    };
                }}
                getCommandTitle={(slot, command) => {
                  const slotId = getKCalcConstantSlotIdForCommand(command.commandId);
                  return slotId === null || !isKCalcConstantRecallCommand(command.commandId)
                    ? undefined
                    : `${getKCalcConstantSlot(constants, slotId).name}=${formatKCalcConstantValue(getKCalcConstantSlot(constants, slotId).value)}`;
                }}
                onCommand={handleCommandClick}
                onSlotContextMenu={(event, slot) => openConstantContextMenu(event, slot.slotId as KCalcConstantSlotId)}
              />
            ) : null}
            <section
              className="kcalc-core-keypad"
              aria-label={t("kcalc.keypad")}
              data-kcalc-layout-module="core-calculator"
              data-kcalc-row-count="5"
              data-kcalc-button-bank-height="shared"
            >
              {coreKeypad.map((key) => {
                const command = key.commandSlot === undefined ? undefined : resolveKCalcCommandSurface(key.commandSlot, mode.inverse, isCommandEnabled);
                const action = command === undefined
                  ? key.action === undefined ? undefined : withKCalcNumberBase(key.action, mode.numberBase)
                  : getCalculatorActionForCommand(command.commandId, {
                    angleUnit: mode.angleUnit,
                    numberBase: mode.numberBase,
                  });
                const enabled = command === undefined
                  ? !key.disabled && isKCalcKeyActionEnabledForBase(calculator, key.action, mode.numberBase)
                  : command.enabled;

                return (
                  <button
                    key={key.commandSlot?.slotId ?? key.label}
                    type="button"
                    className={`kde-raised kcalc-key${key.className ? ` ${key.className}` : ""}`}
                    data-kcalc-command-slot={key.commandSlot?.slotId}
                    data-kcalc-command-id={command?.commandId}
                    aria-label={command === undefined ? getKCalcCoreAriaLabel(key.ariaLabel ?? key.label ?? "", t) : getKCalcCommandAriaLabel(command, t)}
                    disabled={!enabled}
                    onClick={action && enabled ? (event) => command === undefined ? handleKeypadClick(event, action) : handleCommandClick(event, command) : undefined}
                  >
                    {command === undefined ? key.label : <KCalcCommandLabelPresentation label={command.label} />}
                  </button>
                );
              })}
            </section>
          </div>
          <div className="kcalc-status-strip" aria-label={t("kcalc.status")} data-kcalc-layout="status-strip">
            <span className="kcalc-status-cell kcalc-status-cell--mode" data-kcalc-status-slot="mode" aria-label={t("kcalc.calculationMode")}>{statusIndicators.mode}</span>
            <span className="kcalc-status-cell kcalc-status-cell--memory" data-kcalc-status-slot="memory" aria-label={t("kcalc.memoryStatus")}>{statusIndicators.memory}</span>
            <span className="kcalc-status-cell kcalc-status-cell--angle" data-kcalc-status-slot="angle" aria-label={t("kcalc.angleMode")}>{statusIndicators.angle}</span>
            <span className="kcalc-status-cell kcalc-status-cell--base" data-kcalc-status-slot="base" aria-label={t("kcalc.numberBase")}>{statusIndicators.base}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
