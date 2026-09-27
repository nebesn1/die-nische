import type { ApplicationDefinition, ApplicationInstancePolicy } from "./types";

export function getApplicationInstancePolicy(
  definition: Pick<ApplicationDefinition, "instancePolicy"> | undefined,
): ApplicationInstancePolicy {
  return definition?.instancePolicy ?? "singleton";
}
