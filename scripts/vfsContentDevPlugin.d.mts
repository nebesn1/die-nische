import type { Plugin } from "vite";

export type VfsContentDevPluginOptions = {
  readonly contentRoot?: string;
  readonly regenerate?: () => Promise<unknown>;
  readonly generateManifest?: (options: { readonly contentRoot: string }) => Promise<unknown>;
  readonly timestampReconciler?: { reconcile(): Promise<unknown> };
  readonly createTimestampReconciler?: (options: {
    readonly contentRoot: string;
    readonly logger: { info(message: string): void; error(message: string): void };
    readonly onMetadataWrite: (path: string) => void;
  }) => { reconcile(): Promise<unknown> };
  readonly debounceMs?: number;
  readonly logger?: {
    info(message: string): void;
    error(message: string): void;
  };
};

export declare function createVfsContentDevPlugin(options?: VfsContentDevPluginOptions): Plugin;
