import { describe, expect, it } from "vitest";
import {
  clampKonsoleSelectionRequest,
  createKonsoleSelectionRequest,
  shouldConsumeKonsoleSelectionRequest,
} from "./selectionRequest";

describe("Konsole one-shot selection requests", () => {
  it("creates deterministic one-shot requests without clocks or randomness", () => {
    expect(createKonsoleSelectionRequest(1, 4)).toEqual({
      requestId: 1,
      start: 4,
      end: 4,
    });
    expect(createKonsoleSelectionRequest(2, 0, 3)).toEqual({
      requestId: 2,
      start: 0,
      end: 3,
    });
  });

  it("clamps selection ranges to the current input value length", () => {
    expect(clampKonsoleSelectionRequest(createKonsoleSelectionRequest(1, -3, -1), 5)).toEqual({
      start: 0,
      end: 0,
    });
    expect(clampKonsoleSelectionRequest(createKonsoleSelectionRequest(2, 4, 20), 6)).toEqual({
      start: 4,
      end: 6,
    });
    expect(clampKonsoleSelectionRequest(createKonsoleSelectionRequest(3, 12, 1), 6)).toEqual({
      start: 6,
      end: 6,
    });
  });

  it("consumes only the matching request id", () => {
    const first = createKonsoleSelectionRequest(1, 3);
    const second = createKonsoleSelectionRequest(2, 5);

    expect(shouldConsumeKonsoleSelectionRequest(first, 1)).toBeNull();
    expect(shouldConsumeKonsoleSelectionRequest(second, 1)).toBe(second);
    expect(shouldConsumeKonsoleSelectionRequest(null, 1)).toBeNull();
  });
});
