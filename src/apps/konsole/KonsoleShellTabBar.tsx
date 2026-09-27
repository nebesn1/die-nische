import type { KonsoleShellSession, KonsoleShellSessionId } from "./konsoleShellSessions";
import { useI18n } from "../../i18n/useI18n";

type KonsoleShellTabBarProps = {
  readonly sessions: readonly KonsoleShellSession[];
  readonly activeSessionId: KonsoleShellSessionId;
  readonly onNewShell: () => void;
  readonly onSelectShell: (sessionId: KonsoleShellSessionId) => void;
  readonly onRenameShell: (sessionId: KonsoleShellSessionId) => void;
  readonly onCloseShell: () => void;
};

export function KonsoleShellTabBar({
  sessions,
  activeSessionId,
  onNewShell,
  onSelectShell,
  onRenameShell,
  onCloseShell,
}: KonsoleShellTabBarProps) {
  const { t } = useI18n();
  return (
    <div className="konsole-shell-tabbar" aria-label={t("konsole.shellSessions")}>
      <button type="button" className="konsole-shell-tabbar__new" aria-label={t("konsole.newShell")} title={t("konsole.newShell")} onClick={onNewShell}>+</button>
      <div className="konsole-shell-tabbar__tabs" role="tablist" aria-label={t("konsole.konsoleShells")}>
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            role="tab"
            className={`konsole-shell-tab${session.id === activeSessionId ? " is-active" : ""}`}
            aria-selected={session.id === activeSessionId}
            data-konsole-shell-id={session.id}
            onClick={() => onSelectShell(session.id)}
            onDoubleClick={() => onRenameShell(session.id)}
          >
            {session.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="konsole-shell-tabbar__close"
        aria-label={t("konsole.closeShell")}
        title={t("konsole.closeShell")}
        disabled={sessions.length <= 1}
        onClick={onCloseShell}
      >
        ×
      </button>
    </div>
  );
}
