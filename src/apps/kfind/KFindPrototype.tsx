import { KFind } from "./KFind";

type KFindPrototypeProps = {
  readonly onRequestClose: () => void;
};

export function KFindPrototype({ onRequestClose }: KFindPrototypeProps) {
  return <KFind onRequestClose={onRequestClose} />;
}
