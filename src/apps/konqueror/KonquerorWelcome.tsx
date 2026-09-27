import { KonquerorIcon } from "../../icons/IconComponents";
import type { CSSProperties } from "react";
import { useI18n } from "../../i18n/useI18n";

type KonquerorStartPageProps = {
  readonly zoomLevel?: number;
  readonly onOpenHome: () => void;
  readonly onOpenSysinfo: () => void;
  readonly onOpenTrash: () => void;
  readonly onOpenSettings: () => void;
};

export function KonquerorStartPage({
  zoomLevel = 100,
  onOpenHome,
  onOpenSettings,
  onOpenSysinfo,
  onOpenTrash,
}: KonquerorStartPageProps) {
  const { t } = useI18n();
  return (
    <article
      className="konqueror-start-page"
      data-content-zoom={zoomLevel}
      aria-label={t("konqueror.page.startAria")}
      style={{ "--konqueror-content-zoom": zoomLevel / 100 } as CSSProperties}
    >
      <header className="konqueror-start-page__hero">
        <KonquerorIcon className="konqueror-start-page__mark" aria-hidden="true" focusable="false" />
        <div>
          <h1>Konqueror</h1>
          <p>{t("konqueror.page.startTagline")}</p>
        </div>
      </header>
      <section className="konqueror-start-page__body">
        <p className="konqueror-start-page__introduction">{t("konqueror.page.startIntro")}</p>
        <h2>{t("konqueror.page.startingPoints")}</h2>
        <div className="konqueror-start-page__points">
          <StartPoint label={t("konqueror.page.homeFolder")} description={t("konqueror.page.personalFiles")} onClick={onOpenHome} />
          <StartPoint label={t("konqueror.page.storageMedia")} description={t("konqueror.page.storageInfo")} onClick={onOpenSysinfo} />
          <StartPoint label={t("konqueror.page.trash")} description={t("konqueror.page.trashDescription")} onClick={onOpenTrash} />
          <StartPoint label={t("konqueror.page.settings")} description={t("konqueror.page.desktopConfiguration")} onClick={onOpenSettings} />
          <StartPoint label={t("konqueror.page.networkFolders")} description={t("konqueror.page.unavailablePrototype")} disabled />
          <StartPoint label={t("konqueror.page.applications")} description={t("konqueror.page.unavailablePrototype")} disabled />
        </div>
        <p className="konqueror-start-page__recreation-notice">{t("konqueror.page.recreationNotice")}</p>
      </section>
    </article>
  );
}

function StartPoint({
  description,
  disabled = false,
  label,
  onClick,
}: {
  readonly description: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
}) {
  return (
    <button type="button" className="konqueror-start-page__point" disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      <small>{description}</small>
    </button>
  );
}
