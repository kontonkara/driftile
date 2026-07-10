import type { KWinWorkspace } from "./platform/kwin/api";
import type { KWinRectFactory } from "./platform/kwin/geometry-adapter";
import { RuntimeController } from "./runtime-controller";

let controller: RuntimeController | undefined;

export function init(
  workspace: KWinWorkspace,
  clientAreaOption: number,
  createRect: KWinRectFactory,
  schedule: (callback: () => void) => void,
): void {
  if (controller) {
    return;
  }

  const nextController = new RuntimeController(workspace, {
    clientAreaOption,
    createRect,
    schedule,
  });

  if (!nextController.start()) {
    console.warn("[driftile] no active output and desktop context");
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
