import { formatKonsolePrompt } from "./promptFormatting";

interface KonsolePromptProps {
  readonly path: string;
}

export function KonsolePrompt({ path }: KonsolePromptProps) {
  return <span className="konsole-prompt">{formatKonsolePrompt(path)} </span>;
}
