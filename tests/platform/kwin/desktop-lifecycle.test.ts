import { describe, expect, it } from "vitest";
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
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly lifecycle: DesktopLifecycle;
  readonly removeCount: number;
  emitDesktopsChanged(): void;
  addWindow(window: KWinWindow): void;
  reconcile(): void;
  removeWindow(window: KWinWindow): void;
  select(output: KWinOutput, desktop: KWinVirtualDesktop): void;
  setCreateCommits(enabled: boolean): void;
  setCreateSignals(enabled: boolean): void;
}

function createLifecycleFixture(
  initialDesktops: readonly KWinVirtualDesktop[],
  initialWindows: readonly KWinWindow[] = [],
  outputCount = 1,
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
  let createSignals = true;
  let createCount = 0;
  let removeCount = 0;
  let nextCreatedId = 1;
  const selected = new Map(
    outputs.map((output) => [output.name, desktops[0] ?? null]),
  );
  const workspace: KWinWorkspace = {
    activeScreen: outputs[0] ?? null,
    activeWindow: null,
    clientArea: (_option, output) => output.geometry,
    createDesktop: (position) => {
      createCount += 1;

      if (!createCommits) {
        return;
      }

      const desktop = { id: `created-${String(nextCreatedId)}` };
      nextCreatedId += 1;
      desktops.splice(Math.min(position, desktops.length), 0, desktop);

      if (createSignals) {
        desktopsChanged.emit();
      }
    },
    currentDesktop: desktops[0] ?? null,
    currentDesktopChanged,
    currentDesktopForScreen: (output) => selected.get(output.name) ?? null,
    desktops,
    desktopsChanged,
    removeDesktop: (desktop) => {
      removeCount += 1;
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

  const lifecycle = new DesktopLifecycle(workspace, {
    changed: () => undefined,
  });
  lifecycle.start();

  return {
    addWindow: (window) => {
      windows.push(window);
      windowAdded.emit(window);
    },
    get createCount() {
      return createCount;
    },
    get desktops() {
      return desktops;
    },
    emitDesktopsChanged: () => {
      desktopsChanged.emit();
    },
    lifecycle,
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
    select: (output, desktop) => {
      const previous = selected.get(output.name) ?? null;
      selected.set(output.name, desktop);
      currentDesktopChanged.emit(previous, desktop, output);
    },
    setCreateCommits: (enabled) => {
      createCommits = enabled;
    },
    setCreateSignals: (enabled) => {
      createSignals = enabled;
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
});

describe("DesktopLifecycle", () => {
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
