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
