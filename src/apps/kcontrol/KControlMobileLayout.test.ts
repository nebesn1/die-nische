import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");

describe("Control Center mobile notice layout", () => {
  it("keeps the desktop action footer contract unchanged", () => {
    expect(css).toMatch(/\.kcontrol-actions \{[\s\S]*?min-height: 38px;[\s\S]*?flex: 0 0 38px;/);
    expect(css).toContain(".kcontrol-notice {");
  });

  it("keeps mobile notice text and action buttons in one stable footer row", () => {
    const mobileActionsStart = css.indexOf('.desktop-shell[data-layout-mode="mobile"] .kcontrol-actions {');
    const mobileNoticeStart = css.indexOf('.desktop-shell[data-layout-mode="mobile"] .kcontrol-notice {');
    const mobileActionButtonsStart = css.indexOf('.desktop-shell[data-layout-mode="mobile"] .kcontrol-actions > button {');
    if (mobileActionsStart < 0 || mobileNoticeStart < 0 || mobileActionButtonsStart < 0) {
      throw new Error("Missing mobile Control Center action rules.");
    }

    const mobileActions = css.slice(mobileActionsStart, mobileNoticeStart);
    const mobileNotice = css.slice(mobileNoticeStart, mobileActionButtonsStart);
    const mobileButtons = css.slice(mobileActionButtonsStart, mobileActionButtonsStart + 180);

    expect(mobileActions).toContain("flex-wrap: nowrap;");
    expect(mobileNotice).toContain("flex: 1 1 auto;");
    expect(mobileNotice).toContain("text-overflow: ellipsis;");
    expect(mobileNotice).toContain("white-space: nowrap;");
    expect(mobileButtons).toContain("flex: 0 0 auto;");
  });
});
