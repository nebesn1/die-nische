import { describe, expect, it, vi } from "vitest";

type VfsContentDevPluginModule = {
  readonly isVfsContentSourcePath: (contentRoot: string, changedPath: string) => boolean;
  readonly createVfsContentRegenerationController: (options: {
    readonly contentRoot: string;
    readonly regenerate: () => Promise<unknown>;
    readonly reload: () => void;
    readonly logger: { readonly info: (message: string) => void; readonly error: (message: string) => void };
    readonly debounceMs?: number;
  }) => {
    notify(path: string): void;
    flush(): Promise<void>;
    dispose(): void;
  };
  readonly createVfsContentDevPlugin: (options: {
    readonly contentRoot: string;
    readonly regenerate?: () => Promise<unknown>;
    readonly generateManifest?: () => Promise<unknown>;
    readonly createTimestampReconciler?: (options: { readonly onMetadataWrite: (path: string) => void }) => { reconcile(): Promise<unknown> };
    readonly debounceMs?: number;
    readonly logger: { readonly info: (message: string) => void; readonly error: (message: string) => void };
  }) => {
    configureServer(server: unknown): void;
  };
};

const devPlugin = (await import(new URL("../../scripts/vfsContentDevPlugin.mjs", import.meta.url).href)) as VfsContentDevPluginModule;
const contentRoot = "/workspace/content/home/user";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe("VFS content dev regeneration controller", () => {
  it("filters events to the repository content root", () => {
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/content/home/user/Documents/A.md")).toBe(true);
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/content/home/user/Documents")).toBe(true);
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/src/App.tsx")).toBe(false);
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/src/generated/vfsContentManifest.generated.ts")).toBe(false);
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/dist/index.js")).toBe(false);
    expect(devPlugin.isVfsContentSourcePath(contentRoot, "/workspace/node_modules/example/index.js")).toBe(false);
  });

  it("coalesces a content event burst into one successful generation and full reload", async () => {
    const regenerate = vi.fn(async () => undefined);
    const reload = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };
    const controller = devPlugin.createVfsContentRegenerationController({ contentRoot, regenerate, reload, logger });

    controller.notify(`${contentRoot}/Documents/Old.md`);
    controller.notify(`${contentRoot}/Documents/New.md`);
    controller.notify(`${contentRoot}/Documents`);
    await controller.flush();

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("[vfs-content] regenerated after content/home/user/Documents changed");
  });

  it("serializes a later event while generation is running", async () => {
    const first = deferred<void>();
    const regenerate = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined);
    const reload = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };
    const controller = devPlugin.createVfsContentRegenerationController({ contentRoot, regenerate, reload, logger });

    controller.notify(`${contentRoot}/Documents/First.md`);
    const flushing = controller.flush();
    await Promise.resolve();
    expect(regenerate).toHaveBeenCalledTimes(1);
    controller.notify(`${contentRoot}/Documents/Second.md`);
    first.resolve();
    await flushing;

    expect(regenerate).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload an invalid baseline and recovers on the next valid event", async () => {
    const regenerate = vi.fn()
      .mockRejectedValueOnce(new Error(`${contentRoot}/Documents/Unsupported.pdf is not supported`))
      .mockResolvedValueOnce(undefined);
    const reload = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };
    const controller = devPlugin.createVfsContentRegenerationController({ contentRoot, regenerate, reload, logger });

    controller.notify(`${contentRoot}/Documents/Unsupported.pdf`);
    await controller.flush();
    expect(reload).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("generation failed after content/home/user/Documents/Unsupported.pdf changed"));
    expect(logger.error.mock.calls[0]?.[0]).not.toContain("/workspace/");

    controller.notify(`${contentRoot}/Documents/Unsupported.pdf`);
    await controller.flush();
    expect(regenerate).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("treats metadata sidecar add, change, and delete events as repository regeneration inputs", async () => {
    const regenerate = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`${contentRoot}/Documents/.kde3-meta.json requires version 1`))
      .mockResolvedValueOnce(undefined);
    const reload = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };
    const controller = devPlugin.createVfsContentRegenerationController({ contentRoot, regenerate, reload, logger });
    const metadataPath = `${contentRoot}/Documents/.kde3-meta.json`;

    controller.notify(metadataPath);
    await controller.flush();
    controller.notify(metadataPath);
    await controller.flush();
    controller.notify(metadataPath);
    await controller.flush();

    expect(regenerate).toHaveBeenCalledTimes(3);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith("[vfs-content] regenerated after content/home/user/Documents/.kde3-meta.json changed");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("generation failed after content/home/user/Documents/.kde3-meta.json changed"));
  });

  it("binds the Vite watcher to content events and emits a full reload only after regeneration", async () => {
    const listeners: ((event: string, path: string) => void)[] = [];
    const regenerate = vi.fn(async () => undefined);
    const logger = { info: vi.fn(), error: vi.fn() };
    const send = vi.fn();
    const plugin = devPlugin.createVfsContentDevPlugin({ contentRoot, regenerate, logger, debounceMs: 0 });

    plugin.configureServer({
      watcher: {
        on: (_event: string, nextListener: (event: string, path: string) => void) => {
          listeners.push(nextListener);
        },
        off: vi.fn(),
      },
      ws: { send },
      config: { logger },
      httpServer: undefined,
    });
    const listener = listeners[0];
    if (!listener) throw new Error("Expected Vite watcher listener");
    listener("add", `${contentRoot}/Pictures/Photo.png`);
    listener("change", `${contentRoot}/Pictures/Photo.png`);
    listener("unlink", `${contentRoot}/Pictures/Old.png`);
    listener("add", `${contentRoot}/Pictures/.kde3-meta.json`);
    listener("change", `${contentRoot}/Pictures/.kde3-meta.json`);
    listener("unlink", `${contentRoot}/Pictures/.kde3-meta.json`);
    listener("addDir", `${contentRoot}/Documents/Folder`);
    listener("unlinkDir", `${contentRoot}/Documents/Removed`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    listener("change", "/workspace/src/App.tsx");
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "full-reload", path: "*" });
  });

  it("suppresses the sidecar watcher event produced by one timestamp-authoring save", async () => {
    const listeners: ((event: string, path: string) => void)[] = [];
    const logger = { info: vi.fn(), error: vi.fn() };
    const send = vi.fn();
    const generateManifest = vi.fn(async () => undefined);
    let markMetadataWrite: ((path: string) => void) | undefined;
    const reconciler = { reconcile: vi.fn(async () => markMetadataWrite?.(`${contentRoot}/Documents/.kde3-meta.json`)) };
    const plugin = devPlugin.createVfsContentDevPlugin({
      contentRoot,
      generateManifest,
      logger,
      debounceMs: 0,
      createTimestampReconciler: ({ onMetadataWrite }) => {
        markMetadataWrite = onMetadataWrite;
        return reconciler;
      },
    });

    plugin.configureServer({
      watcher: { on: (_event: string, listener: (event: string, path: string) => void) => listeners.push(listener), off: vi.fn() },
      ws: { send }, config: { logger }, httpServer: undefined,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    reconciler.reconcile.mockClear();
    generateManifest.mockClear();
    send.mockClear();
    const listener = listeners[0];
    if (!listener) throw new Error("Expected Vite watcher listener");
    listener("change", `${contentRoot}/Documents/Article.md`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    listener("change", `${contentRoot}/Documents/.kde3-meta.json`);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(reconciler.reconcile).toHaveBeenCalledTimes(1);
    expect(generateManifest).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
