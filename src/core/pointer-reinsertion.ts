import type { Point, Rect, WindowGeometry } from "./geometry";
import type {
  LayoutContextSnapshot,
  WindowReinsertionTarget,
} from "./layout-engine";
import type { ColumnId, WindowId } from "./ids";

export interface PointerWindowDropInput {
  readonly context: LayoutContextSnapshot;
  readonly cursor: Point;
  readonly draggedWindowId: WindowId;
  readonly visibleArea: Rect;
  readonly windows: readonly WindowGeometry[];
}

export type PointerWindowDropTarget = WindowReinsertionTarget;

export interface PointerWindowDropPreview {
  readonly frame: Rect;
  readonly target: PointerWindowDropTarget;
}

export interface PointerExternalWindowDropInput {
  readonly context: LayoutContextSnapshot;
  readonly cursor: Point;
  readonly draggedWindowId: WindowId;
  readonly visibleArea: Rect;
  readonly windows: readonly WindowGeometry[];
}

export type PointerExternalWindowDropTarget = WindowReinsertionTarget;

interface ContextWindowPlacement {
  readonly columnId: ColumnId;
  readonly dropTarget: boolean;
  readonly memberIndex: number;
}

interface PointerWindowDropMatch {
  readonly frame: Rect;
  readonly target: PointerWindowDropTarget;
}

interface WindowGeometrySnapshot {
  readonly columnId: ColumnId;
  readonly frame: Rect;
  readonly windowId: WindowId;
}

export function planPointerWindowDrop(
  input: PointerWindowDropInput,
): PointerWindowDropTarget | null {
  return planPointerWindowDropMatch(input)?.target ?? null;
}

export function planPointerWindowDropPreview(
  input: PointerWindowDropInput,
): PointerWindowDropPreview | null {
  const match = planPointerWindowDropMatch(input);

  if (!match) {
    return null;
  }

  const frame = pointerWindowDropPreviewFrame(
    match.frame,
    match.target.position,
  );

  if (!frame) {
    return null;
  }

  return Object.freeze({
    frame,
    target: match.target,
  });
}

function planPointerWindowDropMatch(
  input: PointerWindowDropInput,
): PointerWindowDropMatch | null {
  if (
    !isRecord(input) ||
    typeof input.draggedWindowId !== "string" ||
    !isFinitePoint(input.cursor) ||
    !isUsableRect(input.visibleArea) ||
    !Array.isArray(input.windows)
  ) {
    return null;
  }

  const placements = contextWindowPlacements(input.context);
  const draggedPlacement = placements?.get(input.draggedWindowId);

  if (!placements || !draggedPlacement) {
    return null;
  }

  const match = pointerWindowDropMatch(
    placements,
    input.cursor,
    input.draggedWindowId,
    input.visibleArea,
    input.windows,
  );

  if (!match) {
    return null;
  }

  const targetPlacement = placements.get(match.target.targetWindowId);

  if (!targetPlacement) {
    return null;
  }

  return isSameColumnNoOp(
    draggedPlacement,
    targetPlacement,
    match.target.position,
  )
    ? null
    : match;
}

export function planPointerExternalWindowDrop(
  input: PointerExternalWindowDropInput,
): PointerExternalWindowDropTarget | null {
  if (
    !isRecord(input) ||
    typeof input.draggedWindowId !== "string" ||
    !isFinitePoint(input.cursor) ||
    !isUsableRect(input.visibleArea) ||
    !Array.isArray(input.windows)
  ) {
    return null;
  }

  const placements = contextWindowPlacements(input.context);

  if (!placements || placements.has(input.draggedWindowId)) {
    return null;
  }

  return (
    pointerWindowDropMatch(
      placements,
      input.cursor,
      input.draggedWindowId,
      input.visibleArea,
      input.windows,
    )?.target ?? null
  );
}

function pointerWindowDropPreviewFrame(
  targetFrame: Rect,
  position: PointerWindowDropTarget["position"],
): Rect | null {
  const left = Math.round(targetFrame.x);
  const right = Math.round(targetFrame.x + targetFrame.width);
  const top = Math.round(targetFrame.y);
  const bottom = Math.round(targetFrame.y + targetFrame.height);
  const split = Math.round(targetFrame.y + targetFrame.height / 2);

  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(top) ||
    !Number.isSafeInteger(bottom) ||
    !Number.isSafeInteger(split) ||
    !(right > left) ||
    !(split > top) ||
    !(split < bottom)
  ) {
    return null;
  }

  return Object.freeze({
    height: position === "before" ? split - top : bottom - split,
    width: right - left,
    x: left,
    y: position === "before" ? top : split,
  });
}

function pointerWindowDropMatch(
  placements: ReadonlyMap<WindowId, ContextWindowPlacement>,
  cursor: Point,
  draggedWindowId: WindowId,
  visibleArea: Rect,
  windows: readonly WindowGeometry[],
): PointerWindowDropMatch | null {
  if (!containsPoint(visibleArea, cursor)) {
    return null;
  }

  const geometryWindowIds = new Set<WindowId>();
  let match: PointerWindowDropMatch | null = null;

  for (const geometry of windows) {
    const snapshot = snapshotWindowGeometry(geometry);

    if (!snapshot) {
      return null;
    }

    if (geometryWindowIds.has(snapshot.windowId)) {
      return null;
    }

    geometryWindowIds.add(snapshot.windowId);
    const placement = placements.get(snapshot.windowId);

    if (!placement || placement.columnId !== snapshot.columnId) {
      return null;
    }

    if (
      snapshot.windowId === draggedWindowId ||
      !placement.dropTarget ||
      !containsPoint(snapshot.frame, cursor)
    ) {
      continue;
    }

    if (match) {
      return null;
    }

    match = {
      frame: snapshot.frame,
      target: Object.freeze({
        position:
          cursor.y < snapshot.frame.y + snapshot.frame.height / 2
            ? "before"
            : "after",
        targetWindowId: snapshot.windowId,
      }),
    };
  }

  if (geometryWindowIds.size !== placements.size || !match) {
    return null;
  }

  return match;
}

