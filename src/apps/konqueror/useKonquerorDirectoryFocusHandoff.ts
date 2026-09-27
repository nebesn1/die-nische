import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { shouldRestoreKonquerorDirectoryFocus } from "./directoryFocusHandoff";

export type KonquerorContentFocusTarget = "directory" | "preview" | "sysinfo" | "about-konqueror" | "about-blank" | "external-web";
export type KonquerorFocusRequestTarget = "content" | "location-input";

type UseKonquerorDirectoryFocusHandoffOptions = {
  readonly applicationRootRef: RefObject<HTMLElement | null>;
  readonly directorySurfaceRef: RefObject<HTMLElement | null>;
  readonly previewSurfaceRef: RefObject<HTMLElement | null>;
  readonly sysinfoSurfaceRef: RefObject<HTMLElement | null>;
  readonly aboutSurfaceRef: RefObject<HTMLElement | null>;
  readonly externalWebSurfaceRef: RefObject<HTMLIFrameElement | null>;
  readonly locationInputRef: RefObject<HTMLInputElement | null>;
  readonly contentFocusTarget: KonquerorContentFocusTarget;
  readonly focusRequestId: number;
  readonly isActive: boolean;
  readonly isBlocked: boolean;
};

type DirectoryFocusRequestOptions = {
  readonly force?: boolean;
};

type LocalDirectoryFocusRequest = {
  readonly id: number;
  readonly force: boolean;
  readonly target: KonquerorFocusRequestTarget;
};

const isInteractiveElement = (element: Element): boolean =>
  element.matches("input, textarea, select, button, a[href], iframe, [role='menuitem'], [contenteditable='true']");

const hasInteractiveKonquerorFocus = (applicationRoot: HTMLElement): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  const activeElement = document.activeElement;

  if (!(activeElement instanceof Element) || !applicationRoot.contains(activeElement)) {
    return false;
  }

  return isInteractiveElement(activeElement) || activeElement.closest("input, textarea, select, button, a[href], iframe, [role='menuitem'], [contenteditable='true']") !== null;
};

export function useKonquerorDirectoryFocusHandoff({
  applicationRootRef,
  directorySurfaceRef,
  previewSurfaceRef,
  sysinfoSurfaceRef,
  aboutSurfaceRef,
  externalWebSurfaceRef,
  locationInputRef,
  contentFocusTarget,
  focusRequestId,
  isActive,
  isBlocked,
}: UseKonquerorDirectoryFocusHandoffOptions) {
  const handledFocusRequestIdRef = useRef<number | null>(null);
  const [localFocusRequest, setLocalFocusRequest] = useState<LocalDirectoryFocusRequest>({
    id: 0,
    force: false,
    target: "content",
  });

  const requestFocus = useCallback((target: KonquerorFocusRequestTarget, options: DirectoryFocusRequestOptions = {}) => {
    setLocalFocusRequest((request) => ({ id: request.id + 1, force: options.force === true, target }));
  }, []);

  const requestContentFocus = useCallback(
    (options: DirectoryFocusRequestOptions = {}) => requestFocus("content", options),
    [requestFocus],
  );
  const requestLocationInputFocus = useCallback(
    () => requestFocus("location-input", { force: true }),
    [requestFocus],
  );

  useEffect(() => {
    if (handledFocusRequestIdRef.current === focusRequestId) {
      return;
    }

    handledFocusRequestIdRef.current = focusRequestId;

    if (isActive && !isBlocked) {
      requestContentFocus();
    }
  }, [focusRequestId, isActive, isBlocked, requestContentFocus]);

  useEffect(() => {
    if (localFocusRequest.id === 0 || typeof window === "undefined") {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const applicationRoot = applicationRootRef.current;
      const contentSurface = localFocusRequest.target === "location-input"
        ? locationInputRef.current
        : contentFocusTarget === "directory"
        ? directorySurfaceRef.current
        : contentFocusTarget === "preview"
        ? previewSurfaceRef.current
        : contentFocusTarget === "sysinfo"
        ? sysinfoSurfaceRef.current
        : contentFocusTarget === "about-konqueror" || contentFocusTarget === "about-blank"
        ? aboutSurfaceRef.current
        : externalWebSurfaceRef.current;

      if (!applicationRoot || !contentSurface) {
        return;
      }

      if (localFocusRequest.target === "location-input") {
        if (!isActive || isBlocked) {
          return;
        }

        contentSurface.focus({ preventScroll: true });
        return;
      }

      const hasInteractiveFocus = hasInteractiveKonquerorFocus(applicationRoot);

      if (!shouldRestoreKonquerorDirectoryFocus({
        isActive,
        isBlocked,
        activeElementBelongsToApplication: hasInteractiveFocus,
        activeElementIsInteractive: hasInteractiveFocus,
      }, localFocusRequest.force)) {
        return;
      }

      contentSurface.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    applicationRootRef,
    aboutSurfaceRef,
    contentFocusTarget,
    directorySurfaceRef,
    externalWebSurfaceRef,
    isActive,
    isBlocked,
    locationInputRef,
    localFocusRequest,
    previewSurfaceRef,
    sysinfoSurfaceRef,
  ]);

  return {
    requestContentFocus,
    requestLocationInputFocus,
    // Existing directory commands now hand off to the current Konqueror content surface.
    requestDirectoryFocus: requestContentFocus,
  };
}
