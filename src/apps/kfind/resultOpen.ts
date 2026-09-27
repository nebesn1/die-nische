import {
  planKonquerorNodeOpen,
  type KonquerorNodeOpenPlan,
} from "../konqueror/openNodePlan";

export type KFindResultOpenPlan = KonquerorNodeOpenPlan;

/** Resolves a saved result id against the latest VFS state before opening it. */
export const planKFindResultOpen = planKonquerorNodeOpen;
