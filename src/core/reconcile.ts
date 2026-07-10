import type { Rect, WindowGeometry } from "./geometry";
import type { WindowId } from "./ids";

export interface GeometryChange {
  readonly frame: Rect;
  readonly windowId: WindowId;
}

export function diffWindowGeometries(
  desired: readonly WindowGeometry[],
  observed: ReadonlyMap<WindowId, Rect>,
): readonly GeometryChange[] {
  const changes: GeometryChange[] = [];

  for (const window of desired) {
    const currentFrame = observed.get(window.windowId);

    if (currentFrame && !rectsEqual(currentFrame, window.frame)) {
      changes.push({
        frame: window.frame,
        windowId: window.windowId,
      });
    }
  }

  return changes;
}

function rectsEqual(left: Rect, right: Rect): boolean {
  return (
    numbersEqual(left.x, right.x) &&
    numbersEqual(left.y, right.y) &&
    numbersEqual(left.width, right.width) &&
    numbersEqual(left.height, right.height)
  );
}

function numbersEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}
