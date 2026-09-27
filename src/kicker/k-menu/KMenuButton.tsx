import type { RefObject } from "react";
import { KMenuIcon } from "../../icons/IconComponents";
import { useI18n } from "../../i18n/useI18n";

type KMenuButtonProps = {
  buttonRef: RefObject<HTMLButtonElement | null>;
  controlsId: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function KMenuButton({ buttonRef, controlsId, isOpen, onToggle }: KMenuButtonProps) {
  const { t } = useI18n();
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`kicker-launcher kicker-button kicker-button--k${isOpen ? " is-active" : ""}`}
      aria-label={isOpen ? t("kicker.closeKMenu") : t("kicker.openKMenu")}
      aria-controls={controlsId}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <KMenuIcon aria-hidden="true" focusable="false" />
    </button>
  );
}
