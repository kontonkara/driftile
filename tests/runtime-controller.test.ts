import { describe, expect, it } from "vitest";
import {
  columnId,
  desktopId,
  outputId,
  windowId,
  type WindowId,
} from "../src/core/ids";
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
  readonly desktopWriteCount: number;
  readonly desktopsChanged: Signal<[]>;
  readonly frameGeometryChanged: Signal<
    [oldGeometry: KWinWindow["frameGeometry"]]
  >;
  readonly fullScreenChanged: Signal<[]>;
  readonly hiddenChanged: Signal<[]>;
  readonly interactiveMoveResizeFinished: Signal<[]>;
  readonly maximizedAboutToChange: Signal<[mode: number]>;
  readonly maximizeableChanged: Signal<[maximizeable: boolean]>;
  readonly maximizedChanged: Signal<[]>;
  readonly minimizedChanged: Signal<[]>;
  readonly modalChanged: Signal<[]>;
  readonly moveResizedChanged: Signal<[]>;
  readonly outputChanged: Signal<[oldOutput?: KWinOutput | null]>;
  readonly requestedTileChanged: Signal<[]>;
  setFrameGeometry(frame: KWinWindow["frameGeometry"]): void;
  setOutput(output: KWinOutput): void;
  setDesktopWriteBehavior(
    behavior:
      | ((desktops: readonly KWinVirtualDesktop[], commit: () => void) => void)
      | null,
  ): void;
  setWriteBehavior(
    behavior:
      ((frame: KWinWindow["frameGeometry"], commit: () => void) => void) | null,
  ): void;
  readonly tileChanged: Signal<[tile: object | null]>;
  readonly transientChanged: Signal<[]>;
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
  const initialFrameGeometry = overrides.frameGeometry ?? {
    height: 200,
    width: 300,
    x: 0,
    y: 0,
  };
  const initialClientGeometry =
    overrides.clientGeometry ?? initialFrameGeometry;
  let frameGeometry = initialFrameGeometry;
  let desktopWriteCount = 0;
  let desktopWriteBehavior:
    | ((desktops: readonly KWinVirtualDesktop[], commit: () => void) => void)
    | null = null;
  const interactiveMoveResizeFinished = new Signal<[]>();
  const maximizedAboutToChange = new Signal<[mode: number]>();
  const maximizeableChanged = new Signal<[maximizeable: boolean]>();
  const maximizedChanged = new Signal<[]>();
  const minimizedChanged = new Signal<[]>();
  const modalChanged = new Signal<[]>();
  const moveResizedChanged = new Signal<[]>();
  const outputChanged = new Signal<[oldOutput?: KWinOutput | null]>();
  const requestedTileChanged = new Signal<[]>();
  const tileChanged = new Signal<[tile: object | null]>();
  const transientChanged = new Signal<[]>();
  let writeCount = 0;
  let writeBehavior:
    ((frame: KWinWindow["frameGeometry"], commit: () => void) => void) | null =
    null;
  const window: KWinWindow = {
    clientGeometry: initialClientGeometry,
    deleted: false,
    desktops: [desktop],
    desktopsChanged,
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: initialFrameGeometry,
    frameGeometryChanged,
    fullScreen: false,
    fullScreenChanged,
    hiddenChanged,
    internalId: id,
    interactiveMoveResizeFinished,
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizedAboutToChange,
    maximizeableChanged,
    maximizedChanged,
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    minimizedChanged,
    modal: false,
    modalChanged,
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
    transient: false,
    transientChanged,
    transientFor: null,
    ...overrides,
  };
  frameGeometry = window.frameGeometry;
  const clientOffsetX = initialClientGeometry.x - frameGeometry.x;
  const clientOffsetY = initialClientGeometry.y - frameGeometry.y;
  const horizontalDecoration =
    frameGeometry.width - initialClientGeometry.width;
  const verticalDecoration =
    frameGeometry.height - initialClientGeometry.height;
  let windowDesktops = window.desktops;
  Object.defineProperty(window, "clientGeometry", {
    configurable: true,
    enumerable: true,
    get: () => ({
      height: frameGeometry.height - verticalDecoration,
      width: frameGeometry.width - horizontalDecoration,
      x: frameGeometry.x + clientOffsetX,
      y: frameGeometry.y + clientOffsetY,
    }),
  });
  Object.defineProperty(window, "desktops", {
    configurable: true,
    enumerable: true,
    get: () => windowDesktops,
    set: (value: readonly KWinVirtualDesktop[]) => {
      desktopWriteCount += 1;
      const commit = (): void => {
        windowDesktops = value;
        desktopsChanged.emit();
      };

      if (desktopWriteBehavior) {
        desktopWriteBehavior(value, commit);
      } else {
        commit();
      }
    },
  });
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
    get desktopWriteCount() {
      return desktopWriteCount;
    },
    desktopsChanged,
    frameGeometryChanged,
    get writeCount() {
      return writeCount;
    },
    fullScreenChanged,
    hiddenChanged,
    interactiveMoveResizeFinished,
    maximizedAboutToChange,
    maximizeableChanged,
    maximizedChanged,
    minimizedChanged,
    modalChanged,
    moveResizedChanged,
    outputChanged,
    requestedTileChanged,
    setDesktopWriteBehavior: (behavior) => {
      desktopWriteBehavior = behavior;
    },
    setFrameGeometry: (frame) => {
      frameGeometry = frame;
    },
    setOutput: (output) => {
      const previous = window.output;
      Object.defineProperty(window, "output", {
        configurable: true,
        enumerable: true,
        value: output,
      });
      outputChanged.emit(previous);
    },
    setWriteBehavior: (behavior) => {
      writeBehavior = behavior;
    },
    tileChanged,
    transientChanged,
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
  readonly desktopSwitchCount: number;
  readonly outputTransferCount: number;
  readonly screensChanged: Signal<[]>;
  setCurrentDesktop(output: KWinOutput, desktop: KWinVirtualDesktop): void;
  setDesktopSwitchBehavior(
    behavior:
      | ((
          desktop: KWinVirtualDesktop,
          output: KWinOutput,
          commit: () => void,
        ) => void)
      | null,
  ): void;
  setOutputTransferBehavior(
    behavior:
      | ((window: KWinWindow, output: KWinOutput, commit: () => void) => void)
      | null,
  ): void;
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
  let desktopSwitchCount = 0;
  let outputTransferCount = 0;
  let desktopSwitchBehavior:
    | ((
        desktop: KWinVirtualDesktop,
        output: KWinOutput,
        commit: () => void,
      ) => void)
    | null = null;
  let outputTransferBehavior:
    | ((window: KWinWindow, output: KWinOutput, commit: () => void) => void)
    | null = null;
  let activeWindow = windows[windows.length - 1] ?? null;
  let currentDesktop = activeDesktop;
  let currentOutputs = [...outputs];
  const currentDesktops = new Map(
    outputs.map((output) => [output.name, activeDesktop]),
  );
  const commitDesktop = (
    output: KWinOutput,
    desktop: KWinVirtualDesktop,
    perOutput: boolean,
  ): void => {
    const previous = perOutput
      ? (currentDesktops.get(output.name) ?? null)
      : currentDesktop;

    if (perOutput) {
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

    if (perOutput) {
      currentDesktopChanged.emit(previous, desktop, output);
    } else {
      currentDesktopChanged.emit(previous);
    }
  };
  const requestDesktopSwitch = (
    desktop: KWinVirtualDesktop,
    output: KWinOutput,
    perOutput: boolean,
  ): void => {
    desktopSwitchCount += 1;
    const commit = (): void => {
      commitDesktop(output, desktop, perOutput);
    };

    if (desktopSwitchBehavior) {
      desktopSwitchBehavior(desktop, output, commit);
    } else {
      commit();
    }
  };
  const desktopResolver = perOutputDesktops
    ? {
        currentDesktopForScreen: (output: KWinOutput) =>
          currentDesktops.get(output.name) ?? null,
        setCurrentDesktopForScreen: (
          desktop: KWinVirtualDesktop,
          output: KWinOutput,
        ) => {
          requestDesktopSwitch(desktop, output, true);
        },
      }
    : {};
  const sendClientToScreen = (window: KWinWindow, output: KWinOutput): void => {
    outputTransferCount += 1;
    const commit = (): void => {
      const previous = window.output;
      Object.defineProperty(window, "output", {
        configurable: true,
        enumerable: true,
        value: output,
      });

      if (window.outputChanged instanceof Signal) {
        window.outputChanged.emit(previous);
      }
    };

    if (outputTransferBehavior) {
      outputTransferBehavior(window, output, commit);
    } else {
      commit();
    }
  };
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
    sendClientToScreen,
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
    set: (desktop: KWinVirtualDesktop | null) => {
      if (desktop) {
        requestDesktopSwitch(desktop, activeOutput, false);
      }
    },
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
    get desktopSwitchCount() {
      return desktopSwitchCount;
    },
    get outputTransferCount() {
      return outputTransferCount;
    },
    screensChanged,
    setCurrentDesktop: (output, desktop) => {
      commitDesktop(output, desktop, perOutputDesktops);
    },
    setDesktopSwitchBehavior: (behavior) => {
      desktopSwitchBehavior = behavior;
    },
    setOutputTransferBehavior: (behavior) => {
      outputTransferBehavior = behavior;
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
  it("leaves automatic-floating window classes exclusively to KWin", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const regular = createTrackedWindow("regular", output, desktop);
    const transientParent = createTrackedWindow("parent", output, desktop);
    const dialog = createTrackedWindow("dialog", output, desktop, {
      dialog: true,
      normalWindow: false,
    });
    const transient = createTrackedWindow("transient", output, desktop, {
      transient: true,
    });
    const transientFor = createTrackedWindow("transient-for", output, desktop, {
      transientFor: transientParent.window,
    });
    const modal = createTrackedWindow("modal", output, desktop, {
      modal: true,
    });
    const nonResizeable = createTrackedWindow(
      "non-resizeable",
      output,
      desktop,
      { resizeable: false },
    );
    const fixed = createTrackedWindow("fixed", output, desktop, {
      clientGeometry: { height: 180, width: 280, x: 10, y: 10 },
      frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
      maxSize: { height: 180, width: 280 },
      minSize: { height: 180, width: 280 },
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [
        regular.window,
        transientParent.window,
        dialog.window,
        transient.window,
        transientFor.window,
        modal.window,
        nonResizeable.window,
        fixed.window,
      ],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });
    const automatic = [
      dialog,
      transient,
      transientFor,
      modal,
      nonResizeable,
      fixed,
    ];
    const originalFrames = automatic.map(({ window }) => ({
      ...window.frameGeometry,
    }));

    expect(controller.start()).toBe(true);
    expect(controller.managedCount).toBe(2);
    expect(controller.floatingCount).toBe(0);
    expect(controller.automaticFloatingCount).toBe(6);
    expect(automatic.map(({ writeCount }) => writeCount)).toEqual(
      automatic.map(() => 0),
    );
    expect(automatic.map(({ window }) => window.frameGeometry)).toEqual(
      originalFrames,
    );

    const activationCount = fixture.activationCount;
    const desktopSwitchCount = fixture.desktopSwitchCount;
    const outputTransferCount = fixture.outputTransferCount;
    const desktopWriteCount = fixed.desktopWriteCount;
    const commands = [
      () => controller.focusLeft(),
      () => controller.focusRight(),
      () => controller.focusUp(),
      () => controller.focusDown(),
      () => controller.moveColumnLeft(),
      () => controller.moveColumnRight(),
      () => controller.moveWindowLeft(),
      () => controller.moveWindowRight(),
      () => controller.moveWindowUp(),
      () => controller.moveWindowDown(),
      () => controller.insertWindowIntoStackLeft(),
      () => controller.insertWindowIntoStackRight(),
      () => controller.toggleFloating(),
      () => controller.moveWindowToPreviousDesktop(),
      () => controller.moveWindowToNextDesktop(),
      () => controller.moveWindowToOutputLeft(),
      () => controller.moveWindowToOutputRight(),
      () => controller.moveWindowToOutputUp(),
      () => controller.moveWindowToOutputDown(),
      () => controller.decreaseColumnWidth(),
      () => controller.increaseColumnWidth(),
      () => controller.resetColumnWidth(),
    ];

    expect(commands.map((command) => command())).toEqual(
      commands.map(() => false),
    );
    expect(fixture.activationCount).toBe(activationCount);
    expect(fixture.desktopSwitchCount).toBe(desktopSwitchCount);
    expect(fixture.outputTransferCount).toBe(outputTransferCount);
    expect(fixed.desktopWriteCount).toBe(desktopWriteCount);
    expect(automatic.map(({ writeCount }) => writeCount)).toEqual(
      automatic.map(() => 0),
    );
  });

  it("releases a late transient without restoring its stale baseline", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 4 }, (_, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const becomingTransient = windows[1];

    if (!becomingTransient) {
      throw new Error("missing transient fixture");
    }

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 400 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    const layout = runtimeLayout(controller);
    fixture.workspace.activeWindow = becomingTransient.window;
    layout.setViewportOffset(outputId(output.name), desktopId(desktop.id), 100);
    scheduler.flush();
    const tiledFrame = { ...becomingTransient.window.frameGeometry };
    const tiledWrites = becomingTransient.writeCount;
    Object.defineProperty(becomingTransient.window, "transient", {
      configurable: true,
      value: true,
    });
    becomingTransient.transientChanged.emit();

    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(3);
    expect(controller.floatingCount).toBe(0);
    expect(becomingTransient.window.frameGeometry).toEqual(tiledFrame);
    expect(becomingTransient.writeCount).toBe(tiledWrites);
    expect(
      layout
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.map((column) => [column.width, column.windowIds]),
    ).toEqual([
      [{ kind: "fixed", value: 400 }, [windowId("window-1")]],
      [{ kind: "fixed", value: 400 }, [windowId("window-3")]],
      [{ kind: "fixed", value: 400 }, [windowId("window-4")]],
    ]);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id))
        .viewportOffset,
    ).toBe(100);

    fixture.workspace.activeWindow = becomingTransient.window;
    const layoutBeforeCommands = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(controller.focusLeft()).toBe(false);
    expect(controller.moveWindowRight()).toBe(false);
    expect(controller.toggleFloating()).toBe(false);
    expect(controller.increaseColumnWidth()).toBe(false);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(layoutBeforeCommands);
    expect(becomingTransient.writeCount).toBe(tiledWrites);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(becomingTransient.writeCount).toBe(tiledWrites);
    Object.defineProperty(becomingTransient.window, "transient", {
      configurable: true,
      value: false,
    });
    becomingTransient.transientChanged.emit();
    expect(controller.automaticFloatingCount).toBe(0);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.managedCount).toBe(4);
    expect(controller.floatingCount).toBe(0);
    const readmittedId = windowId("window-2");
    const state = controller as unknown as {
      readonly capacityCanceledParks: ReadonlyMap<string, unknown>;
      readonly capacityLeaseByWindow: ReadonlyMap<WindowId, unknown>;
      readonly capacityParkOperations: ReadonlyMap<string, unknown>;
      readonly capacitySupersededParkWindows: ReadonlySet<WindowId>;
      readonly pendingWindowSyncs: ReadonlySet<WindowId>;
      readonly requestedSuspensions: ReadonlyMap<WindowId, unknown>;
      readonly resumeSamples: ReadonlyMap<WindowId, unknown>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly transientResumeProbes: ReadonlyMap<WindowId, unknown>;
      readonly waitingWindowContexts: ReadonlyMap<WindowId, string>;
    };
    expect(state.capacityCanceledParks.size).toBe(0);
    expect(state.capacityLeaseByWindow.has(readmittedId)).toBe(false);
    expect(state.capacityParkOperations.size).toBe(0);
    expect(state.capacitySupersededParkWindows.has(readmittedId)).toBe(false);
    expect(state.pendingWindowSyncs.has(readmittedId)).toBe(false);
    expect(state.requestedSuspensions.has(readmittedId)).toBe(false);
    expect(state.resumeSamples.has(readmittedId)).toBe(false);
    expect(state.suspendedWindows.has(readmittedId)).toBe(false);
    expect(state.transientResumeProbes.has(readmittedId)).toBe(false);
    expect(state.waitingWindowContexts.has(readmittedId)).toBe(false);
  });

  it("drops manual-floating ownership when a window becomes modal", () => {
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
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    const floatingFrame = { ...window.window.frameGeometry };
    const floatingWrites = window.writeCount;
    Object.defineProperty(window.window, "modal", {
      configurable: true,
      value: true,
    });
    window.modalChanged.emit();

    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.floatingCount).toBe(0);
    expect(controller.managedCount).toBe(0);
    expect(window.window.frameGeometry).toEqual(floatingFrame);
    expect(window.writeCount).toBe(floatingWrites);
    expect(controller.toggleFloating()).toBe(false);
  });

  it("never creates suspension or bounded retry state for automatic floating", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const automatic = createTrackedWindow("window-1", output, desktop, {
      resizeable: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [automatic.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });
    const state = controller as unknown as {
      readonly capacityCanceledParks: ReadonlyMap<string, unknown>;
      readonly capacityLeaseByWindow: ReadonlyMap<WindowId, unknown>;
      readonly capacityParkOperations: ReadonlyMap<string, unknown>;
      readonly capacitySupersededParkWindows: ReadonlySet<WindowId>;
      readonly pendingWindowSyncs: ReadonlySet<WindowId>;
      readonly requestedSuspensions: ReadonlyMap<WindowId, ReadonlySet<string>>;
      readonly resumeSamples: ReadonlyMap<WindowId, unknown>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly transientResumeProbes: ReadonlyMap<WindowId, unknown>;
      readonly waitingWindowContexts: ReadonlyMap<WindowId, string>;
    };
    const id = windowId("window-1");

    controller.start();
    setWindowState("maximized", automatic, true);
    setWindowState("maximized", automatic, false);
    setWindowState("native tiled", automatic, true);
    setWindowState("native tiled", automatic, false);
    automatic.desktopsChanged.emit();
    automatic.outputChanged.emit();

    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(state.capacityCanceledParks.size).toBe(0);
    expect(state.capacityLeaseByWindow.has(id)).toBe(false);
    expect(state.capacityParkOperations.size).toBe(0);
    expect(state.capacitySupersededParkWindows.has(id)).toBe(false);
    expect(state.pendingWindowSyncs.has(id)).toBe(false);
    expect(state.requestedSuspensions.has(id)).toBe(false);
    expect(state.resumeSamples.has(id)).toBe(false);
    expect(state.suspendedWindows.has(id)).toBe(false);
    expect(state.transientResumeProbes.has(id)).toBe(false);
    expect(state.waitingWindowContexts.has(id)).toBe(false);
    expect(workScheduler.pendingCount).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(automatic.writeCount).toBe(0);

    fixture.windowRemoved.emit(automatic.window);
    expect(controller.automaticFloatingCount).toBe(0);
    expect(state.capacityCanceledParks.size).toBe(0);
    expect(state.capacityLeaseByWindow.has(id)).toBe(false);
    expect(state.capacityParkOperations.size).toBe(0);
    expect(state.capacitySupersededParkWindows.has(id)).toBe(false);
    expect(state.pendingWindowSyncs.has(id)).toBe(false);
    expect(state.requestedSuspensions.has(id)).toBe(false);
    expect(state.resumeSamples.has(id)).toBe(false);
    expect(state.suspendedWindows.has(id)).toBe(false);
    expect(state.transientResumeProbes.has(id)).toBe(false);
    expect(state.waitingWindowContexts.has(id)).toBe(false);
    expect(workScheduler.pendingCount).toBe(0);
    expect(resumeScheduler.pendingCount).toBe(0);
  });

  it("reclassifies fixed-size constraints on notification and safely reads them back", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const changing = createTrackedWindow("window-2", output, desktop);
    const third = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, changing.window, third.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });
    const id = windowId("window-2");

    controller.start();
    const tiledFrame = { ...changing.window.frameGeometry };
    const tiledWrites = changing.writeCount;
    const client = changing.window.clientGeometry;
    Object.defineProperties(changing.window, {
      maxSize: {
        configurable: true,
        value: { height: client.height, width: client.width },
      },
      minSize: {
        configurable: true,
        value: { height: client.height, width: client.width },
      },
    });
    changing.maximizeableChanged.emit(false);

    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(2);
    expect(changing.window.frameGeometry).toEqual(tiledFrame);
    expect(changing.writeCount).toBe(tiledWrites);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(changing.writeCount).toBe(tiledWrites);
    Object.defineProperties(changing.window, {
      maxSize: {
        configurable: true,
        value: { height: 10_000, width: 10_000 },
      },
      minSize: {
        configurable: true,
        value: { height: 1, width: 1 },
      },
    });
    changing.maximizeableChanged.emit(true);
    expect(controller.automaticFloatingCount).toBe(0);
    expect(controller.managedCount).toBe(2);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.managedCount).toBe(3);
    expect(controller.floatingCount).toBe(0);
    expectAutomaticOwnershipBookkeepingClear(controller, id);
  });

  it("fails closed on silent resizeability changes at reconcile boundaries", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const changing = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, changing.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    const tiledFrame = { ...changing.window.frameGeometry };
    const tiledWrites = changing.writeCount;
    Object.defineProperty(changing.window, "resizeable", {
      configurable: true,
      value: false,
    });

    controller.reconcile();
    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(changing.window.frameGeometry).toEqual(tiledFrame);
    expect(changing.writeCount).toBe(tiledWrites);

    Object.defineProperty(changing.window, "resizeable", {
      configurable: true,
      value: true,
    });
    controller.reconcile();

    expect(controller.automaticFloatingCount).toBe(0);
    expect(controller.managedCount).toBe(2);
    expect(controller.floatingCount).toBe(0);
    expectAutomaticOwnershipBookkeepingClear(controller, windowId("window-2"));
  });

  it.each([
    {
      enter: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "fullScreen", {
          configurable: true,
          value: true,
        });
        window.fullScreenChanged.emit();
      },
      exit: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "fullScreen", {
          configurable: true,
          value: false,
        });
        window.fullScreenChanged.emit();
      },
      name: "fullscreen",
    },
    {
      enter: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "maximizeMode", {
          configurable: true,
          value: 3,
        });
        window.maximizedChanged.emit();
      },
      exit: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "maximizeMode", {
          configurable: true,
          value: 0,
        });
        window.maximizedChanged.emit();
      },
      name: "maximized",
    },
    {
      enter: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "tile", {
          configurable: true,
          value: {},
        });
        window.tileChanged.emit(window.window.tile);
      },
      exit: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "tile", {
          configurable: true,
          value: null,
        });
        window.tileChanged.emit(null);
      },
      name: "native tiled",
    },
    {
      enter: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "move", {
          configurable: true,
          value: true,
        });
        window.moveResizedChanged.emit();
      },
      exit: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "move", {
          configurable: true,
          value: false,
        });
        window.moveResizedChanged.emit();
      },
      name: "interactive move",
    },
    {
      enter: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "resize", {
          configurable: true,
          value: true,
        });
        window.moveResizedChanged.emit();
      },
      exit: (window: TrackedWindow) => {
        Object.defineProperty(window.window, "resize", {
          configurable: true,
          value: false,
        });
        window.moveResizedChanged.emit();
      },
      name: "interactive resize",
    },
  ])(
    "preserves the managed slot when $name temporarily disables resizing",
    ({ enter, exit, name }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const first = createTrackedWindow("window-1", output, desktop);
      const blocked = createTrackedWindow("window-2", output, desktop);
      const third = createTrackedWindow("window-3", output, desktop);
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [first.window, blocked.window, third.window],
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
      const before = testLayoutColumns(controller, output, desktop);
      Object.defineProperty(blocked.window, "resizeable", {
        configurable: true,
        value: false,
      });
      enter(blocked);

      if (name === "fullscreen") {
        Object.defineProperty(blocked.window, "clientGeometry", {
          configurable: true,
          get: () => ({
            ...blocked.window.frameGeometry,
            width: blocked.window.frameGeometry.width + 10,
          }),
        });
      }

      blocked.maximizeableChanged.emit(false);
      expect(controller.automaticFloatingCount).toBe(0);
      expect(controller.managedCount).toBe(3);
      expect(testLayoutColumns(controller, output, desktop)).toEqual(before);

      if (name === "fullscreen") {
        Object.defineProperty(blocked.window, "clientGeometry", {
          configurable: true,
          get: () => ({ ...blocked.window.frameGeometry }),
        });
      }

      Object.defineProperty(blocked.window, "resizeable", {
        configurable: true,
        value: true,
      });
      exit(blocked);
      blocked.maximizeableChanged.emit(true);

      for (
        let attempt = 0;
        attempt < 50 && scheduler.pendingCount > 0;
        attempt += 1
      ) {
        scheduler.flush();
      }

      expect(scheduler.pendingCount).toBe(0);
      expect(controller.automaticFloatingCount).toBe(0);
      expect(controller.managedCount).toBe(3);
      expect(testLayoutColumns(controller, output, desktop)).toEqual(before);
    },
  );

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

  it("resizes columns with client constraints translated to frame bounds", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop, {
      clientGeometry: { height: 180, width: 280, x: 10, y: 10 },
      frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
      maxSize: { height: 10_000, width: 350 },
      minSize: { height: 1, width: 250 },
    });
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
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(364);
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(370);
    expect(controller.increaseColumnWidth()).toBe(false);

    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(306);
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(270);
    expect(controller.decreaseColumnWidth()).toBe(false);
  });

  it("never restores an automatically released slot after a column write", () => {
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
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    fixture.workspace.activeWindow = first.window;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const secondWrites = second.writeCount;
    first.setWriteBehavior((_frame, commit) => {
      first.setWriteBehavior(null);
      commit();
      Object.defineProperty(second.window, "transient", {
        configurable: true,
        value: true,
      });
      second.transientChanged.emit();
    });

    expect(controller.increaseColumnWidth()).toBe(false);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(second.writeCount).toBe(secondWrites);
    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(controller.floatingCount).toBe(0);
    expect(
      runtimeLayout(controller)
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.flatMap((column) => column.windowIds),
    ).toEqual([windowId("window-1")]);
    expectAutomaticOwnershipBookkeepingClear(controller, windowId("window-2"));
  });

  it("filters automatic ownership from floating transition compensation", () => {
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
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    const layout = new LayoutEngine();
    layout.restoreColumns({
      activeColumnId: columnId("column:stack"),
      columns: [
        {
          column: {
            id: columnId("column:stack"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
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
    const secondWrites = second.writeCount;
    first.setWriteBehavior((_frame, commit) => {
      first.setWriteBehavior(null);
      commit();
      Object.defineProperty(second.window, "transient", {
        configurable: true,
        value: true,
      });
      second.transientChanged.emit();
    });

    expect(controller.toggleFloating()).toBe(false);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(second.writeCount).toBe(secondWrites);
    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.managedCount).toBe(1);
    expect(controller.floatingCount).toBe(0);
    expect(
      layout
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.flatMap((column) => column.windowIds),
    ).toEqual([windowId("window-1")]);
    expectAutomaticOwnershipBookkeepingClear(controller, windowId("window-2"));
  });

  it("reflows after a column write releases an unchanged middle window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const [first, released, active] = windows;

    if (!first || !released || !active) {
      throw new Error("missing column reflow fixture");
    }

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    const releasedWrites = released.writeCount;
    const activeX = active.window.frameGeometry.x;
    active.setWriteBehavior((_frame, commit) => {
      active.setWriteBehavior(null);
      commit();
      Object.defineProperty(released.window, "transient", {
        configurable: true,
        value: true,
      });
      released.transientChanged.emit();
    });

    expect(controller.increaseColumnWidth()).toBe(false);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(released.writeCount).toBe(releasedWrites);
    expect(active.window.frameGeometry.x).toBeLessThan(activeX);
    expect(controller.automaticFloatingCount).toBe(1);
    expect(
      runtimeLayout(controller)
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.flatMap((column) => column.windowIds),
    ).toEqual([windowId("window-1"), windowId("window-3")]);
  });

  it("reflows after a floating write releases an unchanged adjacent window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const released = createTrackedWindow("window-3", output, desktop);
    const trailing = createTrackedWindow("window-4", output, desktop);
    const active = createTrackedWindow("window-2", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, released.window, trailing.window, active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    const layout = new LayoutEngine();
    layout.restoreColumns({
      activeColumnId: columnId("column:stack"),
      columns: [
        {
          column: {
            id: columnId("column:stack"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-1"), windowId("window-2")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column:released"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-3")],
          },
          index: 1,
        },
        {
          column: {
            id: columnId("column:trailing"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("window-4")],
          },
          index: 2,
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
    const releasedWrites = released.writeCount;
    const trailingX = trailing.window.frameGeometry.x;
    first.setWriteBehavior((_frame, commit) => {
      first.setWriteBehavior(null);
      commit();
      Object.defineProperty(released.window, "transient", {
        configurable: true,
        value: true,
      });
      released.transientChanged.emit();
    });

    expect(controller.toggleFloating()).toBe(false);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(released.writeCount).toBe(releasedWrites);
    expect(trailing.window.frameGeometry.x).toBeLessThan(trailingX);
    expect(controller.automaticFloatingCount).toBe(1);
    expect(controller.floatingCount).toBe(0);
    expect(
      layout
        .snapshot(outputId(output.name), desktopId(desktop.id))
        .columns.flatMap((column) => column.windowIds),
    ).toEqual([
      windowId("window-1"),
      windowId("window-2"),
      windowId("window-4"),
    ]);
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

  it("keeps live ownership classification linear during reconcile writes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windowCount = 96;
    let classificationReads = 0;
    const windows = Array.from({ length: windowCount }, (_, index) => {
      const tracked = createTrackedWindow(
        `window-${String(index)}`,
        output,
        desktop,
      );
      Object.defineProperty(tracked.window, "transient", {
        configurable: true,
        get: () => {
          classificationReads += 1;
          return false;
        },
      });
      return tracked;
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    classificationReads = 0;

    for (const window of windows) {
      window.setFrameGeometry({
        ...window.window.frameGeometry,
        x: window.window.frameGeometry.x + 1,
      });
    }

    expect(controller.reconcile()).toBe(windowCount);
    expect(classificationReads).toBeGreaterThanOrEqual(windowCount);
    expect(classificationReads).toBeLessThanOrEqual(windowCount * 8);
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

describe("RuntimeController desktop transfers", () => {
  it("creates an empty destination context without writing the hidden source", () => {
    const output = createOutput("DP-1", 0);
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
    const source = createTrackedWindow("source", output, desktops[0]);
    const moved = createTrackedWindow("moved", output, desktops[0]);
    const fixture = createWorkspace(output, desktops[0], [output], desktops, [
      source.window,
      moved.window,
    ]);
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    const sourceWrites = source.writeCount;
    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(source.writeCount).toBe(sourceWrites);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      { id: "column:source", windowIds: ["source"] },
    ]);
    expect(testLayoutColumns(controller, output, desktops[1])).toEqual([
      { id: "column:moved", windowIds: ["moved"] },
    ]);
    expect(controller.managedCount).toBe(2);
  });

  it("moves in both directions without wrapping and follows the window", () => {
    const { controller, desktops, fixture, moved, output } =
      createDesktopTransferFixture();

    expect(controller.moveWindowToPreviousDesktop()).toBe(false);
    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(moved.window.desktops).toEqual([desktops[1]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[1],
    );
    expect(fixture.workspace.activeWindow).toBe(moved.window);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      { id: "column:source", windowIds: ["source"] },
    ]);
    expect(testLayoutColumns(controller, output, desktops[1])).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(controller.moveWindowToPreviousDesktop()).toBe(true);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[0],
    );
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      { id: "column:source", windowIds: ["source"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
  });

  it("extracts a stack member and returns it after the surviving active column", () => {
    const {
      controller,
      destination,
      desktops,
      fixture,
      moved,
      output,
      source,
    } = createDesktopTransferFixture();
    const trailing = createTrackedWindow("trailing", output, desktops[0]);
    fixture.windowAdded.emit(trailing.window);
    const layout = new LayoutEngine();

    layout.restoreColumns({
      activeColumnId: columnId("column:stack"),
      columns: [
        {
          column: {
            id: columnId("column:stack"),
            width: { kind: "fixed", value: 620 },
            windowIds: [windowId("source"), windowId("moved")],
          },
          index: 0,
        },
        {
          column: {
            id: columnId("column:trailing"),
            width: { kind: "fixed", value: 300 },
            windowIds: [windowId("trailing")],
          },
          index: 1,
        },
      ],
      desktopId: desktopId(desktops[0].id),
      outputId: outputId(output.name),
    });
    layout.restoreColumns({
      activeColumnId: columnId("column:destination"),
      columns: [
        {
          column: {
            id: columnId("column:destination"),
            width: { kind: "fixed", value: 280 },
            windowIds: [windowId("destination")],
          },
          index: 0,
        },
      ],
      desktopId: desktopId(desktops[1].id),
      outputId: outputId(output.name),
    });
    (
      controller as unknown as {
        layout: LayoutEngine;
      }
    ).layout = layout;
    fixture.workspace.activeWindow = moved.window;
    controller.reconcile();

    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(
      runtimeLayout(controller)
        .snapshot(outputId(output.name), desktopId(desktops[1].id))
        .columns.map((column) => [column.width, column.windowIds]),
    ).toEqual([
      [{ kind: "fixed", value: 280 }, [destination.window.internalId]],
      [{ kind: "fixed", value: 620 }, [moved.window.internalId]],
    ]);
    expect(controller.moveWindowToPreviousDesktop()).toBe(true);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      { id: "column:stack", windowIds: [String(source.window.internalId)] },
      { id: "column:moved", windowIds: [String(moved.window.internalId)] },
      {
        id: "column:trailing",
        windowIds: [String(trailing.window.internalId)],
      },
    ]);
  });

  it("commits the solved destination viewport when insertion needs reveal", () => {
    const transfer = createDesktopTransferFixture({ destinationCount: 3 });
    const layout = runtimeLayout(transfer.controller);
    layout.activateWindow(windowId("destination-3"));

    expect(transfer.controller.moveWindowToNextDesktop()).toBe(true);
    const target = layout.snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[1].id),
    );
    expect(target.viewportOffset).toBeGreaterThan(0);
    expect(target.columns.map((column) => column.windowIds[0])).toEqual([
      "destination",
      "destination-2",
      "destination-3",
      "moved",
    ]);
    expect(transfer.moved.window.frameGeometry.x).toBeGreaterThanOrEqual(0);
    expect(
      transfer.moved.window.frameGeometry.x +
        transfer.moved.window.frameGeometry.width,
    ).toBeLessThanOrEqual(1000);
  });

  it("switches only the active output when the per-output API is available", () => {
    const { controller, desktops, fixture, output } =
      createDesktopTransferFixture();
    const otherOutput = createOutput("HDMI-A-1", 1000);
    fixture.setScreens([output, otherOutput]);
    fixture.setCurrentDesktop(otherOutput, desktops[0]);

    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[1],
    );
    expect(fixture.workspace.currentDesktopForScreen?.(otherOutput)).toBe(
      desktops[0],
    );
    expect(fixture.desktopSwitchCount).toBe(1);
  });

  it("uses the global desktop fallback and leaves unrelated layouts intact", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
    const source = createTrackedWindow("source", output, desktops[0]);
    const moved = createTrackedWindow("moved", output, desktops[0]);
    const unrelated = createTrackedWindow(
      "unrelated",
      otherOutput,
      desktops[1],
      { frameGeometry: { height: 220, width: 320, x: 1120, y: 120 } },
    );
    const fixture = createWorkspace(
      output,
      desktops[0],
      [output, otherOutput],
      desktops,
      [source.window, unrelated.window, moved.window],
      false,
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    const unrelatedColumns = testLayoutColumns(
      controller,
      otherOutput,
      desktops[1],
    );
    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(fixture.workspace.currentDesktop).toBe(desktops[1]);
    expect(fixture.desktopSwitchCount).toBe(1);
    expect(testLayoutColumns(controller, otherOutput, desktops[1])).toEqual(
      unrelatedColumns,
    );
  });

  it("rejects destination constraints and multi-output overflow before KWin writes", () => {
    const constrained = createDesktopTransferFixture();
    Object.defineProperty(constrained.moved.window, "minSize", {
      configurable: true,
      value: { height: 1, width: 700 },
    });

    expect(constrained.controller.moveWindowToNextDesktop()).toBe(false);
    expect(constrained.moved.desktopWriteCount).toBe(0);
    expect(constrained.fixture.desktopSwitchCount).toBe(0);

    const capacity = createDesktopTransferFixture({ destinationCount: 2 });
    const secondOutput = createOutput("HDMI-A-1", 1000);
    capacity.fixture.setScreens([capacity.output, secondOutput]);

    expect(capacity.controller.moveWindowToNextDesktop()).toBe(false);
    expect(capacity.moved.desktopWriteCount).toBe(0);
    expect(capacity.fixture.desktopSwitchCount).toBe(0);
  });

  it("rejects suspension, floating, topology, capacity, and waiting barriers", () => {
    const suspended = createDesktopTransferFixture();
    setWindowState("fullscreen", suspended.destination, true);
    expect(suspended.controller.moveWindowToNextDesktop()).toBe(false);

    const floating = createDesktopTransferFixture();
    expect(floating.controller.toggleFloating()).toBe(true);
    expect(floating.controller.moveWindowToNextDesktop()).toBe(false);

    const topology = createDesktopTransferFixture({ trackedOutput: true });
    (
      topology.controller as unknown as {
        topologyStabilizing: boolean;
      }
    ).topologyStabilizing = true;
    expect(topology.controller.moveWindowToNextDesktop()).toBe(false);

    const capacity = createDesktopTransferFixture();
    const targetKey = `${capacity.output.name}\u0000${capacity.desktops[1].id}`;
    (
      capacity.controller as unknown as {
        capacityParkBackoffs: Set<string>;
      }
    ).capacityParkBackoffs.add(targetKey);
    expect(capacity.controller.moveWindowToNextDesktop()).toBe(false);

    const waiting = createDesktopTransferFixture();
    (
      waiting.controller as unknown as {
        waitingWindowIds: Map<string, Set<string>>;
      }
    ).waitingWindowIds.set(targetKey, new Set(["waiting"]));
    expect(waiting.controller.moveWindowToNextDesktop()).toBe(false);
  });

  it("rolls back window assignment when a desktop switch is rejected", () => {
    const { controller, desktops, fixture, moved, output } =
      createDesktopTransferFixture();
    fixture.setDesktopSwitchBehavior(() => undefined);
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[0].id),
    );

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[0],
    );
    expect(fixture.workspace.activeWindow).toBe(moved.window);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[0].id),
      ),
    ).toEqual(before);
    expect(moved.desktopWriteCount).toBe(2);
  });

  it("rejects a desktop rule and tolerates reentrant desktop and activation signals", () => {
    const rejected = createDesktopTransferFixture();
    rejected.moved.setDesktopWriteBehavior(() => undefined);
    expect(rejected.controller.moveWindowToNextDesktop()).toBe(false);
    expect(rejected.fixture.desktopSwitchCount).toBe(0);

    const reentrant = createDesktopTransferFixture();
    reentrant.fixture.setDesktopSwitchBehavior((_desktop, _output, commit) => {
      reentrant.fixture.workspace.activeWindow = reentrant.destination.window;
      commit();
    });
    expect(reentrant.controller.moveWindowToNextDesktop()).toBe(true);
    expect(reentrant.fixture.workspace.activeWindow).toBe(
      reentrant.moved.window,
    );
    expect(
      testLayoutColumns(
        reentrant.controller,
        reentrant.output,
        reentrant.desktops[1],
      ),
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
  });

  it("defers a reentrant window addition until the transfer commits", () => {
    const transfer = createDesktopTransferFixture();
    const added = createTrackedWindow(
      "added",
      transfer.output,
      transfer.desktops[1],
    );
    let managedDuringSwitch = -1;
    transfer.fixture.setDesktopSwitchBehavior((_desktop, _output, commit) => {
      transfer.fixture.windowAdded.emit(added.window);
      managedDuringSwitch = transfer.controller.managedCount;
      commit();
    });

    expect(transfer.controller.moveWindowToNextDesktop()).toBe(true);
    expect(managedDuringSwitch).toBe(3);
    expect(transfer.controller.managedCount).toBe(4);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["moved"] },
      { id: "column:added", windowIds: ["added"] },
    ]);
    expect(transfer.fixture.workspace.activeWindow).toBe(transfer.moved.window);
  });

  it("compensates accepted destination writes in FIFO order after a partial failure", () => {
    const { controller, destination, desktops, moved, output } =
      createDesktopTransferFixture();
    const destinationFrames: KWinWindow["frameGeometry"][] = [];
    destination.setWriteBehavior((frame, commit) => {
      destinationFrames.push({ ...frame });
      commit();
    });
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        moved.setFrameGeometry({ height: 310, width: 410, x: 220, y: 140 });
      }
    });
    moved.setWriteBehavior((_frame, commit) => {
      if (moved.window.desktops[0]?.id === desktops[1].id) {
        throw new Error("destination write rejected");
      }

      commit();
    });
    const destinationBefore = { ...destination.window.frameGeometry };
    const sourceSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[0].id),
    );
    const targetSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[1].id),
    );

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(destinationFrames).toHaveLength(2);
    expect(destinationFrames[1]).toEqual(destinationBefore);
    expect(destination.window.frameGeometry).toEqual(destinationBefore);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[0].id),
      ),
    ).toEqual(sourceSnapshot);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[1].id),
      ),
    ).toEqual(targetSnapshot);
  });

  it("preserves an external destination frame during partial rollback", () => {
    const { controller, destination, desktops, moved } =
      createDesktopTransferFixture();
    const externalFrame = { height: 333, width: 444, x: 77, y: 88 };
    let destinationWrites = 0;
    destination.setWriteBehavior((_frame, commit) => {
      destinationWrites += 1;
      commit();
      destination.setFrameGeometry(externalFrame);
    });
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        moved.setFrameGeometry({ height: 310, width: 410, x: 220, y: 140 });
      }
    });
    moved.setWriteBehavior((_frame, commit) => {
      if (moved.window.desktops[0]?.id === desktops[1].id) {
        throw new Error("destination write rejected");
      }

      commit();
    });

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(destinationWrites).toBe(1);
    expect(destination.window.frameGeometry).toEqual(externalFrame);
    expect(moved.window.desktops).toEqual([desktops[0]]);
  });

  it("preserves an external source frame raised during desktop restoration", () => {
    const { controller, desktops, moved } = createDesktopTransferFixture();
    const externalFrame = { height: 355, width: 455, x: 91, y: 92 };
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        moved.setFrameGeometry({ height: 310, width: 410, x: 220, y: 140 });
      } else {
        moved.setFrameGeometry(externalFrame);
      }
    });
    moved.setWriteBehavior((_frame, commit) => {
      if (moved.window.desktops[0]?.id === desktops[1].id) {
        throw new Error("destination write rejected");
      }

      commit();
    });

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(moved.window.frameGeometry).toEqual(externalFrame);
  });

  it("rolls back when a synchronous authority change follows the final write", () => {
    const { controller, desktops, moved, output } =
      createDesktopTransferFixture();
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        moved.setFrameGeometry({ height: 310, width: 410, x: 220, y: 140 });
      }
    });
    moved.setWriteBehavior((_frame, commit) => {
      commit();
      Object.defineProperty(moved.window, "fullScreen", {
        configurable: true,
        value: true,
      });
      moved.fullScreenChanged.emit();
    });
    const sourceSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[0].id),
    );
    const targetSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[1].id),
    );

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[0].id),
      ),
    ).toEqual(sourceSnapshot);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[1].id),
      ),
    ).toEqual(targetSnapshot);
  });

  it("compensates a desktop geometry setter that mutates before throwing", () => {
    const { controller, desktops, moved, output } =
      createDesktopTransferFixture();
    const sourceFrame = { ...moved.window.frameGeometry };
    const sourceSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[0].id),
    );
    const targetSnapshot = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktops[1].id),
    );
    let rejected = false;
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        moved.setFrameGeometry({ height: 310, width: 410, x: 220, y: 140 });
      }
    });
    moved.setWriteBehavior((_frame, commit) => {
      commit();

      if (!rejected && moved.window.desktops[0]?.id === desktops[1].id) {
        rejected = true;
        throw new Error("destination write failed after mutation");
      }
    });

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(moved.window.frameGeometry).toEqual(sourceFrame);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[0].id),
      ),
    ).toEqual(sourceSnapshot);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[1].id),
      ),
    ).toEqual(targetSnapshot);
  });

  it("does not restore a removed mover through a stale desktop handle", () => {
    const { controller, desktops, fixture, moved } =
      createDesktopTransferFixture();
    moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        fixture.windowRemoved.emit(moved.window);
      }
    });

    expect(controller.moveWindowToNextDesktop()).toBe(false);
    expect(moved.desktopWriteCount).toBe(1);
    expect(moved.window.desktops).toEqual([desktops[1]]);
  });

  it("keeps the post-KWin frame as the destination stop baseline and cleans up close", () => {
    const baseline = { height: 360, width: 460, x: 120, y: 130 };
    const first = createDesktopTransferFixture();
    first.moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === first.desktops[1].id) {
        first.moved.setFrameGeometry(baseline);
      }
    });

    expect(first.controller.moveWindowToNextDesktop()).toBe(true);
    first.controller.stop();
    expect(first.moved.window.frameGeometry).toEqual(baseline);

    const second = createDesktopTransferFixture();
    expect(second.controller.moveWindowToNextDesktop()).toBe(true);
    second.fixture.windowRemoved.emit(second.moved.window);
    expect(second.controller.managedCount).toBe(2);
    expect(
      testLayoutColumns(second.controller, second.output, second.desktops[1]),
    ).toEqual([{ id: "column:destination", windowIds: ["destination"] }]);
  });
});

