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

export function init(
  workspace: KWinWorkspace,
  clientAreaOption: number,
  createRect: KWinRectFactory,
  schedule: (callback: () => void) => void,
  scheduleResume: (callback: () => void) => void,
  settingsSnapshot: unknown,
): void {
  const settings = decodeSettings(settingsSnapshot);

  if (!settings) {
    return;
  }

  if (controller) {
    return;
  }

  const nextController = new RuntimeController(workspace, {
    borderlessWindows: settings.borderlessWindows,
    clientAreaOption,
    createRect,
    gap: settings.gap,
    schedule,
    scheduleResume,
    startupStabilizationProbes: STARTUP_STABILIZATION_PROBES,
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

export function focusLeft(): void {
  controller?.focusLeft();
}

export function focusRight(): void {
  controller?.focusRight();
}

export function focusFirstColumn(): void {
  controller?.focusFirstColumn();
}

export function focusLastColumn(): void {
  controller?.focusLastColumn();
}

export function focusUp(): void {
  controller?.focusUp();
}

export function focusDown(): void {
  controller?.focusDown();
}

export function focusPreviousDesktop(): void {
  controller?.focusPreviousDesktop();
}

export function focusNextDesktop(): void {
  controller?.focusNextDesktop();
}

export function focusDesktop(index: number): void {
  controller?.focusDesktop(index);
}

export function moveDesktopDown(): void {
  controller?.moveDesktopDown();
}

export function moveDesktopUp(): void {
  controller?.moveDesktopUp();
}

export function moveColumnLeft(): void {
  controller?.moveColumnLeft();
}

export function moveColumnRight(): void {
  controller?.moveColumnRight();
}

export function moveColumnToFirst(): void {
  controller?.moveColumnToFirst();
}

export function moveColumnToLast(): void {
  controller?.moveColumnToLast();
}

export function moveWindowLeft(): void {
  controller?.moveWindowLeft();
}

export function moveWindowRight(): void {
  controller?.moveWindowRight();
}

export function moveWindowUp(): void {
  controller?.moveWindowUp();
}

export function moveWindowDown(): void {
  controller?.moveWindowDown();
}

export function insertWindowIntoStackLeft(): void {
  controller?.insertWindowIntoStackLeft();
}

export function insertWindowIntoStackRight(): void {
  controller?.insertWindowIntoStackRight();
}

export function consumeWindowIntoColumn(): void {
  controller?.consumeWindowIntoColumn();
}

export function expelWindowFromColumn(): void {
  controller?.expelWindowFromColumn();
}

export function toggleFloating(): void {
  controller?.toggleFloating();
}

export function switchFocusBetweenFloatingAndTiling(): void {
  controller?.switchFocusBetweenFloatingAndTiling();
}

export function focusFloating(): void {
  controller?.focusFloating();
}

export function focusTiling(): void {
  controller?.focusTiling();
}

export function toggleFullscreen(): void {
  controller?.toggleFullscreen();
}

export function maximizeWindowToEdges(): void {
  controller?.maximizeWindowToEdges();
}

export function moveWindowToPreviousDesktop(): void {
  controller?.moveWindowToPreviousDesktop();
}

export function moveWindowToNextDesktop(): void {
  controller?.moveWindowToNextDesktop();
}

export function moveColumnToPreviousDesktop(): void {
  controller?.moveColumnToPreviousDesktop();
}

export function moveColumnToNextDesktop(): void {
  controller?.moveColumnToNextDesktop();
}

export function moveColumnToDesktop(index: number): void {
  controller?.moveColumnToDesktop(index);
}

export function moveWindowToOutputLeft(): void {
  controller?.moveWindowToOutputLeft();
}

export function moveWindowToOutputRight(): void {
  controller?.moveWindowToOutputRight();
}

export function moveWindowToOutputUp(): void {
  controller?.moveWindowToOutputUp();
}

export function moveWindowToOutputDown(): void {
  controller?.moveWindowToOutputDown();
}

export function moveColumnToOutputLeft(): void {
  controller?.moveColumnToOutputLeft();
}

export function moveColumnToOutputRight(): void {
  controller?.moveColumnToOutputRight();
}

export function moveColumnToOutputUp(): void {
  controller?.moveColumnToOutputUp();
}

export function moveColumnToOutputDown(): void {
  controller?.moveColumnToOutputDown();
}

export function decreaseColumnWidth(): void {
  controller?.decreaseColumnWidth();
}

export function increaseColumnWidth(): void {
  controller?.increaseColumnWidth();
}

export function resetColumnWidth(): void {
  controller?.resetColumnWidth();
}

export function switchPresetColumnWidth(): void {
  controller?.switchPresetColumnWidth();
}

export function switchPresetColumnWidthBack(): void {
  controller?.switchPresetColumnWidthBack();
}

export function decreaseWindowHeight(): void {
  controller?.decreaseWindowHeight();
}

export function increaseWindowHeight(): void {
  controller?.increaseWindowHeight();
}

export function resetWindowHeight(): void {
  controller?.resetWindowHeight();
}

export function switchPresetWindowHeight(): void {
  controller?.switchPresetWindowHeight();
}

export function switchPresetWindowHeightBack(): void {
  controller?.switchPresetWindowHeightBack();
}

export function maximizeColumn(): void {
  controller?.maximizeColumn();
}

export function centerColumn(): void {
  controller?.centerColumn();
}

export function expandColumnToAvailableWidth(): void {
  controller?.expandColumnToAvailableWidth();
}

export function centerVisibleColumns(): void {
  controller?.centerVisibleColumns();
}

export function probeTopology(): void {
  controller?.probeTopology();
}
