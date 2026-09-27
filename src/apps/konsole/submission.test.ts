import { describe, expect, it } from "vitest";
import { createInitialShellSession } from "../../shell";
import { createInitialVfsState } from "../../vfs/initialState";
import { submitKonsoleShellInput } from "./submission";

const environment = {
  now: () => "2003-04-06T12:30:00.000Z",
};

describe("Konsole prompt-only submission", () => {
  it("turns empty and whitespace-only Enter submissions into normalized prompt-only transcript entries", () => {
    const state = createInitialVfsState();
    const inputs = ["", " ", "\t", " \t ", ""];
    const result = inputs.reduce(
      (session, input) => submitKonsoleShellInput(session, state, input, environment).session,
      createInitialShellSession(state),
    );

    expect(submitKonsoleShellInput(createInitialShellSession(state), state, "", environment).execution).toBeNull();
    expect(result.transcript).toEqual(inputs.map((_, index) => ({
      id: index + 1,
      input: "",
      cwdPath: "/home/user",
      output: [],
      exitCode: 0,
    })));
    expect(result.commandHistory).toEqual([]);
    expect(result.nextTranscriptEntryId).toBe(6);
    expect(state.revision).toBe(0);
  });

  it("uses a cwd prompt snapshot without changing normal command execution", () => {
    const state = createInitialVfsState();
    const changedDirectory = submitKonsoleShellInput(createInitialShellSession(state), state, "cd Documents", environment);
    const blank = submitKonsoleShellInput(changedDirectory.session, state, "", environment);
    const returnedHome = submitKonsoleShellInput(blank.session, state, "cd ..", environment);

    expect(blank.session.transcript.at(-1)).toMatchObject({ input: "", cwdPath: "/home/user/Documents", output: [] });
    expect(returnedHome.session.transcript.at(-2)?.cwdPath).toBe("/home/user/Documents");
    expect(returnedHome.session.commandHistory).toEqual(["cd Documents", "cd .."]);
  });
});
