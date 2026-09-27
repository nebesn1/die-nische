export type KWriteShortcut = "new" | "open" | "save" | "save-as";

export type KWriteKeyboardEventLike = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
};

export function getKWriteShortcut(event: KWriteKeyboardEventLike): KWriteShortcut | null {
  const key = event.key.toLowerCase();

  if (key === "n") {
    return event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey ? "new" : null;
  }

  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null;
  }

  if (key === "s") {
    return event.shiftKey ? "save-as" : "save";
  }

  if (event.shiftKey) {
    return null;
  }

  return key === "o" ? "open" : null;
}
