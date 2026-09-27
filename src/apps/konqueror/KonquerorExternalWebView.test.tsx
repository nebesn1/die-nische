import { readFileSync } from "node:fs";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KonquerorExternalWebView } from "./KonquerorExternalWebView";

describe("KonquerorExternalWebView", () => {
  it("hosts the canonical HTTPS location in a constrained content iframe", () => {
    const markup = renderToStaticMarkup(
      <KonquerorExternalWebView
        canonicalUrl="https://www.example.com/"
        externalWebSurfaceRef={createRef<HTMLIFrameElement>()}
        loadRequest={{ canonicalUrl: "https://www.example.com/", generation: 4, status: "loading" }}
        onLoad={() => undefined}
        zoomLevel={125}
      />,
    );

    expect(markup).toContain('class="konqueror-external-web-view"');
    expect(markup).toContain('src="https://www.example.com/"');
    expect(markup).toContain('title="External web page: https://www.example.com/"');
    expect(markup).toContain('sandbox="allow-forms allow-scripts"');
    expect(markup).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(markup).toContain('data-external-load-generation="4"');
    expect(markup).toContain('data-external-web-zoom="125"');
    expect(markup).toContain('width:80%');
    expect(markup).toContain('height:80%');
    expect(markup).toContain('transform:scale(1.25)');
    expect(markup).toContain('transform-origin:top left');
    expect(markup).not.toContain("allow-top-navigation");
    expect(markup).not.toContain("allow-same-origin");
    expect(markup).not.toContain("allow-popups");
  });

  it("renders the stopped notice without keeping a frame mounted", () => {
    const stopped = renderToStaticMarkup(
      <KonquerorExternalWebView
        canonicalUrl="https://www.example.com/"
        externalWebSurfaceRef={createRef<HTMLIFrameElement>()}
        loadRequest={{ canonicalUrl: "https://www.example.com/", generation: 5, status: "stopped" }}
        onLoad={() => undefined}
        zoomLevel={125}
      />,
    );

    expect(stopped).toContain("Loading stopped.");
    expect(stopped).toContain("Use Reload to load the page again.");
    expect(stopped).not.toContain("<iframe");
  });

  it("does not load, rewrite, or elevate remote content in the parent page", () => {
    const source = readFileSync(new URL("./KonquerorExternalWebView.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("window.open");
    expect(source).not.toContain("window.top");
    expect(source).not.toContain("contentDocument");
    expect(source).not.toContain("contentWindow");
    expect(source).not.toContain("postMessage");
    expect(source).not.toContain("onerror");
    expect(source).not.toContain("onError");
    expect(source).not.toContain("allow-top-navigation");
    expect(source).not.toContain("setTimeout");
  });
});
