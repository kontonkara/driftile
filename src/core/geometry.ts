import type {
  ColumnWidth,
  LayoutColumnSnapshot,
  LayoutContextSnapshot,
  WindowHeight,
} from "./layout-engine";
import type { ColumnId, WindowId } from "./ids";

export interface Rect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface StripGeometryInput {
  readonly centerSingleColumn?: boolean;
  readonly context: LayoutContextSnapshot;
  readonly devicePixelRatio: number;
  readonly gap: number;
  readonly pixelGridOrigin: Point;
  readonly windowHeightBounds?: ReadonlyMap<WindowId, WindowHeightBounds>;
  readonly windowHeightPresetResolver?: (
    stateIndex: number,
  ) => ColumnWidth | null;
  readonly windowHeightPresets?: readonly ColumnWidth[];
  readonly workArea: Rect;
}

export interface WindowHeightBounds {
  readonly decorationHeight?: number;
  readonly maximumClientHeight?: number;
  readonly minimumClientHeight?: number;
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

export const DEFAULT_WINDOW_HEIGHT_PRESETS: readonly ColumnWidth[] =
  Object.freeze([
    Object.freeze({ kind: "proportion" as const, value: 1 / 3 }),
    Object.freeze({ kind: "proportion" as const, value: 0.5 }),
    Object.freeze({ kind: "proportion" as const, value: 2 / 3 }),
  ]);

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

  let activeColumnIndex = -1;
  let activeColumnOffset = 0;
  let fullWidthActiveColumnIndex = -1;
  let fullWidthActiveColumnOffset = 0;
  let resolvedColumnOffset = input.gap;
  const columnWidths = input.context.columns.map((column, columnIndex) => {
    const width = resolveColumnWidth(
      column.width,
      input.workArea.width,
      input.gap,
    );

    if (column.id === input.context.activeColumnId) {
      activeColumnIndex = columnIndex;
      activeColumnOffset = resolvedColumnOffset;

      if (column.width.kind === "proportion" && column.width.value === 1) {
        fullWidthActiveColumnIndex = columnIndex;
        fullWidthActiveColumnOffset = resolvedColumnOffset;
      }
    }

    resolvedColumnOffset += width + input.gap;

    return width;
  });
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
  const fullWidthSuccessorAnchor = immediateFullWidthSuccessorAnchor(
    input.context,
    activeColumnIndex,
    activeColumnOffset,
    input.gap,
    input.devicePixelRatio,
  );
  const extendedMaxViewportOffset = extendMaxViewportOffset(
    columnWidths,
    initialMaxViewportOffset,
    input,
  );
  const maxViewportOffset = Math.max(
    extendedMaxViewportOffset,
    fullWidthSuccessorAnchor ?? 0,
  );
  const viewportOffset = snapToPixelGrid(
    input.context.viewportOffset,
    input.devicePixelRatio,
  );
  const revealedViewportOffset =
    input.centerSingleColumn === true && columnWidths.length === 1
      ? centerSingleColumnViewportOffset(columnWidths[0], input)
      : fullWidthSuccessorAnchor === null
        ? revealActiveColumn(
            input.context,
            columnWidths,
            viewportOffset,
            maxViewportOffset,
            input.workArea,
            input.pixelGridOrigin.x,
            input.gap,
            input.devicePixelRatio,
          )
        : clamp(fullWidthSuccessorAnchor, 0, maxViewportOffset);
  let fullWidthLeftNeighborShift = 0;
  let fullWidthRightNeighborShift = 0;
  const clearance = snapUpToPixelGrid(input.gap, input.devicePixelRatio);
  const leftNeighborLimit = snapDownToPixelGrid(
    input.workArea.x - clearance,
    input.devicePixelRatio,
    input.pixelGridOrigin.x,
  );
  const rightNeighborLimit = snapUpToPixelGrid(
    input.workArea.x + input.workArea.width + clearance,
    input.devicePixelRatio,
    input.pixelGridOrigin.x,
  );

