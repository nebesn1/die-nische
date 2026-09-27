import type {
  DesktopPreferencesPersistenceStatus,
} from "../../preferences/desktopPreferencesPersistence";

export type KControlNoticeKey =
  | "common.settingsApplied"
  | "common.preferencesChangedExternally"
  | "common.storedSettingsInvalid"
  | "common.storedSettingsNewerVersion"
  | "common.settingsSessionOnly"
  | "common.storedSettingsReadFailed"
  | "common.settingsWriteFailed";

export function getKControlPersistenceNoticeKey(
  status: DesktopPreferencesPersistenceStatus,
): KControlNoticeKey | null {
  switch (status.type) {
    case "invalid":
      return "common.storedSettingsInvalid";
    case "unsupported-version":
      return "common.storedSettingsNewerVersion";
    case "storage-unavailable":
      return "common.settingsSessionOnly";
    case "read-failed":
      return "common.storedSettingsReadFailed";
    case "write-failed":
      return "common.settingsWriteFailed";
    default:
      return null;
  }
}
