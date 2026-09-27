import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KMenuIcon, KonquerorIcon, KonquerorOpenIcon } from "./IconComponents";

const getAttributeValues = (markup: string, attribute: string): readonly string[] =>
  Array.from(markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g")), (match) => match[1]);

describe("Konqueror SVG icon definitions", () => {
  it("gives each standard icon instance an isolated gradient definition", () => {
    const markup = renderToStaticMarkup(<><KonquerorIcon /><KonquerorIcon /></>);
    const gradientIds = getAttributeValues(markup, "id");
    const fills = getAttributeValues(markup, "fill");

    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
    expect(fills).toContain(`url(#${gradientIds[0]})`);
    expect(fills).toContain(`url(#${gradientIds[1]})`);
  });

  it("keeps the open icon gradient isolated from other instances", () => {
    const markup = renderToStaticMarkup(<><KonquerorOpenIcon /><KonquerorOpenIcon /></>);
    const gradientIds = getAttributeValues(markup, "id");

    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
  });

  it("uses independent launcher geometry for K Menu instead of a K-shaped identity mark", () => {
    const markup = renderToStaticMarkup(<KMenuIcon />);

    expect(markup).toContain('aria-label="K Menu"');
    expect(markup).toContain('data-icon-family="k-menu"');
    expect(markup).not.toContain("M7 41h13V27");
  });
});
