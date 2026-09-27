export const CLOSE_SHELL_POPUPS_EVENT = "kde3:close-shell-popups";

export function closeShellPopups(): void {
  document.dispatchEvent(new Event(CLOSE_SHELL_POPUPS_EVENT));
  window.dispatchEvent(new Event(CLOSE_SHELL_POPUPS_EVENT));
}
