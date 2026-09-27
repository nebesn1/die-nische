import type { KControlTreeCategoryId } from "./controlCenterModel";

export type ControlCenterModule = "background" | "behavior" | "multiple-desktops" | "language";

export type ControlCenterOpenIntent = {
  readonly type: "open-control-center-module";
  readonly module: ControlCenterModule;
};

export function createControlCenterOpenIntent({ module }: { readonly module: ControlCenterModule }): ControlCenterOpenIntent {
  return { type: "open-control-center-module", module };
}

export function isControlCenterOpenIntent(value: unknown): value is ControlCenterOpenIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ControlCenterOpenIntent>;
  return candidate.type === "open-control-center-module"
    && (candidate.module === "background" || candidate.module === "behavior" || candidate.module === "multiple-desktops" || candidate.module === "language");
}

export function getKControlPageForModule(module: ControlCenterModule): "background" | "icons" | "multiple-desktops" | "language" {
  return module === "behavior" ? "icons" : module;
}

export function getKControlExpandedCategoriesForModule(module: ControlCenterModule): readonly KControlTreeCategoryId[] {
  if (module === "background") {
    return ["appearance-themes"];
  }

  if (module === "behavior" || module === "multiple-desktops") {
    return ["desktop"];
  }

  return ["regional-accessibility"];
}
