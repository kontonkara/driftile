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

const MAX_REVEAL_CORRECTIONS = 4;

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
  const stripOverflow = stripWidth - input.workArea.width;
  const stripOverflowTolerance = floatingPointTolerance(
    stripWidth,
    input.workArea.width,
  );
  const initialMaxViewportOffset =
    stripOverflow <= stripOverflowTolerance
      ? 0
      : snapUpToPixelGrid(stripOverflow, input.devicePixelRatio);
  const maxViewportOffset = extendMaxViewportOffset(
    columnWidths,
    initialMaxViewportOffset,
    input,
  );
  const viewportOffset = clamp(
    snapToPixelGrid(input.context.viewportOffset, input.devicePixelRatio),
    0,
    maxViewportOffset,
  );
  const revealedViewportOffset = revealActiveColumn(
    input.context,
    columnWidths,
    viewportOffset,
    maxViewportOffset,
    input.workArea,
    input.pixelGridOrigin.x,
    input.gap,
    input.devicePixelRatio,
  );
  const windows: WindowGeometry[] = [];
  let columnOffset = input.gap;

  for (const [columnIndex, column] of input.context.columns.entries()) {
    const width = columnWidths[columnIndex];

    if (width === undefined) {
      throw new Error("column width resolution failed");
    }

    const left = input.workArea.x + columnOffset - revealedViewportOffset;
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
    viewportOffset: revealedViewportOffset,
    windows,
  };
}

function extendMaxViewportOffset(
  columnWidths: readonly number[],
  initialOffset: number,
  input: StripGeometryInput,
): number {
  const terminalWidth = columnWidths[columnWidths.length - 1];

  if (terminalWidth === undefined) {
    return initialOffset;
  }

  let terminalStart = input.gap;

  for (let index = 0; index < columnWidths.length - 1; index += 1) {
    const width = columnWidths[index];

    if (width === undefined) {
      throw new Error("column width resolution failed");
    }

    terminalStart += width + input.gap;
  }

  const viewportEnd = input.workArea.x + input.workArea.width;
  let maxViewportOffset = initialOffset;

  for (
    let correctionCount = 0;
    correctionCount <= MAX_REVEAL_CORRECTIONS;
    correctionCount += 1
  ) {
    const terminalLeft = input.workArea.x + terminalStart - maxViewportOffset;
    const terminal = snapSpan(
      terminalLeft,
      terminalLeft + terminalWidth,
      input.devicePixelRatio,
      input.pixelGridOrigin.x,
    );
    const terminalEnd = terminal.start + terminal.length;
    const tolerance = floatingPointTolerance(viewportEnd, terminalEnd);

    if (
      terminalEnd <= viewportEnd + tolerance ||
      correctionCount === MAX_REVEAL_CORRECTIONS
    ) {
      return maxViewportOffset;
    }

    maxViewportOffset = moveByPhysicalPixels(
      maxViewportOffset,
      terminalEnd - viewportEnd,
      1,
      input.devicePixelRatio,
    );
  }

  return maxViewportOffset;
}

function revealActiveColumn(
  context: LayoutContextSnapshot,
  columnWidths: readonly number[],
  viewportOffset: number,
  maxViewportOffset: number,
  workArea: Rect,
  pixelGridOrigin: number,
  gap: number,
  devicePixelRatio: number,
): number {
  if (context.activeColumnId === null || maxViewportOffset === 0) {
    return viewportOffset;
  }

  let columnStart = gap;

  for (const [index, column] of context.columns.entries()) {
    const columnWidth = columnWidths[index];

    if (columnWidth === undefined) {
      throw new Error("column width resolution failed");
    }

    if (column.id === context.activeColumnId) {
      return revealColumnSpan(
        columnStart,
        columnWidth,
        viewportOffset,
        maxViewportOffset,
        workArea,
        pixelGridOrigin,
        devicePixelRatio,
      );
    }

    columnStart += columnWidth + gap;
  }

  return viewportOffset;
}

function revealColumnSpan(
  columnStart: number,
  columnWidth: number,
  viewportOffset: number,
  maxViewportOffset: number,
  workArea: Rect,
  pixelGridOrigin: number,
  devicePixelRatio: number,
): number {
  const viewportEnd = workArea.x + workArea.width;
  let revealedOffset = viewportOffset;

  for (
    let correctionCount = 0;
    correctionCount <= MAX_REVEAL_CORRECTIONS;
    correctionCount += 1
  ) {
    const targetStart = workArea.x + columnStart - revealedOffset;
    const target = snapSpan(
      targetStart,
      targetStart + columnWidth,
      devicePixelRatio,
      pixelGridOrigin,
    );
    const targetEnd = target.start + target.length;
    const tolerance = floatingPointTolerance(
      workArea.x,
      viewportEnd,
      target.start,
      targetEnd,
    );
    let correctionDirection: -1 | 0 | 1 = 0;
    let correctionDistance = 0;

    if (target.length <= workArea.width + tolerance) {
      if (target.start < workArea.x - tolerance) {
        correctionDirection = -1;
        correctionDistance = workArea.x - target.start;
      } else if (targetEnd > viewportEnd + tolerance) {
        correctionDirection = 1;
        correctionDistance = targetEnd - viewportEnd;
      }
    } else if (target.start > workArea.x + tolerance) {
      correctionDirection = 1;
      correctionDistance = target.start - workArea.x;
    } else if (targetEnd < viewportEnd - tolerance) {
      correctionDirection = -1;
      correctionDistance = viewportEnd - targetEnd;
    }

    if (
      correctionDirection === 0 ||
      correctionCount === MAX_REVEAL_CORRECTIONS
    ) {
      return revealedOffset;
    }

    const correctedOffset = moveByPhysicalPixels(
      revealedOffset,
      correctionDistance,
      correctionDirection,
      devicePixelRatio,
    );
    const clampedOffset = clamp(correctedOffset, 0, maxViewportOffset);

    if (clampedOffset === revealedOffset) {
      return revealedOffset;
    }

    revealedOffset = clampedOffset;
  }

  return revealedOffset;
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

function snapUpToPixelGrid(value: number, devicePixelRatio: number): number {
  const physicalValue = value * devicePixelRatio;
  const tolerance = floatingPointTolerance(physicalValue);

  return Math.ceil(physicalValue - tolerance) / devicePixelRatio;
}

function moveByPhysicalPixels(
  viewportOffset: number,
  distance: number,
  direction: -1 | 1,
  devicePixelRatio: number,
): number {
  const physicalOffset = roundPhysicalPixel(
    viewportOffset,
    devicePixelRatio,
    0,
  );
  const physicalDistance = distance * devicePixelRatio;
  const distanceTolerance = floatingPointTolerance(physicalDistance);
  const pixelCount = Math.max(
    1,
    Math.ceil(physicalDistance - distanceTolerance),
  );

  return (physicalOffset + direction * pixelCount) / devicePixelRatio;
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

function floatingPointTolerance(...values: readonly number[]): number {
  let magnitude = 1;

  for (const value of values) {
    magnitude = Math.max(magnitude, Math.abs(value));
  }

  return magnitude * Number.EPSILON * 16;
}

function sum(values: readonly number[]): number {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total;
}
