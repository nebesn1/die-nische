export type KCalcOptionalPanel = "scienceEngineering" | "statistics" | "logic" | "constants";

export type KCalcOptionalPanels = Readonly<Record<KCalcOptionalPanel, boolean>>;

export const initialKCalcOptionalPanels: KCalcOptionalPanels = Object.freeze({
  scienceEngineering: false,
  statistics: false,
  logic: false,
  constants: false,
});

export const kcalcOptionalPanelMenuItems = Object.freeze([
  { panel: "scienceEngineering", label: "Science/Engineering Buttons" },
  { panel: "statistics", label: "Statistic Buttons" },
  { panel: "logic", label: "Logic Buttons" },
  { panel: "constants", label: "Constants Buttons" },
] as const satisfies readonly { readonly panel: KCalcOptionalPanel; readonly label: string }[]);

export function toggleKCalcOptionalPanel(
  panels: KCalcOptionalPanels,
  panel: KCalcOptionalPanel,
): KCalcOptionalPanels {
  return { ...panels, [panel]: !panels[panel] };
}

export function showAllKCalcOptionalPanels(): KCalcOptionalPanels {
  return {
    scienceEngineering: true,
    statistics: true,
    logic: true,
    constants: true,
  };
}

export function hideAllKCalcOptionalPanels(): KCalcOptionalPanels {
  return initialKCalcOptionalPanels;
}
