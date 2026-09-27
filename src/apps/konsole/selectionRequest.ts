export interface KonsoleSelectionRequest {
  readonly requestId: number;
  readonly start: number;
  readonly end: number;
}

export function createKonsoleSelectionRequest(
  requestId: number,
  start: number,
  end: number = start,
): KonsoleSelectionRequest {
  return {
    requestId,
    start,
    end,
  };
}

export function clampKonsoleSelectionRequest(
  request: KonsoleSelectionRequest,
  valueLength: number,
): { readonly start: number; readonly end: number } {
  const max = Math.max(0, valueLength);
  const start = Math.min(Math.max(0, request.start), max);
  const end = Math.min(Math.max(start, request.end), max);

  return {
    start,
    end,
  };
}

export function shouldConsumeKonsoleSelectionRequest(
  current: KonsoleSelectionRequest | null,
  consumedRequestId: number,
): KonsoleSelectionRequest | null {
  return current?.requestId === consumedRequestId ? null : current;
}
