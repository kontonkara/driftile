import { describe, expect, it, vi } from "vitest";
import {
  DesktopLifecycle,
  planDesktopLifecycle,
} from "../../../src/platform/kwin/desktop-lifecycle";
import type {
  KWinOutput,
  KWinSignal,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "../../../src/platform/kwin/api";

class Signal<TArguments extends unknown[]> implements KWinSignal<TArguments> {
  private readonly handlers = new Set<(...arguments_: TArguments) => void>();

  connect(handler: (...arguments_: TArguments) => void): void {
    this.handlers.add(handler);
  }

  disconnect(handler: (...arguments_: TArguments) => void): void {
    this.handlers.delete(handler);
  }

  emit(...arguments_: TArguments): void {
    for (const handler of this.handlers) {
      handler(...arguments_);
    }
  }
}

interface LifecycleFixture {
  readonly createCount: number;
  readonly createRequests: readonly number[];
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly lifecycle: DesktopLifecycle;
  readonly moveCount: number;
  readonly moveRequests: readonly {
    readonly desktopId: string;
    readonly position: number;
  }[];
  readonly outputs: readonly KWinOutput[];
  readonly removeCount: number;
  emitDesktopsChanged(): void;
  addWindow(window: KWinWindow): void;
  insertExternalDesktop(
    position: number,
    desktopId: string,
  ): KWinVirtualDesktop;
  removeExternalDesktop(desktopId: string): void;
  reconcile(): void;
  removeWindow(window: KWinWindow): void;
  selectedDesktop(output: KWinOutput): KWinVirtualDesktop | null;
  select(output: KWinOutput, desktop: KWinVirtualDesktop): void;
  setCreateCommits(enabled: boolean): void;
  setCreateAvailable(enabled: boolean): void;
  setCreateIdOverride(desktopId: string | null): void;
  setCreatePermutes(enabled: boolean): void;
  setCreatePositionOverride(position: number | null): void;
  setCreateSignals(enabled: boolean): void;
  setMoveHook(hook: (() => void) | null): void;
  setMoveMode(
    mode: "commit" | "reject" | "throw" | "unavailable" | "wrong",
  ): void;
  setRemoveMode(
    mode: "commit" | "reject" | "throw" | "unavailable" | "wrong",
  ): void;
  replaceDesktopIdentity(position: number): void;
}

function createLifecycleFixture(
  initialDesktops: readonly KWinVirtualDesktop[],
  initialWindows: readonly KWinWindow[] = [],
  outputCount = 1,
  keepEmptyDesktopAboveFirst = false,
): LifecycleFixture {
  const currentDesktopChanged = new Signal<
    [
      previous: KWinVirtualDesktop | null,
      current?: KWinVirtualDesktop | null,
      output?: KWinOutput,
    ]
  >();
  const desktopsChanged = new Signal<[]>();
  const screensChanged = new Signal<[]>();
  const windowAdded = new Signal<[window: KWinWindow]>();
  const windowRemoved = new Signal<[window: KWinWindow]>();
  const windowActivated = new Signal<[window: KWinWindow | null]>();
  const outputs = Array.from({ length: outputCount }, (_value, index) =>
    createOutput(`output-${String(index + 1)}`, index * 1000),
  );
  let desktops = [...initialDesktops];
  let windows = [...initialWindows];
  let createCommits = true;
  let createIdOverride: string | null = null;
  let createPermutes = false;
  let createPositionOverride: number | null = null;
  let createSignals = true;
  let createCount = 0;
  const createRequests: number[] = [];
  let moveCount = 0;
  let moveHook: (() => void) | null = null;
  let moveMode: "commit" | "reject" | "throw" | "wrong" = "commit";
  const moveRequests: Array<{ desktopId: string; position: number }> = [];
  let removeCount = 0;
  let removeMode: "commit" | "reject" | "throw" | "wrong" = "commit";
  let nextCreatedId = 1;
  const selected = new Map(
    outputs.map((output) => [output.name, desktops[0] ?? null]),
  );
  const createDesktop = (position: number): void => {
    createCount += 1;
    createRequests.push(position);

    if (!createCommits) {
      return;
    }

    if (createPermutes) {
      const first = desktops[0];
      const second = desktops[1];

      if (first && second) {
        desktops.splice(0, 2, second, first);
      }

      if (createSignals) {
        desktopsChanged.emit();
      }

      return;
    }

    const desktop = {
      id: createIdOverride ?? `created-${String(nextCreatedId)}`,
    };
    nextCreatedId += 1;
    const targetPosition = createPositionOverride ?? position;
    desktops.splice(
      Math.min(Math.max(targetPosition, 0), desktops.length),
      0,
      desktop,
    );

    if (createSignals) {
      desktopsChanged.emit();
    }
  };
  const moveDesktop = (desktop: KWinVirtualDesktop, position: number): void => {
    moveCount += 1;
    moveRequests.push({ desktopId: desktop.id, position });

    if (moveMode === "reject") {
      return;
    }

    if (moveMode === "throw") {
      throw new Error("injected desktop reorder failure");
    }

    const sourceIndex = desktops.findIndex(
      (candidate) => candidate.id === desktop.id,
    );

    if (sourceIndex < 0) {
      return;
    }

    const [moved] = desktops.splice(sourceIndex, 1);

    if (!moved) {
      return;
    }

    const targetPosition =
      moveMode === "wrong"
        ? Math.min(position + 1, desktops.length - 1)
        : position;
    desktops.splice(targetPosition, 0, moved);
    moveHook?.();
    desktopsChanged.emit();
  };
  const workspace: KWinWorkspace = {
    activeScreen: outputs[0] ?? null,
    activeWindow: null,
    clientArea: (_option, output) => output.geometry,
    createDesktop,
    currentDesktop: desktops[0] ?? null,
    currentDesktopChanged,
    currentDesktopForScreen: (output) => selected.get(output.name) ?? null,
    desktops,
    desktopsChanged,
    moveDesktop,
    removeDesktop: (desktop) => {
      removeCount += 1;

      if (removeMode === "reject") {
        return;
      }

      if (removeMode === "throw") {
        throw new Error("injected desktop removal failure");
      }

      if (removeMode === "wrong") {
        const wrongDesktop =
          desktops[desktops.length - 1] === desktop
            ? desktops[0]
            : desktops[desktops.length - 1];
        desktops = desktops.filter((candidate) => candidate !== wrongDesktop);
        desktopsChanged.emit();
        return;
      }

      desktops = desktops.filter((candidate) => candidate !== desktop);
      desktopsChanged.emit();
    },
    screens: outputs,
    screensChanged,
    stackingOrder: windows,
    windowActivated,
    windowAdded,
    windowRemoved,
  };

  Object.defineProperties(workspace, {
    desktops: {
      configurable: true,
      enumerable: true,
      get: () => desktops,
    },
    stackingOrder: {
      configurable: true,
      enumerable: true,
      get: () => windows,
    },
  });

  const lifecycle = new DesktopLifecycle(
    workspace,
    {
      changed: () => undefined,
    },
    {
      keepEmptyDesktopAboveFirst,
    },
  );
  lifecycle.start();

  return {
    addWindow: (window) => {
      windows.push(window);
      windowAdded.emit(window);
    },
    get createCount() {
      return createCount;
    },
    createRequests,
    get desktops() {
      return desktops;
    },
    emitDesktopsChanged: () => {
      desktopsChanged.emit();
    },
    insertExternalDesktop: (position, desktopId) => {
      const desktop = { id: desktopId };
      desktops.splice(
        Math.min(Math.max(position, 0), desktops.length),
        0,
        desktop,
      );
      desktopsChanged.emit();
      return desktop;
    },
    lifecycle,
    get moveCount() {
      return moveCount;
    },
    moveRequests,
    outputs,
    reconcile: () => {
      lifecycle.reconcile();
    },
    get removeCount() {
      return removeCount;
    },
    removeWindow: (window) => {
      windows = windows.filter((candidate) => candidate !== window);
      windowRemoved.emit(window);
    },
    removeExternalDesktop: (desktopId) => {
      desktops = desktops.filter((desktop) => desktop.id !== desktopId);
      desktopsChanged.emit();
    },
    selectedDesktop: (output) => selected.get(output.name) ?? null,
    select: (output, desktop) => {
      const previous = selected.get(output.name) ?? null;
      selected.set(output.name, desktop);
      currentDesktopChanged.emit(previous, desktop, output);
    },
    setCreateCommits: (enabled) => {
      createCommits = enabled;
    },
    setCreateAvailable: (enabled) => {
      Object.defineProperty(workspace, "createDesktop", {
        configurable: true,
        value: enabled ? createDesktop : undefined,
      });
    },
    setCreateIdOverride: (desktopId) => {
      createIdOverride = desktopId;
    },
    setCreatePermutes: (enabled) => {
      createPermutes = enabled;
    },
    setCreatePositionOverride: (position) => {
      createPositionOverride = position;
    },
    setCreateSignals: (enabled) => {
      createSignals = enabled;
    },
    setMoveHook: (hook) => {
      moveHook = hook;
    },
    setMoveMode: (mode) => {
      Object.defineProperty(workspace, "moveDesktop", {
        configurable: true,
        value: mode === "unavailable" ? undefined : moveDesktop,
      });

      if (mode !== "unavailable") {
        moveMode = mode;
      }
    },
    setRemoveMode: (mode) => {
      Object.defineProperty(workspace, "removeDesktop", {
        configurable: true,
        value:
          mode === "unavailable"
            ? undefined
            : (desktop: KWinVirtualDesktop) => {
                removeCount += 1;

                if (mode === "reject") {
                  return;
                }

                if (mode === "throw") {
                  throw new Error("injected desktop removal failure");
                }

                if (mode === "wrong") {
                  const wrongDesktop =
                    desktops[desktops.length - 1] === desktop
                      ? desktops[0]
                      : desktops[desktops.length - 1];
                  desktops = desktops.filter(
                    (candidate) => candidate !== wrongDesktop,
                  );
                  desktopsChanged.emit();
                  return;
                }

                desktops = desktops.filter(
                  (candidate) => candidate !== desktop,
                );
                desktopsChanged.emit();
              },
      });

      if (mode !== "unavailable") {
        removeMode = mode;
      }
    },
    replaceDesktopIdentity: (position) => {
      const desktop = desktops[position];

      if (!desktop) {
        return;
      }

      desktops.splice(position, 1, { id: desktop.id });
      desktopsChanged.emit();
    },
  };
}

function createOutput(name: string, x: number): KWinOutput {
  return {
    devicePixelRatio: 1,
    geometry: { height: 800, width: 1000, x, y: 0 },
    name,
  };
}

function createWindow(
  id: string,
  desktops: readonly KWinVirtualDesktop[],
  overrides: Partial<KWinWindow> = {},
): KWinWindow {
  return {
    clientGeometry: { height: 200, width: 300, x: 0, y: 0 },
    deleted: false,
    desktops,
    desktopsChanged: new Signal<[]>(),
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
    fullScreen: false,
    internalId: id,
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    modal: false,
    move: false,
    moveable: true,
    normalWindow: true,
    onAllDesktops: false,
    output: createOutput("output-1", 0),
    resize: false,
    resizeable: true,
    specialWindow: false,
    tile: null,
    transient: false,
    transientFor: null,
    utility: false,
    ...overrides,
  };
}

describe("planDesktopLifecycle", () => {
  it("appends a desktop when the shared tail is occupied", () => {
    expect(
      planDesktopLifecycle({
        desktopIds: ["desktop-1"],
        occupiedDesktopIds: new Set(["desktop-1"]),
        ownedDesktopIds: new Set(),
        removalSafe: true,
        selectedDesktopIds: new Set(["desktop-1"]),
      }),
    ).toEqual({ kind: "create", position: 1 });
  });

  it("removes only an owned redundant unselected tail", () => {
    expect(
      planDesktopLifecycle({
        desktopIds: ["desktop-1", "desktop-2"],
        occupiedDesktopIds: new Set(),
        ownedDesktopIds: new Set(["desktop-2"]),
        removalSafe: true,
        selectedDesktopIds: new Set(["desktop-1"]),
      }),
    ).toEqual({ desktopId: "desktop-2", kind: "remove" });
  });

  it("retains an unowned, occupied, or selected tail", () => {
    const base = {
      desktopIds: ["desktop-1", "desktop-2"],
      occupiedDesktopIds: new Set<string>(),
      ownedDesktopIds: new Set(["desktop-2"]),
      removalSafe: true,
      selectedDesktopIds: new Set<string>(),
    };

    expect(
      planDesktopLifecycle({ ...base, ownedDesktopIds: new Set() }),
    ).toBeNull();
    expect(
      planDesktopLifecycle({
        ...base,
        occupiedDesktopIds: new Set(["desktop-1"]),
      }),
    ).toBeNull();
    expect(
      planDesktopLifecycle({
        ...base,
        selectedDesktopIds: new Set(["desktop-2"]),
      }),
    ).toBeNull();
  });

  it("creates distinct empty leading and trailing boundaries when enabled", () => {
    expect(
      planDesktopLifecycle(
        {
          desktopIds: ["desktop-1", "desktop-2"],
          occupiedDesktopIds: new Set(["desktop-1"]),
          ownedDesktopIds: new Set(),
          removalSafe: true,
          selectedDesktopIds: new Set(["desktop-1"]),
        },
        true,
      ),
    ).toEqual({ kind: "create", position: 0 });
    expect(
      planDesktopLifecycle(
        {
          desktopIds: ["desktop-1", "desktop-2"],
          occupiedDesktopIds: new Set(["desktop-2"]),
          ownedDesktopIds: new Set(),
          removalSafe: true,
          selectedDesktopIds: new Set(["desktop-2"]),
        },
        true,
      ),
    ).toEqual({ kind: "create", position: 2 });
  });

  it("keeps at least two empty desktops when both boundaries are enabled", () => {
    const base = {
      occupiedDesktopIds: new Set<string>(),
      ownedDesktopIds: new Set<string>(),
      removalSafe: true,
      selectedDesktopIds: new Set(["desktop-1"]),
    };

    expect(
      planDesktopLifecycle({ ...base, desktopIds: ["desktop-1"] }, true),
    ).toEqual({ kind: "create", position: 1 });
    expect(
      planDesktopLifecycle(
        { ...base, desktopIds: ["desktop-1", "desktop-2"] },
        true,
      ),
    ).toBeNull();
  });

  it("removes only owned redundant empty boundary desktops", () => {
    const base = {
      desktopIds: ["external-leading", "owned-leading", "desktop-1", "tail"],
      occupiedDesktopIds: new Set(["desktop-1"]),
      ownedDesktopIds: new Set(["owned-leading", "tail"]),
      removalSafe: true,
      selectedDesktopIds: new Set(["desktop-1"]),
    };

    expect(planDesktopLifecycle(base, true)).toEqual({
      desktopId: "owned-leading",
      kind: "remove",
    });
    expect(
      planDesktopLifecycle(
        {
          ...base,
          desktopIds: ["external-leading", "desktop-1", "owned-tail", "tail"],
          ownedDesktopIds: new Set(["owned-tail"]),
        },
        true,
      ),
    ).toEqual({ desktopId: "owned-tail", kind: "remove" });
    expect(
      planDesktopLifecycle(
        {
          ...base,
          ownedDesktopIds: new Set(["owned-leading", "tail"]),
          selectedDesktopIds: new Set(["owned-leading"]),
        },
        true,
      ),
    ).toBeNull();
  });

  it("removes empty run-owned interior desktops while preserving boundaries", () => {
    const snapshot = {
      desktopIds: ["desktop-1", "owned-gap", "desktop-2", "owned-tail"],
      occupiedDesktopIds: new Set(["desktop-1", "desktop-2"]),
      ownedDesktopIds: new Set(["owned-gap", "owned-tail"]),
      removalSafe: true,
      selectedDesktopIds: new Set(["desktop-1"]),
    };

    expect(planDesktopLifecycle(snapshot)).toEqual({
      desktopId: "owned-gap",
      kind: "remove",
    });
    expect(
      planDesktopLifecycle(
        {
          ...snapshot,
          desktopIds: [
            "owned-leading",
            "desktop-1",
            "owned-gap",
            "desktop-2",
            "owned-tail",
          ],
          ownedDesktopIds: new Set([
            "owned-leading",
            "owned-gap",
            "owned-tail",
          ]),
        },
        true,
      ),
    ).toEqual({ desktopId: "owned-gap", kind: "remove" });
  });
});

describe("DesktopLifecycle", () => {
  it("exposes the live leading-boundary policy", () => {
    const fixture = createLifecycleFixture([{ id: "desktop-1" }]);

    expect(fixture.lifecycle.keepEmptyDesktopAboveFirst).toBe(false);
    fixture.lifecycle.setKeepEmptyDesktopAboveFirst(true);
    expect(fixture.lifecycle.keepEmptyDesktopAboveFirst).toBe(true);
  });

  it("creates an exact reserved desktop and retains ownership after commit", () => {
    const leading = { id: "desktop-1" };
    const trailing = { id: "desktop-2" };
    const fixture = createLifecycleFixture([leading, trailing], [], 1, true);
    fixture.reconcile();

    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      leading.id,
      trailing.id,
    ]);

    expect(result).toEqual({
      afterDesktopIds: [leading.id, "created-1", trailing.id],
      beforeDesktopIds: [leading.id, trailing.id],
      desktop: fixture.desktops[1],
      desktopId: "created-1",
      position: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.afterDesktopIds)).toBe(true);
    expect(Object.isFrozen(result?.beforeDesktopIds)).toBe(true);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    expect(fixture.lifecycle.pendingWork).toBe(false);
    expect(fixture.lifecycle.unsettled).toBe(true);

    fixture.reconcile();
    expect(fixture.desktops.map((desktop) => desktop.id)).toEqual([
      leading.id,
      "created-1",
      trailing.id,
    ]);
    expect(fixture.removeCount).toBe(0);

    if (!result) {
      throw new Error("missing intentional desktop creation result");
    }

    expect(
      fixture.lifecycle.validateCreatedDesktopReservation({ ...result }),
    ).toBe(false);
    expect(fixture.lifecycle.validateCreatedDesktopReservation(result)).toBe(
      true,
    );
    expect(fixture.lifecycle.commitCreatedDesktop(result)).toBe(true);
    expect(fixture.lifecycle.commitCreatedDesktop(result)).toBe(false);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    expect(fixture.lifecycle.pendingWork).toBe(true);

    fixture.reconcile();
    expect(fixture.desktops).toEqual([leading, trailing]);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("retains an explicitly created desktop until it is externally removed", () => {
    const leading = { id: "desktop-1" };
    const trailing = { id: "desktop-2" };
    const fixture = createLifecycleFixture([leading, trailing], [], 1, true);
    fixture.reconcile();

    const result = fixture.lifecycle.createRetainedDesktopAtPosition(1, [
      leading.id,
      trailing.id,
    ]);

    expect(result?.desktopId).toBe("created-1");
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    expect(result ? fixture.lifecycle.commitCreatedDesktop(result) : true).toBe(
      false,
    );

    fixture.reconcile();
    fixture.reconcile();
    expect(fixture.desktops.map((desktop) => desktop.id)).toEqual([
      leading.id,
      "created-1",
      trailing.id,
    ]);
    expect(fixture.removeCount).toBe(0);

    fixture.removeExternalDesktop("created-1");
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("preserves the automatic empty tail next to a retained desktop", () => {
    const primary = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [primary],
      [createWindow("window-1", [primary])],
    );
    fixture.reconcile();
    fixture.reconcile();
    const trailing = fixture.desktops[1];

    if (!trailing) {
      throw new Error("missing automatic trailing desktop");
    }

    const result = fixture.lifecycle.createRetainedDesktopAtPosition(1, [
      primary.id,
      trailing.id,
    ]);

    expect(result?.desktopId).toBe("created-2");
    fixture.reconcile();
    fixture.reconcile();
    expect(fixture.desktops.map((desktop) => desktop.id)).toEqual([
      primary.id,
      "created-2",
      trailing.id,
    ]);
    expect(fixture.removeCount).toBe(0);
  });

  it("removes only an exact empty unselected non-boundary desktop", () => {
    const first = { id: "desktop-1", name: "First" };
    const removable = { id: "desktop-2", name: "Remove me" };
    const trailing = { id: "desktop-3", name: "" };
    const fixture = createLifecycleFixture(
      [first, removable, trailing],
      [createWindow("window-1", [first])],
    );
    fixture.reconcile();

    expect(
      fixture.lifecycle.removeDesktopExactly(
        removable.id,
        [first.id, removable.id, trailing.id],
        removable.name,
      ),
    ).toBe(true);
    expect(fixture.desktops).toEqual([first, trailing]);
    expect(fixture.removeCount).toBe(1);
  });

  it("rejects protected, occupied, selected, stale, and mismatched removals", () => {
    const create = (keepLeading = false, outputCount = 1) => {
      const first = { id: "desktop-1", name: "First" };
      const middle = { id: "desktop-2", name: "Middle" };
      const trailing = { id: "desktop-3", name: "" };
      const fixture = createLifecycleFixture(
        [first, middle, trailing],
        [createWindow("window-1", [first])],
        outputCount,
        keepLeading,
      );
      fixture.reconcile();
      return { first, fixture, middle, trailing };
    };

    const stale = create();
    expect(
      stale.fixture.lifecycle.removeDesktopExactly(
        stale.middle.id,
        [stale.middle.id, stale.first.id, stale.trailing.id],
        stale.middle.name,
      ),
    ).toBe(false);
    expect(
      stale.fixture.lifecycle.removeDesktopExactly(
        stale.middle.id,
        [stale.first.id, stale.middle.id, stale.trailing.id],
        "stale name",
      ),
    ).toBe(false);
    expect(stale.fixture.removeCount).toBe(0);

    const protectedTrailing = create();
    expect(
      protectedTrailing.fixture.lifecycle.removeDesktopExactly(
        protectedTrailing.trailing.id,
        [
          protectedTrailing.first.id,
          protectedTrailing.middle.id,
          protectedTrailing.trailing.id,
        ],
        "",
      ),
    ).toBe(false);

    const protectedLeading = create(true);
    expect(
      protectedLeading.fixture.lifecycle.removeDesktopExactly(
        protectedLeading.first.id,
        [
          protectedLeading.first.id,
          protectedLeading.middle.id,
          protectedLeading.trailing.id,
        ],
        protectedLeading.first.name,
      ),
    ).toBe(false);

    const occupied = create();
    occupied.fixture.addWindow(
      createWindow("window-middle", [occupied.middle]),
    );
    occupied.fixture.reconcile();
    expect(
      occupied.fixture.lifecycle.removeDesktopExactly(
        occupied.middle.id,
        [occupied.first.id, occupied.middle.id, occupied.trailing.id],
        occupied.middle.name,
      ),
    ).toBe(false);

    const selected = create(false, 2);
    const secondOutput = selected.fixture.outputs[1];
    if (!secondOutput) {
      throw new Error("missing second output");
    }
    selected.fixture.select(secondOutput, selected.middle);
    selected.fixture.reconcile();
    expect(
      selected.fixture.lifecycle.removeDesktopExactly(
        selected.middle.id,
        [selected.first.id, selected.middle.id, selected.trailing.id],
        selected.middle.name,
      ),
    ).toBe(false);

    const wrongPostcondition = create();
    wrongPostcondition.fixture.setRemoveMode("wrong");
    expect(
      wrongPostcondition.fixture.lifecycle.removeDesktopExactly(
        wrongPostcondition.middle.id,
        [
          wrongPostcondition.first.id,
          wrongPostcondition.middle.id,
          wrongPostcondition.trailing.id,
        ],
        wrongPostcondition.middle.name,
      ),
    ).toBe(false);
    expect(wrongPostcondition.fixture.desktops).toContain(
      wrongPostcondition.middle,
    );
  });

  it("removes a committed workspace-gap desktop after it becomes empty", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const trailing = { id: "desktop-3" };
    const fixture = createLifecycleFixture(
      [first, second, trailing],
      [createWindow("window-1", [first]), createWindow("window-2", [second])],
    );
    fixture.reconcile();
    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
      trailing.id,
    ]);

    if (!result) {
      throw new Error("missing interior desktop creation result");
    }

    expect(fixture.lifecycle.commitCreatedDesktop(result)).toBe(true);
    fixture.reconcile();
    expect(fixture.desktops).toEqual([first, second, trailing]);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("rolls back only its exact empty unselected reserved desktop", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();
    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    if (!result) {
      throw new Error("missing rollback desktop creation result");
    }

    expect(fixture.lifecycle.rollbackCreatedDesktop({ ...result })).toBe(false);
    expect(fixture.removeCount).toBe(0);
    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(true);
    expect(fixture.desktops).toEqual([first, second]);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(false);
  });

  it.each([
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setCreateAvailable(false);
      },
      name: "unavailable API",
    },
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setRemoveMode("unavailable");
      },
      name: "unavailable compensation API",
    },
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setCreateCommits(false);
      },
      name: "rejected request",
    },
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setCreatePositionOverride(2);
      },
      name: "wrong insertion position",
    },
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setCreateIdOverride("desktop-1");
      },
      name: "reused desktop identity",
    },
    {
      configure: (fixture: LifecycleFixture) => {
        fixture.setCreatePermutes(true);
      },
      name: "unexpected topology permutation",
    },
  ])("fails closed after an $name", ({ configure }) => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();
    configure(fixture);

    expect(
      fixture.lifecycle.createDesktopAtPosition(1, [first.id, second.id]),
    ).toBeNull();
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("rejects stale expected topology before calling KWin", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();

    expect(
      fixture.lifecycle.createDesktopAtPosition(1, [second.id, first.id]),
    ).toBeNull();
    expect(fixture.createCount).toBe(0);
    expect(fixture.desktops).toEqual([first, second]);
  });

  it("settles an exact creation without synchronous signal delivery", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();
    fixture.setCreateSignals(false);

    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    expect(result?.desktopId).toBe("created-1");
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);

    if (!result) {
      throw new Error("missing queued-signal creation result");
    }

    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(true);
    expect(fixture.desktops).toEqual([first, second]);
  });

  it("retains a reservation when rollback is rejected and permits an exact retry", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();
    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    if (!result) {
      throw new Error("missing rejected rollback creation result");
    }

    fixture.setRemoveMode("reject");
    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(false);
    expect(fixture.desktops.map((desktop) => desktop.id)).toEqual([
      first.id,
      result.desktopId,
      second.id,
    ]);

    fixture.setRemoveMode("commit");
    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(true);
    expect(fixture.desktops).toEqual([first, second]);
  });

  it("rolls back its exact reservation after an unrelated topology insertion", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };
    const fixture = createLifecycleFixture([first, second]);
    fixture.reconcile();
    const result = fixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    if (!result) {
      throw new Error("missing topology-drift rollback creation result");
    }

    const external = fixture.insertExternalDesktop(0, "desktop-external");
    expect(fixture.lifecycle.validateCreatedDesktopReservation(result)).toBe(
      false,
    );
    expect(fixture.lifecycle.rollbackCreatedDesktop(result)).toBe(true);
    expect(fixture.desktops).toEqual([external, first, second]);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
    fixture.reconcile();
    expect(fixture.lifecycle.unsettled).toBe(false);
  });

  it("never rolls back an occupied, selected, or stale created desktop", () => {
    const first = { id: "desktop-1" };
    const second = { id: "desktop-2" };

    const occupiedFixture = createLifecycleFixture([first, second]);
    occupiedFixture.reconcile();
    const occupied = occupiedFixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    if (!occupied) {
      throw new Error("missing occupied rollback creation result");
    }

    occupiedFixture.addWindow(createWindow("occupied", [occupied.desktop]));
    expect(occupiedFixture.lifecycle.rollbackCreatedDesktop(occupied)).toBe(
      false,
    );
    expect(occupiedFixture.removeCount).toBe(0);
    expect(occupiedFixture.lifecycle.commitCreatedDesktop(occupied)).toBe(true);

    const selectedFixture = createLifecycleFixture([first, second]);
    selectedFixture.reconcile();
    const selected = selectedFixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);
    const output = selectedFixture.outputs[0];

    if (!selected || !output) {
      throw new Error("missing selected rollback fixture state");
    }

    selectedFixture.select(output, selected.desktop);
    expect(selectedFixture.lifecycle.rollbackCreatedDesktop(selected)).toBe(
      false,
    );
    expect(selectedFixture.removeCount).toBe(0);

    const staleFixture = createLifecycleFixture([first, second]);
    staleFixture.reconcile();
    const stale = staleFixture.lifecycle.createDesktopAtPosition(1, [
      first.id,
      second.id,
    ]);

    if (!stale) {
      throw new Error("missing stale rollback creation result");
    }

    staleFixture.replaceDesktopIdentity(1);
    expect(
      staleFixture.lifecycle.validateCreatedDesktopReservation(stale),
    ).toBe(false);
    expect(staleFixture.lifecycle.rollbackCreatedDesktop(stale)).toBe(false);
    expect(staleFixture.removeCount).toBe(0);
  });

  it("creates and later removes only its redundant trailing desktop", () => {
    const desktop = { id: "desktop-1" };
    const window = createWindow("window-1", [desktop]);
    const fixture = createLifecycleFixture([desktop], [window]);

    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);

    fixture.removeWindow(window);
    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
    ]);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("maintains distinct empty leading and trailing desktops when enabled", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
      1,
      true,
    );

    fixture.reconcile();
    fixture.reconcile();

    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "created-1",
      "desktop-1",
      "created-2",
    ]);
    expect(fixture.createRequests).toEqual([0, 2]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(2);
  });

  it("creates a second boundary for a completely empty topology", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture([desktop], [], 1, true);

    fixture.reconcile();
    fixture.reconcile();

    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);
    expect(fixture.createRequests).toEqual([1]);
    expect(fixture.removeCount).toBe(0);
  });

  it("reconciles a live enable and safely cleans up its leading desktop after disable", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
    );

    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);

    expect(fixture.lifecycle.setKeepEmptyDesktopAboveFirst(true)).toBe(true);
    expect(fixture.lifecycle.setKeepEmptyDesktopAboveFirst(true)).toBe(false);
    expect(fixture.lifecycle.pendingWork).toBe(true);
    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "created-2",
      "desktop-1",
      "created-1",
    ]);

    expect(fixture.lifecycle.setKeepEmptyDesktopAboveFirst(false)).toBe(true);
    fixture.reconcile();
    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);
    expect(fixture.createCount).toBe(2);
    expect(fixture.removeCount).toBe(1);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("defers disabled leading cleanup while the owned desktop is selected", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
      1,
      true,
    );

    fixture.reconcile();
    fixture.reconcile();
    const output = fixture.outputs[0];
    const leading = fixture.desktops[0];

    if (!output || !leading) {
      throw new Error("missing leading cleanup fixture state");
    }

    fixture.select(output, leading);
    fixture.reconcile();
    fixture.lifecycle.setKeepEmptyDesktopAboveFirst(false);
    fixture.reconcile();
    expect(fixture.removeCount).toBe(0);

    fixture.select(output, desktop);
    fixture.reconcile();
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-2",
    ]);
    expect(fixture.removeCount).toBe(1);
  });

  it("never cleans up an occupied, external, or removal-unsafe leading desktop", () => {
    const occupiedDesktop = { id: "occupied" };
    const occupiedFixture = createLifecycleFixture(
      [occupiedDesktop],
      [createWindow("window-occupied", [occupiedDesktop])],
      1,
      true,
    );
    occupiedFixture.reconcile();
    occupiedFixture.reconcile();
    const occupiedLeading = occupiedFixture.desktops[0];

    if (!occupiedLeading) {
      throw new Error("missing occupied leading desktop");
    }

    occupiedFixture.addWindow(
      createWindow("window-leading", [occupiedLeading]),
    );
    occupiedFixture.lifecycle.setKeepEmptyDesktopAboveFirst(false);
    occupiedFixture.reconcile();
    expect(occupiedFixture.removeCount).toBe(0);

    const externalLeading = { id: "external-leading" };
    const externalDesktop = { id: "external-occupied" };
    const externalFixture = createLifecycleFixture(
      [externalLeading, externalDesktop],
      [createWindow("window-external", [externalDesktop])],
      1,
      true,
    );
    externalFixture.reconcile();
    externalFixture.lifecycle.setKeepEmptyDesktopAboveFirst(false);
    externalFixture.reconcile();
    expect(externalFixture.desktops[0]).toBe(externalLeading);
    expect(externalFixture.removeCount).toBe(0);

    const unsafeDesktop = { id: "unsafe" };
    const unsafeWindow = createWindow("window-unsafe", [unsafeDesktop]);
    Object.defineProperty(unsafeWindow, "desktopsChanged", {
      configurable: true,
      value: undefined,
    });
    const unsafeFixture = createLifecycleFixture(
      [unsafeDesktop],
      [unsafeWindow],
      1,
      true,
    );
    unsafeFixture.reconcile();
    unsafeFixture.reconcile();
    unsafeFixture.lifecycle.setKeepEmptyDesktopAboveFirst(false);
    unsafeFixture.reconcile();
    expect(unsafeFixture.removeCount).toBe(0);
  });

  it("removes owned boundaries next to external empty boundaries without recreating them", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
      1,
      true,
    );

    fixture.reconcile();
    fixture.reconcile();
    fixture.insertExternalDesktop(0, "external-leading");
    fixture.reconcile();
    fixture.insertExternalDesktop(fixture.desktops.length, "external-tail");
    fixture.reconcile();
    fixture.reconcile();

    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "external-leading",
      "desktop-1",
      "external-tail",
    ]);
    expect(fixture.createCount).toBe(2);
    expect(fixture.removeCount).toBe(2);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("never removes an externally created empty desktop", () => {
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }];
    const fixture = createLifecycleFixture(desktops);

    fixture.reconcile();
    expect(fixture.removeCount).toBe(0);
    expect(fixture.desktops).toHaveLength(2);
  });

  it("retains an owned trailing desktop selected on any output", () => {
    const desktop = { id: "desktop-1" };
    const window = createWindow("window-1", [desktop]);
    const fixture = createLifecycleFixture([desktop], [window], 2);

    fixture.reconcile();
    const trailing = fixture.desktops[1];

    if (!trailing) {
      throw new Error("missing trailing desktop");
    }

    const secondOutput = createOutput("output-2", 1000);
    fixture.select(secondOutput, trailing);
    fixture.removeWindow(window);
    fixture.reconcile();
    expect(fixture.removeCount).toBe(0);

    fixture.select(secondOutput, desktop);
    fixture.reconcile();
    expect(fixture.removeCount).toBe(1);
  });

  it("moves the selected desktop adjacently and directly without changing identities or selections", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const primaryWindow = createWindow("window-1", [primary]);
    const secondaryWindow = createWindow("window-2", [secondary]);
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [primaryWindow, secondaryWindow],
      2,
    );

    fixture.reconcile();
    const trailing = fixture.desktops[2];
    const activeOutput = fixture.outputs[0];
    const otherOutput = fixture.outputs[1];

    if (!trailing || !activeOutput || !otherOutput) {
      throw new Error("missing desktop reorder fixture state");
    }

    fixture.select(otherOutput, secondary);
    fixture.reconcile();

    expect(fixture.lifecycle.moveSelectedDesktop(activeOutput, 1)).toBe(true);
    expect(fixture.desktops).toEqual([secondary, primary, trailing]);
    expect(fixture.selectedDesktop(activeOutput)).toBe(primary);
    expect(fixture.selectedDesktop(otherOutput)).toBe(secondary);
    expect(primaryWindow.desktops).toEqual([primary]);
    expect(secondaryWindow.desktops).toEqual([secondary]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);

    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(activeOutput, -1)).toBe(true);
    expect(fixture.desktops).toEqual([primary, secondary, trailing]);
    expect(fixture.selectedDesktop(activeOutput)).toBe(primary);
    expect(fixture.selectedDesktop(otherOutput)).toBe(secondary);
    expect(primaryWindow.desktops).toEqual([primary]);
    expect(secondaryWindow.desktops).toEqual([secondary]);

    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(activeOutput, 9)).toBe(
      true,
    );
    expect(fixture.desktops).toEqual([secondary, primary, trailing]);
    expect(fixture.selectedDesktop(activeOutput)).toBe(primary);
    expect(fixture.selectedDesktop(otherOutput)).toBe(secondary);
    expect(primaryWindow.desktops).toEqual([primary]);
    expect(secondaryWindow.desktops).toEqual([secondary]);

    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(activeOutput, 1)).toBe(
      true,
    );
    expect(fixture.desktops).toEqual([primary, secondary, trailing]);
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(activeOutput, 1)).toBe(
      false,
    );
    expect(fixture.moveRequests).toEqual([
      { desktopId: primary.id, position: 1 },
      { desktopId: primary.id, position: 0 },
      { desktopId: primary.id, position: 1 },
      { desktopId: primary.id, position: 0 },
    ]);
    expect(fixture.createCount).toBe(1);
    expect(fixture.removeCount).toBe(0);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("does not move past either boundary or into the trailing desktop", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [
        createWindow("window-1", [primary]),
        createWindow("window-2", [secondary]),
      ],
    );

    fixture.reconcile();
    fixture.reconcile();
    const output = fixture.outputs[0];
    const trailing = fixture.desktops[2];

    if (!output || !trailing) {
      throw new Error("missing desktop reorder boundary fixture state");
    }

    expect(fixture.lifecycle.moveSelectedDesktop(output, -1)).toBe(false);
    fixture.select(output, secondary);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    fixture.select(output, trailing);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, -1)).toBe(false);
    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    expect(fixture.desktops).toEqual([primary, secondary, trailing]);
    expect(fixture.selectedDesktop(output)).toBe(trailing);
    expect(fixture.moveCount).toBe(0);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("protects both empty boundaries while allowing interior reorder", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [
        createWindow("window-1", [primary]),
        createWindow("window-2", [secondary]),
      ],
      1,
      true,
    );

    fixture.reconcile();
    fixture.reconcile();
    const output = fixture.outputs[0];
    const leading = fixture.desktops[0];
    const trailing = fixture.desktops[3];

    if (!output || !leading || !trailing) {
      throw new Error("missing dual-boundary reorder fixture state");
    }

    fixture.select(output, leading);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(output, 1)).toBe(false);

    fixture.select(output, primary);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, -1)).toBe(false);

    fixture.select(output, secondary);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);

    fixture.select(output, trailing);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, -1)).toBe(false);
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(output, 1)).toBe(false);

    fixture.select(output, primary);
    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(true);
    expect(fixture.desktops).toEqual([leading, secondary, primary, trailing]);

    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(output, 1)).toBe(true);
    expect(fixture.desktops).toEqual([leading, primary, secondary, trailing]);

    fixture.reconcile();
    expect(fixture.lifecycle.moveSelectedDesktopToIndex(output, 9)).toBe(true);
    expect(fixture.desktops).toEqual([leading, secondary, primary, trailing]);
    expect(fixture.moveRequests).toEqual([
      { desktopId: primary.id, position: 2 },
      { desktopId: primary.id, position: 1 },
      { desktopId: primary.id, position: 2 },
    ]);
  });

  it("does not reorder while the shared trailing desktop is occupied", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [
        createWindow("window-1", [primary]),
        createWindow("window-2", [secondary]),
      ],
    );

    fixture.reconcile();
    fixture.reconcile();
    const output = fixture.outputs[0];
    const trailing = fixture.desktops[2];

    if (!output || !trailing) {
      throw new Error("missing occupied desktop reorder fixture state");
    }

    fixture.setCreateCommits(false);
    fixture.addWindow(createWindow("window-tail", [trailing]));
    fixture.reconcile();

    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    expect(fixture.desktops).toEqual([primary, secondary, trailing]);
    expect(fixture.moveCount).toBe(0);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it.each([
    { expectedMoveCount: 0, mode: "unavailable" },
    { expectedMoveCount: 1, mode: "reject" },
    { expectedMoveCount: 1, mode: "throw" },
  ] as const)(
    "fails closed when desktop reorder is $mode",
    ({ expectedMoveCount, mode }) => {
      const primary = { id: "desktop-1" };
      const secondary = { id: "desktop-2" };
      const fixture = createLifecycleFixture(
        [primary, secondary],
        [
          createWindow("window-1", [primary]),
          createWindow("window-2", [secondary]),
        ],
      );

      fixture.reconcile();
      fixture.reconcile();
      const output = fixture.outputs[0];
      const trailing = fixture.desktops[2];

      if (!output || !trailing) {
        throw new Error("missing rejected desktop reorder fixture state");
      }

      fixture.setMoveMode(mode);
      const warning =
        mode === "throw"
          ? vi.spyOn(console, "warn").mockImplementation(() => undefined)
          : null;

      try {
        expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
      } finally {
        warning?.mockRestore();
      }
      expect(fixture.desktops).toEqual([primary, secondary, trailing]);
      expect(fixture.selectedDesktop(output)).toBe(primary);
      expect(fixture.moveCount).toBe(expectedMoveCount);
      expect(fixture.createCount).toBe(1);
      expect(fixture.removeCount).toBe(0);
      expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    },
  );

  it("fails closed after a wrong same-id permutation without losing the owned tail", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const tertiary = { id: "desktop-3" };
    const fixture = createLifecycleFixture(
      [primary, secondary, tertiary],
      [
        createWindow("window-1", [primary]),
        createWindow("window-2", [secondary]),
        createWindow("window-3", [tertiary]),
      ],
    );

    fixture.reconcile();
    fixture.reconcile();
    const output = fixture.outputs[0];
    const trailing = fixture.desktops[3];

    if (!output || !trailing) {
      throw new Error("missing wrong desktop permutation fixture state");
    }

    fixture.setMoveMode("wrong");

    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    expect(fixture.desktops).toEqual([secondary, tertiary, primary, trailing]);
    expect(fixture.selectedDesktop(output)).toBe(primary);
    expect(fixture.moveRequests).toEqual([
      { desktopId: primary.id, position: 1 },
    ]);
    expect(fixture.createCount).toBe(1);
    expect(fixture.removeCount).toBe(0);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);

    fixture.reconcile();
    expect(fixture.createCount).toBe(1);
    expect(fixture.removeCount).toBe(0);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("fails closed when another output selection changes during reorder", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [
        createWindow("window-1", [primary]),
        createWindow("window-2", [secondary]),
      ],
      2,
    );

    fixture.reconcile();
    const activeOutput = fixture.outputs[0];
    const otherOutput = fixture.outputs[1];
    const trailing = fixture.desktops[2];

    if (!activeOutput || !otherOutput || !trailing) {
      throw new Error("missing selection drift reorder fixture state");
    }

    fixture.select(otherOutput, secondary);
    fixture.reconcile();
    fixture.setMoveHook(() => {
      fixture.select(otherOutput, primary);
    });

    expect(fixture.lifecycle.moveSelectedDesktop(activeOutput, 1)).toBe(false);
    expect(fixture.desktops).toEqual([secondary, primary, trailing]);
    expect(fixture.selectedDesktop(activeOutput)).toBe(primary);
    expect(fixture.selectedDesktop(otherOutput)).toBe(primary);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("fails closed when a window membership changes during reorder", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const primaryWindow = createWindow("window-1", [primary]);
    const fixture = createLifecycleFixture(
      [primary, secondary],
      [primaryWindow, createWindow("window-2", [secondary])],
    );

    fixture.reconcile();
    const output = fixture.outputs[0];
    const trailing = fixture.desktops[2];

    if (!output || !trailing) {
      throw new Error("missing membership drift reorder fixture state");
    }

    fixture.reconcile();
    fixture.setMoveHook(() => {
      primaryWindow.desktops = [secondary];
    });

    expect(fixture.lifecycle.moveSelectedDesktop(output, 1)).toBe(false);
    expect(fixture.desktops).toEqual([secondary, primary, trailing]);
    expect(primaryWindow.desktops).toEqual([secondary]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
  });

  it("counts every live application window regardless of layout eligibility", () => {
    const desktop = { id: "desktop-1" };
    const ignored = createWindow("ignored", [desktop], {
      dialog: true,
      normalWindow: false,
      specialWindow: true,
    });
    const fixture = createLifecycleFixture([desktop], [ignored]);

    fixture.reconcile();
    expect(fixture.createCount).toBe(1);
  });

  it("does not count desktop, dock, or deleted windows", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [
        createWindow("desktop", [desktop], { desktopWindow: true }),
        createWindow("dock", [desktop], { dock: true }),
        createWindow("deleted", [desktop], { deleted: true }),
      ],
    );

    fixture.reconcile();
    expect(fixture.createCount).toBe(0);
  });

  it("does not spin after rejection and retries after a later event", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
    );
    fixture.setCreateCommits(false);

    fixture.reconcile();
    fixture.reconcile();
    expect(fixture.createCount).toBe(1);

    fixture.select(createOutput("output-1", 0), desktop);
    fixture.reconcile();
    expect(fixture.createCount).toBe(2);
  });

  it("claims an exactly appended desktop when its signal is queued", () => {
    const desktop = { id: "desktop-1" };
    const window = createWindow("window-1", [desktop]);
    const fixture = createLifecycleFixture([desktop], [window]);
    fixture.setCreateSignals(false);

    fixture.reconcile();
    expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    fixture.emitDesktopsChanged();
    fixture.removeWindow(window);
    fixture.reconcile();
    expect(fixture.removeCount).toBe(1);
  });

  it.each([true, false])(
    "claims an exact leading insertion when synchronous signal delivery is %s",
    (createSignals) => {
      const desktop = { id: "desktop-1" };
      const fixture = createLifecycleFixture(
        [desktop],
        [createWindow("window-1", [desktop])],
        1,
        true,
      );
      fixture.setCreateSignals(createSignals);

      fixture.reconcile();

      expect(fixture.createRequests).toEqual([0]);
      expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
        "created-1",
        "desktop-1",
      ]);
      expect(fixture.lifecycle.ownedDesktopCount).toBe(1);
    },
  );

  it("does not claim a created desktop inserted at the wrong boundary", () => {
    const occupied = { id: "desktop-1" };
    const trailing = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [occupied, trailing],
      [createWindow("window-1", [occupied])],
      1,
      true,
    );
    fixture.setCreatePositionOverride(2);

    fixture.reconcile();

    expect(fixture.createRequests).toEqual([0]);
    expect(fixture.desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "desktop-2",
      "created-1",
    ]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
    expect(fixture.lifecycle.pendingWork).toBe(false);

    fixture.reconcile();
    expect(fixture.createCount).toBe(1);
  });

  it("does not claim a delayed insertion after an uncommitted create call", () => {
    const desktop = { id: "desktop-1" };
    const fixture = createLifecycleFixture(
      [desktop],
      [createWindow("window-1", [desktop])],
      1,
      true,
    );
    fixture.setCreateCommits(false);

    fixture.reconcile();
    fixture.insertExternalDesktop(0, "delayed-desktop");

    expect(fixture.createRequests).toEqual([0]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("does not claim ownership after a stale same-id permutation", () => {
    const occupied = { id: "desktop-1" };
    const trailing = { id: "desktop-2" };
    const fixture = createLifecycleFixture(
      [occupied, trailing],
      [createWindow("window-1", [occupied])],
      1,
      true,
    );
    fixture.setCreatePermutes(true);

    fixture.reconcile();

    expect(fixture.createRequests).toEqual([0]);
    expect(fixture.desktops).toEqual([trailing, occupied]);
    expect(fixture.lifecycle.ownedDesktopCount).toBe(0);
  });

  it("fails closed when an application cannot report desktop changes", () => {
    const desktop = { id: "desktop-1" };
    const window = createWindow("window-1", [desktop]);
    Object.defineProperty(window, "desktopsChanged", {
      configurable: true,
      value: undefined,
    });
    const fixture = createLifecycleFixture([desktop], [window]);

    fixture.reconcile();
    Object.defineProperties(window, {
      desktops: { configurable: true, value: [] },
      onAllDesktops: { configurable: true, value: true },
    });
    fixture.select(createOutput("output-1", 0), desktop);
    fixture.reconcile();
    expect(fixture.removeCount).toBe(0);
  });
});
