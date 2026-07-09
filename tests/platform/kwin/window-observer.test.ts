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
  const output: KWinOutput = { name: "DP-1" };
  const desktop: KWinVirtualDesktop = { id: "desktop-1" };

  return {
    desktops: [desktop],
    desktopWindow: false,
    dialog: false,
    dock: false,
    internalId: "window-1",
    normalWindow: true,
    output,
    specialWindow: false,
    ...overrides,
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
});

describe("WindowObserver", () => {
  it("tracks lifecycle signals without polling", () => {
    const windowAdded = new Signal<[window: KWinWindow]>();
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const initialWindow = createWindow();
    const workspace: KWinWorkspace = {
      stackingOrder: [initialWindow],
      windowAdded,
      windowRemoved,
    };
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
});
