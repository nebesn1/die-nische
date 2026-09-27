export type ClipboardAdapter = {
  readonly writeText: (text: string) => Promise<void>;
};

const unavailable = (): never => {
  throw new Error("Clipboard access is unavailable.");
};

export const browserClipboardAdapter: ClipboardAdapter = {
  writeText: async (text) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return unavailable();
    }

    await navigator.clipboard.writeText(text);
  },
};

export function getClipboardWriteFailureMessage(): string {
  return "Clipboard write was denied.";
}
