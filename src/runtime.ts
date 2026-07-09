import type { KWinWorkspace } from "./platform/kwin/api";
import { WindowObserver } from "./platform/kwin/window-observer";

let observer: WindowObserver | undefined;

export function init(workspace: KWinWorkspace): void {
  if (observer) {
    return;
  }

  observer = new WindowObserver(workspace);
  observer.start();
  console.info(`[driftile] observing ${String(observer.size)} windows`);
}

export function destroy(): void {
  observer?.stop();
  observer = undefined;
}
