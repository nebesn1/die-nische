import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getMostUsedApplicationIds } from "../../application-runtime/applicationUsage";
import { useOptionalApplicationUsage } from "../../application-runtime/ApplicationUsageContext";
import { initialApplicationUsageState } from "../../application-runtime/applicationUsage";
import { useApplicationLauncher } from "../../application-runtime/useApplicationLauncher";
import { KonquerorBookmarksContext } from "../../apps/konqueror/konquerorBookmarksContext";
import { getKonquerorLocationLaunchIntent } from "../../apps/konqueror/locationLaunchIntent";
import { createKonsoleWorkingDirectoryIntent } from "../../apps/konsole/launchIntent";
import { useOptionalDesktopSession } from "../../desktop/useDesktopSession";
import { closeShellPopups, CLOSE_SHELL_POPUPS_EVENT } from "../../shell/shellPopupEvents";
import { VfsContext } from "../../vfs/VfsContext";
import { WindowManagerContext } from "../../window-manager/useWindowManager";
import { CLOSE_K_MENU_EVENT, CLOSE_WINDOW_MENU_EVENT } from "../../window-manager/window-menu/types";
import { KMenuButton } from "./KMenuButton";
import { KMenuPanel } from "./KMenuPanel";
import { getKMenuEntries, getMostUsedEligibleApplicationIds } from "./menuModel";
import { initialKMenuState, kMenuReducer } from "./menuState";
import { RunCommandDialog } from "./RunCommandDialog";
import { getRunCommandPlan } from "./runCommand";
import { executeRunCommandPlan } from "./runCommandExecution";
import type { KMenuCommandEntry, KMenuEntry } from "./types";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/messages/en";

const menuId = "k-menu-panel";

type RunCommandError =
  | { readonly type: "translation"; readonly key: TranslationKey }
  | { readonly type: "raw"; readonly message: string };

const kMenuEntryTranslationKeys: Readonly<Record<string, TranslationKey>> = {
  "category-editors": "kmenu.editors",
  "category-internet": "kmenu.internet",
  "category-settings": "kmenu.settings",
  "category-system": "kmenu.system",
  "category-utilities": "kmenu.utilities",
  "app-kwrite": "kmenu.textEditor",
  "app-konqueror-browser": "kmenu.webBrowser",
  "settings-configure-panel": "kmenu.configurePanel",
  "app-konsole": "kmenu.terminalProgram",
  "app-kcalc": "kmenu.scientificCalculator",
  "all-applications-control-center": "kmenu.controlCenter",
  "common-find-files": "kmenu.findFiles",
  "common-help": "kmenu.help",
  "common-project-about": "kmenu.aboutDieNische",
  "common-home": "kmenu.personalFiles",
  "action-bookmarks": "kmenu.bookmarks",
  "action-quick-browser": "kmenu.quickBrowser",
  "command-run": "kmenu.runCommand",
  "command-lock-screen": "kmenu.lockSession",
  "command-logout": "kmenu.logout",
  "bookmark-empty": "kmenu.noBookmarks",
  "bookmark-edit": "kmenu.editBookmarks",
};

const mostUsedTranslationKeyByApplicationId: Readonly<Record<string, TranslationKey>> = {
  kwrite: "kmenu.textEditor",
  konqueror: "kmenu.webBrowser",
  "configure-panel": "kmenu.configurePanel",
  konsole: "kmenu.terminalProgram",
  kcalc: "kmenu.scientificCalculator",
  kcontrol: "kmenu.controlCenter",
  kfind: "kmenu.findFiles",
  "about-kde": "kmenu.help",
};

const getKMenuTranslationKey = (entryId: string, appId?: string): TranslationKey | undefined => {
  if (entryId.startsWith("most-used-") && appId) {
    return mostUsedTranslationKeyByApplicationId[appId];
  }

  if (entryId.startsWith("quick-open-")) return "kmenu.openInFileManager";
  if (entryId.startsWith("quick-terminal-")) return "kmenu.openInTerminal";
  if (entryId.startsWith("quick-empty-")) return "kmenu.empty";
  if (entryId === "quick-root-/home/user") return "kmenu.homeDirectory";
  if (entryId === "quick-root-/") return "kmenu.rootDirectory";
  return kMenuEntryTranslationKeys[entryId];
};

