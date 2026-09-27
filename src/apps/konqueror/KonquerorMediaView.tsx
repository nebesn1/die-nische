import { useCallback, useEffect, useRef, type MouseEvent, type RefObject, type SyntheticEvent } from "react";
import { getVfsNodeDisplayName } from "../../vfs/presentation";
import type { VfsFileNode } from "../../vfs/types";
import { KonquerorMediaControls } from "./KonquerorMediaControls";
import type { KonquerorMediaCommand } from "./mediaCommandModel";
import { getKonquerorMediaKind, getKonquerorMediaSource } from "./mediaPreviewModel";
import type { KonquerorMediaViewAction, KonquerorMediaViewState } from "./mediaViewModel";
import { useI18n } from "../../i18n/useI18n";

type KonquerorMediaViewProps = {
  readonly file: VfsFileNode;
  readonly mediaViewState: KonquerorMediaViewState;
  readonly previewSurfaceRef: RefObject<HTMLElement | null>;
  readonly onOpenContextMenu: (clientX: number, clientY: number) => void;
  readonly onAction: (action: KonquerorMediaViewAction) => void;
  readonly hasPrevious?: boolean;
  readonly hasNext?: boolean;
  readonly onNavigateAdjacent?: (direction: "previous" | "next") => void;
  readonly onRegisterMediaCommand?: (handler: ((command: KonquerorMediaCommand) => void) | null) => void;
};

