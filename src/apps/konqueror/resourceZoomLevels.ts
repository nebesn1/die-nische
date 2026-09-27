export const konquerorResourceZoomLevels = ["small", "normal", "large", "extra-large"] as const;

export type KonquerorResourceZoomLevel = (typeof konquerorResourceZoomLevels)[number];
