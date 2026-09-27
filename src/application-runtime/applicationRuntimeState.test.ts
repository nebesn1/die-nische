import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applicationRuntimeReducer,
  createApplicationCloseRequest,
  createApplicationLaunchRequest,
  initialApplicationRuntimeState,
} from "./applicationRuntimeState";

const runtimeProviderSource = readFileSync(new URL("./ApplicationRuntimeProvider.tsx", import.meta.url), "utf8");

describe("application runtime launch request state", () => {
  it("starts with no launch requests", () => {
    expect(initialApplicationRuntimeState).toEqual({
      latestLaunchRequestByWindowId: {},
      pendingCloseRequestByWindowId: {},
      nextLaunchRequestSequence: 1,
      nextCloseRequestSequence: 1,
      nextInstanceSerialByApplicationId: {},
      nextCascadeSerialByDesktopAndApplication: {},
    });
  });

  it("creates monotonic launch request ids for repeated intents", () => {
    const first = createApplicationLaunchRequest(initialApplicationRuntimeState, {
      type: "open-special-location",
      location: "trash",
    });
    const second = createApplicationLaunchRequest(first.state, {
      type: "open-special-location",
      location: "trash",
    });

    expect(first.request.requestId).toBe(1);
    expect(second.request.requestId).toBe(2);
    expect(second.request.intent).toEqual(first.request.intent);
  });

  it("stores the latest request per window and prunes closed windows", () => {
    const created = createApplicationLaunchRequest(initialApplicationRuntimeState, { type: "test" });
    const stored = applicationRuntimeReducer(created.state, {
      type: "store-launch-request",
      windowId: "app:konqueror",
      request: created.request,
    });
    const pruned = applicationRuntimeReducer(stored, {
      type: "prune-window-requests",
      windowIds: ["app:about"],
    });

    expect(stored.latestLaunchRequestByWindowId["app:konqueror"]).toEqual(created.request);
    expect(stored.nextLaunchRequestSequence).toBe(2);
    expect(pruned.latestLaunchRequestByWindowId).toEqual({});
    expect(pruned.pendingCloseRequestByWindowId).toEqual({});
    expect(pruned.nextLaunchRequestSequence).toBe(2);
  });

  it("creates, cancels, and prunes deterministic close requests without callbacks", () => {
    const first = createApplicationCloseRequest(initialApplicationRuntimeState);
    const second = createApplicationCloseRequest(first.state);
    const stored = applicationRuntimeReducer(second.state, {
      type: "store-close-request",
      windowId: "app:kwrite",
      request: first.request,
    });
    const staleClear = applicationRuntimeReducer(stored, {
      type: "clear-close-request",
      windowId: "app:kwrite",
      requestId: second.request.requestId,
    });
    const cleared = applicationRuntimeReducer(staleClear, {
      type: "clear-close-request",
      windowId: "app:kwrite",
      requestId: first.request.requestId,
    });
    const pruned = applicationRuntimeReducer(stored, { type: "prune-window-requests", windowIds: [] });

    expect(first.request.requestId).toBe(1);
    expect(second.request.requestId).toBe(2);
    expect(stored.pendingCloseRequestByWindowId["app:kwrite"]).toEqual(first.request);
    expect(staleClear).toBe(stored);
    expect(cleared.pendingCloseRequestByWindowId).toEqual({});
    expect(pruned.pendingCloseRequestByWindowId).toEqual({});
    expect(JSON.stringify(stored)).not.toContain("function");
  });

  it("isolates intents and close guards for same-application window instances", () => {
    const firstIntent = createApplicationLaunchRequest(initialApplicationRuntimeState, { type: "intent-a" });
    const secondIntent = createApplicationLaunchRequest(firstIntent.state, { type: "intent-b" });
    const withIntentA = applicationRuntimeReducer(secondIntent.state, {
      type: "store-launch-request",
      windowId: "app:test-multiple",
      request: firstIntent.request,
    });
    const withBothIntents = applicationRuntimeReducer(withIntentA, {
      type: "store-launch-request",
      windowId: "app:test-multiple::2",
      request: secondIntent.request,
    });
    const closeA = createApplicationCloseRequest(withBothIntents);
    const closeB = createApplicationCloseRequest(closeA.state);
    const withGuardA = applicationRuntimeReducer(closeB.state, {
      type: "store-close-request",
      windowId: "app:test-multiple",
      request: closeA.request,
    });
    const withBothGuards = applicationRuntimeReducer(withGuardA, {
      type: "store-close-request",
      windowId: "app:test-multiple::2",
      request: closeB.request,
    });
    const pruned = applicationRuntimeReducer(withBothGuards, {
      type: "prune-window-requests",
      windowIds: ["app:test-multiple::2"],
    });

    expect(withBothIntents.latestLaunchRequestByWindowId["app:test-multiple"]?.intent).toEqual({ type: "intent-a" });
    expect(withBothIntents.latestLaunchRequestByWindowId["app:test-multiple::2"]?.intent).toEqual({ type: "intent-b" });
    expect(withBothGuards.pendingCloseRequestByWindowId["app:test-multiple"]?.requestId).toBe(closeA.request.requestId);
    expect(withBothGuards.pendingCloseRequestByWindowId["app:test-multiple::2"]?.requestId).toBe(closeB.request.requestId);
    expect(pruned.latestLaunchRequestByWindowId["app:test-multiple"]).toBeUndefined();
    expect(pruned.latestLaunchRequestByWindowId["app:test-multiple::2"]?.intent).toEqual({ type: "intent-b" });
    expect(pruned.pendingCloseRequestByWindowId["app:test-multiple"]).toBeUndefined();
    expect(pruned.pendingCloseRequestByWindowId["app:test-multiple::2"]?.requestId).toBe(closeB.request.requestId);
  });

  it("resets volatile instance serials with the application session", () => {
    const reserved = applicationRuntimeReducer(initialApplicationRuntimeState, {
      type: "reserve-instance-serial",
      appId: "test-multiple",
      nextSerial: 4,
    });
    const reset = applicationRuntimeReducer(reserved, { type: "reset-session" });

    expect(reserved.nextInstanceSerialByApplicationId).toEqual({ "test-multiple": 4 });
    expect(reset).toBe(initialApplicationRuntimeState);
  });

  it("resets independent desktop/application cascade serials with the application session", () => {
    const reserved = applicationRuntimeReducer(initialApplicationRuntimeState, {
      type: "reserve-cascade-serial",
      key: "2:konqueror",
      nextSerial: 3,
    });
    const reset = applicationRuntimeReducer(reserved, { type: "reset-session" });

    expect(reserved.nextCascadeSerialByDesktopAndApplication).toEqual({ "2:konqueror": 3 });
    expect(reset).toBe(initialApplicationRuntimeState);
  });

  it("reflects cascade lifecycle reconciliation without changing runtime launch semantics", () => {
    const reconciled = applicationRuntimeReducer(initialApplicationRuntimeState, {
      type: "reconcile-cascade-state",
      nextSerialByDesktopAndApplication: { "1:konsole": 3 },
    });

    expect(reconciled.nextCascadeSerialByDesktopAndApplication).toEqual({ "1:konsole": 3 });
    expect(runtimeProviderSource).toContain("reconcileApplicationCascadeState");
    expect(runtimeProviderSource).toContain("getApplicationCascadeKey");
  });

  it("reserves instance and cascade serials only for explicit multiple-instance launches", () => {
    expect(runtimeProviderSource).toMatch(
      /const allocation = definition && getApplicationInstancePolicy\(definition\) === "multiple" && disposition === "new-instance"/,
    );
    expect(runtimeProviderSource).toMatch(
      /const cascadeAllocation = definition && getApplicationInstancePolicy\(definition\) === "multiple" && disposition === "new-instance"/,
    );
    expect(runtimeProviderSource).toContain('const plan = disposition === "new-instance"');
    expect(runtimeProviderSource).toContain(": planApplicationLaunch(appId, windows, nextZIndex, currentDesktopId, workArea");
  });

  it("keeps initial intents window-scoped and stores them before the new window opens", () => {
    const storeRequestIndex = runtimeProviderSource.indexOf('type: "store-launch-request"');
    const openWindowIndex = runtimeProviderSource.indexOf("openWindow(plan.window)");

    expect(runtimeProviderSource).toContain("launchNewApplicationInstance");
    expect(runtimeProviderSource).toContain("reserveApplicationInstanceId");
    expect(runtimeProviderSource).toContain("windowId: requestWindowId");
    expect(storeRequestIndex).toBeGreaterThan(-1);
    expect(openWindowIndex).toBeGreaterThan(storeRequestIndex);
    expect(runtimeProviderSource).not.toContain("latestLaunchRequestByApplicationId");
  });

  it("keeps Application Runtime independent from VFS imports", () => {
    const directory = fileURLToPath(new URL(".", import.meta.url));
    const runtimeSources = readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".ts") || fileName.endsWith(".tsx"))
      .filter((fileName) => !fileName.includes(".test."))
      .map((fileName) => readFileSync(join(directory, fileName), "utf8"))
      .join("\n");

    expect(runtimeSources).not.toContain("../vfs");
    expect(runtimeSources).not.toContain("../../vfs");
  });
});
