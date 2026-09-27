import type { VfsError } from "../../vfs/errors";
import type { VfsDirectoryNode, VfsFileNode, VfsNode, VfsNodeId } from "../../vfs/types";
import type { KonquerorPreviewerId } from "./previewModel";
import type { KonquerorSelectedNodeIds } from "./selectionModel";
import type { KonquerorMarqueeSelectionMode } from "./marqueeSelection";

export const KONQUEROR_SYSINFO_LOCATION = "sysinfo:/";
export const KONQUEROR_ABOUT_LOCATION = "about:konqueror";
export const KONQUEROR_BLANK_LOCATION = "about:blank";

export type KonquerorAboutAddressPresentation = "blank" | "canonical";

export type KonquerorAboutLocationTarget = {
  readonly type: "about-konqueror";
  readonly addressPresentation: KonquerorAboutAddressPresentation;
};

export const createKonquerorAboutLocationTarget = (
  addressPresentation: KonquerorAboutAddressPresentation = "canonical",
): KonquerorAboutLocationTarget => ({ type: "about-konqueror", addressPresentation });

export type KonquerorBlankLocationTarget = {
  readonly type: "about-blank";
};

export const createKonquerorBlankLocationTarget = (): KonquerorBlankLocationTarget => ({ type: "about-blank" });

export type KonquerorExternalWebLocationTarget = {
  readonly type: "external-web";
  readonly canonicalUrl: string;
};

export type KonquerorLocationTarget =
  | { readonly type: "directory"; readonly nodeId: VfsNodeId }
  | { readonly type: "file"; readonly nodeId: VfsNodeId; readonly previewerId?: KonquerorPreviewerId }
  | { readonly type: "sysinfo" }
  | KonquerorAboutLocationTarget
  | KonquerorBlankLocationTarget
  | KonquerorExternalWebLocationTarget;

export interface KonquerorNavigationState {
  readonly historyTargets: readonly KonquerorLocationTarget[];
  readonly historyIndex: number;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly rangeAnchorNodeId: VfsNodeId | null;
  readonly locationDraft: string;
  readonly navigationError: VfsError | null;
}

export type KonquerorNavigationAction =
  | {
      readonly type: "set-location-draft";
      readonly locationDraft: string;
    }
  | {
      readonly type: "navigate-success";
      readonly target: KonquerorLocationTarget;
      readonly path: string;
    }
  | {
      readonly type: "navigate-failure";
      readonly locationDraft: string;
      readonly error: VfsError;
    }
  | {
      readonly type: "go-back";
      readonly path: string;
    }
  | {
      readonly type: "go-forward";
      readonly path: string;
    }
  | {
      readonly type: "go-history";
      readonly historyIndex: number;
      readonly path: string;
    }
  | {
      readonly type: "replace-selection";
      readonly nodeId: VfsNodeId;
    }
  | {
      readonly type: "toggle-selection";
      readonly nodeId: VfsNodeId;
    }
  | {
      readonly type: "replace-selection-range";
      readonly visibleNodeIds: readonly VfsNodeId[];
      readonly targetNodeId: VfsNodeId;
    }
  | {
      readonly type: "add-selection-range";
      readonly visibleNodeIds: readonly VfsNodeId[];
      readonly targetNodeId: VfsNodeId;
    }
  | {
      readonly type: "commit-marquee-selection";
      readonly mode: KonquerorMarqueeSelectionMode;
      readonly baselineSelectedNodeIds: KonquerorSelectedNodeIds;
      readonly baselineRangeAnchorNodeId: VfsNodeId | null;
      readonly visibleNodeIds: readonly VfsNodeId[];
      readonly hitNodeIds: KonquerorSelectedNodeIds;
    }
  | {
      readonly type: "clear-selection";
    }
  | {
      readonly type: "retain-selection";
      readonly visibleNodeIds: readonly VfsNodeId[];
    }
  | {
      readonly type: "reset-location-draft";
      readonly path: string;
    }
  | {
      readonly type: "reload-success";
      readonly path: string;
    }
  | {
      readonly type: "mutation-success";
      readonly path: string;
      readonly selectedNodeIds: KonquerorSelectedNodeIds;
    }
  | {
      readonly type: "prune-deleted-history";
      readonly deletedNodeIds: readonly VfsNodeId[];
      readonly fallbackNodeId: VfsNodeId;
      readonly fallbackPath: string;
    };

export interface KonquerorResolvedLocation {
  readonly node: VfsDirectoryNode | VfsFileNode;
  readonly path: string;
}

export type KonquerorResolvedHistoryTarget =
  | {
      readonly target: { readonly type: "directory"; readonly nodeId: VfsNodeId };
      readonly path: string;
      readonly node: VfsNode & { readonly kind: "directory" };
    }
  | {
      readonly target: { readonly type: "file"; readonly nodeId: VfsNodeId; readonly previewerId?: KonquerorPreviewerId };
      readonly path: string;
      readonly node: VfsNode & { readonly kind: "file" };
    }
  | { readonly target: { readonly type: "sysinfo" }; readonly path: typeof KONQUEROR_SYSINFO_LOCATION }
  | { readonly target: KonquerorAboutLocationTarget; readonly path: typeof KONQUEROR_ABOUT_LOCATION }
  | { readonly target: KonquerorBlankLocationTarget; readonly path: typeof KONQUEROR_BLANK_LOCATION }
  | { readonly target: KonquerorExternalWebLocationTarget; readonly path: string };

export type KonquerorView =
  | {
      readonly type: "directory";
      readonly node: VfsNode & { readonly kind: "directory" };
      readonly path: string;
      readonly children: readonly VfsNode[];
    }
  | {
      readonly type: "file";
      readonly node: VfsNode & { readonly kind: "file" };
      readonly path: string;
    }
  | {
      readonly type: "sysinfo";
      readonly path: typeof KONQUEROR_SYSINFO_LOCATION;
    }
  | {
      readonly type: "about-konqueror";
      readonly path: typeof KONQUEROR_ABOUT_LOCATION;
    }
  | {
      readonly type: "about-blank";
      readonly path: typeof KONQUEROR_BLANK_LOCATION;
    }
  | {
      readonly type: "external-web";
      readonly canonicalUrl: string;
      readonly path: string;
    }
  | {
      readonly type: "file-unavailable";
      readonly nodeId: VfsNodeId;
    }
  | {
      readonly type: "error";
      readonly error: VfsError;
    };
