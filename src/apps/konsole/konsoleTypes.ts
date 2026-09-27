export interface KonsoleHistoryNavigationState {
  readonly cursor: number | null;
  readonly draftBeforeNavigation: string;
}

export interface KonsoleHistoryNavigationResult {
  readonly state: KonsoleHistoryNavigationState;
  readonly draft: string;
}
