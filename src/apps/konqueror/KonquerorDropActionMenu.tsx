import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useMeasuredPopupPosition } from "../../desktop/useMeasuredPopupPosition";
import type { ScreenArea } from "../../window-manager/types";
import { getKonquerorPopupLocalPosition, getKonquerorScreenAreaLocalBounds, clampKonquerorContextMenuPosition } from "./contextMenuModel";
import type { KonquerorDropAction, KonquerorDropActionRequest } from "./dragDropController";
import { konquerorDropActionMenuEntries } from "./dropActionMenuModel";
import { useApplicationMenuDismissal } from "../useApplicationMenuDismissal";
import { toLogicalRect } from "../../desktop/desktopUiScale";
import { useI18n } from "../../i18n/useI18n";

type KonquerorDropActionMenuProps = {
  readonly request: KonquerorDropActionRequest | null;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly screenArea: ScreenArea;
  readonly onAction: (action: KonquerorDropAction) => void;
  readonly onDismiss: () => void;
};

export function KonquerorDropActionMenu({ containerRef, onAction, onDismiss, request, screenArea }: KonquerorDropActionMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLElement | null>(null);
  useApplicationMenuDismissal({ isOpen: request !== null, menuBarRef: menuRef, onDismiss });
  const resolvePosition = useCallback((menu: HTMLElement, dropRequest: KonquerorDropActionRequest) => {
    const container = containerRef.current;
    if (!container) return null;
    const bounds = toLogicalRect(container.getBoundingClientRect());
    const menuBounds = toLogicalRect(menu.getBoundingClientRect());
    return clampKonquerorContextMenuPosition(
      getKonquerorPopupLocalPosition(dropRequest, bounds),
      { width: menuBounds.width, height: menuBounds.height },
      getKonquerorScreenAreaLocalBounds(screenArea, bounds),
    );
  }, [containerRef, screenArea]);
  const { isPositioned, position } = useMeasuredPopupPosition(request, menuRef, resolvePosition);

  useLayoutEffect(() => {
    if (request && isPositioned) menuRef.current?.focus({ preventScroll: true });
  }, [isPositioned, request]);

  if (!request) return null;
  return (
    <section
      ref={menuRef}
      className="konqueror-context-menu konqueror-drop-action-menu"
      role="menu"
      tabIndex={-1}
      aria-label={t("konqueror.context.dropActionMenu")}
      style={position ?? { visibility: "hidden", pointerEvents: "none" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      {konquerorDropActionMenuEntries.slice(0, 3).map((entry) => (
        <button key={entry.action} type="button" role="menuitem" disabled={!entry.enabled} onClick={() => entry.enabled && onAction(entry.action)}>
          <span className="konqueror-context-menu__marker" aria-hidden="true" />
          <span className="konqueror-context-menu__label">{t(entry.action === "move" ? "konqueror.context.moveHere" : entry.action === "copy" ? "konqueror.context.copyHere" : "konqueror.context.linkHere")}</span>
          <span className="konqueror-context-menu__shortcut">{entry.shortcut}</span>
        </button>
      ))}
      <div className="konqueror-context-menu__separator" role="separator" />
      <button type="button" role="menuitem" onClick={() => onAction("cancel")}>
        <span className="konqueror-context-menu__marker" aria-hidden="true" />
        <span className="konqueror-context-menu__label">{t("common.cancel")}</span>
        <span className="konqueror-context-menu__shortcut">Escape</span>
      </button>
    </section>
  );
}
