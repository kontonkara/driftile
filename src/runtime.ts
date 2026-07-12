import type { KWinWorkspace } from "./platform/kwin/api";
import type { KWinRectFactory } from "./platform/kwin/geometry-adapter";
import { RuntimeController } from "./runtime-controller";
import {
  decodeDriftileSettings,
  sameDriftileSettings,
  type DriftileSettings,
} from "./settings";

const STARTUP_STABILIZATION_PROBES = 20;

let controller: RuntimeController | undefined;
let appliedSettings: DriftileSettings | undefined;

type LayoutStateChanged = (canonicalState: string) => void;

export function init(
  workspace: KWinWorkspace,
  clientAreaOption: number,
  createRect: KWinRectFactory,
  schedule: (callback: () => void) => void,
  scheduleResume: (callback: () => void) => void,
  settingsSnapshot: unknown,
  loadedLayoutState: unknown,
  onLayoutStateChanged: unknown,
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
  const nextController = new RuntimeController(workspace, {
    borderlessWindows: settings.borderlessWindows,
    clientAreaOption,
    createRect,
    gap: settings.gap,
    schedule,
    scheduleResume,
    startupStabilizationProbes: STARTUP_STABILIZATION_PROBES,
    ...(layoutStateChanged === undefined
      ? {}
      : { onLayoutStateChanged: layoutStateChanged }),
  });
  nextController.setDefaultColumnWidthPercent(
    settings.defaultColumnWidthPercent,
  );
  nextController.setColumnWidthStepPercent(settings.columnWidthStepPercent);
  nextController.setWindowHeightStepPercent(settings.windowHeightStepPercent);

  if (!nextController.start()) {
    console.warn("[driftile] no output or virtual desktop available");
    return;
  }

  controller = nextController;
  appliedSettings = settings;

  if (layoutStateChanged !== undefined) {
    controller.requestLayoutStatePublication();
    controller.flushLayoutStatePublication();
  }
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

  controller.setBorderlessWindows(settings.borderlessWindows);
  controller.setDefaultColumnWidthPercent(settings.defaultColumnWidthPercent);
  controller.setColumnWidthStepPercent(settings.columnWidthStepPercent);
  controller.setWindowHeightStepPercent(settings.windowHeightStepPercent);
  controller.setGap(settings.gap);
  appliedSettings = settings;
  return true;
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
): LayoutStateChanged | undefined {
  if (typeof loadedLayoutState !== "string") {
    console.warn("[driftile] invalid loaded layout state ignored");
    return undefined;
  }

  if (loadedLayoutState !== "") {
    return undefined;
  }

  if (typeof candidate !== "function") {
    console.warn("[driftile] invalid layout state callback ignored");
    return undefined;
  }

  return candidate as LayoutStateChanged;
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

export function focusPreviousDesktop(): void {
  runCommand((activeController) => activeController.focusPreviousDesktop());
}

export function focusNextDesktop(): void {
  runCommand((activeController) => activeController.focusNextDesktop());
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

export function moveWindowToPreviousDesktop(): void {
  runCommand((activeController) =>
    activeController.moveWindowToPreviousDesktop(),
  );
}

export function moveWindowToNextDesktop(): void {
  runCommand((activeController) => activeController.moveWindowToNextDesktop());
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
