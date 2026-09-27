import type { ApplicationCloseRequest, ApplicationLaunchRequest } from "../../application-runtime/types";
import { KControl } from "./KControl";

type KControlPrototypeProps = {
  readonly launchRequest: ApplicationLaunchRequest | null;
  readonly closeRequest: ApplicationCloseRequest | null;
  readonly onRequestClose: () => void;
  readonly onCommitClose: (requestId: number) => void;
  readonly onCancelClose: (requestId: number) => void;
  readonly onSetWindowTitle: (title: string) => void;
};

export function KControlPrototype({ closeRequest, launchRequest, onCancelClose, onCommitClose, onRequestClose, onSetWindowTitle }: KControlPrototypeProps) {
  return <KControl
    closeRequest={closeRequest}
    launchRequest={launchRequest}
    onRequestClose={onRequestClose}
    onCommitClose={onCommitClose}
    onCancelClose={onCancelClose}
    onSetWindowTitle={onSetWindowTitle}
  />;
}