describe("RuntimeController output transfers", () => {
  it.each([
    {
      direction: "left",
      move: (controller: RuntimeController) =>
        controller.moveWindowToOutputLeft(),
      target: { x: -1000, y: 0 },
    },
    {
      direction: "right",
      move: (controller: RuntimeController) =>
        controller.moveWindowToOutputRight(),
      target: { x: 1000, y: 0 },
    },
    {
      direction: "up",
      move: (controller: RuntimeController) =>
        controller.moveWindowToOutputUp(),
      target: { x: 0, y: -800 },
    },
    {
      direction: "down",
      move: (controller: RuntimeController) =>
        controller.moveWindowToOutputDown(),
      target: { x: 0, y: 800 },
    },
  ])(
    "moves to the adjacent output $direction and stops at its boundary",
    ({ move, target }) => {
      const transfer = createOutputTransferFixture({ target });
      const sourceFrame = { ...transfer.source.window.frameGeometry };

      expect(move(transfer.controller)).toBe(true);
      expect(transfer.moved.window.output).toBe(transfer.targetOutput);
      expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
      expect(transfer.fixture.outputTransferCount).toBe(1);
      expect(transfer.fixture.desktopSwitchCount).toBe(0);
      expect(transfer.fixture.workspace.activeWindow).toBe(
        transfer.moved.window,
      );
      expect(
        testLayoutColumns(
          transfer.controller,
          transfer.sourceOutput,
          transfer.sourceDesktop,
        ),
      ).toEqual([{ id: "column:source", windowIds: ["source"] }]);
      expect(
        testLayoutColumns(
          transfer.controller,
          transfer.targetOutput,
          transfer.targetDesktop,
        ),
      ).toEqual([
        { id: "column:destination", windowIds: ["destination"] },
        { id: "column:moved", windowIds: ["moved"] },
      ]);
      expect(transfer.source.window.frameGeometry).toEqual(sourceFrame);
      expect(transfer.controller.reconcile()).toBe(0);

      expect(move(transfer.controller)).toBe(false);
      expect(transfer.fixture.outputTransferCount).toBe(1);
    },
  );

  it("uses the target output's visible desktop without switching either output", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.targetDesktop]);
    expect(transfer.moved.desktopWriteCount).toBe(1);
    expect(transfer.fixture.desktopSwitchCount).toBe(0);
    expect(
      transfer.fixture.workspace.currentDesktopForScreen?.(
        transfer.sourceOutput,
      ),
    ).toBe(transfer.sourceDesktop);
    expect(
      transfer.fixture.workspace.currentDesktopForScreen?.(
        transfer.targetOutput,
      ),
    ).toBe(transfer.targetDesktop);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
  });

  it("uses the global desktop fallback without desktop writes", () => {
    const transfer = createOutputTransferFixture({
      perOutputDesktops: false,
    });

    expect(typeof transfer.fixture.workspace.currentDesktopForScreen).toBe(
      "undefined",
    );
    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
    expect(transfer.moved.desktopWriteCount).toBe(0);
    expect(transfer.fixture.desktopSwitchCount).toBe(0);
  });

  it("preserves width and inserts after the target active column", () => {
    const transfer = createOutputTransferFixture({
      destinationCount: 2,
      movedWidth: 0.3,
      targetColumnWidth: 0.3,
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    const target = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.targetOutput.name),
      desktopId(transfer.targetDesktop.id),
    );
    expect(target.columns.map((column) => String(column.id))).toEqual([
      "column:destination",
      "column:moved",
      "column:destination-2",
    ]);
    expect(target.columns[1]?.width).toEqual({
      kind: "proportion",
      value: 0.3,
    });
    expect(target.activeColumnId).toBe(columnId("column:moved"));
  });

  it("creates an empty target context and removes an emptied source", () => {
    const transfer = createOutputTransferFixture({
      destinationCount: 0,
      sourceOnly: true,
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(transfer.controller.managedCount).toBe(1);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.sourceOutput,
        transfer.sourceDesktop,
      ),
    ).toEqual([]);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual([{ id: "column:moved", windowIds: ["moved"] }]);
    expect(transfer.controller.reconcile()).toBe(0);
  });

  it("fails closed when KWin does not expose output transfer", () => {
    const transfer = createOutputTransferFixture();
    Object.defineProperty(transfer.fixture.workspace, "sendClientToScreen", {
      configurable: true,
      value: undefined,
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(0);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
  });

  it("stops transfer writes when the mover becomes automatic mid-transaction", () => {
    const transfer = createOutputTransferFixture();
    const writesBefore = transfer.moved.writeCount;
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      Object.defineProperty(transfer.moved.window, "resizeable", {
        configurable: true,
        value: false,
      });
      transfer.moved.maximizeableChanged.emit(false);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(1);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
    expect(transfer.moved.writeCount).toBe(writesBefore);
    expect(transfer.controller.automaticFloatingCount).toBe(1);
    expect(transfer.controller.floatingCount).toBe(0);

    Object.defineProperty(transfer.moved.window, "resizeable", {
      configurable: true,
      value: true,
    });
    transfer.controller.reconcile();
    expect(transfer.controller.automaticFloatingCount).toBe(0);
    expect(transfer.controller.managedCount).toBe(3);
    expectAutomaticOwnershipBookkeepingClear(
      transfer.controller,
      windowId("moved"),
    );
  });

  it("replays unrelated context and blocker events after a transfer exits", () => {
    const scheduler = new ManualScheduler();
    const transfer = createOutputTransferFixture({
      differentDesktop: true,
      scheduler,
    });

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const destination = transfer.destinations[0];

    if (!destination) {
      throw new Error("missing destination fixture");
    }

    const destinationFrame = { ...destination.window.frameGeometry };
    const destinationWrites = destination.writeCount;
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      transfer.source.window.desktops = [transfer.targetDesktop];
      transfer.source.setOutput(transfer.targetOutput);
      Object.defineProperties(destination.window, {
        fullScreen: { configurable: true, value: true },
        resizeable: { configurable: true, value: false },
      });
      destination.fullScreenChanged.emit();
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(2);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const state = transfer.controller as unknown as {
      readonly suspendedWindows: ReadonlySet<WindowId>;
    };
    expect(transfer.source.window.output).toBe(transfer.targetOutput);
    expect(transfer.source.window.desktops).toEqual([transfer.targetDesktop]);
    expect(state.suspendedWindows.has(windowId("destination"))).toBe(true);
    expect(destination.window.frameGeometry).toEqual(destinationFrame);
    expect(destination.writeCount).toBe(destinationWrites);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.sourceOutput,
        transfer.sourceDesktop,
      ),
    ).toEqual([{ id: "column:moved", windowIds: ["moved"] }]);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:source", windowIds: ["source"] },
    ]);
  });

  it("rejects capacity and size-constraint violations before moving the window", () => {
    const capacity = createOutputTransferFixture({ destinationCount: 2 });
    expect(capacity.controller.moveWindowToOutputRight()).toBe(false);
    expect(capacity.fixture.outputTransferCount).toBe(0);

    const constrained = createOutputTransferFixture();
    Object.defineProperty(constrained.moved.window, "minSize", {
      configurable: true,
      value: { height: 1, width: 900 },
    });
    expect(constrained.controller.moveWindowToOutputRight()).toBe(false);
    expect(constrained.fixture.outputTransferCount).toBe(0);
  });

  it("rejects floating and suspended windows before invoking KWin", () => {
    const floating = createOutputTransferFixture();
    expect(floating.controller.toggleFloating()).toBe(true);
    expect(floating.controller.moveWindowToOutputRight()).toBe(false);
    expect(floating.fixture.outputTransferCount).toBe(0);

    const suspended = createOutputTransferFixture({
      movedOverrides: { fullScreen: true },
    });
    expect(suspended.controller.moveWindowToOutputRight()).toBe(false);
    expect(suspended.fixture.outputTransferCount).toBe(0);
  });

  it("restores the desktop when KWin rejects the output assignment", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    const sourceSnapshot = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.sourceOutput.name),
      desktopId(transfer.sourceDesktop.id),
    );
    const targetSnapshot = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.targetOutput.name),
      desktopId(transfer.targetDesktop.id),
    );
    transfer.fixture.setOutputTransferBehavior(() => undefined);

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
    expect(transfer.moved.desktopWriteCount).toBe(2);
    expect(transfer.fixture.desktopSwitchCount).toBe(0);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.sourceOutput.name),
        desktopId(transfer.sourceDesktop.id),
      ),
    ).toEqual(sourceSnapshot);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.targetOutput.name),
        desktopId(transfer.targetDesktop.id),
      ),
    ).toEqual(targetSnapshot);
  });

  it("does not invoke output transfer when a desktop rule rejects assignment", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    transfer.moved.setDesktopWriteBehavior(() => undefined);

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(0);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
  });

  it("compensates source geometry after a partial destination failure", () => {
    const transfer = createOutputTransferFixture({ sourceStack: true });
    const sourceFrame = { ...transfer.source.window.frameGeometry };
    const movedFrame = { ...transfer.moved.window.frameGeometry };
    const sourceWrites = transfer.source.writeCount;
    transfer.moved.setWriteBehavior(() => {
      if (transfer.moved.window.output?.name === transfer.targetOutput.name) {
        throw new Error("destination write rejected");
      }
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.source.window.frameGeometry).toEqual(sourceFrame);
    expect(transfer.moved.window.frameGeometry).toEqual(movedFrame);
    expect(transfer.source.writeCount - sourceWrites).toBe(2);
    expect(transfer.fixture.outputTransferCount).toBe(2);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.sourceOutput,
        transfer.sourceDesktop,
      ),
    ).toEqual([
      {
        id: "column:source",
        windowIds: ["source", "moved"],
      },
    ]);
  });

  it("compensates a geometry setter that mutates before throwing", () => {
    const transfer = createOutputTransferFixture({ sourceStack: true });
    const sourceFrame = { ...transfer.source.window.frameGeometry };
    const movedFrame = { ...transfer.moved.window.frameGeometry };
    let rejected = false;
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();

      if (!rejected && transfer.moved.window.output === transfer.targetOutput) {
        rejected = true;
        throw new Error("destination write failed after mutation");
      }
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.source.window.frameGeometry).toEqual(sourceFrame);
    expect(transfer.moved.window.frameGeometry).toEqual(movedFrame);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
  });

  it("commits while a successful destination frame write is still queued", () => {
    const controllerScheduler = new ManualScheduler();
    const transfer = createOutputTransferFixture({
      scheduler: controllerScheduler,
    });
    const before = { ...transfer.moved.window.frameGeometry };
    const queuedWrites = new ManualScheduler();
    let queuedFrame: KWinWindow["frameGeometry"] | undefined;
    transfer.moved.setWriteBehavior((frame, commit) => {
      queuedFrame = { ...frame };
      queuedWrites.schedule(commit);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(queuedWrites.pendingCount).toBe(1);
    expect(transfer.moved.window.frameGeometry).toEqual(before);
    expect(queuedFrame).toBeDefined();

    queuedWrites.flush();
    expect(transfer.moved.window.frameGeometry).toEqual(queuedFrame);
  });

  it("queues rollback after a pending forward write and settles to the old frame", () => {
    const controllerScheduler = new ManualScheduler();
    const transfer = createOutputTransferFixture({
      scheduler: controllerScheduler,
      sourceStack: true,
    });
    const sourceBefore = { ...transfer.source.window.frameGeometry };
    const queuedSourceWrites = new ManualScheduler();
    transfer.source.setWriteBehavior((_frame, commit) => {
      queuedSourceWrites.schedule(commit);
    });
    transfer.moved.setWriteBehavior((_frame, commit) => {
      if (transfer.moved.window.output === transfer.targetOutput) {
        throw new Error("destination write rejected");
      }

      commit();
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(queuedSourceWrites.pendingCount).toBe(2);
    expect(transfer.source.window.frameGeometry).toEqual(sourceBefore);

    queuedSourceWrites.flush();
    expect(transfer.source.window.frameGeometry).not.toEqual(sourceBefore);
    queuedSourceWrites.flush();
    expect(transfer.source.window.frameGeometry).toEqual(sourceBefore);
  });

  it("restores the source frame when both output sends relocate the mover", () => {
    const transfer = createOutputTransferFixture();
    const sourceFrame = { ...transfer.moved.window.frameGeometry };
    const targetMechanismFrame = { height: 310, width: 410, x: 1210, y: 90 };
    const sourceMechanismFrame = { height: 320, width: 420, x: 120, y: 100 };
    transfer.fixture.setOutputTransferBehavior((_window, output, commit) => {
      commit();
      transfer.moved.setFrameGeometry(
        output === transfer.targetOutput
          ? targetMechanismFrame
          : sourceMechanismFrame,
      );
    });
    let rejected = false;
    transfer.moved.setWriteBehavior((_frame, commit) => {
      if (!rejected && transfer.moved.window.output === transfer.targetOutput) {
        rejected = true;
        throw new Error("destination write rejected");
      }

      commit();
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(2);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.frameGeometry).toEqual(sourceFrame);
  });

  it("preserves an external source frame raised during forward reflow", () => {
    const transfer = createOutputTransferFixture({ sourceStack: true });
    const externalFrame = { height: 333, width: 444, x: 77, y: 88 };
    transfer.source.setWriteBehavior((_frame, commit) => {
      commit();
      transfer.source.setFrameGeometry(externalFrame);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.source.window.frameGeometry).toEqual(externalFrame);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
  });

  it("preserves an external unchanged destination frame before commit", () => {
    const transfer = createOutputTransferFixture();
    const destination = transfer.destinations[0];

    if (!destination) {
      throw new Error("output transfer fixture needs a destination window");
    }

    const externalFrame = { height: 333, width: 444, x: 1077, y: 88 };
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();
      destination.setFrameGeometry(externalFrame);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(destination.window.frameGeometry).toEqual(externalFrame);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
  });

  it("preserves an external output mutation and restores only owned fields", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    const externalOutput = createOutput("EXTERNAL", 3000);
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      transfer.moved.setOutput(externalOutput);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.moved.window.output).toBe(externalOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
  });

  it("blocks reentrant commands and defers window admission until commit", () => {
    const transfer = createOutputTransferFixture();
    const added = createTrackedWindow(
      "added",
      transfer.sourceOutput,
      transfer.sourceDesktop,
    );
    let reentrant: boolean | undefined;
    let managedDuringTransfer = -1;
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      reentrant = transfer.controller.moveWindowLeft();
      transfer.fixture.windowAdded.emit(added.window);
      managedDuringTransfer = transfer.controller.managedCount;
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(reentrant).toBe(false);
    expect(managedDuringTransfer).toBe(3);
    expect(transfer.controller.managedCount).toBe(4);
  });

  it("replays an external activation after rollback", () => {
    const transfer = createOutputTransferFixture();
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();
      transfer.fixture.workspace.activeWindow = transfer.source.window;
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.workspace.activeWindow).toBe(
      transfer.source.window,
    );
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.sourceOutput.name),
        desktopId(transfer.sourceDesktop.id),
      ).activeColumnId,
    ).toBe(columnId("column:source"));
  });

  it("does not restore a removed mover through a stale KWin handle", () => {
    const transfer = createOutputTransferFixture();
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      transfer.fixture.windowRemoved.emit(transfer.moved.window);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(1);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
  });

  it("rolls back when the layout CAS changes during geometry writes", () => {
    const transfer = createOutputTransferFixture();
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();
      runtimeLayout(transfer.controller).setViewportOffset(
        outputId(transfer.sourceOutput.name),
        desktopId(transfer.sourceDesktop.id),
        1,
      );
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.sourceOutput.name),
        desktopId(transfer.sourceDesktop.id),
      ).viewportOffset,
    ).toBe(1);
  });

  it("aborts when a visible desktop changes and never switches it back", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    let changed = false;
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();

      if (changed) {
        return;
      }

      changed = true;
      transfer.fixture.workspace.setCurrentDesktopForScreen?.(
        transfer.sourceDesktop,
        transfer.targetOutput,
      );
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(
      transfer.fixture.workspace.currentDesktopForScreen?.(
        transfer.targetOutput,
      ),
    ).toBe(transfer.sourceDesktop);
    expect(transfer.fixture.desktopSwitchCount).toBe(1);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.sourceDesktop]);
  });

  it("replays a suppressed desktop change for newly visible contexts", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    const newlyVisible = createTrackedWindow(
      "newly-visible",
      transfer.targetOutput,
      transfer.sourceDesktop,
    );
    transfer.fixture.windowAdded.emit(newlyVisible.window);
    expect(transfer.controller.managedCount).toBe(4);
    newlyVisible.setFrameGeometry({
      height: 123,
      width: 234,
      x: 1777,
      y: 222,
    });
    const writesBefore = newlyVisible.writeCount;
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      transfer.fixture.workspace.setCurrentDesktopForScreen?.(
        transfer.sourceDesktop,
        transfer.targetOutput,
      );
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(newlyVisible.writeCount).toBeGreaterThan(writesBefore);
  });

  it("does not use captured outputs after topology changes mid-transaction", () => {
    const scheduler = new ManualScheduler();
    const transfer = createOutputTransferFixture({ scheduler });
    transfer.moved.setWriteBehavior((_frame, commit) => {
      commit();
      transfer.fixture.setScreens([
        transfer.sourceOutput,
        createPositionedOutput("TARGET", 1000, 0),
      ]);
      transfer.fixture.screensChanged.emit();
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(1);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
    expect(scheduler.pendingCount).toBeGreaterThan(0);
  });

  it("uses the post-KWin destination frame as the stop baseline", () => {
    const transfer = createOutputTransferFixture();
    const destinationBaseline = { height: 360, width: 460, x: 1120, y: 130 };
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      transfer.moved.setFrameGeometry(destinationBaseline);
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    transfer.controller.stop();
    expect(transfer.moved.window.frameGeometry).toEqual(destinationBaseline);
  });
});

