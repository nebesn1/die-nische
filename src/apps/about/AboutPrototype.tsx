import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";
import { PROJECT_BRAND_MARK_URL } from "../../branding/projectIdentity";

type ApplicationAboutProps = {
  readonly heading: string;
  readonly description: string;
  readonly headingKey?: TranslationKey;
  readonly descriptionKey?: TranslationKey;
  readonly note?: string;
  readonly noteKey?: TranslationKey;
};

type ProjectAboutView = "overview" | "legal" | "licenses";

/** Shared Runtime window presentation for the desktop and application About entries. */
export function ApplicationAbout({ heading, description, headingKey, descriptionKey, note, noteKey }: ApplicationAboutProps) {
  const { t } = useI18n();
  const translatedHeading = headingKey ? t(headingKey) : heading;
  const translatedDescription = descriptionKey ? t(descriptionKey) : description;
  const translatedNote = noteKey ? t(noteKey) : note;

  return (
    <>
      <div className="about-window__body">
        <h2>{translatedHeading}</h2>
        <p>{translatedDescription}</p>
        {translatedNote ? <p className="about-window__note">{translatedNote}</p> : null}
      </div>
      <footer className="konqueror-statusbar">{t("about.ready")}</footer>
    </>
  );
}

export function ProjectAbout({ heading, description, headingKey, descriptionKey, note, noteKey }: ApplicationAboutProps) {
  const { t } = useI18n();
  const translatedHeading = headingKey ? t(headingKey) : heading;
  const translatedDescription = descriptionKey ? t(descriptionKey) : description;
  const translatedNote = noteKey ? t(noteKey) : note;

  return (
    <>
      <div className="about-window__body about-window__body--project" data-about-identity="project">
        <ProjectAboutContent
          description={translatedDescription}
          heading={translatedHeading}
          note={translatedNote}
        />
      </div>
      <footer className="konqueror-statusbar">{t("about.ready")}</footer>
    </>
  );
}

export function HistoricalKdeAbout() {
  const { t } = useI18n();

  return (
    <>
      <div className="about-window__body about-window__body--historical" data-about-identity="historical-kde">
        <h2>{t("about.kdeHeading")}</h2>
        <p>{t("about.kdeDescription")}</p>
        <p className="about-window__note">{t("about.kdeNotice")}</p>
      </div>
      <footer className="konqueror-statusbar">{t("about.ready")}</footer>
    </>
  );
}

function ProjectAboutContent({ description, heading, note }: { readonly description: string; readonly heading: string; readonly note?: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<ProjectAboutView>("overview");

  return (
    <>
      <div className="about-window__identity" data-project-brand-mark="true">
        <img className="about-window__identity-mark" src={PROJECT_BRAND_MARK_URL} alt="" aria-hidden="true" />
        <div className="about-window__identity-copy">
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="about-window__navigation" role="tablist" aria-label={t("about.navigation")}>
        <button
          type="button"
          role="tab"
          aria-selected={view === "overview"}
          aria-controls="about-panel-overview"
          className={`kde-raised about-window__tab${view === "overview" ? " is-active" : ""}`}
          data-about-view="overview"
          onClick={() => setView("overview")}
        >
          {t("about.overview")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "legal"}
          aria-controls="about-panel-legal"
          className={`kde-raised about-window__tab${view === "legal" ? " is-active" : ""}`}
          data-about-view="legal"
          onClick={() => setView("legal")}
        >
          {t("about.legal")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "licenses"}
          aria-controls="about-panel-licenses"
          className={`kde-raised about-window__tab${view === "licenses" ? " is-active" : ""}`}
          data-about-view="licenses"
          onClick={() => setView("licenses")}
        >
          {t("about.licenses")}
        </button>
      </div>
      <section id="about-panel-overview" className="about-window__panel" role="tabpanel" aria-label={t("about.overview")} hidden={view !== "overview"}>
        {note ? <p className="about-window__note">{note}</p> : null}
      </section>
      <LegalPanel hidden={view !== "legal"} />
      <LicensesPanel hidden={view !== "licenses"} />
    </>
  );
}

function LegalPanel({ hidden }: { readonly hidden: boolean }) {
  const { t } = useI18n();
  return (
    <section id="about-panel-legal" className="about-window__panel" role="tabpanel" aria-label={t("about.legal")} data-about-panel="legal" hidden={hidden}>
      <h3>{t("about.legal")}</h3>
      <dl className="about-window__facts">
        <div><dt>{t("about.project")}</dt><dd>{t("about.projectHeading")}</dd></div>
        <div><dt>{t("about.status")}</dt><dd>{t("about.statusIndependent")}</dd></div>
        <div><dt>{t("about.inspiration")}</dt><dd>{t("about.inspirationKde3")}</dd></div>
        <div><dt>{t("about.affiliationLabel")}</dt><dd>{t("about.affiliation")}</dd></div>
      </dl>
      <p>{t("about.recreatedApplications")}</p>
      <p>{t("about.virtualFilesystem")}</p>
      <p className="about-window__trademark">{t("about.trademark")}</p>
      <p className="about-window__canonical">{t("about.canonicalLegal")}</p>
    </section>
  );
}

function LicensesPanel({ hidden }: { readonly hidden: boolean }) {
  const { t } = useI18n();
  return (
    <section id="about-panel-licenses" className="about-window__panel" role="tabpanel" aria-label={t("about.licenses")} data-about-panel="licenses" hidden={hidden}>
      <h3>{t("about.licenseScope")}</h3>
      <dl className="about-window__facts">
        <div><dt>{t("about.software")}</dt><dd>{t("about.mit")}</dd></div>
        <div><dt>{t("about.documentation")}</dt><dd>{t("about.ccBy")}</dd></div>
        <div><dt>{t("about.sampleArtwork")}</dt><dd>{t("about.ccBy")}</dd></div>
        <div><dt>{t("about.authoredContent")}</dt><dd>{t("about.reservedByDefault")}</dd></div>
        <div><dt>{t("about.projectMark")}</dt><dd>{t("about.reservedByDefault")}</dd></div>
        <div><dt>{t("about.thirdParty")}</dt><dd>{t("about.upstreamTerms")}</dd></div>
      </dl>
      <p className="about-window__canonical">{t("about.canonicalLegal")}</p>
    </section>
  );
}
