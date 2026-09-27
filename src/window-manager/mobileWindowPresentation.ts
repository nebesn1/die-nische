export type MobileWindowPresentationPolicy = "normal" | "enforced-maximized";

/** Stable application IDs that retain a compact normal window on mobile. */
const mobileNormalWindowApplicationIds = new Set(["calendar"]);

export function getMobileWindowPresentationPolicy(applicationId: string): MobileWindowPresentationPolicy {
  return mobileNormalWindowApplicationIds.has(applicationId) ? "normal" : "enforced-maximized";
}

/** Calendar placement must stay fully contained when a viewport is reconciled. */
export function shouldKeepWindowFullyContained(applicationId: string): boolean {
  return mobileNormalWindowApplicationIds.has(applicationId);
}
