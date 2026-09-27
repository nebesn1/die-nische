import { createContext, useContext } from "react";
import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "./types";

export interface ApplicationRuntimeContextValue {
  getLaunchRequestForWindow(windowId: string): ApplicationLaunchRequest | null;
  getCloseRequestForWindow(windowId: string): ApplicationCloseRequest | null;
  requestWindowClose(windowId: string): void;
  commitWindowClose(windowId: string, requestId: number): void;
  cancelWindowClose(windowId: string, requestId: number): void;
  resetApplicationSession?(): void;
}

export const ApplicationRuntimeContext = createContext<ApplicationRuntimeContextValue | null>(null);

export function useApplicationRuntime(): ApplicationRuntimeContextValue | null {
  return useContext(ApplicationRuntimeContext);
}
