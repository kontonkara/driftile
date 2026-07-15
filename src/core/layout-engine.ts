import type { ColumnId, DesktopId, OutputId, WindowId } from "./ids";

export interface ColumnWidth {
  readonly kind: "fixed" | "proportion";
  readonly value: number;
}

export type ColumnPresentation = "stacked" | "tabbed";

export type WindowHeight =
  | {
      readonly kind: "auto";
      readonly weight: number;
    }
  | {
      readonly clientHeight: number;
      readonly kind: "fixed";
    }
  | {
      readonly index: number;
      readonly kind: "preset";
    };

export interface LayoutColumnSnapshot {
  readonly id: ColumnId;
  readonly presentation: ColumnPresentation;
  readonly selectedWindowId: WindowId;
  readonly width: ColumnWidth;
  readonly windowHeights?: readonly WindowHeight[];
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

export interface TabIndicatorState {
  readonly selectedIndex: number;
  readonly tabCount: number;
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
  readonly presentation?: ColumnPresentation;
  readonly width: ColumnWidth;
  readonly windowId: WindowId;
}

export interface DetachedWindowPlacement {
  readonly columnId: ColumnId;
  readonly columnIndex: number;
  readonly columnPresentation: ColumnPresentation;
  readonly columnWidth: ColumnWidth;
  readonly desktopId: DesktopId;
  readonly memberIndex: number;
  readonly nextColumnId: ColumnId | null;
  readonly nextWindowId: WindowId | null;
  readonly outputId: OutputId;
  readonly previousColumnId: ColumnId | null;
  readonly previousWindowId: WindowId | null;
  readonly windowHeight?: WindowHeight;
  readonly windowId: WindowId;
}

declare const windowDetachPreviewBrand: unique symbol;

export interface WindowDetachPreview {
  readonly [windowDetachPreviewBrand]: true;
  readonly layout: LayoutContextSnapshot;
  readonly placement: DetachedWindowPlacement;
}

declare const windowAttachPreviewBrand: unique symbol;

export interface WindowAttachPreview {
  readonly [windowAttachPreviewBrand]: true;
  readonly layout: LayoutContextSnapshot;
}

export interface WindowTransferTarget {
  readonly columnId: ColumnId;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly presentation?: ColumnPresentation;
}

export type WindowReinsertionPosition = "after" | "before";

export interface WindowReinsertionTarget {
  readonly position: WindowReinsertionPosition;
  readonly targetWindowId: WindowId;
}

export interface ColumnReinsertionTarget {
  readonly position: WindowReinsertionPosition;
  readonly targetColumnId: ColumnId;
}

export interface WindowTransferInsertionTarget extends WindowReinsertionTarget {
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

export interface WindowTransferColumnInsertionTarget extends ColumnReinsertionTarget {
  readonly columnId: ColumnId;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  readonly presentation?: ColumnPresentation;
}

export interface ColumnTransferTarget {
  readonly columnId: ColumnId;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

declare const columnTransferPreviewBrand: unique symbol;

export interface ColumnTransferPreview {
  readonly [columnTransferPreviewBrand]: true;
  readonly sourceLayout: LayoutContextSnapshot;
  readonly targetLayout: LayoutContextSnapshot;
}

declare const windowTransferPreviewBrand: unique symbol;

export interface WindowTransferPreview {
  readonly [windowTransferPreviewBrand]: true;
  readonly sourceLayout: LayoutContextSnapshot;
  readonly targetLayout: LayoutContextSnapshot;
}

export type HorizontalDirection = "left" | "right";
export type HorizontalEdge = "first" | "last";
export type VerticalDirection = "down" | "up";

declare const stackEditRollbackBrand: unique symbol;

export interface StackEditRollback {
  readonly [stackEditRollbackBrand]: true;
}

export interface StackEditResult {
  readonly kind:
    "consume" | "expel" | "extract" | "insert" | "merge" | "reorder";
  readonly rollback: StackEditRollback;
}

declare const columnStackEditPreviewBrand: unique symbol;

export interface ColumnStackEditPreview {
  readonly [columnStackEditPreviewBrand]: true;
  readonly kind: "consume" | "expel";
  readonly layout: LayoutContextSnapshot;
  readonly movedWindowId: WindowId;
}

declare const windowHeightEditRollbackBrand: unique symbol;

export interface WindowHeightEditRollback {
  readonly [windowHeightEditRollbackBrand]: true;
}

export interface WindowHeightEditResult {
  readonly rollback: WindowHeightEditRollback;
}

interface LayoutColumn {
  readonly id: ColumnId;
  presentation: ColumnPresentation;
  selectedWindowId: WindowId;
  readonly width: ColumnWidth;
  windowHeights?: WindowHeight[];
  readonly windowIds: WindowId[];
}

interface LayoutContext {
  activeColumnId: ColumnId | null;
  readonly columnById: Map<ColumnId, LayoutColumn>;
  readonly columnIds: Set<ColumnId>;
  readonly columnIndexById: Map<ColumnId, number>;
  readonly columns: LayoutColumn[];
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
  viewportOffset: number;
}

interface ManagedWindowPlacement {
  readonly columnId: ColumnId;
  readonly contextKey: string;
  readonly memberIndex: number;
}

interface StackEditSnapshots {
  readonly after: LayoutContextSnapshot;
  readonly before: LayoutContextSnapshot;
}

interface ColumnStackEditPreviewState {
  readonly after: LayoutContextSnapshot;
  readonly before: LayoutContextSnapshot;
}

interface WindowHeightEditSnapshots {
  readonly after: LayoutContextSnapshot;
  readonly before: LayoutContextSnapshot;
}

interface WindowReinsertionPreview {
  readonly after: LayoutContextSnapshot;
  readonly kind: "insert" | "merge" | "reorder";
}

interface ColumnBoundaryReinsertionPreview {
  readonly after: LayoutContextSnapshot;
  readonly kind: "extract" | "reorder";
}

interface WindowDetachPreviewState {
  readonly after: LayoutContextSnapshot;
  readonly before: LayoutContextSnapshot;
  readonly windowId: WindowId;
}

interface WindowAttachPreviewState {
  readonly after: LayoutContextSnapshot;
  readonly before: LayoutContextSnapshot;
  readonly windowId: WindowId;
}

interface WindowTransferPreviewState {
  readonly sourceAfter: LayoutContextSnapshot;
  readonly sourceBefore: LayoutContextSnapshot;
  readonly targetAfter: LayoutContextSnapshot;
  readonly targetBefore: LayoutContextSnapshot;
  readonly windowId: WindowId;
}

interface ColumnTransferPreviewState {
  readonly sourceAfter: LayoutContextSnapshot;
  readonly sourceBefore: LayoutContextSnapshot;
  readonly targetAfter: LayoutContextSnapshot;
  readonly targetBefore: LayoutContextSnapshot;
  readonly windowId: WindowId;
}

export class LayoutEngine {
  private readonly columnStackEditPreviews = new WeakMap<
    ColumnStackEditPreview,
    ColumnStackEditPreviewState
  >();
  private readonly columnTransferPreviews = new Map<
    ColumnTransferPreview,
    ColumnTransferPreviewState
  >();
  private readonly contexts = new Map<string, LayoutContext>();
  private readonly stackEditRollbacks = new Map<
    StackEditRollback,
    StackEditSnapshots
  >();
  private readonly windowAttachPreviews = new WeakMap<
    WindowAttachPreview,
    WindowAttachPreviewState
  >();
  private readonly windowDetachPreviews = new WeakMap<
    WindowDetachPreview,
    WindowDetachPreviewState
  >();
  private readonly windowTransferPreviews = new Map<
    WindowTransferPreview,
    WindowTransferPreviewState
  >();
  private readonly windowHeightEditRollbacks = new Map<
    WindowHeightEditRollback,
    WindowHeightEditSnapshots
  >();
  private readonly placements = new Map<WindowId, ManagedWindowPlacement>();

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
      presentation: command.presentation ?? "stacked",
      selectedWindowId: command.windowId,
      width: { ...command.width },
      windowIds: [command.windowId],
    };
    const activeIndex =
      context.activeColumnId === null
        ? -1
        : liveColumnIndex(context, context.activeColumnId);
    const insertionIndex =
      activeIndex < 0 ? context.columns.length : activeIndex + 1;

    context.columns.splice(insertionIndex, 0, column);
    context.columnById.set(column.id, column);
    context.columnIds.add(column.id);
    this.reindexColumnIndices(context, insertionIndex);
    this.placements.set(command.windowId, {
      columnId: column.id,
      contextKey: key,
      memberIndex: 0,
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

    const column = context.columnById.get(placement.columnId);

    if (!column || column.windowIds[placement.memberIndex] !== windowId) {
      return false;
    }

    const changed =
      context.activeColumnId !== placement.columnId ||
      column.selectedWindowId !== windowId;
    context.activeColumnId = placement.columnId;
    column.selectedWindowId = windowId;
    return changed;
  }

  setColumnPresentation(
    windowId: WindowId,
    presentation: ColumnPresentation,
  ): ColumnPresentation | null {
    const placement = this.placements.get(windowId);
    const context = placement
      ? this.contexts.get(placement.contextKey)
      : undefined;
    const column = placement
      ? context?.columnById.get(placement.columnId)
      : undefined;

    if (
      !placement ||
      !column ||
      column.windowIds[placement.memberIndex] !== windowId ||
      column.presentation === presentation
    ) {
      return null;
    }

    const previous = column.presentation;
    column.presentation = presentation;
    return previous;
  }

  toggleActiveColumnPresentation(
    windowId: WindowId,
  ): ColumnPresentation | null {
    const placement = this.placements.get(windowId);
    const context = placement
      ? this.contexts.get(placement.contextKey)
      : undefined;
    const column = placement
      ? context?.columnById.get(placement.columnId)
      : undefined;

    if (
      !placement ||
      !context ||
      !column ||
      context.activeColumnId !== column.id ||
      column.windowIds[placement.memberIndex] !== windowId
    ) {
      return null;
    }

    const next = column.presentation === "stacked" ? "tabbed" : "stacked";
    return this.setColumnPresentation(windowId, next) === null ? null : next;
  }

  selectWindowInColumn(windowId: WindowId): boolean {
    const placement = this.placements.get(windowId);
    const context = placement
      ? this.contexts.get(placement.contextKey)
      : undefined;
    const column = placement
      ? context?.columnById.get(placement.columnId)
      : undefined;

    if (
      !placement ||
      !column ||
      column.windowIds[placement.memberIndex] !== windowId ||
      column.selectedWindowId === windowId
    ) {
      return false;
    }

    column.selectedWindowId = windowId;
    return true;
  }

  tabIndicator(windowId: WindowId): TabIndicatorState | null {
    const placement = this.placements.get(windowId);
    const context = placement
      ? this.contexts.get(placement.contextKey)
      : undefined;
    const column = placement
      ? context?.columnById.get(placement.columnId)
      : undefined;

    if (
      !placement ||
      !column ||
      column.presentation !== "tabbed" ||
      column.windowIds.length < 2 ||
      column.selectedWindowId !== windowId ||
      column.windowIds[placement.memberIndex] !== windowId
    ) {
      return null;
    }

    return {
      selectedIndex: placement.memberIndex,
      tabCount: column.windowIds.length,
    };
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

    const columnIndex = liveColumnIndex(context, placement.columnId);

    if (columnIndex < 0) {
      return null;
    }

    const targetIndex =
      direction === "left" ? columnIndex - 1 : columnIndex + 1;
    return context.columns[targetIndex]?.selectedWindowId ?? null;
  }

  edgeWindow(windowId: WindowId, edge: HorizontalEdge): WindowId | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context) {
      return null;
    }

    const target =
      context.columns[edge === "first" ? 0 : context.columns.length - 1];

    if (!target || target.id === placement.columnId) {
      return null;
    }

    return target.selectedWindowId;
  }

  adjacentWindowInColumn(
    windowId: WindowId,
    direction: VerticalDirection,
  ): WindowId | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);
    const column = context?.columnById.get(placement.columnId);

    if (!column) {
      return null;
    }

    const windowIndex = placement.memberIndex;

    if (windowIndex < 0) {
      return null;
    }

