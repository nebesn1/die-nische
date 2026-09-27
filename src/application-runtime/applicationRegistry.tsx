import { ApplicationAbout, HistoricalKdeAbout, ProjectAbout } from "../apps/about/AboutPrototype";
import { ArticleReaderPrototype } from "../apps/article-reader/ArticleReaderPrototype";
import { BlogPrototype } from "../apps/blog/BlogPrototype";
import { BlogArchivePrototype } from "../apps/blog-archive/BlogArchivePrototype";
import { BlogSearchPrototype } from "../apps/blog-search/BlogSearchPrototype";
import { BlogTagsPrototype } from "../apps/blog-tags/BlogTagsPrototype";
import { KCalcPrototype } from "../apps/kcalc/KCalcPrototype";
import { KControlPrototype } from "../apps/kcontrol/KControlPrototype";
import { ConfigurePanelPrototype } from "../apps/kcontrol/ConfigurePanelPrototype";
import { ConfigureClock } from "../apps/kcontrol/ConfigureClock";
import { KFindPrototype } from "../apps/kfind/KFindPrototype";
import { KWritePrototype } from "../apps/kwrite/KWritePrototype";
import { KonquerorPrototype } from "../apps/konqueror/KonquerorPrototype";
import { BookmarkEditor } from "../apps/konqueror/BookmarkEditor";
import { createKonquerorOpenStartIntent } from "../apps/konqueror/launchIntent";
import { KonsolePrototype } from "../apps/konsole/KonsolePrototype";
import { KonsoleBookmarkEditor } from "../apps/konsole/KonsoleBookmarkEditor";
import { Calendar } from "../apps/calendar/Calendar";
import { CALENDAR_WINDOW_SIZE } from "../apps/calendar/calendarWindow";
import { getKCalcNaturalSize } from "../apps/kcalc/kcalcLayoutGeometry";
import { initialKCalcOptionalPanels } from "../apps/kcalc/kcalcOptionalPanels";
import type { ApplicationDefinition } from "./types";
import type { TranslationKey } from "../i18n/messages/en";
import { PROJECT_BRAND, PROJECT_DESCRIPTION } from "../branding/projectIdentity";

const kcalcNaturalSize = getKCalcNaturalSize(initialKCalcOptionalPanels);

const freezeApplicationDefinition = (definition: ApplicationDefinition): void => {
  Object.freeze(definition.window.bounds);
  if (definition.window.initialSizing) {
    Object.freeze(definition.window.initialSizing);
  }
  Object.freeze(definition.window);
  Object.freeze(definition);
};

const createAboutDefinition = ({
  appId,
  title,
  iconId,
  heading,
  description,
  headingKey,
  descriptionKey,
  note,
  noteKey,
  titleKey,
  presentation = "generic",
  isMostUsedEligible,
  x,
  y,
}: {
  readonly appId: string;
  readonly title: string;
  readonly iconId: string;
  readonly heading: string;
  readonly description: string;
  readonly headingKey?: TranslationKey;
  readonly descriptionKey?: TranslationKey;
  readonly note?: string;
  readonly noteKey?: TranslationKey;
  readonly titleKey?: TranslationKey;
  readonly presentation?: "generic" | "historical-kde" | "project";
  readonly isMostUsedEligible?: boolean;
  readonly x: number;
  readonly y: number;
}): ApplicationDefinition => ({
  appId,
  name: title,
  defaultTitle: title,
  titleKey,
  iconId,
  instancePolicy: "singleton",
  isMostUsedEligible,
  window: {
    bounds: {
      x,
      y,
      width: 390,
      height: 230,
    },
    minimumWidth: 280,
    minimumHeight: 180,
    isResizable: true,
  },
  render: () => {
    if (presentation === "historical-kde") {
      return <HistoricalKdeAbout />;
    }

    const props = { heading, description, headingKey, descriptionKey, note, noteKey };
    return presentation === "project"
      ? <ProjectAbout {...props} />
      : <ApplicationAbout {...props} />;
  },
});

