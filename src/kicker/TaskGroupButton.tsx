import { forwardRef } from "react";
import { WindowIcon } from "../icons/windowIconRegistry";
import type { DesktopWindow } from "../window-manager/types";
import { getTaskWindowPresentation } from "./taskWindowPresentation";
import { useI18n } from "../i18n/useI18n";

type TaskGroupButtonProps = {
  readonly appId: string;
  readonly iconId: string;
  readonly isActive: boolean;
  readonly isOpen: boolean;
  readonly title: string;
  readonly windowCount: number;
  readonly representativeWindowState: DesktopWindow["state"];
  onToggle(): void;
};

export const TaskGroupButton = forwardRef<HTMLButtonElement, TaskGroupButtonProps>(function TaskGroupButton(
  { appId, iconId, isActive, isOpen, onToggle, representativeWindowState, title, windowCount },
  ref,
) {
  const { t } = useI18n();
  const presentation = getTaskWindowPresentation({ state: representativeWindowState });

  return (
    <button
      ref={ref}
      type="button"
      className={`kde-raised task-button task-group-button${isActive ? " is-active" : ""}`}
      aria-label={`${title}, ${t("kicker.windowCount", { count: windowCount })}`}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      data-app-id={appId}
      onClick={onToggle}
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
      <span className="task-group-button__arrow" aria-hidden="true">&#9650;</span>
    </button>
  );
});
