import type { Rect } from "./core/geometry";
import type { KWinWorkspace } from "./platform/kwin/api";
import type { KWinRectFactory } from "./platform/kwin/geometry-adapter";
import { RuntimeController } from "./runtime-controller";
import {
  createRuntimeLayoutPersistence,
  type RuntimeLayoutStateChanged,
} from "./runtime-persistence";
import {
  decodeDriftileSettings,
  sameDriftileSettings,
  type DriftileSettings,
} from "./settings";

const STARTUP_STABILIZATION_PROBES = 20;
const LAYOUT_HYDRATION_RETRY_PROBES = 100;
const LAYOUT_HYDRATION_QUIET_SAMPLES = 2;

let controller: RuntimeController | undefined;
let appliedSettings: DriftileSettings | undefined;

export function init(
  workspace: KWinWorkspace,
  clientAreaOption: number,
  createRect: KWinRectFactory,
  schedule: (callback: () => void) => void,
  scheduleResume: (callback: () => void) => void,
  settingsSnapshot: unknown,
  loadedLayoutState: unknown,
  onLayoutStateChanged: unknown,
  showDropPreview?: unknown,
  hideDropPreview?: unknown,
  showTabIndicator?: unknown,
): void {
  const settings = decodeSettings(settingsSnapshot);

  if (!settings) {
    return;
  }

  if (controller) {
    return;
  }

  const layoutStateChanged = writableLayoutStateSink(
    loadedLayoutState,
    onLayoutStateChanged,
  );
  const layoutPersistence = createRuntimeLayoutPersistence(
    workspace,
    typeof loadedLayoutState === "string" ? loadedLayoutState : "",
    layoutStateChanged,
  );
  const showDropPreviewCallback =
    typeof showDropPreview === "function"
      ? (showDropPreview as (
          x: number,
          y: number,
          width: number,
          height: number,
        ) => void)
      : null;
  const hideDropPreviewCallback =
    typeof hideDropPreview === "function"
      ? (hideDropPreview as () => void)
      : null;
  const previewCallbacks =
    showDropPreviewCallback && hideDropPreviewCallback
      ? {
          hidePointerDropPreview: hideDropPreviewCallback,
          showPointerDropPreview: (frame: Rect) => {
            showDropPreviewCallback(
              frame.x,
              frame.y,
              frame.width,
              frame.height,
            );
          },
        }
      : {};
  const showTabIndicatorCallback =
    typeof showTabIndicator === "function"
      ? (showTabIndicator as (
          selectedIndex: number,
          tabCount: number,
          caption: string,
        ) => void)
      : null;
  const indicatorCallbacks = showTabIndicatorCallback
    ? {
        showTabIndicator: (
          selectedIndex: number,
          tabCount: number,
          caption: string,
        ) => {
          if (appliedSettings?.showTabIndicator === true) {
            showTabIndicatorCallback(selectedIndex, tabCount, caption);
          }
        },
      }
    : {};
  const nextController = new RuntimeController(workspace, {
    applicationBorderlessExclusions: settings.applicationBorderlessExclusions,
    applicationColumnPresentations: settings.applicationColumnPresentations,
    applicationColumnWidths: settings.applicationColumnWidths,
    applicationFocusCentering: settings.applicationFocusCentering,
    applicationInitialFloating: settings.applicationInitialFloating,
    applicationTilingExclusions: settings.applicationTilingExclusions,
    borderlessWindows: settings.borderlessWindows,
    clientAreaOption,
    createRect,
    defaultColumnPresentation: settings.defaultColumnPresentation,
    emptyDesktopAboveFirst: settings.emptyDesktopAboveFirst,
    gap: settings.gap,
    layoutHydrationQuietSamples: LAYOUT_HYDRATION_QUIET_SAMPLES,
    layoutHydrationRetryProbes: LAYOUT_HYDRATION_RETRY_PROBES,
    layoutStateForCurrentTopology: () =>
      layoutPersistence.stateForCurrentTopology(),
    knownLayoutSnapshots: () => layoutPersistence.snapshots(),
    schedule,
    scheduleResume,
    ...indicatorCallbacks,
    ...previewCallbacks,
    startupStabilizationProbes: STARTUP_STABILIZATION_PROBES,
    ...(layoutPersistence.onStateChanged === undefined
      ? {}
      : { onLayoutStateChanged: layoutPersistence.onStateChanged }),
  });
  nextController.setDefaultColumnWidthPercent(
    settings.defaultColumnWidthPercent,
  );
  nextController.setAlwaysCenterSingleColumn(settings.alwaysCenterSingleColumn);
  nextController.setCenterFocusedColumn(settings.centerFocusedColumn);
  nextController.setCenterFocusedColumnOnOverflow(
    settings.centerFocusedColumnOnOverflow,
  );
  nextController.setColumnWidthPresets(settings.columnWidthPresets.presets);
  nextController.setColumnWidthStepPercent(settings.columnWidthStepPercent);
  nextController.setWindowHeightPresets(settings.windowHeightPresets.cycle);
  nextController.setWindowHeightStepPercent(settings.windowHeightStepPercent);

  if (!nextController.start(layoutPersistence.initialState)) {
    console.warn("[driftile] no output or virtual desktop available");
    return;
  }

  controller = nextController;
  appliedSettings = settings;
  console.info(
    `[driftile] managed=${String(controller.managedCount)} writes=${String(controller.lastWriteCount)}`,
  );
}

