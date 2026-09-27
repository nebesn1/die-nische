import { KCalc } from "./KCalc";

type KCalcPrototypeProps = {
  readonly windowId: string;
  readonly isActive: boolean;
  readonly focusRequestId: number;
  readonly onRequestClose: () => void;
};

export function KCalcPrototype({ windowId, isActive, focusRequestId, onRequestClose }: KCalcPrototypeProps) {
  return (
    <KCalc
      windowId={windowId}
      isActive={isActive}
      focusRequestId={focusRequestId}
      onRequestClose={onRequestClose}
    />
  );
}
