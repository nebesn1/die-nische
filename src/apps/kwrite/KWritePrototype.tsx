import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "../../application-runtime/types";
import { KWrite } from "./KWrite";

type KWritePrototypeProps = {
  readonly launchRequest?: ApplicationLaunchRequest | null;
  readonly closeRequest: ApplicationCloseRequest | null;
  readonly onRequestClose: () => void;
  readonly onCommitClose: (requestId: number) => void;
  readonly onCancelClose: (requestId: number) => void;
  readonly onSetWindowTitle: (title: string) => void;
};

export function KWritePrototype({
  closeRequest,
  launchRequest = null,
  onCancelClose,
  onCommitClose,
  onRequestClose,
  onSetWindowTitle,
}: KWritePrototypeProps) {
  return <KWrite
    launchRequest={launchRequest}
    closeRequest={closeRequest}
    onRequestClose={onRequestClose}
    onCommitClose={onCommitClose}
    onCancelClose={onCancelClose}
    onSetWindowTitle={onSetWindowTitle}
  />;
}
