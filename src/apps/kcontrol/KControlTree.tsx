import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  getVisibleControlCenterTreeRows,
  initialControlCenterExpandedCategories,
  getKControlTreeLabelKey,
  type KControlTreeExpansionRequest,
  type KControlPage,
  type KControlTreeCategoryId,
  type KControlTreeRow,
} from "./controlCenterModel";
import { useI18n } from "../../i18n/useI18n";

type KControlTreeProps = {
  readonly selectedPage: KControlPage | null;
  readonly onSelectPage: (page: KControlPage) => void;
  readonly initialExpandedCategories?: readonly KControlTreeCategoryId[];
  readonly expansionRequest?: KControlTreeExpansionRequest | null;
};

const getParentCategoryId = (rowId: string): KControlTreeCategoryId | null => {
  if (rowId === "background") {
    return "appearance-themes";
  }

  if (rowId === "theme-manager") {
    return "appearance-themes";
  }

  if (rowId === "behavior" || rowId === "multiple-desktops") {
    return "desktop";
  }

  if (rowId === "country-region-language") {
    return "regional-accessibility";
  }

  return null;
};

export function KControlTree({
  selectedPage,
  onSelectPage,
  initialExpandedCategories = initialControlCenterExpandedCategories,
  expansionRequest = null,
}: KControlTreeProps) {
  const { t } = useI18n();
  const [expandedCategories, setExpandedCategories] = useState<readonly KControlTreeCategoryId[]>(initialExpandedCategories);
  const [focusedRowId, setFocusedRowId] = useState<string>("appearance-themes");
  const lastHandledExpansionRequestIdRef = useRef<number | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rows = getVisibleControlCenterTreeRows(expandedCategories);
  const visibleFocusedRowId = rows.some((row) => row.id === focusedRowId) ? focusedRowId : rows[0]?.id ?? "";

  useEffect(() => {
    if (!expansionRequest || expansionRequest.requestId === lastHandledExpansionRequestIdRef.current) {
      return;
    }

    lastHandledExpansionRequestIdRef.current = expansionRequest.requestId;
    setExpandedCategories(expansionRequest.expandedCategories);
  }, [expansionRequest]);

  useEffect(() => {
    if (focusedRowId !== visibleFocusedRowId) {
      setFocusedRowId(visibleFocusedRowId);
    }
  }, [focusedRowId, visibleFocusedRowId]);

  const toggleCategory = (id: KControlTreeCategoryId) => {
    setExpandedCategories((current) => current.includes(id)
      ? current.filter((categoryId) => categoryId !== id)
      : [...current, id]);
  };

  const focusRow = (row: KControlTreeRow | undefined) => {
    if (!row) {
      return;
    }

    setFocusedRowId(row.id);
    rowRefs.current[row.id]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: KControlTreeRow) => {
    const index = rows.findIndex((candidate) => candidate.id === row.id);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(rows[index + (event.key === "ArrowDown" ? 1 : -1)]);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (row.type === "category") {
        if (!expandedCategories.includes(row.id)) {
          toggleCategory(row.id);
        } else {
          focusRow(rows[index + 1]);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.type === "category") {
        if (expandedCategories.includes(row.id)) {
          toggleCategory(row.id);
        }
      } else {
        const parentId = getParentCategoryId(row.id);
        focusRow(rows.find((candidate) => candidate.id === parentId));
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (row.type === "category") {
        toggleCategory(row.id);
      } else {
        onSelectPage(row.page);
      }
    }
  };

  return (
    <div className="kcontrol-tree" role="tree" aria-label={t("controlCenter.title")}>
      {rows.map((row) => {
        const isCategory = row.type === "category";
        const hasChildren = isCategory && row.children.length > 0;
        const isSelected = !isCategory && selectedPage === row.page;
        const isFocused = row.id === visibleFocusedRowId;
        const isExpanded = hasChildren && expandedCategories.includes(row.id);
        const label = t(getKControlTreeLabelKey(row.id));

        return (
          <button
            key={row.id}
            ref={(element) => { rowRefs.current[row.id] = element; }}
            type="button"
            role="treeitem"
            className={`kcontrol-tree__row kcontrol-tree__row--${row.type}${isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}`}
            style={{ "--kcontrol-tree-depth": row.depth } as CSSProperties}
            aria-level={row.depth + 1}
            aria-selected={isSelected}
            aria-expanded={hasChildren ? isExpanded : undefined}
            tabIndex={isFocused ? 0 : -1}
            onFocus={() => setFocusedRowId(row.id)}
            onClick={() => {
              setFocusedRowId(row.id);
              if (isCategory) {
                toggleCategory(row.id);
              } else {
                onSelectPage(row.page);
              }
            }}
            onKeyDown={(event) => handleKeyDown(event, row)}
          >
            {hasChildren ? (
              <span className="konqueror-tree-expander kcontrol-tree__expander" aria-expanded={isExpanded} aria-hidden="true">
                <span className="konqueror-tree-expander__box" />
              </span>
            ) : (
              <span className="kcontrol-tree__leaf-branch" aria-hidden="true">
                <span className={`konqueror-tree-current-branch ${row.type === "leaf" && row.isLastChild ? "is-elbow" : "is-tee"}`} />
              </span>
            )}
            <span className={`kcontrol-tree__icon-anchor${isExpanded ? " is-expanded" : ""}`} aria-hidden="true">
              <span className={`kcontrol-tree__icon kcontrol-tree__icon--${row.type} kcontrol-tree__icon--${row.id}`} />
            </span>
            <span className={`konqueror-tree-label kcontrol-tree__label${isSelected ? " is-selected" : ""}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
