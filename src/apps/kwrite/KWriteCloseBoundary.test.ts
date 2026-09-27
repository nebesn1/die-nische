import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("./KWrite.tsx", import.meta.url)), "utf8");
const dialogSource = readFileSync(fileURLToPath(new URL("./KWriteDialogs.tsx", import.meta.url)), "utf8");

describe("KWrite close guard boundary", () => {
  it("uses Runtime close callbacks instead of importing Window Manager close internals", () => {
    expect(source).toContain("onRequestClose");
    expect(source).toContain("onCommitClose");
    expect(source).toContain("onCancelClose");
    expect(source).not.toContain("useWindowManager");
    expect(source).not.toContain("closeWindow(windowId)");
  });

  it("keeps Save As close continuation as explicit document-or-window data", () => {
    expect(source).toContain("closeTarget");
    expect(source).toContain("continueAfterSaveAs(savedDocument, pending, closeTarget)");
    expect(source).toContain('type: "document"');
    expect(source).toContain('type: "window"');
    expect(dialogSource).toContain('t("kwrite.saveBeforeClose")');
    expect(dialogSource).toContain("confirm-close");
  });

  it("does not add browser confirmation or unload interception", () => {
    expect(source).not.toContain("window.confirm");
    expect(source).not.toContain("window.alert");
    expect(source).not.toContain("beforeunload");
    expect(source).not.toContain("addEventListener(\"beforeunload\"");
  });
});
