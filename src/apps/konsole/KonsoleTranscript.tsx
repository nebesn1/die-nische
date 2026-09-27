import type { ShellTranscriptEntry } from "../../shell/types";
import { KonsolePrompt } from "./KonsolePrompt";

interface KonsoleTranscriptProps {
  readonly entries: readonly ShellTranscriptEntry[];
}

export function KonsoleTranscript({ entries }: KonsoleTranscriptProps) {
  return (
    <>
      {entries.map((entry) => (
        <div key={entry.id} className="konsole-transcript-entry">
          <div className="konsole-transcript-command">
            <KonsolePrompt path={entry.cwdPath} />
            <span className="konsole-command-text">{entry.input}</span>
          </div>
          {entry.output.length > 0 ? (
            <div className="konsole-output">
              {entry.output.map((chunk, chunkIndex) => (
                <div
                  key={`${entry.id}:${chunkIndex}`}
                  className={`konsole-output-chunk konsole-output-chunk--${chunk.stream}`}
                  data-konsole-stream={chunk.stream}
                >
                  {chunk.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
