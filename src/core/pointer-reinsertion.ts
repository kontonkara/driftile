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
  readonly memberIndex: number;
}

export function planPointerWindowDrop(
  input: PointerWindowDropInput,
): PointerWindowDropTarget | null {
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

  const target = pointerWindowDropTarget(
    placements,
    input.cursor,
    input.draggedWindowId,
    input.visibleArea,
    input.windows,
  );

  if (!target) {
    return null;
  }

  const targetPlacement = placements.get(target.targetWindowId);

  if (!targetPlacement) {
    return null;
  }

  return isSameColumnNoOp(draggedPlacement, targetPlacement, target.position)
    ? null
    : target;
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

  return pointerWindowDropTarget(
    placements,
    input.cursor,
    input.draggedWindowId,
    input.visibleArea,
    input.windows,
  );
}

function pointerWindowDropTarget(
  placements: ReadonlyMap<WindowId, ContextWindowPlacement>,
  cursor: Point,
  draggedWindowId: WindowId,
  visibleArea: Rect,
  windows: readonly WindowGeometry[],
): PointerWindowDropTarget | null {
  if (!containsPoint(visibleArea, cursor)) {
    return null;
  }

  const geometryWindowIds = new Set<WindowId>();
  let target: PointerWindowDropTarget | null = null;

  for (const geometry of windows) {
    if (!validWindowGeometry(geometry)) {
      return null;
    }

    if (geometryWindowIds.has(geometry.windowId)) {
      return null;
    }

    geometryWindowIds.add(geometry.windowId);
    const placement = placements.get(geometry.windowId);

    if (!placement || placement.columnId !== geometry.columnId) {
      return null;
    }

    if (
      geometry.windowId === draggedWindowId ||
      !containsPoint(geometry.frame, cursor)
    ) {
      continue;
    }

    if (target) {
      return null;
    }

    target = Object.freeze({
      position:
        cursor.y < geometry.frame.y + geometry.frame.height / 2
          ? "before"
          : "after",
      targetWindowId: geometry.windowId,
    });
  }

  if (geometryWindowIds.size !== placements.size || !target) {
    return null;
  }

  return target;
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

function validWindowGeometry(value: unknown): value is WindowGeometry {
  return (
    isRecord(value) &&
    typeof value.columnId === "string" &&
    typeof value.windowId === "string" &&
    isUsableRect(value.frame)
  );
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
