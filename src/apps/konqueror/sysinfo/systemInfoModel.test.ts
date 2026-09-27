import { describe, expect, it } from "vitest";
import { createBrowserSystemInfo } from "./systemInfoModel";

describe("browser system information model", () => {
  it("uses only supplied browser-exposed values", () => {
    expect(createBrowserSystemInfo(
      { onLine: true, platform: "Linux x86_64", hardwareConcurrency: 8, deviceMemory: 16 },
      { width: 1280, height: 1024, colorDepth: 24 },
      1.25,
    )).toEqual({
      platform: "Linux x86_64",
      online: true,
      logicalProcessors: 8,
      deviceMemoryGb: 16,
      screenWidth: 1280,
      screenHeight: 1024,
      colorDepth: 24,
      devicePixelRatio: 1.25,
    });
  });

  it("uses userAgentData platform before legacy platform and supports offline", () => {
    const info = createBrowserSystemInfo(
      { onLine: false, platform: "legacy", userAgentData: { platform: "Browser Platform" } },
      null,
      null,
    );

    expect(info.platform).toBe("Browser Platform");
    expect(info.online).toBe(false);
  });

  it("returns safe browser-unavailable values without probing the host", () => {
    expect(createBrowserSystemInfo(null, null, undefined)).toEqual({
      platform: null,
      online: true,
      logicalProcessors: null,
      deviceMemoryGb: null,
      screenWidth: null,
      screenHeight: null,
      colorDepth: null,
      devicePixelRatio: null,
    });
  });

  it("rejects non-finite browser values", () => {
    const info = createBrowserSystemInfo(
      { hardwareConcurrency: Number.NaN, deviceMemory: Number.POSITIVE_INFINITY },
      { width: Number.NaN, height: 720, colorDepth: Number.NEGATIVE_INFINITY },
      Number.NaN,
    );

    expect(info.logicalProcessors).toBeNull();
    expect(info.deviceMemoryGb).toBeNull();
    expect(info.screenWidth).toBeNull();
    expect(info.screenHeight).toBe(720);
    expect(info.colorDepth).toBeNull();
    expect(info.devicePixelRatio).toBeNull();
  });
});