function contextWindowPlacements(
  context: LayoutContextSnapshot,
): ReadonlyMap<WindowId, ContextWindowPlacement> | null {
  if (
    !isRecord(context) ||
    typeof context.outputId !== "string" ||
    typeof context.desktopId !== "string" ||
    !Number.isFinite(context.viewportOffset) ||
    !Array.isArray(context.columns)
  ) {
    return null;
  }

  const columnIds = new Set<ColumnId>();
  const placements = new Map<WindowId, ContextWindowPlacement>();

  for (const column of context.columns) {
    if (
      !isRecord(column) ||
      typeof column.id !== "string" ||
      !validColumnWidth(column.width) ||
      !Array.isArray(column.windowIds) ||
      column.windowIds.length === 0 ||
      (column.presentation !== "stacked" && column.presentation !== "tabbed") ||
      typeof column.selectedWindowId !== "string" ||
      !column.windowIds.includes(column.selectedWindowId) ||
      !validWindowHeights(column.windowHeights, column.windowIds.length)
    ) {
      return null;
    }

    const savedColumnId = column.id as ColumnId;

    if (columnIds.has(savedColumnId)) {
      return null;
    }

    columnIds.add(savedColumnId);

    for (const [memberIndex, id] of column.windowIds.entries()) {
      if (typeof id !== "string") {
        return null;
      }

      const savedWindowId = id as WindowId;

      if (placements.has(savedWindowId)) {
        return null;
      }

      placements.set(savedWindowId, {
        columnId: savedColumnId,
        dropTarget:
          column.presentation === "stacked" ||
          savedWindowId === column.selectedWindowId,
        memberIndex,
      });
    }
  }

  if (
    context.activeColumnId !== null &&
    (typeof context.activeColumnId !== "string" ||
      !columnIds.has(context.activeColumnId))
  ) {
    return null;
  }

  return placements;
}

function validColumnWidth(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === "fixed" || value.kind === "proportion") &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    value.value > 0
  );
}

function validWindowHeights(value: unknown, windowCount: number): boolean {
  if (value === undefined) {
    return true;
  }

  if (!Array.isArray(value) || value.length !== windowCount) {
    return false;
  }

  let nonAutomaticCount = 0;
  let hasNonDefaultHeight = false;

  for (const height of value) {
    if (!isRecord(height)) {
      return false;
    }

    if (height.kind === "auto") {
      if (
        typeof height.weight !== "number" ||
        !Number.isFinite(height.weight) ||
        height.weight <= 0
      ) {
        return false;
      }

      hasNonDefaultHeight ||= height.weight !== 1;
      continue;
    }

    if (
      (height.kind === "fixed" &&
        typeof height.clientHeight === "number" &&
        Number.isFinite(height.clientHeight) &&
        height.clientHeight > 0) ||
      (height.kind === "preset" &&
        typeof height.index === "number" &&
        Number.isInteger(height.index) &&
        height.index >= 0)
    ) {
      nonAutomaticCount += 1;
      hasNonDefaultHeight = true;
      continue;
    }

    return false;
  }

  return nonAutomaticCount <= 1 && hasNonDefaultHeight;
}

function isSameColumnNoOp(
  dragged: ContextWindowPlacement,
  target: ContextWindowPlacement,
  position: WindowReinsertionTarget["position"],
): boolean {
  if (dragged.columnId !== target.columnId) {
    return false;
  }

  const targetIndexAfterRemoval =
    target.memberIndex > dragged.memberIndex
      ? target.memberIndex - 1
      : target.memberIndex;
  const insertionIndex =
    targetIndexAfterRemoval + (position === "after" ? 1 : 0);
  return insertionIndex === dragged.memberIndex;
}

function snapshotWindowGeometry(value: unknown): WindowGeometrySnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    const columnIdValue = value.columnId;
    const frameValue = value.frame;
    const windowIdValue = value.windowId;

    if (
      typeof columnIdValue !== "string" ||
      typeof windowIdValue !== "string" ||
      !isRecord(frameValue)
    ) {
      return null;
    }

    const frame = {
      height: frameValue.height,
      width: frameValue.width,
      x: frameValue.x,
      y: frameValue.y,
    };

    if (!isUsableRect(frame)) {
      return null;
    }

    return {
      columnId: columnIdValue as ColumnId,
      frame,
      windowId: windowIdValue as WindowId,
    };
  } catch {
    return null;
  }
}

function isFinitePoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}

function isUsableRect(value: unknown): value is Rect {
  if (
    !isRecord(value) ||
    typeof value.x !== "number" ||
    !Number.isFinite(value.x) ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.y) ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width <= 0 ||
    typeof value.height !== "number" ||
    !Number.isFinite(value.height) ||
    value.height <= 0
  ) {
    return false;
  }

  return (
    Number.isFinite(value.x + value.width) &&
    Number.isFinite(value.y + value.height)
  );
}

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
