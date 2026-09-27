/* global clearTimeout, setTimeout */

import { isAbsolute, relative, resolve } from "node:path";
import { defaultContentRoot, generateVfsContentManifest, repositoryContentMetadataFileName } from "./generate-vfs-content-manifest.mjs";
import { createVfsContentTimestampReconciler } from "./vfsContentTimestampAuthoring.mjs";

export const VFS_CONTENT_DEV_DEBOUNCE_MS = 60;

const watchedEvents = new Set(["add", "change", "unlink", "addDir", "unlinkDir"]);

const toRepositoryRelativePath = (contentRoot, changedPath) => {
  const relativePath = relative(resolve(contentRoot), resolve(changedPath));
  return relativePath.length === 0 ? "content/home/user" : `content/home/user/${relativePath.replaceAll("\\", "/")}`;
};

export const isVfsContentSourcePath = (contentRoot, changedPath) => {
  const relativePath = relative(resolve(contentRoot), resolve(changedPath));
  return relativePath.length === 0
    || (relativePath !== ".." && !relativePath.startsWith("../") && !relativePath.startsWith("..\\") && !isAbsolute(relativePath));
};

const errorMessage = (error, contentRoot) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(resolve(contentRoot), "content/home/user");
};

export function createVfsContentRegenerationController({
  contentRoot = defaultContentRoot,
  regenerate = () => generateVfsContentManifest(),
  reload,
  logger,
  debounceMs = VFS_CONTENT_DEV_DEBOUNCE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer = null;
  let running = false;
  let pending = false;
  let disposed = false;
  let latestPath = "content/home/user";

  const runPending = async () => {
    if (running || disposed) return;

    while (pending && !disposed) {
      pending = false;
      const changePath = latestPath;
      running = true;

      try {
        await regenerate();
        if (!disposed) {
          logger.info(`[vfs-content] regenerated after ${changePath} changed`);
          reload();
        }
      } catch (error) {
        if (!disposed) {
          logger.error(`[vfs-content] generation failed after ${changePath} changed: ${errorMessage(error, contentRoot)}`);
        }
      } finally {
        running = false;
      }
    }
  };

  const schedule = () => {
    if (timer !== null || running || disposed) return;
    timer = setTimer(() => {
      timer = null;
      void runPending();
    }, debounceMs);
  };

  return {
    notify(changedPath) {
      if (disposed) return;
      pending = true;
      latestPath = toRepositoryRelativePath(contentRoot, changedPath);
      schedule();
    },
    async flush() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      await runPending();
    },
    dispose() {
      disposed = true;
      pending = false;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    },
  };
}

export function createVfsContentDevPlugin(options = {}) {
  const contentRoot = options.contentRoot ?? defaultContentRoot;

  return {
    name: "kde3-vfs-content-regeneration",
    apply: "serve",
    configureServer(server) {
      const selfWrittenMetadataPaths = new Map();
      const markSelfWrittenMetadata = (metadataPath) => {
        selfWrittenMetadataPaths.set(resolve(metadataPath), Date.now() + 1000);
      };
      const reconciler = options.timestampReconciler ?? (options.createTimestampReconciler ?? createVfsContentTimestampReconciler)({
        contentRoot,
        logger: options.logger ?? server.config.logger,
        onMetadataWrite: markSelfWrittenMetadata,
      });
      const controller = createVfsContentRegenerationController({
        contentRoot,
        regenerate: options.regenerate ?? (async () => {
          await reconciler.reconcile();
          await (options.generateManifest ?? generateVfsContentManifest)({ contentRoot });
        }),
        reload: () => server.ws.send({ type: "full-reload", path: "*" }),
        logger: options.logger ?? server.config.logger,
        debounceMs: options.debounceMs,
      });
      const onWatchEvent = (event, changedPath) => {
        const resolvedChangedPath = resolve(changedPath);
        const selfWriteExpiresAt = selfWrittenMetadataPaths.get(resolvedChangedPath);

        if (selfWriteExpiresAt !== undefined) {
          if (selfWriteExpiresAt > Date.now()) return;
          selfWrittenMetadataPaths.delete(resolvedChangedPath);
        }

        if (resolvedChangedPath.includes(`${repositoryContentMetadataFileName}.`)) return;

        if (watchedEvents.has(event) && isVfsContentSourcePath(contentRoot, changedPath)) {
          controller.notify(changedPath);
        }
      };
      const dispose = () => {
        server.watcher.off("all", onWatchEvent);
        controller.dispose();
      };

      server.watcher.on("all", onWatchEvent);
      server.httpServer?.once("close", dispose);

      // predev has already reconciled before Vite starts; this instance still
      // needs its own byte snapshot before it can classify the first save.
      if (options.regenerate === undefined) {
        void reconciler.reconcile().catch((error) => {
          (options.logger ?? server.config.logger).error(
            `[vfs-content] timestamp snapshot failed: ${errorMessage(error, contentRoot)}`,
          );
        });
      }
    },
  };
}
