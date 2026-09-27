type TextControlLike = {
  readonly tagName?: unknown;
  readonly type?: unknown;
  readonly value?: unknown;
  readonly selectionStart?: unknown;
  readonly selectionEnd?: unknown;
};

const getBrowserSelectionText = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.getSelection()?.toString() ?? "";
};

const isTextControlLike = (target: EventTarget | null): target is EventTarget & TextControlLike => {
  return typeof target === "object" && target !== null;
};

export function extractCopiedTextFromTarget(target: TextControlLike | null, selectionText: string): string {
  const tagName = typeof target?.tagName === "string" ? target.tagName.toLowerCase() : "";
  const isTextControl = tagName === "input" || tagName === "textarea";

  if (!isTextControl) {
    return selectionText;
  }

  if (tagName === "input" && typeof target?.type === "string" && target.type.toLowerCase() === "password") {
    return "";
  }

  if (
    typeof target?.value !== "string"
    || typeof target.selectionStart !== "number"
    || typeof target.selectionEnd !== "number"
  ) {
    return "";
  }

  return target.value.slice(target.selectionStart, target.selectionEnd);
}

export function extractCopiedText(target: EventTarget | null): string {
  return extractCopiedTextFromTarget(isTextControlLike(target) ? target : null, getBrowserSelectionText());
}
