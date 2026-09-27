# KDE 3 Web Desktop Phase 0 Whitepaper

## Positioning

KDE 3 Web Desktop is a static frontend project that recreates the look and interaction vocabulary of the classic KDE 3 desktop in modern browsers. It is a desktop simulator, not a port of KDE, Linux, X11, KWin, Konqueror, or any KDE application.

The project should be deployable as static files, including GitHub Pages subpath deployments.

## Goals

- Establish a Vite, React, TypeScript, CSS, Vitest, and ESLint foundation.
- Build a static KDE 3 style desktop shell visible immediately after page load.
- Define visual tokens and early architecture boundaries.
- Provide a working SVG seven-segment clock component.
- Keep all art assets original or clearly licensed.

## MVP

- Full-viewport desktop background.
- Four static desktop icons.
- A static Konqueror prototype window.
- A bottom Kicker panel with launcher placeholders, pager, task button, tray, and clock.
- Unit tests for clock formatting and segment mapping.

## Non-Goals For Phase 0

- Real window management, dragging, resizing, minimizing, maximizing, or closing.
- Virtual file system.
- Konsole command execution or terminal emulation.
- Persistent settings, IndexedDB, or backend storage.
- KDE menu popups.
- Real KDE, Linux, X11, or Konqueror code.
- Reuse of source-unclear KDE icons, wallpapers, fonts, or sounds.
