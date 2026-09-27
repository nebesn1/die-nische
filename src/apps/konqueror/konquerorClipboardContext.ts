import { createContext, type Dispatch } from "react";
import type { KonquerorClipboardAction, KonquerorClipboardState } from "./clipboardTypes";

export type KonquerorClipboardContextValue = {
  readonly state: KonquerorClipboardState;
  readonly dispatch: Dispatch<KonquerorClipboardAction>;
};

export const KonquerorClipboardContext = createContext<KonquerorClipboardContextValue | null>(null);
