import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { StarIcon, TrashIcon } from "../../icons/IconComponents";
import { formatTimestampForLocalDisplay } from "../../time/formatLocalDateTime";
import { KonquerorTextInputDialog } from "./KonquerorInputDialog";
import { KonquerorBookmarksContext } from "./konquerorBookmarksContext";
import { getBookmarkEditorSiblingPosition, getBookmarkEditorTreeRows, type BookmarkEditorSelectionId } from "./bookmarkEditorModel";
import { FolderIcon, NewFolderIcon, UpIcon } from "./icons";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";

type DetailDraft = Readonly<{ name: string; location: string; comment: string }>;
type DetailField = keyof DetailDraft;
type DeleteConfirmation = Readonly<{ nodeId: string; name: string }> | null;

const emptyDraft: DetailDraft = { name: "", location: "", comment: "" };

const formatVisit = (timestamp: string | null, locale: string): string => timestamp === null ? "—" : formatTimestampForLocalDisplay(timestamp, { locale });

const trimRequired = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function BookmarkEditor({ onRequestClose, rootLabel = "Bookmarks" }: { readonly onRequestClose: () => void; readonly rootLabel?: string }) {
  const { locale, t } = useI18n();
  const displayRootLabel = rootLabel === "Bookmarks" ? t("konqueror.menu.bookmarks") : rootLabel;
  const {
    bookmarks,
    getNode,
    getNodeWithParent,
    addFolder,
    updateBookmark,
    updateFolder,
    deleteNode,
    reorderChild,
  } = useContext(KonquerorBookmarksContext);
  const [selectedId, setSelectedId] = useState<BookmarkEditorSelectionId>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());
  const [searchDraft, setSearchDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(emptyDraft);
  const [newFolderTarget, setNewFolderTarget] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<TranslationKey | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null);
  const previousSelectedId = useRef<BookmarkEditorSelectionId | undefined>(undefined);
  const dirtyFields = useRef<ReadonlySet<DetailField>>(new Set());
  const suppressedBlurFields = useRef<ReadonlySet<DetailField>>(new Set());

  const selectedNode = selectedId === null ? null : getNode(selectedId);
  const selectedWithParent = selectedId === null ? null : getNodeWithParent(selectedId);
  const rows = useMemo(() => getBookmarkEditorTreeRows(bookmarks, expandedFolderIds, searchDraft), [bookmarks, expandedFolderIds, searchDraft]);
  const siblingPosition = getBookmarkEditorSiblingPosition(bookmarks, selectedId);
  const searchIsActive = searchDraft.trim().length > 0;

  useEffect(() => {
    if (selectedId !== null && selectedNode === null) {
      setSelectedId(null);
    }
  }, [selectedId, selectedNode]);

  useEffect(() => {
    if (selectedNode === null) {
      previousSelectedId.current = null;
      dirtyFields.current = new Set();
      suppressedBlurFields.current = new Set();
      setDetailDraft(emptyDraft);
      return;
    }

    const next = selectedNode.type === "bookmark"
      ? { name: selectedNode.name, location: selectedNode.location, comment: selectedNode.comment }
      : { name: selectedNode.name, location: "", comment: "" };
    if (previousSelectedId.current !== selectedNode.id) {
      previousSelectedId.current = selectedNode.id;
      dirtyFields.current = new Set();
      suppressedBlurFields.current = new Set();
      setDetailDraft(next);
      return;
    }
    setDetailDraft((draft) => ({
      name: dirtyFields.current.has("name") ? draft.name : next.name,
      location: dirtyFields.current.has("location") ? draft.location : next.location,
      comment: dirtyFields.current.has("comment") ? draft.comment : next.comment,
    }));
  }, [selectedNode]);

  const markDraftDirty = (field: DetailField, value: string) => {
    dirtyFields.current = new Set([...dirtyFields.current, field]);
    setDetailDraft((draft) => ({ ...draft, [field]: value }));
  };

  const clearDraftDirty = (field: DetailField) => {
    const next = new Set(dirtyFields.current);
    next.delete(field);
    dirtyFields.current = next;
  };

  const suppressNextBlurCommit = (field: DetailField) => {
    suppressedBlurFields.current = new Set([...suppressedBlurFields.current, field]);
  };

  const consumeSuppressedBlurCommit = (field: DetailField): boolean => {
    if (!suppressedBlurFields.current.has(field)) return false;
    const next = new Set(suppressedBlurFields.current);
    next.delete(field);
    suppressedBlurFields.current = next;
    return true;
  };

  const commitName = (value = detailDraft.name) => {
    if (selectedNode === null) return;
    const name = trimRequired(value);
    if (name === null) {
      clearDraftDirty("name");
      setDetailDraft((draft) => ({ ...draft, name: selectedNode.name }));
      return;
    }
    clearDraftDirty("name");
    if (name !== selectedNode.name) {
      if (selectedNode.type === "bookmark") {
        updateBookmark(selectedNode.id, { name });
      } else {
        updateFolder(selectedNode.id, { name });
      }
    }
  };

  const commitLocation = (value = detailDraft.location) => {
    if (selectedNode?.type !== "bookmark") return;
    const location = trimRequired(value);
    if (location === null) {
      clearDraftDirty("location");
      setDetailDraft((draft) => ({ ...draft, location: selectedNode.location }));
      return;
    }
    clearDraftDirty("location");
    if (location !== selectedNode.location) updateBookmark(selectedNode.id, { location });
  };

  const commitComment = (value = detailDraft.comment) => {
    if (selectedNode?.type !== "bookmark") return;
    clearDraftDirty("comment");
    if (value === selectedNode.comment) return;
    updateBookmark(selectedNode.id, { comment: value });
  };

  const openNewFolder = () => {
    const target = selectedNode?.type === "folder"
      ? selectedNode.id
      : selectedWithParent?.parentId ?? null;
    setNewFolderTarget(target);
    setNewFolderName("");
    setNewFolderError(null);
  };

  const submitNewFolder = () => {
    if (newFolderTarget === undefined) return;
    const name = trimRequired(newFolderName);
    if (name === null) {
      setNewFolderError("konqueror.dialog.enterFolderName");
      return;
    }
    const result = addFolder({ name }, newFolderTarget);
    if (!result.ok) {
      setNewFolderError("konqueror.dialog.thisItemUnavailable");
      return;
    }
    const parent = newFolderTarget === null ? null : getNodeFromTree(result.tree, newFolderTarget);
    const parentChildren = newFolderTarget === null
      ? result.tree.rootChildren
      : parent?.type === "folder" ? parent.children : [];
    const folder = parentChildren.at(-1);
    if (folder?.type === "folder") {
      setSelectedId(folder.id);
      if (newFolderTarget !== null) setExpandedFolderIds((ids) => new Set([...ids, newFolderTarget]));
    }
    setNewFolderTarget(undefined);
  };

  const confirmDelete = () => {
    if (deleteConfirmation === null) return;
    const located = getNodeWithParent(deleteConfirmation.nodeId);
    if (located !== null) {
      setSelectedId(located.parentId);
      deleteNode(located.node.id);
    }
    setDeleteConfirmation(null);
  };

  const moveSelected = (direction: -1 | 1) => {
    if (selectedId === null || siblingPosition === null || searchIsActive) return;
    const nextIndex = siblingPosition.index + direction;
    if (nextIndex < 0 || nextIndex >= siblingPosition.siblingCount) return;
    reorderChild(siblingPosition.parentId, selectedId, nextIndex);
  };

  const restoreField = (field: DetailField) => {
    if (selectedNode === null) return;
    clearDraftDirty(field);
    const value = selectedNode.type === "bookmark"
      ? selectedNode[field]
      : field === "name" ? selectedNode.name : "";
    setDetailDraft((draft) => ({ ...draft, [field]: value }));
  };

  const onDetailKeyDown = (event: KeyboardEvent<HTMLInputElement>, field: DetailField) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      suppressNextBlurCommit(field);
      restoreField(field);
      event.currentTarget.blur();
    }
  };

  const toggleExpandedFolder = (folderId: string) => {
    setExpandedFolderIds((ids) => {
      const next = new Set(ids);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  return (
    <main className="bookmark-editor-app" aria-label={t("konqueror.bookmarks.editor")}>
      <div className="bookmark-editor-toolbar" role="toolbar" aria-label={t("konqueror.bookmarks.actions")}>
        <button type="button" aria-label={t("konqueror.bookmarks.newFolder")} title={t("konqueror.bookmarks.newFolder")} onClick={openNewFolder}><NewFolderIcon aria-hidden="true" /></button>
        <button type="button" aria-label={t("konqueror.bookmarks.delete")} title={t("konqueror.bookmarks.delete")} disabled={selectedNode === null} onClick={() => selectedNode && setDeleteConfirmation({ nodeId: selectedNode.id, name: selectedNode.name })}><TrashIcon aria-hidden="true" /></button>
        <span className="bookmark-editor-toolbar__separator" aria-hidden="true" />
        <button type="button" aria-label={t("konqueror.bookmarks.moveUp")} title={t("konqueror.bookmarks.moveUp")} disabled={selectedId === null || searchIsActive || siblingPosition === null || siblingPosition.index === 0} onClick={() => moveSelected(-1)}><UpIcon aria-hidden="true" /></button>
        <button type="button" aria-label={t("konqueror.bookmarks.moveDown")} title={t("konqueror.bookmarks.moveDown")} className="bookmark-editor-toolbar__move-down" disabled={selectedId === null || searchIsActive || siblingPosition === null || siblingPosition.index === siblingPosition.siblingCount - 1} onClick={() => moveSelected(1)}><UpIcon aria-hidden="true" /></button>
      </div>

      <label className="bookmark-editor-search">{t("konqueror.bookmarks.search")}:
        <input value={searchDraft} onChange={(event) => { const value = event.currentTarget.value; setSearchDraft(value); }} />
      </label>

      <section className="bookmark-editor-tree" role="tree" aria-label={displayRootLabel}>
        <div className="bookmark-editor-tree__header" aria-hidden="true"><span>{t("konqueror.bookmarks.bookmark")}</span><span>{t("konqueror.dialog.location")}</span><span>{t("konqueror.bookmarks.comment")}</span></div>
        {rows.map((row) => row.node === null ? (
          <div key="root" role="treeitem" tabIndex={0} aria-label={displayRootLabel} aria-selected={selectedId === null} className={`bookmark-editor-tree__row${selectedId === null ? " is-selected" : ""}`} onClick={() => setSelectedId(null)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(null); } }}>
            <span className="bookmark-editor-tree__primary" style={{ paddingLeft: 4 }}><StarIcon aria-hidden="true" />{displayRootLabel}</span><span /><span />
          </div>
        ) : (
          <div key={row.id} className="bookmark-editor-tree__item">
            <div
              role="treeitem"
              aria-label={row.node.name}
              aria-selected={selectedId === row.id}
              aria-expanded={row.node.type === "folder" ? row.isExpanded : undefined}
              tabIndex={0}
              className={`bookmark-editor-tree__row${selectedId === row.id ? " is-selected" : ""}`}
              onClick={() => setSelectedId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(row.id);
                }
              }}
            >
              <span className="bookmark-editor-tree__primary" style={{ paddingLeft: 4 + row.depth * 16 }}>{row.node.type === "folder" ? <button type="button" className="bookmark-editor-tree__disclosure" aria-label={t(row.isExpanded ? "common.collapse" : "common.expand", { name: row.node.name })} aria-expanded={row.isExpanded} onClick={(event) => { event.stopPropagation(); if (row.node?.type === "folder") toggleExpandedFolder(row.node.id); }}>{row.isExpanded ? "▼" : "▶"}</button> : <span className="bookmark-editor-tree__disclosure" />} {row.node.type === "folder" ? <FolderIcon aria-hidden="true" /> : <StarIcon aria-hidden="true" />} {row.node.name}</span>
              <span>{row.node.type === "bookmark" ? row.node.location : ""}</span>
              <span>{row.node.type === "bookmark" ? row.node.comment : ""}</span>
            </div>
          </div>
        ))}
        {searchIsActive && rows.length === 1 ? <p className="bookmark-editor-tree__empty" role="status">{t("konqueror.bookmarks.noResults")}</p> : null}
      </section>

      <section className="bookmark-editor-details" aria-label={t("konqueror.bookmarks.editor")}>
        <label>{t("konqueror.dialog.name")}<input value={selectedNode === null ? displayRootLabel : detailDraft.name} disabled={selectedNode === null} onChange={(event) => markDraftDirty("name", event.currentTarget.value)} onBlur={(event) => { if (!consumeSuppressedBlurCommit("name")) commitName(event.currentTarget.value); }} onKeyDown={(event) => onDetailKeyDown(event, "name")} /></label>
        <label>{t("konqueror.dialog.location")}<input value={detailDraft.location} disabled={selectedNode?.type !== "bookmark"} onChange={(event) => markDraftDirty("location", event.currentTarget.value)} onBlur={(event) => { if (!consumeSuppressedBlurCommit("location")) commitLocation(event.currentTarget.value); }} onKeyDown={(event) => onDetailKeyDown(event, "location")} /></label>
        <label>{t("konqueror.bookmarks.comment")}<input value={detailDraft.comment} disabled={selectedNode?.type !== "bookmark"} onChange={(event) => markDraftDirty("comment", event.currentTarget.value)} onBlur={(event) => { if (!consumeSuppressedBlurCommit("comment")) commitComment(event.currentTarget.value); }} onKeyDown={(event) => onDetailKeyDown(event, "comment")} /></label>
        <label>{t("konqueror.bookmarks.firstViewed")}<output>{selectedNode?.type === "bookmark" ? formatVisit(selectedNode.firstViewed, locale) : "—"}</output></label>
        <label>{t("konqueror.bookmarks.viewedLast")}<output>{selectedNode?.type === "bookmark" ? formatVisit(selectedNode.lastViewed, locale) : "—"}</output></label>
        <label>{t("konqueror.bookmarks.timesVisited")}<output>{selectedNode?.type === "bookmark" ? selectedNode.visitCount : "—"}</output></label>
      </section>

      {newFolderTarget !== undefined ? <KonquerorTextInputDialog title={t("konqueror.menu.newBookmarkFolder")} label={t("konqueror.dialog.folderName")} value={newFolderName} error={newFolderError === null ? undefined : t(newFolderError)} onChange={setNewFolderName} onCancel={() => setNewFolderTarget(undefined)} onSubmit={submitNewFolder} /> : null}
      {deleteConfirmation !== null ? (
        <div className="konqueror-dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDeleteConfirmation(null); } }}>
          <section className="konqueror-input-dialog konqueror-confirmation-dialog" role="alertdialog" aria-modal="true" aria-label={t("konqueror.bookmarks.deleteTitle")}>
            <div className="konqueror-confirmation-dialog__body">
              <h2>{t("konqueror.bookmarks.deleteTitle")}</h2>
              <p>{t("konqueror.bookmarks.deleteQuestion", { name: deleteConfirmation.name, suffix: getNode(deleteConfirmation.nodeId)?.type === "folder" ? t("konqueror.bookmarks.deleteContentsSuffix") : "" })}</p>
              <p>{t("konqueror.dialog.cannotUndo")}</p>
              <div className="konqueror-dialog-actions"><button type="button" className="kde-raised konqueror-dialog-button" onClick={confirmDelete}>{t("konqueror.bookmarks.delete")}</button><button type="button" className="kde-raised konqueror-dialog-button" onClick={() => setDeleteConfirmation(null)}>{t("konqueror.dialog.cancel")}</button></div>
            </div>
          </section>
        </div>
      ) : null}
      <button type="button" className="bookmark-editor-close" onClick={onRequestClose}>{t("konqueror.bookmarks.close")}</button>
    </main>
  );
}

function getNodeFromTree(tree: { readonly rootChildren: readonly import("./bookmarks").KonquerorBookmarkNode[] }, nodeId: string): import("./bookmarks").KonquerorBookmarkNode | null {
  for (const node of tree.rootChildren) {
    if (node.id === nodeId) return node;
    if (node.type === "folder") {
      const nested = getNodeFromTree({ rootChildren: node.children }, nodeId);
      if (nested !== null) return nested;
    }
  }
  return null;
}
