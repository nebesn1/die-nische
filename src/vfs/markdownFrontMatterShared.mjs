import { parseDocument, stringify } from "yaml";

const publicationFields = ["status", "slug", "aliases", "publishedAt", "summary", "tags"];
const publicationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const hasUnsafePlainTextCharacter = (value) => [...value].some((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint !== undefined && (codePoint <= 0x1F || codePoint === 0x7F);
});

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export const isSafeMarkdownFrontMatterText = (value) => typeof value === "string"
  && value.length > 0
  && value.trim() === value
  && !hasUnsafePlainTextCharacter(value);

export const isStrictMarkdownPublicationTimestamp = (value) => {
  if (typeof value !== "string" || !utcTimestampPattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};

export const isStrictMarkdownPublicationRouteToken = (value) =>
  typeof value === "string" && publicationSlugPattern.test(value);

const failPublication = (context, message) => {
  throw new Error(`${context} ${message}`);
};

/** Validates the current v6 publication rules without changing authored values. */
export const normalizeMarkdownPublication = (value, context = "publication", version = 6) => {
  if (!isPlainObject(value)) failPublication(context, "must be an object.");

  const allowedFields = new Set(version === 6
    ? publicationFields
    : version === 5
    ? ["status", "slug", "publishedAt", "summary", "tags"]
    : ["status", "publishedAt", "summary", "tags"]);
  const unknownField = Object.keys(value).find((field) => !allowedFields.has(field));
  if (unknownField) failPublication(context, `has unknown field '${unknownField}'.`);

  if (value.status !== "draft" && value.status !== "published") {
    failPublication(context, "requires status 'draft' or 'published'.");
  }

  if ("slug" in value && !isStrictMarkdownPublicationRouteToken(value.slug)) {
    failPublication(context, "has invalid slug.");
  }

  if ((version === 5 || version === 6) && value.status === "published" && typeof value.slug !== "string") {
    failPublication(context, "published publication requires a slug.");
  }

  if ("aliases" in value) {
    if (typeof value.slug !== "string") failPublication(context, "aliases require a slug.");
    if (!Array.isArray(value.aliases) || value.aliases.length === 0 || value.aliases.some((alias) => !isStrictMarkdownPublicationRouteToken(alias))) {
      failPublication(context, "has invalid aliases.");
    }
    if (new Set(value.aliases).size !== value.aliases.length) failPublication(context, "has duplicate aliases.");
    if (value.aliases.includes(value.slug)) failPublication(context, "alias must differ from slug.");
  }

  if (value.status === "published" && !isStrictMarkdownPublicationTimestamp(value.publishedAt)) {
    failPublication(context, "published publication requires a valid publishedAt timestamp.");
  }

  if (value.status === "draft" && "publishedAt" in value) {
    failPublication(context, "draft publication must not set publishedAt.");
  }

  if ("summary" in value && !isSafeMarkdownFrontMatterText(value.summary)) {
    failPublication(context, "has invalid summary.");
  }

  if ("tags" in value) {
    if (!Array.isArray(value.tags) || value.tags.length === 0 || value.tags.some((tag) => !isSafeMarkdownFrontMatterText(tag))) {
      failPublication(context, "has invalid tags.");
    }
    if (new Set(value.tags).size !== value.tags.length) failPublication(context, "has duplicate tags.");
  }

  return {
    status: value.status,
    ...(typeof value.slug === "string" ? { slug: value.slug } : {}),
    ...(Array.isArray(value.aliases) ? { aliases: [...value.aliases] } : {}),
    ...(typeof value.publishedAt === "string" ? { publishedAt: value.publishedAt } : {}),
    ...(typeof value.summary === "string" ? { summary: value.summary } : {}),
    ...(Array.isArray(value.tags) ? { tags: [...value.tags] } : {}),
  };
};

const parseYamlFrontMatter = (yamlSource, sourceLabel) => {
  const document = parseDocument(yamlSource, { version: "1.2", schema: "core", uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`${sourceLabel} contains invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  }
  if (document.warnings.length > 0) {
    throw new Error(`${sourceLabel} contains ambiguous YAML: ${document.warnings.map((warning) => warning.message).join("; ")}`);
  }
  const value = document.toJS({ mapAsMap: false });
  if (value === null) return { document, value: {} };
  if (!isPlainObject(value)) throw new Error(`${sourceLabel} top level must be a YAML object.`);
  return { document, value };
};

/** Parses only a delimiter at byte zero (apart from an optional UTF-8 BOM). */
export const parseMarkdownFrontMatter = (rawText, sourceLabel = "Markdown document") => {
  const hasBom = rawText.startsWith("\uFEFF");
  const source = hasBom ? rawText.slice(1) : rawText;
  const opening = /^---[ \t]*(?:\r?\n)/.exec(source);

  if (!opening) {
    if (source === "---") throw new Error(`${sourceLabel} has an unterminated front matter opening delimiter.`);
    return { hasFrontMatter: false, frontMatter: null, body: source, document: null, lineEnding: source.includes("\r\n") ? "\r\n" : "\n", hasBom };
  }

  const closingPattern = /^---[ \t]*(?:\r?\n|$)/gm;
  closingPattern.lastIndex = opening[0].length;
  const closing = closingPattern.exec(source);
  if (!closing) throw new Error(`${sourceLabel} has an unterminated front matter block.`);

  const yamlSource = source.slice(opening[0].length, closing.index);
  const parsed = parseYamlFrontMatter(yamlSource, sourceLabel);
  return {
    hasFrontMatter: true,
    frontMatter: parsed.value,
    body: source.slice(closing.index + closing[0].length),
    document: parsed.document,
    lineEnding: source.includes("\r\n") ? "\r\n" : "\n",
    hasBom,
  };
};

export const resolveMarkdownFrontMatter = (frontMatter, sourceLabel = "Markdown front matter") => {
  if (frontMatter === null) return { title: undefined, publication: undefined };
  const title = Object.hasOwn(frontMatter, "title") ? frontMatter.title : undefined;
  if (title !== undefined && !isSafeMarkdownFrontMatterText(title)) {
    throw new Error(`${sourceLabel} title must be non-empty plain text.`);
  }
  const publication = Object.hasOwn(frontMatter, "publication")
    ? normalizeMarkdownPublication(frontMatter.publication, `${sourceLabel} publication`, 6)
    : undefined;
  if (publication !== undefined && title === undefined) {
    throw new Error(`${sourceLabel} publication requires a title.`);
  }
  return { title, publication };
};

const equalValue = (left, right) => Array.isArray(left) && Array.isArray(right)
  ? left.length === right.length && left.every((value, index) => value === right[index])
  : left === right;

export const getPublicationDifferences = (left, right) => publicationFields.filter((field) => !equalValue(left?.[field], right?.[field]));

export const serializeMarkdownFrontMatterValue = (value, lineEnding = "\n") => stringify(value, {
  lineWidth: 0,
}).replaceAll("\n", lineEnding);

export const serializeMarkdownFrontMatterDocument = (document, lineEnding = "\n") => document.toString({ lineWidth: 0 }).replaceAll("\n", lineEnding);
