import { describe, expect, it } from "vitest";
import { createInitialVfsState } from "../../vfs/initialState";
import { getKonquerorLocationLaunchIntent } from "./locationLaunchIntent";

describe("getKonquerorLocationLaunchIntent", () => {
  const vfsState = createInitialVfsState();

  it("reuses the accepted Konqueror location resolver for directories, files, and HTTPS URLs", () => {
    expect(getKonquerorLocationLaunchIntent(vfsState, "/home/user/Documents")).toEqual({
      type: "open-directory",
      nodeId: "vfs-documents",
    });
    expect(getKonquerorLocationLaunchIntent(vfsState, "/home/user/Documents/Notes.txt")).toMatchObject({
      type: "open-file",
    });
    expect(getKonquerorLocationLaunchIntent(vfsState, "https://example.com/path")).toEqual({
      type: "open-external-web",
      canonicalUrl: "https://example.com/path",
    });
  });

  it("rejects unsupported locations without inventing a second parser", () => {
    expect(getKonquerorLocationLaunchIntent(vfsState, "file:///tmp/example")).toBeNull();
    expect(getKonquerorLocationLaunchIntent(vfsState, "/not/in/the/vfs")).toBeNull();
  });
});