const aboutKdeDefinition = createAboutDefinition({
  appId: "about-kde",
  title: "About KDE",
  titleKey: "about.kdeTitle",
  iconId: "about",
  heading: "KDE 3",
  description: "Historical KDE 3 desktop context.",
  headingKey: "about.kdeHeading",
  descriptionKey: "about.kdeDescription",
  noteKey: "about.kdeNotice",
  presentation: "historical-kde",
  x: 280,
  y: 112,
});

const aboutDieNischeDefinition = createAboutDefinition({
  appId: "about-die-nische",
  title: "About die Nische",
  titleKey: "about.projectTitle",
  iconId: "about",
  heading: PROJECT_BRAND,
  description: PROJECT_DESCRIPTION,
  headingKey: "about.projectHeading",
  descriptionKey: "about.projectDescription",
  noteKey: "about.projectIndependence",
  presentation: "project",
  isMostUsedEligible: false,
  x: 300,
  y: 132,
});

const aboutKonquerorDefinition = createAboutDefinition({
  appId: "about-konqueror",
  title: "About Konqueror",
  iconId: "konqueror",
  heading: "Konqueror / File Manager and Web Browser",
  description: "Konqueror provides filesystem navigation, tabs, bookmarks, file previews, and embedded web content in this KDE 3-inspired web desktop.",
  x: 300,
  y: 132,
});

const aboutKControlDefinition = createAboutDefinition({
  appId: "about-kcontrol",
  title: "About KDE Control Center",
  iconId: "kcontrol",
  heading: "KDE Control Center",
  description: "KDE Control Center provides a central place to configure the die Nische appearance and desktop behavior.",
  headingKey: "about.kcontrolHeading",
  descriptionKey: "about.kcontrolDescription",
  x: 310,
  y: 142,
});

const aboutKdePanelDefinition = createAboutDefinition({
  appId: "about-kde-panel",
  title: "About KDE Panel",
  iconId: "about",
  heading: "KDE Panel",
  description: "KDE Panel provides the Kicker taskbar, application launchers, virtual desktop pager, task buttons, system applets, and desktop session controls for die Nische.",
  headingKey: "about.panelHeading",
  descriptionKey: "about.panelDescription",
  x: 325,
  y: 157,
});

const aboutKWriteDefinition = createAboutDefinition({
  appId: "about-kwrite",
  title: "About KWrite",
  iconId: "kwrite",
  heading: "KWrite",
  description: "Text Editor",
  x: 320,
  y: 152,
});

const aboutKonsoleDefinition = createAboutDefinition({
  appId: "about-konsole",
  title: "About Konsole",
  iconId: "konsole",
  heading: "Konsole",
  description: "Terminal Emulator",
  x: 340,
  y: 172,
});

const aboutKCalcDefinition = createAboutDefinition({
  appId: "about-kcalc",
  title: "About KCalc",
  iconId: "kcalc",
  heading: "KCalc",
  description: "Basic Calculator",
  x: 360,
  y: 192,
});

const konquerorDefinition: ApplicationDefinition = {
  appId: "konqueror",
  name: "Konqueror",
  defaultTitle: "Conquer your Desktop! - Konqueror",
  iconId: "konqueror",
  instancePolicy: "multiple",
  defaultLaunchIntent: createKonquerorOpenStartIntent(),
  window: {
    bounds: {
      x: 500,
      y: 2,
      width: 650,
      height: 600,
    },
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
    initialSizing: {
      maximumWorkAreaHeightRatio: 0.72,
    },
  },
  render: (context) => <KonquerorPrototype
    windowId={context.windowId}
    launchRequest={context.launchRequest}
    isActive={context.isActive}
    focusRequestId={context.focusRequestId}
    onRequestClose={context.requestWindowClose}
    onSetWindowTitle={context.setWindowTitle}
  />,
};