  if (fullWidthActiveColumnIndex >= 0) {
    const fullWidthActiveColumnWidth = columnWidths[fullWidthActiveColumnIndex];

    if (fullWidthActiveColumnWidth === undefined) {
      throw new Error("full-width column resolution failed");
    }

    const activeColumnLeft =
      input.workArea.x + fullWidthActiveColumnOffset - revealedViewportOffset;
    const unshiftedLeftNeighborEnd = snapToPixelGrid(
      activeColumnLeft - input.gap,
      input.devicePixelRatio,
      input.pixelGridOrigin.x,
    );
    const unshiftedRightNeighborStart = snapToPixelGrid(
      activeColumnLeft + fullWidthActiveColumnWidth + input.gap,
      input.devicePixelRatio,
      input.pixelGridOrigin.x,
    );
    fullWidthLeftNeighborShift = Math.min(
      0,
      leftNeighborLimit - unshiftedLeftNeighborEnd,
    );
    fullWidthRightNeighborShift = Math.max(
      0,
      rightNeighborLimit - unshiftedRightNeighborStart,
    );
  }
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
    const fullWidthNeighborShift =
      columnIndex < fullWidthActiveColumnIndex
        ? fullWidthLeftNeighborShift
        : columnIndex > fullWidthActiveColumnIndex
          ? fullWidthRightNeighborShift
          : 0;
    const shiftedLeft = horizontalSpan.start + fullWidthNeighborShift;
    const shiftedRight = shiftedLeft + horizontalSpan.length;
    const inactiveFullWidthPredecessorShift =
      activeColumnIndex >= 0 &&
      columnIndex < activeColumnIndex &&
      isSemanticFullWidth(column)
        ? Math.min(0, leftNeighborLimit - shiftedRight)
        : 0;

