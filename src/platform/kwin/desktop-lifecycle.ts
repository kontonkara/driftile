import type { KWinWindow, KWinWorkspace } from "./api";

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
    }

    return mutation;
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

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
