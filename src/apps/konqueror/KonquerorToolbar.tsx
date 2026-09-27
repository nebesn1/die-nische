import { HomeIcon, KonquerorIcon } from "../../icons/IconComponents";
import type { ReactNode, RefObject } from "react";
import type { WindowLayoutMode } from "../../window-manager/types";
import type { KonquerorResourceViewMode } from "./directoryViewModel";
import { useI18n } from "../../i18n/useI18n";
import {
  BackIcon,
  CopyIcon,
  CutIcon,
  ForwardIcon,
  IconViewIcon,
  PasteIcon,
  PrintIcon,
  ReloadIcon,
  SecurityIcon,
  StopIcon,
  TreeViewIcon,
  UpIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateRightIcon,
} from "./icons";
import {
  getKonquerorToolbarActionGroups,
  type KonquerorToolbarAction,
  type KonquerorToolbarProfile,
} from "./toolbarProfile";
import { translateKonquerorAvailabilityText } from "./konquerorI18n";
import { useTouchClickGuard } from "../../input/pointerInteraction";

type KonquerorToolbarProps = {
  readonly profile: KonquerorToolbarProfile;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly canGoUp: boolean;
  readonly canGoHome: boolean;
  readonly canReload: boolean;
  readonly canStop: boolean;
  readonly canSecurity: boolean;
  readonly canPrint: boolean;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly canCut: boolean;
  readonly canCopy: boolean;
  readonly canPaste: boolean;
  readonly canPreviousImage?: boolean;
  readonly canNextImage?: boolean;
  readonly imageZoom?: "fit-window" | "fit-width" | "fit-height" | 50 | 100 | 200;
  readonly cutTitle: string;
  readonly copyTitle: string;
  readonly pasteTitle: string;
  readonly navigationDisabledTitle?: string;
  readonly directoryViewMode: KonquerorResourceViewMode;
  readonly viewControlsDisabled: boolean;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onUp: () => void;
  readonly onHome: () => void;
  readonly onReload: () => void;
  readonly onStop: () => void;
  readonly onSecurity: () => void;
  readonly onPrint: () => void;
  readonly onCut: () => void;
  readonly onCopy: () => void;
  readonly onPaste: () => void;
  readonly onIconView: () => void;
  readonly onTreeView: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onPreviousImage?: () => void;
  readonly onNextImage?: () => void;
  readonly onImageZoomChange?: (zoom: "fit-window" | "fit-width" | "fit-height" | 50 | 100 | 200) => void;
  readonly onRotateRight?: () => void;
  readonly onNewWindow: () => void;
  readonly layoutMode?: WindowLayoutMode;
  readonly securityButtonRef?: RefObject<HTMLButtonElement | null>;
  readonly dockGrip?: ReactNode;
};

type ToolbarButton = {
  readonly label: string;
  readonly title: string;
  readonly disabled: boolean;
  readonly pressed?: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
};

