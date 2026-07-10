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

export interface LayoutColumnPlacement {
  readonly column: LayoutColumnSnapshot;
  readonly index: number;
}

export interface RemoveColumnsCommand {
  readonly columnIds: readonly ColumnId[];
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

export interface UnmanageWindowsCommand {
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly windowIds: readonly WindowId[];
}

export interface UnmanageWindowsResult {
  readonly removedColumns: readonly {
    readonly id: ColumnId;
    readonly index: number;
  }[];
}

export interface RestoreColumnsCommand {
  readonly activeColumnId?: ColumnId | null;
  readonly columns: readonly LayoutColumnPlacement[];
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly viewportOffset?: number;
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
  readonly columnIds: Set<ColumnId>;
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

    if (context.columnIds.has(command.columnId)) {
      return false;
    }

    const column: LayoutColumn = {
      id: command.columnId,
      width: { ...command.width },
      windowIds: [command.windowId],
    };
    const activeIndex =
      context.activeColumnId === null
        ? -1
        : context.columns.findIndex(
            (candidate) => candidate.id === context.activeColumnId,
          );
    const insertionIndex =
      activeIndex < 0 ? context.columns.length : activeIndex + 1;

    context.columns.splice(insertionIndex, 0, column);
    context.columnIds.add(column.id);
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
      context.columnIds.delete(column.id);

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

  unmanageWindows(
    command: UnmanageWindowsCommand,
  ): UnmanageWindowsResult | null {
    if (command.windowIds.length === 0) {
      return null;
    }

    const key = contextKey(command.outputId, command.desktopId);
    const context = this.contexts.get(key);
    const removedWindowIds = new Set(command.windowIds);

    if (
      !context ||
      removedWindowIds.size !== command.windowIds.length ||
      command.windowIds.some(
        (id) => this.placements.get(id)?.contextKey !== key,
      )
    ) {
      return null;
    }

    const activeIndex = context.columns.findIndex(
      (column) => column.id === context.activeColumnId,
    );
    const retainedEntries: Array<{
      readonly column: LayoutColumn;
      readonly index: number;
    }> = [];
    const removedColumns: Array<{
      readonly id: ColumnId;
      readonly index: number;
    }> = [];
    let removedWindowCount = 0;

    for (const [index, column] of context.columns.entries()) {
      const retainedWindowIds = column.windowIds.filter((id) => {
        if (!removedWindowIds.has(id)) {
          return true;
        }

        removedWindowCount += 1;
        return false;
      });

      if (retainedWindowIds.length === 0) {
        removedColumns.push({ id: column.id, index });
        continue;
      }

      retainedEntries.push({
        column:
          retainedWindowIds.length === column.windowIds.length
            ? column
            : { ...column, windowIds: retainedWindowIds },
        index,
      });
    }

    if (removedWindowCount !== removedWindowIds.size) {
      return null;
    }

    for (const id of removedWindowIds) {
      this.placements.delete(id);
    }

    context.columns.length = 0;
    context.columns.push(...retainedEntries.map((entry) => entry.column));
    context.columnIds.clear();

    for (const entry of retainedEntries) {
      context.columnIds.add(entry.column.id);
    }

    if (
      context.activeColumnId !== null &&
      removedColumns.some((column) => column.id === context.activeColumnId)
    ) {
      let nextColumn = retainedEntries.find(
        (entry) => entry.index > activeIndex,
      )?.column;

      if (!nextColumn) {
        for (let index = retainedEntries.length - 1; index >= 0; index -= 1) {
          const entry = retainedEntries[index];

          if (entry && entry.index < activeIndex) {
            nextColumn = entry.column;
            break;
          }
        }
      }

      context.activeColumnId = nextColumn?.id ?? null;
    }

    if (context.columns.length === 0) {
      this.contexts.delete(key);
    }

    return { removedColumns };
  }

  removeColumns(command: RemoveColumnsCommand): boolean {
    if (command.columnIds.length === 0) {
      return false;
    }

    const key = contextKey(command.outputId, command.desktopId);
    const context = this.contexts.get(key);

    if (!context) {
      return false;
    }

    const removedIds = new Set(command.columnIds);

    if (
      removedIds.size !== command.columnIds.length ||
      command.columnIds.some((id) => !context.columnIds.has(id))
    ) {
      return false;
    }

    const activeIndex = context.columns.findIndex(
      (column) => column.id === context.activeColumnId,
    );
    const retainedEntries = context.columns
      .map((column, index) => ({ column, index }))
      .filter((entry) => !removedIds.has(entry.column.id));
    const retained = retainedEntries.map((entry) => entry.column);

    for (const column of context.columns) {
      if (!removedIds.has(column.id)) {
        continue;
      }

      for (const id of column.windowIds) {
        this.placements.delete(id);
      }

      context.columnIds.delete(column.id);
    }

    context.columns.length = 0;
    context.columns.push(...retained);

    if (
      context.activeColumnId !== null &&
      removedIds.has(context.activeColumnId)
    ) {
      const nextColumn =
        retainedEntries.find((entry) => entry.index > activeIndex)?.column ??
        retainedEntries[retainedEntries.length - 1]?.column;
      context.activeColumnId = nextColumn?.id ?? null;
    }

    if (context.columns.length === 0) {
      this.contexts.delete(key);
    }

    return true;
  }