    const targetIndex = direction === "up" ? windowIndex - 1 : windowIndex + 1;
    return column.windowIds[targetIndex] ?? null;
  }

  moveActiveWindow(
    windowId: WindowId,
    direction: HorizontalDirection,
    newColumnId: ColumnId,
    newColumnPresentation: ColumnPresentation = "stacked",
  ): StackEditResult | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const sourceIndex = liveColumnIndex(context, placement.columnId);
    const source = context.columns[sourceIndex];
    const windowIndex = placement.memberIndex;

    if (!source || source.windowIds[windowIndex] !== windowId) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);
    let kind: StackEditResult["kind"];

    if (source.windowIds.length === 1) {
      const targetIndex =
        direction === "left" ? sourceIndex - 1 : sourceIndex + 1;
      const target = context.columns[targetIndex];

      if (!target) {
        return null;
      }

      appendDefaultMutableWindowHeight(target);
      target.windowIds.push(windowId);
      target.selectedWindowId = windowId;
      context.columns.splice(sourceIndex, 1);
      context.columnById.delete(source.id);
      context.columnIds.delete(source.id);
      context.columnIndexById.delete(source.id);
      this.reindexColumnIndices(context, sourceIndex);
      this.placements.set(windowId, {
        columnId: target.id,
        contextKey: placement.contextKey,
        memberIndex: target.windowIds.length - 1,
      });
      context.activeColumnId = target.id;
      kind = "merge";
    } else {
      if (context.columnIds.has(newColumnId)) {
        return null;
      }

      removeMutableColumnWindow(source, windowIndex);
      this.reindexColumnPlacements(placement.contextKey, source, windowIndex);
      const column: LayoutColumn = {
        id: newColumnId,
        presentation: newColumnPresentation,
        selectedWindowId: windowId,
        width: { ...source.width },
        windowIds: [windowId],
      };
      const insertionIndex =
        direction === "left" ? sourceIndex : sourceIndex + 1;
      context.columns.splice(insertionIndex, 0, column);
      context.columnById.set(column.id, column);
      context.columnIds.add(column.id);
      this.reindexColumnIndices(context, insertionIndex);
      this.placements.set(windowId, {
        columnId: column.id,
        contextKey: placement.contextKey,
        memberIndex: 0,
      });
      context.activeColumnId = column.id;
      kind = "extract";
    }

    return this.createStackEditResult(
      kind,
      before,
      this.snapshot(context.outputId, context.desktopId),
    );
  }

  insertActiveWindowIntoColumn(
    windowId: WindowId,
    targetColumnId: ColumnId,
  ): StackEditResult | null {
    const placement = this.placements.get(windowId);

    if (!placement || placement.columnId === targetColumnId) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    let source: LayoutColumn | undefined;
    let sourceIndex = -1;
    let target: LayoutColumn | undefined;

    for (const [index, column] of context.columns.entries()) {
      if (column.id === placement.columnId) {
        source = column;
        sourceIndex = index;
      } else if (column.id === targetColumnId) {
        target = column;
      }
    }

    const windowIndex = placement.memberIndex;

    if (
      !source ||
      sourceIndex < 0 ||
      source.windowIds[windowIndex] !== windowId ||
      !target ||
      target.windowIds.length < 2
    ) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);
    const sourceDisappears = source.windowIds.length === 1;
    removeMutableColumnWindow(source, windowIndex);
    this.reindexColumnPlacements(placement.contextKey, source, windowIndex);
    appendDefaultMutableWindowHeight(target);
    target.windowIds.push(windowId);
    target.selectedWindowId = windowId;

    if (sourceDisappears) {
      context.columns.splice(sourceIndex, 1);
      context.columnById.delete(source.id);
      context.columnIds.delete(source.id);
      context.columnIndexById.delete(source.id);
      this.reindexColumnIndices(context, sourceIndex);
    }

    this.placements.set(windowId, {
      columnId: target.id,
      contextKey: placement.contextKey,
      memberIndex: target.windowIds.length - 1,
    });
    context.activeColumnId = target.id;
    return this.createStackEditResult(
      sourceDisappears ? "merge" : "insert",
      before,
      this.snapshot(context.outputId, context.desktopId),
    );
  }

  previewConsumeWindowIntoColumn(
    activeWindowId: WindowId,
  ): ColumnStackEditPreview | null {
    const placement = this.placements.get(activeWindowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const targetIndex = liveColumnIndex(context, placement.columnId);
    const target = context.columns[targetIndex];
    const source = context.columns[targetIndex + 1];
    const movedWindowId = source?.windowIds[0];

    if (
      targetIndex < 0 ||
      !target ||
      !source ||
      !movedWindowId ||
      !target.windowIds.includes(activeWindowId)
    ) {
      return null;
    }

    const before = immutableContextSnapshot(
      this.snapshot(context.outputId, context.desktopId),
    );
    const columns = before.columns.map(cloneColumnSnapshot);
    const nextTarget = columns[targetIndex];
    const nextSource = columns[targetIndex + 1];

    if (!nextTarget || !nextSource) {
      return null;
    }

    const targetWindowHeights = appendedDefaultSnapshotWindowHeight(nextTarget);
    const sourceWindowHeights = withoutSnapshotWindowHeight(nextSource, 0);
    columns[targetIndex] = {
      id: nextTarget.id,
      presentation: nextTarget.presentation,
      selectedWindowId: nextTarget.selectedWindowId,
      width: nextTarget.width,
      ...(targetWindowHeights ? { windowHeights: targetWindowHeights } : {}),
      windowIds: [...nextTarget.windowIds, movedWindowId],
    };

    if (nextSource.windowIds.length === 1) {
      columns.splice(targetIndex + 1, 1);
    } else {
      columns[targetIndex + 1] = {
        id: nextSource.id,
        presentation: nextSource.presentation,
        selectedWindowId: selectedWindowAfterSnapshotRemoval(nextSource, 0),
        width: nextSource.width,
        ...(sourceWindowHeights ? { windowHeights: sourceWindowHeights } : {}),
        windowIds: nextSource.windowIds.slice(1),
      };
    }

    return this.createColumnStackEditPreview(
      "consume",
      movedWindowId,
      before,
      immutableContextSnapshot({ ...before, columns }),
    );
  }

  previewExpelWindowFromColumn(
    activeWindowId: WindowId,
    newColumnId: ColumnId,
    newColumnPresentation: ColumnPresentation = "stacked",
  ): ColumnStackEditPreview | null {
    const placement = this.placements.get(activeWindowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (
      !context ||
      context.activeColumnId !== placement.columnId ||
      context.columnIds.has(newColumnId)
    ) {
      return null;
    }

    const sourceIndex = liveColumnIndex(context, placement.columnId);
    const source = context.columns[sourceIndex];
    const movedWindowId = source?.windowIds[source.windowIds.length - 1];

    if (
      sourceIndex < 0 ||
      !source ||
      source.windowIds.length < 2 ||
      !movedWindowId ||
      !source.windowIds.includes(activeWindowId)
    ) {
      return null;
    }

    const before = immutableContextSnapshot(
      this.snapshot(context.outputId, context.desktopId),
    );
    const columns = before.columns.map(cloneColumnSnapshot);
    const nextSource = columns[sourceIndex];

    if (!nextSource) {
      return null;
    }

    const sourceWindowHeights = withoutSnapshotWindowHeight(
      nextSource,
      nextSource.windowIds.length - 1,
    );
    columns[sourceIndex] = {
      id: nextSource.id,
      presentation: nextSource.presentation,
      selectedWindowId: selectedWindowAfterSnapshotRemoval(
        nextSource,
        nextSource.windowIds.length - 1,
      ),
      width: nextSource.width,
      ...(sourceWindowHeights ? { windowHeights: sourceWindowHeights } : {}),
      windowIds: nextSource.windowIds.slice(0, -1),
    };
    columns.splice(sourceIndex + 1, 0, {
      id: newColumnId,
      presentation: newColumnPresentation,
      selectedWindowId: movedWindowId,
      width: nextSource.width,
      windowIds: [movedWindowId],
    });

    return this.createColumnStackEditPreview(
      "expel",
      movedWindowId,
      before,
      immutableContextSnapshot({ ...before, columns }),
    );
  }

  applyColumnStackEdit(
    preview: ColumnStackEditPreview,
  ): StackEditResult | null {
    const state = this.columnStackEditPreviews.get(preview);

    if (!state) {
      return null;
    }

    this.columnStackEditPreviews.delete(preview);

    if (
      !sameContextSnapshot(
        this.snapshot(state.before.outputId, state.before.desktopId),
        state.before,
      ) ||
      !sameWindowSet(state.before, state.after) ||
      !validContextSnapshot(state.after) ||
      !this.placementsMatchSnapshot(state.before)
    ) {
      return null;
    }

    this.replaceContext(state.after);
    return this.createStackEditResult(preview.kind, state.before, state.after);
  }

  commitColumnStackEdit(preview: ColumnStackEditPreview): boolean {
    const edit = this.applyColumnStackEdit(preview);

    if (!edit) {
      return false;
    }

    this.discardStackEditRollback(edit.rollback);
    return true;
  }

  discardColumnStackEdit(preview: ColumnStackEditPreview): boolean {
    return this.columnStackEditPreviews.delete(preview);
  }

  moveActiveWindowInColumn(
    windowId: WindowId,
    direction: VerticalDirection,
  ): StackEditResult | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const column = context.columnById.get(placement.columnId);

    if (!column) {
      return null;
    }

    const windowIndex = placement.memberIndex;
    const targetIndex = direction === "up" ? windowIndex - 1 : windowIndex + 1;
    const target = column.windowIds[targetIndex];

    if (windowIndex < 0 || !target) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);
    swapMutableColumnWindowHeights(column, windowIndex, targetIndex);
    column.windowIds[windowIndex] = target;
    column.windowIds[targetIndex] = windowId;
    column.selectedWindowId = windowId;
    this.reindexColumnPlacements(
      placement.contextKey,
      column,
      Math.min(windowIndex, targetIndex),
    );
    return this.createStackEditResult(
      "reorder",
      before,
      this.snapshot(context.outputId, context.desktopId),
    );
  }

  reinsertWindow(
    windowId: WindowId,
    target: WindowReinsertionTarget,
  ): StackEditResult | null {
    if (
      !validWindowReinsertionTarget(target) ||
      target.targetWindowId === windowId
    ) {
      return null;
    }

    const placement = this.placements.get(windowId);
    const targetPlacement = this.placements.get(target.targetWindowId);

    if (
      !placement ||
      !targetPlacement ||
      placement.contextKey !== targetPlacement.contextKey
    ) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);

    if (
      !validContextSnapshot(before) ||
      !this.placementsMatchSnapshot(before)
    ) {
      return null;
    }

    const reinsertion = previewWindowReinsertion(before, windowId, target);

    if (
      !reinsertion ||
      !validContextSnapshot(reinsertion.after) ||
      !sameWindowSet(before, reinsertion.after) ||
      sameContextSnapshot(before, reinsertion.after)
    ) {
      return null;
    }

    this.replaceContext(reinsertion.after);
    return this.createStackEditResult(
      reinsertion.kind,
      before,
      reinsertion.after,
    );
  }

  reinsertWindowAtColumnBoundary(
    windowId: WindowId,
    target: ColumnReinsertionTarget,
    newColumnId: ColumnId,
    newColumnPresentation: ColumnPresentation = "stacked",
  ): StackEditResult | null {
    if (!validColumnReinsertionTarget(target)) {
      return null;
    }

    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);

    if (
      !validContextSnapshot(before) ||
      !this.placementsMatchSnapshot(before)
    ) {
      return null;
    }

    const source = before.columns.find(
      (column) => column.id === placement.columnId,
    );

    if (
      !source ||
      source.windowIds[placement.memberIndex] !== windowId ||
      (source.windowIds.length > 1 &&
        (typeof newColumnId !== "string" ||
          context.columnIds.has(newColumnId) ||
          !validColumnPresentation(newColumnPresentation)))
    ) {
      return null;
    }

    const reinsertion = previewColumnBoundaryReinsertion(
      before,
      windowId,
      target,
      newColumnId,
      newColumnPresentation,
    );

    if (
      !reinsertion ||
      !validContextSnapshot(reinsertion.after) ||
      !sameWindowSet(before, reinsertion.after) ||
      sameContextSnapshot(before, reinsertion.after)
    ) {
      return null;
    }

    this.replaceContext(reinsertion.after);
    return this.createStackEditResult(
      reinsertion.kind,
      before,
      reinsertion.after,
    );
  }

  rollbackStackEdit(rollback: StackEditRollback): boolean {
    const snapshots = this.stackEditRollbacks.get(rollback);

    if (!snapshots) {
      return false;
    }

    this.stackEditRollbacks.delete(rollback);
    const { after, before } = snapshots;
    const current = this.snapshot(after.outputId, after.desktopId);
    const removedWindowIds = contextRemovedWindowIds(after, current);

    if (removedWindowIds === null || !sameWindowSet(before, after)) {
      return false;
    }

    const rollbackAfter =
      removedWindowIds.size === 0
        ? after
        : contextWithoutWindows(after, removedWindowIds);
    const rollbackBefore =
      removedWindowIds.size === 0
        ? before
        : contextWithoutWindows(before, removedWindowIds);

    if (
      before.outputId !== after.outputId ||
      before.desktopId !== after.desktopId ||
      !sameRollbackContextColumns(current, rollbackAfter) ||
      !sameWindowSet(rollbackBefore, rollbackAfter)
    ) {
      return false;
    }

    const context = this.contexts.get(
      contextKey(before.outputId, before.desktopId),
    );

    if (!context || !validContextSnapshot(rollbackBefore)) {
      return false;
    }

    context.columns.length = 0;
    context.columnById.clear();
    context.columnIds.clear();
    context.columnIndexById.clear();
    const currentColumns = new Map(
      current.columns.map((column) => [column.id, column] as const),
    );
    const afterColumns = new Map(
      rollbackAfter.columns.map((column) => [column.id, column] as const),
    );
    const key = contextKey(context.outputId, context.desktopId);

    for (const snapshot of rollbackBefore.columns) {
      const currentColumn = currentColumns.get(snapshot.id);
      const afterColumn = afterColumns.get(snapshot.id);
      const selectedWindowId =
        currentColumn &&
        afterColumn &&
        currentColumn.selectedWindowId !== afterColumn.selectedWindowId &&
        snapshot.windowIds.includes(currentColumn.selectedWindowId)
          ? currentColumn.selectedWindowId
          : snapshot.selectedWindowId;
      const column: LayoutColumn = {
        id: snapshot.id,
        presentation: snapshot.presentation,
        selectedWindowId,
        width: { ...snapshot.width },
        ...(snapshot.windowHeights
          ? { windowHeights: snapshot.windowHeights.map(cloneWindowHeight) }
          : {}),
        windowIds: [...snapshot.windowIds],
      };
      context.columns.push(column);
      context.columnById.set(column.id, column);
      context.columnIds.add(column.id);

      for (const [memberIndex, id] of column.windowIds.entries()) {
        this.placements.set(id, {
          columnId: column.id,
          contextKey: key,
          memberIndex,
        });
      }
    }

    this.reindexColumnIndices(context);

    const afterActiveColumnSurvived = rollbackAfter.columns.some(
      (column) => column.id === after.activeColumnId,
    );
    const activeColumnChanged =
      current.activeColumnId !== after.activeColumnId ||
      !afterActiveColumnSurvived;
    context.activeColumnId =
      activeColumnChanged &&
      (current.activeColumnId === null ||
        rollbackBefore.columns.some(
          (column) => column.id === current.activeColumnId,
        ))
        ? current.activeColumnId
        : rollbackBefore.activeColumnId;
    context.viewportOffset = rollbackBefore.viewportOffset;
    return true;
  }

  discardStackEditRollback(rollback: StackEditRollback): boolean {
    return this.stackEditRollbacks.delete(rollback);
  }

  moveActiveColumn(
    windowId: WindowId,
    direction: HorizontalDirection,
  ): boolean {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return false;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return false;
    }

    const columnIndex = liveColumnIndex(context, placement.columnId);
    const targetIndex =
      direction === "left" ? columnIndex - 1 : columnIndex + 1;
    const column = context.columns[columnIndex];
    const target = context.columns[targetIndex];

    if (columnIndex < 0 || !column || !target) {
      return false;
    }

    context.columns[columnIndex] = target;
    context.columns[targetIndex] = column;
    context.columnIndexById.set(column.id, targetIndex);
    context.columnIndexById.set(target.id, columnIndex);
    return true;
  }

  moveActiveColumnToEdge(
    windowId: WindowId,
    edge: HorizontalEdge,
  ): StackEditResult | null {
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const columnIndex = liveColumnIndex(context, placement.columnId);
    const targetIndex = edge === "first" ? 0 : context.columns.length - 1;

    if (columnIndex < 0 || columnIndex === targetIndex) {
      return null;
    }

    const before = this.snapshot(context.outputId, context.desktopId);
    const [column] = context.columns.splice(columnIndex, 1);

    if (!column) {
      return null;
    }

    context.columns.splice(targetIndex, 0, column);
    this.reindexColumnIndices(context, Math.min(columnIndex, targetIndex));
    return this.createStackEditResult(
      "reorder",
      before,
      this.snapshot(context.outputId, context.desktopId),
    );
  }

  setActiveColumnWidth(
    windowId: WindowId,
    width: ColumnWidth,
  ): ColumnWidth | null {
    assertValidWidth(width);
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const columnIndex = liveColumnIndex(context, placement.columnId);
    const column = context.columns[columnIndex];

    if (
      !column ||
      (column.width.kind === width.kind && column.width.value === width.value)
    ) {
      return null;
    }

    const previous = { ...column.width };
    const replacement = { ...column, width: { ...width } };
    context.columns[columnIndex] = replacement;
    context.columnById.set(replacement.id, replacement);
    return previous;
  }

  setActiveColumnWindowHeights(
    windowId: WindowId,
    heights: readonly WindowHeight[],
  ): WindowHeightEditResult | null {
    assertValidWindowHeights(heights);
    const placement = this.placements.get(windowId);

    if (!placement) {
      return null;
    }

    const context = this.contexts.get(placement.contextKey);

    if (!context || context.activeColumnId !== placement.columnId) {
      return null;
    }

    const column = context.columnById.get(placement.columnId);

    if (
      !column ||
      column.presentation === "tabbed" ||
      heights.length !== column.windowIds.length
    ) {
      return null;
    }

    const current = column.windowHeights
      ? column.windowHeights
      : column.windowIds.map(() => automaticWindowHeight());

    if (
      current.every((height, index) => {
        const candidate = heights[index];
        return candidate !== undefined && sameWindowHeight(height, candidate);
      })
    ) {
      return null;
    }

    const before = immutableContextSnapshot(
      this.snapshot(context.outputId, context.desktopId),
    );
    setMutableColumnWindowHeights(column, heights);
    const after = immutableContextSnapshot(
      this.snapshot(context.outputId, context.desktopId),
    );
    const rollback = {} as WindowHeightEditRollback;
    this.windowHeightEditRollbacks.set(rollback, { after, before });
    return { rollback };
  }

  rollbackWindowHeightEdit(rollback: WindowHeightEditRollback): boolean {
    const snapshots = this.windowHeightEditRollbacks.get(rollback);

    if (!snapshots) {
      return false;
    }

    this.windowHeightEditRollbacks.delete(rollback);
    const { after, before } = snapshots;

    if (
      !sameContextSnapshot(
        this.snapshot(after.outputId, after.desktopId),
        after,
      ) ||
      !sameWindowSet(before, after) ||
      !validContextSnapshot(before)
    ) {
      return false;
    }

    this.replaceContext(before);
    return true;
  }

  discardWindowHeightEditRollback(rollback: WindowHeightEditRollback): boolean {
    return this.windowHeightEditRollbacks.delete(rollback);
  }

  previewColumnTransfer(
    windowId: WindowId,
    target: ColumnTransferTarget,
  ): ColumnTransferPreview | null {
    if (!validColumnTransferTarget(target)) {
      return null;
    }

    const managedPlacement = this.placements.get(windowId);

    if (!managedPlacement) {
      return null;
    }

    const source = this.contexts.get(managedPlacement.contextKey);
    const targetKey = contextKey(target.outputId, target.desktopId);

    if (
      !source ||
      managedPlacement.contextKey === targetKey ||
      source.activeColumnId !== managedPlacement.columnId
    ) {
      return null;
    }

    const sourceColumnIndex = liveColumnIndex(
      source,
      managedPlacement.columnId,
    );
    const sourceColumn = source.columns[sourceColumnIndex];

    if (!sourceColumn || !sourceColumn.windowIds.includes(windowId)) {
      return null;
    }

    const sourceBefore = immutableContextSnapshot(
      this.snapshot(source.outputId, source.desktopId),
    );
    const transferredColumn = sourceBefore.columns[sourceColumnIndex];
    const targetBefore = immutableContextSnapshot(
      this.snapshot(target.outputId, target.desktopId),
    );

    if (!transferredColumn) {
      return null;
    }

    const transferredWindowIds = new Set(transferredColumn.windowIds);
    let targetActiveIndex = -1;

    for (const [index, column] of targetBefore.columns.entries()) {
      if (
        column.id === target.columnId ||
        column.windowIds.some((id) => transferredWindowIds.has(id))
      ) {
        return null;
      }

      if (column.id === targetBefore.activeColumnId) {
        targetActiveIndex = index;
      }
    }

    if (targetBefore.columns.length > 0 && targetActiveIndex < 0) {
      return null;
    }

    const sourceColumns = sourceBefore.columns.filter(
      (_column, index) => index !== sourceColumnIndex,
    );
    const sourceAfter = immutableContextSnapshot({
      activeColumnId:
        sourceBefore.columns[sourceColumnIndex + 1]?.id ??
        sourceBefore.columns[sourceColumnIndex - 1]?.id ??
        null,
      columns: sourceColumns,
      desktopId: sourceBefore.desktopId,
      outputId: sourceBefore.outputId,
      viewportOffset:
        sourceColumns.length === 0 ? 0 : sourceBefore.viewportOffset,
    });
    const targetColumns = [...targetBefore.columns];
    const targetInsertionIndex =
      targetActiveIndex < 0 ? targetColumns.length : targetActiveIndex + 1;
    targetColumns.splice(targetInsertionIndex, 0, {
      id: target.columnId,
      presentation: transferredColumn.presentation,
      selectedWindowId: transferredColumn.selectedWindowId,
      width: transferredColumn.width,
      ...(transferredColumn.windowHeights
        ? {
            windowHeights:
              transferredColumn.windowHeights.map(cloneWindowHeight),
          }
        : {}),
      windowIds: transferredColumn.windowIds,
    });
    const targetAfter = immutableContextSnapshot({
      activeColumnId: target.columnId,
      columns: targetColumns,
      desktopId: targetBefore.desktopId,
      outputId: targetBefore.outputId,
      viewportOffset: targetBefore.viewportOffset,
    });
    const preview = Object.freeze({
      sourceLayout: sourceAfter,
      targetLayout: targetAfter,
    }) as ColumnTransferPreview;
    this.columnTransferPreviews.set(preview, {
      sourceAfter,
      sourceBefore,
      targetAfter,
      targetBefore,
      windowId,
    });
    return preview;
  }

  commitColumnTransfer(preview: ColumnTransferPreview): boolean {
    const state = this.columnTransferPreviews.get(preview);

    if (!state) {
      return false;
    }

    this.columnTransferPreviews.delete(preview);
    const sourceKey = contextKey(
      state.sourceBefore.outputId,
      state.sourceBefore.desktopId,
    );
    const targetKey = contextKey(
      state.targetBefore.outputId,
      state.targetBefore.desktopId,
    );

    if (
      sourceKey === targetKey ||
      this.placements.get(state.windowId)?.contextKey !== sourceKey ||
      !sameContextSnapshot(
        this.snapshot(
          state.sourceBefore.outputId,
          state.sourceBefore.desktopId,
        ),
        state.sourceBefore,
      ) ||
      !sameContextSnapshot(
        this.snapshot(
          state.targetBefore.outputId,
          state.targetBefore.desktopId,
        ),
        state.targetBefore,
      ) ||
      !sameWindowSetAcrossContexts(
        state.sourceBefore,
        state.targetBefore,
        state.sourceAfter,
        state.targetAfter,
      ) ||
      !validTransferContextSnapshot(state.sourceAfter) ||
      !validTransferContextSnapshot(state.targetAfter) ||
      !this.placementsMatchSnapshot(state.sourceBefore) ||
      !this.placementsMatchSnapshot(state.targetBefore)
    ) {
      return false;
    }

    this.replaceContext(state.sourceAfter);
    this.replaceContext(state.targetAfter);
    return true;
  }

  discardColumnTransfer(preview: ColumnTransferPreview): boolean {
    return this.columnTransferPreviews.delete(preview);
  }

  previewWindowTransfer(
    windowId: WindowId,
    target: WindowTransferTarget,
  ): WindowTransferPreview | null {
    if (!validWindowTransferTarget(target)) {
      return null;
    }

    const managedPlacement = this.placements.get(windowId);

    if (!managedPlacement) {
      return null;
    }

    const source = this.contexts.get(managedPlacement.contextKey);
    const targetKey = contextKey(target.outputId, target.desktopId);

    if (
      !source ||
      managedPlacement.contextKey === targetKey ||
      source.activeColumnId !== managedPlacement.columnId
    ) {
      return null;
    }

    const sourceColumnIndex = liveColumnIndex(
      source,
      managedPlacement.columnId,
    );
    const sourceColumn = source.columns[sourceColumnIndex];
    const sourceMemberIndex = sourceColumn?.windowIds.indexOf(windowId) ?? -1;

    if (!sourceColumn || sourceMemberIndex < 0) {
      return null;
    }

    const sourceBefore = immutableContextSnapshot(
      this.snapshot(source.outputId, source.desktopId),
    );
    const targetBefore = immutableContextSnapshot(
      this.snapshot(target.outputId, target.desktopId),
    );
    let targetActiveIndex = -1;

    for (const [index, column] of targetBefore.columns.entries()) {
      if (
        column.id === target.columnId ||
        column.windowIds.includes(windowId)
      ) {
        return null;
      }

      if (column.id === targetBefore.activeColumnId) {
        targetActiveIndex = index;
      }
    }

    if (targetBefore.activeColumnId !== null && targetActiveIndex < 0) {
      return null;
    }

    const sourceColumns: LayoutColumnSnapshot[] = [];

    for (const [index, column] of sourceBefore.columns.entries()) {
      if (index !== sourceColumnIndex) {
        sourceColumns.push(column);
        continue;
      }

      const windowIds = column.windowIds.filter((id) => id !== windowId);

      if (windowIds.length > 0) {
        const windowHeights = withoutSnapshotWindowHeight(
          column,
          sourceMemberIndex,
        );
        sourceColumns.push({
          id: column.id,
          presentation: column.presentation,
          selectedWindowId: selectedWindowAfterSnapshotRemoval(
            column,
            sourceMemberIndex,
          ),
          width: column.width,
          ...(windowHeights ? { windowHeights } : {}),
          windowIds,
        });
      }
    }

    const sourceColumnRemoved = sourceColumn.windowIds.length === 1;
    const sourceAfter = immutableContextSnapshot({
      activeColumnId: sourceColumnRemoved
        ? (source.columns[sourceColumnIndex + 1]?.id ??
          source.columns[sourceColumnIndex - 1]?.id ??
          null)
        : sourceBefore.activeColumnId,
      columns: sourceColumns,
      desktopId: sourceBefore.desktopId,
      outputId: sourceBefore.outputId,
      viewportOffset:
        sourceColumns.length === 0 ? 0 : sourceBefore.viewportOffset,
    });
    const targetColumns = [...targetBefore.columns];
    const targetInsertionIndex =
      targetActiveIndex < 0 ? targetColumns.length : targetActiveIndex + 1;
    targetColumns.splice(targetInsertionIndex, 0, {
      id: target.columnId,
      presentation: target.presentation ?? "stacked",
      selectedWindowId: windowId,
      width: sourceColumn.width,
      windowIds: [windowId],
    });
    const targetAfter = immutableContextSnapshot({
      activeColumnId: target.columnId,
      columns: targetColumns,
      desktopId: targetBefore.desktopId,
      outputId: targetBefore.outputId,
      viewportOffset: targetBefore.viewportOffset,
    });
    return this.createWindowTransferPreview(
      windowId,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    );
  }

  previewWindowTransferToWindow(
    windowId: WindowId,
    target: WindowTransferInsertionTarget,
  ): WindowTransferPreview | null {
    if (
      !validWindowTransferInsertionTarget(target) ||
      target.targetWindowId === windowId
    ) {
      return null;
    }

    const sourcePlacement = this.placements.get(windowId);
    const targetPlacement = this.placements.get(target.targetWindowId);
    const targetKey = contextKey(target.outputId, target.desktopId);

    if (
      !sourcePlacement ||
      !targetPlacement ||
      sourcePlacement.contextKey === targetKey ||
      targetPlacement.contextKey !== targetKey
    ) {
      return null;
    }

    const source = this.contexts.get(sourcePlacement.contextKey);
    const destination = this.contexts.get(targetKey);

    if (
      !source ||
      !destination ||
      source.activeColumnId !== sourcePlacement.columnId
    ) {
      return null;
    }

    const sourceBefore = immutableContextSnapshot(
      this.snapshot(source.outputId, source.desktopId),
    );
    const targetBefore = immutableContextSnapshot(
      this.snapshot(destination.outputId, destination.desktopId),
    );
    const sourceColumnIndex = sourceBefore.columns.findIndex(
      (column) => column.id === sourcePlacement.columnId,
    );
    const sourceColumn = sourceBefore.columns[sourceColumnIndex];
    const sourceMemberIndex = sourceColumn?.windowIds.indexOf(windowId) ?? -1;
    const targetColumnIndex = targetBefore.columns.findIndex(
      (column) => column.id === targetPlacement.columnId,
    );
    const targetColumn = targetBefore.columns[targetColumnIndex];
    const targetMemberIndex =
      targetColumn?.windowIds.indexOf(target.targetWindowId) ?? -1;

    if (
      sourceMemberIndex < 0 ||
      targetMemberIndex < 0 ||
      !sourceColumn ||
      !targetColumn ||
      !validContextSnapshot(sourceBefore) ||
      !validContextSnapshot(targetBefore) ||
      !this.placementsMatchSnapshot(sourceBefore) ||
      !this.placementsMatchSnapshot(targetBefore)
    ) {
      return null;
    }

    const sourceColumns: LayoutColumnSnapshot[] = [];

    for (const [index, column] of sourceBefore.columns.entries()) {
      if (index !== sourceColumnIndex) {
        sourceColumns.push(column);
        continue;
      }

      const windowIds = [...column.windowIds];
      windowIds.splice(sourceMemberIndex, 1);

      if (windowIds.length === 0) {
        continue;
      }

      const windowHeights = withoutSnapshotWindowHeight(
        column,
        sourceMemberIndex,
      );
      sourceColumns.push({
        id: column.id,
        presentation: column.presentation,
        selectedWindowId: selectedWindowAfterSnapshotRemoval(
          column,
          sourceMemberIndex,
        ),
        width: column.width,
        ...(windowHeights ? { windowHeights } : {}),
        windowIds,
      });
    }

    const sourceColumnRemoved = sourceColumn.windowIds.length === 1;
    const sourceAfter = immutableContextSnapshot({
      activeColumnId: sourceColumnRemoved
        ? (sourceBefore.columns[sourceColumnIndex + 1]?.id ??
          sourceBefore.columns[sourceColumnIndex - 1]?.id ??
          null)
        : sourceBefore.activeColumnId,
      columns: sourceColumns,
      desktopId: sourceBefore.desktopId,
      outputId: sourceBefore.outputId,
      viewportOffset:
        sourceColumns.length === 0 ? 0 : sourceBefore.viewportOffset,
    });
    const targetWindowIds = [...targetColumn.windowIds];
    const targetInsertionIndex =
      targetMemberIndex + (target.position === "after" ? 1 : 0);
    targetWindowIds.splice(targetInsertionIndex, 0, windowId);
    const targetWindowHeights =
      columnWindowHeights(targetColumn).map(cloneWindowHeight);
    targetWindowHeights.splice(
      targetInsertionIndex,
      0,
      automaticWindowHeight(),
    );
    const compactTargetWindowHeights =
      compactWindowHeights(targetWindowHeights);
    const targetColumns = targetBefore.columns.map((column, index) =>
      index === targetColumnIndex
        ? {
            id: column.id,
            presentation: column.presentation,
            selectedWindowId: windowId,
            width: column.width,
            ...(compactTargetWindowHeights
              ? { windowHeights: compactTargetWindowHeights }
              : {}),
            windowIds: targetWindowIds,
          }
        : column,
    );
    const targetAfter = immutableContextSnapshot({
      activeColumnId: targetColumn.id,
      columns: targetColumns,
      desktopId: targetBefore.desktopId,
      outputId: targetBefore.outputId,
      viewportOffset: targetBefore.viewportOffset,
    });

    if (
      !validTransferContextSnapshot(sourceAfter) ||
      !validContextSnapshot(targetAfter) ||
      !sameWindowSetAcrossContexts(
        sourceBefore,
        targetBefore,
        sourceAfter,
        targetAfter,
      )
    ) {
      return null;
    }

    return this.createWindowTransferPreview(
      windowId,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    );
  }

  previewWindowTransferToColumnBoundary(
    windowId: WindowId,
    target: WindowTransferColumnInsertionTarget,
  ): WindowTransferPreview | null {
    if (!validWindowTransferColumnInsertionTarget(target)) {
      return null;
    }

    const sourcePlacement = this.placements.get(windowId);
    const targetKey = contextKey(target.outputId, target.desktopId);

    if (!sourcePlacement || sourcePlacement.contextKey === targetKey) {
      return null;
    }

    const source = this.contexts.get(sourcePlacement.contextKey);
    const destination = this.contexts.get(targetKey);

    if (
      !source ||
      !destination ||
      source.activeColumnId !== sourcePlacement.columnId
    ) {
      return null;
    }

    const sourceBefore = immutableContextSnapshot(
      this.snapshot(source.outputId, source.desktopId),
    );
    const targetBefore = immutableContextSnapshot(
      this.snapshot(destination.outputId, destination.desktopId),
    );
    const sourceColumnIndex = sourceBefore.columns.findIndex(
      (column) => column.id === sourcePlacement.columnId,
    );
    const sourceColumn = sourceBefore.columns[sourceColumnIndex];
    const sourceMemberIndex = sourceColumn?.windowIds.indexOf(windowId) ?? -1;
    const targetColumnIndex = targetBefore.columns.findIndex(
      (column) => column.id === target.targetColumnId,
    );

    if (
      sourceMemberIndex < 0 ||
      targetColumnIndex < 0 ||
      !sourceColumn ||
      targetBefore.columns.some(
        (column) =>
          column.id === target.columnId || column.windowIds.includes(windowId),
      ) ||
      !validContextSnapshot(sourceBefore) ||
      !validContextSnapshot(targetBefore) ||
      !this.placementsMatchSnapshot(sourceBefore) ||
      !this.placementsMatchSnapshot(targetBefore)
    ) {
      return null;
    }

    const sourceColumns: LayoutColumnSnapshot[] = [];

    for (const [index, column] of sourceBefore.columns.entries()) {
      if (index !== sourceColumnIndex) {
        sourceColumns.push(column);
        continue;
      }

      const windowIds = [...column.windowIds];
      windowIds.splice(sourceMemberIndex, 1);

      if (windowIds.length === 0) {
        continue;
      }

      const windowHeights = withoutSnapshotWindowHeight(
        column,
        sourceMemberIndex,
      );
      sourceColumns.push({
        id: column.id,
        presentation: column.presentation,
        selectedWindowId: selectedWindowAfterSnapshotRemoval(
          column,
          sourceMemberIndex,
        ),
        width: column.width,
        ...(windowHeights ? { windowHeights } : {}),
        windowIds,
      });
    }

    const sourceColumnRemoved = sourceColumn.windowIds.length === 1;
    const sourceAfter = immutableContextSnapshot({
      activeColumnId: sourceColumnRemoved
        ? (sourceBefore.columns[sourceColumnIndex + 1]?.id ??
          sourceBefore.columns[sourceColumnIndex - 1]?.id ??
          null)
        : sourceBefore.activeColumnId,
      columns: sourceColumns,
      desktopId: sourceBefore.desktopId,
      outputId: sourceBefore.outputId,
      viewportOffset:
        sourceColumns.length === 0 ? 0 : sourceBefore.viewportOffset,
    });
    const targetColumns = [...targetBefore.columns];
    const targetInsertionIndex =
      targetColumnIndex + (target.position === "after" ? 1 : 0);
    targetColumns.splice(targetInsertionIndex, 0, {
      id: target.columnId,
      presentation: target.presentation ?? "stacked",
      selectedWindowId: windowId,
      width: sourceColumn.width,
      windowIds: [windowId],
    });
    const targetAfter = immutableContextSnapshot({
      activeColumnId: target.columnId,
      columns: targetColumns,
      desktopId: targetBefore.desktopId,
      outputId: targetBefore.outputId,
      viewportOffset: targetBefore.viewportOffset,
    });

    if (
      !validTransferContextSnapshot(sourceAfter) ||
      !validContextSnapshot(targetAfter) ||
      !sameWindowSetAcrossContexts(
        sourceBefore,
        targetBefore,
        sourceAfter,
        targetAfter,
      )
    ) {
      return null;
    }

    return this.createWindowTransferPreview(
      windowId,
      sourceBefore,
      sourceAfter,
      targetBefore,
      targetAfter,
    );
  }

  commitWindowTransfer(preview: WindowTransferPreview): boolean {
    const state = this.windowTransferPreviews.get(preview);

    if (!state) {
      return false;
    }

    this.windowTransferPreviews.delete(preview);
    const sourceKey = contextKey(
      state.sourceBefore.outputId,
      state.sourceBefore.desktopId,
    );
    const targetKey = contextKey(
      state.targetBefore.outputId,
      state.targetBefore.desktopId,
    );

    if (
      sourceKey === targetKey ||
      this.placements.get(state.windowId)?.contextKey !== sourceKey ||
      !sameContextSnapshot(
        this.snapshot(
          state.sourceBefore.outputId,
          state.sourceBefore.desktopId,
        ),
        state.sourceBefore,
      ) ||
      !sameContextSnapshot(
        this.snapshot(
          state.targetBefore.outputId,
          state.targetBefore.desktopId,
        ),
        state.targetBefore,
      ) ||
      !sameWindowSetAcrossContexts(
        state.sourceBefore,
        state.targetBefore,
        state.sourceAfter,
        state.targetAfter,
      ) ||
      !validTransferContextSnapshot(state.sourceAfter) ||
      !validTransferContextSnapshot(state.targetAfter) ||
      !this.placementsMatchSnapshot(state.sourceBefore) ||
      !this.placementsMatchSnapshot(state.targetBefore)
    ) {
      return false;
    }

    this.replaceContext(state.sourceAfter);
    this.replaceContext(state.targetAfter);
    return true;
  }

  discardWindowTransfer(preview: WindowTransferPreview): boolean {
    return this.windowTransferPreviews.delete(preview);
  }

  previewWindowDetach(windowId: WindowId): WindowDetachPreview | null {
    const managedPlacement = this.placements.get(windowId);

    if (!managedPlacement) {
      return null;
    }

    const context = this.contexts.get(managedPlacement.contextKey);

    if (!context) {
      return null;
    }

    const columnIndex = liveColumnIndex(context, managedPlacement.columnId);
    const column = context.columns[columnIndex];
    const memberIndex = managedPlacement.memberIndex;

    if (!column || column.windowIds[memberIndex] !== windowId) {
      return null;
    }

    const before = immutableContextSnapshot(
      this.snapshot(context.outputId, context.desktopId),
    );
    const detachedHeight = column.windowHeights?.[memberIndex];
    const placement = immutableDetachedWindowPlacement({
      columnId: column.id,
      columnIndex,
      columnPresentation: column.presentation,
      columnWidth: column.width,
      desktopId: context.desktopId,
      memberIndex,
      nextColumnId: context.columns[columnIndex + 1]?.id ?? null,
      nextWindowId: column.windowIds[memberIndex + 1] ?? null,
      outputId: context.outputId,
      previousColumnId: context.columns[columnIndex - 1]?.id ?? null,
      previousWindowId: column.windowIds[memberIndex - 1] ?? null,
      ...(detachedHeight && !isDefaultWindowHeight(detachedHeight)
        ? { windowHeight: cloneWindowHeight(detachedHeight) }
        : {}),
      windowId,
    });
    const columns: LayoutColumnSnapshot[] = [];

    for (const candidate of before.columns) {
      if (candidate.id !== column.id) {
        columns.push(candidate);
        continue;
      }

      const windowIds = candidate.windowIds.filter((id) => id !== windowId);

      if (windowIds.length > 0) {
        const windowHeights = withoutSnapshotWindowHeight(
          candidate,
          memberIndex,
          false,
        );
        columns.push({
          id: candidate.id,
          presentation: candidate.presentation,
          selectedWindowId: selectedWindowAfterSnapshotRemoval(
            candidate,
            memberIndex,
          ),
          width: candidate.width,
          ...(windowHeights ? { windowHeights } : {}),
          windowIds,
        });
      }
    }

    let activeColumnId = before.activeColumnId;

    if (column.windowIds.length === 1 && activeColumnId === column.id) {
      activeColumnId =
        context.columns[columnIndex + 1]?.id ??
        context.columns[columnIndex - 1]?.id ??
        null;
    }

    const after = immutableContextSnapshot({
      activeColumnId,
      columns,
      desktopId: before.desktopId,
      outputId: before.outputId,
      viewportOffset: columns.length === 0 ? 0 : before.viewportOffset,
    });
    const preview = Object.freeze({
      layout: after,
      placement,
    }) as WindowDetachPreview;
    this.windowDetachPreviews.set(preview, { after, before, windowId });
    return preview;
  }

  commitWindowDetach(preview: WindowDetachPreview): boolean {
    const state = this.windowDetachPreviews.get(preview);

    if (!state) {
      return false;
    }

    this.windowDetachPreviews.delete(preview);
    const key = contextKey(state.before.outputId, state.before.desktopId);

    if (
      this.placements.get(state.windowId)?.contextKey !== key ||
      !sameContextSnapshot(
        this.snapshot(state.before.outputId, state.before.desktopId),
        state.before,
      )
    ) {
      return false;
    }

    this.placements.delete(state.windowId);
    this.replaceContext(state.after);
    return true;
  }

  previewWindowAttach(
    placement: DetachedWindowPlacement,
  ): WindowAttachPreview | null {
    if (
      !validDetachedWindowPlacement(placement) ||
      this.placements.has(placement.windowId)
    ) {
      return null;
    }

    const saved = immutableDetachedWindowPlacement(placement);
    const before = immutableContextSnapshot(
      this.snapshot(saved.outputId, saved.desktopId),
    );
    const after = previewWindowAttachment(before, saved);

    if (!after || !validContextSnapshot(after)) {
      return null;
    }

    const preview = Object.freeze({ layout: after }) as WindowAttachPreview;
    this.windowAttachPreviews.set(preview, {
      after,
      before,
      windowId: saved.windowId,
    });
    return preview;
  }

  commitWindowAttach(preview: WindowAttachPreview): boolean {
    const state = this.windowAttachPreviews.get(preview);

    if (!state) {
      return false;
    }

    this.windowAttachPreviews.delete(preview);

    if (
      this.placements.has(state.windowId) ||
      !sameContextSnapshot(
        this.snapshot(state.before.outputId, state.before.desktopId),
        state.before,
      )
    ) {
      return false;
    }

    this.replaceContext(state.after);
    return true;
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

    const columnIndex = liveColumnIndex(context, placement.columnId);

    if (columnIndex < 0) {
      this.placements.delete(windowId);
      return false;
    }

    const column = context.columns[columnIndex];

    if (!column) {
      return false;
    }

    const windowIndex = placement.memberIndex;

    if (column.windowIds[windowIndex] !== windowId) {
      this.placements.delete(windowId);
      return false;
    }

    removeMutableColumnWindow(column, windowIndex);
    this.placements.delete(windowId);

    if (column.windowIds.length === 0) {
      context.columns.splice(columnIndex, 1);
      context.columnById.delete(column.id);
      context.columnIds.delete(column.id);
      context.columnIndexById.delete(column.id);
      this.reindexColumnIndices(context, columnIndex);

      if (context.activeColumnId === column.id) {
        const nextColumn =
          context.columns[columnIndex] ?? context.columns[columnIndex - 1];
        context.activeColumnId = nextColumn?.id ?? null;
      }

      if (context.columns.length === 0) {
        this.contexts.delete(placement.contextKey);
      }
    } else {
      this.reindexColumnPlacements(placement.contextKey, column, windowIndex);
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

    const activeIndex =
      context.activeColumnId === null
        ? -1
        : liveColumnIndex(context, context.activeColumnId);
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
      const retainedWindowIds: WindowId[] = [];
      const retainedWindowHeights: WindowHeight[] = [];

      for (const [memberIndex, id] of column.windowIds.entries()) {
        if (!removedWindowIds.has(id)) {
          retainedWindowIds.push(id);

          if (column.windowHeights) {
            const height = column.windowHeights[memberIndex];

            if (!height) {
              return null;
            }

            retainedWindowHeights.push(cloneWindowHeight(height));
          }

          continue;
        }

        removedWindowCount += 1;
      }

      if (retainedWindowIds.length === 0) {
        removedColumns.push({ id: column.id, index });
        continue;
      }

      if (
        retainedWindowHeights.length === 1 &&
        retainedWindowHeights[0]?.kind === "auto"
      ) {
        retainedWindowHeights[0] = automaticWindowHeight();
      }

      const compactHeights =
        retainedWindowHeights.length > 0
          ? compactWindowHeights(retainedWindowHeights)
          : undefined;

      retainedEntries.push({
        column:
          retainedWindowIds.length === column.windowIds.length
            ? column
            : {
                id: column.id,
                presentation: column.presentation,
                selectedWindowId: selectedWindowAfterRetaining(
                  column,
                  retainedWindowIds,
                ),
                width: column.width,
                ...(compactHeights ? { windowHeights: compactHeights } : {}),
                windowIds: retainedWindowIds,
              },
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
    context.columnById.clear();
    context.columnIds.clear();
    context.columnIndexById.clear();

    for (const entry of retainedEntries) {
      context.columnById.set(entry.column.id, entry.column);
      context.columnIds.add(entry.column.id);
      this.reindexColumnPlacements(key, entry.column);
    }

    this.reindexColumnIndices(context);

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

    const activeIndex =
      context.activeColumnId === null
        ? -1
        : liveColumnIndex(context, context.activeColumnId);
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
      context.columnById.delete(column.id);
      context.columnIndexById.delete(column.id);
    }

    context.columns.length = 0;
    context.columns.push(...retained);
    this.reindexColumnIndices(context);

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
    context.columnById.clear();
    context.columnIds.clear();
    context.columnIndexById.clear();

    for (const column of restored.columns) {
      const mutableColumn: LayoutColumn = {
        id: column.id,
        presentation: column.presentation,
        selectedWindowId: column.selectedWindowId,
        width: { ...column.width },
        ...(column.windowHeights
          ? { windowHeights: column.windowHeights.map(cloneWindowHeight) }
          : {}),
        windowIds: [...column.windowIds],
      };
      context.columns.push(mutableColumn);
      context.columnById.set(mutableColumn.id, mutableColumn);
      context.columnIds.add(mutableColumn.id);

      for (const [memberIndex, id] of mutableColumn.windowIds.entries()) {
        this.placements.set(id, {
          columnId: mutableColumn.id,
          contextKey: key,
          memberIndex,
        });
      }
    }

    this.reindexColumnIndices(context);

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
        presentation: column.presentation,
        selectedWindowId: column.selectedWindowId,
        width: { ...column.width },
        ...(column.windowHeights
          ? { windowHeights: column.windowHeights.map(cloneWindowHeight) }
          : {}),
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

  private createStackEditResult(
    kind: StackEditResult["kind"],
    before: LayoutContextSnapshot,
    after: LayoutContextSnapshot,
  ): StackEditResult {
    const rollback = {} as StackEditRollback;
    this.stackEditRollbacks.set(rollback, { after, before });
    return { kind, rollback };
  }

  private createWindowTransferPreview(
    windowId: WindowId,
    sourceBefore: LayoutContextSnapshot,
    sourceAfter: LayoutContextSnapshot,
    targetBefore: LayoutContextSnapshot,
    targetAfter: LayoutContextSnapshot,
  ): WindowTransferPreview {
    const preview = Object.freeze({
      sourceLayout: sourceAfter,
      targetLayout: targetAfter,
    }) as WindowTransferPreview;
    this.windowTransferPreviews.set(preview, {
      sourceAfter,
      sourceBefore,
      targetAfter,
      targetBefore,
      windowId,
    });
    return preview;
  }

  private createColumnStackEditPreview(
    kind: ColumnStackEditPreview["kind"],
    movedWindowId: WindowId,
    before: LayoutContextSnapshot,
    after: LayoutContextSnapshot,
  ): ColumnStackEditPreview {
    const preview = Object.freeze({
      kind,
      layout: after,
      movedWindowId,
    }) as ColumnStackEditPreview;
    this.columnStackEditPreviews.set(preview, {
      after,
      before,
    });
    return preview;
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
      columnById: new Map<ColumnId, LayoutColumn>(),
      columnIds: new Set<ColumnId>(),
      columnIndexById: new Map<ColumnId, number>(),
      columns: [],
      desktopId,
      outputId,
      viewportOffset: 0,
    };
    this.contexts.set(key, context);
    return context;
  }

  private placementsMatchSnapshot(snapshot: LayoutContextSnapshot): boolean {
    const key = contextKey(snapshot.outputId, snapshot.desktopId);

    for (const column of snapshot.columns) {
      for (const [memberIndex, id] of column.windowIds.entries()) {
        const placement = this.placements.get(id);

        if (
          placement?.contextKey !== key ||
          placement.columnId !== column.id ||
          placement.memberIndex !== memberIndex
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private replaceContext(snapshot: LayoutContextSnapshot): void {
    const key = contextKey(snapshot.outputId, snapshot.desktopId);

    if (snapshot.columns.length === 0) {
      this.contexts.delete(key);
      return;
    }

    const context = this.getOrCreateContext(
      key,
      snapshot.outputId,
      snapshot.desktopId,
    );
    context.columns.length = 0;
    context.columnById.clear();
    context.columnIds.clear();
    context.columnIndexById.clear();

    for (const saved of snapshot.columns) {
      const column: LayoutColumn = {
        id: saved.id,
        presentation: saved.presentation,
        selectedWindowId: saved.selectedWindowId,
        width: { ...saved.width },
        ...(saved.windowHeights
          ? { windowHeights: saved.windowHeights.map(cloneWindowHeight) }
          : {}),
        windowIds: [...saved.windowIds],
      };
      context.columns.push(column);
      context.columnById.set(column.id, column);
      context.columnIds.add(column.id);

      for (const [memberIndex, id] of column.windowIds.entries()) {
        this.placements.set(id, {
          columnId: column.id,
          contextKey: key,
          memberIndex,
        });
      }
    }

    this.reindexColumnIndices(context);

    context.activeColumnId = snapshot.activeColumnId;
    context.viewportOffset = snapshot.viewportOffset;
  }

  private reindexColumnPlacements(
    key: string,
    column: LayoutColumn,
    startIndex = 0,
  ): void {
    for (
      let memberIndex = startIndex;
      memberIndex < column.windowIds.length;
      memberIndex += 1
    ) {
      const id = column.windowIds[memberIndex];

      if (id !== undefined) {
        this.placements.set(id, {
          columnId: column.id,
          contextKey: key,
          memberIndex,
        });
      }
    }
  }

  private reindexColumnIndices(context: LayoutContext, startIndex = 0): void {
    for (let index = startIndex; index < context.columns.length; index += 1) {
      const column = context.columns[index];

      if (column) {
        context.columnIndexById.set(column.id, index);
      }
    }
  }
}

function previewWindowReinsertion(
  context: LayoutContextSnapshot,
  windowId: WindowId,
  target: WindowReinsertionTarget,
): WindowReinsertionPreview | null {
  let sourceColumnIndex = -1;
  let sourceMemberIndex = -1;
  let targetColumnIndex = -1;
  let targetMemberIndex = -1;

  for (const [columnIndex, column] of context.columns.entries()) {
    for (const [memberIndex, candidate] of column.windowIds.entries()) {
      if (candidate === windowId) {
        if (sourceMemberIndex >= 0) {
          return null;
        }

        sourceColumnIndex = columnIndex;
        sourceMemberIndex = memberIndex;
      }

      if (candidate === target.targetWindowId) {
        if (targetMemberIndex >= 0) {
          return null;
        }

        targetColumnIndex = columnIndex;
        targetMemberIndex = memberIndex;
      }
    }
  }

  const source = context.columns[sourceColumnIndex];
  const destination = context.columns[targetColumnIndex];

  if (
    sourceMemberIndex < 0 ||
    targetMemberIndex < 0 ||
    !source ||
    !destination
  ) {
    return null;
  }

  if (sourceColumnIndex === targetColumnIndex) {
    const windowIds = [...source.windowIds];
    const windowHeights = columnWindowHeights(source).map(cloneWindowHeight);
    const [movedWindowId] = windowIds.splice(sourceMemberIndex, 1);
    const [movedWindowHeight] = windowHeights.splice(sourceMemberIndex, 1);

    if (movedWindowId === undefined || movedWindowHeight === undefined) {
      return null;
    }

    const targetIndexAfterRemoval =
      targetMemberIndex > sourceMemberIndex
        ? targetMemberIndex - 1
        : targetMemberIndex;
    const insertionIndex =
      targetIndexAfterRemoval + (target.position === "after" ? 1 : 0);

    if (insertionIndex === sourceMemberIndex) {
      return null;
    }

    windowIds.splice(insertionIndex, 0, movedWindowId);
    windowHeights.splice(insertionIndex, 0, movedWindowHeight);
    const compactHeights = compactWindowHeights(windowHeights);
    const columns = context.columns.map((column, columnIndex) =>
      columnIndex === sourceColumnIndex
        ? {
            id: column.id,
            presentation: column.presentation,
            selectedWindowId: windowId,
            width: column.width,
            ...(compactHeights ? { windowHeights: compactHeights } : {}),
            windowIds,
          }
        : column,
    );
    return {
      after: immutableContextSnapshot({ ...context, columns }),
      kind: "reorder",
    };
  }

  const sourceWindowIds = [...source.windowIds];
  sourceWindowIds.splice(sourceMemberIndex, 1);
  const sourceWindowHeights = withoutSnapshotWindowHeight(
    source,
    sourceMemberIndex,
  );
  const destinationWindowIds = [...destination.windowIds];
  const destinationInsertionIndex =
    targetMemberIndex + (target.position === "after" ? 1 : 0);
  destinationWindowIds.splice(destinationInsertionIndex, 0, windowId);
  const destinationWindowHeights =
    columnWindowHeights(destination).map(cloneWindowHeight);
  destinationWindowHeights.splice(
    destinationInsertionIndex,
    0,
    automaticWindowHeight(),
  );
  const compactDestinationHeights = compactWindowHeights(
    destinationWindowHeights,
  );
  const columns: LayoutColumnSnapshot[] = [];

  for (const [columnIndex, column] of context.columns.entries()) {
    if (columnIndex === sourceColumnIndex) {
      if (sourceWindowIds.length > 0) {
        columns.push({
          id: column.id,
          presentation: column.presentation,
          selectedWindowId: selectedWindowAfterSnapshotRemoval(
            column,
            sourceMemberIndex,
          ),
          width: column.width,
          ...(sourceWindowHeights
            ? { windowHeights: sourceWindowHeights }
            : {}),
          windowIds: sourceWindowIds,
        });
      }

      continue;
    }

    if (columnIndex === targetColumnIndex) {
      columns.push({
        id: column.id,
        presentation: column.presentation,
        selectedWindowId: windowId,
        width: column.width,
        ...(compactDestinationHeights
          ? { windowHeights: compactDestinationHeights }
          : {}),
        windowIds: destinationWindowIds,
      });
      continue;
    }

    columns.push(column);
  }

  return {
    after: immutableContextSnapshot({
      ...context,
      activeColumnId: destination.id,
      columns,
    }),
    kind: sourceWindowIds.length === 0 ? "merge" : "insert",
  };
}

function previewColumnBoundaryReinsertion(
  context: LayoutContextSnapshot,
  windowId: WindowId,
  target: ColumnReinsertionTarget,
  newColumnId: ColumnId,
  newColumnPresentation: ColumnPresentation,
): ColumnBoundaryReinsertionPreview | null {
  const sourceColumnIndex = context.columns.findIndex((column) =>
    column.windowIds.includes(windowId),
  );
  const targetColumnIndex = context.columns.findIndex(
    (column) => column.id === target.targetColumnId,
  );
  const source = context.columns[sourceColumnIndex];

  if (!source || targetColumnIndex < 0) {
    return null;
  }

  if (source.windowIds.length === 1) {
    if (sourceColumnIndex === targetColumnIndex) {
      return null;
    }

    const columns = [...context.columns];
    const [movedColumn] = columns.splice(sourceColumnIndex, 1);

    if (!movedColumn) {
      return null;
    }

    const targetIndexAfterRemoval =
      targetColumnIndex > sourceColumnIndex
        ? targetColumnIndex - 1
        : targetColumnIndex;
    const insertionIndex =
      targetIndexAfterRemoval + (target.position === "after" ? 1 : 0);
    columns.splice(insertionIndex, 0, movedColumn);
    return {
      after: immutableContextSnapshot({ ...context, columns }),
      kind: "reorder",
    };
  }

  const sourceMemberIndex = source.windowIds.indexOf(windowId);

  if (sourceMemberIndex < 0) {
    return null;
  }

  const sourceWindowIds = [...source.windowIds];
  sourceWindowIds.splice(sourceMemberIndex, 1);
  const sourceWindowHeights = withoutSnapshotWindowHeight(
    source,
    sourceMemberIndex,
    false,
  );
  const retainedSource: LayoutColumnSnapshot = {
    id: source.id,
    presentation: source.presentation,
    selectedWindowId: selectedWindowAfterSnapshotRemoval(
      source,
      sourceMemberIndex,
    ),
    width: source.width,
    ...(sourceWindowHeights ? { windowHeights: sourceWindowHeights } : {}),
    windowIds: sourceWindowIds,
  };
  const extracted: LayoutColumnSnapshot = {
    id: newColumnId,
    presentation: newColumnPresentation,
    selectedWindowId: windowId,
    width: source.width,
    windowIds: [windowId],
  };
  const columns = context.columns.map((column, columnIndex) =>
    columnIndex === sourceColumnIndex ? retainedSource : column,
  );
  const insertionIndex =
    targetColumnIndex + (target.position === "after" ? 1 : 0);
  columns.splice(insertionIndex, 0, extracted);
  return {
    after: immutableContextSnapshot({
      ...context,
      activeColumnId: newColumnId,
      columns,
    }),
    kind: "extract",
  };
}

function previewWindowAttachment(
  context: LayoutContextSnapshot,
  placement: DetachedWindowPlacement,
): LayoutContextSnapshot | null {
  const columnIndices = new Map<ColumnId, number>();

  for (const [index, column] of context.columns.entries()) {
    if (columnIndices.has(column.id)) {
      return null;
    }

    columnIndices.set(column.id, index);
  }

  const survivingColumnIndex = columnIndices.get(placement.columnId);
  let columns: LayoutColumnSnapshot[];

  if (survivingColumnIndex !== undefined) {
    const survivingColumn = context.columns[survivingColumnIndex];

    if (!survivingColumn) {
      return null;
    }

    const memberIndices = new Map<WindowId, number>();

    for (const [index, id] of survivingColumn.windowIds.entries()) {
      if (memberIndices.has(id) || id === placement.windowId) {
        return null;
      }

      memberIndices.set(id, index);
    }

    const insertionIndex = anchoredInsertionIndex(
      survivingColumn.windowIds.length,
      placement.memberIndex,
      placement.previousWindowId === null
        ? undefined
        : memberIndices.get(placement.previousWindowId),
      placement.nextWindowId === null
        ? undefined
        : memberIndices.get(placement.nextWindowId),
    );
    const windowIds = [...survivingColumn.windowIds];
    windowIds.splice(insertionIndex, 0, placement.windowId);
    const restoredHeight = placement.windowHeight
      ? cloneWindowHeight(placement.windowHeight)
      : automaticWindowHeight();
    const windowHeights = columnWindowHeights(survivingColumn).map((height) =>
      restoredHeight.kind !== "auto" && height.kind !== "auto"
        ? automaticWindowHeight()
        : cloneWindowHeight(height),
    );
    windowHeights.splice(insertionIndex, 0, restoredHeight);
    const compactHeights = compactWindowHeights(windowHeights);
    columns = context.columns.map((column, index) =>
      index === survivingColumnIndex
        ? {
            id: column.id,
            presentation: column.presentation,
            selectedWindowId: placement.windowId,
            width: column.width,
            ...(compactHeights ? { windowHeights: compactHeights } : {}),
            windowIds,
          }
        : column,
    );
  } else {
    for (const column of context.columns) {
      if (column.windowIds.includes(placement.windowId)) {
        return null;
      }
    }

    const insertionIndex = anchoredInsertionIndex(
      context.columns.length,
      placement.columnIndex,
      placement.previousColumnId === null
        ? undefined
        : columnIndices.get(placement.previousColumnId),
      placement.nextColumnId === null
        ? undefined
        : columnIndices.get(placement.nextColumnId),
    );
    const restoredColumn: LayoutColumnSnapshot = {
      id: placement.columnId,
      presentation: placement.columnPresentation,
      selectedWindowId: placement.windowId,
      width: placement.columnWidth,
      ...(placement.windowHeight &&
      !isDefaultWindowHeight(placement.windowHeight)
        ? { windowHeights: [cloneWindowHeight(placement.windowHeight)] }
        : {}),
      windowIds: [placement.windowId],
    };
    columns = [...context.columns];
    columns.splice(insertionIndex, 0, restoredColumn);
  }

  return immutableContextSnapshot({
    activeColumnId: placement.columnId,
    columns,
    desktopId: context.desktopId,
    outputId: context.outputId,
    viewportOffset: context.viewportOffset,
  });
}

function anchoredInsertionIndex(
  length: number,
  savedIndex: number,
  previousIndex: number | undefined,
  nextIndex: number | undefined,
): number {
  if (
    previousIndex !== undefined &&
    nextIndex !== undefined &&
    previousIndex < nextIndex
  ) {
    return Math.min(Math.max(savedIndex, previousIndex + 1), nextIndex);
  }

  if (previousIndex !== undefined && nextIndex === undefined) {
    return previousIndex + 1;
  }

  if (previousIndex === undefined && nextIndex !== undefined) {
    return nextIndex;
  }

  return Math.min(savedIndex, length);
}

function immutableDetachedWindowPlacement(
  placement: DetachedWindowPlacement,
): DetachedWindowPlacement {
  return Object.freeze({
    columnId: placement.columnId,
    columnIndex: placement.columnIndex,
    columnPresentation: placement.columnPresentation,
    columnWidth: Object.freeze({ ...placement.columnWidth }),
    desktopId: placement.desktopId,
    memberIndex: placement.memberIndex,
    nextColumnId: placement.nextColumnId,
    nextWindowId: placement.nextWindowId,
    outputId: placement.outputId,
    previousColumnId: placement.previousColumnId,
    previousWindowId: placement.previousWindowId,
    ...(placement.windowHeight
      ? {
          windowHeight: Object.freeze(
            cloneWindowHeight(placement.windowHeight),
          ),
        }
      : {}),
    windowId: placement.windowId,
  });
}

function cloneColumnSnapshot(
  column: LayoutColumnSnapshot,
): LayoutColumnSnapshot {
  return {
    id: column.id,
    presentation: column.presentation,
    selectedWindowId: column.selectedWindowId,
    width: { ...column.width },
    ...(column.windowHeights
      ? { windowHeights: column.windowHeights.map(cloneWindowHeight) }
      : {}),
    windowIds: [...column.windowIds],
  };
}

function appendedDefaultSnapshotWindowHeight(
  column: LayoutColumnSnapshot,
): WindowHeight[] | undefined {
  if (!column.windowHeights) {
    return undefined;
  }

  return compactWindowHeights([
    ...column.windowHeights.map(cloneWindowHeight),
    automaticWindowHeight(),
  ]);
}

function immutableContextSnapshot(
  snapshot: LayoutContextSnapshot,
): LayoutContextSnapshot {
  const columns = snapshot.columns.map((column) =>
    Object.freeze({
      id: column.id,
      presentation: column.presentation,
      selectedWindowId: column.selectedWindowId,
      width: Object.freeze({ ...column.width }),
      ...(column.windowHeights
        ? {
            windowHeights: Object.freeze(
              column.windowHeights.map((height) =>
                Object.freeze(cloneWindowHeight(height)),
              ),
            ),
          }
        : {}),
      windowIds: Object.freeze([...column.windowIds]),
    }),
  );

  return Object.freeze({
    activeColumnId: snapshot.activeColumnId,
    columns: Object.freeze(columns),
    desktopId: snapshot.desktopId,
    outputId: snapshot.outputId,
    viewportOffset: snapshot.viewportOffset,
  });
}

function validDetachedWindowPlacement(
  placement: unknown,
): placement is DetachedWindowPlacement {
  if (!isRecord(placement)) {
    return false;
  }

  const columnId = placement["columnId"];
  const nextColumnId = placement["nextColumnId"];
  const nextWindowId = placement["nextWindowId"];
  const previousColumnId = placement["previousColumnId"];
  const previousWindowId = placement["previousWindowId"];
  const height = placement["windowHeight"];
  const windowId = placement["windowId"];

  return (
    typeof columnId === "string" &&
    typeof placement["desktopId"] === "string" &&
    typeof placement["outputId"] === "string" &&
    typeof windowId === "string" &&
    validColumnPresentation(placement["columnPresentation"]) &&
    nullableIdentifier(nextColumnId) &&
    nullableIdentifier(nextWindowId) &&
    nullableIdentifier(previousColumnId) &&
    nullableIdentifier(previousWindowId) &&
    typeof placement["columnIndex"] === "number" &&
    Number.isInteger(placement["columnIndex"]) &&
    placement["columnIndex"] >= 0 &&
    typeof placement["memberIndex"] === "number" &&
    Number.isInteger(placement["memberIndex"]) &&
    placement["memberIndex"] >= 0 &&
    validWidth(placement["columnWidth"]) &&
    (height === undefined || validWindowHeight(height)) &&
    previousColumnId !== columnId &&
    nextColumnId !== columnId &&
    (previousColumnId === null || previousColumnId !== nextColumnId) &&
    previousWindowId !== windowId &&
    nextWindowId !== windowId &&
    (previousWindowId === null || previousWindowId !== nextWindowId)
  );
}

function validColumnTransferTarget(
  target: unknown,
): target is ColumnTransferTarget {
  return validWindowTransferTarget(target);
}

function validWindowTransferTarget(
  target: unknown,
): target is WindowTransferTarget {
  return (
    isRecord(target) &&
    typeof target["columnId"] === "string" &&
    typeof target["desktopId"] === "string" &&
    typeof target["outputId"] === "string" &&
    (target["presentation"] === undefined ||
      validColumnPresentation(target["presentation"]))
  );
}

function validWindowReinsertionTarget(
  target: unknown,
): target is WindowReinsertionTarget {
  return (
    isRecord(target) &&
    (target["position"] === "after" || target["position"] === "before") &&
    typeof target["targetWindowId"] === "string"
  );
}

function validColumnReinsertionTarget(
  target: unknown,
): target is ColumnReinsertionTarget {
  return (
    isRecord(target) &&
    (target["position"] === "after" || target["position"] === "before") &&
    typeof target["targetColumnId"] === "string"
  );
}

function validWindowTransferInsertionTarget(
  target: unknown,
): target is WindowTransferInsertionTarget {
  return (
    isRecord(target) &&
    validWindowReinsertionTarget(target) &&
    typeof target["desktopId"] === "string" &&
    typeof target["outputId"] === "string"
  );
}

function validWindowTransferColumnInsertionTarget(
  target: unknown,
): target is WindowTransferColumnInsertionTarget {
  return (
    isRecord(target) &&
    validColumnReinsertionTarget(target) &&
    typeof target["columnId"] === "string" &&
    typeof target["desktopId"] === "string" &&
    typeof target["outputId"] === "string" &&
    (target["presentation"] === undefined ||
      validColumnPresentation(target["presentation"]))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nullableIdentifier(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function previewColumnRestoration(
  context: LayoutContextSnapshot,
  placements: readonly LayoutColumnPlacement[],
  options: {
    readonly activeColumnId?: ColumnId | null;
    readonly viewportOffset?: number;
  } = {},
): LayoutContextSnapshot | null {
  if (placements.length === 0 || !validTransferContextSnapshot(context)) {
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
      !validSerializedWindowHeights(
        column.windowHeights,
        column.windowIds.length,
      ) ||
      !validColumnPresentation(column.presentation) ||
      !column.windowIds.includes(column.selectedWindowId) ||
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
      presentation: column.presentation,
      selectedWindowId: column.selectedWindowId,
      width: { ...column.width },
      ...(column.windowHeights
        ? { windowHeights: column.windowHeights.map(cloneWindowHeight) }
        : {}),
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
      presentation: currentColumn.presentation,
      selectedWindowId: currentColumn.selectedWindowId,
      width: { ...currentColumn.width },
      ...(currentColumn.windowHeights
        ? {
            windowHeights: currentColumn.windowHeights.map(cloneWindowHeight),
          }
        : {}),
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

function liveColumnIndex(context: LayoutContext, columnId: ColumnId): number {
  return context.columnIndexById.get(columnId) ?? -1;
}

function sameContextStructure(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  return (
    left.activeColumnId === right.activeColumnId &&
    sameContextColumns(left, right)
  );
}

function sameContextColumns(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  return (
    left.outputId === right.outputId &&
    left.desktopId === right.desktopId &&
    left.columns.length === right.columns.length &&
    left.columns.every((column, index) => {
      const candidate = right.columns[index];
      return (
        candidate !== undefined &&
        column.id === candidate.id &&
        column.presentation === candidate.presentation &&
        column.selectedWindowId === candidate.selectedWindowId &&
        column.width.kind === candidate.width.kind &&
        column.width.value === candidate.width.value &&
        sameColumnWindowHeights(column, candidate) &&
        column.windowIds.length === candidate.windowIds.length &&
        column.windowIds.every(
          (window, windowIndex) => window === candidate.windowIds[windowIndex],
        )
      );
    })
  );
}

function sameRollbackContextColumns(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  return (
    left.outputId === right.outputId &&
    left.desktopId === right.desktopId &&
    left.columns.length === right.columns.length &&
    left.columns.every((column, index) => {
      const candidate = right.columns[index];
      return (
        candidate !== undefined &&
        column.id === candidate.id &&
        column.presentation === candidate.presentation &&
        column.width.kind === candidate.width.kind &&
        column.width.value === candidate.width.value &&
        sameColumnWindowHeights(column, candidate) &&
        column.windowIds.length === candidate.windowIds.length &&
        column.windowIds.every(
          (window, windowIndex) => window === candidate.windowIds[windowIndex],
        )
      );
    })
  );
}

function sameContextSnapshot(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  return (
    left.viewportOffset === right.viewportOffset &&
    sameContextStructure(left, right)
  );
}

function sameWindowSet(
  left: LayoutContextSnapshot,
  right: LayoutContextSnapshot,
): boolean {
  const leftWindows = contextWindowIds(left);
  const rightWindows = contextWindowIds(right);
  const leftSet = new Set(leftWindows);
  const rightSet = new Set(rightWindows);
  return (
    leftWindows.length === rightWindows.length &&
    leftSet.size === leftWindows.length &&
    rightSet.size === rightWindows.length &&
    leftWindows.every((window) => rightSet.has(window))
  );
}

function contextRemovedWindowIds(
  expected: LayoutContextSnapshot,
  current: LayoutContextSnapshot,
): ReadonlySet<WindowId> | null {
  const expectedIds = contextWindowIds(expected);
  const currentIds = contextWindowIds(current);
  const expectedSet = new Set(expectedIds);
  const currentSet = new Set(currentIds);

  if (
    expectedSet.size !== expectedIds.length ||
    currentSet.size !== currentIds.length ||
    currentIds.some((id) => !expectedSet.has(id))
  ) {
    return null;
  }

  return new Set(expectedIds.filter((id) => !currentSet.has(id)));
}

function contextWithoutWindows(
  snapshot: LayoutContextSnapshot,
  removedIds: ReadonlySet<WindowId>,
): LayoutContextSnapshot {
  const columns: LayoutColumnSnapshot[] = [];

  for (const column of snapshot.columns) {
    const retainedIndices: number[] = [];

    for (const [index, id] of column.windowIds.entries()) {
      if (!removedIds.has(id)) {
        retainedIndices.push(index);
      }
    }

    if (retainedIndices.length === 0) {
      continue;
    }

    let windowHeights = column.windowHeights
      ? retainedIndices.map((index) => {
          const height = column.windowHeights?.[index];

          if (!height) {
            throw new Error("window height state is out of sync");
          }

          return cloneWindowHeight(height);
        })
      : undefined;

    if (windowHeights?.length === 1 && windowHeights[0]?.kind === "auto") {
      windowHeights = [automaticWindowHeight()];
    }

    const compactHeights = windowHeights
      ? compactWindowHeights(windowHeights)
      : undefined;
    columns.push({
      id: column.id,
      presentation: column.presentation,
      selectedWindowId: selectedWindowAfterRetaining(
        column,
        retainedIndices.map((index) => {
          const id = column.windowIds[index];

          if (id === undefined) {
            throw new Error("window order is out of sync");
          }

          return id;
        }),
      ),
      width: { ...column.width },
      ...(compactHeights ? { windowHeights: compactHeights } : {}),
      windowIds: retainedIndices.map((index) => {
        const id = column.windowIds[index];

        if (id === undefined) {
          throw new Error("window order is out of sync");
        }

        return id;
      }),
    });
  }

  const activeColumnId = columns.some(
    (column) => column.id === snapshot.activeColumnId,
  )
    ? snapshot.activeColumnId
    : (columns[0]?.id ?? null);

  return {
    activeColumnId,
    columns,
    desktopId: snapshot.desktopId,
    outputId: snapshot.outputId,
    viewportOffset: columns.length === 0 ? 0 : snapshot.viewportOffset,
  };
}

function sameWindowSetAcrossContexts(
  sourceBefore: LayoutContextSnapshot,
  targetBefore: LayoutContextSnapshot,
  sourceAfter: LayoutContextSnapshot,
  targetAfter: LayoutContextSnapshot,
): boolean {
  const beforeWindows = contextWindowIds(sourceBefore, targetBefore);
  const afterWindows = contextWindowIds(sourceAfter, targetAfter);
  const beforeSet = new Set(beforeWindows);
  const afterSet = new Set(afterWindows);
  return (
    beforeWindows.length === afterWindows.length &&
    beforeSet.size === beforeWindows.length &&
    afterSet.size === afterWindows.length &&
    beforeWindows.every((window) => afterSet.has(window))
  );
}

function contextWindowIds(
  ...contexts: readonly LayoutContextSnapshot[]
): readonly WindowId[] {
  const windowIds: WindowId[] = [];

  for (const context of contexts) {
    for (const column of context.columns) {
      windowIds.push(...column.windowIds);
    }
  }

  return windowIds;
}

function validTransferContextSnapshot(
  snapshot: LayoutContextSnapshot,
): boolean {
  if (
    !Number.isFinite(snapshot.viewportOffset) ||
    (snapshot.columns.length === 0 &&
      (snapshot.activeColumnId !== null || snapshot.viewportOffset !== 0))
  ) {
    return false;
  }

  if (snapshot.columns.length === 0) {
    return true;
  }

  return validContextSnapshot(snapshot);
}

function validContextSnapshot(snapshot: LayoutContextSnapshot): boolean {
  if (
    snapshot.columns.length === 0 ||
    !Number.isFinite(snapshot.viewportOffset)
  ) {
    return false;
  }

  const columnIds = new Set<ColumnId>();
  const windowIds = new Set<WindowId>();

  for (const column of snapshot.columns) {
    if (
      columnIds.has(column.id) ||
      column.windowIds.length === 0 ||
      !validColumnPresentation(column.presentation) ||
      !column.windowIds.includes(column.selectedWindowId) ||
      !validSerializedWindowHeights(
        column.windowHeights,
        column.windowIds.length,
      ) ||
      !Number.isFinite(column.width.value) ||
      column.width.value <= 0
    ) {
      return false;
    }

    columnIds.add(column.id);

    for (const window of column.windowIds) {
      if (windowIds.has(window)) {
        return false;
      }

      windowIds.add(window);
    }
  }

  return (
    snapshot.activeColumnId === null || columnIds.has(snapshot.activeColumnId)
  );
}

export function automaticWindowHeight(weight = 1): WindowHeight {
  const height: WindowHeight = { kind: "auto", weight };
  assertValidWindowHeight(height);
  return height;
}

export function columnWindowHeights(
  column: LayoutColumnSnapshot,
): readonly WindowHeight[] {
  return column.windowHeights
    ? column.windowHeights.map(cloneWindowHeight)
    : column.windowIds.map(() => automaticWindowHeight());
}

function cloneWindowHeight(height: WindowHeight): WindowHeight {
  switch (height.kind) {
    case "auto":
      return { kind: "auto", weight: height.weight };
    case "fixed":
      return { clientHeight: height.clientHeight, kind: "fixed" };
    case "preset":
      return { index: height.index, kind: "preset" };
  }
}

function compactWindowHeights(
  heights: readonly WindowHeight[],
): WindowHeight[] | undefined {
  assertValidWindowHeights(heights);
  return heights.every(isDefaultWindowHeight)
    ? undefined
    : heights.map(cloneWindowHeight);
}

function isDefaultWindowHeight(height: WindowHeight): boolean {
  return height.kind === "auto" && height.weight === 1;
}

function validColumnPresentation(
  presentation: unknown,
): presentation is ColumnPresentation {
  return presentation === "stacked" || presentation === "tabbed";
}

function selectedWindowAfterSnapshotRemoval(
  column: LayoutColumnSnapshot,
  removedIndex: number,
): WindowId {
  if (column.selectedWindowId !== column.windowIds[removedIndex]) {
    return column.selectedWindowId;
  }

  const selected =
    column.windowIds[removedIndex + 1] ?? column.windowIds[removedIndex - 1];

  if (selected === undefined) {
    throw new Error("a retained column must have a selected window");
  }

  return selected;
}

function selectedWindowAfterRetaining(
  column: Pick<LayoutColumnSnapshot, "selectedWindowId" | "windowIds">,
  retainedWindowIds: readonly WindowId[],
): WindowId {
  const retained = new Set(retainedWindowIds);

  if (retained.has(column.selectedWindowId)) {
    return column.selectedWindowId;
  }

  const selectedIndex = column.windowIds.indexOf(column.selectedWindowId);

  for (
    let index = selectedIndex + 1;
    index < column.windowIds.length;
    index += 1
  ) {
    const candidate = column.windowIds[index];

    if (candidate !== undefined && retained.has(candidate)) {
      return candidate;
    }
  }

  for (let index = selectedIndex - 1; index >= 0; index -= 1) {
    const candidate = column.windowIds[index];

    if (candidate !== undefined && retained.has(candidate)) {
      return candidate;
    }
  }

  const first = retainedWindowIds[0];

  if (first === undefined) {
    throw new Error("a retained column must have a selected window");
  }

  return first;
}

function assertValidWindowHeights(heights: readonly WindowHeight[]): void {
  let nonAutomaticCount = 0;

  for (const height of heights) {
    assertValidWindowHeight(height);

    if (height.kind !== "auto") {
      nonAutomaticCount += 1;
    }
  }

  if (nonAutomaticCount > 1) {
    throw new RangeError(
      "a column can contain at most one non-automatic window height",
    );
  }
}

function assertValidWindowHeight(height: WindowHeight): void {
  if (
    (height.kind === "auto" &&
      (!Number.isFinite(height.weight) || height.weight <= 0)) ||
    (height.kind === "fixed" &&
      (!Number.isFinite(height.clientHeight) || height.clientHeight <= 0)) ||
    (height.kind === "preset" &&
      (!Number.isInteger(height.index) || height.index < 0))
  ) {
    throw new RangeError("window height state is invalid");
  }
}

function validSerializedWindowHeights(
  heights: readonly WindowHeight[] | undefined,
  windowCount: number,
): boolean {
  if (heights === undefined) {
    return true;
  }

  if (heights.length !== windowCount) {
    return false;
  }

  try {
    assertValidWindowHeights(heights);
    return !heights.every(isDefaultWindowHeight);
  } catch {
    return false;
  }
}

function sameWindowHeight(left: WindowHeight, right: WindowHeight): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "auto":
      return right.kind === "auto" && left.weight === right.weight;
    case "fixed":
      return right.kind === "fixed" && left.clientHeight === right.clientHeight;
    case "preset":
      return right.kind === "preset" && left.index === right.index;
  }
}

function sameColumnWindowHeights(
  left: LayoutColumnSnapshot,
  right: LayoutColumnSnapshot,
): boolean {
  if (left.windowIds.length !== right.windowIds.length) {
    return false;
  }

  if (!left.windowHeights && !right.windowHeights) {
    return true;
  }

  for (let index = 0; index < left.windowIds.length; index += 1) {
    const leftHeight = left.windowHeights?.[index] ?? automaticWindowHeight();
    const rightHeight = right.windowHeights?.[index] ?? automaticWindowHeight();

    if (!sameWindowHeight(leftHeight, rightHeight)) {
      return false;
    }
  }

  return true;
}

function setMutableColumnWindowHeights(
  column: LayoutColumn,
  heights: readonly WindowHeight[],
): void {
  const compact = compactWindowHeights(heights);

  if (compact) {
    column.windowHeights = compact;
  } else {
    delete column.windowHeights;
  }
}

function removeMutableColumnWindowHeight(
  column: LayoutColumn,
  index: number,
): void {
  if (!column.windowHeights) {
    return;
  }

  const heights = column.windowHeights.map(cloneWindowHeight);
  heights.splice(index, 1);

  if (heights.length === 1 && heights[0]?.kind === "auto") {
    heights[0] = automaticWindowHeight();
  }

  setMutableColumnWindowHeights(column, heights);
}

function removeMutableColumnWindow(
  column: LayoutColumn,
  index: number,
): WindowId | undefined {
  const selectedWindowId =
    column.selectedWindowId === column.windowIds[index]
      ? (column.windowIds[index + 1] ?? column.windowIds[index - 1])
      : column.selectedWindowId;
  removeMutableColumnWindowHeight(column, index);
  const [removed] = column.windowIds.splice(index, 1);

  if (column.windowIds.length > 0) {
    if (selectedWindowId === undefined) {
      throw new Error("a retained column must have a selected window");
    }

    column.selectedWindowId = selectedWindowId;
  }

  return removed;
}

function appendDefaultMutableWindowHeight(column: LayoutColumn): void {
  if (column.windowHeights) {
    column.windowHeights.push(automaticWindowHeight());
  }
}

function swapMutableColumnWindowHeights(
  column: LayoutColumn,
  first: number,
  second: number,
): void {
  if (!column.windowHeights) {
    return;
  }

  const firstHeight = column.windowHeights[first];
  const secondHeight = column.windowHeights[second];

  if (!firstHeight || !secondHeight) {
    throw new Error("window height state is out of sync");
  }

  column.windowHeights[first] = secondHeight;
  column.windowHeights[second] = firstHeight;
}

function withoutSnapshotWindowHeight(
  column: LayoutColumnSnapshot,
  index: number,
  normalizeSingleton = true,
): WindowHeight[] | undefined {
  if (!column.windowHeights) {
    return undefined;
  }

  const heights = column.windowHeights.map(cloneWindowHeight);
  heights.splice(index, 1);

  if (
    normalizeSingleton &&
    heights.length === 1 &&
    heights[0]?.kind === "auto"
  ) {
    heights[0] = automaticWindowHeight();
  }

  return compactWindowHeights(heights);
}

function assertValidWidth(width: ColumnWidth): void {
  if (!validWidth(width)) {
    throw new RangeError("column width must be finite and greater than zero");
  }
}

function validWidth(width: unknown): width is ColumnWidth {
  if (!isRecord(width)) {
    return false;
  }

  const kind = width["kind"];
  const value = width["value"];
  return (
    (kind === "fixed" || kind === "proportion") &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function validWindowHeight(height: unknown): height is WindowHeight {
  if (!isRecord(height)) {
    return false;
  }

  switch (height["kind"]) {
    case "auto":
      return (
        typeof height["weight"] === "number" &&
        Number.isFinite(height["weight"]) &&
        height["weight"] > 0
      );
    case "fixed":
      return (
        typeof height["clientHeight"] === "number" &&
        Number.isFinite(height["clientHeight"]) &&
        height["clientHeight"] > 0
      );
    case "preset":
      return (
        typeof height["index"] === "number" &&
        Number.isInteger(height["index"]) &&
        height["index"] >= 0
      );
    default:
      return false;
  }
}

function assertValidViewportOffset(viewportOffset: number): void {
  if (!Number.isFinite(viewportOffset)) {
    throw new RangeError("viewport offset must be finite");
  }
}
