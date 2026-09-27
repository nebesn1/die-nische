export interface KCalcFocusRequestState {
  readonly handledFocusRequestId: number | null;
  readonly pendingFocusRequestId: number | null;
}

export const initialKCalcFocusRequestState: KCalcFocusRequestState = {
  handledFocusRequestId: null,
  pendingFocusRequestId: null,
};

export function shouldScheduleKCalcFocus(
  state: KCalcFocusRequestState,
  isActive: boolean,
  focusRequestId: number,
): boolean {
  return (
    isActive &&
    focusRequestId > 0 &&
    state.handledFocusRequestId !== focusRequestId &&
    state.pendingFocusRequestId !== focusRequestId
  );
}

export function beginKCalcFocusRequest(
  state: KCalcFocusRequestState,
  focusRequestId: number,
): KCalcFocusRequestState {
  return {
    ...state,
    pendingFocusRequestId: focusRequestId,
  };
}

export function cancelKCalcFocusRequest(
  state: KCalcFocusRequestState,
  focusRequestId: number,
): KCalcFocusRequestState {
  return state.pendingFocusRequestId === focusRequestId
    ? { ...state, pendingFocusRequestId: null }
    : state;
}

export function completeKCalcFocusRequest(
  state: KCalcFocusRequestState,
  focusRequestId: number,
  calculatorRootOwnsFocus: boolean,
): KCalcFocusRequestState {
  const withoutPendingRequest = cancelKCalcFocusRequest(state, focusRequestId);

  return calculatorRootOwnsFocus
    ? { ...withoutPendingRequest, handledFocusRequestId: focusRequestId }
    : withoutPendingRequest;
}