export function KonquerorToolbar({
  profile,
  canGoBack,
  canGoForward,
  canGoUp,
  canGoHome,
  canReload,
  canStop,
  canSecurity,
  canPrint,
  canZoomIn,
  canZoomOut,
  canCut,
  canCopy,
  canPaste,
  canPreviousImage = false,
  canNextImage = false,
  imageZoom = "fit-window",
  cutTitle,
  copyTitle,
  pasteTitle,
  navigationDisabledTitle,
  directoryViewMode,
  viewControlsDisabled,
  onBack,
  onForward,
  onUp,
  onHome,
  onReload,
  onStop,
  onSecurity,
  onPrint,
  onCut,
  onCopy,
  onPaste,
  onIconView,
  onTreeView,
  onZoomIn,
  onZoomOut,
  onPreviousImage = () => undefined,
  onNextImage = () => undefined,
  onImageZoomChange = () => undefined,
  onRotateRight = () => undefined,
  onNewWindow,
  layoutMode = "desktop",
  securityButtonRef,
  dockGrip,
}: KonquerorToolbarProps) {
  const { t } = useI18n();
  const touchClickGuard = useTouchClickGuard<HTMLElement>();
  const navigationTitle = (enabled: boolean, fallback: string): string =>
    enabled || !navigationDisabledTitle ? fallback : navigationDisabledTitle;

  const getButton = (action: KonquerorToolbarAction): ToolbarButton => {
    switch (action) {
      case "up":
        return { label: t("konqueror.menu.up"), title: navigationTitle(canGoUp, t("konqueror.menu.up")), disabled: !canGoUp, onClick: onUp, icon: <UpIcon aria-hidden="true" focusable="false" /> };
      case "back":
        return { label: t("konqueror.menu.back"), title: navigationTitle(canGoBack, t("konqueror.menu.back")), disabled: !canGoBack, onClick: onBack, icon: <BackIcon aria-hidden="true" focusable="false" /> };
      case "forward":
        return { label: t("konqueror.menu.forward"), title: navigationTitle(canGoForward, t("konqueror.menu.forward")), disabled: !canGoForward, onClick: onForward, icon: <ForwardIcon aria-hidden="true" focusable="false" /> };
      case "home":
        return { label: t("konqueror.menu.home"), title: navigationTitle(canGoHome, t("konqueror.menu.home")), disabled: !canGoHome, onClick: onHome, icon: <HomeIcon aria-hidden="true" focusable="false" /> };
      case "reload":
        return { label: t("konqueror.toolbar.reload"), title: navigationTitle(canReload, t("konqueror.toolbar.reload")), disabled: !canReload, onClick: onReload, icon: <ReloadIcon aria-hidden="true" focusable="false" /> };
      case "stop":
        return {
          label: t("konqueror.toolbar.stop"),
          title: canStop ? t("konqueror.toolbar.stop") : t("konqueror.toolbar.noExternalLoading"),
          disabled: !canStop,
          onClick: onStop,
          icon: <StopIcon aria-hidden="true" focusable="false" />,
        };
      case "cut":
        return { label: t("konqueror.menu.cut"), title: cutTitle, disabled: !canCut, onClick: onCut, icon: <CutIcon aria-hidden="true" focusable="false" /> };
      case "copy":
        return { label: t("konqueror.menu.copy"), title: copyTitle, disabled: !canCopy, onClick: onCopy, icon: <CopyIcon aria-hidden="true" focusable="false" /> };
      case "paste":
        return { label: t("konqueror.menu.paste"), title: pasteTitle, disabled: !canPaste, onClick: onPaste, icon: <PasteIcon aria-hidden="true" focusable="false" /> };
      case "print":
        return {
          label: t("konqueror.menu.print"),
          title: canPrint ? t("konqueror.menu.print") : t("konqueror.toolbar.printUnavailable"),
          disabled: !canPrint,
          onClick: onPrint,
          icon: <PrintIcon aria-hidden="true" focusable="false" />,
        };
      case "zoom-in":
        return {
          label: t("konqueror.toolbar.zoomIn"),
          title: canZoomIn ? t("konqueror.toolbar.zoomIn") : t("konqueror.toolbar.maximumZoom"),
          disabled: !canZoomIn,
          onClick: onZoomIn,
          icon: <ZoomInIcon aria-hidden="true" focusable="false" />,
        };
      case "zoom-out":
        return {
          label: t("konqueror.toolbar.zoomOut"),
          title: canZoomOut ? t("konqueror.toolbar.zoomOut") : t("konqueror.toolbar.minimumZoom"),
          disabled: !canZoomOut,
          onClick: onZoomOut,
          icon: <ZoomOutIcon aria-hidden="true" focusable="false" />,
        };
      case "previous-image":
        return { label: t("konqueror.toolbar.previousImage"), title: canPreviousImage ? t("konqueror.toolbar.previousImage") : t("konqueror.toolbar.noPreviousImage"), disabled: !canPreviousImage, onClick: onPreviousImage, icon: <BackIcon aria-hidden="true" focusable="false" /> };
      case "next-image":
        return { label: t("konqueror.toolbar.nextImage"), title: canNextImage ? t("konqueror.toolbar.nextImage") : t("konqueror.toolbar.noNextImage"), disabled: !canNextImage, onClick: onNextImage, icon: <ForwardIcon aria-hidden="true" focusable="false" /> };
      case "rotate-right":
        return { label: t("konqueror.toolbar.rotateRight"), title: t("konqueror.toolbar.rotateRight"), disabled: false, onClick: onRotateRight, icon: <RotateRightIcon aria-hidden="true" focusable="false" /> };
      case "zoom-menu":
        throw new Error("The image zoom menu is rendered as a toolbar control.");
      case "icon-view":
        return {
          label: t("konqueror.menu.iconView"),
          title: viewControlsDisabled ? t("konqueror.toolbar.iconViewUnavailable") : t("konqueror.menu.iconView"),
          disabled: viewControlsDisabled,
          pressed: directoryViewMode === "icons",
          onClick: onIconView,
          icon: <IconViewIcon aria-hidden="true" focusable="false" />,
        };
      case "tree-view":
        return {
          label: t("konqueror.menu.treeView"),
          title: viewControlsDisabled ? t("konqueror.toolbar.treeViewUnavailable") : t("konqueror.menu.treeView"),
          disabled: viewControlsDisabled,
          pressed: directoryViewMode === "tree",
          onClick: onTreeView,
          icon: <TreeViewIcon aria-hidden="true" focusable="false" />,
        };
      case "security":
        return {
          label: t("konqueror.toolbar.security"),
          title: canSecurity ? t("konqueror.toolbar.security") : t("konqueror.toolbar.securityUnavailable"),
          disabled: !canSecurity,
          onClick: onSecurity,
          icon: <SecurityIcon aria-hidden="true" focusable="false" />,
        };
    }
  };

  const actionGroups = getKonquerorToolbarActionGroups(profile, layoutMode);

  return (
    <div
      className="konqueror-toolbar kde-chrome-surface"
      data-toolbar-profile={profile}
      data-toolbar-layout={layoutMode}
      aria-label={t("konqueror.toolbar")}
      onPointerDown={touchClickGuard.onPointerDown}
      onPointerMove={touchClickGuard.onPointerMove}
      onPointerUp={touchClickGuard.onPointerUp}
      onPointerCancel={touchClickGuard.onPointerCancel}
      onClickCapture={touchClickGuard.consumeClick}
    >
      {layoutMode === "mobile" ? null : dockGrip ?? <span className="toolbar-grip" aria-hidden="true" />}
      {actionGroups.map((group, groupIndex) => (
        <span className="toolbar-group" data-toolbar-group={groupIndex} key={group[0]}>
          {group.map((action) => {
            if (action === "zoom-menu") {
              return (
                <select
                  className="konqueror-toolbar__image-zoom"
                  data-toolbar-action={action}
                  aria-label={t("konqueror.toolbar.imageZoom")}
                  title={t("konqueror.toolbar.imageZoom")}
                  value={String(imageZoom)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    onImageZoomChange(value === "fit-window" || value === "fit-width" || value === "fit-height" ? value : Number(value) as 50 | 100 | 200);
                  }}
                  key={action}
                >
                  <option value="fit-window">{t("konqueror.toolbar.fitWindow")}</option>
                  <option value="fit-width">{t("konqueror.toolbar.fitWidth")}</option>
                  <option value="fit-height">{t("konqueror.toolbar.fitHeight")}</option>
                  <option value="50">50%</option>
                  <option value="100">100%</option>
                  <option value="200">200%</option>
                </select>
              );
            }
            const button = getButton(action);

            return (
              <button
                type="button"
                className={`toolbar-button${button.pressed ? " is-active" : ""}`}
                aria-label={button.label}
                aria-pressed={button.pressed}
                title={translateKonquerorAvailabilityText(t, button.title)}
                disabled={button.disabled}
                onClick={button.onClick}
                key={action}
                data-toolbar-action={action}
                ref={action === "security" ? securityButtonRef : undefined}
              >
                {button.icon}
              </button>
            );
          })}
          {groupIndex < actionGroups.length - 1 ? <span className="toolbar-separator" aria-hidden="true" /> : null}
        </span>
      ))}
      {layoutMode !== "mobile" && (profile === "image" || profile === "media") ? <span className="toolbar-separator" aria-hidden="true" /> : null}
      <span className="toolbar-spacer" aria-hidden="true" />
      <button
        type="button"
        className="toolbar-button toolbar-button--new-window"
        data-toolbar-action="new-window"
        aria-label={t("konqueror.toolbar.newWindow")}
        title={t("konqueror.toolbar.newWindow")}
        onClick={onNewWindow}
      >
        <KonquerorIcon aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}
