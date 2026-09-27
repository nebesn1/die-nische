import { describe, expect, it } from "vitest";
import {
  getApplicationWindowId,
  getNextApplicationInstanceSerial,
  initialApplicationInstanceSerialState,
  reserveApplicationInstanceId,
} from "./applicationInstanceIds";

describe("Application Runtime instance ids", () => {
  it("keeps the first window compatible and allocates deterministic later instances", () => {
    expect(getApplicationWindowId("konqueror", 1)).toBe("app:konqueror");
    expect(getApplicationWindowId("konqueror", 2)).toBe("app:konqueror::2");
    expect(getApplicationWindowId("konqueror", 3)).toBe("app:konqueror::3");
  });

  it("seeds serial allocation from existing windows and never uses randomness", () => {
    const first = reserveApplicationInstanceId(initialApplicationInstanceSerialState, "fixture", []);
    const second = reserveApplicationInstanceId(first.state, "fixture", [first.windowId]);
    const afterClosedSecond = reserveApplicationInstanceId(second.state, "fixture", [first.windowId]);

    expect(first.windowId).toBe("app:fixture");
    expect(second.windowId).toBe("app:fixture::2");
    expect(afterClosedSecond.windowId).toBe("app:fixture::3");
    expect(getNextApplicationInstanceSerial("fixture", ["app:fixture", "app:fixture::7"])).toBe(8);
  });
});
