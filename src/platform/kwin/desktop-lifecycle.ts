import type { KWinOutput, KWinWindow, KWinWorkspace } from "./api";

export type DesktopReorderDirection = -1 | 1;

export interface DesktopLifecycleSnapshot {
  readonly desktopIds: readonly string[];
  readonly occupiedDesktopIds: ReadonlySet<string>;
  readonly ownedDesktopIds: ReadonlySet<string>;
  readonly removalSafe: boolean;
  readonly selectedDesktopIds: ReadonlySet<string>;
}

export type DesktopLifecycleMutation =
  | { readonly kind: "create"; readonly position: number }
  | { readonly desktopId: string; readonly kind: "remove" };

interface PendingMutation {
  readonly beforeDesktopIds: readonly string[];
  readonly mutation: DesktopLifecycleMutation;
}

interface DesktopOrderSnapshot {
  readonly desktopIds: readonly string[];
  readonly occupiedDesktopIds: ReadonlySet<string>;
  readonly selectedDesktopId: string;
  readonly selectionFingerprint: readonly string[];
  readonly windowDesktopFingerprint: readonly string[];
}

interface TrackedWindow {
  readonly handleDesktopsChanged: () => void;
  readonly source: KWinWindow;
}

export interface DesktopLifecycleEvents {
  readonly changed: () => void;
}

export function planDesktopLifecycle(
  snapshot: DesktopLifecycleSnapshot,
): DesktopLifecycleMutation | null {
  const lastDesktopId = snapshot.desktopIds[snapshot.desktopIds.length - 1];

  if (!lastDesktopId) {
    return null;
  }

  if (snapshot.occupiedDesktopIds.has(lastDesktopId)) {
    return { kind: "create", position: snapshot.desktopIds.length };
  }

  if (snapshot.desktopIds.length < 2 || !snapshot.removalSafe) {
    return null;
  }

  const previousDesktopId = snapshot.desktopIds[snapshot.desktopIds.length - 2];

  if (
    !previousDesktopId ||
    snapshot.occupiedDesktopIds.has(previousDesktopId) ||
    snapshot.selectedDesktopIds.has(lastDesktopId) ||
    !snapshot.ownedDesktopIds.has(lastDesktopId)
  ) {
    return null;
  }

  return { desktopId: lastDesktopId, kind: "remove" };
}

