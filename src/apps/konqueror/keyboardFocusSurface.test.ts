import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const konquerorSource = readFileSync(new URL("./Konqueror.tsx", import.meta.url), "utf8");
const detailsSource = readFileSync(new URL("./KonquerorDirectoryView.tsx", import.meta.url), "utf8");
const iconsSource = readFileSync(new URL("./KonquerorIconView.tsx", import.meta.url), "utf8");
const handoffSource = readFileSync(new URL("./useKonquerorDirectoryFocusHandoff.ts", import.meta.url), "utf8");
const locationBarSource = readFileSync(new URL("./KonquerorLocationBar.tsx", import.meta.url), "utf8");
const windowReducerSource = readFileSync(new URL("../../window-manager/windowReducer.ts", import.meta.url), "utf8");
const launchApplicationSource = readFileSync(new URL("../../application-runtime/launchApplication.ts", import.meta.url), "utf8");

describe("Konqueror keyboard focus surface", () => {
  it("makes the current Tree and Icon roots programmatically focusable without changing node-id selection", () => {
    expect(detailsSource).toContain("tabIndex={-1}");
    expect(iconsSource).toContain("tabIndex={-1}");
    expect(detailsSource).toContain("keyboardSurfaceRef");
    expect(iconsSource).toContain("keyboardSurfaceRef");
    expect(konquerorSource).toContain("getKonquerorAdjacentSelectionId");
    expect(konquerorSource).toContain("getKonquerorTreeKeyboardAction");
    expect(konquerorSource).not.toContain("focusedIndex");
    expect(konquerorSource).not.toContain("keyboardIndex");
  });

  it("keeps Arrow handling local to the focusable directory roots in both views", () => {
    expect(detailsSource).toContain('event.key === "ArrowRight"');
    expect(detailsSource).toContain('event.key === "ArrowLeft"');
    expect(iconsSource).toContain('event.key === "ArrowRight"');
    expect(iconsSource).toContain('event.key === "ArrowLeft"');
    expect(handoffSource).not.toContain('addEventListener("keydown"');
    expect(handoffSource).not.toContain("document.onkeydown");
    expect(handoffSource).not.toContain("window.onkeydown");
    expect(detailsSource).toContain("onTreeKeyboardAction(event.key)");
    expect(iconsSource).not.toContain("onTreeKeyboardAction");
  });

  it("uses explicit, monotonic WindowManager focus requests for inactive and already-active activation", () => {
    expect(windowReducerSource).toContain("nextFocusRequestId");
    expect(windowReducerSource).toContain("withFocusRequest");
    expect(windowReducerSource).toContain("target.isActive && target.zIndex === topVisibleZIndex");
    expect(windowReducerSource).toContain("nextFocusRequestId: focusRequestId + 1");
    expect(launchApplicationSource).toContain('{ result: "already-active"; action: "activate"; windowId: string }');
  });

  it("does not refocus on VFS, sorting, or selection updates and respects modal and popup priority", () => {
    expect(konquerorSource).toContain("isDirectoryFocusBlocked = isNavigationBlocked || isContextMenuOpen || isApplicationMenuOpen");
    expect(konquerorSource).toContain("requestDirectoryFocus");
    expect(handoffSource).toContain("window.requestAnimationFrame");
    expect(handoffSource).not.toContain("selectedNodeId");
    expect(handoffSource).not.toContain("directoryViewState");
    expect(handoffSource).not.toContain("vfs.state");
  });

  it("uses one Konqueror-local forced request after an Icon View command instead of a WindowManager transition", () => {
    expect(konquerorSource).toContain('setResourceViewMode("icons");');
    expect(konquerorSource).toContain("requestDirectoryFocus({ force: true });");
    expect(konquerorSource).not.toContain("activateWindow(");
    expect(handoffSource).toContain("force: options.force === true");
    expect(handoffSource).toContain("localFocusRequest.force");
  });

  it("keeps selection and persistent Location/View menu controls outside the transient Icon View handoff", () => {
    expect(konquerorSource).toContain("onIconView={() => {");
    expect(konquerorSource).toContain("dismissContextMenu();");
    expect(konquerorSource).toContain('case "view-tree":\n        setResourceViewMode("tree");');
    expect(konquerorSource).toContain('onChange={(locationDraft) => dispatchNavigation({ type: "set-location-draft", locationDraft })}');
    expect(konquerorSource).not.toContain('onViewModeChange={(viewMode) => {\n          dispatchNavigation({ type: "clear-selection"');
  });

  it("treats application-menu commands as transient focus owners without a second keyboard system", () => {
    expect(konquerorSource).toContain("isApplicationMenuOpen");
    expect(konquerorSource).toContain("dismissApplicationMenu(true)");
    expect(konquerorSource).toContain("requestDirectoryFocus({ force: true })");
    expect(konquerorSource).not.toContain('document.addEventListener("keydown"');
    expect(konquerorSource).not.toContain('window.addEventListener("keydown"');
  });

  it("returns keyboard ownership only after successful transient Back, Forward, Up, or Home toolbar commands", () => {
    expect(konquerorSource).toContain("const navigateToolbarBack");
    expect(konquerorSource).toContain("const navigateToolbarForward");
    expect(konquerorSource).toContain("const navigateToolbarUp");
    expect(konquerorSource).toContain("const navigateToolbarHome");
    expect(konquerorSource).toContain("onBack={navigateToolbarBack}");
    expect(konquerorSource).toContain("onForward={navigateToolbarForward}");
    expect(konquerorSource).toContain("onUp={navigateToolbarUp}");
    expect(konquerorSource).toContain("onHome={navigateToolbarHome}");
    expect(konquerorSource).toContain("navigateHistory(\"back\");\n    requestContentFocus({ force: true });");
    expect(konquerorSource).not.toContain("toolbarNavigationFocusEffect");
    expect(konquerorSource).not.toContain("activateWindow(");
  });

  it("hands off virtual pages, blank tabs, and file previews to their latest local scroll surfaces", () => {
    expect(konquerorSource).toContain("const sysinfoSurfaceRef = useRef<HTMLDivElement | null>(null);");
    expect(konquerorSource).toContain("const aboutSurfaceRef = useRef<HTMLDivElement | null>(null);");
    expect(konquerorSource).toContain("const previewSurfaceRef = useRef<HTMLElement | null>(null);");
    expect(konquerorSource).toContain('contentFocusTarget: view.type === "about-konqueror"');
    expect(konquerorSource).toContain('? "about-konqueror"');
    expect(konquerorSource).toContain('view.type === "about-blank"');
    expect(konquerorSource).toContain('tabIndex={view.type === "sysinfo" || view.type === "about-konqueror" || view.type === "about-blank" ? -1 : undefined}');
    expect(konquerorSource).toContain('t("common.scrollSurface", { name: aboutScrollSurfaceText })');
    expect(konquerorSource).toContain('t("konqueror.page.startAria")');
    expect(konquerorSource).toContain('dispatchNavigation({ type: "navigate-success", target: { type: "sysinfo" }, path: KONQUEROR_SYSINFO_LOCATION });');
    expect(konquerorSource).toContain("requestContentFocus();");
    expect(handoffSource).toContain('contentFocusTarget === "preview"');
    expect(handoffSource).toContain("previewSurfaceRef.current");
    expect(handoffSource).toContain("sysinfoSurfaceRef.current");
    expect(handoffSource).toContain("aboutSurfaceRef.current");
    expect(handoffSource).toContain("contentSurface.focus({ preventScroll: true })");
  });

  it("keeps virtual-page focus local, asynchronous, and outside persistent interactive controls", () => {
    expect(handoffSource).toContain("window.requestAnimationFrame");
    expect(handoffSource).toContain("hasInteractiveKonquerorFocus");
    expect(handoffSource).not.toContain('addEventListener("keydown"');
    expect(handoffSource).not.toContain('document.addEventListener("keydown"');
    expect(handoffSource).not.toContain('window.addEventListener("keydown"');
    expect(handoffSource).not.toContain("navigationState");
    expect(handoffSource).not.toContain("vfs.state");
  });

  it("gives generic Start Page launches and blank tabs a one-shot local Location-input focus request", () => {
    expect(locationBarSource).toContain("readonly inputRef?: RefObject<HTMLInputElement | null>");
    expect(locationBarSource).toContain("ref={inputRef}");
    expect(handoffSource).toContain('KonquerorFocusRequestTarget = "content" | "location-input"');
    expect(handoffSource).toContain('requestFocus("location-input", { force: true })');
    expect(handoffSource).toContain("locationInputRef.current");
    expect(handoffSource).not.toContain("setTimeout");
    expect(handoffSource).not.toContain('addEventListener("focus"');
    expect(konquerorSource).toContain("const locationInputRef = useRef<HTMLInputElement | null>(null);");
    expect(konquerorSource).toContain("requestLocationInputFocus");
    expect(konquerorSource).toContain("isKonquerorOpenStartIntent(launchRequest.intent) || isKonquerorDetachTabIntent(launchRequest.intent)");
    expect(konquerorSource).toContain('target: createKonquerorAboutLocationTarget("blank")');
    expect(konquerorSource).toContain("requestLocationInputFocus();");
    expect(konquerorSource).toContain('navigateHistory("back");\n    requestContentFocus({ force: true });');
  });

  it("keeps a focused Location input in its editing session after Enter or Escape", () => {
    expect(locationBarSource).toContain("const locationDraft = value;");
    expect(locationBarSource).toContain("if (onNavigate(locationDraft)) {");
    expect(locationBarSource).toContain("onFinishEditing?.();");
    expect(locationBarSource).toContain("onReset();");
    expect(locationBarSource).toContain("onBlur={handleBlur}");
    expect(locationBarSource).toContain("onMouseDown={(event) => event.preventDefault()}");
    expect(locationBarSource).toContain("event.currentTarget.form?.contains(event.relatedTarget)");
    expect(locationBarSource).not.toContain(".blur()");
    expect(locationBarSource).not.toContain(".focus()");
    expect(konquerorSource).toContain('type: "navigate-failure",\n        locationDraft: currentPath');
  });
});
