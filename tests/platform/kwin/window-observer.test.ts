import { describe, expect, it } from "vitest";
import type {
  KWinOutput,
  KWinSignal,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "../../../src/platform/kwin/api";
import {
  normalizeWindow,
  WindowObserver,
} from "../../../src/platform/kwin/window-observer";

class Signal<TArguments extends unknown[]> implements KWinSignal<TArguments> {
  readonly #handlers = new Set<(...arguments_: TArguments) => void>();

  get size(): number {
    return this.#handlers.size;
  }

  connect(handler: (...arguments_: TArguments) => void): void {
    this.#handlers.add(handler);
  }

  disconnect(handler: (...arguments_: TArguments) => void): void {
    this.#handlers.delete(handler);
  }

  emit(...arguments_: TArguments): void {
    for (const handler of this.#handlers) {
      handler(...arguments_);
    }
  }
}

function createWindow(overrides: Partial<KWinWindow> = {}): KWinWindow {
  const output: KWinOutput = {
    devicePixelRatio: 1,
    geometry: { height: 1080, width: 1920, x: 0, y: 0 },
    name: "DP-1",
  };
  const desktop: KWinVirtualDesktop = { id: "desktop-1" };

  return {
    clientGeometry: { height: 600, width: 800, x: 0, y: 0 },
    deleted: false,
    desktops: [desktop],
    desktopsChanged: new Signal<[]>(),
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    fullScreen: false,
    fullScreenChanged: new Signal<[]>(),
    internalId: "window-1",
    interactiveMoveResizeFinished: new Signal<[]>(),
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizedAboutToChange: new Signal<[mode: number]>(),
    maximizeableChanged: new Signal<[maximizeable: boolean]>(),
    maximizedChanged: new Signal<[]>(),
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    minimizedChanged: new Signal<[]>(),
    modal: false,
    modalChanged: new Signal<[]>(),
    move: false,
    moveable: true,
    moveResizedChanged: new Signal<[]>(),
    normalWindow: true,
    onAllDesktops: false,
    output,
    outputChanged: new Signal<[oldOutput?: KWinOutput | null]>(),
    requestedTileChanged: new Signal<[]>(),
    resize: false,
    resizeable: true,
    specialWindow: false,
    tile: null,
    tileChanged: new Signal<[tile: object | null]>(),
    transient: false,
    transientChanged: new Signal<[]>(),
    transientFor: null,
    ...overrides,
  };
}

function createWorkspace(
  stackingOrder: readonly KWinWindow[],
  windowAdded = new Signal<[window: KWinWindow]>(),
  windowRemoved = new Signal<[window: KWinWindow]>(),
): KWinWorkspace {
  const output = createWindow().output;
  const desktop = createWindow().desktops[0];

  if (!output || !desktop) {
    throw new Error("invalid workspace fixture");
  }

  return {
    activeWindow: stackingOrder[stackingOrder.length - 1] ?? null,
    activeScreen: output,
    clientArea: () => ({ height: 1080, width: 1920, x: 0, y: 0 }),
    currentDesktop: desktop,
    currentDesktopChanged: new Signal<
      [
        previous: KWinVirtualDesktop | null,
        current?: KWinVirtualDesktop | null,
        output?: KWinOutput,
      ]
    >(),
    currentDesktopForScreen: () => desktop,
    desktops: [desktop],
    screens: [output],
    stackingOrder,
    windowActivated: new Signal<[window: KWinWindow | null]>(),
    windowAdded,
    windowRemoved,
  };
}

describe("normalizeWindow", () => {
  it("normalizes a regular window", () => {
    expect(normalizeWindow(createWindow())).toEqual({
      desktopIds: ["desktop-1"],
      id: "window-1",
      kind: "normal",
      outputId: "DP-1",
    });
  });

  it("keeps dialogs observable", () => {
    expect(
      normalizeWindow(createWindow({ dialog: true, normalWindow: false }))
        ?.kind,
    ).toBe("dialog");
  });

  it("keeps non-normal transient roles observable", () => {
    expect(
      normalizeWindow(
        createWindow({
          normalWindow: false,
          transient: true,
        }),
      )?.kind,
    ).toBe("other");
  });

  it("ignores special windows", () => {
    expect(normalizeWindow(createWindow({ specialWindow: true }))).toBeNull();
  });

  it("ignores windows shown on every desktop", () => {
    expect(
      normalizeWindow(createWindow({ desktops: [], onAllDesktops: true })),
    ).toBeNull();
  });
});

describe("WindowObserver", () => {
  it("tracks lifecycle signals without polling", () => {
    const windowAdded = new Signal<[window: KWinWindow]>();
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const initialWindow = createWindow();
    const workspace = createWorkspace(
      [initialWindow],
      windowAdded,
      windowRemoved,
    );
    const observer = new WindowObserver(workspace);

    observer.start();
    expect(observer.size).toBe(1);

    const addedWindow = createWindow({ internalId: "window-2" });
    windowAdded.emit(addedWindow);
    expect(observer.size).toBe(2);

    windowRemoved.emit(initialWindow);
    expect(observer.snapshot().map((window) => window.id)).toEqual([
      "window-2",
    ]);

    observer.stop();
    windowAdded.emit(createWindow({ internalId: "window-3" }));
    expect(observer.size).toBe(0);
  });

  it("publishes lifecycle events and retains the live KWin object", () => {
    const windowAdded = new Signal<[window: KWinWindow]>();
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const added: string[] = [];
    const removed: string[] = [];
    const observer = new WindowObserver(
      createWorkspace([], windowAdded, windowRemoved),
      {
        added: (window) => added.push(window.id),
        removed: (windowId) => removed.push(windowId),
      },
    );
    const source = createWindow();

    observer.start();
    windowAdded.emit(source);
    expect(observer.source("window-1")).toBe(source);
    windowRemoved.emit(source);

    expect(added).toEqual(["window-1"]);
    expect(removed).toEqual(["window-1"]);
    expect(observer.source("window-1")).toBeUndefined();
  });

  it("refreshes cached output and desktop contexts", () => {
    const source = createWindow();
    const outputChanged = source.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const desktopsChanged = source.desktopsChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });
    const nextOutput: KWinOutput = {
      devicePixelRatio: 1.25,
      geometry: { height: 1440, width: 2560, x: 1920, y: 0 },
      name: "HDMI-A-1",
    };

    observer.start();
    Object.defineProperty(source, "output", {
      configurable: true,
      value: nextOutput,
    });
    outputChanged.emit();

    expect(observer.snapshot()).toEqual([
      {
        desktopIds: ["desktop-1"],
        id: "window-1",
        kind: "normal",
        outputId: "HDMI-A-1",
      },
    ]);

    Object.defineProperty(source, "desktops", {
      configurable: true,
      value: [{ id: "desktop-2" }],
    });
    desktopsChanged.emit();

    expect(observer.snapshot()[0]?.desktopIds).toEqual(["desktop-2"]);
    expect(changed).toEqual(["window-1", "window-1"]);
  });

  it("retains a temporarily all-desktop source until it returns", () => {
    const source = createWindow();
    const desktopsChanged = source.desktopsChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();
    Object.defineProperties(source, {
      desktops: { configurable: true, value: [] },
      onAllDesktops: { configurable: true, value: true },
    });
    desktopsChanged.emit();

    expect(observer.size).toBe(1);
    expect(observer.snapshot()).toEqual([]);
    expect(observer.source("window-1")).toBe(source);

    Object.defineProperties(source, {
      desktops: {
        configurable: true,
        value: [{ id: "desktop-1" }],
      },
      onAllDesktops: { configurable: true, value: false },
    });
    desktopsChanged.emit();

    expect(observer.snapshot().map((window) => window.id)).toEqual([
      "window-1",
    ]);
    expect(changed).toEqual(["window-1", "window-1"]);
  });

  it("tracks an initially all-desktop window until it becomes eligible", () => {
    const source = createWindow({
      desktops: [],
      onAllDesktops: true,
    });
    const desktopsChanged = source.desktopsChanged as Signal<[]>;
    const added: string[] = [];
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      added: (window) => added.push(window.id),
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();
    expect(observer.size).toBe(1);
    expect(observer.snapshot()).toEqual([]);
    expect(added).toEqual([]);

    Object.defineProperties(source, {
      desktops: {
        configurable: true,
        value: [{ id: "desktop-1" }],
      },
      onAllDesktops: { configurable: true, value: false },
    });
    desktopsChanged.emit();

    expect(observer.snapshot().map((window) => window.id)).toEqual([
      "window-1",
    ]);
    expect(changed).toEqual(["window-1"]);
  });

  it("does not publish unchanged normalized state", () => {
    const source = createWindow();
    const outputChanged = source.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const desktopsChanged = source.desktopsChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });
    observer.start();
    Object.defineProperty(source, "output", {
      configurable: true,
      value: createWindow().output,
    });
    outputChanged.emit();
    Object.defineProperty(source, "desktops", {
      configurable: true,
      value: [{ id: "desktop-1" }],
    });
    desktopsChanged.emit();

    expect(changed).toEqual([]);
  });

  it("publishes constraint, transient, and modal ownership changes", () => {
    const source = createWindow();
    const maximizeableChanged = source.maximizeableChanged as Signal<
      [maximizeable: boolean]
    >;
    const transientChanged = source.transientChanged as Signal<[]>;
    const modalChanged = source.modalChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();
    maximizeableChanged.emit(false);
    Object.defineProperty(source, "transient", {
      configurable: true,
      value: true,
    });
    transientChanged.emit();
    Object.defineProperty(source, "modal", {
      configurable: true,
      value: true,
    });
    modalChanged.emit();

    expect(changed).toEqual(["window-1", "window-1", "window-1"]);
  });

  it("publishes geometry ownership state changes", () => {
    const source = createWindow();
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const fullScreenChanged = source.fullScreenChanged as Signal<[]>;
    const maximizedChanged = source.maximizedChanged as Signal<[]>;
    const minimizedChanged = source.minimizedChanged as Signal<[]>;
    const moveStateChanged = source.moveResizedChanged as Signal<[]>;
    const tileChanged = source.tileChanged as Signal<[tile: object | null]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      stateChanged: (windowId) => changed.push(windowId),
    });

    observer.start();
    moveStateChanged.emit();
    finished.emit();
    fullScreenChanged.emit();
    maximizedChanged.emit();
    minimizedChanged.emit();
    tileChanged.emit({});

    expect(changed).toEqual(Array.from({ length: 6 }, () => "window-1"));
  });

  it("orders maximize transition callbacks around suspension and state refreshes", () => {
    const source = createWindow();
    const maximizedAboutToChange = source.maximizedAboutToChange as Signal<
      [mode: number]
    >;
    const maximizedChanged = source.maximizedChanged as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      maximizedAboutToChange: (windowId, mode) =>
        events.push(`about:${windowId}:${String(mode)}`),
      stateChanged: (windowId) =>
        events.push(`state:${windowId}:${String(source.maximizeMode)}`),
      suspensionSettled: (windowId, request) =>
        events.push(`settled:${windowId}:${request}`),
      suspending: (windowId, request) =>
        events.push(`suspending:${windowId}:${request}`),
    });

    observer.start();
    maximizedAboutToChange.emit(3);
    Object.defineProperty(source, "maximizeMode", {
      configurable: true,
      value: 3,
    });
    maximizedChanged.emit();
    maximizedAboutToChange.emit(0);
    Object.defineProperty(source, "maximizeMode", {
      configurable: true,
      value: 0,
    });
    maximizedChanged.emit();

    expect(events).toEqual([
      "about:window-1:3",
      "settled:window-1:maximized-settling",
      "suspending:window-1:maximized-requested",
      "state:window-1:0",
      "settled:window-1:maximized-requested",
      "state:window-1:3",
      "settled:window-1:maximized-requested",
      "suspending:window-1:maximized-settling",
      "state:window-1:3",
      "about:window-1:0",
      "settled:window-1:maximized-requested",
      "settled:window-1:maximized-settling",
      "state:window-1:0",
    ]);
  });

  it("publishes early maximize and native-tile suspension requests", () => {
    const source = createWindow();
    const maximizedAboutToChange = source.maximizedAboutToChange as Signal<
      [mode: number]
    >;
    const requestedTileChanged = source.requestedTileChanged as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      suspensionSettled: (windowId, request) =>
        events.push(`settled:${windowId}:${request}`),
      suspending: (windowId, request) =>
        events.push(`suspending:${windowId}:${request}`),
    });

    observer.start();
    maximizedAboutToChange.emit(3);
    maximizedAboutToChange.emit(0);
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: {},
    });
    requestedTileChanged.emit();
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: null,
    });
    requestedTileChanged.emit();

    expect(events).toEqual([
      "settled:window-1:maximized-settling",
      "suspending:window-1:maximized-requested",
      "settled:window-1:maximized-requested",
      "suspending:window-1:maximized-settling",
      "settled:window-1:native-tile-settling",
      "suspending:window-1:native-tile-requested",
      "settled:window-1:native-tile-requested",
      "suspending:window-1:native-tile-settling",
    ]);
  });

  it("keeps native-tile suspension until committed state is clear", () => {
    const source = createWindow();
    const requestedTileChanged = source.requestedTileChanged as Signal<[]>;
    const tileChanged = source.tileChanged as Signal<[tile: object | null]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      suspensionSettled: (_windowId, request) =>
        events.push(`settled:${request}`),
      suspending: (_windowId, request) => events.push(`suspending:${request}`),
    });
    const tile = {};

    observer.start();
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: tile,
    });
    requestedTileChanged.emit();
    tileChanged.emit(tile);
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: null,
    });
    requestedTileChanged.emit();

    expect(events).toEqual([
      "settled:native-tile-settling",
      "suspending:native-tile-requested",
      "suspending:native-tile-committed",
      "settled:native-tile-requested",
      "settled:native-tile-requested",
      "suspending:native-tile-settling",
    ]);

    tileChanged.emit(null);
    expect(events.slice(-3)).toEqual([
      "settled:native-tile-committed",
      "settled:native-tile-settling",
      "settled:native-tile-requested",
    ]);
  });

  it("keeps the latest maximize request through a stale commit", () => {
    const source = createWindow();
    const maximizedAboutToChange = source.maximizedAboutToChange as Signal<
      [mode: number]
    >;
    const maximizedChanged = source.maximizedChanged as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      suspensionSettled: (_windowId, request) =>
        events.push(`settled:${request}`),
      suspending: (_windowId, request) => events.push(`suspending:${request}`),
    });

    observer.start();
    maximizedAboutToChange.emit(3);
    maximizedAboutToChange.emit(0);
    maximizedAboutToChange.emit(3);
    Object.defineProperty(source, "maximizeMode", {
      configurable: true,
      value: 0,
    });
    maximizedChanged.emit();

    expect(events[events.length - 1]).toBe("suspending:maximized-requested");

    Object.defineProperty(source, "maximizeMode", {
      configurable: true,
      value: 3,
    });
    maximizedChanged.emit();
    expect(events[events.length - 1]).toBe("settled:maximized-requested");
  });

  it("handles native-tile commits that precede request signals", () => {
    const source = createWindow();
    const requestedTileChanged = source.requestedTileChanged as Signal<[]>;
    const tileChanged = source.tileChanged as Signal<[tile: object | null]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      suspensionSettled: (_windowId, request) =>
        events.push(`settled:${request}`),
      suspending: (_windowId, request) => events.push(`suspending:${request}`),
    });
    const tile = {};

    observer.start();
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: tile,
    });
    tileChanged.emit(tile);
    requestedTileChanged.emit();
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: null,
    });
    tileChanged.emit(null);
    requestedTileChanged.emit();

    expect(events.filter((event) => event.startsWith("suspending:"))).toEqual([
      "suspending:native-tile-committed",
    ]);
    expect(events).toContain("settled:native-tile-committed");
  });

  it("refreshes state when an initial tile request is canceled", () => {
    const initialTile = {};
    const source = createWindow({ tile: initialTile });
    const requestedTileChanged = source.requestedTileChanged as Signal<[]>;
    const changed: string[] = [];
    const settled: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      stateChanged: (windowId) => changed.push(windowId),
      suspensionSettled: (_windowId, request) => settled.push(request),
    });

    observer.start();
    Object.defineProperty(source, "tile", {
      configurable: true,
      value: null,
    });
    requestedTileChanged.emit();

    expect(changed).toEqual(["window-1"]);
    expect(settled).toEqual(["native-tile-requested"]);
  });

  it("disconnects per-window handlers on removal and stop", () => {
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const removedSource = createWindow();
    const stoppedSource = createWindow({ internalId: "window-2" });
    const removedDesktops = removedSource.desktopsChanged as Signal<[]>;
    const removedFullScreen = removedSource.fullScreenChanged as Signal<[]>;
    const removedMoveResize = removedSource.moveResizedChanged as Signal<[]>;
    const removedOutput = removedSource.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const stoppedDesktops = stoppedSource.desktopsChanged as Signal<[]>;
    const stoppedMoveResize =
      stoppedSource.interactiveMoveResizeFinished as Signal<[]>;
    const stoppedOutput = stoppedSource.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const stoppedModal = stoppedSource.modalChanged as Signal<[]>;
    const stoppedMaximizeable = stoppedSource.maximizeableChanged as Signal<
      [maximizeable: boolean]
    >;
    const stoppedTile = stoppedSource.tileChanged as Signal<
      [tile: object | null]
    >;
    const stoppedTransient = stoppedSource.transientChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(
      createWorkspace(
        [removedSource, stoppedSource],
        new Signal<[window: KWinWindow]>(),
        windowRemoved,
      ),
      { changed: (windowId) => changed.push(windowId) },
    );

    observer.start();
    expect([
      removedDesktops.size,
      removedFullScreen.size,
      removedMoveResize.size,
      removedOutput.size,
      stoppedDesktops.size,
      stoppedMoveResize.size,
      stoppedOutput.size,
      stoppedTile.size,
      stoppedModal.size,
      stoppedMaximizeable.size,
      stoppedTransient.size,
    ]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

    windowRemoved.emit(removedSource);
    expect([
      removedDesktops.size,
      removedFullScreen.size,
      removedMoveResize.size,
      removedOutput.size,
    ]).toEqual([0, 0, 0, 0]);

    observer.stop();
    expect([
      stoppedDesktops.size,
      stoppedMoveResize.size,
      stoppedOutput.size,
      stoppedTile.size,
      stoppedModal.size,
      stoppedMaximizeable.size,
      stoppedTransient.size,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0]);

    removedDesktops.emit();
    removedFullScreen.emit();
    removedMoveResize.emit();
    removedOutput.emit();
    stoppedDesktops.emit();
    stoppedMoveResize.emit();
    stoppedOutput.emit();
    stoppedTile.emit(null);
    stoppedModal.emit();
    stoppedMaximizeable.emit(true);
    stoppedTransient.emit();
    expect(changed).toEqual([]);
  });
});
