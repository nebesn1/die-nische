import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";

export type KWriteRecentFile = { readonly nodeId: string; readonly path: string; readonly name: string };
type Value = { readonly recentFiles: readonly KWriteRecentFile[]; addRecentFile(file: KWriteRecentFile): void };
// The session-wide recent list is intentionally independent of every KWrite buffer.
// eslint-disable-next-line react-refresh/only-export-components
export const KWriteRecentFilesContext = createContext<Value>({ recentFiles: [], addRecentFile: () => undefined });

export function KWriteRecentFilesProvider({ children }: { readonly children: ReactNode }) {
  const [recentFiles, setRecentFiles] = useState<readonly KWriteRecentFile[]>([]);
  const addRecentFile = useCallback((file: KWriteRecentFile) => {
    setRecentFiles((current) => [file, ...current.filter((item) => item.nodeId !== file.nodeId)] .slice(0, 10));
  }, []);
  const value = useMemo(() => ({ recentFiles, addRecentFile }), [recentFiles, addRecentFile]);
  return <KWriteRecentFilesContext.Provider value={value}>{children}</KWriteRecentFilesContext.Provider>;
}
