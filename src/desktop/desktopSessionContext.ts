import { createContext } from "react";

export type EndSessionDialogState = "closed" | "options" | "confirm" | "logout";

export type DesktopSessionContextValue = {
  readonly isLocked: boolean;
  readonly endSessionDialog: EndSessionDialogState;
  readonly isClipboardOpen: boolean;
  readonly clipboardHistory: readonly string[];
  readonly currentClipboardText: string | null;
  readonly hasClipboardText: boolean;
  readonly clipboardStatus: string | null;
  readonly selectionCaptureGeneration: number;
  readonly resetGeneration: number;
  lockSession(): void;
  unlockSession(): void;
  openEndSession(): void;
  openLogout?(): void;
  requestEndSession(): void;
  returnToEndSessionOptions(): void;
  closeEndSession(): void;
  confirmEndSession(): void;
  toggleClipboard(): void;
  closeClipboard(): void;
  recordClipboardText(text: string): void;
  readClipboardText(): string | null;
  writeClipboard(text: string): Promise<void>;
  clearClipboardHistory(): void;
};

export const DesktopSessionContext = createContext<DesktopSessionContextValue | null>(null);
