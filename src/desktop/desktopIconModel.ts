import { getApplicationDefinition } from "../application-runtime/applicationRegistry";
import type { LaunchApplicationOptions } from "../application-runtime/types";
import { createKonquerorOpenLocationIntent, createKonquerorOpenSysinfoIntent } from "../apps/konqueror/launchIntent";
import { PROJECT_ABOUT_ICON_ID } from "../branding/projectIdentity";
import type { DesktopIconDefinition } from "./desktopIconTypes";

const freezeDesktopIcons = <T extends readonly DesktopIconDefinition[]>(definitions: T): T => {
  definitions.forEach((definition) => {
    if (definition.labelLines) {
      Object.freeze(definition.labelLines);
    }

    if (definition.action.type === "launch-application" && typeof definition.action.intent === "object" && definition.action.intent !== null) {
      Object.freeze(definition.action.intent);
    }

    Object.freeze(definition.action);
    Object.freeze(definition);
  });

  return Object.freeze(definitions);
};

export const desktopIconDefinitions = freezeDesktopIcons([
  {
    id: "desktop-trash",
    label: "Trash",
    labelLines: ["Trash"],
    iconId: "trash",
    action: {
      type: "launch-application",
      appId: "konqueror",
      intent: createKonquerorOpenLocationIntent("trash"),
      newInstance: true,
    },
    initialColumn: 1,
    initialRow: 1,
  },
  {
    id: "desktop-my-computer",
    label: "My Computer",
    labelLines: ["My Computer"],
    iconId: "my-computer",
    action: {
      type: "launch-application",
      appId: "konqueror",
      intent: createKonquerorOpenSysinfoIntent(),
      newInstance: true,
    },
    initialColumn: 1,
    initialRow: 2,
  },
  {
    id: "desktop-blog",
    label: "Blog",
    labelLines: ["Blog"],
    iconId: "kwrite",
    action: {
      type: "launch-application",
      appId: "blog",
    },
    initialColumn: 1,
    initialRow: 3,
  },
  {
    id: "desktop-about-die-nische",
    label: "About",
    labelLines: ["About"],
    iconId: PROJECT_ABOUT_ICON_ID,
    action: {
      type: "launch-application",
      appId: "about-die-nische",
    },
    initialColumn: 1,
    initialRow: 4,
  },
] as const satisfies readonly DesktopIconDefinition[]);

export function getDesktopHomeLaunchRequest(): { readonly appId: "konqueror"; readonly options: LaunchApplicationOptions; readonly newInstance: true } {
  return { appId: "konqueror", options: { intent: createKonquerorOpenLocationIntent("home") }, newInstance: true };
}

export type RegisteredDesktopIconId = (typeof desktopIconDefinitions)[number]["id"];

export function getDesktopIconDefinition(iconId: string): DesktopIconDefinition | undefined {
  return desktopIconDefinitions.find((definition) => definition.id === iconId);
}

export function isKnownDesktopIconId(iconId: string): boolean {
  return getDesktopIconDefinition(iconId) !== undefined;
}

export function getDesktopIconLaunchAppId(definition: DesktopIconDefinition): string | null {
  if (definition.action.type !== "launch-application") {
    return null;
  }

  return getApplicationDefinition(definition.action.appId) ? definition.action.appId : null;
}

export function getDesktopIconLaunchRequest(
  definition: DesktopIconDefinition,
): { readonly appId: string; readonly options?: LaunchApplicationOptions; readonly newInstance?: boolean } | null {
  const appId = getDesktopIconLaunchAppId(definition);

  if (!appId) {
    return null;
  }

  if (definition.action.type !== "launch-application") {
    return null;
  }

  return definition.action.intent !== undefined
    ? { appId, options: { intent: definition.action.intent }, newInstance: definition.action.newInstance }
    : { appId, newInstance: definition.action.newInstance };
}
