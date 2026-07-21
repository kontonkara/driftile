import type {
  KWinOutput,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "./api";

export type DesktopReorderDirection = -1 | 1;

export const NUMBERED_DESKTOP_REORDER_LIMIT = 9;

type DesktopReorderTarget =
  | { readonly direction: DesktopReorderDirection; readonly kind: "adjacent" }
  | { readonly index: number; readonly kind: "numbered" };

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

export interface DesktopCreationResult {
  readonly afterDesktopIds: readonly string[];
  readonly beforeDesktopIds: readonly string[];
  readonly desktop: KWinVirtualDesktop;
  readonly desktopId: string;
  readonly position: number;
}

interface PendingMutation {
  readonly beforeDesktopIds: readonly string[];
  createdDesktopId: string | null;
  readonly leadingDesktopCleanup: boolean;
  readonly mutation: DesktopLifecycleMutation;
  readonly reserveCreatedDesktop: boolean;
}

interface DesktopTopologySnapshot {
  readonly desktopIds: readonly string[];
  readonly desktops: readonly KWinVirtualDesktop[];
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

export interface DesktopLifecycleOptions {
  readonly keepEmptyDesktopAboveFirst?: boolean;
}

export function planDesktopLifecycle(
  snapshot: DesktopLifecycleSnapshot,
  keepEmptyDesktopAboveFirst = false,
): DesktopLifecycleMutation | null {
  const lastDesktopId = snapshot.desktopIds[snapshot.desktopIds.length - 1];

  if (!lastDesktopId) {
    return null;
  }

  if (!keepEmptyDesktopAboveFirst) {
    if (snapshot.occupiedDesktopIds.has(lastDesktopId)) {
      return { kind: "create", position: snapshot.desktopIds.length };
    }

    if (snapshot.desktopIds.length < 2 || !snapshot.removalSafe) {
      return null;
    }

    const previousDesktopId =
      snapshot.desktopIds[snapshot.desktopIds.length - 2];

    if (
      previousDesktopId &&
      !snapshot.occupiedDesktopIds.has(previousDesktopId) &&
      !snapshot.selectedDesktopIds.has(lastDesktopId) &&
      snapshot.ownedDesktopIds.has(lastDesktopId)
    ) {
      return { desktopId: lastDesktopId, kind: "remove" };
    }

    const removableInteriorDesktopId = firstRemovableOwnedDesktopInRange(
      snapshot,
      0,
      snapshot.desktopIds.length - 2,
    );

    return removableInteriorDesktopId
      ? { desktopId: removableInteriorDesktopId, kind: "remove" }
      : null;
  }

  const firstDesktopId = snapshot.desktopIds[0];

  if (!firstDesktopId) {
    return null;
  }

  if (snapshot.occupiedDesktopIds.has(firstDesktopId)) {
    return { kind: "create", position: 0 };
  }

  if (snapshot.desktopIds.length === 1) {
    return { kind: "create", position: 1 };
  }

  if (snapshot.occupiedDesktopIds.has(lastDesktopId)) {
    return { kind: "create", position: snapshot.desktopIds.length };
  }

  if (!snapshot.removalSafe || snapshot.desktopIds.length < 3) {
    return null;
  }

  const secondDesktopId = snapshot.desktopIds[1];

  if (secondDesktopId && !snapshot.occupiedDesktopIds.has(secondDesktopId)) {
    const removableDesktopId = firstRemovableOwnedDesktop(snapshot, [
      firstDesktopId,
      secondDesktopId,
    ]);

    if (removableDesktopId) {
      return { desktopId: removableDesktopId, kind: "remove" };
    }
  }

  const previousDesktopId = snapshot.desktopIds[snapshot.desktopIds.length - 2];

  if (
    previousDesktopId &&
    !snapshot.occupiedDesktopIds.has(previousDesktopId)
  ) {
    const removableDesktopId = firstRemovableOwnedDesktop(snapshot, [
      lastDesktopId,
      previousDesktopId,
    ]);

    if (removableDesktopId) {
      return { desktopId: removableDesktopId, kind: "remove" };
    }
  }

  const removableInteriorDesktopId = firstRemovableOwnedDesktopInRange(
    snapshot,
    1,
    snapshot.desktopIds.length - 2,
  );

  return removableInteriorDesktopId
    ? { desktopId: removableInteriorDesktopId, kind: "remove" }
    : null;
}

export class DesktopLifecycle {
  private readonly createdDesktopReservations = new Map<
    string,
    DesktopCreationResult
  >();
  private dirty = false;
  private readonly events: DesktopLifecycleEvents;
  private keepEmptyDesktopAboveFirstValue: boolean;
  private leadingDesktopCleanupPending = false;
  private mutationCallActive = false;
  private readonly ownedDesktopIds = new Set<string>();
  private pendingMutation: PendingMutation | null = null;
  private readonly retainedDesktopIds = new Set<string>();
  private readonly reservedCreatedDesktopIds = new Set<string>();
  private started = false;
  private readonly trackedWindows = new Map<KWinWindow, TrackedWindow>();
  private readonly workspace: KWinWorkspace;

  constructor(
    workspace: KWinWorkspace,
    events: DesktopLifecycleEvents,
    options: DesktopLifecycleOptions = {},
  ) {
    this.events = events;
    this.keepEmptyDesktopAboveFirstValue =
      options.keepEmptyDesktopAboveFirst ?? false;
    this.workspace = workspace;
  }

  get keepEmptyDesktopAboveFirst(): boolean {
    return this.keepEmptyDesktopAboveFirstValue;
  }

  get ownedDesktopCount(): number {
    return this.ownedDesktopIds.size;
  }

  get pendingWork(): boolean {
    return (
      this.dirty &&
      this.pendingMutation === null &&
      this.reservedCreatedDesktopIds.size === 0
    );
  }

  get unsettled(): boolean {
    return (
      this.dirty ||
      this.pendingMutation !== null ||
      this.mutationCallActive ||
      this.reservedCreatedDesktopIds.size > 0
    );
  }

  setKeepEmptyDesktopAboveFirst(enabled: boolean): boolean {
    if (this.keepEmptyDesktopAboveFirstValue === enabled) {
      return false;
    }

    this.keepEmptyDesktopAboveFirstValue = enabled;
    this.leadingDesktopCleanupPending = !enabled;
    this.publishChanged();
    return true;
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
    this.createdDesktopReservations.clear();
    this.ownedDesktopIds.clear();
    this.pendingMutation = null;
    this.retainedDesktopIds.clear();
    this.reservedCreatedDesktopIds.clear();
    this.mutationCallActive = false;
    this.dirty = false;
  }

  createDesktopAtPosition(
    position: number,
    expectedDesktopIds: readonly string[],
  ): DesktopCreationResult | null {
    return this.createDesktopAtPositionWithRetention(
      position,
      expectedDesktopIds,
      false,
    );
  }

  createRetainedDesktopAtPosition(
    position: number,
    expectedDesktopIds: readonly string[],
  ): DesktopCreationResult | null {
    return this.createDesktopAtPositionWithRetention(
      position,
      expectedDesktopIds,
      true,
    );
  }

  private createDesktopAtPositionWithRetention(
    position: number,
    expectedDesktopIds: readonly string[],
    retain: boolean,
  ): DesktopCreationResult | null {
    if (
      !this.started ||
      this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      this.reservedCreatedDesktopIds.size > 0 ||
      typeof this.workspace.createDesktop !== "function" ||
      typeof this.workspace.removeDesktop !== "function" ||
      !this.workspace.desktopsChanged ||
      !Number.isInteger(position)
    ) {
      return null;
    }

    const before = this.desktopTopologySnapshot();

    if (
      !before ||
      position < 0 ||
      position > before.desktopIds.length ||
      !validDesktopIds(expectedDesktopIds) ||
      !sameStrings(before.desktopIds, expectedDesktopIds)
    ) {
      return null;
    }

    const confirmation = this.desktopTopologySnapshot();

    if (!confirmation || !sameDesktopTopology(confirmation, before)) {
      return null;
    }

    const pending: PendingMutation = {
      beforeDesktopIds: confirmation.desktopIds,
      createdDesktopId: null,
      leadingDesktopCleanup: false,
      mutation: { kind: "create", position },
      reserveCreatedDesktop: true,
    };
    this.pendingMutation = pending;

    let callFailed = false;

    try {
      this.mutationCallActive = true;
      this.workspace.createDesktop(position, "");
    } catch (error) {
      callFailed = true;
      console.warn(
        `[driftile] intentional desktop creation failed position=${String(position)} error=${String(error)}`,
      );
    } finally {
      this.mutationCallActive = false;
      this.settleMutationAfterCall(pending);
    }

    const after = this.desktopTopologySnapshot();
    const createdDesktop = after
      ? insertedDesktop(confirmation, after, position)
      : null;

    if (
      callFailed ||
      !after ||
      !createdDesktop ||
      pending.createdDesktopId !== createdDesktop.id ||
      !this.ownedDesktopIds.has(createdDesktop.id) ||
      !this.reservedCreatedDesktopIds.has(createdDesktop.id)
    ) {
      if (pending.createdDesktopId) {
        this.reservedCreatedDesktopIds.delete(pending.createdDesktopId);
      }

      if (after && !sameStrings(after.desktopIds, confirmation.desktopIds)) {
        this.publishChanged();
      }

      return null;
    }

    const result = Object.freeze({
      afterDesktopIds: Object.freeze([...after.desktopIds]),
      beforeDesktopIds: Object.freeze([...confirmation.desktopIds]),
      desktop: createdDesktop,
      desktopId: createdDesktop.id,
      position,
    });
    if (retain) {
      this.retainedDesktopIds.add(createdDesktop.id);
      this.reservedCreatedDesktopIds.delete(createdDesktop.id);
    } else {
      this.createdDesktopReservations.set(createdDesktop.id, result);
    }

    this.publishChanged();

    return result;
  }

  removeDesktopExactly(
    desktopId: string,
    expectedDesktopIds: readonly string[],
    expectedName: string,
  ): boolean {
    if (
      !this.started ||
      this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      this.reservedCreatedDesktopIds.size > 0 ||
      typeof this.workspace.removeDesktop !== "function" ||
      !this.workspace.desktopsChanged ||
      typeof desktopId !== "string" ||
      desktopId.length === 0 ||
      typeof expectedName !== "string"
    ) {
      return false;
    }

    const before = this.desktopTopologySnapshot();
    const beforeSnapshot = this.snapshot();
    const removalIndex = before?.desktopIds.indexOf(desktopId) ?? -1;
    const desktop = before?.desktops[removalIndex];

    if (
      !before ||
      !beforeSnapshot ||
      !validDesktopIds(expectedDesktopIds) ||
      !sameStrings(before.desktopIds, expectedDesktopIds) ||
      removalIndex < 0 ||
      removalIndex >= before.desktopIds.length - 1 ||
      (this.keepEmptyDesktopAboveFirstValue && removalIndex === 0) ||
      !desktop ||
      desktop.id !== desktopId ||
      (desktop.name ?? "") !== expectedName ||
      !beforeSnapshot.removalSafe ||
      beforeSnapshot.occupiedDesktopIds.has(desktopId) ||
      beforeSnapshot.selectedDesktopIds.has(desktopId)
    ) {
      return false;
    }

    const confirmation = this.desktopTopologySnapshot();
    const confirmationSnapshot = this.snapshot();

    if (
      !confirmation ||
      !confirmationSnapshot ||
      !sameDesktopTopology(confirmation, before) ||
      confirmation.desktops[removalIndex] !== desktop ||
      (desktop.name ?? "") !== expectedName ||
      !confirmationSnapshot.removalSafe ||
      confirmationSnapshot.occupiedDesktopIds.has(desktopId) ||
      confirmationSnapshot.selectedDesktopIds.has(desktopId)
    ) {
      return false;
    }

    const pending: PendingMutation = {
      beforeDesktopIds: confirmation.desktopIds,
      createdDesktopId: null,
      leadingDesktopCleanup: false,
      mutation: { desktopId, kind: "remove" },
      reserveCreatedDesktop: false,
    };
    this.pendingMutation = pending;
    let callFailed = false;

    try {
      this.mutationCallActive = true;
      this.workspace.removeDesktop(desktop);
    } catch (error) {
      callFailed = true;
      console.warn(
        `[driftile] intentional desktop removal failed desktop=${desktopId} error=${String(error)}`,
      );
    } finally {
      this.mutationCallActive = false;
      this.settleMutationAfterCall(pending);
    }

    const after = this.desktopTopologySnapshot();
    const removed = Boolean(
      !callFailed &&
      after &&
      desktopWasRemovedExactly(
        confirmation.desktopIds,
        after.desktopIds,
        desktopId,
      ) &&
      sameDesktopObjectsAfterRemoval(
        confirmation.desktops,
        after.desktops,
        removalIndex,
      ),
    );

    if (!removed) {
      if (after && !sameStrings(after.desktopIds, confirmation.desktopIds)) {
        this.publishChanged();
      }

      return false;
    }

    this.createdDesktopReservations.delete(desktopId);
    this.ownedDesktopIds.delete(desktopId);
    this.retainedDesktopIds.delete(desktopId);
    this.reservedCreatedDesktopIds.delete(desktopId);
    this.publishChanged();
    return true;
  }

  commitCreatedDesktop(result: DesktopCreationResult): boolean {
    if (!this.validateCreatedDesktopReservation(result)) {
      return false;
    }

    this.createdDesktopReservations.delete(result.desktopId);
    this.reservedCreatedDesktopIds.delete(result.desktopId);
    this.publishChanged();
    return true;
  }

  validateCreatedDesktopReservation(result: DesktopCreationResult): boolean {
    if (!this.ownsCreatedDesktopReservation(result)) {
      return false;
    }

    const topology = this.desktopTopologySnapshot();

    if (!topology || !creationMatchesTopology(result, topology)) {
      this.invalidateCreatedDesktopReservation(result);
      return false;
    }

    return true;
  }

  rollbackCreatedDesktop(result: DesktopCreationResult): boolean {
    if (
      !this.started ||
      this.pendingMutation ||
      this.mutationCallActive ||
      typeof this.workspace.removeDesktop !== "function" ||
      !this.workspace.desktopsChanged ||
      !this.validateCreatedDesktopReservation(result)
    ) {
      return false;
    }

    const topology = this.desktopTopologySnapshot();

    if (!topology) {
      return false;
    }

    const snapshot = this.snapshot();

    if (
      !snapshot ||
      !snapshot.removalSafe ||
      snapshot.occupiedDesktopIds.has(result.desktopId) ||
      snapshot.selectedDesktopIds.has(result.desktopId)
    ) {
      return false;
    }

    const confirmation = this.desktopTopologySnapshot();
    const confirmationSnapshot = this.snapshot();

    if (
      !confirmation ||
      !creationMatchesTopology(result, confirmation) ||
      !confirmationSnapshot ||
      !confirmationSnapshot.removalSafe ||
      confirmationSnapshot.occupiedDesktopIds.has(result.desktopId) ||
      confirmationSnapshot.selectedDesktopIds.has(result.desktopId)
    ) {
      return false;
    }

    const pending: PendingMutation = {
      beforeDesktopIds: confirmation.desktopIds,
      createdDesktopId: null,
      leadingDesktopCleanup: false,
      mutation: { desktopId: result.desktopId, kind: "remove" },
      reserveCreatedDesktop: false,
    };
    this.pendingMutation = pending;
    let callFailed = false;

    try {
      this.mutationCallActive = true;
      this.workspace.removeDesktop(result.desktop);
    } catch (error) {
      callFailed = true;
      console.warn(
        `[driftile] created desktop rollback failed desktop=${result.desktopId} error=${String(error)}`,
      );
    } finally {
      this.mutationCallActive = false;
      this.settleMutationAfterCall(pending);
    }

    const after = this.desktopTopologySnapshot();
    const rolledBack = Boolean(
      !callFailed &&
      after &&
      sameStrings(after.desktopIds, result.beforeDesktopIds) &&
      sameDesktopObjectsAfterRemoval(
        confirmation.desktops,
        after.desktops,
        result.position,
      ),
    );

    if (!rolledBack) {
      if (!after || !creationMatchesTopology(result, after)) {
        this.invalidateCreatedDesktopReservation(result);
      }

      if (
        after &&
        !sameStrings(after.desktopIds, confirmation.desktopIds) &&
        !this.dirty
      ) {
        this.publishChanged();
      }

      return false;
    }

    this.createdDesktopReservations.delete(result.desktopId);
    this.reservedCreatedDesktopIds.delete(result.desktopId);
    this.ownedDesktopIds.delete(result.desktopId);

    if (!this.dirty) {
      this.publishChanged();
    }

    return true;
  }

  reconcile(canMutate = true): DesktopLifecycleMutation | null {
    if (
      !this.started ||
      !this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      this.reservedCreatedDesktopIds.size > 0 ||
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

    const mutation = this.planMutation(snapshot);

    if (!mutation || !this.mutationIsAvailable(mutation)) {
      this.dirty = false;
      return null;
    }

    const confirmation = this.snapshot();

    if (
      !confirmation ||
      !mutationsEqual(this.planMutation(confirmation), mutation)
    ) {
      this.dirty = true;
      return null;
    }

    const beforeDesktopIds = confirmation.desktopIds;
    const pending = {
      beforeDesktopIds,
      createdDesktopId: null,
      leadingDesktopCleanup:
        !this.keepEmptyDesktopAboveFirstValue &&
        this.leadingDesktopCleanupPending &&
        mutation.kind === "remove" &&
        mutation.desktopId === beforeDesktopIds[0],
      mutation,
      reserveCreatedDesktop: false,
    };
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
    return this.reorderSelectedDesktop(output, {
      direction,
      kind: "adjacent",
    });
  }

  moveSelectedDesktopToIndex(output: KWinOutput, index: number): boolean {
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > NUMBERED_DESKTOP_REORDER_LIMIT
    ) {
      return false;
    }

    return this.reorderSelectedDesktop(output, { index, kind: "numbered" });
  }

  private reorderSelectedDesktop(
    output: KWinOutput,
    target: DesktopReorderTarget,
  ): boolean {
    if (
      !this.started ||
      this.dirty ||
      this.pendingMutation ||
      this.mutationCallActive ||
      this.reservedCreatedDesktopIds.size > 0 ||
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
    const firstMovableIndex = this.keepEmptyDesktopAboveFirstValue ? 1 : 0;
    const lastMovableIndex = before.desktopIds.length - 2;
    const targetIndex =
      target.kind === "adjacent"
        ? sourceIndex + target.direction
        : Math.min(firstMovableIndex + target.index - 1, lastMovableIndex);
    const leadingDesktopId = before.desktopIds[0];
    const trailingDesktopId = before.desktopIds[lastMovableIndex + 1];

    if (
      sourceIndex < firstMovableIndex ||
      sourceIndex > lastMovableIndex ||
      targetIndex < firstMovableIndex ||
      targetIndex > lastMovableIndex ||
      targetIndex === sourceIndex ||
      !leadingDesktopId ||
      !trailingDesktopId ||
      (this.keepEmptyDesktopAboveFirstValue &&
        before.occupiedDesktopIds.has(leadingDesktopId)) ||
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
      (this.keepEmptyDesktopAboveFirstValue &&
        confirmation.occupiedDesktopIds.has(leadingDesktopId)) ||
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
      (this.keepEmptyDesktopAboveFirstValue &&
        after.occupiedDesktopIds.has(leadingDesktopId)) ||
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
    const liveTopology = this.desktopTopologySnapshot();
    const liveDesktopIds =
      liveTopology?.desktopIds ??
      this.workspace.desktops.map((desktop) => desktop.id);
    const liveDesktopIdSet = new Set(liveDesktopIds);

    for (const id of this.ownedDesktopIds) {
      if (!liveDesktopIdSet.has(id)) {
        this.ownedDesktopIds.delete(id);
        this.retainedDesktopIds.delete(id);
        this.reservedCreatedDesktopIds.delete(id);
        this.createdDesktopReservations.delete(id);
      }
    }

    const pending = this.pendingMutation;
    let mutationFailedClosed = false;

    if (pending && !sameStrings(pending.beforeDesktopIds, liveDesktopIds)) {
      if (pending.mutation.kind === "create") {
        const createdId = this.mutationCallActive
          ? insertedDesktopId(
              pending.beforeDesktopIds,
              liveDesktopIds,
              pending.mutation.position,
            )
          : null;

        if (createdId) {
          this.ownedDesktopIds.add(createdId);
          pending.createdDesktopId = createdId;

          if (pending.reserveCreatedDesktop) {
            this.reservedCreatedDesktopIds.add(createdId);
          }
        } else {
          mutationFailedClosed = true;
        }
      } else if (
        pending.leadingDesktopCleanup &&
        desktopWasRemovedExactly(
          pending.beforeDesktopIds,
          liveDesktopIds,
          pending.mutation.desktopId,
        )
      ) {
        this.leadingDesktopCleanupPending = false;
      }

      this.pendingMutation = null;
    }

    this.invalidateStaleCreatedDesktopReservations(liveTopology);

    if (mutationFailedClosed) {
      this.dirty = false;

      if (this.started) {
        this.events.changed();
      }

      return;
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
          const createdId = insertedDesktopId(
            pending.beforeDesktopIds,
            liveDesktopIds,
            pending.mutation.position,
          );

          if (createdId) {
            this.ownedDesktopIds.add(createdId);
            pending.createdDesktopId = createdId;

            if (pending.reserveCreatedDesktop) {
              this.reservedCreatedDesktopIds.add(createdId);
            }
          }
        } else if (
          pending.leadingDesktopCleanup &&
          desktopWasRemovedExactly(
            pending.beforeDesktopIds,
            liveDesktopIds,
            pending.mutation.desktopId,
          )
        ) {
          this.leadingDesktopCleanupPending = false;
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

  private planMutation(
    snapshot: DesktopLifecycleSnapshot,
  ): DesktopLifecycleMutation | null {
    const planningOccupiedDesktopIds = new Set(snapshot.occupiedDesktopIds);

    for (const desktopId of this.retainedDesktopIds) {
      if (snapshot.desktopIds.includes(desktopId)) {
        planningOccupiedDesktopIds.add(desktopId);
      }
    }

    const planningSnapshot: DesktopLifecycleSnapshot = {
      ...snapshot,
      occupiedDesktopIds: planningOccupiedDesktopIds,
    };

    if (
      !this.keepEmptyDesktopAboveFirstValue &&
      this.leadingDesktopCleanupPending
    ) {
      const cleanup = planLeadingDesktopCleanup(planningSnapshot);

      if (cleanup) {
        return cleanup;
      }
    }

    return planDesktopLifecycle(
      planningSnapshot,
      this.keepEmptyDesktopAboveFirstValue,
    );
  }

  private desktopTopologySnapshot(): DesktopTopologySnapshot | null {
    try {
      const desktops = [...this.workspace.desktops];
      const desktopIds = desktops.map((desktop) => desktop.id);

      if (!validDesktopIds(desktopIds)) {
        return null;
      }

      return { desktopIds, desktops };
    } catch (error) {
      console.warn(
        `[driftile] desktop topology snapshot failed error=${String(error)}`,
      );
      return null;
    }
  }

  private invalidateCreatedDesktopReservation(
    result: DesktopCreationResult,
  ): void {
    if (this.createdDesktopReservations.get(result.desktopId) !== result) {
      return;
    }

    this.createdDesktopReservations.delete(result.desktopId);
    this.reservedCreatedDesktopIds.delete(result.desktopId);
  }

  private invalidateStaleCreatedDesktopReservations(
    topology: DesktopTopologySnapshot | null,
  ): void {
    for (const result of this.createdDesktopReservations.values()) {
      if (!topology || !creationMatchesTopology(result, topology)) {
        this.invalidateCreatedDesktopReservation(result);
      }
    }
  }

  private ownsCreatedDesktopReservation(
    result: DesktopCreationResult,
  ): boolean {
    return (
      this.started &&
      this.createdDesktopReservations.get(result.desktopId) === result &&
      this.reservedCreatedDesktopIds.has(result.desktopId) &&
      this.ownedDesktopIds.has(result.desktopId)
    );
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

      const removableOwnedDesktopIds = new Set<string>();

      for (const desktopId of this.ownedDesktopIds) {
        if (
          !this.reservedCreatedDesktopIds.has(desktopId) &&
          !this.retainedDesktopIds.has(desktopId)
        ) {
          removableOwnedDesktopIds.add(desktopId);
        }
      }

      return {
        desktopIds,
        occupiedDesktopIds,
        ownedDesktopIds: removableOwnedDesktopIds,
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

function creationMatchesTopology(
  result: DesktopCreationResult,
  topology: DesktopTopologySnapshot,
): boolean {
  return (
    sameStrings(topology.desktopIds, result.afterDesktopIds) &&
    topology.desktops[result.position] === result.desktop &&
    topology.desktopIds[result.position] === result.desktopId &&
    result.desktop.id === result.desktopId
  );
}

function desktopWasRemovedExactly(
  before: readonly string[],
  after: readonly string[],
  desktopId: string,
): boolean {
  if (after.length !== before.length - 1) {
    return false;
  }

  const removedIndex = before.indexOf(desktopId);

  if (removedIndex < 0) {
    return false;
  }

  return before.every(
    (id, index) =>
      index === removedIndex ||
      after[index < removedIndex ? index : index - 1] === id,
  );
}

function insertedDesktop(
  before: DesktopTopologySnapshot,
  after: DesktopTopologySnapshot,
  position: number,
): KWinVirtualDesktop | null {
  const createdDesktopId = insertedDesktopId(
    before.desktopIds,
    after.desktopIds,
    position,
  );
  const createdDesktop = after.desktops[position];

  if (
    !createdDesktopId ||
    !createdDesktop ||
    createdDesktop.id !== createdDesktopId ||
    before.desktops.includes(createdDesktop)
  ) {
    return null;
  }

  for (let index = 0; index < before.desktops.length; index += 1) {
    const afterIndex = index < position ? index : index + 1;

    if (after.desktops[afterIndex] !== before.desktops[index]) {
      return null;
    }
  }

  return createdDesktop;
}

function firstRemovableOwnedDesktop(
  snapshot: DesktopLifecycleSnapshot,
  desktopIds: readonly string[],
): string | null {
  return (
    desktopIds.find(
      (desktopId) =>
        snapshot.ownedDesktopIds.has(desktopId) &&
        !snapshot.occupiedDesktopIds.has(desktopId) &&
        !snapshot.selectedDesktopIds.has(desktopId),
    ) ?? null
  );
}

function firstRemovableOwnedDesktopInRange(
  snapshot: DesktopLifecycleSnapshot,
  firstIndex: number,
  lastIndex: number,
): string | null {
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const desktopId = snapshot.desktopIds[index];

    if (
      desktopId &&
      snapshot.ownedDesktopIds.has(desktopId) &&
      !snapshot.occupiedDesktopIds.has(desktopId) &&
      !snapshot.selectedDesktopIds.has(desktopId)
    ) {
      return desktopId;
    }
  }

  return null;
}

function insertedDesktopId(
  before: readonly string[],
  after: readonly string[],
  position: number,
): string | null {
  if (
    after.length !== before.length + 1 ||
    position < 0 ||
    position > before.length
  ) {
    return null;
  }

  for (let index = 0; index < position; index += 1) {
    if (after[index] !== before[index]) {
      return null;
    }
  }

  for (let index = position; index < before.length; index += 1) {
    if (after[index + 1] !== before[index]) {
      return null;
    }
  }

  const createdDesktopId = after[position];

  return createdDesktopId &&
    !before.includes(createdDesktopId) &&
    new Set(after).size === after.length
    ? createdDesktopId
    : null;
}

function planLeadingDesktopCleanup(
  snapshot: DesktopLifecycleSnapshot,
): DesktopLifecycleMutation | null {
  const leadingDesktopId = snapshot.desktopIds[0];

  if (
    !leadingDesktopId ||
    snapshot.desktopIds.length < 2 ||
    !snapshot.removalSafe ||
    snapshot.occupiedDesktopIds.has(leadingDesktopId) ||
    snapshot.selectedDesktopIds.has(leadingDesktopId) ||
    !snapshot.ownedDesktopIds.has(leadingDesktopId)
  ) {
    return null;
  }

  return { desktopId: leadingDesktopId, kind: "remove" };
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

function sameDesktopObjectsAfterRemoval(
  before: readonly KWinVirtualDesktop[],
  after: readonly KWinVirtualDesktop[],
  removedIndex: number,
): boolean {
  return (
    after.length === before.length - 1 &&
    before.every(
      (desktop, index) =>
        index === removedIndex ||
        after[index < removedIndex ? index : index - 1] === desktop,
    )
  );
}

function sameDesktopTopology(
  left: DesktopTopologySnapshot,
  right: DesktopTopologySnapshot,
): boolean {
  return (
    sameStrings(left.desktopIds, right.desktopIds) &&
    left.desktops.every((desktop, index) => right.desktops[index] === desktop)
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

function validDesktopIds(desktopIds: readonly string[]): boolean {
  return (
    desktopIds.length > 0 &&
    desktopIds.every(
      (desktopId) => typeof desktopId === "string" && desktopId.length > 0,
    ) &&
    new Set(desktopIds).size === desktopIds.length
  );
}
