import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type Ref, type RefObject } from "react";
import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { KonquerorNodeIcon } from "./icons";
import { getKonquerorNodeIconId } from "./nodePresentation";
import type { KonquerorResourceZoomLevel } from "./directoryViewModel";
import {
  getSingleKonquerorSelectedNodeId,
  getKonquerorSelectionPointerIntent,
  isKonquerorNodeSelected,
  type KonquerorSelectionPointerIntent,
  type KonquerorSelectedNodeIds,
} from "./selectionModel";
import { useKonquerorDirectoryMarquee, type KonquerorMarqueeSelectionMode } from "./useKonquerorDirectoryMarquee";
import type { KonquerorDragOperationPlan } from "./dragDropController";
import { useKonquerorItemDrag } from "./useKonquerorItemDrag";
import { useOptionalKonquerorDragDrop } from "./KonquerorDragDropContext";
import { useI18n } from "../../i18n/useI18n";
import type { WindowLayoutMode } from "../../window-manager/types";
import { useKonquerorTouchResourceInteraction } from "./useKonquerorTouchResourceInteraction";

type KonquerorIconViewProps = {
  readonly childrenNodes: readonly VfsNode[];
  readonly windowId?: string;
  readonly currentDirectoryNodeId?: VfsNodeId | null;
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly rangeAnchorNodeId?: VfsNodeId | null;
  readonly cutNodeIds?: readonly VfsNodeId[];
  readonly isTrashRoot?: boolean;
  readonly vfsState: VfsState;
  readonly zoomLevel?: KonquerorResourceZoomLevel;
  readonly onSelectNode: (nodeId: VfsNodeId, intent: KonquerorSelectionPointerIntent) => void;
  readonly onClearSelection: () => void;
  readonly onCommitMarquee?: (
    mode: KonquerorMarqueeSelectionMode,
    baselineSelectedNodeIds: KonquerorSelectedNodeIds,
    baselineRangeAnchorNodeId: VfsNodeId | null,
    visibleNodeIds: readonly VfsNodeId[],
    hitNodeIds: KonquerorSelectedNodeIds,
  ) => void;
  readonly onOpenNode: (nodeId: VfsNodeId) => void;
  readonly onMoveSelection: (direction: "previous" | "next") => void;
  readonly onOpenItemContextMenu?: (nodeId: VfsNodeId, clientX: number, clientY: number) => void;
  readonly onOpenBackgroundContextMenu?: (clientX: number, clientY: number) => void;
  readonly canAcceptDropTarget?: (nodeId: VfsNodeId) => boolean;
  readonly onActivateItemDrag?: (rawDraggedNodeIds: readonly VfsNodeId[]) => KonquerorDragOperationPlan | null;
  readonly onDropItemDrag?: (plan: KonquerorDragOperationPlan, targetFolderNodeId: VfsNodeId, clientX: number, clientY: number) => void;
  readonly keyboardSurfaceRef?: Ref<HTMLDivElement>;
  readonly marqueeViewportRef?: RefObject<HTMLDivElement | null>;
  readonly layoutMode?: WindowLayoutMode;
};