const konsoleDefinition: ApplicationDefinition = {
  appId: "konsole",
  name: "Konsole",
  defaultTitle: "Konsole",
  iconId: "konsole",
  instancePolicy: "multiple",
  window: {
    bounds: {
      x: 170,
      y: 80,
      width: 700,
      height: 460,
    },
    minimumWidth: 420,
    minimumHeight: 260,
    isResizable: true,
  },
  render: (context) => <KonsolePrototype
    windowId={context.windowId}
    launchRequest={context.launchRequest}
    onRequestClose={context.requestWindowClose}
    onSetWindowTitle={context.setWindowTitle}
  />,
};

const kcalcDefinition: ApplicationDefinition = {
  appId: "kcalc",
  name: "KCalc",
  defaultTitle: "KCalc",
  iconId: "kcalc",
  instancePolicy: "multiple",
  window: {
    bounds: {
      x: 330,
      y: 105,
      ...kcalcNaturalSize,
    },
    minimumWidth: kcalcNaturalSize.width,
    minimumHeight: kcalcNaturalSize.height,
    isResizable: false,
    isMaximizable: false,
  },
  render: (context) => (
    <KCalcPrototype
      windowId={context.windowId}
      isActive={context.isActive}
      focusRequestId={context.focusRequestId}
      onRequestClose={context.requestWindowClose}
    />
  ),
};

const calendarDefinition: ApplicationDefinition = {
  appId: "calendar",
  name: "Calendar",
  defaultTitle: "Calendar",
  iconId: "calendar",
  instancePolicy: "singleton",
  isMostUsedEligible: false,
  window: {
    bounds: {
      x: 0,
      y: 0,
      ...CALENDAR_WINDOW_SIZE,
    },
    minimumWidth: 280,
    minimumHeight: 190,
    isResizable: true,
    isMinimizable: false,
    alwaysOnTop: true,
  },
  render: () => <Calendar />,
};

const kwriteDefinition: ApplicationDefinition = {
  appId: "kwrite",
  name: "KWrite",
  defaultTitle: "Untitled - KWrite",
  iconId: "kwrite",
  instancePolicy: "multiple",
  closeBehavior: "application-guarded",
  window: {
    bounds: {
      x: 230,
      y: 62,
      width: 720,
      height: 560,
    },
    minimumWidth: 420,
    minimumHeight: 300,
    isResizable: true,
  },
  render: (context) => <KWritePrototype
    launchRequest={context.launchRequest}
    closeRequest={context.closeRequest}
    onRequestClose={context.requestWindowClose}
    onCommitClose={context.commitWindowClose}
    onCancelClose={context.cancelWindowClose}
    onSetWindowTitle={context.setWindowTitle}
  />,
};

const kcontrolDefinition: ApplicationDefinition = {
  appId: "kcontrol",
  name: "KDE Control Center",
  defaultTitle: "Control Center",
  iconId: "kcontrol",
  instancePolicy: "singleton",
  closeBehavior: "application-guarded",
  window: {
    bounds: {
      x: 190,
      y: 70,
      width: 680,
      height: 500,
    },
    minimumWidth: 520,
    minimumHeight: 360,
    isResizable: true,
  },
  render: (context) => <KControlPrototype
    closeRequest={context.closeRequest}
    launchRequest={context.launchRequest}
    onRequestClose={context.requestWindowClose}
    onCommitClose={context.commitWindowClose}
    onCancelClose={context.cancelWindowClose}
    onSetWindowTitle={context.setWindowTitle}
  />,
};

