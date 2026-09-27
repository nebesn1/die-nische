import type { ApplicationCloseBehavior, ApplicationDefinition } from "./types";

export function getApplicationCloseBehavior(
  definition: Pick<ApplicationDefinition, "closeBehavior"> | undefined,
): ApplicationCloseBehavior {
  return definition?.closeBehavior ?? "immediate";
}
