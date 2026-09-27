export type DesktopIconAction =
  | {
      type: "launch-application";
      appId: string;
      intent?: unknown;
      newInstance?: boolean;
    }
  | {
      type: "placeholder";
      disabledReason: string;
    };

export interface DesktopIconDefinition {
  id: string;
  label: string;
  labelLines?: readonly string[];
  iconId: string;
  action: DesktopIconAction;
  initialColumn: number;
  initialRow: number;
}

export interface DesktopIconSelectionState {
  selectedIconId: string | null;
  selectedIconIds: readonly string[];
}
