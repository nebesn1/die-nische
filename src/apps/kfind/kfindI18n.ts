import type { TranslationKey } from "../../i18n/messages/en";

type Translator = (key: TranslationKey, params?: Readonly<Record<string, string | number>>) => string;

const messageKeys: Readonly<Record<string, TranslationKey>> = {
  "Invalid date range.": "kfind.invalidDateRange",
  "Invalid previous period.": "kfind.invalidPreviousPeriod",
  "Invalid file size.": "kfind.invalidFileSize",
  "Search failed.": "kfind.searchFailed",
  "Location is unavailable.": "kfind.locationUnavailable",
  "Location is not a folder.": "kfind.locationNotFolder",
  "Search location is not a directory.": "kfind.searchLocationUnavailable",
  "The selected replacement file is no longer available.": "kfind.replacementUnavailable",
  "The selected directory is no longer available.": "kfind.directoryUnavailable",
  "A folder with that name already exists.": "kfind.folderExists",
  "The selected file is no longer available.": "kfind.selectedFileUnavailable",
  "Some search results are no longer available. Run Find again.": "kfind.resultsUnavailable",
  "Selected result is no longer available.": "kfind.selectedResultUnavailable",
  "Node name cannot be empty.": "kfind.invalidNameEmpty",
  "Node name cannot be a path segment.": "kfind.invalidNameSegment",
  "Node name contains an invalid character.": "kfind.invalidNameCharacter",
};

export function translateKFindMessage(message: string, t: Translator): string {
  const key = messageKeys[message];
  return key === undefined ? message : t(key);
}
