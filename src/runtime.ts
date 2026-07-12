import type { KWinWorkspace } from "./platform/kwin/api";
import type { KWinRectFactory } from "./platform/kwin/geometry-adapter";
import { RuntimeController } from "./runtime-controller";

const STARTUP_STABILIZATION_PROBES = 20;

let controller: RuntimeController | undefined;

export function init(
  workspace: KWinWorkspace,
  clientAreaOption: number,
  createRect: KWinRectFactory,
  schedule: (callback: () => void) => void,
  scheduleResume: (callback: () => void) => void,
  borderlessWindows: boolean,
  gap: number,
  defaultColumnWidthPercent: number,
  columnWidthStepPercent: number,
  windowHeightStepPercent: number,
): void {
  if (controller) {
    return;
  }

  const nextController = new RuntimeController(workspace, {
    borderlessWindows,
    clientAreaOption,
    createRect,
    gap,
    schedule,
    scheduleResume,
    startupStabilizationProbes: STARTUP_STABILIZATION_PROBES,
  });
  nextController.setDefaultColumnWidthPercent(defaultColumnWidthPercent);
  nextController.setColumnWidthStepPercent(columnWidthStepPercent);
  nextController.setWindowHeightStepPercent(windowHeightStepPercent);

  if (!nextController.start()) {
    console.warn("[driftile] no output or virtual desktop available");
    return;
  }

  controller = nextController;
  console.info(
    `[driftile] managed=${String(controller.managedCount)} writes=${String(controller.lastWriteCount)}`,
  );
}

export function destroy(): void {
  controller?.stop();
  controller = undefined;
}

export function setBorderlessWindows(enabled: boolean): void {
  controller?.setBorderlessWindows(enabled);
}

export function setDefaultColumnWidthPercent(percent: number): void {
  controller?.setDefaultColumnWidthPercent(percent);
}

export function setColumnWidthStepPercent(percent: number): void {
  controller?.setColumnWidthStepPercent(percent);
}

export function setWindowHeightStepPercent(percent: number): void {
  controller?.setWindowHeightStepPercent(percent);
}

export function setGap(gap: number): void {
  controller?.setGap(gap);
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
