import { createContext } from "react";
import type { VfsFileNode } from "../../vfs/types";
import type { KonquerorPreviewerId } from "./previewModel";

export type KonquerorPrintDocument =
  | { readonly kind: "about" }
  | { readonly kind: "file"; readonly file: VfsFileNode; readonly previewerId: KonquerorPreviewerId }
  | { readonly kind: "text"; readonly title: string; readonly content: string };

export type KonquerorPrintRequest = {
  readonly requestId: number;
  readonly windowId: string;
  readonly document: KonquerorPrintDocument;
};

export type KonquerorPrintContextValue = {
  readonly requestPrint: (windowId: string, document: KonquerorPrintDocument) => void;
};

export const KonquerorPrintContext = createContext<KonquerorPrintContextValue | null>(null);
