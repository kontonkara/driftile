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

  if (!containsPoint(input.visibleArea, input.cursor)) {
    return null;
  }

  const geometryWindowIds = new Set<WindowId>();
  let target: PointerWindowDropTarget | null = null;
  let targetPlacement: ContextWindowPlacement | null = null;

  for (const geometry of input.windows) {
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
      geometry.windowId === input.draggedWindowId ||
      !containsPoint(geometry.frame, input.cursor)
    ) {
      continue;
    }

    if (target) {
      return null;
    }

    target = Object.freeze({
      position:
        input.cursor.y < geometry.frame.y + geometry.frame.height / 2
          ? "before"
          : "after",
      targetWindowId: geometry.windowId,
    });
    targetPlacement = placement;
  }

  if (
    geometryWindowIds.size !== placements.size ||
    !target ||
    !targetPlacement
  ) {
    return null;
  }

  return isSameColumnNoOp(draggedPlacement, targetPlacement, target.position)
    ? null
    : target;
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
      !Array.isArray(column.windowIds) ||
      column.windowIds.length === 0
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

  return placements;
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
