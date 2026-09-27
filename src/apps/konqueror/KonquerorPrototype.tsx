import type { ApplicationLaunchRequest } from "../../application-runtime/types";
import { Konqueror } from "./Konqueror";

type KonquerorPrototypeProps = {
  readonly windowId?: string;
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly isActive?: boolean;
  readonly focusRequestId?: number;
  readonly onRequestClose?: () => void;
  readonly onSetWindowTitle?: (title: string) => void;
};

export function KonquerorPrototype({
  focusRequestId = 0,
  isActive = false,
  launchRequest = null,
  onRequestClose,
  onSetWindowTitle,
  windowId,
}: KonquerorPrototypeProps) {
  return <Konqueror windowId={windowId} launchRequest={launchRequest} isActive={isActive} focusRequestId={focusRequestId} onRequestClose={onRequestClose} onSetWindowTitle={onSetWindowTitle} />;
}
