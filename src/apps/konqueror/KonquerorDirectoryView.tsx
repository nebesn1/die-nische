import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type Ref, type RefObject } from "react";
import type { VfsNode, VfsNodeId, VfsState } from "../../vfs/types";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import { formatKonquerorNodeSize, formatVfsModifiedTime, getKonquerorNodeTypeLabel } from "./formatters";
import { KonquerorNodeIcon } from "./icons";
import { getKonquerorNodeIconId } from "./nodePresentation";
import {
  defaultKonquerorDirectoryViewState,
  type KonquerorSortDescriptor,
  type KonquerorSortKey,
  type KonquerorResourceZoomLevel,
} from "./directoryViewModel";
import {
  getSingleKonquerorSelectedNodeId,
  getKonquerorSelectionPointerIntent,
  isKonquerorNodeSelected,
  type KonquerorSelectionPointerIntent,
  type KonquerorSelectedNodeIds,
} from "./selectionModel";
import { useKonquerorDirectoryMarquee, type KonquerorMarqueeSelectionMode } from "./useKonquerorDirectoryMarquee";
import type { KonquerorVisibleTreeRow } from "./treeProjection";
import { getKonquerorTreePresentation } from "./treePresentation";
import type { KonquerorTreeHierarchyKey } from "./treeKeyboard";
import type { KonquerorDragOperationPlan } from "./dragDropController";
import { useKonquerorItemDrag } from "./useKonquerorItemDrag";
import { useOptionalKonquerorDragDrop } from "./KonquerorDragDropContext";
import { useI18n } from "../../i18n/useI18n";
import { translateKonquerorNodeTypeLabel } from "./konquerorI18n";
import type { WindowLayoutMode } from "../../window-manager/types";
import { useKonquerorTouchResourceInteraction } from "./useKonquerorTouchResourceInteraction";

type KonquerorDirectoryViewProps = {
  readonly childrenNodes: readonly VfsNode[];
  readonly windowId?: string;
  readonly currentDirectoryNodeId?: VfsNodeId | null;
  readonly treeRows?: readonly KonquerorVisibleTreeRow[];
  readonly selectedNodeIds: KonquerorSelectedNodeIds;
  readonly rangeAnchorNodeId?: VfsNodeId | null;
  readonly cutNodeIds?: readonly VfsNodeId[];
  readonly isTrashRoot?: boolean;
  readonly trashMetadataByNodeId?: Readonly<Record<VfsNodeId, { readonly originalLocation: string; readonly deleted: string }>>;
  readonly vfsState: VfsState;
  readonly sort?: KonquerorSortDescriptor;
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
  readonly onToggleTreeExpansion?: (nodeId: VfsNodeId) => void;
  readonly onTreeKeyboardAction?: (key: KonquerorTreeHierarchyKey) => void;
  readonly onSelectSortKey?: (key: KonquerorSortKey) => void;
  readonly onMoveSelection?: (direction: "previous" | "next") => void;
  readonly onOpenItemContextMenu?: (nodeId: VfsNodeId, clientX: number, clientY: number) => void;
  readonly onOpenBackgroundContextMenu?: (clientX: number, clientY: number) => void;
  readonly canAcceptDropTarget?: (nodeId: VfsNodeId) => boolean;
  readonly onActivateItemDrag?: (rawDraggedNodeIds: readonly VfsNodeId[]) => KonquerorDragOperationPlan | null;
  readonly onDropItemDrag?: (plan: KonquerorDragOperationPlan, targetFolderNodeId: VfsNodeId, clientX: number, clientY: number) => void;
  readonly keyboardSurfaceRef?: Ref<HTMLDivElement>;
  readonly marqueeViewportRef?: RefObject<HTMLDivElement | null>;
  readonly layoutMode?: WindowLayoutMode;
};

const SortHeader = ({ label, sort, sortKey, onSelectSortKey }: {
  readonly label: string;
  readonly sort: KonquerorSortDescriptor;
  readonly sortKey: KonquerorSortKey;
  readonly onSelectSortKey: (key: KonquerorSortKey) => void;
}) => {
  const isActive = sort.key === sortKey;
  const indicator = isActive ? (sort.direction === "ascending" ? " ▲" : " ▼") : "";

  return (
    <button
      type="button"
      className="konqueror-directory-header__button"
      aria-sort={isActive ? sort.direction : "none"}
      onClick={() => onSelectSortKey(sortKey)}
    >
      {label}{indicator}
    </button>
  );
};

const isKonquerorDirectoryItemContextMenuTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(".konqueror-directory-item-hit-target") !== null;

export function KonquerorDirectoryView({
  childrenNodes,
  windowId = "konqueror-unmanaged",
  currentDirectoryNodeId = null,
  treeRows,
  cutNodeIds = [],
  isTrashRoot = false,
  marqueeViewportRef,
  trashMetadataByNodeId = {},
  onClearSelection,
  onCommitMarquee = () => undefined,
  onMoveSelection = () => undefined,
  onOpenBackgroundContextMenu = () => undefined,
  canAcceptDropTarget = () => false,
  onActivateItemDrag = () => null,
  onDropItemDrag = () => undefined,
  onOpenItemContextMenu = () => undefined,
  onOpenNode,
  onToggleTreeExpansion = () => undefined,
  onTreeKeyboardAction = () => undefined,
  onSelectSortKey = () => undefined,
  onSelectNode,
  selectedNodeIds,
  rangeAnchorNodeId = null,
  sort = defaultKonquerorDirectoryViewState.sort,
  zoomLevel = "normal",
  vfsState,
  keyboardSurfaceRef,
  layoutMode = "desktop",
}: KonquerorDirectoryViewProps) {
  const { locale, t } = useI18n();
  const sharedDragDrop = useOptionalKonquerorDragDrop();
  const registerDragSurface = sharedDragDrop?.registerSurface;
  const resourceSurfaceRef = useRef<HTMLDivElement | null>(null);
  const fallbackViewportRef = useRef<HTMLElement | null>(null);
  const renderedRowsRef = useRef<readonly KonquerorVisibleTreeRow[]>([]);
  const canAcceptDropTargetRef = useRef(canAcceptDropTarget);
  const onToggleTreeExpansionRef = useRef(onToggleTreeExpansion);
  const setResourceSurfaceRef = useCallback((element: HTMLDivElement | null) => {
    resourceSurfaceRef.current = element;
    if (typeof keyboardSurfaceRef === "function") keyboardSurfaceRef(element);
    else if (keyboardSurfaceRef) keyboardSurfaceRef.current = element;
  }, [keyboardSurfaceRef]);
  const renderedRows = treeRows ?? childrenNodes.map((node, index) => ({
    nodeId: node.id,
    parentId: node.parentId ?? "",
    depth: 0,
    expandable: false,
    expanded: false,
    hasChildren: false,
    isLastSibling: index === childrenNodes.length - 1,
    ancestorContinuation: [],
  }));
  const visibleNodeIds = renderedRows.map((row) => row.nodeId);
  useEffect(() => {
    renderedRowsRef.current = renderedRows;
    canAcceptDropTargetRef.current = canAcceptDropTarget;
    onToggleTreeExpansionRef.current = onToggleTreeExpansion;
  }, [canAcceptDropTarget, onToggleTreeExpansion, renderedRows]);
  const marquee = useKonquerorDirectoryMarquee({
    visibleNodeIds,
    selectedNodeIds,
    rangeAnchorNodeId,
    marqueeHitTargetSelector: ".konqueror-tree-label",
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
      viewMode: "tree",
      currentDirectoryNodeId,
      surfaceRef: resourceSurfaceRef,
      viewportRef: marqueeViewportRef ?? fallbackViewportRef,
      canAcceptDropTarget: (nodeId) => canAcceptDropTargetRef.current(nodeId),
      canAutoExpandDropTarget: (nodeId) => {
        const row = renderedRowsRef.current.find((candidate) => candidate.nodeId === nodeId);
        return row?.expandable === true && !row.expanded && canAcceptDropTargetRef.current(nodeId);
      },
      onAutoExpandDropTarget: (nodeId) => onToggleTreeExpansionRef.current(nodeId),
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
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onMoveSelection("next");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onMoveSelection("previous");
      return;
    }

    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      onTreeKeyboardAction(event.key);
    }
  };

  if (childrenNodes.length === 0) {
    return (
      <div
        ref={setResourceSurfaceRef}
        className={`konqueror-directory-view${marquee.isMarqueeActive ? " is-marquee-active" : ""}${itemDrag.isDropTargetBackground ? " is-drop-target-background" : ""}`}
        data-resource-view="tree"
        data-konqueror-window-id={windowId}
        data-resource-zoom={zoomLevel}
        role="listbox"
        tabIndex={-1}
        aria-label={t("konqueror.view.treeContents")}
        onClick={(event) => { if (!touchInteraction.consumeClick(event)) marquee.handleBackgroundClick(event); }}
        onPointerDown={(event) => { touchInteraction.onPointerDown(event); marquee.handleBackgroundPointerDown(event); }}
        onPointerMove={(event) => { touchInteraction.onPointerMove(event); marquee.handleBackgroundPointerMove(event); }}
        onPointerUp={(event) => { touchInteraction.onPointerUp(event); marquee.handleBackgroundPointerUp(event); }}
        onPointerCancel={(event) => { touchInteraction.onPointerCancel(event); marquee.handleBackgroundPointerCancel(event); }}
        onLostPointerCapture={(event) => { touchInteraction.onLostPointerCapture(event); marquee.handleBackgroundLostPointerCapture(event); }}
        onKeyDown={handleListKeyDown}
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
      className={`konqueror-directory-view${marquee.isMarqueeActive ? " is-marquee-active" : ""}${itemDrag.isDropTargetBackground ? " is-drop-target-background" : ""}`}
      data-resource-view="tree"
      data-konqueror-window-id={windowId}
      data-resource-zoom={zoomLevel}
      role="listbox"
      tabIndex={-1}
      aria-label={t("konqueror.view.treeContents")}
      onClick={(event) => { if (!touchInteraction.consumeClick(event)) marquee.handleBackgroundClick(event); }}
      onPointerDown={(event) => { touchInteraction.onPointerDown(event); marquee.handleBackgroundPointerDown(event); }}
      onPointerMove={(event) => { touchInteraction.onPointerMove(event); marquee.handleBackgroundPointerMove(event); itemDrag.handlePointerMove(event); }}
      onPointerUp={(event) => { touchInteraction.onPointerUp(event); marquee.handleBackgroundPointerUp(event); itemDrag.handlePointerUp(event); }}
      onPointerCancel={(event) => { touchInteraction.onPointerCancel(event); marquee.handleBackgroundPointerCancel(event); itemDrag.handlePointerCancel(event); }}
      onLostPointerCapture={(event) => { touchInteraction.onLostPointerCapture(event); marquee.handleBackgroundLostPointerCapture(event); itemDrag.handleLostPointerCapture(event); }}
      onKeyDown={handleListKeyDown}
      onContextMenu={(event) => { if (!touchInteraction.consumeNativeContextMenu()) handleBackgroundContextMenu(event); }}
    >
      <div
        className={`konqueror-directory-header${isTrashRoot ? " is-trash-root" : ""}`}
        role="row"
        onContextMenu={(event) => event.stopPropagation()}
      >
        {isTrashRoot ? (
          <>
            <SortHeader label={t("konqueror.view.name")} sort={sort} sortKey="name" onSelectSortKey={onSelectSortKey} />
            <span>{t("konqueror.view.originalLocation")}</span>
            <SortHeader label={t("konqueror.view.deleted")} sort={sort} sortKey="modified" onSelectSortKey={onSelectSortKey} />
            <SortHeader label={t("konqueror.view.size")} sort={sort} sortKey="size" onSelectSortKey={onSelectSortKey} />
            <SortHeader label={t("konqueror.view.type")} sort={sort} sortKey="type" onSelectSortKey={onSelectSortKey} />
          </>
        ) : (
          <>
            <SortHeader label={t("konqueror.view.name")} sort={sort} sortKey="name" onSelectSortKey={onSelectSortKey} />
            <SortHeader label={t("konqueror.view.size")} sort={sort} sortKey="size" onSelectSortKey={onSelectSortKey} />
            <SortHeader label={t("konqueror.view.type")} sort={sort} sortKey="type" onSelectSortKey={onSelectSortKey} />
            <SortHeader label={t("konqueror.view.modified")} sort={sort} sortKey="modified" onSelectSortKey={onSelectSortKey} />
          </>
        )}
      </div>
      {renderedRows.map((row) => {
        const node = vfsState.nodesById[row.nodeId];
        if (!node) return null;
        const treePresentation = getKonquerorTreePresentation(row);
        const isSelected = isKonquerorNodeSelected(marquee.effectiveSelectedNodeIds, node.id);
        const isCutPending = cutNodeIds.includes(node.id);
        const trashMetadata = trashMetadataByNodeId[node.id];

        return (
          <button
            key={node.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-konqueror-node-id={node.id}
            data-cut-pending={isCutPending ? "true" : "false"}
            data-tree-depth={row.depth}
            data-tree-current-branch={treePresentation.currentBranch}
            className={`konqueror-directory-row${isTrashRoot ? " is-trash-root" : ""}${isSelected ? " is-selected" : ""}${isCutPending ? " is-cut-pending" : ""}${itemDrag.dropTargetNodeId === node.id ? " is-drop-target" : ""}`}
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
              if (isKonquerorDirectoryItemContextMenuTarget(event.target)) {
                onOpenItemContextMenu(node.id, event.clientX, event.clientY);
              } else {
                onOpenBackgroundContextMenu(event.clientX, event.clientY);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                onOpenNode(node.id);
              }

              if (event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSelectNode(node.id, "replace");
              }

              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                onMoveSelection(event.key === "ArrowDown" ? "next" : "previous");
              }
            }}
          >
            <span className="konqueror-directory-cell konqueror-directory-cell--name">
              <span className="konqueror-tree-branch-gutter" aria-hidden="true">
                {treePresentation.ancestorSegments.map((segment) => (
                  <span
                    key={segment.level}
                    className={`konqueror-tree-ancestor-segment${segment.continues ? " is-continuing" : ""}`}
                    data-tree-ancestor-level={segment.level}
                    data-tree-continues={segment.continues ? "true" : "false"}
                  />
                ))}
                <span
                  className={`konqueror-tree-current-branch is-${treePresentation.currentBranch}`}
                  data-tree-current-branch={treePresentation.currentBranch}
                />
              </span>
              <span
                className="konqueror-tree-expander-slot has-branch-connector"
                data-tree-expander-slot="true"
              >
                {row.expandable ? (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={t(row.expanded ? "common.collapse" : "common.expand", { name: node.name })}
                    aria-expanded={row.expanded}
                    className="konqueror-tree-expander"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleTreeExpansion(node.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <span className="konqueror-tree-expander__box" aria-hidden="true" />
                  </span>
                ) : null}
              </span>
              <span className="konqueror-directory-item-hit-target">
                <span onPointerDown={(event) => itemDrag.handleItemPointerDown(node.id, event)}>
                  <KonquerorNodeIcon
                    className="konqueror-node-icon"
                    iconId={getKonquerorNodeIconId(node, vfsState)}
                    aria-hidden="true"
                    focusable="false"
                  />
                </span>
                <span
                  className={`konqueror-tree-label${isSelected ? " is-selected" : ""}`}
                  onPointerDown={(event) => itemDrag.handleItemPointerDown(node.id, event)}
                >{getVfsNodeDisplayName(node)}</span>
              </span>
            </span>
            {isTrashRoot ? (
              <>
                <span className="konqueror-directory-cell">{trashMetadata?.originalLocation ?? t("konqueror.page.unavailable")}</span>
                <span className="konqueror-directory-cell">{trashMetadata?.deleted ?? ""}</span>
                <span className="konqueror-directory-cell">{formatKonquerorNodeSize(node)}</span>
                <span className="konqueror-directory-cell">{translateKonquerorNodeTypeLabel(t, getKonquerorNodeTypeLabel(node, vfsState))}</span>
              </>
            ) : (
              <>
                <span className="konqueror-directory-cell">{formatKonquerorNodeSize(node)}</span>
                <span className="konqueror-directory-cell">{translateKonquerorNodeTypeLabel(t, getKonquerorNodeTypeLabel(node, vfsState))}</span>
                <span className="konqueror-directory-cell">{formatVfsModifiedTime(node.modifiedAt, { locale })}</span>
              </>
            )}
          </button>
        );
      })}
      {marqueeStyle ? <div className="konqueror-selection-marquee" aria-hidden="true" style={marqueeStyle} /> : null}
    </div>
  );
}