export class DesktopLifecycle {
  private dirty = false;
  private readonly events: DesktopLifecycleEvents;
  private mutationCallActive = false;
  private readonly ownedDesktopIds = new Set<string>();
  private pendingMutation: PendingMutation | null = null;
  private started = false;
  private readonly trackedWindows = new Map<KWinWindow, TrackedWindow>();
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, events: DesktopLifecycleEvents) {
    this.events = events;
    this.workspace = workspace;
  }

  get ownedDesktopCount(): number {
    return this.ownedDesktopIds.size;
  }

  get pendingWork(): boolean {
    return this.dirty && this.pendingMutation === null;
  }

  get unsettled(): boolean {
    return (
      this.dirty || this.pendingMutation !== null || this.mutationCallActive
    );
  }

  start(): void {
    if (
      this.started ||
      !this.workspace.desktopsChanged ||
      typeof this.workspace.createDesktop !== "function" ||
      typeof this.workspace.removeDesktop !== "function"
    ) {
      return;
    }

    this.started = true;
    this.workspace.desktopsChanged.connect(this.handleDesktopsChanged);
    this.workspace.currentDesktopChanged.connect(this.handleSelectionChanged);
    this.workspace.screensChanged?.connect(this.handleSelectionChanged);
    this.workspace.windowAdded.connect(this.handleWindowAdded);
    this.workspace.windowRemoved.connect(this.handleWindowRemoved);

    for (const window of this.workspace.stackingOrder) {
      this.observeWindow(window);
    }

    this.dirty = true;
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.workspace.desktopsChanged?.disconnect(this.handleDesktopsChanged);
    this.workspace.currentDesktopChanged.disconnect(
      this.handleSelectionChanged,
    );
    this.workspace.screensChanged?.disconnect(this.handleSelectionChanged);
    this.workspace.windowAdded.disconnect(this.handleWindowAdded);
    this.workspace.windowRemoved.disconnect(this.handleWindowRemoved);

    for (const tracked of this.trackedWindows.values()) {
      tracked.source.desktopsChanged?.disconnect(tracked.handleDesktopsChanged);
    }

    this.trackedWindows.clear();
    this.ownedDesktopIds.clear();
    this.pendingMutation = null;
    this.mutationCallActive = false;
    this.dirty = false;
  }

  reconcile(canMutate = true): DesktopLifecycleMutation | null {
    if (
      !this.started ||
      !this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      !canMutate ||
      !this.workspace.desktopsChanged
    ) {
      return null;
    }

    const snapshot = this.snapshot();

    if (!snapshot) {
      this.dirty = false;
      return null;
    }

    const mutation = planDesktopLifecycle(snapshot);

    if (!mutation || !this.mutationIsAvailable(mutation)) {
      this.dirty = false;
      return null;
    }

    const confirmation = this.snapshot();

    if (
      !confirmation ||
      !mutationsEqual(planDesktopLifecycle(confirmation), mutation)
    ) {
      this.dirty = true;
      return null;
    }

    const beforeDesktopIds = confirmation.desktopIds;
    const pending = { beforeDesktopIds, mutation };
    this.pendingMutation = pending;
    this.dirty = false;

    try {
      this.mutationCallActive = true;

      if (mutation.kind === "create") {
        this.workspace.createDesktop?.(mutation.position, "");
      } else {
        const desktop = this.workspace.desktops.find(
          (candidate) => candidate.id === mutation.desktopId,
        );

        if (!desktop) {
          this.pendingMutation = null;
          this.dirty = true;
          return null;
        }

        this.workspace.removeDesktop?.(desktop);
      }
    } catch (error) {
      this.pendingMutation = null;
      console.warn(
        `[driftile] desktop lifecycle mutation failed kind=${mutation.kind} error=${String(error)}`,
      );
    } finally {
      this.mutationCallActive = false;
      this.settleMutationAfterCall(pending);

      if (this.dirty) {
        this.events.changed();
      }
    }

    return mutation;
  }

  moveSelectedDesktop(
    output: KWinOutput,
    direction: DesktopReorderDirection,
  ): boolean {
    if (
      !this.started ||
      this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      typeof this.workspace.moveDesktop !== "function" ||
      !this.workspace.desktopsChanged
    ) {
      return false;
    }

    const before = this.desktopOrderSnapshot(output);

    if (!before) {
      return false;
    }

    const sourceIndex = before.desktopIds.indexOf(before.selectedDesktopId);
    const targetIndex = sourceIndex + direction;
    const trailingIndex = before.desktopIds.length - 1;
    const trailingDesktopId = before.desktopIds[trailingIndex];

    if (
      sourceIndex < 0 ||
      sourceIndex === trailingIndex ||
      targetIndex < 0 ||
      targetIndex >= trailingIndex ||
      !trailingDesktopId ||
      before.occupiedDesktopIds.has(trailingDesktopId)
    ) {
      return false;
    }

    const confirmation = this.desktopOrderSnapshot(output);

    if (
      !confirmation ||
      confirmation.selectedDesktopId !== before.selectedDesktopId ||
      !sameStrings(confirmation.desktopIds, before.desktopIds) ||
      !sameStrings(
        confirmation.selectionFingerprint,
        before.selectionFingerprint,
      ) ||
      !sameStrings(
        confirmation.windowDesktopFingerprint,
        before.windowDesktopFingerprint,
      ) ||
      confirmation.occupiedDesktopIds.has(trailingDesktopId)
    ) {
      return false;
    }

    const desktop = this.workspace.desktops[sourceIndex];

    if (desktop?.id !== before.selectedDesktopId) {
      return false;
    }

    const expectedDesktopIds = movedString(
      before.desktopIds,
      sourceIndex,
      targetIndex,
    );

    let callFailed = false;

    try {
      this.mutationCallActive = true;
      this.workspace.moveDesktop(desktop, targetIndex);
    } catch (error) {
      callFailed = true;
      console.warn(
        `[driftile] desktop reorder failed desktop=${before.selectedDesktopId} position=${String(targetIndex)} error=${String(error)}`,
      );
    } finally {
      this.mutationCallActive = false;
    }

    const after = this.desktopOrderSnapshot(output);

    if (
      callFailed ||
      !after ||
      after.selectedDesktopId !== before.selectedDesktopId ||
      !sameStrings(after.desktopIds, expectedDesktopIds) ||
      !sameStrings(after.selectionFingerprint, before.selectionFingerprint) ||
      !sameStrings(
        after.windowDesktopFingerprint,
        before.windowDesktopFingerprint,
      ) ||
      after.occupiedDesktopIds.has(trailingDesktopId)
    ) {
      if (
        !after ||
        !sameStrings(after.desktopIds, before.desktopIds) ||
        !sameStrings(after.selectionFingerprint, before.selectionFingerprint) ||
        !sameStrings(
          after.windowDesktopFingerprint,
          before.windowDesktopFingerprint,
        )
      ) {
        this.publishChanged();
      }

      return false;
    }

    this.publishChanged();
    return true;
  }

  private readonly handleDesktopsChanged = (): void => {
    const liveDesktopIds = this.workspace.desktops.map((desktop) => desktop.id);
    const liveDesktopIdSet = new Set(liveDesktopIds);

    for (const id of this.ownedDesktopIds) {
      if (!liveDesktopIdSet.has(id)) {
        this.ownedDesktopIds.delete(id);
      }
    }

    const pending = this.pendingMutation;

    if (pending && !sameStrings(pending.beforeDesktopIds, liveDesktopIds)) {
      if (pending.mutation.kind === "create" && this.mutationCallActive) {
        const createdId = appendedDesktopId(
          pending.beforeDesktopIds,
          liveDesktopIds,
        );

        if (createdId) {
          this.ownedDesktopIds.add(createdId);
        }
      }

      this.pendingMutation = null;
    }

    this.publishChanged();
  };

  private readonly handleSelectionChanged = (): void => {
    this.publishChanged();
  };

  private readonly handleWindowAdded = (window: KWinWindow): void => {
    this.observeWindow(window);
    this.publishChanged();
  };

  private readonly handleWindowRemoved = (window: KWinWindow): void => {
    const tracked = this.trackedWindows.get(window);

    if (tracked) {
      tracked.source.desktopsChanged?.disconnect(tracked.handleDesktopsChanged);
      this.trackedWindows.delete(window);
    }

    this.publishChanged();
  };

  private mutationIsAvailable(mutation: DesktopLifecycleMutation): boolean {
    return mutation.kind === "create"
      ? typeof this.workspace.createDesktop === "function"
      : typeof this.workspace.removeDesktop === "function";
  }

  private settleMutationAfterCall(pending: PendingMutation): void {
    if (this.pendingMutation !== pending) {
      return;
    }

    try {
      const liveDesktopIds = this.workspace.desktops.map(
        (desktop) => desktop.id,
      );

      if (!sameStrings(pending.beforeDesktopIds, liveDesktopIds)) {
        const liveDesktopIdSet = new Set(liveDesktopIds);

        for (const id of this.ownedDesktopIds) {
          if (!liveDesktopIdSet.has(id)) {
            this.ownedDesktopIds.delete(id);
          }
        }

        if (pending.mutation.kind === "create") {
          const createdId = appendedDesktopId(
            pending.beforeDesktopIds,
            liveDesktopIds,
          );

          if (createdId) {
            this.ownedDesktopIds.add(createdId);
          }
        }
      }
    } catch (error) {
      console.warn(
        `[driftile] desktop lifecycle settlement failed error=${String(error)}`,
      );
    }

    this.pendingMutation = null;
    this.dirty = false;
  }

  private observeWindow(window: KWinWindow): void {
    if (this.trackedWindows.has(window)) {
      return;
    }

    const tracked: TrackedWindow = {
      handleDesktopsChanged: () => {
        this.publishChanged();
      },
      source: window,
    };

    this.trackedWindows.set(window, tracked);
    window.desktopsChanged?.connect(tracked.handleDesktopsChanged);
  }

  private publishChanged(): void {
    if (!this.started) {
      return;
    }

    this.dirty = true;
    this.events.changed();
  }

  private desktopOrderSnapshot(
    output: KWinOutput,
  ): DesktopOrderSnapshot | null {
    try {
      if (!this.workspace.screens.includes(output)) {
        return null;
      }

      const desktopIds = this.workspace.desktops.map((desktop) => desktop.id);
      const desktopIdSet = new Set(desktopIds);

      if (
        desktopIds.length === 0 ||
        desktopIdSet.size !== desktopIds.length ||
        desktopIds.some((id) => id.length === 0)
      ) {
        return null;
      }

      const occupiedDesktopIds = new Set<string>();
      const windowDesktopFingerprint: string[] = [];

      for (const tracked of this.trackedWindows.values()) {
        const window = tracked.source;

        if (window.deleted || window.desktopWindow || window.dock) {
          continue;
        }

        const id = String(window.internalId);

        if (id.length === 0) {
          return null;
        }

        if (window.onAllDesktops) {
          windowDesktopFingerprint.push(`${id}\u0000*`);
          continue;
        }

        const windowDesktopIds = window.desktops.map((desktop) => desktop.id);

        if (
          windowDesktopIds.length === 0 ||
          new Set(windowDesktopIds).size !== windowDesktopIds.length ||
          windowDesktopIds.some((id) => !desktopIdSet.has(id))
        ) {
          return null;
        }

        windowDesktopIds.sort();

        for (const id of windowDesktopIds) {
          occupiedDesktopIds.add(id);
        }

        windowDesktopFingerprint.push(
          `${id}\u0000${windowDesktopIds.join("\u0000")}`,
        );
      }

      windowDesktopFingerprint.sort();

      const selectionFingerprint: string[] = [];
      let selectedDesktopId = "";

      if (typeof this.workspace.currentDesktopForScreen === "function") {
        const outputNames = new Set<string>();

        for (const candidate of this.workspace.screens) {
          const selected = this.workspace.currentDesktopForScreen(candidate);

          if (
            candidate.name.length === 0 ||
            outputNames.has(candidate.name) ||
            !selected ||
            !desktopIdSet.has(selected.id)
          ) {
            return null;
          }

          outputNames.add(candidate.name);
          selectionFingerprint.push(`${candidate.name}\u0000${selected.id}`);

          if (candidate === output) {
            selectedDesktopId = selected.id;
          }
        }

        selectionFingerprint.sort();
      } else {
        const selected = this.workspace.currentDesktop;

        if (!selected || !desktopIdSet.has(selected.id)) {
          return null;
        }

        selectedDesktopId = selected.id;
        selectionFingerprint.push(`global\u0000${selected.id}`);
      }

      if (selectedDesktopId.length === 0) {
        return null;
      }

      return {
        desktopIds,
        occupiedDesktopIds,
        selectedDesktopId,
        selectionFingerprint,
        windowDesktopFingerprint,
      };
    } catch (error) {
      console.warn(
        `[driftile] desktop reorder snapshot failed error=${String(error)}`,
      );
      return null;
    }
  }

  private snapshot(): DesktopLifecycleSnapshot | null {
    try {
      const desktopIds = this.workspace.desktops.map((desktop) => desktop.id);
      const desktopIdSet = new Set(desktopIds);

      if (
        desktopIds.length === 0 ||
        desktopIdSet.size !== desktopIds.length ||
        desktopIds.some((id) => id.length === 0)
      ) {
        return null;
      }

      const occupiedDesktopIds = new Set<string>();
      let removalSafe = true;

      for (const tracked of this.trackedWindows.values()) {
        const window = tracked.source;

        if (window.deleted || window.desktopWindow || window.dock) {
          continue;
        }

        if (!window.desktopsChanged) {
          removalSafe = false;
        }

        if (window.onAllDesktops) {
          continue;
        }

        if (window.desktops.length === 0) {
          removalSafe = false;
          continue;
        }

        for (const desktop of window.desktops) {
          if (!desktopIdSet.has(desktop.id)) {
            removalSafe = false;
            continue;
          }

          occupiedDesktopIds.add(desktop.id);
        }
      }

      const selectedDesktopIds = new Set<string>();

      if (typeof this.workspace.currentDesktopForScreen === "function") {
        if (this.workspace.screens.length === 0) {
          removalSafe = false;
        }

        for (const output of this.workspace.screens) {
          const selected = this.workspace.currentDesktopForScreen(output);

          if (!selected || !desktopIdSet.has(selected.id)) {
            removalSafe = false;
            continue;
          }

          selectedDesktopIds.add(selected.id);
        }
      } else {
        const selected = this.workspace.currentDesktop;

        if (!selected || !desktopIdSet.has(selected.id)) {
          removalSafe = false;
        } else {
          selectedDesktopIds.add(selected.id);
        }
      }

      return {
        desktopIds,
        occupiedDesktopIds,
        ownedDesktopIds: this.ownedDesktopIds,
        removalSafe,
        selectedDesktopIds,
      };
    } catch (error) {
      console.warn(
        `[driftile] desktop lifecycle snapshot failed error=${String(error)}`,
      );
      return null;
    }
  }
}

function appendedDesktopId(
  before: readonly string[],
  after: readonly string[],
): string | null {
  if (after.length !== before.length + 1) {
    return null;
  }

  for (const [index, id] of before.entries()) {
    if (after[index] !== id) {
      return null;
    }
  }

  return after[after.length - 1] ?? null;
}

function mutationsEqual(
  left: DesktopLifecycleMutation | null,
  right: DesktopLifecycleMutation,
): boolean {
  return Boolean(
    left &&
    left.kind === right.kind &&
    (left.kind === "create"
      ? right.kind === "create" && left.position === right.position
      : right.kind === "remove" && left.desktopId === right.desktopId),
  );
}

function movedString(
  values: readonly string[],
  sourceIndex: number,
  targetIndex: number,
): readonly string[] {
  const moved = [...values];
  const [value] = moved.splice(sourceIndex, 1);

  if (value !== undefined) {
    moved.splice(targetIndex, 0, value);
  }

  return moved;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
