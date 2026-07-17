import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewMinimizedPlaceholderRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const MAXIMUM_PLACEHOLDER_WIDTH = 180;
const MAXIMUM_PLACEHOLDER_HEIGHT = 28;

// Smaller intersections do not leave a practical, recognizable Overview target.
const MINIMUM_VISIBLE_WIDTH = 24;
const MINIMUM_VISIBLE_HEIGHT = 12;

export function planOverviewMinimizedPlaceholder(
  frame: unknown,
  viewport: unknown,
): OverviewMinimizedPlaceholderRect | null {
  try {
    const source = snapshotRect(frame);
    const visibleArea = snapshotRect(viewport);

    if (source === null || visibleArea === null) {
      return null;
    }

    const visibleLeft = Math.max(source.x, visibleArea.x);
    const visibleTop = Math.max(source.y, visibleArea.y);
    const visibleRight = Math.min(
      source.x + source.width,
      visibleArea.x + visibleArea.width,
    );
    const visibleBottom = Math.min(
      source.y + source.height,
      visibleArea.y + visibleArea.height,
    );
    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;

    if (
      visibleWidth < MINIMUM_VISIBLE_WIDTH ||
      visibleHeight < MINIMUM_VISIBLE_HEIGHT
    ) {
      return null;
    }

    const width = Math.min(visibleWidth, MAXIMUM_PLACEHOLDER_WIDTH);
    const height = Math.min(visibleHeight, MAXIMUM_PLACEHOLDER_HEIGHT);
    const centeredX = source.x + (source.width - width) / 2;
    const centeredY = source.y + (source.height - height) / 2;

    return {
      height,
      width,
      x: normalizeZero(clamp(centeredX, visibleLeft, visibleRight - width)),
      y: normalizeZero(clamp(centeredY, visibleTop, visibleBottom - height)),
    };
  } catch {
    return null;
  }
}

function snapshotRect(value: unknown): OverviewMinimizedPlaceholderRect | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const x = candidate["x"];
  const y = candidate["y"];
  const width = candidate["width"];
  const height = candidate["height"];

  if (
    !validCoordinate(x) ||
    !validCoordinate(y) ||
    !validDimension(width) ||
    !validDimension(height)
  ) {
    return null;
  }

  const right = x + width;
  const bottom = y + height;

  if (!validCoordinate(right) || !validCoordinate(bottom)) {
    return null;
  }

  return { height, width, x, y };
}

function validCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function validDimension(value: unknown): value is number {
  return validCoordinate(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
