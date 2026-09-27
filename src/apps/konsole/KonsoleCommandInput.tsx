import { forwardRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n/useI18n";

interface KonsoleCommandInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onHistoryPrevious: () => void;
  readonly onHistoryNext: () => void;
  readonly onComplete: (input: HTMLInputElement) => void;
  readonly onClearTranscriptShortcut: (input: HTMLInputElement) => void;
  readonly onClearCompletion: () => void;
  readonly onEscape: () => boolean;
  readonly onMultilinePaste: (input: HTMLInputElement, clipboardText: string) => void;
}

export const KonsoleCommandInput = forwardRef<HTMLInputElement, KonsoleCommandInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onHistoryPrevious,
      onHistoryNext,
      onComplete,
      onClearTranscriptShortcut,
      onClearCompletion,
      onEscape,
      onMultilinePaste,
    },
    ref,
  ) => {
    const { t } = useI18n();
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.currentTarget.value);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Tab") {
        if (event.nativeEvent.isComposing) {
          return;
        }

        event.preventDefault();
        onComplete(event.currentTarget);
        return;
      }

      if (event.key === "Enter") {
        if (event.nativeEvent.isComposing) {
          return;
        }

        event.preventDefault();
        onSubmit();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onClearTranscriptShortcut(event.currentTarget);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onClearCompletion();
        event.currentTarget.setSelectionRange(0, 0);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        onClearCompletion();
        event.currentTarget.setSelectionRange(value.length, value.length);
        return;
      }

      const isPlainHomeOrEnd = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

      if (isPlainHomeOrEnd && event.key === "Home") {
        event.preventDefault();
        onClearCompletion();
        event.currentTarget.setSelectionRange(0, 0);
        return;
      }

      if (isPlainHomeOrEnd && event.key === "End") {
        event.preventDefault();
        onClearCompletion();
        event.currentTarget.setSelectionRange(value.length, value.length);
        return;
      }

      if (event.key === "Escape" && onEscape()) {
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        onClearCompletion();
        onHistoryPrevious();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        onClearCompletion();
        onHistoryNext();
      }
    };

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
      const clipboardText = event.clipboardData.getData("text/plain");

      if (!clipboardText.includes("\n") && !clipboardText.includes("\r")) {
        return;
      }

      event.preventDefault();
      onMultilinePaste(event.currentTarget, clipboardText);
    };

    return (
      <input
        ref={ref}
        type="text"
        className="konsole-command-input"
        aria-label={t("konsole.commandInput")}
        value={value}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
    );
  },
);

KonsoleCommandInput.displayName = "KonsoleCommandInput";
