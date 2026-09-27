import { WindowIcon } from "../icons/windowIconRegistry";
import type { DesktopWindow } from "../window-manager/types";
import { getTaskWindowPresentation } from "./taskWindowPresentation";
import { useI18n } from "../i18n/useI18n";

type TaskButtonProps = {
  windowId: string;
  title: string;
  iconId: string;
  isActive: boolean;
  isMinimizable: boolean;
  windowState: DesktopWindow["state"];
  onActivate: () => void;
};

export function TaskButton({ windowId, title, iconId, isActive, isMinimizable, onActivate, windowState }: TaskButtonProps) {
  const { t } = useI18n();
  const presentation = getTaskWindowPresentation({ state: windowState });
  const stateClassName = isActive ? " is-active" : "";
  const minimizedClassName = presentation.isMinimized ? " kde-task-button--minimized" : "";
  const action = presentation.isMinimized ? t("common.restore") : isActive && isMinimizable ? t("common.minimize") : t("common.activate");

  return (
    <button
      type="button"
      className={`kde-raised task-button${stateClassName}${minimizedClassName}`}
      aria-label={`${action} ${title}`}
      aria-pressed={isActive}
      data-window-id={windowId}
      onClick={onActivate}
    >
      <WindowIcon
        className={`task-window-icon task-window-icon--${presentation.iconState}`}
        data-task-window-icon-state={presentation.iconState}
        iconId={iconId}
        width="14"
        height="14"
        aria-hidden="true"
        focusable="false"
      />
      <span className="task-button__title">{title}</span>
      {presentation.isMinimized ? <span className="task-button__state">{t("common.minimize")}</span> : null}
    </button>
  );
}
