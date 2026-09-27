import { createContext, useContext } from "react";
import type { LaunchApplicationOptions, LaunchApplicationResult } from "./types";

export interface ApplicationLauncherContextValue {
  launchApplication: (appId: string, options?: LaunchApplicationOptions) => LaunchApplicationResult;
  launchNewApplicationInstance: (appId: string, options?: LaunchApplicationOptions) => LaunchApplicationResult;
  launchUserApplication?: (appId: string, options?: LaunchApplicationOptions) => LaunchApplicationResult;
  launchNewUserApplicationInstance?: (appId: string, options?: LaunchApplicationOptions) => LaunchApplicationResult;
}

export const ApplicationLauncherContext = createContext<ApplicationLauncherContextValue | null>(null);

export function useApplicationLauncher(): ApplicationLauncherContextValue {
  const context = useContext(ApplicationLauncherContext);

  if (!context) {
    throw new Error("useApplicationLauncher must be used inside ApplicationRuntimeProvider");
  }

  return context;
}
