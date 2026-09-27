import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  KonquerorPrintContext,
  type KonquerorPrintDocument,
  type KonquerorPrintRequest,
} from "./konquerorPrintContext";
import { KonquerorPrintSurface } from "./KonquerorPrintSurface";

export function KonquerorPrintProvider({ children }: { readonly children: ReactNode }) {
  const [printRequest, setPrintRequest] = useState<KonquerorPrintRequest | null>(null);
  const nextRequestId = useRef(1);
  const activeRequestId = useRef<number | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);

  const clearRequest = useCallback((requestId: number) => {
    if (activeRequestId.current !== requestId) {
      return;
    }

    activeRequestId.current = null;
    setPrintRequest(null);
  }, []);

  const requestPrint = useCallback((windowId: string, document: KonquerorPrintDocument) => {
    if (activeRequestId.current !== null || typeof window.print !== "function") {
      return;
    }

    const requestId = nextRequestId.current++;
    activeRequestId.current = requestId;
    flushSync(() => {
      setPrintRequest({ requestId, windowId, document });
    });

    if (surfaceRef.current?.dataset.printRequestId !== String(requestId)) {
      clearRequest(requestId);
      return;
    }

    window.addEventListener("afterprint", () => clearRequest(requestId), { once: true });

    try {
      window.print();
    } catch {
      clearRequest(requestId);
    }
  }, [clearRequest]);

  useEffect(() => () => {
    const requestId = activeRequestId.current;
    if (requestId !== null) {
      clearRequest(requestId);
    }
  }, [clearRequest]);

  return (
    <KonquerorPrintContext.Provider value={{ requestPrint }}>
      {children}
      <KonquerorPrintSurface printRequest={printRequest} surfaceRef={surfaceRef} />
    </KonquerorPrintContext.Provider>
  );
}
