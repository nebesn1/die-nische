export type KonquerorFocusOwnership = "directory" | "interactive-child" | "blocked" | "external";

export interface KonquerorDirectoryFocusPolicyInput {
  readonly isActive: boolean;
  readonly isBlocked: boolean;
  readonly activeElementBelongsToApplication: boolean;
  readonly activeElementIsInteractive: boolean;
}

export const getKonquerorFocusOwnership = ({
  activeElementBelongsToApplication,
  activeElementIsInteractive,
  isActive,
  isBlocked,
}: KonquerorDirectoryFocusPolicyInput): KonquerorFocusOwnership => {
  if (!isActive) {
    return "external";
  }

  if (isBlocked) {
    return "blocked";
  }

  if (activeElementBelongsToApplication && activeElementIsInteractive) {
    return "interactive-child";
  }

  return "directory";
};

export const shouldFocusKonquerorDirectorySurface = (
  input: KonquerorDirectoryFocusPolicyInput,
): boolean => getKonquerorFocusOwnership(input) === "directory";

export const shouldRestoreKonquerorDirectoryFocus = (
  input: KonquerorDirectoryFocusPolicyInput,
  force: boolean,
): boolean => input.isActive && !input.isBlocked && (force || shouldFocusKonquerorDirectorySurface(input));
