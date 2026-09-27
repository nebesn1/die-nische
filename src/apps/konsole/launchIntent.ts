export interface KonsoleWorkingDirectoryIntent {
  readonly type: "open-working-directory";
  readonly workingDirectory: string;
}

/** Creates the per-window initialization intent for a filesystem-backed terminal session. */
export function createKonsoleWorkingDirectoryIntent(workingDirectory: string): KonsoleWorkingDirectoryIntent {
  return {
    type: "open-working-directory",
    workingDirectory,
  };
}

export function isKonsoleWorkingDirectoryIntent(value: unknown): value is KonsoleWorkingDirectoryIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown; readonly workingDirectory?: unknown };

  return candidate.type === "open-working-directory"
    && typeof candidate.workingDirectory === "string"
    && candidate.workingDirectory.startsWith("/");
}