export function KMenu() {
  const {
    launchApplication,
    launchNewApplicationInstance,
    launchNewUserApplicationInstance,
    launchUserApplication,
  } = useApplicationLauncher();
  const userLaunchApplication = launchUserApplication ?? launchApplication;
  const userLaunchNewApplicationInstance = launchNewUserApplicationInstance ?? launchNewApplicationInstance;
  const vfs = useContext(VfsContext);
  const windowManager = useContext(WindowManagerContext);
  const layoutMode = windowManager?.layoutMode ?? "desktop";
  const { bookmarks, getNode, recordVisit } = useContext(KonquerorBookmarksContext);
  const desktopSession = useOptionalDesktopSession();
  const { t } = useI18n();
  const applicationUsage = useOptionalApplicationUsage() ?? initialApplicationUsageState;
  const mostUsedApplicationIds = getMostUsedApplicationIds(
    applicationUsage,
    getMostUsedEligibleApplicationIds(),
  );
  const entries = useMemo(
    () => getKMenuEntries(mostUsedApplicationIds, bookmarks.rootChildren, vfs?.state ?? null, layoutMode),
    [bookmarks.rootChildren, layoutMode, mostUsedApplicationIds, vfs?.state],
  );
  const labelOverrides = useMemo(() => {
    const overrides: Record<string, string> = {
      "section-most-used": t("kmenu.mostUsedApplications"),
      "section-all-applications": t("kmenu.allApplications"),
      "section-actions": t("kmenu.actions"),
    };

    const visit = (items: readonly KMenuEntry[]) => {
      items.forEach((entry) => {
        if (entry.type === "submenu") visit(entry.children);
        const key = getKMenuTranslationKey(entry.id, entry.type === "application" ? entry.appId : undefined);
        if (key) overrides[entry.id] = t(key);
      });
    };

    visit(entries);
    return overrides;
  }, [entries, t]);
  const [state, dispatch] = useReducer(kMenuReducer, initialKMenuState);
  const [isRunCommandOpen, setIsRunCommandOpen] = useState(false);
  const [runCommandInput, setRunCommandInput] = useState("");
  const [runCommandError, setRunCommandError] = useState<RunCommandError | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dispatch({ type: "close-submenu" });
    dispatch({ type: "set-active-item", itemId: null });
  }, [layoutMode]);

  const closeMenu = useCallback((returnFocus: boolean) => {
    dispatch({ type: "close" });

    if (returnFocus) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);

  const toggleMenu = () => {
    if (state.isOpen) {
      closeMenu(false);
      return;
    }

    closeShellPopups();
    window.dispatchEvent(new Event(CLOSE_WINDOW_MENU_EVENT));
    dispatch({ type: "toggle" });
  };

  useEffect(() => {
    const handleCloseKMenu = () => {
      dispatch({ type: "close" });
    };

    window.addEventListener(CLOSE_K_MENU_EVENT, handleCloseKMenu);
    window.addEventListener(CLOSE_SHELL_POPUPS_EVENT, handleCloseKMenu);

    return () => {
      window.removeEventListener(CLOSE_K_MENU_EVENT, handleCloseKMenu);
      window.removeEventListener(CLOSE_SHELL_POPUPS_EVENT, handleCloseKMenu);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== "f2" || desktopSession?.isLocked || desktopSession?.endSessionDialog !== "closed") {
        return;
      }

      event.preventDefault();
      closeMenu(false);
      closeShellPopups();
      setRunCommandError(null);
      setIsRunCommandOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, desktopSession?.endSessionDialog, desktopSession?.isLocked]);

  useEffect(() => {
    if (!state.isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeMenu, state.isOpen]);

  useEffect(() => {
    if (!state.isOpen) {
      return;
    }

    if (!state.activeItemId) {
      menuRootRef.current?.querySelector<HTMLElement>(`#${menuId}`)?.focus();
      return;
    }

    const item = menuRootRef.current?.querySelector<HTMLButtonElement>(
      `[data-menu-item-id="${state.activeItemId}"]`,
    );

    item?.focus();
  }, [state.activeItemId, state.isOpen]);

  const closeRunCommand = () => {
    setIsRunCommandOpen(false);
    setRunCommandError(null);
    setRunCommandInput("");
  };

  const launchKonquerorLocation = (location: string): boolean => {
    if (!vfs) {
      return false;
    }

    const intent = getKonquerorLocationLaunchIntent(vfs.state, location);
    if (intent === null) {
      return false;
    }

    return userLaunchNewApplicationInstance("konqueror", { intent }) !== "unknown-application";
  };

  const executeCommand = (entry: KMenuCommandEntry) => {
    if (!entry.enabled) {
      return;
    }

    switch (entry.commandId) {
      case "open-bookmark": {
        const bookmarkId = (entry.payload as { readonly bookmarkId?: string } | undefined)?.bookmarkId;
        const bookmark = bookmarkId ? getNode(bookmarkId) : null;
        if (bookmark?.type === "bookmark" && launchKonquerorLocation(bookmark.location)) {
          recordVisit(bookmark.id);
          closeMenu(false);
        }
        return;
      }
      case "open-location": {
        const location = (entry.payload as { readonly location?: string } | undefined)?.location;
        if (location && launchKonquerorLocation(location)) {
          closeMenu(false);
        }
        return;
      }
      case "open-terminal-directory": {
        const location = (entry.payload as { readonly location?: string } | undefined)?.location;
        if (location) {
          userLaunchNewApplicationInstance("konsole", { intent: createKonsoleWorkingDirectoryIntent(location) });
          closeMenu(false);
        }
        return;
      }
      case "edit-bookmarks":
        userLaunchApplication("bookmark-editor");
        closeMenu(false);
        return;
      case "run-command":
        closeMenu(false);
        setRunCommandError(null);
        setIsRunCommandOpen(true);
        return;
      case "lock-session":
        closeMenu(false);
        desktopSession?.lockSession();
        return;
      case "logout":
        closeMenu(false);
        desktopSession?.openLogout?.();
        return;
      default:
        return;
    }
  };

  const runCommand = () => {
    if (!vfs) {
      setRunCommandError({ type: "translation", key: "runCommand.failed" });
      return;
    }

    const plan = getRunCommandPlan(vfs.state, runCommandInput);
    const result = executeRunCommandPlan(plan, {
      launchApplication: userLaunchApplication,
      launchNewApplicationInstance: userLaunchNewApplicationInstance,
    });

    if (result.type === "accepted") {
      closeRunCommand();
      return;
    }

    setRunCommandError(result.message === "Enter a command."
      ? { type: "translation", key: "runCommand.empty" }
      : result.message === "Command could not be run."
        ? { type: "translation", key: "runCommand.failed" }
        : { type: "raw", message: result.message });
  };

  return (
    <div className="k-menu-root" ref={menuRootRef}>
      <KMenuButton
        buttonRef={buttonRef}
        controlsId={menuId}
        isOpen={state.isOpen}
        onToggle={toggleMenu}
      />
      {state.isOpen ? (
        <KMenuPanel
          menuId={menuId}
          entries={entries}
          state={state}
          onSetActiveItem={(itemId) => dispatch({ type: "set-active-item", itemId })}
          onOpenSubmenu={(entry) => dispatch({ type: "open-submenu", submenuId: entry.id, enabled: entry.enabled })}
          onCloseSubmenu={() => dispatch({ type: "close-submenu" })}
          onCloseMenu={closeMenu}
          onLaunchApplication={userLaunchApplication}
          onLaunchNewApplicationInstance={userLaunchNewApplicationInstance}
          onExecuteCommand={executeCommand}
          ariaLabel={t("kmenu.menu")}
          labelOverrides={labelOverrides}
        />
      ) : null}
      {isRunCommandOpen ? (
        <RunCommandDialog
          value={runCommandInput}
          error={runCommandError === null ? null : runCommandError.type === "translation" ? t(runCommandError.key) : runCommandError.message}
          onChange={(value) => {
            setRunCommandInput(value);
            setRunCommandError(null);
          }}
          onRun={runCommand}
          onCancel={closeRunCommand}
          onDismissError={() => setRunCommandError(null)}
        />
      ) : null}
    </div>
  );
}