export function destroy(): void {
  try {
    controller?.stop();
  } finally {
    controller = undefined;
    appliedSettings = undefined;
  }
}

export function flushLayoutState(): boolean {
  const activeController = controller;

  if (!activeController) {
    return false;
  }

  return activeController.finalizeLayoutStatePublication();
}

export function applySettings(settingsSnapshot: unknown): boolean {
  const settings = decodeSettings(settingsSnapshot);

  if (!settings || !controller) {
    return false;
  }

  if (appliedSettings && sameDriftileSettings(appliedSettings, settings)) {
    return true;
  }

  if (!settings.borderlessWindows) {
    controller.setBorderlessWindows(false);
  }

  controller.setApplicationBorderlessExclusions(
    settings.applicationBorderlessExclusions,
  );
  controller.setApplicationColumnPresentations(
    settings.applicationColumnPresentations,
  );
  controller.setApplicationColumnWidths(settings.applicationColumnWidths);
  controller.setApplicationFocusCentering(settings.applicationFocusCentering);
  controller.setApplicationInitialFloating(settings.applicationInitialFloating);
  controller.setApplicationTilingExclusions(
    settings.applicationTilingExclusions,
  );
  controller.setAlwaysCenterSingleColumn(settings.alwaysCenterSingleColumn);
  controller.setCenterFocusedColumn(settings.centerFocusedColumn);
  controller.setCenterFocusedColumnOnOverflow(
    settings.centerFocusedColumnOnOverflow,
  );
  controller.setDefaultColumnPresentation(settings.defaultColumnPresentation);
  controller.setDefaultColumnWidthPercent(settings.defaultColumnWidthPercent);
  controller.setEmptyDesktopAboveFirst(settings.emptyDesktopAboveFirst);
  controller.setColumnWidthPresets(settings.columnWidthPresets.presets);
  controller.setColumnWidthStepPercent(settings.columnWidthStepPercent);
  controller.setWindowHeightPresets(settings.windowHeightPresets.cycle);
  controller.setWindowHeightStepPercent(settings.windowHeightStepPercent);
  controller.setGap(settings.gap);

  if (settings.borderlessWindows) {
    controller.setBorderlessWindows(true);
  }

  appliedSettings = settings;
  return true;
}

export function getTouchpadNavigation(): boolean {
  return appliedSettings?.touchpadNavigation === true;
}

export function getTouchpadNavigationFingerCount(): number {
  return appliedSettings?.touchpadNavigationFingerCount ?? 5;
}

export function getTouchpadNaturalScroll(): boolean {
  return appliedSettings?.touchpadNaturalScroll ?? true;
}

export function getTouchpadWorkspaceNavigation(): boolean {
  return appliedSettings?.touchpadWorkspaceNavigation === true;
}

function decodeSettings(value: unknown): DriftileSettings | null {
  const settings = decodeDriftileSettings(value);

  if (!settings) {
    console.warn("[driftile] invalid settings snapshot ignored");
  }

  return settings;
}

function writableLayoutStateSink(
  loadedLayoutState: unknown,
  candidate: unknown,
): RuntimeLayoutStateChanged | undefined {
  if (typeof loadedLayoutState !== "string") {
    console.warn("[driftile] invalid loaded layout state ignored");
    return undefined;
  }

  if (typeof candidate !== "function") {
    console.warn("[driftile] invalid layout state callback ignored");
    return undefined;
  }

  return candidate as RuntimeLayoutStateChanged;
}

