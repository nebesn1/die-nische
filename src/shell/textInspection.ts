import { getVfsUtf8ByteSize } from "../vfs/encoding";
import { splitTextIntoPreservedLines } from "./textLines";

export interface ShellTextCounts {
  readonly lines: number;
  readonly words: number;
  readonly bytes: number;
}

export function countShellText(text: string): ShellTextCounts {
  return {
    lines: splitTextIntoPreservedLines(text).length,
    words: text.match(/\S+/gu)?.length ?? 0,
    bytes: getVfsUtf8ByteSize(text),
  };
}
