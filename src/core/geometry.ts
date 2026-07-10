import type { ColumnWidth, LayoutContextSnapshot } from "./layout-engine";
import type { ColumnId, WindowId } from "./ids";

export interface Rect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface StripGeometryInput {
  readonly context: LayoutContextSnapshot;
  readonly devicePixelRatio: number;
  readonly gap: number;
  readonly pixelGridOrigin: Point;
  readonly workArea: Rect;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface WindowGeometry {
  readonly columnId: ColumnId;
  readonly frame: Rect;
  readonly windowId: WindowId;
}

export interface StripGeometry {
  readonly maxViewportOffset: number;
  readonly stripWidth: number;
  readonly viewportOffset: number;
  readonly windows: readonly WindowGeometry[];
}

export function solveStripGeometry(input: StripGeometryInput): StripGeometry {
  validateInput(input);

  if (input.context.columns.length === 0) {
    return {
      maxViewportOffset: 0,
      stripWidth: 0,
      viewportOffset: 0,
      windows: [],
    };
  }

  const columnWidths = input.context.columns.map((column) =>
    resolveColumnWidth(column.width, input.workArea.width, input.gap),
  );
  const stripWidth =
    sum(columnWidths) + input.gap * (input.context.columns.length + 1);
  const maxViewportOffset = snapToPixelGrid(
    Math.max(0, stripWidth - input.workArea.width),
    input.devicePixelRatio,
  );
  const viewportOffset = clamp(
    snapToPixelGrid(input.context.viewportOffset, input.devicePixelRatio),
    0,
    maxViewportOffset,
  );
  const windows: WindowGeometry[] = [];
  let columnOffset = input.gap;

  for (const [columnIndex, column] of input.context.columns.entries()) {
    const width = columnWidths[columnIndex];

    if (width === undefined) {
      throw new Error("column width resolution failed");
    }

    const left = input.workArea.x + columnOffset - viewportOffset;
    const right = left + width;
    const horizontalSpan = snapSpan(
      left,
      right,
      input.devicePixelRatio,
      input.pixelGridOrigin.x,
    );
    appendColumnWindows(
      windows,
      column.id,
      column.windowIds,
      horizontalSpan.start,
      horizontalSpan.length,
      input,
    );
    columnOffset += width + input.gap;
  }

  return {
    maxViewportOffset,
    stripWidth: snapToPixelGrid(stripWidth, input.devicePixelRatio),
    viewportOffset,
    windows,
  };
}

function appendColumnWindows(
  output: WindowGeometry[],
  columnId: ColumnId,
  windowIds: readonly WindowId[],
  left: number,
  width: number,
  input: StripGeometryInput,
): void {
  if (windowIds.length === 0) {
    return;
  }

  const availableHeight =
    input.workArea.height - input.gap * (windowIds.length + 1);
  const windowHeight = availableHeight / windowIds.length;

  if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
    throw new RangeError(
      "work area is too small for the requested window gaps",
    );
  }

  let top = input.workArea.y + input.gap;

  for (const windowId of windowIds) {
    const bottom = top + windowHeight;
    const verticalSpan = snapSpan(
      top,
      bottom,
      input.devicePixelRatio,
      input.pixelGridOrigin.y,
    );
    output.push({
      columnId,
      frame: {
        height: verticalSpan.length,
        width,
        x: left,
        y: verticalSpan.start,
      },
      windowId,
    });
    top = bottom + input.gap;
  }
}

function resolveColumnWidth(
  width: ColumnWidth,
  workAreaWidth: number,
  gap: number,
): number {
  const value =
    width.kind === "fixed"
      ? width.value
      : width.value * (workAreaWidth - gap) - gap;

  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("resolved column width must be greater than zero");
  }

  return value;
}

function validateInput(input: StripGeometryInput): void {
  for (const value of [
    input.workArea.x,
    input.workArea.y,
    input.workArea.width,
    input.workArea.height,
    input.gap,
    input.devicePixelRatio,
    input.context.viewportOffset,
    input.pixelGridOrigin.x,
    input.pixelGridOrigin.y,
  ]) {
    if (!Number.isFinite(value)) {
      throw new RangeError("geometry input must contain only finite numbers");
    }
  }

  if (input.workArea.width <= 0 || input.workArea.height <= 0) {
    throw new RangeError("work area dimensions must be greater than zero");
  }

  if (input.gap < 0) {
    throw new RangeError("gap must not be negative");
  }

  if (input.devicePixelRatio <= 0) {
    throw new RangeError("device pixel ratio must be greater than zero");
  }
}

interface SnappedSpan {
  readonly length: number;
  readonly start: number;
}

function snapSpan(
  start: number,
  end: number,
  devicePixelRatio: number,
  origin: number,
): SnappedSpan {
  const physicalStart = roundPhysicalPixel(start, devicePixelRatio, origin);
  const physicalEnd = roundPhysicalPixel(end, devicePixelRatio, origin);
  const physicalLength = physicalEnd - physicalStart;

  if (physicalLength < 1) {
    throw new RangeError(
      "geometry span must cover at least one physical pixel",
    );
  }

  return {
    length: physicalLength / devicePixelRatio,
    start: origin + physicalStart / devicePixelRatio,
  };
}

function snapToPixelGrid(value: number, devicePixelRatio: number): number {
  return roundPhysicalPixel(value, devicePixelRatio, 0) / devicePixelRatio;
}

function roundPhysicalPixel(
  value: number,
  devicePixelRatio: number,
  origin: number,
): number {
  const physicalValue = (value - origin) * devicePixelRatio;
  const magnitude = Math.round(Math.abs(physicalValue));

  if (magnitude === 0) {
    return 0;
  }

  return physicalValue < 0 ? -magnitude : magnitude;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function sum(values: readonly number[]): number {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total;
}
