import { describe, expect, it } from "vitest";
import { getApplicationDefinition } from "./applicationRegistry";
import { getApplicationCloseBehavior } from "./closePolicy";

describe("application close policy", () => {
  it("defaults applications to immediate close", () => {
    expect(getApplicationCloseBehavior(undefined)).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("kcalc"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("konsole"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("konqueror"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("about-kde"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("about-konqueror"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("about-kwrite"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("about-konsole"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("about-kcalc"))).toBe("immediate");
    expect(getApplicationCloseBehavior(getApplicationDefinition("kfind"))).toBe("immediate");
  });

  it("marks KWrite as application-guarded", () => {
    expect(getApplicationCloseBehavior(getApplicationDefinition("kwrite"))).toBe("application-guarded");
  });
});
