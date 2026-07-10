import { describe, expect, it } from "vitest";
import { columnId, desktopId, outputId, windowId } from "../src/core/ids";
import { LayoutEngine } from "../src/core/layout-engine";
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
  readonly frameGeometryChanged: Signal<
    [oldGeometry: KWinWindow["frameGeometry"]]
  >;
  readonly fullScreenChanged: Signal<[]>;
  readonly hiddenChanged: Signal<[]>;
  readonly interactiveMoveResizeFinished: Signal<[]>;
  readonly maximizedAboutToChange: Signal<[mode: number]>;
  readonly maximizedChanged: Signal<[]>;
  readonly minimizedChanged: Signal<[]>;
  readonly moveResizedChanged: Signal<[]>;
  readonly outputChanged: Signal<[oldOutput?: KWinOutput | null]>;
  readonly requestedTileChanged: Signal<[]>;
  setFrameGeometry(frame: KWinWindow["frameGeometry"]): void;
  setWriteBehavior(
    behavior:
      ((frame: KWinWindow["frameGeometry"], commit: () => void) => void) | null,
  ): void;
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
  const frameGeometryChanged = new Signal<
    [oldGeometry: KWinWindow["frameGeometry"]]
  >();
  const fullScreenChanged = new Signal<[]>();
  const hiddenChanged = new Signal<[]>();
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
  let writeBehavior:
    ((frame: KWinWindow["frameGeometry"], commit: () => void) => void) | null =
    null;
  const window: KWinWindow = {
    deleted: false,
    desktops: [desktop],
    desktopsChanged,
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry,
    frameGeometryChanged,
    fullScreen: false,
    fullScreenChanged,
    hiddenChanged,
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
      writeCount += 1;

      if (writeBehavior) {
        writeBehavior(value, () => {
          frameGeometry = value;
        });
      } else {
        frameGeometry = value;
      }
    },
  });

  return {
    desktopsChanged,
    frameGeometryChanged,
    get writeCount() {
      return writeCount;
    },
    fullScreenChanged,
    hiddenChanged,
    interactiveMoveResizeFinished,
    maximizedAboutToChange,
    maximizedChanged,
    minimizedChanged,
    moveResizedChanged,
    outputChanged,
    requestedTileChanged,
    setFrameGeometry: (frame) => {
      frameGeometry = frame;
    },
    setWriteBehavior: (behavior) => {
      writeBehavior = behavior;
    },
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
  readonly screensChanged: Signal<[]>;
  setCurrentDesktop(output: KWinOutput, desktop: KWinVirtualDesktop): void;
  setScreens(outputs: readonly KWinOutput[]): void;
  readonly virtualScreenGeometryChanged: Signal<[]>;
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
  const screensChanged = new Signal<[]>();
  const virtualScreenGeometryChanged = new Signal<[]>();
  const windowActivated = new Signal<[window: KWinWindow | null]>();
  const windowAdded = new Signal<[window: KWinWindow]>();
  const windowRemoved = new Signal<[window: KWinWindow]>();
  let activationCount = 0;
  let activeWindow = windows[windows.length - 1] ?? null;
  let currentDesktop = activeDesktop;
  let currentOutputs = [...outputs];
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
    screens: currentOutputs,
    screensChanged,
    stackingOrder: windows,
    windowActivated,
    windowAdded,
    windowRemoved,
    virtualScreenGeometryChanged,
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
  Object.defineProperty(workspace, "screens", {
    configurable: true,
    enumerable: true,
    get: () => currentOutputs,
  });

  return {
    get activationCount() {
      return activationCount;
    },
    currentDesktopChanged,
    screensChanged,
    setCurrentDesktop: (output, desktop) => {
      const previous = perOutputDesktops
        ? (currentDesktops.get(output.name) ?? null)
        : currentDesktop;

      if (perOutputDesktops) {
        currentDesktops.set(output.name, desktop);
      } else {
        currentDesktop = desktop;

        for (const candidate of currentOutputs) {
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
    setScreens: (nextOutputs) => {
      currentOutputs = [...nextOutputs];

      for (const output of currentOutputs) {
        if (!currentDesktops.has(output.name)) {
          currentDesktops.set(output.name, currentDesktop);
        }
      }
    },
    virtualScreenGeometryChanged,
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

  it("merges and extracts the active window in both directions within its context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const other = createTrackedWindow("window-4", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 0 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, active.window, third.window, other.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;
    const activationCount = fixture.activationCount;
    const otherSnapshot = runtimeLayout(controller).snapshot(
      outputId(otherOutput.name),
      desktopId(desktop.id),
    );
    const otherFrame = { ...other.window.frameGeometry };
    const otherWrites = other.writeCount;

    expect(controller.moveWindowLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1", "window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(active.window.frameGeometry).toMatchObject({
      height: 385,
      width: 300,
      x: 10,
      y: 405,
    });

    expect(controller.moveWindowRight()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);

    expect(controller.moveWindowRight()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-3", windowIds: ["window-3", "window-2"] },
    ]);
    expect(controller.moveWindowLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);

    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(otherOutput.name),
        desktopId(desktop.id),
      ),
    ).toEqual(otherSnapshot);
    expect(other.window.frameGeometry).toEqual(otherFrame);
    expect(other.writeCount).toBe(otherWrites);
  });

  it("inserts a singleton into the nearest stack on the left", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const skipped = createTrackedWindow("window-3", output, desktop);
    const active = createTrackedWindow("window-4", output, desktop);
    const unrelated = createTrackedWindow("window-5", otherOutput, desktop, {
      frameGeometry: { height: 230, width: 270, x: 1120, y: 40 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [
        first.window,
        second.window,
        skipped.window,
        active.window,
        unrelated.window,
      ],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 190 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:target",
        width: { kind: "fixed", value: 280 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:skipped",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-3"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 260 },
        windowIds: ["window-4"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    const activationCount = fixture.activationCount;
    const unrelatedSnapshot = runtimeLayout(controller).snapshot(
      outputId(otherOutput.name),
      desktopId(desktop.id),
    );
    const unrelatedFrame = { ...unrelated.window.frameGeometry };
    const unrelatedWrites = unrelated.writeCount;

    expect(controller.insertWindowIntoStackLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:target",
        windowIds: ["window-1", "window-2", "window-4"],
      },
      { id: "column:skipped", windowIds: ["window-3"] },
    ]);
    const snapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(snapshot.activeColumnId).toBe(columnId("column:target"));
    expect(snapshot.columns[0]?.width).toEqual({ kind: "fixed", value: 280 });
    expect(snapshot.columns[1]?.width).toEqual({ kind: "fixed", value: 190 });
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(otherOutput.name),
        desktopId(desktop.id),
      ),
    ).toEqual(unrelatedSnapshot);
    expect(unrelated.window.frameGeometry).toEqual(unrelatedFrame);
    expect(unrelated.writeCount).toBe(unrelatedWrites);
  });

  it("inserts a stack member into the nearest stack on the right", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 5 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 150 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:source",
        width: { kind: "fixed", value: 240 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:skipped",
        width: { kind: "fixed", value: 160 },
        windowIds: ["window-3"],
      },
      {
        id: "column:target",
        width: { kind: "fixed", value: 360 },
        windowIds: ["window-4", "window-5"],
      },
    ]);
    const active = windows[1];
    fixture.workspace.activeWindow = active?.window ?? null;
    const activationCount = fixture.activationCount;

    expect(controller.insertWindowIntoStackRight()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:source", windowIds: ["window-1"] },
      { id: "column:skipped", windowIds: ["window-3"] },
      {
        id: "column:target",
        windowIds: ["window-4", "window-5", "window-2"],
      },
    ]);
    const snapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(snapshot.activeColumnId).toBe(columnId("column:target"));
    expect(snapshot.columns.map((column) => column.width)).toEqual([
      { kind: "fixed", value: 240 },
      { kind: "fixed", value: 160 },
      { kind: "fixed", value: 360 },
    ]);
    expect(fixture.workspace.activeWindow).toBe(active?.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("does not wrap or insert when a direction has no eligible stack", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 250 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:source",
        width: { kind: "fixed", value: 250 },
        windowIds: ["window-1"],
      },
      {
        id: "column:target",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-2", "window-3"],
      },
    ]);
    fixture.workspace.activeWindow = windows[0]?.window ?? null;
    const beforeBoundary = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const boundaryFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeBoundary);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      boundaryFrames,
    );

    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:left",
        width: { kind: "fixed", value: 250 },
        windowIds: ["window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 250 },
        windowIds: ["window-1"],
      },
      {
        id: "column:right",
        width: { kind: "fixed", value: 250 },
        windowIds: ["window-3"],
      },
    ]);
    const beforeNoTarget = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    expect(controller.insertWindowIntoStackRight()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeNoTarget);
    expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
  });

  it("rejects a stack whose members no longer belong to the live context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const stale = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, stale.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:target",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    Object.defineProperty(stale.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const writes = [first, stale, active].map((window) => window.writeCount);

    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect([first, stale, active].map((window) => window.writeCount)).toEqual(
      writes,
    );
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("checks constraints for suspended members of the destination stack", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const destination = createTrackedWindow("window-1", output, desktop);
    const suspended = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [destination.window, suspended.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 360 },
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:destination",
        width: { kind: "fixed", value: 360 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 500 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    setWindowState("fullscreen", suspended, true);
    scheduler.flush();
    const suspendedFrame = { ...suspended.window.frameGeometry };
    const suspendedWrites = suspended.writeCount;
    const constraints = suspended.window as unknown as {
      maxSize: KWinWindow["maxSize"];
      minSize: KWinWindow["minSize"];
    };

    constraints.maxSize = { height: 10_000, width: 350 };
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    constraints.maxSize = { height: 10_000, width: 380 };
    constraints.minSize = { height: 300, width: 1 };
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    constraints.minSize = { height: 200, width: 1 };
    expect(controller.insertWindowIntoStackLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:destination",
        windowIds: ["window-1", "window-2", "window-3"],
      },
    ]);
    expect(active.window.frameGeometry).toMatchObject({ width: 360, x: 10 });
    expect(suspended.window.frameGeometry).toEqual(suspendedFrame);
    expect(suspended.writeCount).toBe(suspendedWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("gates direct stack insertion during topology, toggle, and capacity transitions", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:target",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    const key = `${output.name}\u0000${desktop.id}`;
    const state = controller as unknown as {
      capacityCanceledParks: Map<string, unknown>;
      capacityLeasesByContext: Map<string, Set<unknown>>;
      toggleGeometryTransitions: Map<
        string,
        {
          contextKey: string;
          expectedFrame: KWinWindow["frameGeometry"];
          settlementArmed: boolean;
        }
      >;
      topologyStabilizing: boolean;
    };
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    state.topologyStabilizing = true;
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    state.topologyStabilizing = false;

    state.toggleGeometryTransitions.set("window-3", {
      contextKey: key,
      expectedFrame: { ...active.window.frameGeometry, x: -100 },
      settlementArmed: false,
    });
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    state.toggleGeometryTransitions.clear();

    state.capacityCanceledParks.set(key, {});
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    state.capacityCanceledParks.clear();

    state.capacityLeasesByContext.set(key, new Set([{}]));
    expect(controller.insertWindowIntoStackLeft()).toBe(false);
    state.capacityLeasesByContext.clear();

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(controller.insertWindowIntoStackLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("rolls back direct stack insertion after asynchronous partial writes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const warning = console.warn;

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:target",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = windows[2]?.window ?? null;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[0]?.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });
    });
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.insertWindowIntoStackLeft()).toBe(false);
    } finally {
      console.warn = warning;
      windows[0]?.setWriteBehavior(null);
      windows[1]?.setWriteBehavior(null);
    }

    expect(queuedWrites).toHaveLength(2);
    expect(queuedWrites[0]?.frame).not.toEqual(frames[0]);
    expect(queuedWrites[1]?.frame).toEqual(frames[0]);

    for (const write of queuedWrites) {
      write.commit();
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(controller.insertWindowIntoStackLeft()).toBe(true);
  });

  it("retries waiting admission only when insertion removes a source column", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 5 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 190 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.managedCount).toBe(4);
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:source",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:target",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-3", "window-4"],
      },
    ]);
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    expect(controller.insertWindowIntoStackRight()).toBe(true);
    expect(scheduler.pendingCount).toBe(0);
    expect(controller.managedCount).toBe(4);

    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:target",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-3", "window-4"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-1"],
      },
      {
        id: "column:resident",
        width: { kind: "fixed", value: 190 },
        windowIds: ["window-2"],
      },
    ]);
    fixture.workspace.activeWindow = windows[0]?.window ?? null;

    expect(controller.insertWindowIntoStackLeft()).toBe(true);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.managedCount).toBe(5);
    expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
  });

  it("focuses and reorders members of the active column vertically", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const other = createTrackedWindow("window-4", output, desktop);
    const windows = [first, active, third, other];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2", "window-3"],
      },
      {
        id: "column:other",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-4"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    const writesBeforeFocus = windows.map((window) => window.writeCount);

    expect(controller.focusUp()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(first.window);
    expect(controller.focusUp()).toBe(false);
    expect(controller.focusDown()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(controller.focusDown()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(third.window);
    expect(controller.focusDown()).toBe(false);
    expect(controller.focusUp()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(windows.map((window) => window.writeCount)).toEqual(
      writesBeforeFocus,
    );

    const activationCount = fixture.activationCount;
    const otherWrites = other.writeCount;
    expect(controller.moveWindowUp()).toBe(true);
    expect(
      testLayoutColumns(controller, output, desktop)[0]?.windowIds,
    ).toEqual(["window-2", "window-1", "window-3"]);
    expect(active.window.frameGeometry.y).toBe(10);
    expect(controller.moveWindowUp()).toBe(false);
    expect(controller.moveWindowDown()).toBe(true);
    expect(controller.moveWindowDown()).toBe(true);
    expect(
      testLayoutColumns(controller, output, desktop)[0]?.windowIds,
    ).toEqual(["window-1", "window-3", "window-2"]);
    expect(active.window.frameGeometry.y).toBe(537);
    expect(controller.moveWindowDown()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
    expect(other.writeCount).toBe(otherWrites);
  });

  it("checks suspended destination constraints and applies a merge on resume", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const destination = createTrackedWindow("window-1", output, desktop);
    const suspended = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [destination.window, suspended.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 360 },
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:source", [
      {
        id: "column:destination",
        width: { kind: "fixed", value: 360 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 500 },
        windowIds: ["window-3"],
      },
    ]);
    setWindowState("fullscreen", suspended, true);
    scheduler.flush();
    const suspendedFrame = { ...suspended.window.frameGeometry };
    const suspendedWrites = suspended.writeCount;
    const constraints = suspended.window as unknown as {
      maxSize: KWinWindow["maxSize"];
      minSize: KWinWindow["minSize"];
    };

    constraints.maxSize = { height: 10_000, width: 350 };
    expect(controller.moveWindowLeft()).toBe(false);
    constraints.maxSize = { height: 10_000, width: 380 };
    constraints.minSize = { height: 300, width: 1 };
    expect(controller.moveWindowLeft()).toBe(false);
    constraints.minSize = { height: 200, width: 1 };
    expect(controller.moveWindowLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:destination",
        windowIds: ["window-1", "window-2", "window-3"],
      },
    ]);
    expect(active.window.frameGeometry).toMatchObject({ width: 360, x: 10 });
    expect(suspended.window.frameGeometry).toEqual(suspendedFrame);
    expect(suspended.writeCount).toBe(suspendedWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    setWindowState("fullscreen", suspended, false);

    for (
      let attempt = 0;
      attempt < 12 && scheduler.pendingCount > 0;
      attempt += 1
    ) {
      scheduler.flush();
    }

    expect(suspended.window.frameGeometry).toMatchObject({
      height: 254,
      width: 360,
      x: 10,
      y: 273,
    });
    expect(suspended.window.frameGeometry).not.toEqual(suspendedFrame);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it.each([
    { expected: true, name: "single-output", outputCount: 1 },
    { expected: false, name: "multi-output", outputCount: 2 },
  ])(
    "handles extract overflow in a $name context",
    ({ expected, outputCount }) => {
      const output = createOutput("DP-1", 0);
      const otherOutput = createOutput("HDMI-A-1", 1000);
      const desktop = { id: "desktop-1" };
      const first = createTrackedWindow("window-1", output, desktop);
      const active = createTrackedWindow("window-2", output, desktop);
      const third = createTrackedWindow("window-3", output, desktop);
      const fixture = createWorkspace(
        output,
        desktop,
        outputCount === 1 ? [output] : [output, otherOutput],
        [desktop],
        [first.window, active.window, third.window],
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 300 },
        gap: 10,
      });

      controller.start();
      installTestLayout(controller, output, desktop, "column:stack", [
        {
          id: "column:stack",
          width: { kind: "proportion", value: 0.5 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column:other",
          width: { kind: "proportion", value: 0.5 },
          windowIds: ["window-3"],
        },
      ]);
      fixture.workspace.activeWindow = active.window;
      const before = runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = [first, active, third].map((window) => ({
        ...window.window.frameGeometry,
      }));
      const activationCount = fixture.activationCount;

      expect(controller.moveWindowRight()).toBe(expected);
      expect(fixture.workspace.activeWindow).toBe(active.window);
      expect(fixture.activationCount).toBe(activationCount);

      if (expected) {
        expect(testLayoutColumns(controller, output, desktop)).toEqual([
          { id: "column:stack", windowIds: ["window-1"] },
          { id: "column:window-2", windowIds: ["window-2"] },
          { id: "column:other", windowIds: ["window-3"] },
        ]);
      } else {
        expect(
          runtimeLayout(controller).snapshot(
            outputId(output.name),
            desktopId(desktop.id),
          ),
        ).toEqual(before);
        expect(
          [first, active, third].map((window) => window.window.frameGeometry),
        ).toEqual(frames);
      }
    },
  );

  it("rolls back a structural stack edit after asynchronous partial writes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const warning = console.warn;

    controller.start();
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[0]?.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });
    });
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.moveWindowLeft()).toBe(false);
    } finally {
      console.warn = warning;
      windows[0]?.setWriteBehavior(null);
      windows[1]?.setWriteBehavior(null);
    }

    expect(queuedWrites).toHaveLength(2);
    expect(queuedWrites[0]?.frame).not.toEqual(frames[0]);
    expect(queuedWrites[1]?.frame).toEqual(frames[0]);

    for (const write of queuedWrites) {
      write.commit();
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(controller.moveWindowLeft()).toBe(true);
  });

  it("stops stale stack writes when a setter starts a topology barrier", () => {
    const output = createOutput("DP-1", 0);
    const addedOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = windows.map((window) => window.writeCount);
    let triggered = false;
    windows[0]?.setWriteBehavior((frame, commit) => {
      commit();

      if (!triggered) {
        triggered = true;
        fixture.setScreens([output, addedOutput]);
        fixture.screensChanged.emit();
      }
    });

    expect(controller.moveWindowLeft()).toBe(false);
    expect(triggered).toBe(true);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows[0]?.window.frameGeometry).not.toEqual(frames[0]);
    expect(windows[1]?.window.frameGeometry).toEqual(frames[1]);
    expect(windows[2]?.window.frameGeometry).toEqual(frames[2]);
    expect(windows.map((window) => window.writeCount)).toEqual([
      (writes[0] ?? 0) + 1,
      writes[1],
      writes[2],
    ]);
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(1);

    windows[0]?.setWriteBehavior(null);
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
  });

  it("gates stack edits during capacity parking and preserves stable leases", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const second = setup.windows[1];
    const parked = setup.windows[2];
    const parkingWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];

    setup.controller.start();
    installTestLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
      "column:group",
      [
        {
          id: "column:group",
          width: { kind: "fixed", value: 700 },
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column:parked",
          width: { kind: "fixed", value: 300 },
          windowIds: ["window-3"],
        },
      ],
    );
    setup.fixture.workspace.activeWindow = first?.window ?? null;
    parked?.setWriteBehavior((frame, commit) => {
      parkingWrites.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(parkingWrites).toHaveLength(1);
    const inFlight = runtimeLayout(setup.controller).snapshot(
      outputId(setup.output.output.name),
      desktopId(setup.desktop.id),
    );
    expect(setup.controller.moveWindowDown()).toBe(false);
    expect(setup.controller.moveWindowRight()).toBe(false);
    expect(
      runtimeLayout(setup.controller).snapshot(
        outputId(setup.output.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(inFlight);

    parkingWrites[0]?.commit();
    parked?.setWriteBehavior(null);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(2);
    expect(setup.controller.moveWindowRight()).toBe(false);
    expect(setup.controller.moveWindowDown()).toBe(true);
    expect(
      testLayoutColumns(setup.controller, setup.output.output, setup.desktop)[0]
        ?.windowIds,
    ).toEqual(["window-2", "window-1"]);
    expect(setup.fixture.workspace.activeWindow).toBe(first?.window);
    expect(second?.window.frameGeometry.x).toBe(first?.window.frameGeometry.x);
  });

  it("gates stack edits while a canceled capacity park is unresolved", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
    ]);
    const canceledParks = (
      controller as unknown as {
        capacityCanceledParks: Map<string, unknown>;
      }
    ).capacityCanceledParks;
    canceledParks.set(`${output.name}\u0000${desktop.id}`, {});
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.moveWindowUp()).toBe(false);
    expect(controller.moveWindowLeft()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);

    canceledParks.clear();
    expect(controller.moveWindowUp()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("retries an ordinary waiting window after a merge frees capacity", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 400 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(controller.managedCount).toBe(2);
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.moveWindowLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1", "window-2"] },
    ]);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.managedCount).toBe(3);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1", "window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(fixture.activationCount).toBe(1);
  });

  it("floats a singleton to its exact baseline and retiles it at its anchor", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 310, width: 280, x: 40, y: 50 },
    });
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 320, width: 290, x: 90, y: 60 },
    });
    const third = createTrackedWindow("window-3", output, desktop, {
      frameGeometry: { height: 330, width: 300, x: 140, y: 70 },
    });
    const unrelated = createTrackedWindow("window-4", otherOutput, desktop, {
      frameGeometry: { height: 340, width: 310, x: 1140, y: 80 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, active.window, third.window, unrelated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;
    const baseline = { height: 320, width: 290, x: 90, y: 60 };
    const tiledFrame = { ...active.window.frameGeometry };
    const activationCount = fixture.activationCount;
    const unrelatedSnapshot = runtimeLayout(controller).snapshot(
      outputId(otherOutput.name),
      desktopId(desktop.id),
    );
    const unrelatedFrame = { ...unrelated.window.frameGeometry };
    const unrelatedWrites = unrelated.writeCount;

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(3);
    expect(active.window.frameGeometry).toEqual(baseline);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(4);
    expect(active.window.frameGeometry).toEqual(tiledFrame);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(otherOutput.name),
        desktopId(desktop.id),
      ),
    ).toEqual(unrelatedSnapshot);
    expect(unrelated.window.frameGeometry).toEqual(unrelatedFrame);
    expect(unrelated.writeCount).toBe(unrelatedWrites);
  });

  it("round-trips a stacked middle member into the current column width", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const other = createTrackedWindow("window-4", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window, third.window, other.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2", "window-3"],
      },
      {
        id: "column:other",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-4"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;

    expect(controller.toggleFloating()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:stack",
        windowIds: ["window-1", "window-3"],
      },
      { id: "column:other", windowIds: ["window-4"] },
    ]);

    fixture.workspace.activeWindow = first.window;
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 364,
    });
    fixture.workspace.activeWindow = active.window;

    expect(controller.toggleFloating()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:stack",
        windowIds: ["window-1", "window-2", "window-3"],
      },
      { id: "column:other", windowIds: ["window-4"] },
    ]);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 364,
    });
    expect(active.window.frameGeometry).toMatchObject({
      height: 254,
      width: 364,
      x: 10,
      y: 273,
    });
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("keeps external floating geometry and uses it as the next baseline", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 280, width: 360, x: 80, y: 90 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.focusLeft()).toBe(false);
    const externalFrame = { height: 410, width: 470, x: 210, y: 170 };
    active.setFrameGeometry(externalFrame);
    (
      controller as unknown as {
        pendingWindowSyncs: Set<string>;
      }
    ).pendingWindowSyncs.add("window-2");
    controller.reconcile();
    const writesAfterExternalMove = active.writeCount;

    expect(active.window.frameGeometry).toEqual(externalFrame);
    expect(active.writeCount).toBe(writesAfterExternalMove);
    expect(controller.floatingCount).toBe(1);

    expect(controller.toggleFloating()).toBe(true);
    expect(active.window.frameGeometry).not.toEqual(externalFrame);
    expect(controller.toggleFloating()).toBe(true);
    expect(active.window.frameGeometry).toEqual(externalFrame);
    expect(controller.floatingCount).toBe(1);
  });

  it.each(["null", "stale"] as const)(
    "does not write a %s restore baseline while floating out",
    (baselineKind) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const first = createTrackedWindow("window-1", output, desktop);
      const active = createTrackedWindow("window-2", output, desktop);
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [first.window, active.window],
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 300 },
        gap: 10,
      });

      controller.start();
      fixture.workspace.activeWindow = active.window;
      const managedWindows = (
        controller as unknown as {
          managedWindows: Map<
            string,
            {
              restoreBaseline: {
                fingerprint: string;
                frame: KWinWindow["frameGeometry"];
              } | null;
            }
          >;
        }
      ).managedWindows;
      const owner = managedWindows.get("window-2");

      if (!owner) {
        throw new Error("active window owner is missing");
      }

      owner.restoreBaseline =
        baselineKind === "null"
          ? null
          : {
              fingerprint: "stale-context",
              frame: { height: 1, width: 1, x: 1, y: 1 },
            };
      const frame = { ...active.window.frameGeometry };
      const writes = active.writeCount;

      expect(controller.toggleFloating()).toBe(true);
      expect(active.window.frameGeometry).toEqual(frame);
      expect(active.writeCount).toBe(writes);
      expect(controller.floatingCount).toBe(1);
      expect(controller.managedCount).toBe(1);
      expect(testLayoutColumns(controller, output, desktop)).toEqual([
        { id: "column:window-1", windowIds: ["window-1"] },
      ]);
    },
  );

  it("keeps a floating override through sync, transfer, and suspension", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const otherDesktop = { id: "desktop-2" };
    const remaining = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 280, width: 360, x: 80, y: 90 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop, otherDesktop],
      [remaining.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.toggleFloating()).toBe(true);
    const externalFrame = { height: 360, width: 440, x: 1210, y: 120 };
    const priorFrame = { ...active.window.frameGeometry };
    active.setFrameGeometry(externalFrame);
    active.frameGeometryChanged.emit(priorFrame);
    setWindowState("fullscreen", active, true);
    setWindowState("minimized", active, true);
    Object.defineProperties(active.window, {
      desktops: { configurable: true, value: [otherDesktop] },
      output: { configurable: true, value: otherOutput },
    });
    active.outputChanged.emit(output);
    active.desktopsChanged.emit();

    for (
      let attempt = 0;
      attempt < 12 && scheduler.pendingCount > 0;
      attempt += 1
    ) {
      scheduler.flush();
    }

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(active.window.frameGeometry).toEqual(externalFrame);
    expect(testLayoutColumns(controller, otherOutput, otherDesktop)).toEqual(
      [],
    );

    setWindowState("fullscreen", active, false);
    setWindowState("minimized", active, false);

    for (
      let attempt = 0;
      attempt < 24 && scheduler.pendingCount > 0;
      attempt += 1
    ) {
      scheduler.flush();
    }

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(active.window.frameGeometry).toEqual(externalFrame);
    expect(testLayoutColumns(controller, otherOutput, otherDesktop)).toEqual(
      [],
    );
  });

  it("clears a closed floating override and never moves a floating window on stop", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 260, width: 340, x: 70, y: 80 },
    });
    const second = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 280, width: 360, x: 100, y: 110 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = second.window;
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    fixture.windowRemoved.emit(second.window);
    expect(controller.floatingCount).toBe(0);

    fixture.workspace.activeWindow = first.window;
    expect(controller.toggleFloating()).toBe(true);
    const floatingFrame = { ...first.window.frameGeometry };
    const floatingWrites = first.writeCount;

    controller.stop();
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(0);
    expect(first.window.frameGeometry).toEqual(floatingFrame);
    expect(first.writeCount).toBe(floatingWrites);
  });

  it.each([
    { expected: true, name: "single-output", outputCount: 1 },
    { expected: false, name: "multi-output", outputCount: 2 },
  ])(
    "$name overflow handling is atomic while retiling a floating window",
    ({ expected, outputCount }) => {
      const output = createOutput("DP-1", 0);
      const otherOutput = createOutput("HDMI-A-1", 1000);
      const desktop = { id: "desktop-1" };
      const first = createTrackedWindow("window-1", output, desktop);
      const active = createTrackedWindow("window-2", output, desktop, {
        frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
      });
      const third = createTrackedWindow("window-3", output, desktop);
      const windows = [first, active, third];
      const fixture = createWorkspace(
        output,
        desktop,
        outputCount === 1 ? [output] : [output, otherOutput],
        [desktop],
        windows.map((window) => window.window),
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 300 },
        gap: 10,
      });

      controller.start();
      installTestLayout(controller, output, desktop, "column:active", [
        {
          id: "column:first",
          width: { kind: "fixed", value: 400 },
          windowIds: ["window-1"],
        },
        {
          id: "column:active",
          width: { kind: "fixed", value: 300 },
          windowIds: ["window-2"],
        },
        {
          id: "column:third",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-3"],
        },
      ]);
      fixture.workspace.activeWindow = active.window;
      expect(controller.toggleFloating()).toBe(true);

      const layout = runtimeLayout(controller);
      expect(layout.activateWindow(windowId("window-1"))).toBe(true);
      expect(
        layout.setActiveColumnWidth(windowId("window-1"), {
          kind: "fixed",
          value: 700,
        }),
      ).toEqual({ kind: "fixed", value: 400 });
      controller.reconcile();
      fixture.workspace.activeWindow = active.window;
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map((window) => ({
        ...window.window.frameGeometry,
      }));
      const writes = windows.map((window) => window.writeCount);
      const activationCount = fixture.activationCount;

      expect(controller.toggleFloating()).toBe(expected);
      expect(fixture.workspace.activeWindow).toBe(active.window);
      expect(fixture.activationCount).toBe(activationCount);

      if (expected) {
        expect(controller.floatingCount).toBe(0);
        expect(testLayoutColumns(controller, output, desktop)).toEqual([
          { id: "column:first", windowIds: ["window-1"] },
          { id: "column:active", windowIds: ["window-2"] },
          { id: "column:third", windowIds: ["window-3"] },
        ]);
        expect(
          layout.snapshot(outputId(output.name), desktopId(desktop.id))
            .viewportOffset,
        ).toBeGreaterThan(0);
        expect(active.window.frameGeometry.x).toBeGreaterThanOrEqual(10);
        expect(active.window.frameGeometry.x).toBeLessThan(1000);
      } else {
        expect(controller.floatingCount).toBe(1);
        expect(
          layout.snapshot(outputId(output.name), desktopId(desktop.id)),
        ).toEqual(before);
        expect(windows.map((window) => window.window.frameGeometry)).toEqual(
          frames,
        );
        expect(windows.map((window) => window.writeCount)).toEqual(writes);
      }
    },
  );

  it("retries a waiting admission after a singleton floats out", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 400 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(controller.managedCount).toBe(2);
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
  });

  it.each([
    {
      block: (controller: RuntimeController, key: string) => {
        (
          controller as unknown as {
            capacityParkOperations: Map<string, unknown>;
          }
        ).capacityParkOperations.set(key, {});
      },
      clear: (controller: RuntimeController) => {
        (
          controller as unknown as {
            capacityParkOperations: Map<string, unknown>;
          }
        ).capacityParkOperations.clear();
      },
      name: "in-flight park",
    },
    {
      block: (controller: RuntimeController, key: string) => {
        (
          controller as unknown as {
            capacityCanceledParks: Map<string, unknown>;
          }
        ).capacityCanceledParks.set(key, {});
      },
      clear: (controller: RuntimeController) => {
        (
          controller as unknown as {
            capacityCanceledParks: Map<string, unknown>;
          }
        ).capacityCanceledParks.clear();
      },
      name: "canceled park",
    },
    {
      block: (controller: RuntimeController, key: string) => {
        (
          controller as unknown as {
            capacityLeasesByContext: Map<string, Set<unknown>>;
          }
        ).capacityLeasesByContext.set(key, new Set([{}]));
      },
      clear: (controller: RuntimeController) => {
        (
          controller as unknown as {
            capacityLeasesByContext: Map<string, Set<unknown>>;
          }
        ).capacityLeasesByContext.clear();
      },
      name: "stable capacity lease",
    },
  ])("blocks floating toggles during a $name", ({ block, clear }) => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;
    const key = `${output.name}\u0000${desktop.id}`;
    block(controller, key);
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = [first, active].map((window) => ({
      ...window.window.frameGeometry,
    }));

    expect(controller.toggleFloating()).toBe(false);
    expect(controller.floatingCount).toBe(0);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(
      [first, active].map((window) => window.window.frameGeometry),
    ).toEqual(frames);

    clear(controller);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.focusLeft()).toBe(false);
    block(controller, key);
    const floatingLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const floatingFrame = { ...active.window.frameGeometry };

    expect(controller.toggleFloating()).toBe(false);
    expect(controller.floatingCount).toBe(1);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(floatingLayout);
    expect(active.window.frameGeometry).toEqual(floatingFrame);

    clear(controller);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(0);
  });

  it("checks suspended sibling constraints before retiling", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const sibling = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const other = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [sibling.window, active.window, other.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 360 },
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 360 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:other",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    expect(controller.toggleFloating()).toBe(true);
    setWindowState("fullscreen", sibling, true);
    scheduler.flush();
    const siblingFrame = { ...sibling.window.frameGeometry };
    const siblingWrites = sibling.writeCount;
    const constraints = sibling.window as unknown as {
      maxSize: KWinWindow["maxSize"];
    };

    constraints.maxSize = { height: 10_000, width: 350 };
    expect(controller.toggleFloating()).toBe(false);
    expect(controller.floatingCount).toBe(1);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:stack", windowIds: ["window-1"] },
      { id: "column:other", windowIds: ["window-3"] },
    ]);

    constraints.maxSize = { height: 10_000, width: 380 };
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(0);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:stack",
        windowIds: ["window-1", "window-2"],
      },
      { id: "column:other", windowIds: ["window-3"] },
    ]);
    expect(sibling.window.frameGeometry).toEqual(siblingFrame);
    expect(sibling.writeCount).toBe(siblingWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("rolls back a floating toggle after an asynchronous partial write", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop, {
        frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
      }),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const warning = console.warn;

    controller.start();
    fixture.workspace.activeWindow = windows[1]?.window ?? null;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[2]?.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });
    });
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.toggleFloating()).toBe(false);
    } finally {
      console.warn = warning;
      windows[1]?.setWriteBehavior(null);
      windows[2]?.setWriteBehavior(null);
    }

    expect(queuedWrites).toHaveLength(2);
    expect(queuedWrites[0]?.frame).not.toEqual(frames[2]);
    expect(queuedWrites[1]?.frame).toEqual(frames[2]);

    for (const write of queuedWrites) {
      write.commit();
    }

    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(3);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(controller.toggleFloating()).toBe(true);
  });

  it("keeps an asynchronous floating rollback blocked until its probe", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
    });
    const sibling = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window, sibling.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });
    const siblingWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const warning = console.warn;

    controller.start();
    fixture.workspace.activeWindow = active.window;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = [first, active, sibling].map((window) => ({
      ...window.window.frameGeometry,
    }));
    sibling.setWriteBehavior((frame, commit) => {
      siblingWrites.push({ commit, frame });
    });
    let rejectNextWrite = true;
    active.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.toggleFloating()).toBe(false);
    } finally {
      console.warn = warning;
      active.setWriteBehavior(null);
    }

    expect(siblingWrites).toHaveLength(2);
    expect(siblingWrites[0]?.frame).not.toEqual(frames[2]);
    expect(siblingWrites[1]?.frame).toEqual(frames[2]);
    expect(sibling.window.frameGeometry).toEqual(frames[2]);
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(3);
    expect(resumeScheduler.pendingCount).toBe(1);

    expect(controller.toggleFloating()).toBe(false);
    expect(controller.reconcile()).toBe(0);
    expect(siblingWrites).toHaveLength(2);

    siblingWrites[0]?.commit();
    expect(sibling.window.frameGeometry).toEqual(siblingWrites[0]?.frame);
    expect(controller.toggleFloating()).toBe(false);
    expect(controller.reconcile()).toBe(0);
    expect(siblingWrites).toHaveLength(2);

    resumeScheduler.flush();

    expect(resumeScheduler.pendingCount).toBe(1);
    expect(controller.toggleFloating()).toBe(false);
    expect(controller.reconcile()).toBe(0);
    expect(siblingWrites).toHaveLength(2);

    siblingWrites[1]?.commit();
    sibling.setWriteBehavior(null);
    expect(sibling.window.frameGeometry).toEqual(frames[2]);
    expect(siblingWrites).toHaveLength(2);

    resumeScheduler.flush();

    expect(resumeScheduler.pendingCount).toBe(0);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).not.toEqual(before);
  });

  it("recovers the tiled layout when topology changes during a floating write", () => {
    const output = createOutput("DP-1", 0);
    const addedOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop, {
        frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
      }),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = windows[1]?.window ?? null;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = windows.map((window) => window.writeCount);
    let triggered = false;
    windows[2]?.setWriteBehavior((_frame, commit) => {
      commit();

      if (!triggered) {
        triggered = true;
        fixture.setScreens([output, addedOutput]);
        fixture.screensChanged.emit();
      }
    });

    expect(controller.toggleFloating()).toBe(false);
    expect(triggered).toBe(true);
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(3);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows[0]?.window.frameGeometry).toEqual(frames[0]);
    expect(windows[1]?.window.frameGeometry).toEqual(frames[1]);
    expect(windows[2]?.window.frameGeometry).not.toEqual(frames[2]);
    expect(windows.map((window) => window.writeCount)).toEqual([
      writes[0],
      writes[1],
      (writes[2] ?? 0) + 1,
    ]);
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(1);

    windows[2]?.setWriteBehavior(null);
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(controller.floatingCount).toBe(0);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
  });

  it("keeps tile-in floating when its committed write starts a topology barrier", () => {
    const output = createOutput("DP-1", 0);
    const addedOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
    });
    const other = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window, other.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:other",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    expect(controller.toggleFloating()).toBe(true);
    const floatingLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const floatingFrame = { ...active.window.frameGeometry };
    const siblingFrames = [first, other].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    let triggered = false;
    active.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });

      if (!triggered) {
        triggered = true;
        commit();
        fixture.setScreens([output, addedOutput]);
        fixture.screensChanged.emit();
      }
    });

    expect(controller.toggleFloating()).toBe(false);
    expect(triggered).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(floatingLayout);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:stack", windowIds: ["window-1"] },
      { id: "column:other", windowIds: ["window-3"] },
    ]);
    expect(queuedWrites).toHaveLength(2);
    expect(queuedWrites[0]?.frame).not.toEqual(floatingFrame);
    expect(queuedWrites[1]?.frame).toEqual(floatingFrame);
    expect(active.window.frameGeometry).toEqual(queuedWrites[0]?.frame);
    expect(first.window.frameGeometry).not.toEqual(siblingFrames[0]);
    expect(other.window.frameGeometry).toEqual(siblingFrames[1]);

    queuedWrites[1]?.commit();
    active.setWriteBehavior(null);
    expect(active.window.frameGeometry).toEqual(floatingFrame);

    while (resumeScheduler.pendingCount > 0) {
      resumeScheduler.flush();
    }

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:stack", windowIds: ["window-1"] },
      { id: "column:other", windowIds: ["window-3"] },
    ]);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect([first, other].map((window) => window.window.frameGeometry)).toEqual(
      siblingFrames,
    );
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("cancels a stale float transition when its output topology changes", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    let workAreaX = 0;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({
        height: 800,
        width: 900,
        x: workAreaX,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });
    const delayedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];

    controller.start();
    fixture.workspace.activeWindow = active.window;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    active.setWriteBehavior((frame, commit) => {
      delayedWrites.push({ commit, frame });
    });
    expect(controller.toggleFloating()).toBe(true);
    expect(delayedWrites).toHaveLength(1);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);

    workAreaX = 100;
    trackedOutput.geometryChanged.emit();
    active.setWriteBehavior(null);
    let resumeCount = 0;

    while (resumeScheduler.pendingCount > 0 && resumeCount < 20) {
      resumeScheduler.flush();
      resumeCount += 1;
    }

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    expect(resumeCount).toBeLessThan(20);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(first.window.frameGeometry).toMatchObject({ x: 110 });
    expect(fixture.workspace.activeWindow).toBe(active.window);

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(2);
    expect(active.window.frameGeometry).toMatchObject({
      height: 780,
      width: 300,
      x: 420,
      y: 10,
    });
  });

  it("waits for a pending toggle frame before reversing the transition", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop, {
      frameGeometry: { height: 300, width: 340, x: 90, y: 80 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];

    controller.start();
    fixture.workspace.activeWindow = active.window;
    const tiledFrame = { ...active.window.frameGeometry };
    active.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });
    });

    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(queuedWrites).toHaveLength(1);
    expect(active.window.frameGeometry).toEqual(tiledFrame);
    expect(controller.toggleFloating()).toBe(false);
    expect(controller.floatingCount).toBe(1);

    queuedWrites[0]?.commit();
    active.setWriteBehavior(null);
    expect(active.window.frameGeometry).toEqual(queuedWrites[0]?.frame);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(0);
    expect(active.window.frameGeometry).toEqual(tiledFrame);
  });

  it("defers waiting admission until bounded toggle settlement probes finish", () => {
    const createDelayedToggle = () => {
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
      const workScheduler = new ManualScheduler();
      const resumeScheduler = new ManualScheduler();
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 400 },
        gap: 10,
        schedule: workScheduler.schedule,
        scheduleResume: resumeScheduler.schedule,
      });
      const firstWrites: Array<{
        readonly commit: () => void;
        readonly frame: KWinWindow["frameGeometry"];
      }> = [];
      const secondWrites: Array<{
        readonly commit: () => void;
        readonly frame: KWinWindow["frameGeometry"];
      }> = [];

      controller.start();
      fixture.workspace.activeWindow = first.window;

      while (workScheduler.pendingCount > 0) {
        workScheduler.flush();
      }

      first.setWriteBehavior((frame, commit) => {
        firstWrites.push({ commit, frame });
      });
      second.setWriteBehavior((frame, commit) => {
        secondWrites.push({ commit, frame });
      });
      expect(controller.toggleFloating()).toBe(true);
      expect(firstWrites).toHaveLength(1);
      expect(secondWrites).toHaveLength(1);
      expect(controller.floatingCount).toBe(1);
      expect(controller.managedCount).toBe(1);
      expect(waiting.writeCount).toBe(0);
      expect(resumeScheduler.pendingCount).toBe(1);
      expect(workScheduler.pendingCount).toBe(0);

      return {
        controller,
        desktop,
        first,
        firstWrites,
        fixture,
        output,
        resumeScheduler,
        secondWrites,
        waiting,
        workScheduler,
      };
    };
    const settling = createDelayedToggle();

    expect(settling.controller.reconcile()).toBe(0);
    expect(settling.controller.managedCount).toBe(1);
    expect(settling.waiting.writeCount).toBe(0);
    settling.fixture.currentDesktopChanged.emit(
      settling.desktop,
      settling.desktop,
      settling.output,
    );
    expect(settling.workScheduler.pendingCount).toBe(1);
    settling.workScheduler.flush();
    expect(settling.controller.managedCount).toBe(1);
    expect(settling.waiting.writeCount).toBe(0);
    expect(settling.resumeScheduler.pendingCount).toBe(1);

    settling.firstWrites[0]?.commit();
    settling.resumeScheduler.flush();
    expect(settling.controller.managedCount).toBe(1);
    expect(settling.waiting.writeCount).toBe(0);
    expect(settling.workScheduler.pendingCount).toBe(0);
    expect(settling.resumeScheduler.pendingCount).toBe(1);

    settling.secondWrites[0]?.commit();
    settling.resumeScheduler.flush();
    expect(settling.resumeScheduler.pendingCount).toBe(0);
    expect(settling.workScheduler.pendingCount).toBe(1);
    expect(settling.controller.managedCount).toBe(1);
    settling.workScheduler.flush();

    expect(settling.controller.floatingCount).toBe(1);
    expect(settling.controller.managedCount).toBe(2);
    expect(settling.waiting.writeCount).toBe(1);
    expect(
      testLayoutColumns(settling.controller, settling.output, settling.desktop),
    ).toEqual([
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(settling.fixture.workspace.activeWindow).toBe(settling.first.window);

    const bounded = createDelayedToggle();
    let probeCount = 0;

    while (bounded.resumeScheduler.pendingCount > 0 && probeCount < 100) {
      bounded.resumeScheduler.flush();
      probeCount += 1;
    }

    expect(probeCount).toBe(20);
    expect(bounded.resumeScheduler.pendingCount).toBe(0);
    expect(bounded.workScheduler.pendingCount).toBe(0);
    expect(bounded.controller.floatingCount).toBe(1);
    expect(bounded.controller.managedCount).toBe(1);
    expect(bounded.waiting.writeCount).toBe(0);
  });

  it("admits a waiter when a removed floating window owned an exhausted probe", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const sibling = createTrackedWindow("window-2", output, desktop);
    const waiting = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [active.window, sibling.window, waiting.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 400 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });
    const activeWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const siblingWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];

    controller.start();
    fixture.workspace.activeWindow = active.window;

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    expect(controller.managedCount).toBe(2);
    expect(waiting.writeCount).toBe(0);
    active.setWriteBehavior((frame, commit) => {
      activeWrites.push({ commit, frame });
    });
    sibling.setWriteBehavior((frame, commit) => {
      siblingWrites.push({ commit, frame });
    });
    expect(controller.toggleFloating()).toBe(true);
    expect(activeWrites).toHaveLength(1);
    expect(siblingWrites).toHaveLength(1);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);

    for (let probe = 0; probe < 20; probe += 1) {
      expect(resumeScheduler.pendingCount).toBe(1);
      resumeScheduler.flush();
      expect(controller.managedCount).toBe(1);
      expect(waiting.writeCount).toBe(0);
      expect(workScheduler.pendingCount).toBe(0);
    }

    expect(resumeScheduler.pendingCount).toBe(0);
    const transitionState = controller as unknown as {
      toggleGeometryTransitions: Map<string, unknown>;
      toggleTransitionProbes: Map<string, unknown>;
    };
    expect(transitionState.toggleGeometryTransitions.size).toBe(2);
    expect(transitionState.toggleTransitionProbes.size).toBe(1);

    siblingWrites[0]?.commit();
    sibling.setWriteBehavior(null);
    expect(sibling.window.frameGeometry).toEqual(siblingWrites[0]?.frame);

    fixture.windowRemoved.emit(active.window);

    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(1);
    expect(transitionState.toggleGeometryTransitions.size).toBe(1);
    expect(transitionState.toggleTransitionProbes.size).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    expect(waiting.writeCount).toBe(0);
    resumeScheduler.flush();

    expect(transitionState.toggleGeometryTransitions.size).toBe(0);
    expect(transitionState.toggleTransitionProbes.size).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(waiting.writeCount).toBe(0);
    workScheduler.flush();

    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(2);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(waiting.window.frameGeometry).toMatchObject({
      height: 780,
      width: 400,
      x: 420,
      y: 10,
    });
    expect(waiting.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(0);
  });

  it("moves the active column while preserving focus and revealing it", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });
    const positions = () =>
      windows.map((window) => window.window.frameGeometry.x);

    controller.start();
    expect(positions()).toEqual([-475, 20, 515]);
    expect(controller.moveColumnLeft()).toBe(true);
    expect(positions()).toEqual([-475, 515, 20]);
    expect(controller.moveColumnLeft()).toBe(true);
    expect(positions()).toEqual([495, 990, 0]);
    const writesAtBoundary = windows.map((window) => window.writeCount);
    expect(controller.moveColumnLeft()).toBe(false);
    expect(windows.map((window) => window.writeCount)).toEqual(
      writesAtBoundary,
    );

    expect(controller.moveColumnRight()).toBe(true);
    expect(positions()).toEqual([0, 990, 495]);
    expect(controller.moveColumnRight()).toBe(true);
    expect(positions()).toEqual([-475, 20, 515]);
    expect(controller.moveColumnRight()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(fixture.activationCount).toBe(0);

    controller.stop();
    expect(positions()).toEqual([0, 0, 0]);
  });

  it("rolls back a column move after a partial geometry failure", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });
    const warning = console.warn;

    controller.start();
    const before = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[1]?.setWriteBehavior(() => {
      throw new Error("geometry rejected");
    });
    console.warn = () => undefined;

    try {
      expect(controller.moveColumnLeft()).toBe(false);
    } finally {
      console.warn = warning;
      windows[1]?.setWriteBehavior(null);
    }

    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      before,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(scheduler.pendingCount).toBe(0);
    expect(controller.moveColumnLeft()).toBe(true);
    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      -475, 515, 20,
    ]);
  });

  it("resizes a proportional active column without focus changes or drift", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(active.window.frameGeometry.width).toBe(485);

    expect(controller.increaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5625,
    });
    expect(active.window.frameGeometry.width).toBe(547);
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(active.window.frameGeometry.width).toBe(485);

    for (let cycle = 0; cycle < 32; cycle += 1) {
      expect(controller.increaseColumnWidth()).toBe(true);
      expect(controller.decreaseColumnWidth()).toBe(true);
    }

    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.4375,
    });
    expect(active.window.frameGeometry.width).toBe(423);
    expect(controller.resetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(active.window.frameGeometry.width).toBe(485);
    expect(controller.resetColumnWidth()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it.each([0.1234567890123456, 3.9562697773230275])(
    "preserves proportional default %s across round trips",
    (defaultValue) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const active = createTrackedWindow("window-1", output, desktop);
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [active.window],
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "proportion", value: defaultValue },
        gap: 10,
      });

      controller.start();

      for (let cycle = 0; cycle < 32; cycle += 1) {
        expect(controller.increaseColumnWidth()).toBe(true);
        expect(controller.decreaseColumnWidth()).toBe(true);
      }

      expect(activeColumnWidth(controller, output, desktop)).toEqual({
        kind: "proportion",
        value: defaultValue,
      });
      expect(controller.resetColumnWidth()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(active.window);
    },
  );

  it("resizes and resets a fixed active column in logical-pixel steps", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    expect(active.window.frameGeometry.width).toBe(300);
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 364,
    });
    expect(active.window.frameGeometry.width).toBe(364);
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 300,
    });
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 236,
    });
    expect(active.window.frameGeometry.width).toBe(236);
    expect(controller.resetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 300,
    });
    expect(active.window.frameGeometry.width).toBe(300);
    expect(
      runtimeLayout(controller).setActiveColumnWidth(
        windowId(String(active.window.internalId)),
        { kind: "proportion", value: 0.5 },
      ),
    ).toEqual({ kind: "fixed", value: 300 });
    controller.reconcile();
    expect(active.window.frameGeometry.width).toBe(485);
    expect(controller.resetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 300,
    });
    expect(active.window.frameGeometry.width).toBe(300);
    expect(controller.resetColumnWidth()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("aligns width constraints to physical pixels at fractional scale", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
      {
        maxSize: { height: 10_000, width: 150 },
        minSize: { height: 1, width: 101 },
      },
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output],
      [desktop],
      [active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 128 },
      gap: 10,
    });

    trackedOutput.setScale(1.25);
    controller.start();

    expect(controller.increaseColumnWidth()).toBe(true);
    expect(
      activeColumnWidth(controller, trackedOutput.output, desktop),
    ).toEqual({
      kind: "fixed",
      value: 149.6,
    });
    expect(active.window.frameGeometry.width).toBe(149.6);
    expect(controller.increaseColumnWidth()).toBe(false);

    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(
      activeColumnWidth(controller, trackedOutput.output, desktop),
    ).toEqual({
      kind: "fixed",
      value: 101.6,
    });
    expect(active.window.frameGeometry.width).toBe(101.6);
    expect(controller.decreaseColumnWidth()).toBe(false);
    expect(controller.resetColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(128);
  });

  it("never reverses the requested direction after constraints change", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 500 },
      gap: 10,
    });
    const constraints = active.window as unknown as {
      maxSize: KWinWindow["maxSize"];
      minSize: KWinWindow["minSize"];
    };

    controller.start();
    constraints.maxSize = { height: 10_000, width: 400 };
    expect(controller.increaseColumnWidth()).toBe(false);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 500,
    });
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(400);

    constraints.maxSize = { height: 10_000, width: 10_000 };
    constraints.minSize = { height: 1, width: 450 };
    expect(controller.decreaseColumnWidth()).toBe(false);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 400,
    });
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(464);
  });

  it("uses every grouped member constraint while a sibling is suspended", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const sibling = createTrackedWindow("window-1", output, desktop, {
      maxSize: { height: 10_000, width: 520 },
      minSize: { height: 1, width: 250 },
    });
    const other = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop, {
      maxSize: { height: 10_000, width: 700 },
      minSize: { height: 1, width: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [sibling.window, other.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 500 },
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    const layout = new LayoutEngine();
    layout.restoreColumns({
      activeColumnId: columnId("column:group"),
      columns: [
        {
          column: {
            id: columnId("column:other"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column:group"),
            width: { kind: "fixed", value: 500 },
            windowIds: [windowId("window-1"), windowId("window-3")],
          },
          index: 1,
        },
      ],
      desktopId: desktopId(desktop.id),
      outputId: outputId(output.name),
    });
    (
      controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout = layout;
    controller.reconcile();
    setWindowState("fullscreen", sibling, true);
    scheduler.flush();
    const suspendedFrame = { ...sibling.window.frameGeometry };
    const suspendedWrites = sibling.writeCount;

    expect(controller.increaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 520,
    });
    expect(controller.increaseColumnWidth()).toBe(false);
    expect(active.window.frameGeometry.width).toBe(520);

    for (const expected of [456, 392, 328, 264, 250]) {
      expect(controller.decreaseColumnWidth()).toBe(true);
      expect(activeColumnWidth(controller, output, desktop)).toEqual({
        kind: "fixed",
        value: expected,
      });
    }

    expect(controller.decreaseColumnWidth()).toBe(false);
    expect(active.window.frameGeometry.width).toBe(250);
    expect(sibling.window.frameGeometry).toEqual(suspendedFrame);
    expect(sibling.writeCount).toBe(suspendedWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    setWindowState("fullscreen", sibling, false);

    for (
      let attempt = 0;
      attempt < 6 && scheduler.pendingCount > 0;
      attempt += 1
    ) {
      scheduler.flush();
    }

    expect(sibling.window.frameGeometry.width).toBe(250);
    expect(sibling.window.frameGeometry.x).toBe(active.window.frameGeometry.x);
    expect(controller.resetColumnWidth()).toBe(true);
    expect(sibling.window.frameGeometry.width).toBe(500);
    expect(active.window.frameGeometry.width).toBe(500);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("rolls back a width that would overflow a multi-output context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const beforeWrites = windows.map((window) => window.writeCount);

    expect(controller.increaseColumnWidth()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(windows.map((window) => window.writeCount)).toEqual(beforeWrites);
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("rolls back a column resize after a partial geometry failure", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });
    const warning = console.warn;

    controller.start();
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.increaseColumnWidth()).toBe(false);
    } finally {
      console.warn = warning;
      windows[1]?.setWriteBehavior(null);
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(fixture.activationCount).toBe(0);
    expect(scheduler.pendingCount).toBe(0);
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5625,
    });
  });

  it("queues rollback after an accepted asynchronous geometry write", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
      createTrackedWindow("window-3", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });
    const queuedWrites: Array<{
      readonly commit: () => void;
      readonly frame: KWinWindow["frameGeometry"];
    }> = [];
    const warning = console.warn;

    controller.start();
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[0]?.setWriteBehavior((frame, commit) => {
      queuedWrites.push({ commit, frame });
    });
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.increaseColumnWidth()).toBe(false);
    } finally {
      console.warn = warning;
      windows[0]?.setWriteBehavior(null);
      windows[1]?.setWriteBehavior(null);
    }

    expect(queuedWrites).toHaveLength(2);
    expect(queuedWrites[0]?.frame).not.toEqual(beforeFrames[0]);
    expect(queuedWrites[1]?.frame).toEqual(beforeFrames[0]);

    for (const write of queuedWrites) {
      write.commit();
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("restores exact frames when a shrink fails during capacity backoff", () => {
    const output = createOutput("DP-1", 0);
    const addedOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output, desktop),
      createTrackedWindow("window-2", output, desktop),
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 500 },
      gap: 10,
      schedule: scheduler.schedule,
    });
    const warning = console.warn;

    controller.start();
    fixture.setScreens([output, addedOutput]);
    (
      controller as unknown as {
        capacityParkBackoffs: Set<string>;
      }
    ).capacityParkBackoffs.add(`${output.name}\u0000${desktop.id}`);
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    let rejectNextWrite = true;
    windows[1]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.decreaseColumnWidth()).toBe(false);
    } finally {
      console.warn = warning;
      windows[1]?.setWriteBehavior(null);
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(fixture.activationCount).toBe(0);
    expect(scheduler.pendingCount).toBe(0);
  });

  it("retries a stable capacity lease after the active column shrinks", () => {
    const setup = createCapacityFixture(3, { kind: "fixed", value: 400 });
    const parked = setup.windows[0];

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(2);
    expect(
      activeColumnWidth(setup.controller, setup.output.output, setup.desktop),
    ).toEqual({
      kind: "fixed",
      value: 400,
    });
    const parkedWrites = parked?.writeCount ?? 0;

    for (const expected of [336, 272, 208]) {
      expect(setup.controller.decreaseColumnWidth()).toBe(true);
      expect(
        activeColumnWidth(setup.controller, setup.output.output, setup.desktop),
      ).toEqual({ kind: "fixed", value: expected });
      expect(setup.controller.managedCount).toBe(2);
      setup.workScheduler.flush();
      expect(setup.controller.managedCount).toBe(2);
    }

    expect(setup.controller.decreaseColumnWidth()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output.output, setup.desktop),
    ).toEqual({ kind: "fixed", value: 144 });
    setup.workScheduler.flush();

    expect(setup.controller.managedCount).toBe(3);
    expect(parked?.writeCount).toBeGreaterThan(parkedWrites);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[2]?.window);
    expect(setup.fixture.activationCount).toBe(0);
  });

  it("does not resize while a capacity park is in flight", () => {
    const setup = createCapacityFixture(3, { kind: "fixed", value: 400 });
    const first = setup.windows[0];
    const pendingWrites: Array<KWinWindow["frameGeometry"]> = [];

    setup.controller.start();
    first?.setWriteBehavior((frame) => {
      pendingWrites.push(frame);
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(pendingWrites).toHaveLength(1);
    expect(setup.controller.managedCount).toBe(3);
    const beforeLayout = runtimeLayout(setup.controller).snapshot(
      outputId(setup.output.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    expect(setup.controller.decreaseColumnWidth()).toBe(false);
    expect(
      runtimeLayout(setup.controller).snapshot(
        outputId(setup.output.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[2]?.window);
    expect(setup.fixture.activationCount).toBe(0);
  });

  it("does not move a suspended active column", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    setWindowState("fullscreen", active, true);
    scheduler.flush();
    const frames = [
      { ...first.window.frameGeometry },
      { ...active.window.frameGeometry },
    ];
    const writes = [first.writeCount, active.writeCount];

    expect(controller.moveColumnLeft()).toBe(false);
    expect([first.window.frameGeometry, active.window.frameGeometry]).toEqual(
      frames,
    );
    expect([first.writeCount, active.writeCount]).toEqual(writes);
  });

  it("moves a grouped column without writing its suspended sibling", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const sibling = createTrackedWindow("window-1", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const other = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [sibling.window, active.window, other.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    const layout = new LayoutEngine();
    layout.restoreColumns({
      activeColumnId: columnId("column:group"),
      columns: [
        {
          column: {
            id: columnId("column:other"),
            width: { kind: "proportion", value: 0.5 },
            windowIds: [windowId("window-3")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column:group"),
            width: { kind: "proportion", value: 0.5 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 1,
        },
      ],
      desktopId: desktopId(desktop.id),
      outputId: outputId(output.name),
    });
    (
      controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout = layout;
    fixture.workspace.activeWindow = active.window;
    controller.reconcile();
    setWindowState("fullscreen", sibling, true);
    scheduler.flush();
    const suspendedFrame = { ...sibling.window.frameGeometry };
    const suspendedWrites = sibling.writeCount;

    expect(controller.moveColumnLeft()).toBe(true);
    expect(
      layout
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.map((column) => column.id),
    ).toEqual(["column:group", "column:other"]);
    expect(sibling.window.frameGeometry).toEqual(suspendedFrame);
    expect(sibling.writeCount).toBe(suspendedWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    setWindowState("fullscreen", sibling, false);

    for (
      let attempt = 0;
      attempt < 6 && scheduler.pendingCount > 0;
      attempt += 1
    ) {
      scheduler.flush();
    }

    expect(sibling.window.frameGeometry.x).toBe(active.window.frameGeometry.x);
    expect(sibling.window.frameGeometry).not.toEqual(suspendedFrame);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("does not move a column while a topology barrier is unsettled", () => {
    const output = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("window-1", output.output, desktop),
      createTrackedWindow("window-2", output.output, desktop),
      createTrackedWindow("window-3", output.output, desktop),
    ];
    const fixture = createWorkspace(
      output.output,
      desktop,
      [output.output],
      [desktop],
      windows.map((window) => window.window),
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
    const frames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = windows.map((window) => window.writeCount);
    output.geometryChanged.emit();

    expect(controller.moveColumnLeft()).toBe(false);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(windows.map((window) => window.writeCount)).toEqual(writes);
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

  it("replays an active suspended column after startup topology recovery", () => {
    const leftOutput = createTrackedOutput("DP-1", 0);
    const rightOutput = createTrackedOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("left-a", leftOutput.output, desktop),
      createTrackedWindow("left-active", leftOutput.output, desktop),
      createTrackedWindow("right-a", rightOutput.output, desktop),
      createTrackedWindow("right-b", rightOutput.output, desktop),
    ];
    const active = windows[1];

    if (!active) {
      throw new Error("missing active startup window");
    }

    const fixture = createWorkspace(
      rightOutput.output,
      desktop,
      [leftOutput.output, rightOutput.output],
      [desktop],
      windows.map((window) => window.window),
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
      startupStabilizationProbes: 3,
    });

    controller.start();
    fixture.workspace.activeWindow = active.window;
    setWindowState("fullscreen", active, true);

    for (const transferred of windows.slice(0, 2)) {
      Object.defineProperty(transferred.window, "output", {
        configurable: true,
        value: rightOutput.output,
      });
      transferred.outputChanged.emit(leftOutput.output);
    }

    fixture.setScreens([rightOutput.output]);
    fixture.screensChanged.emit();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (resumeScheduler.pendingCount > 0) {
        resumeScheduler.flush();
      }

      while (workScheduler.pendingCount > 0) {
        workScheduler.flush();
      }

      if (
        resumeScheduler.pendingCount === 0 &&
        workScheduler.pendingCount === 0
      ) {
        break;
      }
    }

    const layout = (
      controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout;
    expect(
      layout.snapshot(outputId(rightOutput.output.name), desktopId(desktop.id))
        .activeColumnId,
    ).toBe("column:left-active");
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(active.writeCount).toBe(0);
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

    fixture.workspace.activeWindow = second.window;
    expect(controller.moveColumnLeft()).toBe(true);
    expect(first.window.frameGeometry.x).toBe(505);
    expect(second.window.frameGeometry.x).toBe(10);
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

  it("quiesces dirty contexts until client-area sampling recovers", () => {
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
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
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
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
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
    expect(workScheduler.pendingCount).toBe(1);
    workScheduler.flush();

    expect(other.window.frameGeometry.x).toBe(1800);
    expect(resumeScheduler.pendingCount).toBe(1);

    failFirstOutput = false;
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(controller.lastWriteCount).toBe(1);
    expect(other.window.frameGeometry.x).toBe(1010);
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

  it("waits for two stable topology samples before reflowing", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    expect(window.window.frameGeometry.x).toBe(10);
    expect(window.writeCount).toBe(1);

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    trackedOutput.setScale(1.25);
    trackedOutput.scaleChanged.emit();

    expect(window.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);

    resumeScheduler.flush();
    expect(window.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);

    resumeScheduler.flush();
    expect(window.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(1);

    workScheduler.flush();
    expect(window.window.frameGeometry.x).toBeCloseTo(210.4, 6);
    expect(window.writeCount).toBe(2);
    expect(controller.lastWriteCount).toBe(1);
  });

  it("cancels a pending recovery when a newer topology event arrives", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 100,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();
    resumeScheduler.flush();
    expect(workScheduler.pendingCount).toBe(1);

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    workScheduler.flush();

    expect(window.window.frameGeometry.x).toBe(10);
    expect(window.writeCount).toBe(1);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(window.window.frameGeometry.x).toBe(210);
    expect(window.writeCount).toBe(2);
  });

  it("replays activation received while topology is settling", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
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
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    fixture.workspace.activeWindow = first.window;
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(fixture.workspace.activeWindow).toBe(first.window);
    expect(first.window.frameGeometry.x).toBe(200);
    expect(second.window.frameGeometry.x).toBe(695);
    expect(third.window.frameGeometry.x).toBe(1190);
  });

  it("starts the topology barrier before focus can use a silent work-area change", () => {
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
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({
        height: 800,
        width: workAreaWidth,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    const firstWrites = first.writeCount;
    const secondWrites = second.writeCount;
    workAreaWidth = 800;

    expect(controller.focusLeft()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(second.window);
    expect(first.writeCount).toBe(firstWrites);
    expect(second.writeCount).toBe(secondWrites);
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(first.window.frameGeometry.width).toBe(385);
    expect(second.window.frameGeometry.width).toBe(385);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(first.window);
  });

  it("coalesces an output burst and restarts stable topology sampling", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const addedOutput = createTrackedOutput("HDMI-A-1", 1000).output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 100,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    trackedOutput.setScale(1.25);
    trackedOutput.scaleChanged.emit();
    fixture.setScreens([output, addedOutput]);
    fixture.screensChanged.emit();

    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    expect(window.writeCount).toBe(1);

    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    expect(window.writeCount).toBe(1);
    resumeScheduler.flush();
    expect(workScheduler.pendingCount).toBe(1);
    expect(window.writeCount).toBe(1);

    workScheduler.flush();
    expect(window.window.frameGeometry.x).toBeCloseTo(210.4, 6);
    expect(window.writeCount).toBe(2);
  });

  it("preserves a suspended slot while its sibling follows topology", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const suspended = createTrackedWindow("window-1", output, desktop);
    const sibling = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [suspended.window, sibling.window],
    );
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({
        height: 800,
        width: workAreaWidth,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    const suspendedFrame = { ...suspended.window.frameGeometry };
    setWindowState("minimized", suspended, true);
    workScheduler.flush();
    const suspendedWrites = suspended.writeCount;
    const siblingWrites = sibling.writeCount;

    workAreaWidth = 800;
    trackedOutput.geometryChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(controller.managedCount).toBe(2);
    expect(suspended.window.frameGeometry).toEqual(suspendedFrame);
    expect(suspended.writeCount).toBe(suspendedWrites);
    expect(sibling.window.frameGeometry).toEqual({
      height: 780,
      width: 385,
      x: 405,
      y: 10,
    });
    expect(sibling.writeCount).toBe(siblingWrites + 1);
  });

  it("keeps the topology barrier until client area sampling recovers", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
    );
    let clientAreaAvailable = true;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, candidate: KWinOutput) => {
        if (!clientAreaAvailable) {
          throw new Error("client area unavailable");
        }

        return {
          height: 800,
          width: 1000,
          x: candidate.geometry.x,
          y: candidate.geometry.y,
        };
      },
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    clientAreaAvailable = false;
    trackedOutput.geometryChanged.emit();

    resumeScheduler.flush();
    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    expect(window.writeCount).toBe(1);

    clientAreaAvailable = true;
    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    resumeScheduler.flush();
    expect(workScheduler.pendingCount).toBe(1);
    expect(window.writeCount).toBe(1);

    workScheduler.flush();
    expect(window.window.frameGeometry.x).toBe(210);
    expect(window.writeCount).toBe(2);
  });

  it("bounds unstable topology sampling and retries on the next probe", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    trackedOutput.geometryChanged.emit();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      trackedOutput.setGeometry({
        height: 800,
        width: 1000,
        x: attempt + 1,
        y: 0,
      });
      resumeScheduler.flush();
    }

    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(0);
    expect(window.writeCount).toBe(1);

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    controller.probeTopology();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(window.window.frameGeometry.x).toBe(210);
    expect(window.writeCount).toBe(2);
  });

  it("reflows a work area after a dock geometry event settles", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop);
    const dock = createTrackedWindow("dock-1", output, desktop, {
      dock: true,
      normalWindow: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window, dock.window],
    );
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({
        height: 800,
        width: workAreaWidth,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    expect(window.window.frameGeometry.width).toBe(485);

    workAreaWidth = 800;
    dock.frameGeometryChanged.emit(dock.window.frameGeometry);
    expect(window.writeCount).toBe(1);

    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(window.window.frameGeometry.width).toBe(385);
    expect(window.writeCount).toBe(2);
    expect(dock.writeCount).toBe(0);
  });

  it("detects a silent visible work-area change when topology is probed", () => {
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
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({
        height: 800,
        width: workAreaWidth,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    workAreaWidth = 700;
    controller.probeTopology();

    expect(window.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(window.window.frameGeometry.width).toBe(335);
    expect(window.writeCount).toBe(2);
  });

  it("defers topology reflow for an invisible desktop", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const hiddenDesktop = { id: "desktop-2" };
    const visible = createTrackedWindow("window-1", output, desktop);
    const hidden = createTrackedWindow("window-2", output, hiddenDesktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop, hiddenDesktop],
      [visible.window, hidden.window],
    );
    let hiddenWorkAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (
        _option: number,
        _candidate: KWinOutput,
        candidateDesktop: KWinVirtualDesktop,
      ) => ({
        height: 800,
        width:
          candidateDesktop.id === hiddenDesktop.id ? hiddenWorkAreaWidth : 1000,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    expect(visible.writeCount).toBe(1);
    expect(hidden.writeCount).toBe(0);

    hiddenWorkAreaWidth = 800;
    trackedOutput.geometryChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(hidden.writeCount).toBe(0);

    fixture.setCurrentDesktop(output, hiddenDesktop);
    expect(workScheduler.pendingCount).toBe(1);
    workScheduler.flush();
    expect(hidden.window.frameGeometry.width).toBe(385);
    expect(hidden.writeCount).toBe(1);
  });

  it("invalidates a silent hidden-context restore baseline when it becomes visible", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const hiddenDesktop = { id: "desktop-2" };
    const visible = createTrackedWindow("window-1", output, desktop);
    const hidden = createTrackedWindow("window-2", output, hiddenDesktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop, hiddenDesktop],
      [visible.window, hidden.window],
    );
    let hiddenWorkAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (
        _option: number,
        _candidate: KWinOutput,
        candidateDesktop: KWinVirtualDesktop,
      ) => ({
        height: 800,
        width:
          candidateDesktop.id === hiddenDesktop.id ? hiddenWorkAreaWidth : 1000,
        x: 0,
        y: 0,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    hiddenWorkAreaWidth = 800;
    fixture.setCurrentDesktop(output, hiddenDesktop);
    workScheduler.flush();
    expect(hidden.window.frameGeometry.width).toBe(300);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(hidden.window.frameGeometry.width).toBe(385);

    fixture.setCurrentDesktop(output, desktop);
    workScheduler.flush();
    hiddenWorkAreaWidth = 1000;
    fixture.setCurrentDesktop(output, hiddenDesktop);
    workScheduler.flush();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    controller.stop();

    expect(hidden.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("captures the relocated frame after an output is removed", () => {
    const output = createTrackedOutput("DP-1", 0).output;
    const removedOutput = createTrackedOutput("HDMI-A-1", 1000).output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", removedOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, removedOutput],
      [desktop],
      [window.window],
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
    window.setFrameGeometry({ height: 220, width: 320, x: 200, y: 120 });
    Object.defineProperty(window.window, "output", { value: output });
    fixture.setScreens([output]);
    fixture.screensChanged.emit();

    expect(window.window.frameGeometry.x).toBe(200);
    expect(controller.managedCount).toBe(1);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(window.window.frameGeometry.x).toBe(10);
    expect(controller.managedCount).toBe(1);

    controller.stop();
    expect(window.window.frameGeometry).toEqual({
      height: 220,
      width: 320,
      x: 200,
      y: 120,
    });
  });

  it("invalidates restore ownership when an output instance is replaced", () => {
    const originalOutput = createTrackedOutput("DP-1", 0).output;
    const replacementOutput = createTrackedOutput("DP-1", 0).output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", originalOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const fixture = createWorkspace(
      originalOutput,
      desktop,
      [originalOutput],
      [desktop],
      [window.window],
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
    Object.defineProperty(window.window, "output", {
      value: replacementOutput,
    });
    fixture.setScreens([replacementOutput]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    controller.stop();

    expect(window.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("keeps unrelated restore ownership after a same-name replacement", () => {
    const originalOutput = createTrackedOutput("DP-1", 0).output;
    const replacementOutput = createTrackedOutput("DP-1", 0).output;
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const replaced = createTrackedWindow("window-1", originalOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const unaffected = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 220, width: 320, x: 1120, y: 120 },
    });
    const fixture = createWorkspace(
      originalOutput,
      desktop,
      [originalOutput, otherOutput],
      [desktop],
      [replaced.window, unaffected.window],
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
    Object.defineProperty(replaced.window, "output", {
      configurable: true,
      value: replacementOutput,
    });
    fixture.setScreens([replacementOutput, otherOutput]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    controller.stop();

    expect(replaced.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
    expect(unaffected.window.frameGeometry).toEqual({
      height: 220,
      width: 320,
      x: 1120,
      y: 120,
    });
  });

  it("revalidates overflow when output count changes", () => {
    const output = createTrackedOutput("DP-1", 0).output;
    const addedOutput = createTrackedOutput("HDMI-A-1", 1000).output;
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const active = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window, active.window],
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
    expect(controller.managedCount).toBe(3);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    fixture.setScreens([output, addedOutput]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    flushCapacityParking(resumeScheduler, workScheduler);

    expect(controller.managedCount).toBe(2);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(second.window);
    const writesAfterEviction = first.writeCount;

    fixture.setScreens([output]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(controller.managedCount).toBe(3);
    expect(first.writeCount).toBeGreaterThan(writesAfterEviction);
  });

  it("keeps column ownership until a capacity park is observed twice", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const writes: Array<{
      commit: () => void;
      frame: KWinWindow["frameGeometry"];
    }> = [];

    expect(first).toBeDefined();
    setup.controller.start();
    first?.setWriteBehavior((frame, commit) => {
      writes.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(writes).toHaveLength(1);
    expect(setup.controller.managedCount).toBe(3);
    setup.resumeScheduler.flush();
    expect(writes).toHaveLength(2);
    expect(setup.controller.managedCount).toBe(3);

    writes[0]?.commit();
    setup.resumeScheduler.flush();
    expect(setup.controller.managedCount).toBe(3);
    setup.resumeScheduler.flush();
    expect(setup.controller.managedCount).toBe(2);
    setup.workScheduler.flush();
  });

  it("retries a partial whole-column park without releasing any column early", () => {
    const setup = createCapacityFixture(4);
    const first = setup.windows[0];
    const second = setup.windows[1];
    let rejectSecondWrite = true;
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      setup.controller.start();
      first?.setWriteBehavior((_frame, commit) => {
        commit();
      });
      second?.setWriteBehavior((_frame, commit) => {
        if (rejectSecondWrite) {
          rejectSecondWrite = false;
          throw new Error("delayed configure rejection");
        }

        commit();
      });
      setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
      setup.fixture.screensChanged.emit();
      flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

      expect(setup.controller.managedCount).toBe(4);
      setup.resumeScheduler.flush();
      expect(setup.controller.managedCount).toBe(4);
      setup.resumeScheduler.flush();
      expect(setup.controller.managedCount).toBe(4);
      setup.resumeScheduler.flush();
      expect(setup.controller.managedCount).toBe(2);
      setup.workScheduler.flush();
    } finally {
      console.warn = warning;
    }
  });

  it("cancels a pending park when its window is suspended", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];

    setup.controller.start();
    first?.setWriteBehavior(() => undefined);
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(3);

    if (first) {
      setWindowState("fullscreen", first, true);
    }

    setup.workScheduler.flush();
    setup.resumeScheduler.flush();
    expect(setup.controller.managedCount).toBe(3);
  });

  it("does not commit a pending park after a transfer or removal", () => {
    const transferred = createCapacityFixture();
    const transferWindow = transferred.windows[0];

    transferred.controller.start();
    transferWindow?.setWriteBehavior(() => undefined);
    transferred.fixture.setScreens([
      transferred.output.output,
      transferred.addedOutput.output,
    ]);
    transferred.fixture.screensChanged.emit();
    flushTopologyRecovery(
      transferred.resumeScheduler,
      transferred.workScheduler,
    );

    if (transferWindow) {
      Object.defineProperty(transferWindow.window, "output", {
        configurable: true,
        value: transferred.addedOutput.output,
      });
      transferWindow.outputChanged.emit(transferred.output.output);
    }

    transferred.workScheduler.flush();
    transferred.resumeScheduler.flush();
    expect(transferred.controller.managedCount).toBe(3);

    const removed = createCapacityFixture();
    const removedWindow = removed.windows[0];
    removed.controller.start();
    removedWindow?.setWriteBehavior(() => undefined);
    removed.fixture.setScreens([
      removed.output.output,
      removed.addedOutput.output,
    ]);
    removed.fixture.screensChanged.emit();
    flushTopologyRecovery(removed.resumeScheduler, removed.workScheduler);

    if (removedWindow) {
      removed.fixture.windowRemoved.emit(removedWindow.window);
    }

    removed.resumeScheduler.flush();
    expect(removed.controller.managedCount).toBe(2);
  });

  it("ignores a pending capacity callback from an older topology revision", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];

    setup.controller.start();
    first?.setWriteBehavior(() => undefined);
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(3);

    setup.output.geometryChanged.emit();
    setup.resumeScheduler.flush();
    expect(setup.controller.managedCount).toBe(3);
  });

  it("supersedes an unobserved park request when stopped", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const originalFrame = first ? { ...first.window.frameGeometry } : null;
    const writes: Array<{
      commit: () => void;
      frame: KWinWindow["frameGeometry"];
    }> = [];

    setup.controller.start();
    first?.setWriteBehavior((frame, commit) => {
      writes.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(writes).toHaveLength(1);

    setup.controller.stop();
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes[writes.length - 1]?.frame).toEqual(originalFrame);

    for (const write of writes) {
      write.commit();
    }

    expect(first?.window.frameGeometry).toEqual(originalFrame);
  });

  it("supersedes a pending park without stale rollback during a local barrier", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const externalFrame = { height: 260, width: 340, x: 240, y: 180 };
    const writes: Array<{
      commit: () => void;
      frame: KWinWindow["frameGeometry"];
    }> = [];

    setup.controller.start();
    first?.setWriteBehavior((frame, commit) => {
      writes.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(writes).toHaveLength(1);

    first?.setFrameGeometry(externalFrame);
    setup.output.geometryChanged.emit();
    setup.controller.stop();
    expect(writes[writes.length - 1]?.frame).toEqual(externalFrame);

    for (const write of writes) {
      write.commit();
    }

    expect(first?.window.frameGeometry).toEqual(externalFrame);
  });

  it("supersedes a pending park when the work area is unavailable", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const externalFrame = { height: 260, width: 340, x: 240, y: 180 };
    const writes: Array<{
      commit: () => void;
      frame: KWinWindow["frameGeometry"];
    }> = [];

    setup.controller.start();
    first?.setWriteBehavior((frame, commit) => {
      writes.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(writes).toHaveLength(1);

    first?.setFrameGeometry(externalFrame);
    Object.defineProperty(setup.fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        throw new Error("work area unavailable");
      },
    });
    setup.output.geometryChanged.emit();
    setup.controller.stop();
    expect(writes[writes.length - 1]?.frame).toEqual(externalFrame);

    for (const write of writes) {
      write.commit();
    }

    expect(first?.window.frameGeometry).toEqual(externalFrame);
  });

  it("restores exact parked order and original baselines after a count round trip", () => {
    const setup = createCapacityFixture();
    const originals = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    setup.controller.start();
    const active = setup.windows[2];
    expect(setup.fixture.workspace.activeWindow).toBe(active?.window);
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    setup.fixture.setScreens([setup.output.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(3);
    expect(setup.fixture.workspace.activeWindow).toBe(active?.window);
    expect(setup.controller.focusLeft()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[1]?.window);
    expect(setup.controller.focusLeft()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[0]?.window);

    setup.controller.stop();

    for (const [index, window] of setup.windows.entries()) {
      expect(window.window.frameGeometry).toEqual(originals[index]);
    }
  });

  it("keeps logical column indices across successive capacity parks", () => {
    const setup = createCapacityFixture(4, { kind: "fixed", value: 300 });
    let workAreaWidth = 1000;
    Object.defineProperty(setup.fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, output: KWinOutput) => ({
        height: 800,
        width: workAreaWidth,
        x: output.geometry.x,
        y: output.geometry.y,
      }),
    });

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(3);

    workAreaWidth = 700;
    setup.output.geometryChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    setup.fixture.setScreens([setup.output.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.focusLeft()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[2]?.window);
    expect(setup.controller.focusLeft()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[1]?.window);
    expect(setup.controller.focusLeft()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.windows[0]?.window);
  });

  it("does not overwrite an externally moved committed parking lease", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const externalFrame = { height: 260, width: 340, x: 300, y: 200 };

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    first?.setFrameGeometry(externalFrame);

    setup.controller.stop();
    expect(first?.window.frameGeometry).toEqual(externalFrame);
  });

  it("does not reorder resident columns while a capacity lease is parked", () => {
    const setup = createCapacityFixture();

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    const layout = (
      setup.controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout;
    const before = layout.snapshot(
      outputId(setup.output.output.name),
      desktopId(setup.desktop.id),
    );
    const writes = setup.windows.map((window) => window.writeCount);

    expect(setup.controller.moveColumnLeft()).toBe(false);
    expect(
      layout.snapshot(
        outputId(setup.output.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(before);
    expect(setup.windows.map((window) => window.writeCount)).toEqual(writes);
  });

  it("restores an untouched committed parking lease when stopped", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const originalFrame = first ? { ...first.window.frameGeometry } : null;

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    setup.controller.stop();
    expect(first?.window.frameGeometry).toEqual(originalFrame);
  });

  it("keeps a committed parking lease during an unsettled local barrier", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    const parkedFrame = first ? { ...first.window.frameGeometry } : null;
    setup.output.geometryChanged.emit();
    setup.controller.stop();

    expect(first?.window.frameGeometry).toEqual(parkedFrame);
  });

  it("invalidates a committed lease after transfer and captures its destination frame", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const destinationFrame = {
      height: 260,
      width: 340,
      x: 1200,
      y: 180,
    };

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    if (first) {
      first.setFrameGeometry(destinationFrame);
      Object.defineProperty(first.window, "output", {
        configurable: true,
        value: setup.addedOutput.output,
      });
      first.outputChanged.emit(setup.output.output);
    }

    setup.workScheduler.flush();
    expect(setup.controller.managedCount).toBe(3);
    setup.controller.stop();
    expect(first?.window.frameGeometry).toEqual(destinationFrame);
  });

  it("parks the active column only as the last safe capacity option", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const second = setup.windows[1];
    const active = setup.windows[2];

    setup.controller.start();

    if (first && second) {
      setWindowState("fullscreen", first, true);
      setWindowState("fullscreen", second, true);
    }

    setup.workScheduler.flush();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(2);
    expect(setup.fixture.workspace.activeWindow).toBe(active?.window);
  });

  it("keeps ownership and performs no park write when no column is safe", () => {
    const setup = createCapacityFixture();

    setup.controller.start();

    for (const window of setup.windows) {
      setWindowState("fullscreen", window, true);
    }

    setup.workScheduler.flush();
    const writesBeforeTopology = setup.windows.map(
      (window) => window.writeCount,
    );
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(3);
    expect(setup.windows.map((window) => window.writeCount)).toEqual(
      writesBeforeTopology,
    );
  });

  it("backs off after bounded capacity failures until an output event", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      setup.controller.start();
      first?.setWriteBehavior(() => {
        throw new Error("persistent geometry rejection");
      });
      setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
      setup.fixture.screensChanged.emit();
      flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        setup.resumeScheduler.flush();
      }

      expect(setup.resumeScheduler.pendingCount).toBe(0);
      const writesAtBackoff = first?.writeCount;
      setup.workScheduler.flush();
      expect(setup.resumeScheduler.pendingCount).toBe(0);
      expect(first?.writeCount).toBe(writesAtBackoff);

      setup.output.geometryChanged.emit();
      flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
      expect(setup.resumeScheduler.pendingCount).toBe(1);
      expect(first?.writeCount).toBeGreaterThan(writesAtBackoff ?? 0);
    } finally {
      console.warn = warning;
    }
  });

  it("supersedes a canceled park conservatively during a local barrier", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const writes: Array<{
      commit: () => void;
      frame: KWinWindow["frameGeometry"];
    }> = [];

    setup.controller.start();
    first?.setWriteBehavior((frame, commit) => {
      writes.push({ commit, frame });
    });
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    expect(writes).toHaveLength(1);
    const currentFrame = first ? { ...first.window.frameGeometry } : null;

    setup.output.geometryChanged.emit();
    setup.controller.stop();
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes[writes.length - 1]?.frame).toEqual(currentFrame);

    for (const write of writes) {
      write.commit();
    }

    expect(first?.window.frameGeometry).toEqual(currentFrame);
  });

  it("supersedes a canceled park after its window changes context", () => {
    const output = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output.output, desktop);
    const fixture = createWorkspace(
      output.output,
      desktop,
      [output.output, otherOutput],
      [desktop],
      [window.window],
    );
    const workScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
    });

    controller.start();
    const canceledParks = (
      controller as unknown as {
        capacityCanceledParks: Map<string, unknown>;
      }
    ).capacityCanceledParks;
    canceledParks.set("DP-1\u0000desktop-1", {
      windows: [
        {
          columnId: columnId("column:window-1"),
          restoreBaseline: null,
          rollbackFrame: { ...window.window.frameGeometry },
          targetFrame: { ...window.window.frameGeometry, x: 300 },
          windowId: windowId("window-1"),
        },
      ],
    });
    const destinationFrame = {
      height: 780,
      width: 485,
      x: 1010,
      y: 10,
    };
    window.setFrameGeometry(destinationFrame);
    const writesBeforeTransfer = window.writeCount;
    Object.defineProperty(window.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    window.outputChanged.emit(output.output);
    workScheduler.flush();

    expect(window.writeCount).toBe(writesBeforeTransfer + 1);
    expect(window.window.frameGeometry).toEqual(destinationFrame);
    expect(canceledParks.size).toBe(0);
  });

  it("rebases a parked right column after an intervening column closes", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const middle = setup.windows[1];
    const parked = setup.windows[2];

    setup.controller.start();
    setup.fixture.workspace.activeWindow = first?.window ?? null;
    setup.workScheduler.flush();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(2);

    if (middle) {
      Object.defineProperty(middle.window, "deleted", {
        configurable: true,
        value: true,
      });
      setup.fixture.windowRemoved.emit(middle.window);
    }

    setup.workScheduler.flush();
    setup.fixture.setScreens([setup.output.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(2);
    expect(setup.controller.focusRight()).toBe(true);
    expect(setup.fixture.workspace.activeWindow).toBe(parked?.window);
  });

  it("invalidates a parked-only baseline across a geometry round trip", () => {
    const setup = createCapacityFixture(1, { kind: "fixed", value: 1200 });
    const parked = setup.windows[0];
    const originalFrame = parked ? { ...parked.window.frameGeometry } : null;

    setup.controller.start();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(0);

    setup.output.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    setup.output.geometryChanged.emit();
    setup.output.setGeometry({
      height: 800,
      width: 1000,
      x: 0,
      y: 0,
    });
    setup.output.geometryChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    setup.controller.stop();

    expect(parked?.window.frameGeometry).not.toEqual(originalFrame);
    expect(parked?.window.frameGeometry.width).toBe(1200);
  });

  it("queues every sibling when a grouped capacity lease is invalidated", () => {
    const setup = createCapacityFixture();
    const first = setup.windows[0];
    const sibling = setup.windows[1];
    const active = setup.windows[2];
    const groupedLayout = new LayoutEngine();

    setup.controller.start();
    groupedLayout.restoreColumns({
      activeColumnId: columnId("column:active"),
      columns: [
        {
          column: {
            id: columnId("column:group"),
            width: { kind: "fixed", value: 700 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column:active"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-3")],
          },
          index: 1,
        },
      ],
      desktopId: desktopId(setup.desktop.id),
      outputId: outputId(setup.output.output.name),
    });
    (
      setup.controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout = groupedLayout;
    setup.controller.reconcile();
    expect(setup.fixture.workspace.activeWindow).toBe(active?.window);

    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(1);

    if (first) {
      first.setFrameGeometry({ height: 240, width: 320, x: 1200, y: 100 });
      Object.defineProperty(first.window, "output", {
        configurable: true,
        value: setup.addedOutput.output,
      });
      first.outputChanged.emit(setup.output.output);
    }

    setup.workScheduler.flush();
    expect(setup.controller.managedCount).toBe(2);
    setup.workScheduler.flush();
    expect(setup.controller.managedCount).toBe(3);
    expect(sibling?.writeCount).toBeGreaterThan(1);
  });

  it("preserves every grouped lease baseline through a structural round trip", () => {
    const setup = createCapacityFixture();
    const originals = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    setup.controller.start();
    const layout = installGroupedCapacityLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
    );
    setup.controller.reconcile();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(1);

    setup.fixture.setScreens([setup.output.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(3);
    expect(
      layout.snapshot(
        outputId(setup.output.output.name),
        desktopId(setup.desktop.id),
      ).columns,
    ).toEqual([
      {
        id: "column:group",
        width: { kind: "fixed", value: 700 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:active",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);

    setup.controller.stop();

    for (const [index, window] of setup.windows.entries()) {
      expect(window.window.frameGeometry).toEqual(originals[index]);
    }
  });

  it("preserves grouped topology across a same-name output replacement", () => {
    const setup = createCapacityFixture(3, { kind: "fixed", value: 100 });
    let workAreaWidth = 1000;
    Object.defineProperty(setup.fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, output: KWinOutput) => ({
        height: 800,
        width: output.name === setup.output.output.name ? workAreaWidth : 1000,
        x: output.geometry.x,
        y: output.geometry.y,
      }),
    });

    setup.controller.start();
    const layout = installGroupedCapacityLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
    );
    setup.controller.reconcile();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(1);

    const replacement = createTrackedOutput(setup.output.output.name, 0);
    workAreaWidth = 1100;

    for (const window of setup.windows) {
      Object.defineProperty(window.window, "output", {
        configurable: true,
        value: replacement.output,
      });
    }

    Object.defineProperty(setup.fixture.workspace, "activeScreen", {
      configurable: true,
      value: replacement.output,
    });
    setup.fixture.setScreens([replacement.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(3);
    expect(
      layout.snapshot(
        outputId(replacement.output.name),
        desktopId(setup.desktop.id),
      ).columns,
    ).toEqual([
      {
        id: "column:group",
        width: { kind: "fixed", value: 700 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:active",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    const tiledFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    setup.controller.stop();

    for (const [index, window] of setup.windows.entries()) {
      expect(window.window.frameGeometry).toEqual(tiledFrames[index]);
    }
  });

  it("ignores stale topology samples after a stop and restart", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    window.setFrameGeometry({ height: 220, width: 320, x: 220, y: 120 });
    trackedOutput.geometryChanged.emit();
    expect(resumeScheduler.pendingCount).toBe(1);
    const writesBeforeStop = window.writeCount;
    controller.stop();

    expect(window.window.frameGeometry).toEqual({
      height: 220,
      width: 320,
      x: 220,
      y: 120,
    });
    expect(window.writeCount).toBe(writesBeforeStop);
    expect(controller.start()).toBe(true);
    expect(window.window.frameGeometry.x).toBe(210);
    const writesAfterRestart = window.writeCount;

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 300,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    expect(resumeScheduler.pendingCount).toBe(2);

    resumeScheduler.flush();
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    expect(window.window.frameGeometry.x).toBe(210);
    expect(window.writeCount).toBe(writesAfterRestart);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(window.window.frameGeometry.x).toBe(310);
    expect(window.writeCount).toBe(writesAfterRestart + 1);
  });

  it("keeps invalidated restore ownership sticky and restores other outputs", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const second = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 200, width: 300, x: 1100, y: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window],
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
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(first.window.frameGeometry.x).toBe(210);

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 0,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    controller.stop();

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
      y: 100,
    });
  });

  it("keeps restore invalidation sticky across a topology round trip in one barrier", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow("window-1", output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [window.window],
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
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 200,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();

    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 0,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);
    controller.stop();

    expect(window.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
  });

  it("detects silent capacity changes in a visible waiting-only context", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output, otherOutput],
      [desktop],
      [window.window],
    );
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, output: KWinOutput) => ({
        height: 800,
        width: output.name === trackedOutput.output.name ? workAreaWidth : 1000,
        x: output.geometry.x,
        y: output.geometry.y,
      }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 1200 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    expect(controller.managedCount).toBe(0);
    workAreaWidth = 1400;
    controller.probeTopology();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(controller.managedCount).toBe(1);
    expect(window.window.frameGeometry).toEqual({
      height: 780,
      width: 1200,
      x: 10,
      y: 10,
    });
  });

  it("settles a waiting context when client area first becomes available", () => {
    const output = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const fixture = createWorkspace(
      output.output,
      desktop,
      [output.output, otherOutput],
      [desktop],
      [],
    );
    let clientAreaAvailable = true;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, candidate: KWinOutput) => {
        if (!clientAreaAvailable) {
          throw new Error("client area unavailable");
        }

        return {
          height: 800,
          width: 1400,
          x: candidate.geometry.x,
          y: candidate.geometry.y,
        };
      },
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 1200 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    clientAreaAvailable = false;
    const window = createTrackedWindow("window-1", output.output, desktop);
    fixture.windowAdded.emit(window.window);
    expect(controller.managedCount).toBe(0);

    clientAreaAvailable = true;
    controller.probeTopology();
    expect(resumeScheduler.pendingCount).toBe(1);
    expect(workScheduler.pendingCount).toBe(0);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(controller.managedCount).toBe(1);
  });

  it("waits for a waiting-only client area to settle", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output, otherOutput],
      [desktop],
      [window.window],
    );
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => ({ height: 800, width: workAreaWidth, x: 0, y: 0 }),
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 1200 },
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();
    workAreaWidth = 1400;
    resumeScheduler.flush();

    expect(workScheduler.pendingCount).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(1);
    resumeScheduler.flush();
    expect(workScheduler.pendingCount).toBe(1);
    workScheduler.flush();
    expect(controller.managedCount).toBe(1);
  });

  it("ignores unrelated output geometry jitter during a local barrier", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const otherOutput = createTrackedOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
    );
    const second = createTrackedWindow("window-2", otherOutput.output, desktop);
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output, otherOutput.output],
      [desktop],
      [first.window, second.window],
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
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();
    otherOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 1200,
      y: 0,
    });
    resumeScheduler.flush();

    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(1);
    workScheduler.flush();
    expect(first.writeCount).toBe(1);
    expect(second.writeCount).toBe(1);
  });

  it("keeps a transferred owner in the affected topology signature", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output, otherOutput],
      [desktop],
      [window.window],
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
    trackedOutput.geometryChanged.emit();
    Object.defineProperty(window.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    window.outputChanged.emit(trackedOutput.output);
    resumeScheduler.flush();
    window.setFrameGeometry({ height: 220, width: 320, x: 1100, y: 120 });
    resumeScheduler.flush();

    expect(resumeScheduler.pendingCount).toBe(1);

    while (workScheduler.pendingCount > 0) {
      workScheduler.flush();
    }

    resumeScheduler.flush();
    expect(workScheduler.pendingCount).toBe(1);
  });

  it("retains a newer invalidation raised during topology preflight", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const window = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output],
      [desktop],
      [window.window],
    );
    let clientAreaCalls = 0;
    let invalidateOnCall = Number.MAX_SAFE_INTEGER;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: () => {
        clientAreaCalls += 1;

        if (clientAreaCalls === invalidateOnCall) {
          trackedOutput.geometryChanged.emit();
        }

        return {
          height: 800,
          width: 1000,
          x: trackedOutput.output.geometry.x,
          y: 0,
        };
      },
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    trackedOutput.setGeometry({
      height: 800,
      width: 1000,
      x: 100,
      y: 0,
    });
    trackedOutput.geometryChanged.emit();
    resumeScheduler.flush();
    resumeScheduler.flush();
    invalidateOnCall = clientAreaCalls + 3;
    workScheduler.flush();

    expect(window.writeCount).toBe(1);
    expect(resumeScheduler.pendingCount).toBe(1);
    invalidateOnCall = Number.MAX_SAFE_INTEGER;
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(window.window.frameGeometry.x).toBe(110);
    expect(window.writeCount).toBe(2);
  });

  it("restores unrelated outputs when stopped during a local barrier", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const affected = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
      { frameGeometry: { height: 200, width: 300, x: 100, y: 100 } },
    );
    const unaffected = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 220, width: 320, x: 1120, y: 120 },
    });
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output, otherOutput],
      [desktop],
      [affected.window, unaffected.window],
    );
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    const affectedLayout = { ...affected.window.frameGeometry };
    trackedOutput.geometryChanged.emit();
    controller.stop();

    expect(affected.window.frameGeometry).toEqual(affectedLayout);
    expect(unaffected.window.frameGeometry).toEqual({
      height: 220,
      width: 320,
      x: 1120,
      y: 120,
    });
  });

  it("does not restore any output when stopped during a structural barrier", () => {
    const output = createTrackedOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const addedOutput = createOutput("USB-C-1", 2000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output.output, desktop, {
      frameGeometry: { height: 200, width: 300, x: 100, y: 100 },
    });
    const second = createTrackedWindow("window-2", otherOutput, desktop, {
      frameGeometry: { height: 220, width: 320, x: 1120, y: 120 },
    });
    const fixture = createWorkspace(
      output.output,
      desktop,
      [output.output, otherOutput],
      [desktop],
      [first.window, second.window],
    );
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      scheduleResume: resumeScheduler.schedule,
    });

    controller.start();
    const firstLayout = { ...first.window.frameGeometry };
    const secondLayout = { ...second.window.frameGeometry };
    fixture.setScreens([output.output, otherOutput, addedOutput]);
    fixture.screensChanged.emit();
    controller.stop();

    expect(first.window.frameGeometry).toEqual(firstLayout);
    expect(second.window.frameGeometry).toEqual(secondLayout);
  });

  it("merges structural topology in layout order and preserves active capacity", () => {
    const createMergedFixture = (transferOrder: readonly number[]) => {
      const leftOutput = createTrackedOutput("DP-1", 0);
      const rightOutput = createTrackedOutput("HDMI-A-1", 1000);
      const desktop = { id: "desktop-1" };
      const windows = [
        createTrackedWindow("left-a", leftOutput.output, desktop),
        createTrackedWindow("left-b", leftOutput.output, desktop),
        createTrackedWindow("left-c", leftOutput.output, desktop),
        createTrackedWindow("right-a", rightOutput.output, desktop),
        createTrackedWindow("right-b", rightOutput.output, desktop),
        createTrackedWindow("right-c", rightOutput.output, desktop),
      ];
      const fixture = createWorkspace(
        leftOutput.output,
        desktop,
        [leftOutput.output, rightOutput.output],
        [desktop],
        windows.map((window) => window.window),
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
      fixture.workspace.activeWindow = windows[0]?.window ?? null;
      fixture.workspace.activeWindow = windows[5]?.window ?? null;

      for (const index of transferOrder) {
        const transferred = windows[index + 3];

        if (!transferred) {
          throw new Error("invalid topology transfer order");
        }

        Object.defineProperty(transferred.window, "output", {
          configurable: true,
          value: leftOutput.output,
        });
        transferred.outputChanged.emit(rightOutput.output);
      }

      fixture.setScreens([leftOutput.output]);
      fixture.screensChanged.emit();
      flushTopologyRecovery(resumeScheduler, workScheduler);

      return {
        controller,
        fixture,
        leftOutput,
        resumeScheduler,
        rightOutput,
        windows,
        workScheduler,
      };
    };
    const first = createMergedFixture([0, 1, 2]);
    const second = createMergedFixture([2, 0, 1]);
    const frames = (windows: readonly TrackedWindow[]) =>
      windows.map((window) => window.window.frameGeometry);
    const mergedFrames = [
      { height: 780, width: 485, x: -1960, y: 10 },
      { height: 780, width: 485, x: -1465, y: 10 },
      { height: 780, width: 485, x: -970, y: 10 },
      { height: 780, width: 485, x: -475, y: 10 },
      { height: 780, width: 485, x: 20, y: 10 },
      { height: 780, width: 485, x: 515, y: 10 },
    ];

    expect(frames(first.windows)).toEqual(mergedFrames);
    expect(frames(second.windows)).toEqual(mergedFrames);
    expect(first.controller.managedCount).toBe(6);
    expect(first.fixture.workspace.activeWindow).toBe(first.windows[5]?.window);

    for (const index of [3, 4, 5]) {
      const transferred = first.windows[index];

      if (!transferred) {
        throw new Error("missing topology transfer window");
      }

      Object.defineProperty(transferred.window, "output", {
        configurable: true,
        value: first.rightOutput.output,
      });
      transferred.outputChanged.emit(first.leftOutput.output);
    }

    first.fixture.setScreens([
      first.leftOutput.output,
      first.rightOutput.output,
    ]);
    first.fixture.screensChanged.emit();
    flushTopologyRecovery(first.resumeScheduler, first.workScheduler);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      first.resumeScheduler.flush();
    }

    while (first.workScheduler.pendingCount > 0) {
      first.workScheduler.flush();
    }

    expect(first.controller.managedCount).toBe(4);
    expect(first.fixture.workspace.activeWindow).toBe(first.windows[5]?.window);
    expect(first.windows[1]?.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 10,
      y: 10,
    });
    expect(first.windows[2]?.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 505,
      y: 10,
    });
    expect(first.windows[4]?.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 1010,
      y: 10,
    });
    expect(first.windows[5]?.window.frameGeometry).toEqual({
      height: 780,
      width: 485,
      x: 1505,
      y: 10,
    });
  });

  it("preserves global layout order when the earlier output is removed", () => {
    const leftOutput = createTrackedOutput("DP-1", 0);
    const rightOutput = createTrackedOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("left-a", leftOutput.output, desktop),
      createTrackedWindow("left-b", leftOutput.output, desktop),
      createTrackedWindow("right-a", rightOutput.output, desktop),
      createTrackedWindow("right-b", rightOutput.output, desktop),
    ];
    const fixture = createWorkspace(
      rightOutput.output,
      desktop,
      [leftOutput.output, rightOutput.output],
      [desktop],
      windows.map((window) => window.window),
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

    for (const index of [1, 0]) {
      const transferred = windows[index];

      if (!transferred) {
        throw new Error("missing left-output window");
      }

      Object.defineProperty(transferred.window, "output", {
        configurable: true,
        value: rightOutput.output,
      });
      transferred.outputChanged.emit(leftOutput.output);
    }

    fixture.setScreens([rightOutput.output]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      30, 525, 1020, 1515,
    ]);
  });

  it("retains a structural batch when post-recovery sampling restarts the barrier", () => {
    const leftOutput = createTrackedOutput("DP-1", 0);
    const rightOutput = createTrackedOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = [
      createTrackedWindow("left-a", leftOutput.output, desktop),
      createTrackedWindow("left-b", leftOutput.output, desktop),
      createTrackedWindow("right-a", rightOutput.output, desktop),
      createTrackedWindow("right-b", rightOutput.output, desktop),
    ];
    const fixture = createWorkspace(
      rightOutput.output,
      desktop,
      [leftOutput.output, rightOutput.output],
      [desktop],
      windows.map((window) => window.window),
    );
    let armPostRecoveryChange = false;
    let controller: RuntimeController | null = null;
    let workAreaWidth = 1000;
    Object.defineProperty(fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, output: KWinOutput) => {
        const runtimeState = controller as unknown as {
          topologyStabilizing: boolean;
        } | null;

        if (
          armPostRecoveryChange &&
          runtimeState &&
          !runtimeState.topologyStabilizing
        ) {
          armPostRecoveryChange = false;
          workAreaWidth = 900;
        }

        return {
          height: 800,
          width: workAreaWidth,
          x: output.geometry.x,
          y: output.geometry.y,
        };
      },
    });
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });
    controller.start();
    const layout = (
      controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout;
    const unmanageWindows = layout.unmanageWindows.bind(layout);
    const unmanageWindow = layout.unmanageWindow.bind(layout);
    let batchReleaseCount = 0;
    let singleReleaseCount = 0;
    layout.unmanageWindows = (command) => {
      batchReleaseCount += 1;
      return unmanageWindows(command);
    };
    layout.unmanageWindow = (id) => {
      singleReleaseCount += 1;
      return unmanageWindow(id);
    };

    for (const index of [1, 0]) {
      const transferred = windows[index];

      if (!transferred) {
        throw new Error("missing structural transfer window");
      }

      Object.defineProperty(transferred.window, "output", {
        configurable: true,
        value: rightOutput.output,
      });
      transferred.outputChanged.emit(leftOutput.output);
    }

    fixture.setScreens([rightOutput.output]);
    fixture.screensChanged.emit();
    resumeScheduler.flush();
    resumeScheduler.flush();
    armPostRecoveryChange = true;
    workScheduler.flush();

    expect(resumeScheduler.pendingCount).toBe(1);
    expect(batchReleaseCount).toBe(0);
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(
      layout
        .snapshot(outputId(rightOutput.output.name), desktopId(desktop.id))
        .columns.map((column) => column.windowIds[0]),
    ).toEqual(["left-a", "left-b", "right-a", "right-b"]);
    expect(batchReleaseCount).toBe(2);
    expect(singleReleaseCount).toBe(0);
    expect(fixture.workspace.activeWindow).toBe(windows[3]?.window);
  });

  it("moves an active suspended slot during structural recovery", () => {
    const leftOutput = createTrackedOutput("DP-1", 0);
    const rightOutput = createTrackedOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", leftOutput.output, desktop);
    const suspended = createTrackedWindow(
      "window-2",
      rightOutput.output,
      desktop,
      { frameGeometry: { height: 200, width: 300, x: 1100, y: 100 } },
    );
    const fixture = createWorkspace(
      rightOutput.output,
      desktop,
      [leftOutput.output, rightOutput.output],
      [desktop],
      [first.window, suspended.window],
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
    setWindowState("fullscreen", suspended, true);
    workScheduler.flush();
    const suspendedFrame = { ...suspended.window.frameGeometry };
    const suspendedWrites = suspended.writeCount;
    Object.defineProperty(suspended.window, "output", {
      configurable: true,
      value: leftOutput.output,
    });
    suspended.outputChanged.emit(rightOutput.output);
    fixture.setScreens([leftOutput.output]);
    fixture.screensChanged.emit();
    flushTopologyRecovery(resumeScheduler, workScheduler);

    expect(controller.managedCount).toBe(2);
    expect(fixture.workspace.activeWindow).toBe(suspended.window);
    expect(suspended.window.frameGeometry).toEqual(suspendedFrame);
    expect(suspended.writeCount).toBe(suspendedWrites);

    setWindowState("fullscreen", suspended, false);
    workScheduler.flush();
    resumeScheduler.flush();
    workScheduler.flush();

    expect(first.window.frameGeometry.x).toBe(10);
    expect(suspended.window.frameGeometry.x).toBe(505);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(first.window);
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

interface TrackedOutput {
  readonly geometryChanged: Signal<[]>;
  readonly output: KWinOutput;
  readonly scaleChanged: Signal<[]>;
  setGeometry(geometry: KWinOutput["geometry"]): void;
  setScale(scale: number): void;
}

function createTrackedOutput(name: string, x: number): TrackedOutput {
  const geometryChanged = new Signal<[]>();
  const scaleChanged = new Signal<[]>();
  let geometry: KWinOutput["geometry"] = {
    height: 800,
    width: 1000,
    x,
    y: 0,
  };
  let scale = 1;
  const output: KWinOutput = {
    devicePixelRatio: scale,
    geometry,
    geometryChanged,
    name,
    scaleChanged,
  };
  Object.defineProperties(output, {
    devicePixelRatio: {
      configurable: true,
      enumerable: true,
      get: () => scale,
    },
    geometry: {
      configurable: true,
      enumerable: true,
      get: () => geometry,
    },
  });

  return {
    geometryChanged,
    output,
    scaleChanged,
    setGeometry: (nextGeometry) => {
      geometry = nextGeometry;
    },
    setScale: (nextScale) => {
      scale = nextScale;
    },
  };
}

function flushTopologyRecovery(
  resumeScheduler: ManualScheduler,
  workScheduler: ManualScheduler,
): void {
  resumeScheduler.flush();
  resumeScheduler.flush();
  workScheduler.flush();
}

function flushCapacityParking(
  resumeScheduler: ManualScheduler,
  workScheduler: ManualScheduler,
): void {
  resumeScheduler.flush();
  resumeScheduler.flush();
  workScheduler.flush();
}

function runtimeLayout(controller: RuntimeController): LayoutEngine {
  return (
    controller as unknown as {
      layout: LayoutEngine;
    }
  ).layout;
}

function activeColumnWidth(
  controller: RuntimeController,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
): { readonly kind: "fixed" | "proportion"; readonly value: number } | null {
  const snapshot = runtimeLayout(controller).snapshot(
    outputId(output.name),
    desktopId(desktop.id),
  );
  const active = snapshot.columns.find(
    (column) => column.id === snapshot.activeColumnId,
  );

  return active ? { ...active.width } : null;
}

interface TestLayoutColumn {
  readonly id: string;
  readonly width: {
    readonly kind: "fixed" | "proportion";
    readonly value: number;
  };
  readonly windowIds: readonly string[];
}

function installTestLayout(
  controller: RuntimeController,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
  activeColumnId: string,
  columns: readonly TestLayoutColumn[],
): LayoutEngine {
  const layout = new LayoutEngine();
  const restored = layout.restoreColumns({
    activeColumnId: columnId(activeColumnId),
    columns: columns.map((column, index) => ({
      column: {
        id: columnId(column.id),
        width: { ...column.width },
        windowIds: column.windowIds.map((id) => windowId(id)),
      },
      index,
    })),
    desktopId: desktopId(desktop.id),
    outputId: outputId(output.name),
  });

  if (!restored) {
    throw new Error("could not install test layout");
  }

  (
    controller as unknown as {
      layout: LayoutEngine;
    }
  ).layout = layout;
  controller.reconcile();
  return layout;
}

function testLayoutColumns(
  controller: RuntimeController,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
): readonly { readonly id: string; readonly windowIds: readonly string[] }[] {
  return runtimeLayout(controller)
    .snapshot(outputId(output.name), desktopId(desktop.id))
    .columns.map((column) => ({
      id: String(column.id),
      windowIds: column.windowIds.map(String),
    }));
}

function createCapacityFixture(
  windowCount = 3,
  columnWidth?: {
    readonly kind: "fixed" | "proportion";
    readonly value: number;
  },
) {
  const output = createTrackedOutput("DP-1", 0);
  const addedOutput = createTrackedOutput("HDMI-A-1", 1000);
  const desktop = { id: "desktop-1" };
  const windows = Array.from({ length: windowCount }, (_value, index) =>
    createTrackedWindow(`window-${String(index + 1)}`, output.output, desktop, {
      frameGeometry: {
        height: 200 + index,
        width: 300 + index,
        x: 40 + index * 80,
        y: 50 + index * 30,
      },
    }),
  );
  const fixture = createWorkspace(
    output.output,
    desktop,
    [output.output],
    [desktop],
    windows.map((window) => window.window),
  );
  const workScheduler = new ManualScheduler();
  const resumeScheduler = new ManualScheduler();
  const controller = new RuntimeController(fixture.workspace, {
    clientAreaOption: 2,
    ...(columnWidth ? { columnWidth } : {}),
    gap: 10,
    schedule: workScheduler.schedule,
    scheduleResume: resumeScheduler.schedule,
  });

  return {
    addedOutput,
    controller,
    desktop,
    fixture,
    output,
    resumeScheduler,
    windows,
    workScheduler,
  };
}

function installGroupedCapacityLayout(
  controller: RuntimeController,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
): LayoutEngine {
  const layout = new LayoutEngine();

  layout.restoreColumns({
    activeColumnId: columnId("column:active"),
    columns: [
      {
        column: {
          id: columnId("column:group"),
          width: { kind: "fixed", value: 700 },
          windowIds: [windowId("window-1"), windowId("window-2")],
        },
        index: 0,
      },
      {
        column: {
          id: columnId("column:active"),
          width: { kind: "fixed", value: 300 },
          windowIds: [windowId("window-3")],
        },
        index: 1,
      },
    ],
    desktopId: desktopId(desktop.id),
    outputId: outputId(output.name),
  });
  (
    controller as unknown as {
      layout: LayoutEngine;
    }
  ).layout = layout;
  return layout;
}
