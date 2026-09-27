import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesktopEmptyTrashConfirmation } from "./DesktopEmptyTrashConfirmation";

describe("DesktopEmptyTrashConfirmation", () => {
  it("is a local shell confirmation with explicit destructive and cancel actions", () => {
    const markup = renderToStaticMarkup(
      <DesktopEmptyTrashConfirmation isOpen onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(markup).toContain("role=\"dialog\"");
    expect(markup).toContain("Empty Trash?");
    expect(markup).toContain("This will permanently delete all items in Trash.");
    expect(markup).toContain("Empty Trash");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain("window.confirm");
  });

  it("does not render while closed", () => {
    expect(renderToStaticMarkup(
      <DesktopEmptyTrashConfirmation isOpen={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    )).toBe("");
  });
});
