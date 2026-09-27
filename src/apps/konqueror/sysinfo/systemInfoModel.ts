export interface BrowserSystemInfo {
  readonly platform: string | null;
  readonly online: boolean;
  readonly logicalProcessors: number | null;
  readonly deviceMemoryGb: number | null;
  readonly screenWidth: number | null;
  readonly screenHeight: number | null;
  readonly colorDepth: number | null;
  readonly devicePixelRatio: number | null;
}

type BrowserNavigator = {
  readonly onLine?: boolean;
  readonly platform?: string;
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly userAgentData?: { readonly platform?: string };
};

type BrowserScreen = {
  readonly width?: number;
  readonly height?: number;
  readonly colorDepth?: number;
};

const finiteNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function createBrowserSystemInfo(
  browserNavigator: BrowserNavigator | null,
  browserScreen: BrowserScreen | null,
  devicePixelRatio: unknown,
): BrowserSystemInfo {
  const platform = browserNavigator?.userAgentData?.platform ?? browserNavigator?.platform ?? null;

  return {
    platform: platform && platform.length > 0 ? platform : null,
    online: browserNavigator?.onLine !== false,
    logicalProcessors: finiteNumberOrNull(browserNavigator?.hardwareConcurrency),
    deviceMemoryGb: finiteNumberOrNull(browserNavigator?.deviceMemory),
    screenWidth: finiteNumberOrNull(browserScreen?.width),
    screenHeight: finiteNumberOrNull(browserScreen?.height),
    colorDepth: finiteNumberOrNull(browserScreen?.colorDepth),
    devicePixelRatio: finiteNumberOrNull(devicePixelRatio),
  };
}

export function getBrowserSystemInfo(): BrowserSystemInfo {
  const browserNavigator = typeof navigator === "undefined" ? null : navigator as BrowserNavigator;
  const browserScreen = typeof screen === "undefined" ? null : screen as BrowserScreen;
  const ratio = typeof window === "undefined" ? null : window.devicePixelRatio;
  return createBrowserSystemInfo(browserNavigator, browserScreen, ratio);
}
