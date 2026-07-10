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
): void {
  if (controller) {
    return;
  }

  const nextController = new RuntimeController(workspace, {
    clientAreaOption,
    createRect,
    schedule,
    scheduleResume,
    startupStabilizationProbes: STARTUP_STABILIZATION_PROBES,
  });

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

export function focusLeft(): void {
  controller?.focusLeft();
}

export function focusRight(): void {
  controller?.focusRight();
}

export function focusUp(): void {
  controller?.focusUp();
}

export function focusDown(): void {
  controller?.focusDown();
}

export function moveColumnLeft(): void {
  controller?.moveColumnLeft();
}

export function moveColumnRight(): void {
  controller?.moveColumnRight();
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

export function toggleFloating(): void {
  controller?.toggleFloating();
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

export function probeTopology(): void {
  controller?.probeTopology();
}
