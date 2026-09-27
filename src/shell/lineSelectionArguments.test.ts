import { describe, expect, it } from "vitest";
import { parseShellLineSelectionArguments } from "./lineSelectionArguments";

describe("parseShellLineSelectionArguments", () => {
  it("defaults to 10 lines for a single path", () => {
    expect(parseShellLineSelectionArguments("head", ["File.txt"])).toEqual({
      ok: true,
      value: {
        count: 10,
        path: "File.txt",
      },
    });
  });

  it("parses -n counts including zero and leading zeroes", () => {
    expect(parseShellLineSelectionArguments("tail", ["-n", "0", "File.txt"])).toMatchObject({
      ok: true,
      value: { count: 0, path: "File.txt" },
    });
    expect(parseShellLineSelectionArguments("tail", ["-n", "01", "File.txt"])).toMatchObject({
      ok: true,
      value: { count: 1, path: "File.txt" },
    });
  });

  it("rejects invalid counts, options, and argument counts", () => {
    expect(parseShellLineSelectionArguments("head", ["-n", "-1", "File.txt"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT", message: "head: invalid line count: -1" },
    });
    expect(parseShellLineSelectionArguments("head", ["-n", "1.5", "File.txt"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(parseShellLineSelectionArguments("head", ["-n", "1e3", "File.txt"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(parseShellLineSelectionArguments("head", ["-n", "9007199254740992", "File.txt"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(parseShellLineSelectionArguments("tail", ["-x", "File.txt"])).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_OPTION", message: "tail: unsupported option: -x" },
    });
    expect(parseShellLineSelectionArguments("tail", ["A.txt", "B.txt"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT_COUNT" },
    });
    expect(parseShellLineSelectionArguments("tail", ["-n"])).toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT_COUNT" },
    });
  });
});