function createOutputTransferFixture(
  options: {
    readonly destinationCount?: number;
    readonly differentDesktop?: boolean;
    readonly movedOverrides?: Partial<KWinWindow>;
    readonly movedWidth?: number;
    readonly perOutputDesktops?: boolean;
    readonly scheduler?: ManualScheduler;
    readonly sourceOnly?: boolean;
    readonly sourceStack?: boolean;
    readonly target?: { readonly x: number; readonly y: number };
    readonly targetColumnWidth?: number;
  } = {},
) {
  const sourceOutput = createPositionedOutput("SOURCE", 0, 0);
  const targetOutput = createPositionedOutput(
    "TARGET",
    options.target?.x ?? 1000,
    options.target?.y ?? 0,
  );
  const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
  const sourceDesktop = desktops[0];
  const targetDesktop = options.differentDesktop ? desktops[1] : desktops[0];
  const source = createTrackedWindow("source", sourceOutput, sourceDesktop);
  const moved = createTrackedWindow(
    "moved",
    sourceOutput,
    sourceDesktop,
    options.movedOverrides,
  );
  const destinations = Array.from(
    { length: options.destinationCount ?? 1 },
    (_value, index) =>
      createTrackedWindow(
        index === 0 ? "destination" : `destination-${String(index + 1)}`,
        targetOutput,
        targetDesktop,
      ),
  );
  const fixture = createWorkspace(
    sourceOutput,
    sourceDesktop,
    [sourceOutput, targetOutput],
    desktops,
    [
      ...(options.sourceOnly ? [] : [source.window]),
      moved.window,
      ...destinations.map((window) => window.window),
    ],
    options.perOutputDesktops ?? true,
  );

  if (targetDesktop.id !== sourceDesktop.id) {
    fixture.setCurrentDesktop(targetOutput, targetDesktop);
  }

  const controller = new RuntimeController(fixture.workspace, {
    clientAreaOption: 2,
    gap: 10,
    ...(options.scheduler ? { schedule: options.scheduler.schedule } : {}),
  });
  controller.start();
  const layout = new LayoutEngine();
  layout.restoreColumns({
    activeColumnId: columnId(
      options.sourceStack && !options.sourceOnly
        ? "column:source"
        : "column:moved",
    ),
    columns: options.sourceOnly
      ? [
          {
            column: {
              id: columnId("column:moved"),
              width: {
                kind: "proportion",
                value: options.movedWidth ?? 0.5,
              },
              windowIds: [windowId("moved")],
            },
            index: 0,
          },
        ]
      : options.sourceStack
        ? [
            {
              column: {
                id: columnId("column:source"),
                width: {
                  kind: "proportion",
                  value: options.movedWidth ?? 0.5,
                },
                windowIds: [windowId("source"), windowId("moved")],
              },
              index: 0,
            },
          ]
        : [
            {
              column: {
                id: columnId("column:source"),
                width: { kind: "proportion", value: 0.5 },
                windowIds: [windowId("source")],
              },
              index: 0,
            },
            {
              column: {
                id: columnId("column:moved"),
                width: {
                  kind: "proportion",
                  value: options.movedWidth ?? 0.5,
                },
                windowIds: [windowId("moved")],
              },
              index: 1,
            },
          ],
    desktopId: desktopId(sourceDesktop.id),
    outputId: outputId(sourceOutput.name),
  });
  layout.restoreColumns({
    activeColumnId:
      destinations.length === 0 ? null : columnId("column:destination"),
    columns: destinations.map((window, index) => ({
      column: {
        id: columnId(
          index === 0
            ? "column:destination"
            : `column:destination-${String(index + 1)}`,
        ),
        width: {
          kind: "proportion" as const,
          value: options.targetColumnWidth ?? 0.5,
        },
        windowIds: [windowId(String(window.window.internalId))],
      },
      index,
    })),
    desktopId: desktopId(targetDesktop.id),
    outputId: outputId(targetOutput.name),
  });
  (
    controller as unknown as {
      layout: LayoutEngine;
    }
  ).layout = layout;
  fixture.workspace.activeWindow = moved.window;
  controller.reconcile();

  return {
    controller,
    desktops,
    destinations,
    fixture,
    moved,
    source,
    sourceDesktop,
    sourceOutput,
    targetDesktop,
    targetOutput,
  };
}

