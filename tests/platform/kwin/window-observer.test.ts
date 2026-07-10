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
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    fullScreen: false,
    internalId: "window-1",
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    move: false,
    moveable: true,
    normalWindow: true,
    onAllDesktops: false,
    output,
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
    activeScreen: output,
    clientArea: () => ({ height: 1080, width: 1920, x: 0, y: 0 }),
    currentDesktop: desktop,
    currentDesktopForScreen: () => desktop,
    desktops: [desktop],
    screens: [output],
    stackingOrder,
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
});
