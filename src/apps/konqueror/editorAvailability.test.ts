import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { getKonquerorView } from "./navigationController";
import { createInitialKonquerorNavigationState } from "./navigationState";
import { getKonquerorEditorAvailability } from "./editorAvailability";
import type { KonquerorEditorState } from "./editorTypes";

const state = createInitialVfsState();
const documentsState = createInitialKonquerorNavigationState(
  state.specialLocations.documents,
  "/home/user/Documents",
);
const fileState = createInitialKonquerorNavigationState("vfs-content-76cff3ce17d8a853403179f1", "/home/user/Documents/Welcome.md");

describe("Konqueror editor availability", () => {
  it("disables Edit in directory view", () => {
    const availability = getKonquerorEditorAvailability(getKonquerorView(state, documentsState), { kind: "closed" });

    expect(availability.canEdit).toBe(false);
    expect(availability.editTitle).toBe("Open a text file before editing");
  });

  it("enables Edit for UTF-8 text files", () => {
    const availability = getKonquerorEditorAvailability(getKonquerorView(state, fileState), { kind: "closed" });

    expect(availability.canEdit).toBe(true);
    expect(availability.editTitle).toBe("Edit Text File");
  });

  it("disables Edit and navigation while editing", () => {
    const editorState: KonquerorEditorState = {
      kind: "editing",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalContent: "A",
      draftContent: "A",
      originalModifiedAt: "2004-08-25T12:00:00.000Z",
      saveError: null,
    };
    const availability = getKonquerorEditorAvailability(getKonquerorView(state, fileState), editorState);

    expect(availability.canEdit).toBe(false);
    expect(availability.canSave).toBe(false);
    expect(availability.canDiscard).toBe(true);
    expect(availability.navigationDisabled).toBe(true);
    expect(availability.editTitle).toBe("Already editing this text file");
  });

  it("enables Save only for dirty drafts", () => {
    const editorState: KonquerorEditorState = {
      kind: "editing",
      targetNodeId: "vfs-content-76cff3ce17d8a853403179f1",
      originalContent: "A",
      draftContent: "B",
      originalModifiedAt: "2004-08-25T12:00:00.000Z",
      saveError: null,
    };
    const availability = getKonquerorEditorAvailability(getKonquerorView(state, fileState), editorState);

    expect(availability.canSave).toBe(true);
    expect(availability.isDirty).toBe(true);
    expect(availability.saveTitle).toBe("Save");
  });
});
