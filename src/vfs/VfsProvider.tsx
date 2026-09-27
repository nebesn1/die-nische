import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createInitialVfsState } from "./initialState";
import { VfsContext } from "./VfsContext";
import { createVfsOperations } from "./vfsOperations";
import type { VfsState } from "./types";

type VfsProviderProps = {
  children: ReactNode;
};

export function VfsProvider({ children }: VfsProviderProps) {
  const [state, setState] = useState(createInitialVfsState);
  const stateRef = useRef<VfsState>(state);

  stateRef.current = state;

  const readState = useCallback(() => stateRef.current, []);
  const commitState = useCallback((nextState: VfsState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);
  const operations = useMemo(() => createVfsOperations(readState, commitState), [commitState, readState]);

  const value = useMemo(
    () => ({
      state,
      ...operations,
    }),
    [operations, state],
  );

  return <VfsContext.Provider value={value}>{children}</VfsContext.Provider>;
}
