import { describe, expect, it, vi } from "vitest";
import { getClipboardWriteFailureMessage, type ClipboardAdapter } from "./clipboardAdapter";

describe("clipboard adapter boundary", () => {
  it("uses an injected write adapter only when a history item is explicitly activated", async () => {
    const adapter: ClipboardAdapter = { writeText: vi.fn(async () => undefined) };

    await expect(adapter.writeText("Hello")).resolves.toBeUndefined();
    expect(adapter.writeText).toHaveBeenCalledWith("Hello");
  });

  it("maps every explicit write failure to a controlled message", () => {
    expect(getClipboardWriteFailureMessage()).toBe("Clipboard write was denied.");
  });
});
