import { useLayoutEffect, useState, type RefObject } from "react";

type PopupPositionRequest = {
  readonly requestId: number;
};

type ResolvedPopupPosition<TPosition> = {
  readonly requestId: number;
  readonly position: TPosition;
};

export function useMeasuredPopupPosition<TRequest extends PopupPositionRequest, TPosition>(
  request: TRequest | null,
  popupRef: RefObject<HTMLElement | null>,
  resolvePosition: (popup: HTMLElement, request: TRequest) => TPosition | null,
): { readonly position: TPosition | null; readonly isPositioned: boolean } {
  const [resolvedPosition, setResolvedPosition] = useState<ResolvedPopupPosition<TPosition> | null>(null);

  useLayoutEffect(() => {
    if (request === null || popupRef.current === null) {
      return;
    }

    const position = resolvePosition(popupRef.current, request);

    if (position === null) {
      return;
    }

    setResolvedPosition((current) =>
      current !== null && current.requestId > request.requestId
        ? current
        : { requestId: request.requestId, position },
    );
  }, [popupRef, request, resolvePosition]);

  const isPositioned = request !== null && resolvedPosition?.requestId === request.requestId;

  return {
    position: isPositioned ? resolvedPosition.position : null,
    isPositioned,
  };
}