export function KonquerorMediaView({
  file,
  mediaViewState,
  previewSurfaceRef,
  onOpenContextMenu,
  onAction,
  hasPrevious = false,
  hasNext = false,
  onNavigateAdjacent = () => undefined,
  onRegisterMediaCommand = () => undefined,
}: KonquerorMediaViewProps) {
  const { t } = useI18n();
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const onActionRef = useRef(onAction);
  const lastStopToken = useRef(mediaViewState.stopToken);
  onActionRef.current = onAction;
  const kind = getKonquerorMediaKind(file);
  const source = getKonquerorMediaSource(file);
  const displayName = getVfsNodeDisplayName(file);
  const isUnavailable = kind === null || source === null;
  const isError = isUnavailable || mediaViewState.status === "error";

  useEffect(() => {
    if (mediaViewState.nodeId !== file.id) {
      onAction({ type: "start", nodeId: file.id });
    }
  }, [file.id, mediaViewState.nodeId, onAction]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || source === null || isError) return;

    media.pause();
    media.currentTime = 0;
    media.load();
    media.volume = mediaViewState.volume;
    media.muted = mediaViewState.muted;
    return () => {
      media.pause();
    };
  }, [file.id, isError, mediaViewState.reloadToken, source]);

  useEffect(() => () => {
    mediaRef.current?.pause();
    onActionRef.current({ type: "pause", nodeId: file.id });
  }, [file.id]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || mediaViewState.stopToken === lastStopToken.current) return;

    lastStopToken.current = mediaViewState.stopToken;
    media.pause();
    media.currentTime = 0;
  }, [mediaViewState.stopToken]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || isError) return;
    media.volume = mediaViewState.volume;
    media.muted = mediaViewState.muted;
  }, [isError, mediaViewState.muted, mediaViewState.volume]);

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onOpenContextMenu(event.clientX, event.clientY);
  };

  const handlePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media || isError) return;
    if (mediaViewState.status === "ended" || mediaViewState.status === "stopped") {
      media.currentTime = 0;
      onAction({ type: "seek", nodeId: file.id, currentTime: 0 });
    }

    try {
      const result = media.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => onAction({ type: "play-rejected", nodeId: file.id }));
      }
    } catch {
      onAction({ type: "play-rejected", nodeId: file.id });
    }
  }, [file.id, isError, mediaViewState.status, onAction]);

  const handlePause = useCallback(() => {
    mediaRef.current?.pause();
  }, []);

  const handleSeek = (value: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(value) || mediaViewState.duration === null) return;
    media.currentTime = value;
    onAction({ type: "seek", nodeId: file.id, currentTime: value });
  };

  const handleVolume = (value: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(value)) return;
    media.volume = value;
    onAction({ type: "volume-change", nodeId: file.id, volume: value, muted: media.muted });
  };

  const handleMute = () => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    onAction({ type: "volume-change", nodeId: file.id, volume: media.volume, muted: media.muted });
  };

  const handleMediaCommand = useCallback((command: KonquerorMediaCommand) => {
    switch (command) {
      case "play":
        handlePlay();
        return;
      case "pause":
        handlePause();
        return;
      case "stop":
        onAction({ type: "stop" });
        return;
      case "previous":
      case "next":
        onNavigateAdjacent(command);
        return;
    }
  }, [handlePause, handlePlay, onAction, onNavigateAdjacent]);

  useEffect(() => {
    onRegisterMediaCommand(handleMediaCommand);
    return () => onRegisterMediaCommand(null);
  }, [file.id, handleMediaCommand, onRegisterMediaCommand]);

  const mediaProps = {
    className: `konqueror-media-view__element konqueror-media-view__element--${kind ?? "unavailable"}`,
    src: source ?? undefined,
    preload: "metadata" as const,
    title: displayName,
    "aria-label": displayName,
    tabIndex: -1,
    onLoadedData: () => onAction({ type: "loaded", nodeId: file.id }),
    onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => onAction({ type: "metadata", nodeId: file.id, duration: event.currentTarget.duration }),
    onDurationChange: (event: SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => onAction({ type: "duration-change", nodeId: file.id, duration: event.currentTarget.duration }),
    onPlay: () => onAction({ type: "play", nodeId: file.id }),
    onPlaying: () => onAction({ type: "playing", nodeId: file.id }),
    onPause: () => onAction({ type: "pause", nodeId: file.id }),
    onWaiting: () => onAction({ type: "waiting", nodeId: file.id }),
    onCanPlay: () => onAction({ type: "canplay", nodeId: file.id }),
    onEnded: (event: SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => onAction({ type: "ended", nodeId: file.id, currentTime: event.currentTarget.currentTime }),
    onError: () => onAction({ type: "error", nodeId: file.id }),
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => onAction({ type: "time-update", nodeId: file.id, currentTime: event.currentTarget.currentTime }),
    onVolumeChange: (event: SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => onAction({ type: "volume-change", nodeId: file.id, volume: event.currentTarget.volume, muted: event.currentTarget.muted }),
  };

  return (
    <section
      ref={previewSurfaceRef}
      className={`konqueror-media-view konqueror-media-view--${kind ?? "unavailable"}${isError ? " konqueror-media-view--error" : ""}`}
      aria-label={`${displayName} ${t("konqueror.media.viewer")}`}
      data-media-kind={kind ?? "unavailable"}
      data-media-status={mediaViewState.status}
      tabIndex={-1}
      onContextMenu={handleContextMenu}
    >
      <div className="konqueror-media-view__stage">
        {isError ? <p className="konqueror-media-view__message" role="alert">{t("konqueror.media.error")}</p> : null}
        {!isError && kind === "audio" ? <audio ref={(element) => { mediaRef.current = element; }} {...mediaProps} /> : null}
        {!isError && kind === "video" ? <video ref={(element) => { mediaRef.current = element; }} {...mediaProps} style={{ objectFit: "contain" }} /> : null}
      </div>
      <KonquerorMediaControls
        status={mediaViewState.status}
        currentTime={mediaViewState.currentTime}
        duration={mediaViewState.duration}
        volume={mediaViewState.volume}
        muted={mediaViewState.muted}
        disabled={isError}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onCommand={handleMediaCommand}
        onSeek={handleSeek}
        onVolume={handleVolume}
        onMute={handleMute}
      />
    </section>
  );
}
