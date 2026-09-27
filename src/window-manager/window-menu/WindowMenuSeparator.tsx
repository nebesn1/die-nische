import type { WindowMenuSeparatorEntry } from "./types";

type WindowMenuSeparatorProps = {
  entry: WindowMenuSeparatorEntry;
};

export function WindowMenuSeparator({ entry }: WindowMenuSeparatorProps) {
  return <li className="window-menu-separator" role="separator" aria-label={entry.id} />;
}