function runCommand(
  command: (activeController: RuntimeController) => boolean,
): void {
  const activeController = controller;

  if (!activeController || !command(activeController)) {
    return;
  }

  activeController.requestLayoutStatePublication();
  activeController.flushLayoutStatePublication();
}

export function focusLeft(): void {
  runCommand((activeController) => activeController.focusLeft());
}

export function focusRight(): void {
  runCommand((activeController) => activeController.focusRight());
}

export function focusFirstColumn(): void {
  runCommand((activeController) => activeController.focusFirstColumn());
}

export function focusLastColumn(): void {
  runCommand((activeController) => activeController.focusLastColumn());
}

export function focusUp(): void {
  runCommand((activeController) => activeController.focusUp());
}

export function focusDown(): void {
  runCommand((activeController) => activeController.focusDown());
}

export function focusUpOrPreviousDesktop(): void {
  runCommand((activeController) => activeController.focusUpOrPreviousDesktop());
}

export function focusDownOrNextDesktop(): void {
  runCommand((activeController) => activeController.focusDownOrNextDesktop());
}

export function focusPreviousDesktop(): void {
  runCommand((activeController) => activeController.focusPreviousDesktop());
}

export function focusNextDesktop(): void {
  runCommand((activeController) => activeController.focusNextDesktop());
}

export function focusPreviousDesktopUnderPointer(): void {
  runCommand((activeController) =>
    activeController.focusPreviousDesktopUnderPointer(),
  );
}

export function focusNextDesktopUnderPointer(): void {
  runCommand((activeController) =>
    activeController.focusNextDesktopUnderPointer(),
  );
}

export function focusLastUsedDesktop(): void {
  runCommand((activeController) => activeController.focusLastUsedDesktop());
}

export function focusDesktop(index: number): void {
  runCommand((activeController) => activeController.focusDesktop(index));
}

export function moveDesktopDown(): void {
  runCommand((activeController) => activeController.moveDesktopDown());
}

export function moveDesktopUp(): void {
  runCommand((activeController) => activeController.moveDesktopUp());
}

export function moveColumnLeft(): void {
  runCommand((activeController) => activeController.moveColumnLeft());
}

export function moveColumnRight(): void {
  runCommand((activeController) => activeController.moveColumnRight());
}

export function moveColumnToFirst(): void {
  runCommand((activeController) => activeController.moveColumnToFirst());
}

export function moveColumnToLast(): void {
  runCommand((activeController) => activeController.moveColumnToLast());
}

export function moveWindowLeft(): void {
  runCommand((activeController) => activeController.moveWindowLeft());
}

export function moveWindowRight(): void {
  runCommand((activeController) => activeController.moveWindowRight());
}

export function moveWindowUp(): void {
  runCommand((activeController) => activeController.moveWindowUp());
}

export function moveWindowDown(): void {
  runCommand((activeController) => activeController.moveWindowDown());
}

export function moveWindowUpOrToPreviousDesktop(): void {
  runCommand((activeController) =>
    activeController.moveWindowUpOrToPreviousDesktop(),
  );
}

export function moveWindowDownOrToNextDesktop(): void {
  runCommand((activeController) =>
    activeController.moveWindowDownOrToNextDesktop(),
  );
}

export function insertWindowIntoStackLeft(): void {
  runCommand((activeController) =>
    activeController.insertWindowIntoStackLeft(),
  );
}

export function insertWindowIntoStackRight(): void {
  runCommand((activeController) =>
    activeController.insertWindowIntoStackRight(),
  );
}

export function consumeWindowIntoColumn(): void {
  runCommand((activeController) => activeController.consumeWindowIntoColumn());
}

export function expelWindowFromColumn(): void {
  runCommand((activeController) => activeController.expelWindowFromColumn());
}

export function toggleFloating(): void {
  runCommand((activeController) => activeController.toggleFloating());
}

export function moveWindowToFloating(): void {
  runCommand((activeController) => activeController.moveWindowToFloating());
}

export function moveWindowToTiling(): void {
  runCommand((activeController) => activeController.moveWindowToTiling());
}

export function switchFocusBetweenFloatingAndTiling(): void {
  runCommand((activeController) =>
    activeController.switchFocusBetweenFloatingAndTiling(),
  );
}

