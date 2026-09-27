import type { ShellCompletionCandidate } from "../../shell";

interface KonsoleCompletionCandidatesProps {
  readonly candidates: readonly ShellCompletionCandidate[];
}

export function KonsoleCompletionCandidates({ candidates }: KonsoleCompletionCandidatesProps) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="konsole-completion-candidates" role="status" aria-live="polite">
      {candidates.map((candidate, index) => (
        <span
          key={`${candidate.kind}:${candidate.value}:${index}`}
          className={`konsole-completion-candidate konsole-completion-candidate--${candidate.kind}`}
          data-konsole-completion-kind={candidate.kind}
        >
          {candidate.displayText}
        </span>
      ))}
    </div>
  );
}
