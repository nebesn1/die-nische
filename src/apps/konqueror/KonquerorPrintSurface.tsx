import { createRef, type RefObject } from "react";
import type { KonquerorPrintRequest } from "./konquerorPrintContext";
import { KonquerorPreviewHost } from "./KonquerorPreviewHost";
import { KonquerorStartPage } from "./KonquerorWelcome";

type KonquerorPrintSurfaceProps = {
  readonly printRequest: KonquerorPrintRequest | null;
  readonly surfaceRef: RefObject<HTMLElement | null>;
};

const noOp = () => undefined;

export function KonquerorPrintSurface({ printRequest, surfaceRef }: KonquerorPrintSurfaceProps) {
  const previewSurfaceRef = createRef<HTMLElement>();

  return (
    <section
      ref={surfaceRef}
      className="konqueror-print-surface"
      aria-hidden="true"
      data-print-request-id={printRequest?.requestId}
      data-print-window-id={printRequest?.windowId}
    >
      {printRequest?.document.kind === "about" ? (
        <KonquerorStartPage onOpenHome={noOp} onOpenSettings={noOp} onOpenSysinfo={noOp} onOpenTrash={noOp} />
      ) : null}
      {printRequest?.document.kind === "file" ? (
        <KonquerorPreviewHost
          file={printRequest.document.file}
          previewerId={printRequest.document.previewerId}
          previewSurfaceRef={previewSurfaceRef}
          onOpenContextMenu={noOp}
        />
      ) : null}
      {printRequest?.document.kind === "text" ? (
        <article className="kwrite-print-document">
          <h1>{printRequest.document.title}</h1>
          <pre>{printRequest.document.content}</pre>
        </article>
      ) : null}
    </section>
  );
}
