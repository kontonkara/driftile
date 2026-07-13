import type { Rect } from "./geometry";

export type PointerHorizontalResizeEdge = "left" | "right";

export interface PointerHorizontalResize {
  readonly edge: PointerHorizontalResizeEdge;
  readonly width: number;
}

const GEOMETRY_EPSILON = 1e-6;

export function inferPointerHorizontalResize(
  before: Rect,
  accepted: Rect,
): PointerHorizontalResize | null {
  if (!isUsableRect(before) || !isUsableRect(accepted)) {
    return null;
  }

  const widthChanged = !nearlyEqual(before.width, accepted.width);
  const topUnchanged = nearlyEqual(before.y, accepted.y);
  const bottomUnchanged = nearlyEqual(
    before.y + before.height,
    accepted.y + accepted.height,
  );

  if (!widthChanged || !topUnchanged || !bottomUnchanged) {
    return null;
  }

  const leftChanged = !nearlyEqual(before.x, accepted.x);
  const rightChanged = !nearlyEqual(
    before.x + before.width,
    accepted.x + accepted.width,
  );

  if (leftChanged === rightChanged) {
    return null;
  }

  return Object.freeze({
    edge: leftChanged ? "left" : "right",
    width: accepted.width,
  });
}

function isUsableRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    rect.width > 0 &&
    Number.isFinite(rect.height) &&
    rect.height > 0
  );
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= GEOMETRY_EPSILON;
}
