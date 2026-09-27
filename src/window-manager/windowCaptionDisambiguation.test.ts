import { describe, expect, it } from "vitest";
import { disambiguateWindowCaptions } from "./windowCaptionDisambiguation";

const window = (
  id: string,
  appId: string,
  baseTitle: string,
  overrides: Partial<{ readonly title: string; readonly zIndex: number; readonly isActive: boolean }> = {},
) => ({ id, appId, baseTitle, title: baseTitle, ...overrides });

describe("generic window caption disambiguation", () => {
  it("handles empty and non-colliding windows without suffixes", () => {
    expect(disambiguateWindowCaptions([])).toEqual([]);
    expect(disambiguateWindowCaptions([
      window("app:konqueror", "konqueror", "Documents - Konqueror"),
      window("app:konqueror::2", "konqueror", "Downloads - Konqueror"),
    ]).map((item) => item.title)).toEqual(["Documents - Konqueror", "Downloads - Konqueror"]);
  });

  it("uses app id plus exact base caption and collision rank rather than runtime serial", () => {
    const captions = disambiguateWindowCaptions([
      window("app:konqueror::7", "konqueror", "Documents - Konqueror"),
      window("app:konqueror::12", "konqueror", "Documents - Konqueror"),
      window("app:konqueror::18", "konqueror", "Documents - Konqueror"),
      window("app:about", "about", "Documents - Konqueror"),
    ]);

    expect(captions.map((item) => item.title)).toEqual([
      "Documents - Konqueror",
      "Documents - Konqueror<2>",
      "Documents - Konqueror<3>",
      "Documents - Konqueror",
    ]);
  });

  it("uses stable input creation order, not focus or z-index", () => {
    const captions = disambiguateWindowCaptions([
      window("first", "konqueror", "Documents - Konqueror", { zIndex: 10, isActive: false }),
      window("second", "konqueror", "Documents - Konqueror", { zIndex: 99, isActive: true }),
      window("third", "konqueror", "Documents - Konqueror", { zIndex: 50, isActive: false }),
    ]);

    expect(captions.map((item) => item.title)).toEqual([
      "Documents - Konqueror",
      "Documents - Konqueror<2>",
      "Documents - Konqueror<3>",
    ]);
  });

  it("live-reindexes groups without gaps when captions leave or enter", () => {
    const afterMiddleClose = disambiguateWindowCaptions([
      window("first", "konqueror", "Documents - Konqueror"),
      window("third", "konqueror", "Documents - Konqueror"),
    ]);
    const afterEnter = disambiguateWindowCaptions([
      window("first", "konqueror", "Documents - Konqueror"),
      window("second", "konqueror", "Documents - Konqueror"),
      window("third", "konqueror", "Documents - Konqueror"),
    ]);

    expect(afterMiddleClose.map((item) => item.title)).toEqual(["Documents - Konqueror", "Documents - Konqueror<2>"]);
    expect(afterEnter.map((item) => item.title)).toEqual([
      "Documents - Konqueror",
      "Documents - Konqueror<2>",
      "Documents - Konqueror<3>",
    ]);
  });

  it("uses baseTitle rather than an already-disambiguated display title", () => {
    const captions = disambiguateWindowCaptions([
      window("first", "konqueror", "Documents - Konqueror"),
      window("second", "konqueror", "Documents - Konqueror", { title: "Documents - Konqueror<2>" }),
    ]);

    expect(captions.map((item) => item.title)).toEqual(["Documents - Konqueror", "Documents - Konqueror<2>"]);
  });

  it("supports future duplicate KFind and KWrite captions without changing their runtime policies", () => {
    const captions = disambiguateWindowCaptions([
      window("app:kfind", "kfind", "Find Files/Folders"),
      window("app:kfind::7", "kfind", "Find Files/Folders"),
      window("app:kwrite", "kwrite", "Untitled - KWrite"),
      window("app:kwrite::12", "kwrite", "Untitled - KWrite"),
      window("app:kwrite::13", "kwrite", "A.txt - KWrite"),
    ]);

    expect(captions.map((item) => item.title)).toEqual([
      "Find Files/Folders",
      "Find Files/Folders<2>",
      "Untitled - KWrite",
      "Untitled - KWrite<2>",
      "A.txt - KWrite",
    ]);
  });
});
