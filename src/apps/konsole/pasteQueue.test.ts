import { describe, expect, it } from "vitest";
import {
  consumeKonsoleQueuedCommand,
  enqueueKonsoleCommands,
  initialKonsolePasteQueueState,
} from "./pasteQueue";

describe("Konsole paste queue", () => {
  it("enqueues commands in deterministic FIFO order with distinct ids", () => {
    const first = enqueueKonsoleCommands(initialKonsolePasteQueueState, ["pwd", "pwd"]);
    const second = enqueueKonsoleCommands(first, ["ls"]);

    expect(first.items).toEqual([{ id: 1, input: "pwd" }, { id: 2, input: "pwd" }]);
    expect(second.items).toEqual([{ id: 1, input: "pwd" }, { id: 2, input: "pwd" }, { id: 3, input: "ls" }]);
    expect(second.nextId).toBe(4);
    expect(initialKonsolePasteQueueState.items).toEqual([]);
  });

  it("consumes only the current head once and leaves stale ids untouched", () => {
    const queued = enqueueKonsoleCommands(initialKonsolePasteQueueState, ["pwd", "ls"]);
    const stale = consumeKonsoleQueuedCommand(queued, 2);
    const consumed = consumeKonsoleQueuedCommand(queued, 1);

    expect(stale).toBe(queued);
    expect(consumed.items).toEqual([{ id: 2, input: "ls" }]);
    expect(consumeKonsoleQueuedCommand(consumed, 1)).toBe(consumed);
  });
});
