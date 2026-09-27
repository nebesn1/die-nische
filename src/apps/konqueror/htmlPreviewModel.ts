export type SafeHtmlPreviewNode =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "image"; readonly alt: string; readonly src: string }
  | {
      readonly type: "element";
      readonly tag: SafeHtmlTag;
      readonly href: string | null;
      readonly attributes: Readonly<Record<string, string | boolean>>;
      readonly children: readonly SafeHtmlPreviewNode[];
    };

export type SafeHtmlTag =
  | "article"
  | "audio"
  | "blockquote"
  | "body"
  | "br"
  | "caption"
  | "code"
  | "dd"
  | "div"
  | "dl"
  | "dt"
  | "em"
  | "footer"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "header"
  | "html"
  | "hr"
  | "i"
  | "li"
  | "main"
  | "ol"
  | "p"
  | "pre"
  | "s"
  | "section"
  | "source"
  | "span"
  | "strong"
  | "table"
  | "tbody"
  | "td"
  | "tfoot"
  | "th"
  | "thead"
  | "tr"
  | "u"
  | "ul"
  | "video"
  | "a";

type MutableElement = {
  readonly type: "element";
  readonly tag: SafeHtmlTag | null;
  readonly href: string | null;
  readonly attributes: Record<string, string | boolean>;
  readonly children: SafeHtmlPreviewNode[];
};

const allowedTags = new Set<SafeHtmlTag>([
  "article", "audio", "blockquote", "body", "br", "caption", "code", "dd", "div", "dl", "dt", "em", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "html",
  "header", "hr", "i", "li", "main", "ol", "p", "pre", "s", "section", "source", "span", "strong", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "video", "a",
]);
const forbiddenTags = new Set([
  "applet", "base", "button", "canvas", "embed", "form", "frame", "frameset", "iframe", "input", "link", "math", "meta", "noscript", "object", "option", "script", "select", "style", "svg", "template", "textarea", "track",
]);
const voidTags = new Set(["br", "hr", "img", "source"]);

const allowedAttributesByTag: Partial<Record<SafeHtmlTag, readonly string[]>> = {
  a: ["href"],
  audio: ["src", "controls", "preload", "loop", "muted"],
  source: ["src", "type", "media"],
  video: ["src", "controls", "poster", "preload", "loop", "muted", "playsinline", "width", "height"],
};
const booleanAttributes = new Set(["controls", "loop", "muted", "playsinline"]);

const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&nbsp;", "\u00a0")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, value: string) => {
      const codePoint = value.toLowerCase().startsWith("x") ? Number.parseInt(value.slice(1), 16) : Number.parseInt(value, 10);
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    });

const readAttribute = (source: string, name: string): string | null => {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = source.match(expression);
  return match ? decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
};

const readAllowedAttributes = (source: string, tag: SafeHtmlTag): Record<string, string | boolean> => {
  const allowed = new Set(allowedAttributesByTag[tag] ?? []);
  if (allowed.size === 0) return {};
  const opening = /^<\s*[a-z0-9-]+/i.exec(source);
  const attributes: Record<string, string | boolean> = {};
  const attributeSource = source.slice(opening?.[0].length ?? 0);
  const expression = /([a-z][a-z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
  for (const match of attributeSource.matchAll(expression)) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;
    attributes[name] = booleanAttributes.has(name)
      ? true
      : decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
};

const append = (stack: MutableElement[], node: SafeHtmlPreviewNode) => {
  stack[stack.length - 1]?.children.push(node);
};

export function parseSafeHtmlPreview(source: string): readonly SafeHtmlPreviewNode[] {
  const root: MutableElement = { type: "element", tag: null, href: null, attributes: {}, children: [] };
  const stack: MutableElement[] = [root];
  let forbiddenDepth = 0;
  const tokens = source.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? [];

  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<!")) {
      continue;
    }

    if (!token.startsWith("<")) {
      if (forbiddenDepth === 0 && token.length > 0) {
        append(stack, { type: "text", value: decodeHtmlEntities(token) });
      }
      continue;
    }

    const closing = /^<\s*\/\s*([a-z0-9-]+)/i.exec(token);
    if (closing) {
      const name = closing[1].toLowerCase();
      if (forbiddenTags.has(name)) {
        forbiddenDepth = Math.max(0, forbiddenDepth - 1);
        continue;
      }
      if (forbiddenDepth > 0) {
        continue;
      }
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === name) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    const opening = /^<\s*([a-z0-9-]+)/i.exec(token);
    if (!opening) {
      continue;
    }
    const name = opening[1].toLowerCase();
    if (forbiddenTags.has(name)) {
      if (!/\/>\s*$/.test(token)) {
        forbiddenDepth += 1;
      }
      continue;
    }
    if (forbiddenDepth > 0) {
      continue;
    }
    if (name === "img") {
      append(stack, { type: "image", alt: readAttribute(token, "alt") ?? "", src: readAttribute(token, "src") ?? "" });
      continue;
    }
    const tag = allowedTags.has(name as SafeHtmlTag) ? (name as SafeHtmlTag) : null;
    const attributes = tag === null ? {} : readAllowedAttributes(token, tag);
    const element: MutableElement = { type: "element", tag, href: tag === "a" ? readAttribute(token, "href") : null, attributes, children: [] };
    if (tag !== null) {
      append(stack, element as SafeHtmlPreviewNode);
    }
    if (tag !== null && !voidTags.has(name) && !/\/>\s*$/.test(token)) {
      stack.push(element);
    }
  }

  return root.children;
}
