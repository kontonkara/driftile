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
    deleted: false,
    desktops: [desktop],
    desktopsChanged: new Signal<[]>(),
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    fullScreen: false,
    internalId: "window-1",
    interactiveMoveResizeFinished: new Signal<[]>(),
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    move: false,
    moveable: true,
    moveResizedChanged: new Signal<[]>(),
    normalWindow: true,
    onAllDesktops: false,
    output,
    outputChanged: new Signal<[oldOutput?: KWinOutput | null]>(),
    resize: false,
    resizeable: true,
    specialWindow: false,
    tile: null,
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

  it("publishes interactive move and resize lifecycle changes", () => {
    const source = createWindow();
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const stateChanged = source.moveResizedChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();
    stateChanged.emit();
    finished.emit();

    expect(changed).toEqual(["window-1", "window-1"]);
  });

  it("disconnects per-window handlers on removal and stop", () => {
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const removedSource = createWindow();
    const stoppedSource = createWindow({ internalId: "window-2" });
    const removedDesktops = removedSource.desktopsChanged as Signal<[]>;
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
      removedMoveResize.size,
      removedOutput.size,
      stoppedDesktops.size,
      stoppedMoveResize.size,
      stoppedOutput.size,
    ]).toEqual([1, 1, 1, 1, 1, 1]);

    windowRemoved.emit(removedSource);
    expect([
      removedDesktops.size,
      removedMoveResize.size,
      removedOutput.size,
    ]).toEqual([0, 0, 0]);

    observer.stop();
    expect([
      stoppedDesktops.size,
      stoppedMoveResize.size,
      stoppedOutput.size,
    ]).toEqual([0, 0, 0]);

    removedDesktops.emit();
    removedMoveResize.emit();
    removedOutput.emit();
    stoppedDesktops.emit();
    stoppedMoveResize.emit();
    stoppedOutput.emit();
    expect(changed).toEqual([]);
  });
});