    appendColumnWindows(
      windows,
      column,
      shiftedLeft + inactiveFullWidthPredecessorShift,
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

function centerSingleColumnViewportOffset(
  width: number | undefined,
  input: StripGeometryInput,
): number {
  if (width === undefined) {
    throw new Error("single-column width resolution failed");
  }

  return snapToPixelGrid(
    input.gap + width / 2 - input.workArea.width / 2,
    input.devicePixelRatio,
  );
}

function immediateFullWidthSuccessorAnchor(
  context: LayoutContextSnapshot,
  activeColumnIndex: number,
  activeColumnOffset: number,
  gap: number,
  devicePixelRatio: number,
): number | null {
  const activeColumn = context.columns[activeColumnIndex];
  const predecessor = context.columns[activeColumnIndex - 1];

  if (
    !activeColumn ||
    !predecessor ||
    isSemanticFullWidth(activeColumn) ||
    !isSemanticFullWidth(predecessor)
  ) {
    return null;
  }

  return snapToPixelGrid(activeColumnOffset - gap, devicePixelRatio);
}

function isSemanticFullWidth(column: LayoutColumnSnapshot): boolean {
  return column.width.kind === "proportion" && column.width.value === 1;
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

  const viewportPadding = clamp(
    (input.workArea.width - terminalWidth) / 2,
    0,
    input.gap,
  );
  const paddedViewportStart = input.workArea.x + viewportPadding;
  const paddedViewportEnd =
    input.workArea.x + input.workArea.width - viewportPadding;
  const paddedPhysicalStart = snapUpToPixelGrid(
    paddedViewportStart,
    input.devicePixelRatio,
    input.pixelGridOrigin.x,
  );
  const paddedPhysicalEnd = snapDownToPixelGrid(
    paddedViewportEnd,
    input.devicePixelRatio,
    input.pixelGridOrigin.x,
  );
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
    const paddedViewportTolerance = floatingPointTolerance(
      paddedViewportStart,
      paddedViewportEnd,
      terminal.length,
    );
    const viewportEnd =
      terminal.length <=
      paddedPhysicalEnd - paddedPhysicalStart + paddedViewportTolerance
        ? paddedViewportEnd
        : input.workArea.x + input.workArea.width;
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
  if (context.activeColumnId === null) {
    return viewportOffset;
  }

  let columnStart = gap;

  for (const [index, column] of context.columns.entries()) {
    const columnWidth = columnWidths[index];

    if (columnWidth === undefined) {
      throw new Error("column width resolution failed");
    }

    if (column.id === context.activeColumnId) {
      if (column.width.kind === "proportion" && column.width.value === 1) {
        return clamp(
          snapToPixelGrid(columnStart - gap, devicePixelRatio),
          0,
          maxViewportOffset,
        );
      }

      return revealColumnSpan(
        columnStart,
        columnWidth,
        viewportOffset,
        maxViewportOffset,
        workArea,
        pixelGridOrigin,
        gap,
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
  gap: number,
  devicePixelRatio: number,
): number {
  const viewportPadding = clamp((workArea.width - columnWidth) / 2, 0, gap);
  const paddedViewportStart = workArea.x + viewportPadding;
  const paddedViewportEnd = workArea.x + workArea.width - viewportPadding;
  const paddedPhysicalStart = snapUpToPixelGrid(
    paddedViewportStart,
    devicePixelRatio,
    pixelGridOrigin,
  );
  const paddedPhysicalEnd = snapDownToPixelGrid(
    paddedViewportEnd,
    devicePixelRatio,
    pixelGridOrigin,
  );
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
    const paddedViewportTolerance = floatingPointTolerance(
      paddedViewportStart,
      paddedViewportEnd,
      target.length,
    );
    const targetFitsPaddedViewport =
      target.length <=
      paddedPhysicalEnd - paddedPhysicalStart + paddedViewportTolerance;
    const viewportStart = targetFitsPaddedViewport
      ? paddedViewportStart
      : workArea.x;
    const viewportEnd = targetFitsPaddedViewport
      ? paddedViewportEnd
      : workArea.x + workArea.width;
    const tolerance = floatingPointTolerance(
      viewportStart,
      viewportEnd,
      target.start,
      targetEnd,
    );
    let correctionDirection: -1 | 0 | 1 = 0;
    let correctionDistance = 0;

    if (target.length <= workArea.width + tolerance) {
      if (target.start < viewportStart - tolerance) {
        correctionDirection = -1;
        correctionDistance = viewportStart - target.start;
      } else if (targetEnd > viewportEnd + tolerance) {
        correctionDirection = 1;
        correctionDistance = targetEnd - viewportEnd;
      }
    } else if (target.start > viewportStart + tolerance) {
      correctionDirection = 1;
      correctionDistance = target.start - viewportStart;
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
  column: LayoutColumnSnapshot,
  left: number,
  width: number,
  input: StripGeometryInput,
): void {
  const { id: columnId, windowIds } = column;

  if (windowIds.length === 0) {
    return;
  }

  if (column.presentation === "tabbed") {
    appendTabbedWindows(output, column, left, width, input);
    return;
  }

  if (column.windowHeights) {
    appendWeightedHeightWindows(output, column, left, width, input);
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

function appendTabbedWindows(
  output: WindowGeometry[],
  column: LayoutColumnSnapshot,
  left: number,
  width: number,
  input: StripGeometryInput,
): void {
  validateColumnWindowHeights(column);
  const verticalSpan = snapSpan(
    input.workArea.y + input.gap,
    input.workArea.y + input.workArea.height - input.gap,
    input.devicePixelRatio,
    input.pixelGridOrigin.y,
  );

  if (verticalSpan.length <= 0) {
    throw new RangeError(
      "work area is too small for the requested window gaps",
    );
  }

  for (const windowId of column.windowIds) {
    const suppliedBounds = input.windowHeightBounds?.get(windowId);

    if (suppliedBounds) {
      const bounds = resolveWindowHeightBounds(
        suppliedBounds,
        input.devicePixelRatio,
      );
      const tolerance = floatingPointTolerance(
        verticalSpan.length,
        bounds.minimumFrameHeight,
        Number.isFinite(bounds.maximumFrameHeight)
          ? bounds.maximumFrameHeight
          : verticalSpan.length,
      );

      if (
        verticalSpan.length + tolerance < bounds.minimumFrameHeight ||
        verticalSpan.length - tolerance > bounds.maximumFrameHeight
      ) {
        throw new RangeError(
          "tabbed window height bounds cannot accept the common frame",
        );
      }
    }

    output.push({
      columnId: column.id,
      frame: {
        height: verticalSpan.length,
        width,
        x: left,
        y: verticalSpan.start,
      },
      windowId,
    });
  }
}

interface ResolvedWindowHeightBounds {
  readonly decorationHeight: number;
  readonly maximumFrameHeight: number;
  readonly minimumFrameHeight: number;
}

function appendWeightedHeightWindows(
  output: WindowGeometry[],
  column: LayoutColumnSnapshot,
  left: number,
  width: number,
  input: StripGeometryInput,
): void {
  const heights = column.windowHeights;

  if (!heights || heights.length !== column.windowIds.length) {
    throw new RangeError("window height state does not match the column");
  }

  const nonAutomaticIndex = validateColumnWindowHeights(column);

  const availableHeight =
    input.workArea.height - input.gap * (column.windowIds.length + 1);

  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    throw new RangeError(
      "work area is too small for the requested window gaps",
    );
  }

  const bounds = column.windowIds.map((id) =>
    resolveWindowHeightBounds(
      input.windowHeightBounds?.get(id),
      input.devicePixelRatio,
    ),
  );
  const resolved = new Array<number | undefined>(column.windowIds.length);
  let automaticBudget = availableHeight;

  if (nonAutomaticIndex >= 0) {
    const policy = heights[nonAutomaticIndex];
    const targetBounds = bounds[nonAutomaticIndex];

    if (!policy || policy.kind === "auto" || !targetBounds) {
      throw new Error("window height resolution failed");
    }

    let otherMinimum = 0;

    for (const [index, candidate] of bounds.entries()) {
      if (index !== nonAutomaticIndex) {
        otherMinimum += candidate.minimumFrameHeight;
      }
    }

    if (!Number.isFinite(otherMinimum)) {
      throw new RangeError("window height bounds are invalid");
    }

    const maximumFromRemainder = snapDownToPixelGrid(
      availableHeight - otherMinimum,
      input.devicePixelRatio,
    );

    if (
      maximumFromRemainder +
        floatingPointTolerance(
          maximumFromRemainder,
          targetBounds.minimumFrameHeight,
        ) <
      targetBounds.minimumFrameHeight
    ) {
      throw new RangeError("window minimum heights exceed the work area");
    }

    const requested = resolveNonAutomaticFrameHeight(
      policy,
      targetBounds.decorationHeight,
      input,
    );
    const targetHeight = clamp(
      requested,
      targetBounds.minimumFrameHeight,
      Math.min(targetBounds.maximumFrameHeight, maximumFromRemainder),
    );
    resolved[nonAutomaticIndex] = targetHeight;
    automaticBudget -= targetHeight;
  }

  distributeAutomaticWindowHeights(resolved, heights, bounds, automaticBudget);

  let top = input.workArea.y + input.gap;

  for (const [index, windowId] of column.windowIds.entries()) {
    const height = resolved[index];

    if (height === undefined || !Number.isFinite(height) || height <= 0) {
      throw new Error("window height resolution failed");
    }

    const bottom = top + height;
    const verticalSpan = snapSpan(
      top,
      bottom,
      input.devicePixelRatio,
      input.pixelGridOrigin.y,
    );
    output.push({
      columnId: column.id,
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

interface AutomaticHeightConstraint {
  readonly index: number;
  readonly maximumHeight: number;
  readonly maximumLogWaterLevel: number;
  readonly minimumHeight: number;
  readonly minimumLogWaterLevel: number;
  readonly weight: number;
}

class AutomaticHeightConstraintIndex {
  private readonly leafCount: number;
  private readonly maximumMinimumLogWaterLevels: Float64Array;
  private readonly minimumMaximumLogWaterLevels: Float64Array;

  constructor(constraints: readonly (AutomaticHeightConstraint | undefined)[]) {
    let leafCount = 1;

    while (leafCount < constraints.length) {
      leafCount *= 2;
    }

    this.leafCount = leafCount;
    this.maximumMinimumLogWaterLevels = new Float64Array(leafCount * 2);
    this.maximumMinimumLogWaterLevels.fill(Number.NEGATIVE_INFINITY);
    this.minimumMaximumLogWaterLevels = new Float64Array(leafCount * 2);
    this.minimumMaximumLogWaterLevels.fill(Number.POSITIVE_INFINITY);

    for (const constraint of constraints) {
      if (!constraint) {
        continue;
      }

      const leaf = leafCount + constraint.index;
      this.maximumMinimumLogWaterLevels[leaf] = constraint.minimumLogWaterLevel;
      this.minimumMaximumLogWaterLevels[leaf] = constraint.maximumLogWaterLevel;
    }

    for (let node = leafCount - 1; node > 0; node -= 1) {
      this.updateNode(node);
    }
  }

  firstViolation(logWaterLevel: number): number {
    if (!this.nodeHasViolation(1, logWaterLevel)) {
      return -1;
    }

    let node = 1;

    while (node < this.leafCount) {
      const left = node * 2;
      node = this.nodeHasViolation(left, logWaterLevel) ? left : left + 1;
    }

    return node - this.leafCount;
  }

  remove(index: number): void {
    let node = this.leafCount + index;
    this.maximumMinimumLogWaterLevels[node] = Number.NEGATIVE_INFINITY;
    this.minimumMaximumLogWaterLevels[node] = Number.POSITIVE_INFINITY;

    while (node > 1) {
      node = Math.floor(node / 2);
      this.updateNode(node);
    }
  }

  private nodeHasViolation(node: number, logWaterLevel: number): boolean {
    return (
      (this.maximumMinimumLogWaterLevels[node] ?? Number.NEGATIVE_INFINITY) >
        logWaterLevel ||
      (this.minimumMaximumLogWaterLevels[node] ?? Number.POSITIVE_INFINITY) <
        logWaterLevel
    );
  }

  private updateNode(node: number): void {
    const left = node * 2;
    const right = left + 1;
    this.maximumMinimumLogWaterLevels[node] = Math.max(
      this.maximumMinimumLogWaterLevels[left] ?? Number.NEGATIVE_INFINITY,
      this.maximumMinimumLogWaterLevels[right] ?? Number.NEGATIVE_INFINITY,
    );
    this.minimumMaximumLogWaterLevels[node] = Math.min(
      this.minimumMaximumLogWaterLevels[left] ?? Number.POSITIVE_INFINITY,
      this.minimumMaximumLogWaterLevels[right] ?? Number.POSITIVE_INFINITY,
    );
  }
}

function distributeAutomaticWindowHeights(
  output: Array<number | undefined>,
  policies: readonly WindowHeight[],
  bounds: readonly ResolvedWindowHeightBounds[],
  budget: number,
): void {
  const constraints = new Array<AutomaticHeightConstraint | undefined>(
    policies.length,
  );
  let activeCount = 0;
  const initialBudget = budget;
  let minimumTotal = 0;
  let totalWeight = 0;

  for (const [index, policy] of policies.entries()) {
    if (policy.kind !== "auto") {
      continue;
    }

    const candidateBounds = bounds[index];

    if (!candidateBounds) {
      throw new Error("window height bounds are missing");
    }

    constraints[index] = {
      index,
      maximumHeight: candidateBounds.maximumFrameHeight,
      maximumLogWaterLevel:
        Math.log(candidateBounds.maximumFrameHeight) - Math.log(policy.weight),
      minimumHeight: candidateBounds.minimumFrameHeight,
      minimumLogWaterLevel:
        Math.log(candidateBounds.minimumFrameHeight) - Math.log(policy.weight),
      weight: policy.weight,
    };
    activeCount += 1;
    minimumTotal += candidateBounds.minimumFrameHeight;
    totalWeight += policy.weight;
  }

  if (activeCount === 0) {
    return;
  }

  if (!Number.isFinite(minimumTotal) || !Number.isFinite(totalWeight)) {
    throw new RangeError("window height state is invalid");
  }

  if (budget + floatingPointTolerance(budget, minimumTotal) < minimumTotal) {
    throw new RangeError("window minimum heights exceed the work area");
  }

  let remaining = budget;
  const constraintIndex = new AutomaticHeightConstraintIndex(constraints);

  while (activeCount > 0) {
    const logWaterLevel =
      remaining > 0
        ? Math.log(remaining) - Math.log(totalWeight)
        : Number.NEGATIVE_INFINITY;
    const constrainedIndex = constraintIndex.firstViolation(logWaterLevel);

    if (constrainedIndex >= 0) {
      const constraint = constraints[constrainedIndex];

      if (!constraint) {
        throw new Error("window height state is out of sync");
      }

      const constrainedHeight =
        logWaterLevel < constraint.minimumLogWaterLevel
          ? constraint.minimumHeight
          : constraint.maximumHeight;
      output[constrainedIndex] = constrainedHeight;
      constraints[constrainedIndex] = undefined;
      activeCount -= 1;
      constraintIndex.remove(constrainedIndex);
      remaining -= constrainedHeight;
      totalWeight -= constraint.weight;

      if (remaining < -floatingPointTolerance(remaining, constrainedHeight)) {
        throw new RangeError("window minimum heights exceed the work area");
      }

      continue;
    }

    let remainingWeight = totalWeight;

    for (const [index, constraint] of constraints.entries()) {
      if (!constraint) {
        continue;
      }

      const height = remaining * (constraint.weight / remainingWeight);
      output[index] = height;
      remaining -= height;
      remainingWeight -= constraint.weight;
    }

    activeCount = 0;
  }

  if (remaining > floatingPointTolerance(initialBudget, remaining)) {
    throw new RangeError("window maximum heights cannot fill the work area");
  }
}

function resolveNonAutomaticFrameHeight(
  height: Exclude<WindowHeight, { readonly kind: "auto" }>,
  decorationHeight: number,
  input: StripGeometryInput,
): number {
  if (height.kind === "fixed") {
    return height.clientHeight + decorationHeight;
  }

  const presets = input.windowHeightPresets ?? DEFAULT_WINDOW_HEIGHT_PRESETS;
  const preset =
    input.windowHeightPresetResolver?.(height.index) ?? presets[height.index];

  if (!preset) {
    throw new RangeError("window height preset index is out of range");
  }

  validateSizePolicy(preset, "window height preset");
  return preset.kind === "fixed"
    ? preset.value + decorationHeight
    : preset.value * (input.workArea.height - input.gap) - input.gap;
}

function resolveWindowHeightBounds(
  bounds: WindowHeightBounds | undefined,
  devicePixelRatio: number,
): ResolvedWindowHeightBounds {
  const decorationHeight = bounds?.decorationHeight ?? 0;
  const minimumClientHeight = bounds?.minimumClientHeight ?? 1;
  const maximumClientHeight = bounds?.maximumClientHeight;

  if (
    !Number.isFinite(decorationHeight) ||
    decorationHeight < 0 ||
    !Number.isFinite(minimumClientHeight) ||
    minimumClientHeight < 0 ||
    (maximumClientHeight !== undefined &&
      maximumClientHeight !== Number.POSITIVE_INFINITY &&
      (!Number.isFinite(maximumClientHeight) || maximumClientHeight < 0))
  ) {
    throw new RangeError("window height bounds are invalid");
  }

  const minimumFrameHeight = snapUpToPixelGrid(
    Math.max(1, minimumClientHeight) + decorationHeight,
    devicePixelRatio,
  );
  const unresolvedMaximumFrameHeight =
    maximumClientHeight === undefined || maximumClientHeight <= 0
      ? Number.POSITIVE_INFINITY
      : maximumClientHeight + decorationHeight;
  const maximumFrameHeight = Number.isFinite(unresolvedMaximumFrameHeight)
    ? snapDownToPixelGrid(unresolvedMaximumFrameHeight, devicePixelRatio)
    : unresolvedMaximumFrameHeight;

  if (
    !Number.isFinite(minimumFrameHeight) ||
    maximumFrameHeight < minimumFrameHeight
  ) {
    throw new RangeError("window height bounds are inconsistent");
  }

  return {
    decorationHeight,
    maximumFrameHeight,
    minimumFrameHeight,
  };
}

function validateWindowHeight(height: unknown): asserts height is WindowHeight {
  if (typeof height !== "object" || height === null) {
    throw new RangeError("window height state is invalid");
  }

  const state = height as Record<string, unknown>;

  if (
    (state["kind"] === "auto" &&
      typeof state["weight"] === "number" &&
      Number.isFinite(state["weight"]) &&
      state["weight"] > 0) ||
    (state["kind"] === "fixed" &&
      typeof state["clientHeight"] === "number" &&
      Number.isFinite(state["clientHeight"]) &&
      state["clientHeight"] > 0) ||
    (state["kind"] === "preset" &&
      typeof state["index"] === "number" &&
      Number.isInteger(state["index"]) &&
      state["index"] >= 0)
  ) {
    return;
  }

  throw new RangeError("window height state is invalid");
}

function validateColumnWindowHeights(column: LayoutColumnSnapshot): number {
  const heights = column.windowHeights;

  if (!heights) {
    return -1;
  }

  if (heights.length !== column.windowIds.length) {
    throw new RangeError("window height state does not match the column");
  }

  let nonAutomaticIndex = -1;

  for (const [index, height] of heights.entries()) {
    validateWindowHeight(height);

    if (height.kind === "auto") {
      continue;
    }

    if (nonAutomaticIndex >= 0) {
      throw new RangeError(
        "a column can contain at most one non-automatic window height",
      );
    }

    nonAutomaticIndex = index;
  }

  return nonAutomaticIndex;
}

function validateSizePolicy(width: ColumnWidth, label: string): void {
  if (!Number.isFinite(width.value) || width.value <= 0) {
    throw new RangeError(`${label} must be finite and greater than zero`);
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
  if (
    input.windowHeightPresetResolver !== undefined &&
    typeof input.windowHeightPresetResolver !== "function"
  ) {
    throw new RangeError("window height preset resolver must be a function");
  }

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

  for (const column of input.context.columns) {
    if (
      !isKnownColumnPresentation(column.presentation) ||
      column.windowIds.length === 0 ||
      !column.windowIds.includes(column.selectedWindowId)
    ) {
      throw new RangeError("column presentation state is invalid");
    }

    if (
      column.windowHeights &&
      column.windowHeights.length !== column.windowIds.length
    ) {
      throw new RangeError("window height state does not match the column");
    }
  }
}

function isKnownColumnPresentation(presentation: unknown): boolean {
  return presentation === "stacked" || presentation === "tabbed";
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

function snapToPixelGrid(
  value: number,
  devicePixelRatio: number,
  origin = 0,
): number {
  return (
    origin +
    roundPhysicalPixel(value, devicePixelRatio, origin) / devicePixelRatio
  );
}

function snapUpToPixelGrid(
  value: number,
  devicePixelRatio: number,
  origin = 0,
): number {
  const physicalValue = (value - origin) * devicePixelRatio;
  const tolerance = floatingPointTolerance(physicalValue);

  return origin + Math.ceil(physicalValue - tolerance) / devicePixelRatio;
}

function snapDownToPixelGrid(
  value: number,
  devicePixelRatio: number,
  origin = 0,
): number {
  const physicalValue = (value - origin) * devicePixelRatio;
  const tolerance = floatingPointTolerance(physicalValue);

  return origin + Math.floor(physicalValue + tolerance) / devicePixelRatio;
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
