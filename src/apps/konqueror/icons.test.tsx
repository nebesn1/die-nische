import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorNodeIcon } from "./icons";

describe("Konqueror file icons", () => {
  it("renders distinct KDE-style labels for the supported file families", () => {
    const iconIds = ["text-file", "markdown-file", "html-file", "image-file", "video-file", "music-file"] as const;
    const markup = iconIds.map((iconId) => renderToStaticMarkup(<KonquerorNodeIcon iconId={iconId} />));

    expect(markup.map((svg) => svg.match(/aria-label="([^"]+)"/)?.[1])).toEqual([
      "Text file",
      "Markdown file",
      "HTML file",
      "Image file",
      "Video file",
      "Music file",
    ]);
    expect(new Set(markup).size).toBe(iconIds.length);
  });
});
