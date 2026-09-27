import type { VfsState } from "../../vfs/types";
import { getKonquerorTabLabel } from "./konquerorCaption";
import { getKonquerorCurrentPath } from "./navigationController";
import { getCurrentKonquerorLocationTarget } from "./navigationState";
import type { KonquerorBookmarkDraft } from "./bookmarks";
import type { KonquerorTabSession } from "./konquerorTabs";
import type { KonquerorNavigationState } from "./navigationTypes";

/** Derives one tab's existing canonical location and visible title without changing tab order. */
export function getKonquerorBookmarkDraftForNavigation(
  state: VfsState,
  navigationState: KonquerorNavigationState,
): KonquerorBookmarkDraft | null {
  const location = getKonquerorCurrentPath(state, navigationState);
  if (!location.ok || location.value.length === 0) {
    return null;
  }

  const name = getKonquerorTabLabel(state, getCurrentKonquerorLocationTarget(navigationState)).trim();
  return { name: name || location.value, location: location.value };
}

/** Retains the accepted Phase 5.48.1 active-tab command surface. */
export function getKonquerorActiveBookmarkDraft(
  state: VfsState,
  navigationState: KonquerorNavigationState,
): KonquerorBookmarkDraft | null {
  return getKonquerorBookmarkDraftForNavigation(state, navigationState);
}

/** Maps the invoking window's ordered tab sessions to independently bookmarkable drafts. */
export function getKonquerorBookmarkDraftsForTabs(
  state: VfsState,
  tabs: readonly KonquerorTabSession[],
): readonly KonquerorBookmarkDraft[] {
  return tabs.flatMap((tab) => {
    const draft = getKonquerorBookmarkDraftForNavigation(state, tab.navigationState);
    return draft === null ? [] : [draft];
  });
}
