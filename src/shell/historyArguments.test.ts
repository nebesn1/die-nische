import { describe, expect, it } from "vitest";
import { parseHistoryArguments } from "./historyArguments";

describe("parseHistoryArguments", () => {
  it("accepts no count and decimal non-negative safe integer counts", () => {
    expect(parseHistoryArguments([])).toEqual({ ok: true, value: { count: null } });
    expect(parseHistoryArguments(["0"])).toEqual({ ok: true, value: { count: 0 } });
    expect(parseHistoryArguments(["01"])).toEqual({ ok: true, value: { count: 1 } });
    expect(parseHistoryArguments(["9007199254740991"])).toEqual({ ok: true, value: { count: 9007199254740991 } });
  });

  it("rejects invalid counts, unsupported options, and multiple operands", () => {
    expect(parseHistoryArguments(["-1"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT", message: "history: invalid count: -1" },
    });
    expect(parseHistoryArguments(["1.5"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseHistoryArguments(["1e2"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseHistoryArguments(["abc"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseHistoryArguments(["9007199254740992"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(parseHistoryArguments(["-c"])).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_OPTION", message: "history: unsupported option: -c" },
    });
    expect(parseHistoryArguments(["1", "2"])).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT_COUNT" } });
  });
});
