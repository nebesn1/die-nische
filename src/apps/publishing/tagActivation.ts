import type { MouseEvent } from "react";
import { formatPublishedTagHash } from "../../vfs/publishedTagRoutes";

type TagActivationHandler = (tag: string) => void;

/** Leaves modified activation to the browser while ordinary activation selects the exact tag in this window. */
export function activatePublishedTagPermalink(
  event: MouseEvent<HTMLAnchorElement>,
  tag: string,
  onActivateTag: TagActivationHandler,
): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  const canonicalHash = formatPublishedTagHash(tag);
  if (window.location.hash !== canonicalHash) {
    window.history.pushState(null, "", canonicalHash);
  }
  onActivateTag(tag);
}
