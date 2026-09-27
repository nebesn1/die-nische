import { describe, expect, it } from "vitest";
import { getMobileWindowPresentationPolicy, shouldKeepWindowFullyContained } from "./mobileWindowPresentation";

describe("mobile window presentation policy", () => {
  it("keeps Calendar as the sole normal-window exception", () => {
    expect(getMobileWindowPresentationPolicy("calendar")).toBe("normal");
  });

  it.each(["konqueror", "kwrite", "kcontrol", "kcalc"])("enforces mobile maximization for %s", (appId) => {
    expect(getMobileWindowPresentationPolicy(appId)).toBe("enforced-maximized");
  });

  it("uses stable application identity rather than a window title", () => {
    expect(getMobileWindowPresentationPolicy("Calendar")).toBe("enforced-maximized");
  });

  it("does not change the policy lookup based on desktop presentation", () => {
    expect(getMobileWindowPresentationPolicy("calendar")).toBe("normal");
    expect(getMobileWindowPresentationPolicy("konqueror")).toBe("enforced-maximized");
  });

  it("keeps Calendar fully contained when its viewport profile is reconciled", () => {
    expect(shouldKeepWindowFullyContained("calendar")).toBe(true);
    expect(shouldKeepWindowFullyContained("konqueror")).toBe(false);
  });
});
