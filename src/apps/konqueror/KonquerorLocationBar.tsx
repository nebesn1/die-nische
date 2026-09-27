import type { FocusEvent, FormEvent, KeyboardEvent, ReactNode, RefObject } from "react";
import { FolderIcon, GoIcon } from "./icons";
import { useI18n } from "../../i18n/useI18n";

type KonquerorLocationBarProps = {
  readonly value: string;
  readonly currentPath: string;
  readonly inputRef?: RefObject<HTMLInputElement | null>;
  readonly onChange: (value: string) => void;
  readonly onNavigate: (value: string) => boolean;
  readonly onReset: () => void;
  readonly onBeginEditing?: () => void;
  readonly onFinishEditing?: () => void;
  readonly disabled?: boolean;
  readonly disabledTitle?: string;
  readonly dockGrip?: ReactNode;
};

export function KonquerorLocationBar({
  currentPath,
  disabled = false,
  disabledTitle,
  inputRef,
  onBeginEditing,
  onChange,
  onFinishEditing,
  onNavigate,
  onReset,
  value,
  dockGrip,
}: KonquerorLocationBarProps) {
  const { t } = useI18n();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    const locationDraft = value;
    if (onNavigate(locationDraft)) {
      onFinishEditing?.();
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.form?.contains(event.relatedTarget)) {
      return;
    }

    onFinishEditing?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onReset();
    }
  };

  return (
    <form className="konqueror-addressbar kde-chrome-surface" aria-label={t("konqueror.location.bar")} onSubmit={handleSubmit}>
      {dockGrip ?? <span className="toolbar-grip" aria-hidden="true" />}
      <label className="address-label" htmlFor="konqueror-location">
        {t("konqueror.location.label")}
      </label>
      <span className="konqueror-location-icon" aria-hidden="true">
        <FolderIcon focusable="false" />
      </span>
      <input
        ref={inputRef}
        id="konqueror-location"
        className="address-input"
        value={value}
        aria-label={t("konqueror.location.label")}
        aria-describedby="konqueror-current-location"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onFocus={onBeginEditing}
        onBlur={handleBlur}
      />
      <span id="konqueror-current-location" className="sr-only">
        {t("konqueror.location.current", { location: currentPath })}
      </span>
      <button
        type="submit"
        className="konqueror-go-button"
        aria-label={t("konqueror.location.goTo")}
        title={disabled ? disabledTitle : t("konqueror.location.go")}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
      >
        <GoIcon aria-hidden="true" focusable="false" />
      </button>
    </form>
  );
}
