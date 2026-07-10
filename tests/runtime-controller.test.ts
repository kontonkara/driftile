import { describe, expect, it } from "vitest";
import type {
  KWinOutput,
  KWinSignal,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "../src/platform/kwin/api";
import { RuntimeController } from "../src/runtime-controller";

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

class ManualScheduler {
  private readonly callbacks: Array<() => void> = [];

  get pendingCount(): number {
    return this.callbacks.length;
  }

  readonly schedule = (callback: () => void): void => {
    this.callbacks.push(callback);
  };

  flush(): void {
    const callback = this.callbacks.shift();

    if (!callback) {
      throw new Error("no scheduled callback");
    }

    callback();
  }
}

interface TrackedWindow {
  readonly window: KWinWindow;
  readonly writeCount: number;
}

function createTrackedWindow(
  id: string,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
  overrides: Partial<KWinWindow> = {},
): TrackedWindow {
  let frameGeometry = { height: 200, width: 300, x: 0, y: 0 };
  let writeCount = 0;
  const window: KWinWindow = {
    deleted: false,
    desktops: [desktop],
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry,
    fullScreen: false,
    internalId: id,
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
  frameGeometry = window.frameGeometry;
  Object.defineProperty(window, "frameGeometry", {
    configurable: true,
    enumerable: true,
    get: () => frameGeometry,
    set: (value: KWinWindow["frameGeometry"]) => {
      frameGeometry = value;
      writeCount += 1;
    },
  });

  return {
    get writeCount() {
      return writeCount;
    },
    window,
  };
}

interface WorkspaceFixture {
  readonly activationCount: number;
  readonly windowActivated: Signal<[window: KWinWindow | null]>;
  readonly windowAdded: Signal<[window: KWinWindow]>;
  readonly windowRemoved: Signal<[window: KWinWindow]>;
  readonly workspace: KWinWorkspace;
}

function createWorkspace(
  activeOutput: KWinOutput,
  activeDesktop: KWinVirtualDesktop,
  outputs: readonly KWinOutput[],
  desktops: readonly KWinVirtualDesktop[],
  windows: readonly KWinWindow[],
  perOutputDesktops = true,
): WorkspaceFixture {
  const windowActivated = new Signal<[window: KWinWindow | null]>();
  const windowAdded = new Signal<[window: KWinWindow]>();
  const windowRemoved = new Signal<[window: KWinWindow]>();
  let activationCount = 0;
  let activeWindow = windows[windows.length - 1] ?? null;
  const desktopResolver = perOutputDesktops
    ? { currentDesktopForScreen: () => activeDesktop }
    : {};
  const workspace: KWinWorkspace = {
    activeWindow,
    activeScreen: activeOutput,
    clientArea: () => ({ height: 800, width: 1000, x: 0, y: 0 }),
    currentDesktop: activeDesktop,
    desktops,
    screens: outputs,
    stackingOrder: windows,
    windowActivated,
    windowAdded,
    windowRemoved,
    ...desktopResolver,
  };
  Object.defineProperty(workspace, "activeWindow", {
    configurable: true,
    enumerable: true,
    get: () => activeWindow,
    set: (window: KWinWindow | null) => {
      activeWindow = window;
      activationCount += 1;
      windowActivated.emit(window);
    },
  });

  return {
    get activationCount() {
      return activationCount;
    },
    windowActivated,
    windowAdded,
    windowRemoved,
    workspace,
  };
}

describe("RuntimeController", () => {
  it("focuses adjacent managed columns and stops at their boundaries", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(first.window);
    expect(controller.focusLeft()).toBe(false);
    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(controller.focusRight()).toBe(false);
    expect(fixture.activationCount).toBe(2);
  });

  it("inserts a new column after the externally activated window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "proportion", value: 0.3 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = first.window;
    fixture.windowAdded.emit(third.window);
    scheduler.flush();

    expect(controller.managedCount).toBe(3);
    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(third.window);
  });

  it("does not focus from an unmanaged active window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const managed = createTrackedWindow("window-1", output, desktop);
    const dialog = createTrackedWindow("dialog-1", output, desktop, {
      dialog: true,
      normalWindow: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [managed.window, dialog.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(controller.focusLeft()).toBe(false);
    expect(controller.focusRight()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(dialog.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("does not focus a managed window after it moves to another output", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    Object.defineProperty(first.window, "output", { value: otherOutput });

    expect(controller.focusLeft()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("tiles only normal windows in the initial active context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const otherDesktop = { id: "desktop-2" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const offOutput = createTrackedWindow("window-3", otherOutput, desktop);
    const offDesktop = createTrackedWindow("window-4", output, otherDesktop);
    const dialog = createTrackedWindow("dialog-1", output, desktop, {
      dialog: true,
      normalWindow: false,
    });
    const maximized = createTrackedWindow("window-5", output, desktop, {
      maximizeMode: 3,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop, otherDesktop],
      [
        first.window,
        second.window,
        offOutput.window,
        offDesktop.window,
        dialog.window,
        maximized.window,
      ],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
    expect(second.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 505,
      y: 10,
    });
    expect(first.writeCount).toBe(1);
    expect(second.writeCount).toBe(1);
    expect(offOutput.writeCount).toBe(0);
    expect(offDesktop.writeCount).toBe(0);
    expect(dialog.writeCount).toBe(0);
    expect(maximized.writeCount).toBe(0);
    expect(controller.reconcile()).toBe(0);

    controller.stop();
    expect(first.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 0,
      y: 0,
    });
    expect(second.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 0,
      y: 0,
    });
    expect(first.writeCount).toBe(2);
    expect(second.writeCount).toBe(2);
  });

  it("batches lifecycle events and reconciles their latest state", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });
    const removedBeforeFlush = createTrackedWindow("window-2", output, desktop);

    controller.start();
    fixture.windowAdded.emit(removedBeforeFlush.window);
    fixture.windowRemoved.emit(removedBeforeFlush.window);

    expect(scheduler.pendingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(0);
    expect(removedBeforeFlush.writeCount).toBe(0);

    const second = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    fixture.windowAdded.emit(second.window);
    fixture.windowAdded.emit(third.window);

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(third.window.frameGeometry.x).toBe(0);
    expect(third.writeCount).toBe(0);

    fixture.windowRemoved.emit(first.window);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(1);
    expect(second.window.frameGeometry.x).toBe(10);
    expect(third.window.frameGeometry.x).toBe(0);
  });

  it("does not write a window moved to another output before a flush", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });
    const transferred = createTrackedWindow("window-2", output, desktop);

    controller.start();
    fixture.windowAdded.emit(transferred.window);
    Object.defineProperty(transferred.window, "output", {
      value: otherOutput,
    });
    scheduler.flush();

    expect(transferred.writeCount).toBe(0);
    expect(transferred.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 0,
      y: 0,
    });

    controller.stop();
    expect(transferred.writeCount).toBe(0);
  });

  it("leaves a window unmanaged when its size constraints reject the slot", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const constrained = createTrackedWindow("window-1", output, desktop, {
      minSize: { height: 200, width: 600 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [constrained.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(controller.managedCount).toBe(0);
    expect(constrained.writeCount).toBe(0);
  });

  it("cleans up a failed start and can be started again", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
    );
    let shouldFail = true;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        if (shouldFail) {
          throw new Error("client area unavailable");
        }

        return { height: 800, width: 1000, x: 0, y: 0 };
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    expect(() => controller.start()).toThrow("client area unavailable");
    expect(controller.managedCount).toBe(0);
    shouldFail = false;

    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(1);
    expect(window.writeCount).toBe(1);
  });

  it("skips original-frame restoration after output topology changes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    Object.defineProperty(output, "geometry", {
      value: { height: 800, width: 1000, x: 1000, y: 0 },
    });
    controller.stop();

    expect(window.writeCount).toBe(1);
    expect(window.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("falls back to the global current desktop on X11", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
      false,
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(1);
    expect(window.writeCount).toBe(1);
  });
});

function createOutput(name: string, x: number): KWinOutput {
  return {
    devicePixelRatio: 1,
    geometry: { height: 800, width: 1000, x, y: 0 },
    name,
  };
}
