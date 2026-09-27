import { describe, expect, it } from "vitest";
import {
  beginKCalcFocusRequest,
  cancelKCalcFocusRequest,
  completeKCalcFocusRequest,
  initialKCalcFocusRequestState,
  shouldScheduleKCalcFocus,
} from "./kcalcFocusRequest";

describe("KCalc focus request lifecycle", () => {
  it("consumes an active request that already exists at initial mount", () => {
    expect(shouldScheduleKCalcFocus(initialKCalcFocusRequestState, true, 5)).toBe(true);

    const pending = beginKCalcFocusRequest(initialKCalcFocusRequestState, 5);
    const completed = completeKCalcFocusRequest(pending, 5, true);

    expect(completed).toEqual({ handledFocusRequestId: 5, pendingFocusRequestId: null });
    expect(shouldScheduleKCalcFocus(completed, true, 5)).toBe(false);
  });

  it("leaves a request unhandled when StrictMode cleanup cancels its first animation frame", () => {
    const pending = beginKCalcFocusRequest(initialKCalcFocusRequestState, 5);
    const cancelled = cancelKCalcFocusRequest(pending, 5);

    expect(cancelled).toEqual(initialKCalcFocusRequestState);
    expect(shouldScheduleKCalcFocus(cancelled, true, 5)).toBe(true);
  });

  it("accepts a request that arrives after an initially inactive mount", () => {
    expect(shouldScheduleKCalcFocus(initialKCalcFocusRequestState, false, 0)).toBe(false);
    expect(shouldScheduleKCalcFocus(initialKCalcFocusRequestState, true, 6)).toBe(true);

    const completed = completeKCalcFocusRequest(
      beginKCalcFocusRequest(initialKCalcFocusRequestState, 6),
      6,
      true,
    );

    expect(completed).toEqual({ handledFocusRequestId: 6, pendingFocusRequestId: null });
  });

  it("marks a request complete only after the exact calculator root owns focus", () => {
    const pending = beginKCalcFocusRequest(initialKCalcFocusRequestState, 5);
    const rejected = completeKCalcFocusRequest(pending, 5, false);

    expect(rejected).toEqual(initialKCalcFocusRequestState);
    expect(shouldScheduleKCalcFocus(rejected, true, 5)).toBe(true);
  });

  it("does not schedule duplicate or inactive requests", () => {
    const completed = completeKCalcFocusRequest(
      beginKCalcFocusRequest(initialKCalcFocusRequestState, 5),
      5,
      true,
    );

    expect(shouldScheduleKCalcFocus(completed, true, 5)).toBe(false);
    expect(shouldScheduleKCalcFocus(initialKCalcFocusRequestState, false, 6)).toBe(false);
    expect(shouldScheduleKCalcFocus(initialKCalcFocusRequestState, true, 0)).toBe(false);
  });

  it("keeps separate KCalc focus lifecycles independent", () => {
    const first = completeKCalcFocusRequest(
      beginKCalcFocusRequest(initialKCalcFocusRequestState, 5),
      5,
      true,
    );
    const second = completeKCalcFocusRequest(
      beginKCalcFocusRequest(initialKCalcFocusRequestState, 8),
      8,
      true,
    );

    expect(first).toEqual({ handledFocusRequestId: 5, pendingFocusRequestId: null });
    expect(second).toEqual({ handledFocusRequestId: 8, pendingFocusRequestId: null });
    expect(shouldScheduleKCalcFocus(first, true, 8)).toBe(true);
  });
});
