import type { KMenuSeparatorEntry } from "./types";

type KMenuSeparatorProps = {
  entry: KMenuSeparatorEntry;
  variant?: "k-menu" | "context";
};

export function KMenuSeparator({ entry, variant = "k-menu" }: KMenuSeparatorProps) {
  const className = variant === "context"
    ? "k-menu-separator k-context-menu-separator"
    : "k-menu-separator";

  return <li className={className} role="separator" data-menu-item-id={entry.id} />;
}
