export type MarkdownFrontMatterPublication = {
  readonly status: "draft" | "published";
  readonly slug?: string;
  readonly aliases?: readonly string[];
  readonly publishedAt?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
};

export type ParsedMarkdownFrontMatter = {
  readonly hasFrontMatter: boolean;
  readonly frontMatter: Record<string, unknown> | null;
  readonly body: string;
  readonly document: unknown;
  readonly lineEnding: "\n" | "\r\n";
  readonly hasBom: boolean;
};

export function parseMarkdownFrontMatter(rawText: string, sourceLabel?: string): ParsedMarkdownFrontMatter;
export function normalizeMarkdownPublication(value: unknown, context?: string, version?: number): MarkdownFrontMatterPublication;
export function resolveMarkdownFrontMatter(frontMatter: Record<string, unknown> | null, sourceLabel?: string): { readonly title?: string; readonly publication?: MarkdownFrontMatterPublication };
export function getPublicationDifferences(left: MarkdownFrontMatterPublication | undefined, right: MarkdownFrontMatterPublication | undefined): readonly string[];
export function isSafeMarkdownFrontMatterText(value: unknown): value is string;
export function isStrictMarkdownPublicationTimestamp(value: unknown): value is string;
export function isStrictMarkdownPublicationRouteToken(value: unknown): value is string;
export function serializeMarkdownFrontMatterValue(value: Record<string, unknown>, lineEnding?: "\n" | "\r\n"): string;
export function serializeMarkdownFrontMatterDocument(document: unknown, lineEnding?: "\n" | "\r\n"): string;