  restoreColumns(command: RestoreColumnsCommand): boolean {
    if (command.columns.length === 0) {
      return false;
    }

    if (command.viewportOffset !== undefined) {
      assertValidViewportOffset(command.viewportOffset);
    }

    for (const placement of command.columns) {
      assertValidWidth(placement.column.width);
    }

    const key = contextKey(command.outputId, command.desktopId);
    const existing = this.contexts.get(key);
    const current = this.snapshot(command.outputId, command.desktopId);
    const restored = previewColumnRestoration(current, command.columns, {
      activeColumnId:
        command.activeColumnId === undefined
          ? current.activeColumnId
          : command.activeColumnId,
      viewportOffset: command.viewportOffset ?? current.viewportOffset,
    });

    if (!restored) {
      return false;
    }

    for (const placement of command.columns) {
      if (existing?.columnIds.has(placement.column.id)) {
        return false;
      }

      for (const id of placement.column.windowIds) {
        if (this.placements.has(id)) {
          return false;
        }
      }
    }

    const context =
      existing ??
      this.getOrCreateContext(key, command.outputId, command.desktopId);
    context.columns.length = 0;
    context.columnIds.clear();

    for (const column of restored.columns) {
      const mutableColumn: LayoutColumn = {
        id: column.id,
        width: { ...column.width },
        windowIds: [...column.windowIds],
      };
      context.columns.push(mutableColumn);
      context.columnIds.add(mutableColumn.id);

      for (const id of mutableColumn.windowIds) {
        this.placements.set(id, {
          columnId: mutableColumn.id,
          contextKey: key,
        });
      }
    }

    context.activeColumnId = restored.activeColumnId;
    context.viewportOffset = restored.viewportOffset;
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
      columnIds: new Set<ColumnId>(),
      columns: [],
      desktopId,
      outputId,
      viewportOffset: 0,
    };
    this.contexts.set(key, context);
    return context;
  }
}

export function previewColumnRestoration(
  context: LayoutContextSnapshot,
  placements: readonly LayoutColumnPlacement[],
  options: {
    readonly activeColumnId?: ColumnId | null;
    readonly viewportOffset?: number;
  } = {},
): LayoutContextSnapshot | null {
  if (placements.length === 0) {
    return null;
  }

  const finalLength = context.columns.length + placements.length;
  const restoredSlots = new Map<number, LayoutColumnSnapshot>();
  const columnIds = new Set(context.columns.map((column) => column.id));
  const windowIds = new Set<WindowId>();

  for (const column of context.columns) {
    for (const id of column.windowIds) {
      windowIds.add(id);
    }
  }

  for (const placement of placements) {
    const { column, index } = placement;
    assertValidWidth(column.width);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= finalLength ||
      restoredSlots.has(index) ||
      column.windowIds.length === 0 ||
      columnIds.has(column.id)
    ) {
      return null;
    }

    columnIds.add(column.id);

    for (const id of column.windowIds) {
      if (windowIds.has(id)) {
        return null;
      }

      windowIds.add(id);
    }

    restoredSlots.set(index, {
      id: column.id,
      width: { ...column.width },
      windowIds: [...column.windowIds],
    });
  }

  const columns: LayoutColumnSnapshot[] = [];
  let currentIndex = 0;

  for (let index = 0; index < finalLength; index += 1) {
    const restored = restoredSlots.get(index);

    if (restored) {
      columns.push(restored);
      continue;
    }

    const currentColumn = context.columns[currentIndex];

    if (!currentColumn) {
      return null;
    }

    columns.push({
      id: currentColumn.id,
      width: { ...currentColumn.width },
      windowIds: [...currentColumn.windowIds],
    });
    currentIndex += 1;
  }

  const activeColumnId =
    options.activeColumnId === undefined
      ? context.activeColumnId
      : options.activeColumnId;

  if (
    activeColumnId !== null &&
    !columns.some((column) => column.id === activeColumnId)
  ) {
    return null;
  }

  const viewportOffset = options.viewportOffset ?? context.viewportOffset;
  assertValidViewportOffset(viewportOffset);

  return {
    activeColumnId,
    columns,
    desktopId: context.desktopId,
    outputId: context.outputId,
    viewportOffset,
  };
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