export function focusFloating(): void {
  runCommand((activeController) => activeController.focusFloating());
}

export function focusTiling(): void {
  runCommand((activeController) => activeController.focusTiling());
}

export function toggleFullscreen(): void {
  runCommand((activeController) => activeController.toggleFullscreen());
}

export function maximizeWindowToEdges(): void {
  runCommand((activeController) => activeController.maximizeWindowToEdges());
}

export function toggleColumnTabbedDisplay(): void {
  runCommand((activeController) =>
    activeController.toggleColumnTabbedDisplay(),
  );
}

export function moveWindowToPreviousDesktop(): void {
  runCommand((activeController) =>
    activeController.moveWindowToPreviousDesktop(),
  );
}

export function moveWindowToNextDesktop(): void {
  runCommand((activeController) => activeController.moveWindowToNextDesktop());
}

export function moveWindowToDesktop(index: number): void {
  runCommand((activeController) => activeController.moveWindowToDesktop(index));
}

export function moveColumnToPreviousDesktop(): void {
  runCommand((activeController) =>
    activeController.moveColumnToPreviousDesktop(),
  );
}

export function moveColumnToNextDesktop(): void {
  runCommand((activeController) => activeController.moveColumnToNextDesktop());
}

export function moveColumnToDesktop(index: number): void {
  runCommand((activeController) => activeController.moveColumnToDesktop(index));
}

export function moveWindowToOutputLeft(): void {
  runCommand((activeController) => activeController.moveWindowToOutputLeft());
}

export function moveWindowToOutputRight(): void {
  runCommand((activeController) => activeController.moveWindowToOutputRight());
}

export function moveWindowToOutputUp(): void {
  runCommand((activeController) => activeController.moveWindowToOutputUp());
}

export function moveWindowToOutputDown(): void {
  runCommand((activeController) => activeController.moveWindowToOutputDown());
}

export function moveColumnToOutputLeft(): void {
  runCommand((activeController) => activeController.moveColumnToOutputLeft());
}

export function moveColumnToOutputRight(): void {
  runCommand((activeController) => activeController.moveColumnToOutputRight());
}

export function moveColumnToOutputUp(): void {
  runCommand((activeController) => activeController.moveColumnToOutputUp());
}

export function moveColumnToOutputDown(): void {
  runCommand((activeController) => activeController.moveColumnToOutputDown());
}

export function decreaseColumnWidth(): void {
  runCommand((activeController) => activeController.decreaseColumnWidth());
}

export function increaseColumnWidth(): void {
  runCommand((activeController) => activeController.increaseColumnWidth());
}

export function resetColumnWidth(): void {
  runCommand((activeController) => activeController.resetColumnWidth());
}

export function switchPresetColumnWidth(): void {
  runCommand((activeController) => activeController.switchPresetColumnWidth());
}

export function switchPresetColumnWidthBack(): void {
  runCommand((activeController) =>
    activeController.switchPresetColumnWidthBack(),
  );
}

export function switchPresetWindowWidth(): void {
  runCommand((activeController) => activeController.switchPresetColumnWidth());
}

export function switchPresetWindowWidthBack(): void {
  runCommand((activeController) =>
    activeController.switchPresetColumnWidthBack(),
  );
}

export function decreaseWindowHeight(): void {
  runCommand((activeController) => activeController.decreaseWindowHeight());
}

export function increaseWindowHeight(): void {
  runCommand((activeController) => activeController.increaseWindowHeight());
}

export function resetWindowHeight(): void {
  runCommand((activeController) => activeController.resetWindowHeight());
}

export function switchPresetWindowHeight(): void {
  runCommand((activeController) => activeController.switchPresetWindowHeight());
}

export function switchPresetWindowHeightBack(): void {
  runCommand((activeController) =>
    activeController.switchPresetWindowHeightBack(),
  );
}

export function maximizeColumn(): void {
  runCommand((activeController) => activeController.maximizeColumn());
}

export function centerColumn(): void {
  runCommand((activeController) => activeController.centerColumn());
}

export function centerWindow(): void {
  runCommand((activeController) => activeController.centerColumn());
}

export function expandColumnToAvailableWidth(): void {
  runCommand((activeController) =>
    activeController.expandColumnToAvailableWidth(),
  );
}

export function centerVisibleColumns(): void {
  runCommand((activeController) => activeController.centerVisibleColumns());
}

export function probeTopology(): void {
  controller?.probeTopology();
}
