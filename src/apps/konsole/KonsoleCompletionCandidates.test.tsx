import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonsoleCompletionCandidates } from "./KonsoleCompletionCandidates";

describe("KonsoleCompletionCandidates", () => {
  it("renders nothing when there are no candidates", () => {
    expect(renderToStaticMarkup(<KonsoleCompletionCandidates candidates={[]} />)).toBe("");
  });

  it("renders pure text candidates in a status region without buttons or HTML execution", () => {
    const markup = renderToStaticMarkup(
      <KonsoleCompletionCandidates
        candidates={[
          {
            value: "Documents/",
            displayText: "Documents/",
            insertionText: "Documents/",
            kind: "directory",
          },
          {
            value: "<script>.txt",
            displayText: "<script>.txt",
            insertionText: "<script>.txt ",
            kind: "file",
          },
          {
            value: "cat",
            displayText: "cat",
            insertionText: "cat ",
            kind: "command",
          },
        ]}
      />,
    );

    expect(markup).toContain("role=\"status\"");
    expect(markup).toContain("aria-live=\"polite\"");
    expect(markup).toContain("Documents/");
    expect(markup).toContain("&lt;script&gt;.txt");
    expect(markup).toContain("data-konsole-completion-kind=\"directory\"");
    expect(markup).toContain("data-konsole-completion-kind=\"file\"");
    expect(markup).toContain("data-konsole-completion-kind=\"command\"");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<datalist");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
  });
});
