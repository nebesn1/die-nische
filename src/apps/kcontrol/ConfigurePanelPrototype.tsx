import type { ApplicationCloseRequest } from "../../application-runtime/types";
import { ConfigurePanel } from "./ConfigurePanel";

type ConfigurePanelPrototypeProps = {
  readonly closeRequest: ApplicationCloseRequest | null;
  readonly onCommitClose: (requestId: number) => void;
  readonly onCancelClose: (requestId: number) => void;
};

export function ConfigurePanelPrototype({ closeRequest, onCancelClose, onCommitClose }: ConfigurePanelPrototypeProps) {
  return <ConfigurePanel
    closeRequest={closeRequest}
    onCommitClose={onCommitClose}
    onCancelClose={onCancelClose}
  />;
}