function createPositionedOutput(
  name: string,
  x: number,
  y: number,
): KWinOutput {
  return {
    devicePixelRatio: 1,
    geometry: { height: 800, width: 1000, x, y },
    name,
  };
}

function createDesktopTransferFixture(
  options: {
    readonly destinationCount?: number;
    readonly movedOverrides?: Partial<KWinWindow>;
    readonly trackedOutput?: boolean;
  } = {},
) {
  const trackedOutput = options.trackedOutput
    ? createTrackedOutput("DP-1", 0)
    : null;
  const output = trackedOutput?.output ?? createOutput("DP-1", 0);
  const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
  const source = createTrackedWindow("source", output, desktops[0]);
  const destinations = Array.from(
    { length: options.destinationCount ?? 1 },
    (_value, index) =>
      createTrackedWindow(
        index === 0 ? "destination" : `destination-${String(index + 1)}`,
        output,
        desktops[1],
      ),
  );
  const destination = destinations[0];

  if (!destination) {
    throw new Error("desktop transfer fixture needs a destination window");
  }

  const moved = createTrackedWindow(
    "moved",
    output,
    desktops[0],
    options.movedOverrides,
  );
  const fixture = createWorkspace(output, desktops[0], [output], desktops, [
    source.window,
    ...destinations.map((window) => window.window),
    moved.window,
  ]);
  const controller = new RuntimeController(fixture.workspace, {
    clientAreaOption: 2,
    gap: 10,
  });

  controller.start();
  const layout = new LayoutEngine();
  layout.restoreColumns({
    activeColumnId: columnId("column:source"),
    columns: [
      {
        column: {
          id: columnId("column:source"),
          width: { kind: "proportion", value: 0.5 },
          windowIds: [windowId("source")],
        },
        index: 0,
      },
      {
        column: {
          id: columnId("column:moved"),
          width: { kind: "proportion", value: 0.5 },
          windowIds: [windowId("moved")],
        },
        index: 1,
      },
    ],
    desktopId: desktopId(desktops[0].id),
    outputId: outputId(output.name),
  });
  layout.restoreColumns({
    activeColumnId: columnId("column:destination"),
    columns: destinations.map((window, index) => ({
      column: {
        id: columnId(
          index === 0
            ? "column:destination"
            : `column:destination-${String(index + 1)}`,
        ),
        width: { kind: "proportion" as const, value: 0.5 },
        windowIds: [windowId(String(window.window.internalId))],
      },
      index,
    })),
    desktopId: desktopId(desktops[1].id),
    outputId: outputId(output.name),
  });
  (
    controller as unknown as {
      layout: LayoutEngine;
    }
  ).layout = layout;
  fixture.workspace.activeWindow = moved.window;
  controller.reconcile();

  return {
    controller,
    destination,
    destinations,
    desktops,
    fixture,
    moved,
    output,
    source,
    trackedOutput,
  };
}

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

function expectAutomaticOwnershipBookkeepingClear(
  controller: RuntimeController,
  id: WindowId,
): void {
  const state = controller as unknown as {
    readonly capacityLeaseByWindow: ReadonlyMap<WindowId, unknown>;
    readonly pendingWindowSyncs: ReadonlySet<WindowId>;
    readonly requestedSuspensions: ReadonlyMap<WindowId, unknown>;
    readonly resumeSamples: ReadonlyMap<WindowId, unknown>;
    readonly suspendedWindows: ReadonlySet<WindowId>;
    readonly transientResumeProbes: ReadonlyMap<WindowId, unknown>;
    readonly waitingWindowContexts: ReadonlyMap<WindowId, string>;
  };

  expect(state.capacityLeaseByWindow.has(id)).toBe(false);
  expect(state.pendingWindowSyncs.has(id)).toBe(false);
  expect(state.requestedSuspensions.has(id)).toBe(false);
  expect(state.resumeSamples.has(id)).toBe(false);
  expect(state.suspendedWindows.has(id)).toBe(false);
  expect(state.transientResumeProbes.has(id)).toBe(false);
  expect(state.waitingWindowContexts.has(id)).toBe(false);
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
