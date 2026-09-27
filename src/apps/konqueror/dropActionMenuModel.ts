import type { KonquerorDropAction } from "./dragDropController";

export type KonquerorDropActionMenuEntry = {
  readonly action: KonquerorDropAction;
  readonly label: string;
  readonly shortcut: string;
  readonly enabled: boolean;
};

/** Link uses the VFS identity-link batch authority and does not touch clipboard state. */
export const konquerorDropActionMenuEntries: readonly KonquerorDropActionMenuEntry[] = [
  { action: "move", label: "Move Here", shortcut: "Shift", enabled: true },
  { action: "copy", label: "Copy Here", shortcut: "Ctrl", enabled: true },
  { action: "link", label: "Link Here", shortcut: "Ctrl+Shift", enabled: true },
  { action: "cancel", label: "Cancel", shortcut: "Escape", enabled: true },
];
