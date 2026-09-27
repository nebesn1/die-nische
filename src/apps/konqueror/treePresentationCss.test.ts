import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../theme/kde3.css", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("./KonquerorDirectoryView.tsx", import.meta.url), "utf8");
const marqueeSource = readFileSync(new URL("./useKonquerorDirectoryMarquee.ts", import.meta.url), "utf8");

const getRule = (selector: string): string => {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing ${selector} CSS rule`);
  return match[1];
};

describe("Konqueror Tree connector CSS boundaries", () => {
  it("uses per-row CSS connector segments instead of Unicode branch glyphs", () => {
    expect(viewSource).toContain("konqueror-tree-branch-gutter");
    expect(viewSource).toContain("getKonquerorTreePresentation");
    expect(viewSource).not.toMatch(/[│├└─]/);
    expect(css).toContain(".konqueror-tree-current-branch.is-tee::before");
    expect(css).toContain(".konqueror-tree-current-branch.is-elbow::before");
    expect(css).toContain(".konqueror-tree-ancestor-segment.is-continuing::after");
    expect(viewSource).not.toContain('currentBranch === "root"');
    expect(viewSource).not.toContain("tree-root-stem");
  });

  it("keeps the square expander and hierarchy gutter inside the Tree Name cell", () => {
    const expander = getRule(".konqueror-tree-expander");
    const expanderBox = getRule(".konqueror-tree-expander__box");
    const expanderSlot = getRule(".konqueror-tree-expander-slot");
    const nameCell = getRule(".konqueror-directory-cell--name");

    expect(expander).toContain("width: var(--kde-tree-indent-step)");
    expect(expander).not.toContain("border-radius");
    expect(expander).not.toContain("transition");
    expect(expander).toContain("place-items: center");
    expect(expanderBox).toContain("width: var(--kde-tree-expander-size)");
    expect(expanderBox).toContain("height: var(--kde-tree-expander-size)");
    expect(expanderBox).toContain("border: 1px solid currentColor");
    expect(nameCell).toContain("min-width: 0");
    expect(expanderSlot).toContain("display: grid");
    expect(expanderSlot).toContain("place-items: center");
    expect(css).toContain("--kde-tree-expander-size: 9px;");
    expect(css).toContain("--kde-tree-expander-icon-gap: 4px;");
    expect(css).toContain("margin-right: var(--kde-tree-expander-icon-gap);");
    expect(viewSource).toContain("tabIndex={-1}");
    expect(viewSource).toContain("konqueror-tree-expander__box");
  });

  it("overlaps vertical connector segments across actual row boundaries", () => {
    const nameCell = getRule(".konqueror-directory-cell--name");
    const gutter = getRule(".konqueror-tree-branch-gutter");
    const expanderSlot = getRule(".konqueror-tree-expander-slot");

    expect(nameCell).toContain("align-self: stretch");
    expect(nameCell).toContain("padding: 0 6px");
    expect(gutter).toContain("align-self: stretch");
    expect(css).toContain(".konqueror-tree-ancestor-segment,\n.konqueror-tree-current-branch {\n  position: relative;");
    expect(css).toContain("  align-self: stretch;\n  min-height: 0;\n}\n\n.konqueror-tree-expander-slot");
    expect(expanderSlot).toContain("place-items: center");
    expect(expanderSlot).toContain("height: var(--kde-tree-indent-step)");
    expect(expanderSlot).toContain("align-self: center");
    expect(css).toContain("--kde-tree-row-connector-overlap: 1px;");
    expect(css).toContain("top: calc(-1 * var(--kde-tree-row-connector-overlap));");
    expect(css).toContain("bottom: calc(-1 * var(--kde-tree-row-connector-overlap));");
    expect(css).toContain(".konqueror-tree-current-branch.is-elbow::before {\n  top: calc(-1 * var(--kde-tree-row-connector-overlap));\n  bottom: 50%;");
  });

  it("limits Tree selection paint to the shrinking Name label without changing Icon selection", () => {
    const selectedRow = getRule(".konqueror-directory-row.is-selected");
    const selectedLabel = getRule(".konqueror-tree-label.is-selected");
    const label = getRule(".konqueror-tree-label");

    expect(selectedRow).not.toContain("var(--kde-menu-selection)");
    expect(selectedLabel).toContain("background: var(--kde-menu-selection)");
    expect(selectedLabel).toContain("color: var(--kde-menu-selection-text)");
    expect(selectedLabel).toContain("border-radius: 0");
    expect(label).toContain("flex: 0 1 auto");
    expect(label).not.toContain("flex-grow");
    expect(css).toContain(".konqueror-icon-item.is-selected {");
    expect(css).toContain(".konqueror-tree-expander-slot.has-branch-connector::before {\n  position: absolute;\n  display: block;\n  background: var(--kde-border-dark);");
    expect(selectedLabel).toContain("box-shadow: none");
  });

  it("keeps the glyph centered inside the visible square while removing only Tree body separators", () => {
    const row = getRule(".konqueror-directory-row");
    const header = getRule(".konqueror-directory-header");

    expect(row).not.toContain("border-bottom");
    expect(header).toContain("border-bottom: 1px solid var(--kde-border-mid)");
    expect(css).toContain(".konqueror-tree-expander__box::before {\n  top: 50%;\n  left: 50%;\n  width: 5px;\n  height: 1px;");
    expect(css).toContain(".konqueror-tree-expander__box::after {\n  top: 50%;\n  left: 50%;\n  width: 1px;\n  height: 5px;");
    expect(css).toContain(".konqueror-tree-expander[aria-expanded=\"true\"] .konqueror-tree-expander__box::after {");
    expect(css).not.toContain("linear-gradient(currentColor, currentColor)");
  });

  it("keeps Tree rows gap-free without tying branch height to the centered expander", () => {
    const tree = getRule(".konqueror-directory-view");
    const row = getRule(".konqueror-directory-row");
    const expander = getRule(".konqueror-tree-expander");

    expect(tree).not.toContain("row-gap");
    expect(row).not.toContain("margin");
    expect(css).toContain(".konqueror-tree-ancestor-segment,\n.konqueror-tree-current-branch {");
    expect(css).not.toContain(".konqueror-tree-current-branch {\n  height: 16px");
    expect(expander).toContain("width: var(--kde-tree-indent-step)");
    expect(expander).toContain("height: var(--kde-tree-indent-step)");
  });

  it("uses the rendered Tree label as marquee geometry while keeping Icon items on their existing geometry", () => {
    expect(viewSource).toContain('marqueeHitTargetSelector: ".konqueror-tree-label"');
    expect(marqueeSource).toContain("marqueeHitTargetSelector?: string");
    expect(marqueeSource).toContain("itemElement.querySelector<HTMLElement>(marqueeHitTargetSelector)");
  });
});
