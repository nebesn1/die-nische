import type { ReactNode } from "react";
import type { TranslationKey } from "../i18n/messages/en";
import type { ApplicationId, WindowBounds, WindowId } from "../window-manager/types";

export interface ApplicationInitialSizing {
  maximumWorkAreaHeightRatio?: number;
}

export interface ApplicationWindowDefaults {
  bounds: WindowBounds;
  minimumWidth: number;
  minimumHeight: number;
  isResizable: boolean;
  /** Omitted definitions retain the established minimizable window behavior. */
  isMinimizable?: boolean;
  /** Omitted definitions retain the established maximizable window behavior. */
  isMaximizable?: boolean;
  /** Keep this application above ordinary application windows. */
  alwaysOnTop?: boolean;
  initialSizing?: ApplicationInitialSizing;
}

export interface ApplicationRenderProps {
  windowId: WindowId;
  appId: ApplicationId;
  isActive: boolean;
  focusRequestId: number;
  launchRequest: ApplicationLaunchRequest | null;
  closeRequest: ApplicationCloseRequest | null;
  requestWindowClose(): void;
  commitWindowClose(requestId: number): void;
  cancelWindowClose(requestId: number): void;
  setWindowTitle(title: string): void;
}

export type ApplicationCloseBehavior = "immediate" | "application-guarded";
export type ApplicationInstancePolicy = "singleton" | "multiple";

export interface ApplicationDefinition {
  appId: ApplicationId;
  name: string;
  defaultTitle: string;
  /** Optional locale-aware static window title. Dynamic document titles remain app-owned. */
  titleKey?: TranslationKey;
  iconId: string;
  /** Omitted definitions retain the legacy singleton behavior. */
  instancePolicy?: ApplicationInstancePolicy;
  defaultLaunchIntent?: unknown;
  closeBehavior?: ApplicationCloseBehavior;
  /** Whether explicit user launches may contribute to K Menu Most Used rows. */
  isMostUsedEligible?: boolean;
  window: ApplicationWindowDefaults;
  render: (props: ApplicationRenderProps) => ReactNode;
}

export type LaunchApplicationResult =
  | "opened"
  | "activated"
  | "restored"
  | "switched-desktop-and-activated"
  | "switched-desktop-and-restored"
  | "already-active"
  | "unknown-application";

export interface ApplicationLaunchRequest {
  readonly requestId: number;
  readonly intent: unknown;
}

export interface ApplicationCloseRequest {
  readonly requestId: number;
}

export interface LaunchApplicationOptions {
  readonly intent?: unknown;
  /** Optional launcher-owned first-open geometry. Existing instances keep their current bounds. */
  readonly initialBounds?: import("../window-manager/types").WindowBounds;
  /** System launches are excluded from current-page Most Used statistics. */
  readonly origin?: "system" | "user";
}
