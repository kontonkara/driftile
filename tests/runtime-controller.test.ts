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
  readonly desktopsChanged: Signal<[]>;
  readonly fullScreenChanged: Signal<[]>;
  readonly interactiveMoveResizeFinished: Signal<[]>;
  readonly maximizedAboutToChange: Signal<[mode: number]>;
  readonly maximizedChanged: Signal<[]>;
  readonly minimizedChanged: Signal<[]>;
  readonly moveResizedChanged: Signal<[]>;
  readonly outputChanged: Signal<[oldOutput?: KWinOutput | null]>;
  readonly requestedTileChanged: Signal<[]>;
  readonly tileChanged: Signal<[tile: object | null]>;
  readonly window: KWinWindow;
  readonly writeCount: number;
}

function createTrackedWindow(
  id: string,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
  overrides: Partial<KWinWindow> = {},
): TrackedWindow {
  const desktopsChanged = new Signal<[]>();
  const fullScreenChanged = new Signal<[]>();
  let frameGeometry = { height: 200, width: 300, x: 0, y: 0 };
  const interactiveMoveResizeFinished = new Signal<[]>();
  const maximizedAboutToChange = new Signal<[mode: number]>();
  const maximizedChanged = new Signal<[]>();
  const minimizedChanged = new Signal<[]>();
  const moveResizedChanged = new Signal<[]>();
  const outputChanged = new Signal<[oldOutput?: KWinOutput | null]>();
  const requestedTileChanged = new Signal<[]>();
  const tileChanged = new Signal<[tile: object | null]>();
  let writeCount = 0;
  const window: KWinWindow = {
    deleted: false,
    desktops: [desktop],
    desktopsChanged,
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry,
    fullScreen: false,
    fullScreenChanged,
    internalId: id,
    interactiveMoveResizeFinished,
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizedAboutToChange,
    maximizedChanged,
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    minimizedChanged,
    move: false,
    moveable: true,
    moveResizedChanged,
    normalWindow: true,
    onAllDesktops: false,
    output,
    outputChanged,
    requestedTileChanged,
    resize: false,
    resizeable: true,
    specialWindow: false,
    tile: null,
    tileChanged,
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
    desktopsChanged,
    get writeCount() {
      return writeCount;
    },
    fullScreenChanged,
    interactiveMoveResizeFinished,
    maximizedAboutToChange,
    maximizedChanged,
    minimizedChanged,
    moveResizedChanged,
    outputChanged,
    requestedTileChanged,
    tileChanged,
    window,
  };
}

