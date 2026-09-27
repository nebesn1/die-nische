import type { KonquerorTabId, KonquerorTabSession } from "./konquerorTabs";
import { useI18n } from "../../i18n/useI18n";
import { useTouchClickGuard } from "../../input/pointerInteraction";

type KonquerorTabBarProps = {
  readonly tabs: readonly KonquerorTabSession[];
  readonly activeTabId: KonquerorTabId;
  readonly getLabel: (tab: KonquerorTabSession) => string;
  readonly onNewTab: () => void;
  readonly onSelectTab: (tabId: KonquerorTabId) => void;
  readonly onCloseCurrentTab: () => void;
  readonly disabled?: boolean;
};

export function KonquerorTabBar({
  tabs,
  activeTabId,
  getLabel,
  onNewTab,
  onSelectTab,
  onCloseCurrentTab,
  disabled = false,
}: KonquerorTabBarProps) {
  const { t } = useI18n();
  const touchClickGuard = useTouchClickGuard<HTMLElement>();
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div
      className="konqueror-tabbar"
      aria-label={t("konqueror.tabs")}
      data-tab-count={tabs.length}
      onPointerDown={touchClickGuard.onPointerDown}
      onPointerMove={touchClickGuard.onPointerMove}
      onPointerUp={touchClickGuard.onPointerUp}
      onPointerCancel={touchClickGuard.onPointerCancel}
      onClickCapture={touchClickGuard.consumeClick}
    >
      <button type="button" className="konqueror-tabbar__new" aria-label={t("konqueror.menu.newTab")} title={t("konqueror.menu.newTab")} disabled={disabled} onClick={onNewTab}>+</button>
      <div className="konqueror-tabbar__tabs" role="tablist" aria-label={t("konqueror.tabs")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`konqueror-tab${tab.id === activeTabId ? " is-active" : ""}`}
            aria-selected={tab.id === activeTabId}
            data-konqueror-tab-id={tab.id}
            disabled={disabled}
            onClick={() => onSelectTab(tab.id)}
          >
            {getLabel(tab)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="konqueror-tabbar__close"
        aria-label={t("konqueror.menu.closeTab")}
        title={t("konqueror.menu.closeTab")}
        disabled={disabled}
        onClick={onCloseCurrentTab}
      >
        ×
      </button>
    </div>
  );
}
