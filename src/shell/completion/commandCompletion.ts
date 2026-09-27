import { shellCommandDefinitions } from "../commandRegistry";
import { encodeShellCompletionValue } from "./quoting";
import type { ShellCompletionCandidate, ShellCompletionToken } from "./types";

export function getCommandCompletionCandidates(prefix: string): readonly ShellCompletionCandidate[] {
  return shellCommandDefinitions
    .filter((definition) => definition.name.startsWith(prefix))
    .map((definition) => ({
      value: definition.name,
      displayText: definition.name,
      insertionText: `${definition.name} `,
      kind: "command",
    }));
}

export function getHelpTopicCompletionCandidates(prefix: string, token: ShellCompletionToken): readonly ShellCompletionCandidate[] {
  return shellCommandDefinitions.flatMap((definition): readonly ShellCompletionCandidate[] => {
    if (!definition.name.startsWith(prefix)) {
      return [];
    }

    const encoded = encodeShellCompletionValue(definition.name, token.quoteMode);

    return encoded === null
      ? []
      : [
          {
            value: definition.name,
            displayText: definition.name,
            insertionText: encoded,
            kind: "command",
          },
        ];
  });
}