export function KonquerorIconView({
  childrenNodes,
  windowId = "konqueror-unmanaged",
  currentDirectoryNodeId = null,
  cutNodeIds = [],
  isTrashRoot = false,
  marqueeViewportRef,
  onClearSelection,
  onCommitMarquee = () => undefined,
  onMoveSelection,
  onOpenBackgroundContextMenu = () => undefined,
  canAcceptDropTarget = () => false,
  onActivateItemDrag = () => null,
  onDropItemDrag = () => undefined,
  onOpenItemContextMenu = () => undefined,
  onOpenNode,
  onSelectNode,
  selectedNodeIds,
  rangeAnchorNodeId = null,
  vfsState,
  zoomLevel = "normal",
  keyboardSurfaceRef,
  layoutMode = "desktop",
}: KonquerorIconViewProps) {
  const { t } = useI18n();
  const sharedDragDrop = useOptionalKonquerorDragDrop();
  const registerDragSurface = sharedDragDrop?.registerSurface;
  const resourceSurfaceRef = useRef<HTMLDivElement | null>(null);
  const fallbackViewportRef = useRef<HTMLElement | null>(null);
  const canAcceptDropTargetRef = useRef(canAcceptDropTarget);
  const setResourceSurfaceRef = useCallback((element: HTMLDivElement | null) => {
    resourceSurfaceRef.current = element;
    if (typeof keyboardSurfaceRef === "function") keyboardSurfaceRef(element);
    else if (keyboardSurfaceRef) keyboardSurfaceRef.current = element;
  }, [keyboardSurfaceRef]);
  const visibleNodeIds = childrenNodes.map((node) => node.id);
  useEffect(() => {
    canAcceptDropTargetRef.current = canAcceptDropTarget;
  }, [canAcceptDropTarget]);
  const marquee = useKonquerorDirectoryMarquee({
    visibleNodeIds,
    selectedNodeIds,
    rangeAnchorNodeId,
    viewportRef: marqueeViewportRef,
    onClearSelection,
    onCommitMarquee,
  });
  const itemDrag = useKonquerorItemDrag({
    visibleNodeIds,
    windowId,
    selectedNodeIds,
    getDragSourceLabel: (nodeId) => childrenNodes.find((node) => node.id === nodeId)?.name ?? "item",
    canAcceptDropTarget,
    onReplaceSelection: (nodeId) => onSelectNode(nodeId, "replace"),
    onActivateDrag: onActivateItemDrag,
    onDrop: onDropItemDrag,
  });
  const touchInteraction = useKonquerorTouchResourceInteraction({
    enabled: layoutMode === "mobile",
    selectedNodeIds: marquee.effectiveSelectedNodeIds,
    onSelectNode,
    onOpenNode,
    onOpenItemContextMenu,
    onOpenBackgroundContextMenu,
  });
  useEffect(() => {
    if (!registerDragSurface || windowId === "konqueror-unmanaged") return;
    return registerDragSurface({
      windowId,
      viewMode: "icons",
      currentDirectoryNodeId,
      surfaceRef: resourceSurfaceRef,
      viewportRef: marqueeViewportRef ?? fallbackViewportRef,
      canAcceptDropTarget: (nodeId) => canAcceptDropTargetRef.current(nodeId),
    });
  }, [currentDirectoryNodeId, marqueeViewportRef, registerDragSurface, windowId]);
  const marqueeStyle = marquee.marqueeRect === null
    ? null
    : {
        left: marquee.marqueeRect.left,
        top: marquee.marqueeRect.top,
        width: marquee.marqueeRect.width,
        height: marquee.marqueeRect.height,
      };
  const handleBackgroundContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onOpenBackgroundContextMenu(event.clientX, event.clientY);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      marquee.cancelMarquee();
      onClearSelection();
      return;
    }

    const selectedNodeId = getSingleKonquerorSelectedNodeId(selectedNodeIds);
    if (event.key === "Enter" && selectedNodeId) {
      event.preventDefault();
      onOpenNode(selectedNodeId);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onMoveSelection("next");
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onMoveSelection("previous");
    }
  };

  if (childrenNodes.length === 0) {
    return (
      <div
        ref={setResourceSurfaceRef}
        className={`konqueror-icon-view${marquee.isMarqueeActive ? " is-marquee-active" : ""}${itemDrag.isDropTargetBackground ? " is-drop-target-background" : ""}`}
        data-resource-view="icons"
        data-konqueror-window-id={windowId}
        data-resource-zoom={zoomLevel}
        role="listbox"
        tabIndex={-1}
        aria-label={t("konqueror.view.iconContents")}
        onClick={(event) => { if (!touchInteraction.consumeClick(event)) marquee.handleBackgroundClick(event); }}
        onPointerDown={(event) => { touchInteraction.onPointerDown(event); marquee.handleBackgroundPointerDown(event); }}
        onPointerMove={(event) => { touchInteraction.onPointerMove(event); marquee.handleBackgroundPointerMove(event); }}
        onPointerUp={(event) => { touchInteraction.onPointerUp(event); marquee.handleBackgroundPointerUp(event); }}
        onPointerCancel={(event) => { touchInteraction.onPointerCancel(event); marquee.handleBackgroundPointerCancel(event); }}
        onLostPointerCapture={(event) => { touchInteraction.onLostPointerCapture(event); marquee.handleBackgroundLostPointerCapture(event); }}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => { if (!touchInteraction.consumeNativeContextMenu()) handleBackgroundContextMenu(event); }}
      >
        <div className="konqueror-empty-folder">{isTrashRoot ? t("konqueror.view.emptyTrash") : t("konqueror.view.emptyFolder")}</div>
        {marqueeStyle ? <div className="konqueror-selection-marquee" aria-hidden="true" style={marqueeStyle} /> : null}
      </div>
    );
  }

  return (
    <div
      ref={setResourceSurfaceRef}
      className={`konqueror-icon-view${marquee.isMarqueeActive ? " is-marquee-active" : ""}${itemDrag.isDropTargetBackground ? " is-drop-target-background" : ""}`}
      data-resource-view="icons"
      data-konqueror-window-id={windowId}
      data-resource-zoom={zoomLevel}
      role="listbox"
      tabIndex={-1}
      aria-label={t("konqueror.view.iconContents")}
      onClick={(event) => { if (!touchInteraction.consumeClick(event)) marquee.handleBackgroundClick(event); }}
      onPointerDown={(event) => { touchInteraction.onPointerDown(event); marquee.handleBackgroundPointerDown(event); }}
      onPointerMove={(event) => { touchInteraction.onPointerMove(event); marquee.handleBackgroundPointerMove(event); itemDrag.handlePointerMove(event); }}
      onPointerUp={(event) => { touchInteraction.onPointerUp(event); marquee.handleBackgroundPointerUp(event); itemDrag.handlePointerUp(event); }}
        onPointerCancel={(event) => { touchInteraction.onPointerCancel(event); marquee.handleBackgroundPointerCancel(event); itemDrag.handlePointerCancel(event); }}
      onLostPointerCapture={(event) => { touchInteraction.onLostPointerCapture(event); marquee.handleBackgroundLostPointerCapture(event); itemDrag.handleLostPointerCapture(event); }}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => { if (!touchInteraction.consumeNativeContextMenu()) handleBackgroundContextMenu(event); }}
    >
      {childrenNodes.map((node) => {
        const isSelected = isKonquerorNodeSelected(marquee.effectiveSelectedNodeIds, node.id);
        const isCutPending = cutNodeIds.includes(node.id);

        return (
          <button
            key={node.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-konqueror-node-id={node.id}
            data-cut-pending={isCutPending ? "true" : "false"}
            className={`konqueror-icon-item${isSelected ? " is-selected" : ""}${isCutPending ? " is-cut-pending" : ""}${itemDrag.dropTargetNodeId === node.id ? " is-drop-target" : ""}`}
            onPointerDown={(event) => itemDrag.handleItemPointerDown(node.id, event)}
            onClick={(event) => {
              if (touchInteraction.consumeClick(event)) {
                return;
              }
              if (itemDrag.consumeSuppressedClick(node.id)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              const intent = getKonquerorSelectionPointerIntent(event.button, event.ctrlKey, event.shiftKey);
              if (intent !== null) {
                onSelectNode(node.id, intent);
              }
            }}
            onDoubleClick={() => onOpenNode(node.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (touchInteraction.consumeNativeContextMenu()) {
                return;
              }
              onOpenItemContextMenu(node.id, event.clientX, event.clientY);
            }}
            onKeyDown={handleKeyDown as unknown as (event: KeyboardEvent<HTMLButtonElement>) => void}
          >
            <KonquerorNodeIcon
              className="konqueror-icon-item__icon"
              iconId={getKonquerorNodeIconId(node, vfsState)}
              aria-hidden="true"
              focusable="false"
            />
            <span className="konqueror-icon-item__label">{getVfsNodeDisplayName(node)}</span>
          </button>
        );
      })}
      {marqueeStyle ? <div className="konqueror-selection-marquee" aria-hidden="true" style={marqueeStyle} /> : null}
    </div>
  );
}
