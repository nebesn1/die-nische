export type KMenuEntry =
  | KMenuApplicationEntry
  | KMenuSubmenuEntry
  | KMenuCommandEntry
  | KMenuSectionEntry
  | KMenuSeparatorEntry;

export interface KMenuApplicationEntry {
  type: "application";
  id: string;
  label: string;
  iconId: string;
  appId: string;
  enabled: boolean;
  newInstance?: boolean;
  launchIntent?: unknown;
  disabledReason?: string;
}

export interface KMenuSubmenuEntry {
  type: "submenu";
  id: string;
  label: string;
  iconId: string;
  enabled: boolean;
  children: readonly KMenuEntry[];
  disabledReason?: string;
}

export interface KMenuCommandEntry {
  type: "command";
  id: string;
  label: string;
  iconId: string;
  commandId: string;
  enabled: boolean;
  disabledReason?: string;
  payload?: unknown;
}

/** Non-interactive historical K Menu group label. */
export interface KMenuSectionEntry {
  type: "section";
  id: string;
  label: string;
}

export interface KMenuSeparatorEntry {
  type: "separator";
  id: string;
}

export type KMenuExecutableEntry = KMenuApplicationEntry | KMenuSubmenuEntry | KMenuCommandEntry;

export interface KMenuState {
  isOpen: boolean;
  activeItemId: string | null;
  openSubmenuId: string | null;
}

export type KMenuSubmenu = Extract<KMenuEntry, { type: "submenu" }>;