interface WorkspaceFixture {
  readonly activationCount: number;
  readonly currentDesktopChanged: Signal<
    [
      previous: KWinVirtualDesktop | null,
      current?: KWinVirtualDesktop | null,
      output?: KWinOutput,
    ]
  >;
  setCurrentDesktop(output: KWinOutput, desktop: KWinVirtualDesktop): void;
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
  const currentDesktopChanged = new Signal<
    [
      previous: KWinVirtualDesktop | null,
      current?: KWinVirtualDesktop | null,
      output?: KWinOutput,
    ]
  >();
  const windowActivated = new Signal<[window: KWinWindow | null]>();
  const windowAdded = new Signal<[window: KWinWindow]>();
  const windowRemoved = new Signal<[window: KWinWindow]>();
  let activationCount = 0;
  let activeWindow = windows[windows.length - 1] ?? null;
  let currentDesktop = activeDesktop;
  const currentDesktops = new Map(
    outputs.map((output) => [output.name, activeDesktop]),
  );
  const desktopResolver = perOutputDesktops
    ? {
        currentDesktopForScreen: (output: KWinOutput) =>
          currentDesktops.get(output.name) ?? null,
      }
    : {};
  const workspace: KWinWorkspace = {
    activeWindow,
    activeScreen: activeOutput,
    clientArea: (_option, output) => ({
      height: 800,
      width: 1000,
      x: output.geometry.x,
      y: output.geometry.y,
    }),
    currentDesktop,
    currentDesktopChanged,
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
  Object.defineProperty(workspace, "currentDesktop", {
    configurable: true,
    enumerable: true,
    get: () => currentDesktop,
  });

  return {
    get activationCount() {
      return activationCount;
    },
    currentDesktopChanged,
    setCurrentDesktop: (output, desktop) => {
      const previous = perOutputDesktops
        ? (currentDesktops.get(output.name) ?? null)
        : currentDesktop;

      if (perOutputDesktops) {
        currentDesktops.set(output.name, desktop);
      } else {
        currentDesktop = desktop;

        for (const candidate of outputs) {
          currentDesktops.set(candidate.name, desktop);
        }
      }

      if (output.name === activeOutput.name) {
        currentDesktop = desktop;
      }

      if (perOutputDesktops) {
        currentDesktopChanged.emit(previous, desktop, output);
      } else {
        currentDesktopChanged.emit(previous);
      }
    },
    windowActivated,
    windowAdded,
    windowRemoved,
    workspace,
  };
}

interface WindowStateTransition {
  readonly name: string;
  readonly set: (tracked: TrackedWindow, enabled: boolean) => void;
}

const WINDOW_STATE_TRANSITIONS: readonly WindowStateTransition[] = [
  {
    name: "fullscreen",
    set: (tracked, enabled) => {
      Object.defineProperty(tracked.window, "fullScreen", {
        configurable: true,
        value: enabled,
      });
      tracked.fullScreenChanged.emit();
    },
  },
  {
    name: "minimized",
    set: (tracked, enabled) => {
      Object.defineProperty(tracked.window, "minimized", {
        configurable: true,
        value: enabled,
      });
      tracked.minimizedChanged.emit();
    },
  },
  {
    name: "maximized",
    set: (tracked, enabled) => {
      tracked.maximizedAboutToChange.emit(enabled ? 3 : 0);
      Object.defineProperty(tracked.window, "maximizeMode", {
        configurable: true,
        value: enabled ? 3 : 0,
      });
      tracked.maximizedChanged.emit();
    },
  },
  {
    name: "native tiled",
    set: (tracked, enabled) => {
      Object.defineProperty(tracked.window, "tile", {
        configurable: true,
        value: enabled ? {} : null,
      });
      tracked.requestedTileChanged.emit();
      tracked.tileChanged.emit(tracked.window.tile);
    },
  },
];

function setWindowState(
  name: string,
  tracked: TrackedWindow,
  enabled: boolean,
): void {
  const transition = WINDOW_STATE_TRANSITIONS.find(
    (candidate) => candidate.name === name,
  );

  if (!transition) {
    throw new Error(`unknown window state transition: ${name}`);
  }

  transition.set(tracked, enabled);
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

  it("plans a large startup context with constant geometry lookups", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 1000 }, (_, index) =>
      createTrackedWindow(`window-${String(index)}`, output, desktop),
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    let geometryLookupCount = 0;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        geometryLookupCount += 1;
        return { height: 800, width: 1000, x: 0, y: 0 };
      },
    });
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      scheduleResume: scheduler.schedule,
      startupStabilizationProbes: 2,
    });

    controller.start();
    expect(controller.managedCount).toBe(0);
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1000);
    expect(controller.lastWriteCount).toBe(1000);
    expect(geometryLookupCount).toBe(2);
  });

  it("queues windows added during startup stabilization", () => {
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
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      scheduleResume: scheduler.schedule,
      startupStabilizationProbes: 2,
    });
    const third = createTrackedWindow("window-3", output, desktop);

    controller.start();
    fixture.windowAdded.emit(third.window);
    expect(controller.managedCount).toBe(0);
    expect(third.writeCount).toBe(0);

    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(3);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([10, 505, 1000]);
  });

  it("observes a maximize commit during startup stabilization", () => {
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
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
      startupStabilizationProbes: 2,
    });

    controller.start();
    resumeScheduler.flush();
    Object.defineProperty(first.window, "maximizeMode", {
      configurable: true,
      value: 3,
    });
    resumeScheduler.flush();

    expect(controller.managedCount).toBe(0);
    expect(first.writeCount).toBe(0);

    Object.defineProperty(first.window, "maximizeMode", {
      configurable: true,
      value: 0,
    });
    first.maximizedChanged.emit();
    workScheduler.flush();
    resumeScheduler.flush();
    workScheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
  });

  it("rolls back layout focus when geometry is temporarily unavailable", () => {
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
      [first.window, second.window, third.window],
    );
    const scheduler = new ManualScheduler();
    let geometryAvailable = true;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        if (!geometryAvailable) {
          throw new Error("client area unavailable");
        }

        return { height: 800, width: 1000, x: 0, y: 0 };
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(second.window);

    geometryAvailable = false;
    expect(controller.focusLeft()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(scheduler.pendingCount).toBe(1);

    geometryAvailable = true;
    scheduler.flush();
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([-475, 20, 515]);
  });

  it.each(WINDOW_STATE_TRANSITIONS)(
    "reserves layout ownership while a window is $name",
    ({ set }) => {
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
      const scheduler = new ManualScheduler();
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        gap: 10,
        schedule: scheduler.schedule,
      });

      controller.start();
      set(first, true);
      expect(scheduler.pendingCount).toBe(1);
      scheduler.flush();

      expect(controller.managedCount).toBe(2);
      expect(first.window.frameGeometry.x).toBe(10);
      expect(second.window.frameGeometry.x).toBe(505);
      expect(controller.focusLeft()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(second.window);

      set(first, false);
      scheduler.flush();
      expect(scheduler.pendingCount).toBe(1);
      scheduler.flush();
      scheduler.flush();

      expect(controller.managedCount).toBe(2);
      expect(first.window.frameGeometry.x).toBe(10);
      expect(second.window.frameGeometry.x).toBe(505);
      expect(controller.focusLeft()).toBe(true);
      expect(fixture.workspace.activeWindow).toBe(first.window);

      controller.stop();
      expect(first.window.frameGeometry.x).toBe(0);
      expect(second.window.frameGeometry.x).toBe(0);
    },
  );

  it("replays activation received while a window is suspended", () => {
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
      [first.window, second.window, third.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    setWindowState("fullscreen", first, true);
    scheduler.flush();
    fixture.workspace.activeWindow = first.window;
    setWindowState("fullscreen", first, false);
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();

    expect(fixture.workspace.activeWindow).toBe(first.window);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([0, 495, 990]);
  });

  it("blocks geometry immediately when maximize is requested", () => {
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

    controller.start();
    first.window.frameGeometry = {
      height: 700,
      width: 900,
      x: 50,
      y: 40,
    };
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    first.maximizedAboutToChange.emit(3);
    first.minimizedChanged.emit();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(first.window.frameGeometry).toEqual({
      height: 700,
      width: 900,
      x: 50,
      y: 40,
    });
    controller.stop();
    expect(first.window.frameGeometry.x).toBe(50);
  });

  it("resumes after an unapplied maximize request is canceled", () => {
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

    controller.start();
    first.maximizedAboutToChange.emit(3);
    first.maximizedAboutToChange.emit(0);
    scheduler.flush();

    for (let callback = 0; callback < 40; callback += 1) {
      scheduler.flush();
    }

    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
    controller.stop();
    expect(first.window.frameGeometry.x).toBe(0);
  });

  it("waits for a superseded native-tile commit before resuming", () => {
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
    const nativeTile = {};

    controller.start();
    Object.defineProperty(first.window, "tile", {
      configurable: true,
      value: nativeTile,
    });
    first.requestedTileChanged.emit();
    Object.defineProperty(first.window, "tile", {
      configurable: true,
      value: null,
    });
    first.requestedTileChanged.emit();
    first.tileChanged.emit(nativeTile);
    scheduler.flush();

    first.window.frameGeometry = {
      height: 700,
      width: 300,
      x: 4,
      y: 4,
    };
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    scheduler.flush();
    expect(first.window.frameGeometry.x).toBe(4);

    first.tileChanged.emit(null);
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();
    expect(first.window.frameGeometry.x).toBe(10);
  });

  it("waits for restored geometry to stabilize before resuming writes", () => {
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

    controller.start();
    setWindowState("fullscreen", first, true);
    scheduler.flush();
    first.window.frameGeometry = {
      height: 720,
      width: 900,
      x: 40,
      y: 30,
    };
    setWindowState("fullscreen", first, false);
    scheduler.flush();

    first.window.frameGeometry = {
      height: 700,
      width: 880,
      x: 60,
      y: 50,
    };
    scheduler.flush();
    expect(first.window.frameGeometry.x).toBe(60);
    expect(scheduler.pendingCount).toBe(1);

    scheduler.flush();
    scheduler.flush();
    scheduler.flush();
    expect(first.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("captures the restore baseline only after an initial state clears", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 800, width: 1000, x: 0, y: 0 },
      fullScreen: true,
    });
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

    controller.start();
    expect(controller.managedCount).toBe(0);
    first.window.frameGeometry = {
      height: 500,
      width: 700,
      x: 100,
      y: 80,
    };
    setWindowState("fullscreen", first, false);
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
    controller.stop();
    expect(first.window.frameGeometry).toEqual({
      height: 500,
      width: 700,
      x: 100,
      y: 80,
    });
  });

  it("recovers when an initial geometry request is canceled silently", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      moveable: false,
      resizeable: false,
    });
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

    controller.start();
    expect(controller.managedCount).toBe(0);
    expect(scheduler.pendingCount).toBe(1);

    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: true },
      resizeable: { configurable: true, value: true },
    });
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("bounds retries for a permanently non-writable window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      moveable: false,
      resizeable: false,
    });
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

    controller.start();

    for (let callback = 0; callback < 40; callback += 1) {
      expect(scheduler.pendingCount).toBe(1);
      scheduler.flush();
    }

    expect(scheduler.pendingCount).toBe(0);
    expect(controller.managedCount).toBe(0);
  });

  it("coalesces transient retries before the delayed probe runs", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      moveable: false,
      resizeable: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();

    for (let event = 0; event < 20; event += 1) {
      first.minimizedChanged.emit();
      controller.reconcile();
    }

    expect(resumeScheduler.pendingCount).toBe(1);
    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: true },
      resizeable: { configurable: true, value: true },
    });
    resumeScheduler.flush();
    workScheduler.flush();
    resumeScheduler.flush();
    workScheduler.flush();

    expect(controller.managedCount).toBe(1);
  });

  it("invalidates a transient probe token within the same run", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      moveable: false,
      resizeable: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: true },
      resizeable: { configurable: true, value: true },
    });
    first.minimizedChanged.emit();
    workScheduler.flush();

    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: false },
      resizeable: { configurable: true, value: false },
    });
    first.minimizedChanged.emit();
    workScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(3);

    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(2);
    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);

    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: true },
      resizeable: { configurable: true, value: true },
    });
    resumeScheduler.flush();
    workScheduler.flush();
    resumeScheduler.flush();
    workScheduler.flush();
    expect(controller.managedCount).toBe(1);
  });

  it("ignores an old startup probe after restarting the same window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      moveable: false,
      resizeable: false,
    });
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

    controller.start();
    controller.stop();
    controller.start();
    expect(scheduler.pendingCount).toBe(2);

    Object.defineProperties(first.window, {
      moveable: { configurable: true, value: true },
      resizeable: { configurable: true, value: true },
    });
    scheduler.flush();
    expect(controller.managedCount).toBe(0);
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
  });

  it("recovers when an initial native-tile request is canceled", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      tile: {},
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    expect(controller.managedCount).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(0);

    Object.defineProperty(first.window, "tile", {
      configurable: true,
      value: null,
    });
    first.requestedTileChanged.emit();
    workScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(controller.managedCount).toBe(0);
      resumeScheduler.flush();
      workScheduler.flush();
    }

    expect(controller.managedCount).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(1);
    resumeScheduler.flush();
    workScheduler.flush();
    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
  });

  it("waits for a committed initial native tile to clear", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tile = {};
    const first = createTrackedWindow("window-1", output, desktop, { tile });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    Object.defineProperty(first.window, "tile", {
      configurable: true,
      value: null,
    });
    first.requestedTileChanged.emit();
    workScheduler.flush();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      resumeScheduler.flush();
      workScheduler.flush();
      expect(controller.managedCount).toBe(0);
    }

    first.tileChanged.emit(null);
    workScheduler.flush();
    resumeScheduler.flush();
    expect(controller.managedCount).toBe(0);
    resumeScheduler.flush();
    workScheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry.x).toBe(10);
  });

  it("resumes only after overlapping state blockers are all clear", () => {
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
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    setWindowState("fullscreen", first, true);
    setWindowState("maximized", first, true);
    scheduler.flush();
    setWindowState("fullscreen", first, false);
    scheduler.flush();

    expect(scheduler.pendingCount).toBe(0);
    expect(controller.focusLeft()).toBe(false);

    setWindowState("maximized", first, false);
    scheduler.flush();
    scheduler.flush();

    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(first.window);
  });

  it("does not give a suspended window reservation to an overflow waiter", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const waiting = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, waiting.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    setWindowState("minimized", first, true);
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry.x).toBe(10);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(waiting.writeCount).toBe(0);

    setWindowState("minimized", first, false);
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry.x).toBe(10);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(waiting.writeCount).toBe(0);
  });

  it("rebases a context transfer only after suspended state settles", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const transferred = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [transferred.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    setWindowState("fullscreen", transferred, true);
    scheduler.flush();
    transferred.window.frameGeometry = {
      height: 200,
      width: 300,
      x: 1200,
      y: 0,
    };
    Object.defineProperty(transferred.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    transferred.outputChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(transferred.window.frameGeometry.x).toBe(1200);

    setWindowState("fullscreen", transferred, false);
    scheduler.flush();
    expect(transferred.window.frameGeometry.x).toBe(1200);
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(transferred.window.frameGeometry.x).toBe(1010);
    controller.stop();
    expect(transferred.window.frameGeometry.x).toBe(1200);
  });

  it("routes focus through the active window context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const otherFirst = createTrackedWindow("window-3", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const otherSecond = createTrackedWindow("window-4", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1500, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, otherFirst.window, otherSecond.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(fixture.workspace.activeWindow).toBe(otherSecond.window);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(otherFirst.window);
    expect(first.window.frameGeometry.x).toBe(10);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(otherFirst.window.frameGeometry.x).toBe(1010);
    expect(otherSecond.window.frameGeometry.x).toBe(1505);
  });

  it("scrolls the viewport only when focus crosses a visible boundary", () => {
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
      [first.window, second.window, third.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(controller.managedCount).toBe(3);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([-475, 20, 515]);

    expect(controller.focusLeft()).toBe(true);
    expect(controller.lastWriteCount).toBe(0);
    expect(controller.focusLeft()).toBe(true);
    expect(controller.lastWriteCount).toBe(3);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([0, 495, 990]);

    expect(controller.focusRight()).toBe(true);
    expect(controller.lastWriteCount).toBe(0);
    expect(controller.focusRight()).toBe(true);
    expect(controller.lastWriteCount).toBe(3);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([-475, 20, 515]);
  });

  it("keeps overflow windows unmanaged when more than one output exists", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, third.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();

    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry.x).toBe(10);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(third.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 0,
      y: 0,
    });
    expect(third.writeCount).toBe(0);
  });

  it("does not reveal a background window that did not take focus", () => {
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
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    fixture.windowAdded.emit(third.window);
    scheduler.flush();

    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(controller.managedCount).toBe(3);
    expect(
      [first, second, third].map(({ window }) => window.frameGeometry.x),
    ).toEqual([10, 505, 1000]);
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

  it("tiles normal windows in every visible output context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const otherDesktop = { id: "desktop-2" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const offOutput = createTrackedWindow("window-3", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
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
    expect(controller.managedCount).toBe(4);
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
    expect(offOutput.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 1010,
      y: 10,
    });
    expect(offOutput.writeCount).toBe(1);
    expect(offDesktop.writeCount).toBe(0);
    expect(dialog.writeCount).toBe(0);
    expect(maximized.writeCount).toBe(0);
    expect(controller.reconcile()).toBe(0);

    fixture.setCurrentDesktop(output, otherDesktop);
    expect(offDesktop.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
    expect(offDesktop.writeCount).toBe(1);
    expect(controller.lastWriteCount).toBe(1);

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
    expect(offOutput.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 1100,
      y: 0,
    });
    expect(offDesktop.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 0,
      y: 0,
    });
    expect(first.writeCount).toBe(2);
    expect(second.writeCount).toBe(2);
    expect(offOutput.writeCount).toBe(2);
    expect(offDesktop.writeCount).toBe(2);
  });

  it("preserves independent viewport state across virtual desktops", () => {
    const output = createOutput("DP-1", 0);
    const firstDesktop = { id: "desktop-1" };
    const secondDesktop = { id: "desktop-2" };
    const firstWindows = [
      createTrackedWindow("window-1", output, firstDesktop),
      createTrackedWindow("window-2", output, firstDesktop),
      createTrackedWindow("window-3", output, firstDesktop),
    ];
    const secondWindows = [
      createTrackedWindow("window-4", output, secondDesktop),
      createTrackedWindow("window-5", output, secondDesktop),
      createTrackedWindow("window-6", output, secondDesktop),
    ];
    const fixture = createWorkspace(
      output,
      firstDesktop,
      [output],
      [firstDesktop, secondDesktop],
      [...firstWindows, ...secondWindows].map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = firstWindows[2]?.window ?? null;
    expect(firstWindows.map(({ window }) => window.frameGeometry.x)).toEqual([
      -475, 20, 515,
    ]);

    fixture.setCurrentDesktop(output, secondDesktop);
    fixture.workspace.activeWindow = secondWindows[0]?.window ?? null;
    expect(secondWindows.map(({ window }) => window.frameGeometry.x)).toEqual([
      0, 495, 990,
    ]);

    fixture.setCurrentDesktop(output, firstDesktop);
    expect(firstWindows.map(({ window }) => window.frameGeometry.x)).toEqual([
      -475, 20, 515,
    ]);

    fixture.setCurrentDesktop(output, secondDesktop);
    expect(secondWindows.map(({ window }) => window.frameGeometry.x)).toEqual([
      0, 495, 990,
    ]);
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
    fixture.workspace.activeWindow = second.window;
    fixture.windowAdded.emit(third.window);
    fixture.workspace.activeWindow = third.window;

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(3);
    expect(controller.managedCount).toBe(3);
    expect(first.window.frameGeometry.x).toBe(-475);
    expect(second.window.frameGeometry.x).toBe(20);
    expect(third.window.frameGeometry.x).toBe(515);

    fixture.windowRemoved.emit(first.window);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(10);
    expect(third.window.frameGeometry.x).toBe(505);
  });

  it("reconciles each dirty output context in one scheduled batch", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const otherFirst = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, otherFirst.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });
    const second = createTrackedWindow("window-3", output, desktop);
    const otherSecond = createTrackedWindow("window-4", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1500, y: 0 },
    });

    controller.start();
    fixture.windowAdded.emit(second.window);
    fixture.windowAdded.emit(otherSecond.window);

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.lastWriteCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(505);
    expect(otherSecond.window.frameGeometry.x).toBe(1505);
    expect(first.writeCount).toBe(1);
    expect(otherFirst.writeCount).toBe(1);
  });

  it("rebases a transferred window before the batched reconcile", () => {
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
    const transferred = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1200, y: 0 },
    });

    controller.start();
    fixture.windowAdded.emit(transferred.window);
    Object.defineProperty(transferred.window, "output", {
      value: otherOutput,
    });
    transferred.outputChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(transferred.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 1010,
      y: 10,
    });
    expect(first.window.frameGeometry.x).toBe(10);

    controller.stop();
    expect(transferred.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 1200,
      y: 0,
    });
    expect(transferred.writeCount).toBe(2);
  });

  it("coalesces output and desktop changes into one live context transfer", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const otherDesktop = { id: "desktop-2" };
    const transferred = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop, otherDesktop],
      [transferred.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    transferred.window.frameGeometry = {
      height: 200,
      width: 300,
      x: 1400,
      y: 0,
    };
    Object.defineProperty(transferred.window, "output", {
      value: otherOutput,
    });
    transferred.outputChanged.emit();
    Object.defineProperty(transferred.window, "desktops", {
      value: [otherDesktop],
    });
    transferred.desktopsChanged.emit();

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(controller.managedCount).toBe(1);
    expect(transferred.window.frameGeometry.x).toBe(1400);

    fixture.setCurrentDesktop(otherOutput, otherDesktop);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(transferred.window.frameGeometry.x).toBe(1010);

    controller.stop();
    expect(transferred.window.frameGeometry.x).toBe(1400);
  });

  it("re-admits an output transfer after interactive movement finishes", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const transferred = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [transferred.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    transferred.window.frameGeometry = {
      height: 200,
      width: 300,
      x: 1200,
      y: 0,
    };
    Object.defineProperties(transferred.window, {
      move: { configurable: true, value: true },
      output: { configurable: true, value: otherOutput },
    });
    transferred.outputChanged.emit();
    transferred.moveResizedChanged.emit();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(controller.managedCount).toBe(1);

    Object.defineProperty(transferred.window, "move", {
      configurable: true,
      value: false,
    });
    transferred.interactiveMoveResizeFinished.emit();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(transferred.window.frameGeometry.x).toBe(1010);
  });

  it("keeps source ownership when an interactive output drag is canceled", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const dragged = createTrackedWindow("window-1", output, desktop);
    const remaining = createTrackedWindow("window-2", output, desktop);
    const waiting = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [dragged.window, remaining.window, waiting.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    Object.defineProperties(dragged.window, {
      move: { configurable: true, value: true },
      output: { configurable: true, value: otherOutput },
    });
    dragged.outputChanged.emit();
    dragged.moveResizedChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(waiting.writeCount).toBe(0);

    Object.defineProperties(dragged.window, {
      move: { configurable: true, value: false },
      output: { configurable: true, value: output },
    });
    dragged.outputChanged.emit();
    dragged.interactiveMoveResizeFinished.emit();
    scheduler.flush();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(dragged.window.frameGeometry.x).toBe(10);
    expect(remaining.window.frameGeometry.x).toBe(505);
    expect(waiting.writeCount).toBe(0);
  });

  it("releases an all-desktop window and admits it again when it returns", () => {
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
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    Object.defineProperties(first.window, {
      desktops: { configurable: true, value: [] },
      onAllDesktops: { configurable: true, value: true },
    });
    first.desktopsChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(second.window.frameGeometry.x).toBe(10);

    Object.defineProperties(first.window, {
      desktops: { configurable: true, value: [desktop] },
      onAllDesktops: { configurable: true, value: false },
    });
    first.desktopsChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(10);
    expect(first.window.frameGeometry.x).toBe(505);
  });

  it("releases every transferred window before admitting a context swap", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 0 },
    });
    const second = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    first.window.frameGeometry = { height: 200, width: 300, x: 1200, y: 0 };
    second.window.frameGeometry = { height: 200, width: 300, x: 200, y: 0 };
    Object.defineProperty(first.window, "output", { value: otherOutput });
    Object.defineProperty(second.window, "output", { value: output });
    first.outputChanged.emit();
    second.outputChanged.emit();

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry.x).toBe(1010);
    expect(second.window.frameGeometry.x).toBe(10);

    controller.stop();
    expect(first.window.frameGeometry.x).toBe(1200);
    expect(second.window.frameGeometry.x).toBe(200);
  });

  it("leaves a transfer unmanaged when its destination would overflow", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const transferred = createTrackedWindow("window-1", output, desktop);
    const remaining = createTrackedWindow("window-2", output, desktop);
    const otherFirst = createTrackedWindow("window-3", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const otherSecond = createTrackedWindow("window-4", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1500, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [
        transferred.window,
        remaining.window,
        otherFirst.window,
        otherSecond.window,
      ],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    transferred.window.frameGeometry = {
      height: 200,
      width: 300,
      x: 1300,
      y: 0,
    };
    Object.defineProperty(transferred.window, "output", {
      value: otherOutput,
    });
    transferred.outputChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(3);
    expect(transferred.window.frameGeometry.x).toBe(1300);
    expect(remaining.window.frameGeometry.x).toBe(10);
    expect(otherFirst.window.frameGeometry.x).toBe(1010);
    expect(otherSecond.window.frameGeometry.x).toBe(1505);
  });

  it("promotes a waiting overflow window when its context gains capacity", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const waiting = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, waiting.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(controller.managedCount).toBe(2);
    expect(waiting.writeCount).toBe(0);

    fixture.windowRemoved.emit(first.window);
    expect(controller.managedCount).toBe(1);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(10);
    expect(waiting.window.frameGeometry.x).toBe(505);
    expect(waiting.writeCount).toBe(1);
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
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();

    expect(controller.managedCount).toBe(0);
    expect(constrained.writeCount).toBe(0);

    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    expect(scheduler.pendingCount).toBe(0);
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

  it("cleans up a failed delayed start and can be started again", () => {
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
    const scheduler = new ManualScheduler();
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
      scheduleResume: scheduler.schedule,
      startupStabilizationProbes: 1,
    });

    controller.start();
    expect(() => {
      scheduler.flush();
    }).not.toThrow();
    expect(controller.managedCount).toBe(0);

    shouldFail = false;
    expect(controller.start()).toBe(true);
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(window.writeCount).toBe(1);
  });

  it("rolls back and retries a live admission after geometry recovers", () => {
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
    let shouldFail = false;
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
    const rejected = createTrackedWindow("window-2", output, desktop);

    controller.start();
    shouldFail = true;
    fixture.windowAdded.emit(rejected.window);
    expect(controller.managedCount).toBe(1);

    shouldFail = false;
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    expect(controller.managedCount).toBe(2);
    expect(first.window.frameGeometry.x).toBe(10);
    expect(rejected.window.frameGeometry.x).toBe(505);
    expect(rejected.writeCount).toBe(1);
  });

  it("retries a lone live admission on a desktop event", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const fixture = createWorkspace(output, desktop, [output], [desktop], []);
    let geometryAvailable = true;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        if (!geometryAvailable) {
          throw new Error("client area unavailable");
        }

        return { height: 800, width: 1000, x: 0, y: 0 };
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });
    const waiting = createTrackedWindow("window-1", output, desktop);

    controller.start();
    geometryAvailable = false;
    fixture.windowAdded.emit(waiting.window);
    expect(controller.managedCount).toBe(0);

    geometryAvailable = true;
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    expect(controller.managedCount).toBe(1);
    expect(waiting.window.frameGeometry.x).toBe(10);
    expect(waiting.writeCount).toBe(1);
  });

  it("continues other dirty contexts after a scheduled reconcile error", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const other = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, other.window],
    );
    const scheduler = new ManualScheduler();
    let failFirstOutput = false;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, candidate: KWinOutput) => {
        if (failFirstOutput && candidate.name === output.name) {
          throw new Error("primary client area unavailable");
        }

        return {
          height: 800,
          width: 1000,
          x: candidate.geometry.x,
          y: candidate.geometry.y,
        };
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    other.window.frameGeometry = {
      height: 780,
      width: 485,
      x: 1800,
      y: 10,
    };
    failFirstOutput = true;
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    fixture.currentDesktopChanged.emit(desktop, desktop, otherOutput);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.lastWriteCount).toBe(1);
    expect(other.window.frameGeometry.x).toBe(1010);

    failFirstOutput = false;
    fixture.currentDesktopChanged.emit(desktop, desktop, output);
    scheduler.flush();
    expect(controller.lastWriteCount).toBe(0);
  });

  it("quiesces pending transfers and stale callbacks when stopped", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [window.window],
    );
    const scheduler = new ManualScheduler();
    let failOtherOutput = false;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, candidate: KWinOutput) => {
        if (failOtherOutput && candidate.name === otherOutput.name) {
          throw new Error("destination client area unavailable");
        }

        return {
          height: 800,
          width: 1000,
          x: candidate.geometry.x,
          y: candidate.geometry.y,
        };
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    window.window.frameGeometry = {
      height: 200,
      width: 300,
      x: 1200,
      y: 0,
    };
    Object.defineProperty(window.window, "output", { value: otherOutput });
    window.outputChanged.emit();
    expect(scheduler.pendingCount).toBe(1);

    failOtherOutput = true;
    expect(() => {
      controller.stop();
    }).not.toThrow();
    expect(controller.managedCount).toBe(0);

    failOtherOutput = false;
    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(1);
    expect(controller.lastWriteCount).toBe(1);

    scheduler.flush();
    expect(controller.lastWriteCount).toBe(1);
  });

  it("does not let a pending state resume block work after restart", () => {
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

    controller.start();
    setWindowState("fullscreen", first, true);
    scheduler.flush();
    setWindowState("fullscreen", first, false);
    expect(scheduler.pendingCount).toBe(1);

    controller.stop();
    expect(controller.start()).toBe(true);
    const second = createTrackedWindow("window-2", output, desktop);
    fixture.windowAdded.emit(second.window);
    expect(scheduler.pendingCount).toBe(2);

    scheduler.flush();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(controller.managedCount).toBe(2);
    expect(second.window.frameGeometry.x).toBe(505);
  });

  it("restores unaffected contexts after another output topology changes", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
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
    Object.defineProperty(output, "geometry", {
      value: { height: 800, width: 1000, x: 2000, y: 0 },
    });
    controller.stop();

    expect(first.writeCount).toBe(1);
    expect(first.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
    expect(second.writeCount).toBe(2);
    expect(second.window.frameGeometry).toEqual({
      height: 200,
      width: 300,
      x: 1100,
      y: 0,
    });
  });

  it("falls back to the global current desktop on X11", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const otherDesktop = { id: "desktop-2" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, otherDesktop);
    const otherFirst = createTrackedWindow("window-3", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const otherSecond = createTrackedWindow(
      "window-4",
      otherOutput,
      otherDesktop,
      {
        frameGeometry: { height: 200, width: 300, x: 1500, y: 0 },
      },
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop, otherDesktop],
      [first.window, second.window, otherFirst.window, otherSecond.window],
      false,
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(4);
    expect(first.writeCount).toBe(1);
    expect(second.writeCount).toBe(0);
    expect(otherFirst.writeCount).toBe(1);
    expect(otherSecond.writeCount).toBe(0);

    fixture.setCurrentDesktop(output, otherDesktop);
    expect(second.window.frameGeometry.x).toBe(10);
    expect(otherSecond.window.frameGeometry.x).toBe(1010);
    expect(second.writeCount).toBe(1);
    expect(otherSecond.writeCount).toBe(1);
  });
});

function createOutput(name: string, x: number): KWinOutput {
  return {
    devicePixelRatio: 1,
    geometry: { height: 800, width: 1000, x, y: 0 },
    name,
  };
}
