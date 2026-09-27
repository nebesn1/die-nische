import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../vfs/initialState";
import { executeShellInput } from "./execution";
import { createInitialShellSession } from "./session";

const outputText = (result: ReturnType<typeof executeShellInput>): string =>
  result.execution?.output.map((chunk) => chunk.text).join("") ?? "";

describe("history command", () => {
  it("renders prior current-session commands in 1-based oldest-to-newest order", () => {
    const state = createInitialVfsState();
    const pwd = executeShellInput(createInitialShellSession(state), state, "pwd");
    const ls = executeShellInput(pwd.session, state, "ls");
    const history = executeShellInput(ls.session, state, "history");
    const secondHistory = executeShellInput(history.session, state, "history");

    expect(outputText(history)).toBe("1  pwd\n2  ls\n");
    expect(history.session.commandHistory).toEqual(["pwd", "ls", "history"]);
    expect(outputText(secondHistory)).toBe("1  pwd\n2  ls\n3  history\n");
    expect(secondHistory.execution?.exitCode).toBe(0);
  });

  it("supports latest-count selection without renumbering and accepts zero as empty output", () => {
    const state = createInitialVfsState();
    let result = createInitialShellSession(state);

    for (const input of ["echo A", "echo A", "cd Missing", "clear"]) {
      result = executeShellInput(result, state, input).session;
    }

    const latest = executeShellInput(result, state, "history 2");
    const zero = executeShellInput(latest.session, state, "history 0");
    const all = executeShellInput(zero.session, state, "history 999");

    expect(outputText(latest)).toBe("3  cd Missing\n4  clear\n");
    expect(outputText(zero)).toBe("");
    expect(outputText(all)).toBe("1  echo A\n2  echo A\n3  cd Missing\n4  clear\n5  history 2\n6  history 0\n");
    expect(all.session.commandHistory).toEqual([
      "echo A",
      "echo A",
      "cd Missing",
      "clear",
      "history 2",
      "history 0",
      "history 999",
    ]);
    expect(state.revision).toBe(0);
  });

  it("does not record whitespace-only input and preserves history text as plain output", () => {
    const state = createInitialVfsState();
    const command = 'echo "<script>alert(1)</script>"';
    const first = executeShellInput(createInitialShellSession(state), state, command);
    const whitespace = executeShellInput(first.session, state, " \t ");
    const history = executeShellInput(whitespace.session, state, "history");

    expect(whitespace.session).toBe(first.session);
    expect(outputText(history)).toBe(`1  ${command}\n`);
    expect(history.execution?.output[0]?.stream).toBe("stdout");
  });

  it("reports invalid arguments without changing VFS", () => {
    const state = createInitialVfsState();
    const result = executeShellInput(createInitialShellSession(state), state, "history -1");

    expect(result.execution?.exitCode).toBe(2);
    expect(outputText(result)).toBe("history: invalid count: -1");
    expect(result.session.commandHistory).toEqual(["history -1"]);
    expect(state.revision).toBe(0);
  });
});
