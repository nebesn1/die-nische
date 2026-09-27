export interface KonsoleQueuedCommand {
  readonly id: number;
  readonly input: string;
}

export interface KonsolePasteQueueState {
  readonly items: readonly KonsoleQueuedCommand[];
  readonly nextId: number;
}

export const initialKonsolePasteQueueState: KonsolePasteQueueState = Object.freeze({
  items: [],
  nextId: 1,
});

export function enqueueKonsoleCommands(
  state: KonsolePasteQueueState,
  inputs: readonly string[],
): KonsolePasteQueueState {
  if (inputs.length === 0) {
    return state;
  }

  const items = inputs.map((input, index) => ({
    id: state.nextId + index,
    input,
  }));

  return {
    items: [...state.items, ...items],
    nextId: state.nextId + items.length,
  };
}

export function consumeKonsoleQueuedCommand(
  state: KonsolePasteQueueState,
  itemId: number,
): KonsolePasteQueueState {
  if (state.items[0]?.id !== itemId) {
    return state;
  }

  return {
    ...state,
    items: state.items.slice(1),
  };
}
