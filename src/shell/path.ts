import { getVfsPathForNode } from "../vfs/queries";
import type { VfsState } from "../vfs/types";

export function expandShellPathOperand(state: VfsState, operand: string): string {
  if (operand !== "~" && !operand.startsWith("~/")) {
    return operand;
  }

  const homePath = getVfsPathForNode(state, state.specialLocations.home);

  if (!homePath.ok) {
    return operand;
  }

  return operand === "~" ? homePath.value : `${homePath.value}/${operand.slice(2)}`;
}
