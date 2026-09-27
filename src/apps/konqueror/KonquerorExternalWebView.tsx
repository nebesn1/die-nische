import type { CSSProperties, RefObject } from "react";
import { getKonquerorExternalWebZoomGeometry } from "./externalWebZoomModel";
import type { KonquerorEmbeddedContentZoomLevel } from "./embeddedContentModel";
import type { KonquerorExternalWebLoadState } from "./externalWebLoadState";
import { useI18n } from "../../i18n/useI18n";

type KonquerorExternalWebViewProps = {
  readonly canonicalUrl: string;
  readonly externalWebSurfaceRef: RefObject<HTMLIFrameElement | null>;
  readonly loadRequest: KonquerorExternalWebLoadState | null;
  readonly onLoad: (canonicalUrl: string, generation: number) => void;
  readonly zoomLevel: KonquerorEmbeddedContentZoomLevel;
};

export function KonquerorExternalWebView({
  canonicalUrl,
  externalWebSurfaceRef,
  loadRequest,
  onLoad,
  zoomLevel,
}: KonquerorExternalWebViewProps) {
  const { t } = useI18n();
  const zoomGeometry = getKonquerorExternalWebZoomGeometry(zoomLevel);

  if (loadRequest === null) {
    return <section className="konqueror-external-web-view" aria-label={t("konqueror.error.externalPage")} role="status">{t("konqueror.media.loading")}</section>;
  }

  if (loadRequest.status === "stopped") {
    return (
      <section
        className="konqueror-external-web-view konqueror-external-web-view--notice"
        aria-label={t("konqueror.error.externalPage")}
        role="status"
        data-external-load-generation={loadRequest.generation}
        data-external-load-status={loadRequest.status}
      >
        <div className="konqueror-external-web-view__notice">
          <p className="konqueror-external-web-view__notice-title">{t("konqueror.error.loadingStopped")}</p>
          <p className="konqueror-external-web-view__notice-location">{t("konqueror.location.label")} {canonicalUrl}</p>
          <p>{t("konqueror.error.reloadHint")}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="konqueror-external-web-view"
      aria-label={t("konqueror.error.externalPage")}
      data-external-load-generation={loadRequest.generation}
      data-external-load-status={loadRequest.status}
    >
      <div className="konqueror-external-web-view__viewport" data-external-web-zoom={zoomLevel}>
        <iframe
          key={`${canonicalUrl}:${loadRequest.generation}`}
          ref={externalWebSurfaceRef}
          className="konqueror-external-web-view__frame"
          src={canonicalUrl}
          title={`${t("konqueror.error.externalPage")}: ${canonicalUrl}`}
          sandbox="allow-forms allow-scripts"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            width: `${zoomGeometry.layoutWidthPercent}%`,
            height: `${zoomGeometry.layoutHeightPercent}%`,
            transform: `scale(${zoomGeometry.scale})`,
            transformOrigin: "top left",
          } satisfies CSSProperties}
          onLoad={() => onLoad(canonicalUrl, loadRequest.generation)}
        />
      </div>
    </section>
  );
}
