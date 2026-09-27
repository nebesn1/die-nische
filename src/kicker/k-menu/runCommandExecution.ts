import type { ApplicationLauncherContextValue } from "../../application-runtime/useApplicationLauncher";
import type { RunCommandPlan } from "./runCommand";

export type RunCommandExecutionResult =
  | { readonly type: "accepted" }
  | { readonly type: "error"; readonly message: string };

type RunCommandExecutionHandlers = Pick<ApplicationLauncherContextValue, "launchApplication" | "launchNewApplicationInstance">;

export function executeRunCommandPlan(
  plan: RunCommandPlan,
  handlers: RunCommandExecutionHandlers,
): RunCommandExecutionResult {
  if (plan.type === "application") {
    handlers.launchApplication(plan.appId);
    return { type: "accepted" };
  }

  if (plan.type === "location") {
    handlers.launchNewApplicationInstance("konqueror", { intent: plan.intent });
    return { type: "accepted" };
  }

  if (plan.type === "shell") {
    return { type: "accepted" };
  }

  return { type: "error", message: plan.message };
}