const configurePanelDefinition: ApplicationDefinition = {
  appId: "configure-panel",
  name: "Configure the Panel",
  defaultTitle: "Configure the Panel",
  iconId: "panel-settings",
  instancePolicy: "singleton",
  closeBehavior: "application-guarded",
  window: {
    bounds: {
      x: 270,
      y: 110,
      width: 460,
      height: 300,
    },
    minimumWidth: 360,
    minimumHeight: 250,
    isResizable: true,
  },
  render: (context) => <ConfigurePanelPrototype
    closeRequest={context.closeRequest}
    onCommitClose={context.commitWindowClose}
    onCancelClose={context.cancelWindowClose}
  />,
};

const configureClockDefinition: ApplicationDefinition = {
  appId: "configure-clock",
  name: "Configure - Clock",
  defaultTitle: "Configure - Clock",
  iconId: "panel-settings",
  instancePolicy: "singleton",
  closeBehavior: "application-guarded",
  isMostUsedEligible: false,
  window: {
    bounds: {
      x: 310,
      y: 120,
      width: 430,
      height: 330,
    },
    minimumWidth: 360,
    minimumHeight: 280,
    isResizable: true,
  },
  render: (context) => <ConfigureClock
    closeRequest={context.closeRequest}
    onCommitClose={context.commitWindowClose}
    onCancelClose={context.cancelWindowClose}
  />,
};

const kfindDefinition: ApplicationDefinition = {
  appId: "kfind",
  name: "Find Files/Folders",
  defaultTitle: "Find Files/Folders",
  titleKey: "kfind.label",
  iconId: "kfind",
  instancePolicy: "multiple",
  window: {
    bounds: {
      x: 140,
      y: 90,
      width: 760,
      height: 540,
    },
    minimumWidth: 620,
    minimumHeight: 420,
    isResizable: true,
  },
  render: (context) => <KFindPrototype onRequestClose={context.requestWindowClose} />,
};

const blogDefinition: ApplicationDefinition = {
  appId: "blog",
  name: "Blog",
  defaultTitle: "Blog",
  titleKey: "blog.label",
  iconId: "kwrite",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 265, y: 90, width: 660, height: 480 },
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
  },
  render: () => <BlogPrototype />,
};

const blogArchiveDefinition: ApplicationDefinition = {
  appId: "blog-archive",
  name: "Blog Archive",
  defaultTitle: "Blog Archive",
  titleKey: "blogArchive.label",
  iconId: "kwrite",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 250, y: 80, width: 680, height: 520 },
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
  },
  render: () => <BlogArchivePrototype />,
};

const blogTagsDefinition: ApplicationDefinition = {
  appId: "blog-tags",
  name: "Blog Tags",
  defaultTitle: "Blog Tags",
  titleKey: "blogTags.label",
  iconId: "kwrite",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 240, y: 85, width: 700, height: 520 },
    minimumWidth: 480,
    minimumHeight: 300,
    isResizable: true,
  },
  render: (context) => <BlogTagsPrototype launchRequest={context.launchRequest} />,
};

const blogSearchDefinition: ApplicationDefinition = {
  appId: "blog-search",
  name: "Blog Search",
  defaultTitle: "Blog Search",
  titleKey: "blogSearch.label",
  iconId: "kwrite",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 230, y: 75, width: 700, height: 520 },
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
  },
  render: (context) => <BlogSearchPrototype launchRequest={context.launchRequest} />,
};

const articleReaderDefinition: ApplicationDefinition = {
  appId: "article-reader",
  name: "Article Reader",
  defaultTitle: "Article Reader",
  iconId: "kwrite",
  instancePolicy: "multiple",
  window: {
    bounds: { x: 215, y: 70, width: 760, height: 600 },
    minimumWidth: 420,
    minimumHeight: 280,
    isResizable: true,
  },
  render: (context) => <ArticleReaderPrototype launchRequest={context.launchRequest} onSetWindowTitle={context.setWindowTitle} />,
};

