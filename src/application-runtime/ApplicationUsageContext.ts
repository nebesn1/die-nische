import { createContext, useContext } from "react";
import type { ApplicationUsageState } from "./applicationUsage";

export const ApplicationUsageContext = createContext<ApplicationUsageState | null>(null);

export function useApplicationUsage(): ApplicationUsageState {
  const usage = useOptionalApplicationUsage();

  if (!usage) {
    throw new Error("useApplicationUsage must be used inside ApplicationRuntimeProvider");
  }

  return usage;
}

export function useOptionalApplicationUsage(): ApplicationUsageState | null {
  return useContext(ApplicationUsageContext);
}
