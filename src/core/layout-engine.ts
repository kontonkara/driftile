import type { ColumnId, DesktopId, OutputId, WindowId } from "./ids";

export interface ColumnWidth {
  readonly kind: "fixed" | "proportion";
  readonly value: number;
}

export interface LayoutColumnSnapshot {
  readonly id: ColumnId;
  readonly width: ColumnWidth;
  readonly windowIds: readonly WindowId[];
}

export interface LayoutContextSnapshot {
  readonly activeColumnId: ColumnId | null;
  readonly columns: readonly LayoutColumnSnapshot[];
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly viewportOffset: number;
}

export interface ManageWindowCommand {
  readonly columnId: ColumnId;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly width: ColumnWidth;
  readonly windowId: WindowId;
}

export type HorizontalDirection = "left" | "right";

interface LayoutColumn {
  readonly id: ColumnId;
  readonly width: ColumnWidth;
  readonly windowIds: WindowId[];
}

interface LayoutContext {
  activeColumnId: ColumnId | null;
  readonly columns: LayoutColumn[];
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  viewportOffset: number;
}

interface WindowPlacement {
  readonly columnId: ColumnId;
  readonly contextKey: string;
}

export class LayoutEngine {
  private readonly contexts = new Map<string, LayoutContext>();
  private readonly placements = new Map<WindowId, WindowPlacement>();

  manageWindow(command: ManageWindowCommand): boolean {
    assertValidWidth(command.width);

    if (this.placements.has(command.windowId)) {
      return false;
    }

    const key = contextKey(command.outputId, command.desktopId);
    const context = this.getOrCreateContext(
      key,
      command.outputId,
      command.desktopId,
    );

    if (context.columns.some((column) => column.id === command.columnId)) {
      return false;
    }

    const column: LayoutColumn = {
      id: command.columnId,
      width: { ...command.width },
      windowIds: [command.windowId],
    };
    const activeIndex = context.columns.findIndex(
      (candidate) => candidate.id === context.activeColumnId,
    );
    const insertionIndex =
      activeIndex < 0 ? context.columns.length : activeIndex + 1;

    context.columns.splice(insertionIndex, 0, column);
    this.placements.set(command.windowId, {
      columnId: column.id,
      contextKey: key,
    });

    return true;
  }

  activateWindow(windowId: WindowId): boolean {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return false;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context) {
      return false;
    }

    if (context.activeColumnId === placement.columnId) {
      return false;
    }

    context.activeColumnId = placement.columnId;
    return true;
  }

  adjacentWindow(
    windowId: WindowId,
    direction: HorizontalDirection,
  ): WindowId | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context) {
      return null;
    }

    const columnIndex = context.columns.findIndex(
      (column) => column.id === placement.columnId,
    );

    if (columnIndex < 0) {
      return null;
    }

    const targetIndex =
      direction === "left" ? columnIndex - 1 : columnIndex + 1;
    return context.columns[targetIndex]?.windowIds[0] ?? null;
  }

  unmanageWindow(windowId: WindowId): boolean {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return false;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context) {
      this.placements.delete(windowId);
      return false;
    }

    const columnIndex = context.columns.findIndex(
      (column) => column.id === placement.columnId,
    );

    if (columnIndex < 0) {
      this.placements.delete(windowId);
      return false;
    }

    const column = context.columns[columnIndex];

    if (!column) {
      return false;
    }

    const windowIndex = column.windowIds.indexOf(windowId);

    if (windowIndex < 0) {
      this.placements.delete(windowId);
      return false;
    }

    column.windowIds.splice(windowIndex, 1);
    this.placements.delete(windowId);

    if (column.windowIds.length === 0) {
      context.columns.splice(columnIndex, 1);

      if (context.activeColumnId === column.id) {
        const nextColumn =
          context.columns[columnIndex] ?? context.columns[columnIndex - 1];
        context.activeColumnId = nextColumn?.id ?? null;
      }

      if (context.columns.length === 0) {
        this.contexts.delete(placement.contextKey);
      }
    }

    return true;
  }

  snapshot(outputId: OutputId, desktopId: DesktopId): LayoutContextSnapshot {
    const context = this.contexts.get(contextKey(outputId, desktopId));

    if (!context) {
      return {
        activeColumnId: null,
        columns: [],
        desktopId,
        outputId,
        viewportOffset: 0,
      };
    }

    return {
      activeColumnId: context.activeColumnId,
      columns: context.columns.map((column) => ({
        id: column.id,
        width: { ...column.width },
        windowIds: [...column.windowIds],
      })),
      desktopId: context.desktopId,
      outputId: context.outputId,
      viewportOffset: context.viewportOffset,
    };
  }

  setViewportOffset(
    outputId: OutputId,
    desktopId: DesktopId,
    viewportOffset: number,
  ): boolean {
    assertValidViewportOffset(viewportOffset);

    const context = this.contexts.get(contextKey(outputId, desktopId));

    if (!context) {
      return false;
    }

    context.viewportOffset = viewportOffset === 0 ? 0 : viewportOffset;
    return true;
  }

  private getOrCreateContext(
    key: string,
    outputId: OutputId,
    desktopId: DesktopId,
  ): LayoutContext {
    const existing = this.contexts.get(key);

    if (existing) {
      return existing;
    }

    const context: LayoutContext = {
      activeColumnId: null,
      columns: [],
      desktopId,
      outputId,
      viewportOffset: 0,
    };
    this.contexts.set(key, context);
    return context;
  }
}

function contextKey(outputId: OutputId, desktopId: DesktopId): string {
  return `${outputId}\u0000${desktopId}`;
}

function assertValidWidth(width: ColumnWidth): void {
  if (!Number.isFinite(width.value) || width.value <= 0) {
    throw new RangeError("column width must be finite and greater than zero");
  }
}

function assertValidViewportOffset(viewportOffset: number): void {
  if (!Number.isFinite(viewportOffset) || viewportOffset < 0) {
    throw new RangeError("viewport offset must be finite and non-negative");
  }
}
