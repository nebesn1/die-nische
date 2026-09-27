import type { ShellSessionState } from "../../shell";
import type { VfsState } from "../../vfs/types";
import type { KonquerorBookmarkDraft } from "../konqueror/bookmarks";
import { getKonsolePromptPath } from "./promptFormatting";

const normalizeDirectoryLocation = (path: string): string => path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;

export function getKonsoleBookmarkDraft(vfsState: VfsState, session: ShellSessionState): KonquerorBookmarkDraft | null {
  const promptPath = getKonsolePromptPath(vfsState, session.cwdNodeId);
  if (promptPath === "(unavailable)") return null;
  const location = normalizeDirectoryLocation(promptPath);
  return { name: location, location, comment: "" };
}

/** The shell tokenizer treats single quotes as literal spans, so embedded quotes are escaped by adjacent quoted tokens. */
export function quoteKonsoleBookmarkLocation(location: string): string {
  return `'${location.replaceAll("'", "'\\''")}'`;
}

export function buildKonsoleBookmarkCdCommand(location: string): string {
  return `cd ${quoteKonsoleBookmarkLocation(location)}`;
}