const bookmarkEditorDefinition: ApplicationDefinition = {
  appId: "bookmark-editor",
  name: "Bookmark Editor",
  defaultTitle: "Bookmark Editor",
  iconId: "konqueror",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 250, y: 95, width: 640, height: 470 },
    minimumWidth: 460,
    minimumHeight: 330,
    isResizable: true,
  },
  render: (context) => <BookmarkEditor onRequestClose={context.requestWindowClose} />,
};

const konsoleBookmarkEditorDefinition: ApplicationDefinition = {
  appId: "konsole-bookmark-editor",
  name: "Bookmark Editor",
  defaultTitle: "Bookmark Editor",
  iconId: "konsole",
  instancePolicy: "singleton",
  window: {
    bounds: { x: 250, y: 95, width: 640, height: 470 },
    minimumWidth: 460,
    minimumHeight: 330,
    isResizable: true,
  },
  render: (context) => <KonsoleBookmarkEditor onRequestClose={context.requestWindowClose} />,
};

freezeApplicationDefinition(aboutKdeDefinition);
freezeApplicationDefinition(aboutDieNischeDefinition);
freezeApplicationDefinition(aboutKonquerorDefinition);
freezeApplicationDefinition(aboutKControlDefinition);
freezeApplicationDefinition(aboutKdePanelDefinition);
freezeApplicationDefinition(aboutKWriteDefinition);
freezeApplicationDefinition(aboutKonsoleDefinition);
freezeApplicationDefinition(aboutKCalcDefinition);
freezeApplicationDefinition(konquerorDefinition);
freezeApplicationDefinition(konsoleDefinition);
freezeApplicationDefinition(kcalcDefinition);
freezeApplicationDefinition(calendarDefinition);
freezeApplicationDefinition(kwriteDefinition);
freezeApplicationDefinition(kcontrolDefinition);
freezeApplicationDefinition(configurePanelDefinition);
freezeApplicationDefinition(configureClockDefinition);
freezeApplicationDefinition(kfindDefinition);
freezeApplicationDefinition(blogDefinition);
freezeApplicationDefinition(blogArchiveDefinition);
freezeApplicationDefinition(blogTagsDefinition);
freezeApplicationDefinition(blogSearchDefinition);
freezeApplicationDefinition(articleReaderDefinition);
freezeApplicationDefinition(bookmarkEditorDefinition);
freezeApplicationDefinition(konsoleBookmarkEditorDefinition);

export const applicationDefinitions = Object.freeze([
  aboutKdeDefinition,
  aboutDieNischeDefinition,
  aboutKonquerorDefinition,
  aboutKControlDefinition,
  aboutKdePanelDefinition,
  aboutKWriteDefinition,
  aboutKonsoleDefinition,
  aboutKCalcDefinition,
  konquerorDefinition,
  konsoleDefinition,
  kwriteDefinition,
  kcontrolDefinition,
  configurePanelDefinition,
  configureClockDefinition,
  kfindDefinition,
  blogDefinition,
  blogArchiveDefinition,
  blogTagsDefinition,
  blogSearchDefinition,
  articleReaderDefinition,
  bookmarkEditorDefinition,
  konsoleBookmarkEditorDefinition,
  kcalcDefinition,
  calendarDefinition,
]) satisfies readonly ApplicationDefinition[];

const applicationDefinitionMap: ReadonlyMap<string, ApplicationDefinition> = new Map(
  applicationDefinitions.map((definition) => [definition.appId, definition]),
);

export type RegisteredApplicationId = (typeof applicationDefinitions)[number]["appId"];

export function getApplicationDefinition(appId: string): ApplicationDefinition | undefined {
  return applicationDefinitionMap.get(appId);
}

export function getRegisteredApplications(): readonly ApplicationDefinition[] {
  return applicationDefinitions;
}

export function hasApplication(appId: string): boolean {
  return applicationDefinitionMap.has(appId);
}

export function isApplicationMostUsedEligible(appId: string): boolean {
  return getApplicationDefinition(appId)?.isMostUsedEligible !== false;
}
