import { describe, expect, it } from "vitest";
import {
  columnId,
  desktopId,
  outputId,
  windowId,
  type WindowId,
} from "../src/core/ids";
import {
  columnWindowHeights,
  LayoutEngine,
  type WindowHeight,
} from "../src/core/layout-engine";
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
  readonly decorationPolicyChanged: Signal<[]>;
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
  const decorationPolicyChanged = new Signal<[]>();
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
    decorationPolicyChanged,
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

  if (typeof window.noBorder === "boolean") {
    let noBorder = window.noBorder;

    Object.defineProperty(window, "noBorder", {
      configurable: true,
      enumerable: true,
      get: () => noBorder,
      set: (value: boolean) => {
        noBorder = value;
        decorationPolicyChanged.emit();
      },
    });
  }

  return {
    decorationPolicyChanged,
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
  setActivationBehavior(
    behavior: ((window: KWinWindow | null, commit: () => void) => void) | null,
  ): void;
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
  let activationBehavior:
    ((window: KWinWindow | null, commit: () => void) => void) | null = null;
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
      activationCount += 1;
      const commit = (): void => {
        activeWindow = window;
        windowActivated.emit(window);
      };

      if (activationBehavior) {
        activationBehavior(window, commit);
      } else {
        commit();
      }
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
    setActivationBehavior: (behavior) => {
      activationBehavior = behavior;
    },
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

type FocusAvailabilityBlocker =
  | "fullscreen"
  | "maximized"
  | "native tiled"
  | "restore settling"
  | "toggle unsettled";

function blockWindowFocus(
  controller: RuntimeController,
  tracked: TrackedWindow,
  blocker: FocusAvailabilityBlocker,
): void {
  if (
    blocker === "fullscreen" ||
    blocker === "maximized" ||
    blocker === "native tiled"
  ) {
    setWindowState(blocker, tracked, true);
    return;
  }

  const id = windowId(String(tracked.window.internalId));
  const state = controller as unknown as {
    readonly requestedSuspensions: Map<WindowId, Set<string>>;
    readonly suspendedWindows: Set<WindowId>;
    readonly toggleGeometryTransitions: Map<
      WindowId,
      {
        readonly contextKey: string;
        readonly expectedFrame: KWinWindow["frameGeometry"];
        settlementArmed: boolean;
      }
    >;
  };

  if (blocker === "restore settling") {
    state.suspendedWindows.add(id);
    state.requestedSuspensions.set(id, new Set(["maximized-settling"]));
    return;
  }

  state.toggleGeometryTransitions.set(id, {
    contextKey: `${tracked.window.output?.name ?? ""}\u0000${tracked.window.desktops[0]?.id ?? ""}`,
    expectedFrame: { ...tracked.window.frameGeometry },
    settlementArmed: false,
  });
}

interface FullscreenControl {
  commitDeferred(): boolean;
  externalCommit(fullScreen: boolean): void;
  readonly fullScreen: boolean;
  fullScreenable: boolean;
  restoreRequestedGeometry(): void;
  setWriteHook(hook: ((fullScreen: boolean) => void) | null): void;
  readonly writeCount: number;
}

interface FullscreenControlOptions {
  readonly fullScreen?: boolean;
  readonly fullScreenable?: boolean;
  readonly write?: "accept" | "defer" | "reject" | "throw";
}

function controlFullscreen(
  tracked: TrackedWindow,
  options: FullscreenControlOptions = {},
): FullscreenControl {
  let fullScreen = options.fullScreen ?? false;
  let fullScreenable = options.fullScreenable ?? true;
  let deferredFullScreen: boolean | null = null;
  let moveable = !fullScreen;
  let resizeable = !fullScreen;
  let writeHook: ((fullScreen: boolean) => void) | null = null;
  let writeCount = 0;
  const setRequestedGeometryState = (value: boolean): void => {
    moveable = !value;
    resizeable = !value;
  };
  const commit = (value: boolean): void => {
    fullScreen = value;
    setRequestedGeometryState(value);
    tracked.fullScreenChanged.emit();
  };

  Object.defineProperty(tracked.window, "fullScreenable", {
    configurable: true,
    enumerable: true,
    get: () => fullScreenable,
  });
  Object.defineProperty(tracked.window, "moveable", {
    configurable: true,
    enumerable: true,
    get: () => moveable,
  });
  Object.defineProperty(tracked.window, "resizeable", {
    configurable: true,
    enumerable: true,
    get: () => resizeable,
  });
  Object.defineProperty(tracked.window, "fullScreen", {
    configurable: true,
    enumerable: true,
    get: () => fullScreen,
    set: (value: boolean) => {
      writeCount += 1;

      if (options.write === "throw") {
        throw new Error("injected fullscreen write failure");
      }

      if (options.write === "reject" || value === fullScreen) {
        return;
      }

      setRequestedGeometryState(value);
      writeHook?.(value);

      if (options.write === "defer") {
        deferredFullScreen = value;
      } else {
        commit(value);
      }
    },
  });

  return {
    commitDeferred: () => {
      if (deferredFullScreen === null) {
        return false;
      }

      const value = deferredFullScreen;
      deferredFullScreen = null;
      commit(value);
      return true;
    },
    externalCommit: (value) => {
      deferredFullScreen = null;
      commit(value);
    },
    get fullScreen() {
      return fullScreen;
    },
    get fullScreenable() {
      return fullScreenable;
    },
    set fullScreenable(value: boolean) {
      fullScreenable = value;
    },
    restoreRequestedGeometry: () => {
      deferredFullScreen = null;
      setRequestedGeometryState(fullScreen);
    },
    setWriteHook: (hook) => {
      writeHook = hook;
    },
    get writeCount() {
      return writeCount;
    },
  };
}

interface MaximizeControl {
  readonly calls: readonly (readonly [
    vertical: boolean,
    horizontal: boolean,
  ])[];
  commitDeferred(): boolean;
  externalRequest(mode: number, defer?: boolean): void;
  readonly maximizeMode: number;
  maximizable: boolean;
}

interface MaximizeControlOptions {
  readonly maximizeMode?: number;
  readonly maximizable?: boolean;
  readonly requestModes?: readonly number[];
  readonly write?: "accept" | "defer" | "reject" | "throw";
}

function controlMaximize(
  tracked: TrackedWindow,
  options: MaximizeControlOptions = {},
): MaximizeControl {
  const calls: Array<readonly [vertical: boolean, horizontal: boolean]> = [];
  let maximizeMode = options.maximizeMode ?? 0;
  let maximizable = options.maximizable ?? true;
  let deferredMode: number | null = null;
  const commit = (mode: number): void => {
    maximizeMode = mode;
    tracked.maximizedChanged.emit();
  };
  const emitRequest = (modes: readonly number[], defer: boolean): void => {
    for (const mode of modes) {
      tracked.maximizedAboutToChange.emit(mode);
    }

    const mode = modes[modes.length - 1];

    if (mode === undefined) {
      return;
    }

    if (defer) {
      deferredMode = mode;
    } else {
      commit(mode);
    }
  };

  Object.defineProperty(tracked.window, "maximizable", {
    configurable: true,
    enumerable: true,
    get: () => maximizable,
  });
  Object.defineProperty(tracked.window, "maximizeMode", {
    configurable: true,
    enumerable: true,
    get: () => maximizeMode,
  });
  Object.defineProperty(tracked.window, "setMaximize", {
    configurable: true,
    enumerable: true,
    value: (vertical: boolean, horizontal: boolean) => {
      calls.push([vertical, horizontal]);

      if (options.write === "throw") {
        throw new Error("injected maximize write failure");
      }

      if (options.write === "reject") {
        return;
      }

      const nextMode = vertical && horizontal ? 3 : 0;
      emitRequest(
        options.requestModes ?? [nextMode],
        options.write === "defer",
      );
    },
  });

  return {
    calls,
    commitDeferred: () => {
      if (deferredMode === null) {
        return false;
      }

      const mode = deferredMode;
      deferredMode = null;
      commit(mode);
      return true;
    },
    externalRequest: (mode, defer = false) => {
      emitRequest([mode], defer);
    },
    get maximizeMode() {
      return maximizeMode;
    },
    get maximizable() {
      return maximizable;
    },
    set maximizable(value: boolean) {
      maximizable = value;
    },
  };
}

describe("RuntimeController", () => {
  it("delegates fullscreen to KWin without changing the tiled layout", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[2];

    if (!active) {
      throw new Error("missing fullscreen fixture");
    }

    const fullscreen = controlFullscreen(active);
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

    expect(controller.start()).toBe(true);
    const layout = runtimeLayout(controller);
    layout.setViewportOffset(outputId(output.name), desktopId(desktop.id), 125);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const frameWrites = windows.map(({ writeCount }) => writeCount);

    expect(controller.toggleFullscreen()).toBe(true);
    expect(fullscreen.fullScreen).toBe(true);
    expect(fullscreen.writeCount).toBe(1);
    expect(
      (
        controller as unknown as {
          readonly suspendedWindows: ReadonlySet<WindowId>;
        }
      ).suspendedWindows.has(windowId("window-3")),
    ).toBe(true);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(frameWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    fullscreen.fullScreenable = false;
    expect(controller.toggleFullscreen()).toBe(true);
    expect(fullscreen.fullScreen).toBe(false);
    expect(fullscreen.writeCount).toBe(2);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(frameWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    controller.stop();
  });

  it("does not enter fullscreen when KWin reports it unsupported", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const fullscreen = controlFullscreen(active, { fullScreenable: false });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frame = { ...active.window.frameGeometry };
    const frameWrites = active.writeCount;

    expect(controller.toggleFullscreen()).toBe(false);
    expect(fullscreen.fullScreen).toBe(false);
    expect(fullscreen.writeCount).toBe(0);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(active.window.frameGeometry).toEqual(frame);
    expect(active.writeCount).toBe(frameWrites);

    controller.stop();
  });

  it("rejects fullscreen without a live active window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const stoppedWindow = createTrackedWindow("stopped", output, desktop);
    const stoppedFullscreen = controlFullscreen(stoppedWindow);
    const stoppedFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [stoppedWindow.window],
    );
    const stopped = new RuntimeController(stoppedFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(stopped.toggleFullscreen()).toBe(false);
    expect(stoppedFullscreen.writeCount).toBe(0);

    const emptyFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [],
    );
    const empty = new RuntimeController(emptyFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(empty.start()).toBe(true);
    expect(empty.toggleFullscreen()).toBe(false);
    empty.stop();

    const deletedWindow = createTrackedWindow("deleted", output, desktop, {
      deleted: true,
    });
    const deletedFullscreen = controlFullscreen(deletedWindow);
    const deletedFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [deletedWindow.window],
    );
    const deleted = new RuntimeController(deletedFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(deleted.start()).toBe(true);
    expect(deleted.toggleFullscreen()).toBe(false);
    expect(deletedFullscreen.writeCount).toBe(0);
    deleted.stop();
  });

  it("reports rejected fullscreen property writes without layout changes", () => {
    for (const write of ["reject", "throw"] as const) {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const active = createTrackedWindow(`window-${write}`, output, desktop);
      const fullscreen = controlFullscreen(active, { write });
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [active.window],
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
      });

      expect(controller.start()).toBe(true);
      const before = runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frame = { ...active.window.frameGeometry };
      const frameWrites = active.writeCount;

      expect(controller.toggleFullscreen()).toBe(false);
      expect(fullscreen.fullScreen).toBe(false);
      expect(fullscreen.writeCount).toBe(1);
      expect(
        runtimeLayout(controller).snapshot(
          outputId(output.name),
          desktopId(desktop.id),
        ),
      ).toEqual(before);
      expect(active.window.frameGeometry).toEqual(frame);
      expect(active.writeCount).toBe(frameWrites);

      controller.stop();
    }
  });

  it("preserves manual-floating ownership through fullscreen", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const fullscreen = controlFullscreen(active);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      schedule: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    const floatingFrame = { ...active.window.frameGeometry };
    const frameWrites = active.writeCount;
    const layout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.toggleFullscreen()).toBe(true);
    expect(fullscreen.fullScreen).toBe(true);
    expect(controller.toggleFullscreen()).toBe(true);
    expect(fullscreen.fullScreen).toBe(false);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(frameWrites);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layout);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    controller.stop();
  });

  it("preserves manual-floating placement through a deferred fullscreen race", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const fullscreen = controlFullscreen(active, { write: "defer" });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      schedule: scheduler.schedule,
    });
    const activeId = windowId("window-1");

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    const state = controller as unknown as {
      readonly floatingWindows: ReadonlyMap<WindowId, unknown>;
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };
    const floatingState = structuredClone(state.floatingWindows.get(activeId));
    const floatingFrame = { ...active.window.frameGeometry };
    const frameWrites = active.writeCount;
    const layout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(floatingState).toBeDefined();
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(controller.toggleFullscreen()).toBe(true);
    expect(fullscreen.fullScreen).toBe(false);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);
    expect(active.window.moveable).toBe(false);
    expect(active.window.resizeable).toBe(false);

    active.minimizedChanged.emit();
    controller.reconcile();

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(state.floatingWindows.get(activeId)).toEqual(floatingState);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(frameWrites);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layout);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);

    expect(fullscreen.commitDeferred()).toBe(true);
    expect(fullscreen.fullScreen).toBe(true);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    flushManualScheduler(scheduler);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(state.floatingWindows.get(activeId)).toEqual(floatingState);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(frameWrites);

    expect(controller.toggleFullscreen()).toBe(true);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(false);
    expect(fullscreen.commitDeferred()).toBe(true);
    expect(fullscreen.fullScreen).toBe(false);
    flushManualScheduler(scheduler);

    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(state.floatingWindows.get(activeId)).toEqual(floatingState);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(frameWrites);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layout);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(state.suspendedWindows.has(activeId)).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    controller.stop();
  });

  it.each([
    {
      activeIndex: 0,
      expectedHeights: [
        { clientHeight: 240, kind: "fixed" },
        { kind: "auto", weight: 4 },
      ],
      expectedSourceIds: ["window-2", "window-3"],
      name: "top",
    },
    {
      activeIndex: 1,
      expectedHeights: [
        { kind: "auto", weight: 2 },
        { kind: "auto", weight: 4 },
      ],
      expectedSourceIds: ["window-1", "window-3"],
      name: "middle",
    },
    {
      activeIndex: 2,
      expectedHeights: [
        { kind: "auto", weight: 2 },
        { clientHeight: 240, kind: "fixed" },
      ],
      expectedSourceIds: ["window-1", "window-2"],
      name: "bottom",
    },
  ] as const)(
    "extracts the $name stack member before synchronous fullscreen",
    ({ activeIndex, expectedHeights, expectedSourceIds }) => {
      const setup = createStackedFullscreenFixture(activeIndex);
      const activeId = String(setup.active.window.internalId);

      expect(setup.controller.toggleFullscreen()).toBe(true);
      expect(setup.fullscreen.fullScreen).toBe(true);
      expect(setup.fullscreen.writeCount).toBe(1);

      const fullscreen = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      expect(fullscreen.columns.map((column) => String(column.id))).toEqual([
        "column:stack",
        `column:${activeId}`,
        "column:right",
      ]);
      expect(fullscreen.columns[0]).toMatchObject({
        id: "column:stack",
        width: { kind: "proportion", value: 0.45 },
        windowHeights: expectedHeights,
        windowIds: expectedSourceIds,
      });
      expect(fullscreen.columns[1]).toEqual({
        id: `column:${activeId}`,
        width: { kind: "proportion", value: 0.45 },
        windowIds: [activeId],
      });
      expect(fullscreen.activeColumnId).toBe(`column:${activeId}`);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

      expect(setup.controller.toggleFullscreen()).toBe(true);
      expect(setup.fullscreen.fullScreen).toBe(false);
      flushManualScheduler(setup.scheduler);
      expect(
        testLayoutColumns(setup.controller, setup.output, setup.desktop),
      ).toEqual([
        { id: "column:stack", windowIds: expectedSourceIds },
        { id: `column:${activeId}`, windowIds: [activeId] },
        { id: "column:right", windowIds: ["window-4"] },
      ]);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

      setup.controller.stop();
    },
  );

  it("extracts fullscreen past a settled minimized stack member", () => {
    const setup = createStackedFullscreenFixture(1);
    const minimized = setup.windows[0];
    const visible = setup.windows[2];

    if (!minimized || !visible) {
      throw new Error("missing minimized fullscreen stack fixture");
    }

    setWindowState("minimized", minimized, true);
    flushManualScheduler(setup.scheduler);
    const minimizedFrame = { ...minimized.window.frameGeometry };
    const minimizedWrites = minimized.writeCount;
    const visibleFrame = { ...visible.window.frameGeometry };
    const visibleWrites = visible.writeCount;

    expect(setup.controller.toggleFullscreen()).toBe(true);

    const fullscreen = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    expect(fullscreen.columns[0]).toMatchObject({
      id: "column:stack",
      windowHeights: [
        { kind: "auto", weight: 2 },
        { kind: "auto", weight: 4 },
      ],
      windowIds: ["window-1", "window-3"],
    });
    expect(fullscreen.columns[1]).toEqual({
      id: "column:window-2",
      width: { kind: "proportion", value: 0.45 },
      windowIds: ["window-2"],
    });
    expect(minimized.window.minimized).toBe(true);
    expect(minimized.window.frameGeometry).toEqual(minimizedFrame);
    expect(minimized.writeCount).toBe(minimizedWrites);
    expect(visible.window.frameGeometry).not.toEqual(visibleFrame);
    expect(visible.window.frameGeometry.height).toBeGreaterThan(
      visibleFrame.height,
    );
    expect(visible.writeCount).toBeGreaterThan(visibleWrites);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(setup.fullscreen.writeCount).toBe(1);

    setup.controller.stop();
  });

  it("rejects stacked fullscreen while a passive non-minimized member owns geometry", () => {
    const setup = createStackedFullscreenFixture(1);
    const blocked = setup.windows[0];

    if (!blocked) {
      throw new Error("missing blocked fullscreen stack fixture");
    }

    blockWindowFocus(setup.controller, blocked, "maximized");
    flushManualScheduler(setup.scheduler);
    const beforeLayout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    const beforeWrites = setup.windows.map(({ writeCount }) => writeCount);

    expect(setup.controller.toggleFullscreen()).toBe(false);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(0);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(setup.windows.map(({ window }) => window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.windows.map(({ writeCount }) => writeCount)).toEqual(
      beforeWrites,
    );

    setup.controller.stop();
  });

  it("rolls back fullscreen extraction when a minimized passive member resumes during reflow", () => {
    const setup = createStackedFullscreenFixture(1);
    const minimized = setup.windows[0];
    const visible = setup.windows[2];

    if (!minimized || !visible) {
      throw new Error("missing reentrant fullscreen stack fixture");
    }

    setWindowState("minimized", minimized, true);
    flushManualScheduler(setup.scheduler);
    const beforeLayout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    const minimizedWrites = minimized.writeCount;
    let resumedDuringReflow = false;
    visible.setWriteBehavior((_frame, commit) => {
      commit();

      if (!resumedDuringReflow) {
        resumedDuringReflow = true;
        setWindowState("minimized", minimized, false);
      }
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      expect(setup.controller.toggleFullscreen()).toBe(false);
    } finally {
      console.warn = warning;
      visible.setWriteBehavior(null);
    }

    expect(resumedDuringReflow).toBe(true);
    expect(minimized.window.minimized).toBe(false);
    expect(minimized.writeCount).toBe(minimizedWrites);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(0);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(setup.windows.map(({ window }) => window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it("rejects fullscreen when the active member is minimized during reflow", () => {
    const setup = createStackedFullscreenFixture(1);
    const writer = setup.windows[2];

    if (!writer) {
      throw new Error("missing active-invalidation fullscreen fixture");
    }

    const beforeLayout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    let invalidatedDuringReflow = false;
    writer.setWriteBehavior((_frame, commit) => {
      commit();

      if (!invalidatedDuringReflow) {
        invalidatedDuringReflow = true;
        setWindowState("minimized", setup.active, true);
      }
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      expect(setup.controller.toggleFullscreen()).toBe(false);
    } finally {
      console.warn = warning;
      writer.setWriteBehavior(null);
    }

    expect(invalidatedDuringReflow).toBe(true);
    expect(setup.active.window.minimized).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(0);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);

    const operationState = setup.controller as unknown as {
      readonly stackedNativeStateOperation: unknown;
      readonly windowTransferOperation: unknown;
    };
    expect(operationState.windowTransferOperation).toBeNull();
    expect(operationState.stackedNativeStateOperation).toBeNull();

    setWindowState("minimized", setup.active, false);
    flushManualScheduler(setup.scheduler);
    expect(setup.windows.map(({ window }) => window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it("handles a synchronous fullscreen signal while extraction is active", () => {
    const setup = createStackedFullscreenFixture(1);

    expect(setup.controller.toggleFullscreen()).toBe(true);

    const state = setup.controller as unknown as {
      readonly pendingWindowSyncs: ReadonlySet<WindowId>;
      readonly stackedNativeStateOperation: unknown;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly windowTransferOperation: unknown;
    };
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(state.pendingWindowSyncs.has(windowId("window-2"))).toBe(true);
    expect(state.suspendedWindows.has(windowId("window-2"))).toBe(true);
    expect(state.windowTransferOperation).toBeNull();
    expect(state.stackedNativeStateOperation).toBeNull();

    setup.controller.stop();
  });

  it("keeps a Wayland fullscreen extraction pending until its deferred commit", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(1);
    expect(setup.active.window.moveable).toBe(false);
    expect(setup.active.window.resizeable).toBe(false);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.controller.toggleFullscreen()).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(1);

    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(setup.fullscreen.writeCount).toBe(2);
    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    flushManualScheduler(setup.scheduler);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("cancels a deferred Wayland fullscreen request after silent mobility reversion", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);
    expect(state.suspendedWindows.has(activeId)).toBe(true);

    setup.fullscreen.restoreRequestedGeometry();
    flushManualScheduler(setup.scheduler);

    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.active.window.moveable).toBe(true);
    expect(setup.active.window.resizeable).toBe(true);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(state.suspendedWindows.has(activeId)).toBe(false);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("retains a pending Wayland fullscreen extraction through unrelated ownership refreshes", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.active.window.moveable).toBe(false);
    expect(setup.active.window.resizeable).toBe(false);

    setup.active.minimizedChanged.emit();
    setup.controller.reconcile();

    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    flushManualScheduler(setup.scheduler);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    flushManualScheduler(setup.scheduler);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.suspendedWindows.has(activeId)).toBe(false);

    setup.controller.stop();
  });

  it("releases an authoritative fullscreen mismatch into mobility-aware retention", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    expect(setup.active.window.moveable).toBe(false);
    expect(setup.active.window.resizeable).toBe(false);
    const layout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const frames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const frameWrites = setup.windows.map((window) => window.writeCount);

    setup.active.fullScreenChanged.emit();

    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);

    setup.active.minimizedChanged.emit();
    setup.controller.reconcile();
    flushManualScheduler(setup.scheduler);

    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(layout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(setup.windows.map((window) => window.writeCount)).toEqual(
      frameWrites,
    );
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);

    expect(setup.controller.toggleFullscreen()).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(2);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);

    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    flushManualScheduler(setup.scheduler);

    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(state.suspendedWindows.has(activeId)).toBe(false);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(layout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it("bounds an unconfirmed Wayland fullscreen request and releases its command gate", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly stackedNativeStateOperation: unknown;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly windowTransferOperation: unknown;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(state.pendingFullscreenTargets.get(activeId)).toBe(true);
    expect(setup.fullscreen.writeCount).toBe(1);
    expect(setup.fullscreen.fullScreen).toBe(false);

    flushManualScheduler(setup.scheduler);

    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);
    expect(state.windowTransferOperation).toBeNull();
    expect(state.stackedNativeStateOperation).toBeNull();
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);

    setup.active.minimizedChanged.emit();
    setup.controller.reconcile();
    flushManualScheduler(setup.scheduler);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);

    expect(setup.controller.toggleFullscreen()).toBe(false);
    expect(setup.fullscreen.writeCount).toBe(2);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);

    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.fullscreen.commitDeferred()).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(false);
    flushManualScheduler(setup.scheduler);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("clears unconfirmed fullscreen retention when requested mobility reverts", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    flushManualScheduler(setup.scheduler);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);

    setup.fullscreen.restoreRequestedGeometry();
    setup.active.minimizedChanged.emit();
    flushManualScheduler(setup.scheduler);

    expect(setup.active.window.moveable).toBe(true);
    expect(setup.active.window.resizeable).toBe(true);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("settles silent post-timeout mobility reversion during topology probing", () => {
    const setup = createStackedFullscreenFixture(1, { write: "defer" });
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly suspendedWindows: ReadonlySet<WindowId>;
      readonly unconfirmedFullscreenTargets: ReadonlyMap<WindowId, boolean>;
    };

    expect(setup.controller.toggleFullscreen()).toBe(true);
    flushManualScheduler(setup.scheduler);
    expect(state.unconfirmedFullscreenTargets.get(activeId)).toBe(true);
    expect(state.suspendedWindows.has(activeId)).toBe(true);
    const layout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const frames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    setup.fullscreen.restoreRequestedGeometry();
    setup.controller.probeTopology();
    flushManualScheduler(setup.scheduler);

    expect(setup.active.window.moveable).toBe(true);
    expect(setup.active.window.resizeable).toBe(true);
    expect(state.pendingFullscreenTargets.has(activeId)).toBe(false);
    expect(state.fullscreenRequestProbes.has(activeId)).toBe(false);
    expect(state.unconfirmedFullscreenTargets.has(activeId)).toBe(false);
    expect(state.suspendedWindows.has(activeId)).toBe(false);
    expect(setup.controller.managedCount).toBe(4);
    expect(setup.controller.automaticFloatingCount).toBe(0);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(layout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      frames,
    );

    setup.controller.stop();
  });

  it("restores exact default stack metadata after reconstructing the source column from fullscreen", () => {
    const setup = createStackedFullscreenFixture(1);
    const layout = installTestLayout(
      setup.controller,
      setup.output,
      setup.desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "proportion", value: 0.45 },
          windowIds: ["window-1", "window-2", "window-3"],
        },
        {
          id: "column:right",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-4"],
        },
      ],
    );
    setup.fixture.workspace.activeWindow = setup.active.window;
    flushManualScheduler(setup.scheduler);
    const beforeLayout = layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    flushManualScheduler(setup.scheduler);
    expect(setup.controller.moveWindowLeft()).toBe(true);
    expect(setup.controller.moveWindowUp()).toBe(true);

    expect(
      layout.snapshot(outputId(setup.output.name), desktopId(setup.desktop.id)),
    ).toEqual(beforeLayout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it.each(["reject", "throw"] as const)(
    "restores all stacked state when the fullscreen request is %s",
    (write) => {
      const setup = createStackedFullscreenFixture(1, { write });

      expect(setup.controller.maximizeColumn()).toBe(true);
      markOnlyRuntimeContextDirty(setup.controller);
      const beforeLayout = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      const beforeFrames = setup.windows.map((window) => ({
        ...window.window.frameGeometry,
      }));
      const beforeRuntime = stackedExtractionRuntimeState(setup.controller);
      const warning = console.warn;
      console.warn = () => undefined;

      try {
        expect(setup.controller.toggleFullscreen()).toBe(false);
      } finally {
        console.warn = warning;
      }

      expect(setup.fullscreen.fullScreen).toBe(false);
      expect(setup.fullscreen.writeCount).toBe(1);
      expect(
        setup.layout.snapshot(
          outputId(setup.output.name),
          desktopId(setup.desktop.id),
        ),
      ).toEqual(beforeLayout);
      expect(
        setup.windows.map((window) => window.window.frameGeometry),
      ).toEqual(beforeFrames);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
      expect(stackedExtractionRuntimeState(setup.controller)).toEqual(
        beforeRuntime,
      );

      setup.controller.stop();
    },
  );

  it("extracts an externally committed fullscreen window without writing its native frame", () => {
    const setup = createStackedFullscreenFixture(1);
    const activeFrame = { ...setup.active.window.frameGeometry };
    const activeWrites = setup.active.writeCount;

    setup.fullscreen.externalCommit(true);

    expect(setup.fullscreen.writeCount).toBe(0);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(setup.active.window.frameGeometry).toEqual(activeFrame);
    expect(setup.active.writeCount).toBe(activeWrites);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.fullscreen.externalCommit(false);
    flushManualScheduler(setup.scheduler);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it("does not commit external fullscreen extraction when the active window becomes modal during reflow", () => {
    const setup = createStackedFullscreenFixture(1);
    const writer = setup.windows[2];

    if (!writer) {
      throw new Error("missing external fullscreen classification fixture");
    }

    const beforeFrames = setup.windows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    let reclassifiedDuringReflow = false;
    writer.setWriteBehavior((_frame, commit) => {
      commit();

      if (!reclassifiedDuringReflow) {
        reclassifiedDuringReflow = true;
        Object.defineProperty(setup.active.window, "modal", {
          configurable: true,
          value: true,
        });
        setup.active.modalChanged.emit();
      }
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      setup.fullscreen.externalCommit(true);
    } finally {
      console.warn = warning;
      writer.setWriteBehavior(null);
    }

    expect(reclassifiedDuringReflow).toBe(true);
    expect(setup.fullscreen.fullScreen).toBe(true);
    expect(setup.active.window.modal).toBe(true);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.active.window.frameGeometry).toEqual(beforeFrames[1]);
    expect(setup.fullscreen.writeCount).toBe(0);

    const operationState = setup.controller as unknown as {
      readonly stackedNativeStateOperation: unknown;
      readonly windowTransferOperation: unknown;
    };
    expect(operationState.windowTransferOperation).toBeNull();
    expect(operationState.stackedNativeStateOperation).toBeNull();

    setup.controller.stop();
  });

  it("retries external fullscreen extraction after activation and startup barriers clear", () => {
    const setup = createStackedFullscreenFixture(1);
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly pendingExternalFullscreenExtractions: ReadonlyMap<
        WindowId,
        unknown
      >;
      startupStabilizationToken: object | null;
    };
    const otherWindow = setup.windows[3]?.window;

    if (!otherWindow) {
      throw new Error("missing delayed fullscreen activation target");
    }

    setup.fixture.workspace.activeWindow = otherWindow;
    flushManualScheduler(setup.scheduler);
    const activeFrame = { ...setup.active.window.frameGeometry };
    const activeWrites = setup.active.writeCount;
    state.startupStabilizationToken = {};

    setup.fullscreen.externalCommit(true);

    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(true);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      {
        id: "column:stack",
        windowIds: ["window-1", "window-2", "window-3"],
      },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.fixture.workspace.activeWindow = setup.active.window;
    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(true);
    state.startupStabilizationToken = null;
    setup.controller.reconcile();

    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(
      false,
    );
    expect(setup.active.window.frameGeometry).toEqual(activeFrame);
    expect(setup.active.writeCount).toBe(activeWrites);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.fullscreen.externalCommit(false);
    flushManualScheduler(setup.scheduler);
    setup.controller.stop();
  });

  it("extracts an external fullscreen window past a settled minimized sibling", () => {
    const setup = createStackedFullscreenFixture(1);
    const activeId = windowId("window-2");
    const minimized = setup.windows[0];
    const visible = setup.windows[2];
    const state = setup.controller as unknown as {
      readonly pendingExternalFullscreenExtractions: ReadonlyMap<
        WindowId,
        unknown
      >;
    };

    if (!minimized || !visible) {
      throw new Error("missing minimized external fullscreen stack fixture");
    }

    setWindowState("minimized", minimized, true);
    flushManualScheduler(setup.scheduler);
    const activeFrame = { ...setup.active.window.frameGeometry };
    const activeWrites = setup.active.writeCount;
    const minimizedFrame = { ...minimized.window.frameGeometry };
    const minimizedWrites = minimized.writeCount;
    const visibleFrame = { ...visible.window.frameGeometry };
    const visibleWrites = visible.writeCount;

    setup.fullscreen.externalCommit(true);

    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(
      false,
    );
    expect(setup.active.window.frameGeometry).toEqual(activeFrame);
    expect(setup.active.writeCount).toBe(activeWrites);
    expect(minimized.window.minimized).toBe(true);
    expect(minimized.window.frameGeometry).toEqual(minimizedFrame);
    expect(minimized.writeCount).toBe(minimizedWrites);
    expect(visible.window.frameGeometry).not.toEqual(visibleFrame);
    expect(visible.writeCount).toBeGreaterThan(visibleWrites);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.fullscreen.externalCommit(false);
    flushManualScheduler(setup.scheduler);
    setup.controller.stop();
  });

  it("drops a pending external fullscreen extraction when fullscreen exits", () => {
    const setup = createStackedFullscreenFixture(1);
    const activeId = windowId("window-2");
    const state = setup.controller as unknown as {
      readonly pendingExternalFullscreenExtractions: ReadonlyMap<
        WindowId,
        unknown
      >;
    };
    const otherWindow = setup.windows[3]?.window;

    if (!otherWindow) {
      throw new Error("missing delayed fullscreen activation target");
    }

    setup.fixture.workspace.activeWindow = otherWindow;
    flushManualScheduler(setup.scheduler);
    setup.fullscreen.externalCommit(true);
    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(true);

    setup.fullscreen.externalCommit(false);

    expect(state.pendingExternalFullscreenExtractions.has(activeId)).toBe(
      false,
    );
    flushManualScheduler(setup.scheduler);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      {
        id: "column:stack",
        windowIds: ["window-1", "window-2", "window-3"],
      },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("copies full-width restore state to the fullscreen extraction", () => {
    const setup = createStackedFullscreenFixture(1);

    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({ kind: "proportion", value: 1 });
    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    flushManualScheduler(setup.scheduler);

    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({ kind: "proportion", value: 0.45 });
    setup.fixture.workspace.activeWindow = setup.windows[0]?.window ?? null;
    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({ kind: "proportion", value: 0.45 });

    setup.controller.stop();
  });

  it("rolls back fullscreen extraction before invoking KWin on a frame failure", () => {
    const setup = createStackedFullscreenFixture(1);
    const beforeLayout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const beforeRuntime = stackedExtractionRuntimeState(setup.controller);
    let rejectNextWrite = true;
    setup.windows[3]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("injected stacked fullscreen frame failure");
      }

      commit();
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      expect(setup.controller.toggleFullscreen()).toBe(false);
    } finally {
      console.warn = warning;
      setup.windows[3]?.setWriteBehavior(null);
    }

    expect(setup.fullscreen.writeCount).toBe(0);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
    expect(stackedExtractionRuntimeState(setup.controller)).toEqual(
      beforeRuntime,
    );

    setup.controller.stop();
  });

  it("blocks reentrant fullscreen toggles and clears the operation token", () => {
    const setup = createStackedFullscreenFixture(1);
    let nestedResult: boolean | null = null;
    setup.fullscreen.setWriteHook(() => {
      nestedResult = setup.controller.toggleFullscreen();
    });

    expect(setup.controller.toggleFullscreen()).toBe(true);
    expect(nestedResult).toBe(false);
    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly stackedNativeStateOperation: unknown;
      readonly windowTransferOperation: unknown;
    };
    expect(state.windowTransferOperation).toBeNull();
    expect(state.stackedNativeStateOperation).toBeNull();
    expect(state.pendingFullscreenTargets.has(windowId("window-2"))).toBe(
      false,
    );
    expect(state.fullscreenRequestProbes.has(windowId("window-2"))).toBe(false);

    setup.fullscreen.setWriteHook(null);
    expect(setup.controller.toggleFullscreen()).toBe(true);
    flushManualScheduler(setup.scheduler);
    expect(setup.fullscreen.fullScreen).toBe(false);

    setup.controller.stop();
  });

  it("clears fullscreen extraction tokens when the active window is removed during the request", () => {
    const setup = createStackedFullscreenFixture(1);
    setup.fullscreen.setWriteHook(() => {
      setup.fixture.windowRemoved.emit(setup.active.window);
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      expect(setup.controller.toggleFullscreen()).toBe(false);
    } finally {
      console.warn = warning;
    }

    const state = setup.controller as unknown as {
      readonly fullscreenRequestProbes: ReadonlyMap<WindowId, unknown>;
      readonly pendingFullscreenTargets: ReadonlyMap<WindowId, boolean>;
      readonly stackedNativeStateOperation: unknown;
      readonly windowTransferOperation: unknown;
    };
    expect(state.windowTransferOperation).toBeNull();
    expect(state.stackedNativeStateOperation).toBeNull();
    expect(state.pendingFullscreenTargets.has(windowId("window-2"))).toBe(
      false,
    );
    expect(state.fullscreenRequestProbes.has(windowId("window-2"))).toBe(false);
    expect(setup.controller.managedCount).toBe(3);

    setup.controller.stop();
  });

  it("delegates maximize-to-edges to KWin without changing the tiled layout", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[2];

    if (!active) {
      throw new Error("missing maximize fixture");
    }

    const maximize = controlMaximize(active);
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

    expect(controller.start()).toBe(true);
    const layout = runtimeLayout(controller);
    layout.setViewportOffset(outputId(output.name), desktopId(desktop.id), 125);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const frameWrites = windows.map(({ writeCount }) => writeCount);

    expect(controller.maximizeWindowToEdges()).toBe(true);
    expect(maximize.maximizeMode).toBe(3);
    expect(maximize.calls).toEqual([[true, true]]);
    expect(
      (
        controller as unknown as {
          readonly suspendedWindows: ReadonlySet<WindowId>;
        }
      ).suspendedWindows.has(windowId("window-3")),
    ).toBe(true);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(frameWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    maximize.maximizable = false;
    expect(controller.maximizeWindowToEdges()).toBe(true);
    expect(maximize.maximizeMode).toBe(0);
    expect(maximize.calls).toEqual([
      [true, true],
      [false, false],
    ]);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(frameWrites);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    controller.stop();
  });

  it.each([
    {
      activeIndex: 0,
      expectedHeights: [
        { clientHeight: 240, kind: "fixed" },
        { kind: "auto", weight: 4 },
      ],
      expectedSourceIds: ["window-2", "window-3"],
      name: "top",
    },
    {
      activeIndex: 1,
      expectedHeights: [
        { kind: "auto", weight: 2 },
        { kind: "auto", weight: 4 },
      ],
      expectedSourceIds: ["window-1", "window-3"],
      name: "middle",
    },
    {
      activeIndex: 2,
      expectedHeights: [
        { kind: "auto", weight: 2 },
        { clientHeight: 240, kind: "fixed" },
      ],
      expectedSourceIds: ["window-1", "window-2"],
      name: "bottom",
    },
  ] as const)(
    "extracts the $name stack member before native maximize",
    ({ activeIndex, expectedHeights, expectedSourceIds }) => {
      const setup = createStackedMaximizeFixture(activeIndex);
      const activeId = String(setup.active.window.internalId);

      expect(setup.controller.maximizeWindowToEdges()).toBe(true);
      expect(setup.maximize.maximizeMode).toBe(3);
      expect(setup.maximize.calls).toEqual([[true, true]]);

      const maximized = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      expect(maximized.columns.map((column) => String(column.id))).toEqual([
        "column:stack",
        `column:${activeId}`,
        "column:right",
      ]);
      expect(maximized.columns[0]).toMatchObject({
        id: "column:stack",
        width: { kind: "proportion", value: 0.45 },
        windowHeights: expectedHeights,
        windowIds: expectedSourceIds,
      });
      expect(maximized.columns[1]).toEqual({
        id: `column:${activeId}`,
        width: { kind: "proportion", value: 0.45 },
        windowIds: [activeId],
      });
      expect(maximized.activeColumnId).toBe(`column:${activeId}`);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

      expect(setup.controller.maximizeWindowToEdges()).toBe(true);
      expect(setup.maximize.maximizeMode).toBe(0);
      flushManualScheduler(setup.scheduler);
      expect(
        testLayoutColumns(setup.controller, setup.output, setup.desktop),
      ).toEqual([
        { id: "column:stack", windowIds: expectedSourceIds },
        { id: `column:${activeId}`, windowIds: [activeId] },
        { id: "column:right", windowIds: ["window-4"] },
      ]);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

      setup.controller.stop();
    },
  );

  it("extracts native maximize past a settled minimized stack member", () => {
    const setup = createStackedMaximizeFixture(1);
    const visible = setup.windows[0];
    const minimized = setup.windows[2];

    if (!visible || !minimized) {
      throw new Error("missing minimized maximize stack fixture");
    }

    setWindowState("minimized", minimized, true);
    flushManualScheduler(setup.scheduler);
    const minimizedFrame = { ...minimized.window.frameGeometry };
    const minimizedWrites = minimized.writeCount;
    const visibleFrame = { ...visible.window.frameGeometry };
    const visibleWrites = visible.writeCount;

    expect(setup.controller.maximizeWindowToEdges()).toBe(true);

    const maximized = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    expect(maximized.columns[0]).toMatchObject({
      id: "column:stack",
      windowHeights: [
        { kind: "auto", weight: 2 },
        { kind: "auto", weight: 4 },
      ],
      windowIds: ["window-1", "window-3"],
    });
    expect(maximized.columns[1]).toEqual({
      id: "column:window-2",
      width: { kind: "proportion", value: 0.45 },
      windowIds: ["window-2"],
    });
    expect(minimized.window.minimized).toBe(true);
    expect(minimized.window.frameGeometry).toEqual(minimizedFrame);
    expect(minimized.writeCount).toBe(minimizedWrites);
    expect(visible.window.frameGeometry).not.toEqual(visibleFrame);
    expect(visible.window.frameGeometry.height).toBeGreaterThan(
      visibleFrame.height,
    );
    expect(visible.writeCount).toBeGreaterThan(visibleWrites);
    expect(setup.maximize.maximizeMode).toBe(3);
    expect(setup.maximize.calls).toEqual([[true, true]]);

    setup.controller.stop();
  });

  it("accepts a synchronous maximize request before its deferred commit", () => {
    const setup = createStackedMaximizeFixture(1, { write: "defer" });

    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    expect(setup.maximize.maximizeMode).toBe(0);
    expect(setup.maximize.calls).toEqual([[true, true]]);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    expect(setup.maximize.commitDeferred()).toBe(true);
    expect(setup.maximize.maximizeMode).toBe(3);
    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    expect(setup.maximize.maximizeMode).toBe(3);
    expect(setup.maximize.commitDeferred()).toBe(true);
    expect(setup.maximize.maximizeMode).toBe(0);
    flushManualScheduler(setup.scheduler);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.controller.stop();
  });

  it("restores exact stack metadata after reconstructing the source column", () => {
    const setup = createStackedMaximizeFixture(1);
    const layout = installTestLayout(
      setup.controller,
      setup.output,
      setup.desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "proportion", value: 0.45 },
          windowIds: ["window-1", "window-2", "window-3"],
        },
        {
          id: "column:right",
          width: { kind: "fixed", value: 240 },
          windowIds: ["window-4"],
        },
      ],
    );
    setup.fixture.workspace.activeWindow = setup.active.window;
    flushManualScheduler(setup.scheduler);
    const beforeLayout = layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));

    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    flushManualScheduler(setup.scheduler);
    expect(setup.controller.moveWindowLeft()).toBe(true);
    expect(setup.controller.moveWindowUp()).toBe(true);

    expect(
      layout.snapshot(outputId(setup.output.name), desktopId(setup.desktop.id)),
    ).toEqual(beforeLayout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);

    setup.controller.stop();
  });

  it.each(["reject", "throw"] as const)(
    "restores all stacked state when the maximize request is %s",
    (write) => {
      const setup = createStackedMaximizeFixture(1, { write });

      expect(setup.controller.maximizeColumn()).toBe(true);
      expect(
        activeColumnWidth(setup.controller, setup.output, setup.desktop),
      ).toEqual({
        kind: "proportion",
        value: 1,
      });
      markOnlyRuntimeContextDirty(setup.controller);
      const beforeLayout = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      const beforeFrames = setup.windows.map((window) => ({
        ...window.window.frameGeometry,
      }));
      const beforeRuntime = stackedExtractionRuntimeState(setup.controller);
      const warning = console.warn;
      console.warn = () => undefined;

      try {
        expect(setup.controller.maximizeWindowToEdges()).toBe(false);
      } finally {
        console.warn = warning;
      }

      expect(setup.maximize.maximizeMode).toBe(0);
      expect(setup.maximize.calls).toEqual([[true, true]]);
      expect(
        setup.layout.snapshot(
          outputId(setup.output.name),
          desktopId(setup.desktop.id),
        ),
      ).toEqual(beforeLayout);
      expect(
        setup.windows.map((window) => window.window.frameGeometry),
      ).toEqual(beforeFrames);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
      expect(stackedExtractionRuntimeState(setup.controller)).toEqual(
        beforeRuntime,
      );

      setup.controller.stop();
    },
  );

  it.each([
    { expectedMode: 1, requestModes: [1], name: "vertical" },
    { expectedMode: 2, requestModes: [2], name: "horizontal" },
    { expectedMode: 3, requestModes: [3, 3], name: "duplicate" },
  ] as const)(
    "rolls back a $name native maximize request without clearing suspension",
    ({ expectedMode, requestModes }) => {
      const setup = createStackedMaximizeFixture(1, { requestModes });
      const beforeLayout = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      const beforeFrames = setup.windows.map((window) => ({
        ...window.window.frameGeometry,
      }));
      const warning = console.warn;
      console.warn = () => undefined;

      try {
        expect(setup.controller.maximizeWindowToEdges()).toBe(false);
      } finally {
        console.warn = warning;
      }

      const state = setup.controller as unknown as {
        readonly pendingWindowSyncs: ReadonlySet<WindowId>;
        readonly stackedNativeStateOperation: unknown;
        readonly suspendedWindows: ReadonlySet<WindowId>;
        readonly windowTransferOperation: unknown;
      };
      expect(setup.maximize.maximizeMode).toBe(expectedMode);
      expect(
        setup.layout.snapshot(
          outputId(setup.output.name),
          desktopId(setup.desktop.id),
        ),
      ).toEqual(beforeLayout);
      expect(
        setup.windows
          .filter((_window, index) => index !== 1)
          .map((window) => window.window.frameGeometry),
      ).toEqual(beforeFrames.filter((_frame, index) => index !== 1));
      expect(setup.active.window.frameGeometry).not.toEqual(beforeFrames[1]);
      expect(setup.active.window.frameGeometry.height).toBe(780);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
      expect(state.pendingWindowSyncs.has(windowId("window-2"))).toBe(true);
      expect(state.suspendedWindows.has(windowId("window-2"))).toBe(true);
      expect(state.windowTransferOperation).toBeNull();
      expect(state.stackedNativeStateOperation).toBeNull();

      setup.controller.stop();
    },
  );

  it("extracts an app-requested maximize and keeps it separate after exit", () => {
    const setup = createStackedMaximizeFixture(1);
    const minimized = setup.windows[2];

    if (!minimized) {
      throw new Error("missing app-requested maximize peer");
    }

    setWindowState("minimized", minimized, true);
    flushManualScheduler(setup.scheduler);
    const minimizedFrame = { ...minimized.window.frameGeometry };
    const minimizedWrites = minimized.writeCount;

    setup.maximize.externalRequest(3);
    expect(setup.maximize.calls).toEqual([]);
    expect(setup.maximize.maximizeMode).toBe(3);
    expect(minimized.window.minimized).toBe(true);
    expect(minimized.window.frameGeometry).toEqual(minimizedFrame);
    expect(minimized.writeCount).toBe(minimizedWrites);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);

    setup.maximize.externalRequest(0);
    flushManualScheduler(setup.scheduler);
    expect(setup.maximize.maximizeMode).toBe(0);
    expect(
      testLayoutColumns(setup.controller, setup.output, setup.desktop),
    ).toEqual([
      { id: "column:stack", windowIds: ["window-1", "window-3"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:right", windowIds: ["window-4"] },
    ]);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
    expect(minimized.window.frameGeometry).toEqual(minimizedFrame);
    expect(minimized.writeCount).toBe(minimizedWrites);

    setWindowState("minimized", minimized, false);
    flushManualScheduler(setup.scheduler);

    setup.controller.stop();
  });

  it("copies full-width restore state to the extracted column", () => {
    const setup = createStackedMaximizeFixture(1);

    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({
      kind: "proportion",
      value: 1,
    });
    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    expect(setup.controller.maximizeWindowToEdges()).toBe(true);
    flushManualScheduler(setup.scheduler);

    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({
      kind: "proportion",
      value: 0.45,
    });
    setup.fixture.workspace.activeWindow = setup.windows[0]?.window ?? null;
    expect(setup.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output, setup.desktop),
    ).toEqual({
      kind: "proportion",
      value: 0.45,
    });

    setup.controller.stop();
  });

  it("rolls back stacked extraction before invoking KWin on a frame failure", () => {
    const setup = createStackedMaximizeFixture(1);
    const beforeLayout = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const beforeFrames = setup.windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const beforeRuntime = stackedExtractionRuntimeState(setup.controller);
    let rejectNextWrite = true;
    setup.windows[3]?.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("injected stacked maximize frame failure");
      }

      commit();
    });
    const warning = console.warn;
    console.warn = () => undefined;

    try {
      expect(setup.controller.maximizeWindowToEdges()).toBe(false);
    } finally {
      console.warn = warning;
      setup.windows[3]?.setWriteBehavior(null);
    }

    expect(setup.maximize.calls).toEqual([]);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(setup.windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(setup.fixture.workspace.activeWindow).toBe(setup.active.window);
    expect(stackedExtractionRuntimeState(setup.controller)).toEqual(
      beforeRuntime,
    );

    setup.controller.stop();
  });

  it("rejects maximize-to-edges when KWin cannot perform it", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const unsupportedWindow = createTrackedWindow(
      "unsupported",
      output,
      desktop,
    );
    const unsupportedMaximize = controlMaximize(unsupportedWindow, {
      maximizable: false,
    });
    const unsupportedFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [unsupportedWindow.window],
    );
    const unsupported = new RuntimeController(unsupportedFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(unsupported.start()).toBe(true);
    expect(unsupported.maximizeWindowToEdges()).toBe(false);
    expect(unsupportedMaximize.calls).toEqual([]);
    unsupported.stop();

    const missingWindow = createTrackedWindow("missing", output, desktop);
    const missingFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [missingWindow.window],
    );
    const missing = new RuntimeController(missingFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(missing.start()).toBe(true);
    expect(missing.maximizeWindowToEdges()).toBe(false);
    missing.stop();
  });

  it("rejects maximize-to-edges without a live managed active window", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const stoppedWindow = createTrackedWindow("stopped", output, desktop);
    const stoppedMaximize = controlMaximize(stoppedWindow);
    const stoppedFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [stoppedWindow.window],
    );
    const stopped = new RuntimeController(stoppedFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(stopped.maximizeWindowToEdges()).toBe(false);
    expect(stoppedMaximize.calls).toEqual([]);

    const emptyFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [],
    );
    const empty = new RuntimeController(emptyFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(empty.start()).toBe(true);
    expect(empty.maximizeWindowToEdges()).toBe(false);
    empty.stop();

    for (const [name, overrides] of [
      ["deleted", { deleted: true }],
      ["unmanaged", { managed: false }],
    ] as const) {
      const window = createTrackedWindow(name, output, desktop, overrides);
      const maximize = controlMaximize(window);
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [window.window],
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
      });

      expect(controller.start()).toBe(true);
      expect(controller.maximizeWindowToEdges()).toBe(false);
      expect(maximize.calls).toEqual([]);
      controller.stop();
    }
  });

  it("reports a throwing maximize request without layout changes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const maximize = controlMaximize(active, { write: "throw" });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frame = { ...active.window.frameGeometry };
    const frameWrites = active.writeCount;

    expect(controller.maximizeWindowToEdges()).toBe(false);
    expect(maximize.maximizeMode).toBe(0);
    expect(maximize.calls).toEqual([[true, true]]);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(active.window.frameGeometry).toEqual(frame);
    expect(active.writeCount).toBe(frameWrites);

    controller.stop();
  });

  it("preserves manual-floating ownership through maximize-to-edges", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const maximize = controlMaximize(active);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      schedule: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    const floatingFrame = { ...active.window.frameGeometry };
    const frameWrites = active.writeCount;
    const layout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.maximizeWindowToEdges()).toBe(true);
    expect(maximize.maximizeMode).toBe(3);
    expect(controller.maximizeWindowToEdges()).toBe(true);
    expect(maximize.maximizeMode).toBe(0);
    expect(maximize.calls).toEqual([
      [true, true],
      [false, false],
    ]);
    expect(controller.floatingCount).toBe(1);
    expect(controller.managedCount).toBe(0);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(frameWrites);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layout);
    expect(fixture.workspace.activeWindow).toBe(active.window);

    controller.stop();
  });

  it("applies optional borderless windows and restores owned decoration state", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const borderless = createTrackedWindow("borderless", output, desktop, {
      noBorder: true,
    });
    const dialog = createTrackedWindow("dialog", output, desktop, {
      dialog: true,
      noBorder: false,
      normalWindow: false,
    });
    const fixed = createTrackedWindow("fixed", output, desktop, {
      noBorder: false,
      resizeable: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window, borderless.window, dialog.window, fixed.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);
    expect(borderless.window.noBorder).toBe(true);
    expect(dialog.window.noBorder).toBe(true);
    expect(fixed.window.noBorder).toBe(true);

    controller.stop();
    expect(decorated.window.noBorder).toBe(false);
    expect(borderless.window.noBorder).toBe(true);
    expect(dialog.window.noBorder).toBe(false);
    expect(fixed.window.noBorder).toBe(false);
  });

  it("keeps decorations when borderless windows are disabled", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: false,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(false);
  });

  it("reconfigures owned window decorations without claiming existing borderless state", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const borderless = createTrackedWindow("borderless", output, desktop, {
      noBorder: true,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window, borderless.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: false,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    controller.setBorderlessWindows(true);
    expect(decorated.window.noBorder).toBe(true);
    expect(borderless.window.noBorder).toBe(true);

    controller.setBorderlessWindows(false);
    expect(decorated.window.noBorder).toBe(false);
    expect(borderless.window.noBorder).toBe(true);
  });

  it("keeps owned decorations hidden while floating", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);

    controller.stop();
    expect(decorated.window.noBorder).toBe(false);
  });

  it("reasserts owned borderless state after an external policy change", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);

    decorated.window.noBorder = false;
    expect(decorated.window.noBorder).toBe(true);

    controller.setBorderlessWindows(false);
    expect(decorated.window.noBorder).toBe(false);
  });

  it("retries borderless state while a new window decoration settles", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      noBorder: false,
    });
    const scheduler = new ManualScheduler();
    let acceptsBorderless = false;
    let noBorder = false;

    Object.defineProperty(decorated.window, "noBorder", {
      configurable: true,
      get: () => noBorder,
      set: (value: boolean) => {
        if (value && !acceptsBorderless) {
          return;
        }

        noBorder = value;
        decorated.decorationPolicyChanged.emit();
      },
    });

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
      scheduleResume: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(false);
    expect(scheduler.pendingCount).toBe(1);

    acceptsBorderless = true;
    scheduler.flush();
    expect(decorated.window.noBorder).toBe(true);

    controller.stop();
    expect(decorated.window.noBorder).toBe(false);
  });

  it("restores the pre-claim frame after synchronous decoration changes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const originalFrame = { height: 290, width: 380, x: 100, y: 80 };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      clientGeometry: { height: 254, width: 368, x: 106, y: 110 },
      frameGeometry: originalFrame,
      noBorder: false,
    });
    let noBorder = false;

    Object.defineProperty(decorated.window, "noBorder", {
      configurable: true,
      get: () => noBorder,
      set: (value: boolean) => {
        if (noBorder === value) {
          return;
        }

        noBorder = value;
        const frame = decorated.window.frameGeometry;
        decorated.setFrameGeometry(
          value
            ? { height: 254, width: 368, x: 106, y: 110 }
            : {
                height: frame.height + 36,
                width: frame.width + 12,
                x: frame.x - 6,
                y: frame.y - 30,
              },
        );
        decorated.decorationPolicyChanged.emit();
      },
    });

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(decorated.window.noBorder).toBe(true);

    controller.stop();
    expect(decorated.window.noBorder).toBe(false);
    expect(decorated.window.frameGeometry).toEqual(originalFrame);
  });

  it("preserves client geometry while floating across decoration reconfiguration", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const originalClient = { height: 254, width: 368, x: 106, y: 110 };
    const originalFrame = { height: 290, width: 380, x: 100, y: 80 };
    const decorated = createTrackedWindow("decorated", output, desktop, {
      clientGeometry: originalClient,
      frameGeometry: originalFrame,
      noBorder: false,
    });
    let noBorder = false;

    Object.defineProperty(decorated.window, "clientGeometry", {
      configurable: true,
      get: () => {
        const frame = decorated.window.frameGeometry;
        return noBorder
          ? { ...frame }
          : {
              height: frame.height - 36,
              width: frame.width - 12,
              x: frame.x + 6,
              y: frame.y + 30,
            };
      },
    });
    Object.defineProperty(decorated.window, "noBorder", {
      configurable: true,
      get: () => noBorder,
      set: (value: boolean) => {
        if (noBorder === value) {
          return;
        }

        const client = decorated.window.clientGeometry;
        noBorder = value;
        decorated.setFrameGeometry(
          value
            ? client
            : {
                height: client.height + 36,
                width: client.width + 12,
                x: client.x - 6,
                y: client.y - 30,
              },
        );
        decorated.decorationPolicyChanged.emit();
      },
    });

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [decorated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: false,
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    controller.setBorderlessWindows(true);
    expect(controller.toggleFloating()).toBe(true);
    expect(decorated.window.frameGeometry).toEqual(originalClient);
    expect(controller.toggleFloating()).toBe(true);

    controller.setBorderlessWindows(false);
    expect(controller.toggleFloating()).toBe(true);
    expect(decorated.window.frameGeometry).toEqual(originalFrame);
    expect(controller.toggleFloating()).toBe(true);

    controller.stop();
    expect(decorated.window.frameGeometry).toEqual(originalFrame);
  });

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
      () => controller.moveColumnToPreviousDesktop(),
      () => controller.moveColumnToNextDesktop(),
      () => controller.moveWindowToOutputLeft(),
      () => controller.moveWindowToOutputRight(),
      () => controller.moveWindowToOutputUp(),
      () => controller.moveWindowToOutputDown(),
      () => controller.moveColumnToOutputLeft(),
      () => controller.moveColumnToOutputRight(),
      () => controller.moveColumnToOutputUp(),
      () => controller.moveColumnToOutputDown(),
      () => controller.decreaseColumnWidth(),
      () => controller.increaseColumnWidth(),
      () => controller.resetColumnWidth(),
      () => controller.switchPresetColumnWidth(),
      () => controller.switchPresetColumnWidthBack(),
      () => controller.maximizeColumn(),
      () => controller.centerColumn(),
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

    Object.defineProperty(becomingTransient.window, "noBorder", {
      configurable: true,
      value: false,
      writable: true,
    });

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 400 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(becomingTransient.window.noBorder).toBe(true);
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

    expect(becomingTransient.window.noBorder).toBe(true);
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

  it("focuses the first and last columns without wrapping", () => {
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

    controller.start();
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(controller.focusFirstColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      0, 495, 990,
    ]);
    expect(controller.focusFirstColumn()).toBe(false);

    expect(controller.focusLastColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      -475, 20, 515,
    ]);
    expect(controller.focusLastColumn()).toBe(false);
    expect(fixture.activationCount).toBe(2);
  });

  it("skips minimized stack members vertically without changing their slots", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 8 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
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
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 620 },
          windowHeights: [
            { kind: "auto", weight: 1 },
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 3 },
            { kind: "auto", weight: 4 },
            { kind: "auto", weight: 5 },
            { kind: "auto", weight: 6 },
            { kind: "auto", weight: 7 },
          ],
          windowIds: [
            "window-1",
            "window-2",
            "window-3",
            "window-4",
            "window-5",
            "window-6",
            "window-7",
          ],
        },
        {
          id: "column:right",
          width: { kind: "proportion", value: 0.55 },
          windowIds: ["window-8"],
        },
      ],
    );
    expect(
      layout.setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        137,
      ),
    ).toBe(true);
    fixture.workspace.activeWindow = windows[3]?.window ?? null;
    controller.reconcile();
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);
    const minimizedTop = windows[1];
    const minimizedUpperMiddle = windows[2];
    const minimizedLowerMiddle = windows[4];
    const minimizedBottom = windows[5];

    if (
      !minimizedTop ||
      !minimizedUpperMiddle ||
      !minimizedLowerMiddle ||
      !minimizedBottom
    ) {
      throw new Error("missing minimized stack fixture");
    }

    const minimized = [
      minimizedTop,
      minimizedUpperMiddle,
      minimizedLowerMiddle,
      minimizedBottom,
    ];

    for (const candidate of minimized) {
      setWindowState("minimized", candidate, true);
    }

    flushManualScheduler(scheduler);
    const activationCount = fixture.activationCount;

    expect(controller.focusUp()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
    fixture.workspace.activeWindow = windows[3]?.window ?? null;
    expect(controller.focusDown()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[6]?.window);
    expect(controller.focusDown()).toBe(false);
    fixture.workspace.activeWindow = windows[0]?.window ?? null;
    expect(controller.focusUp()).toBe(false);
    expect(fixture.activationCount).toBe(activationCount + 4);
    expect(minimized.every(({ window }) => window.minimized)).toBe(true);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);

    for (const candidate of minimized) {
      setWindowState("minimized", candidate, false);
    }

    flushManualScheduler(scheduler);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    const restoredStack = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    ).columns[0];
    expect(restoredStack && columnWindowHeights(restoredStack)).toEqual(
      before.columns[0]?.windowHeights,
    );
  });

  it("skips fully minimized columns and selects a visible stack member", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 10 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
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
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:active",
      [
        {
          id: "column:minimized-first",
          width: { kind: "fixed", value: 170 },
          windowIds: ["window-1"],
        },
        {
          id: "column:left",
          width: { kind: "fixed", value: 180 },
          windowIds: ["window-2"],
        },
        {
          id: "column:minimized-left",
          width: { kind: "fixed", value: 190 },
          windowHeights: [
            { clientHeight: 220, kind: "fixed" },
            { kind: "auto", weight: 3 },
          ],
          windowIds: ["window-3", "window-4"],
        },
        {
          id: "column:active",
          width: { kind: "proportion", value: 0.4 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 5 },
          ],
          windowIds: ["window-5", "window-6"],
        },
        {
          id: "column:minimized-right",
          width: { kind: "fixed", value: 210 },
          windowIds: ["window-7"],
        },
        {
          id: "column:right",
          width: { kind: "fixed", value: 220 },
          windowHeights: [
            { kind: "auto", weight: 1 },
            { clientHeight: 260, kind: "fixed" },
          ],
          windowIds: ["window-8", "window-9"],
        },
        {
          id: "column:minimized-last",
          width: { kind: "fixed", value: 230 },
          windowIds: ["window-10"],
        },
      ],
    );
    fixture.workspace.activeWindow = windows[5]?.window ?? null;
    const minimizedIndices = [0, 2, 3, 4, 6, 7, 9];

    for (const index of minimizedIndices) {
      const candidate = windows[index];

      if (!candidate) {
        throw new Error("missing minimized column fixture");
      }

      setWindowState("minimized", candidate, true);
    }

    flushManualScheduler(scheduler);
    const beforeColumns = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    ).columns;
    const minimizedWindows = minimizedIndices.map((index) => {
      const candidate = windows[index];

      if (!candidate) {
        throw new Error("missing minimized column fixture");
      }

      return candidate;
    });
    const minimizedFrames = minimizedWindows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    const minimizedWrites = minimizedWindows.map(
      ({ writeCount }) => writeCount,
    );

    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    fixture.workspace.activeWindow = windows[5]?.window ?? null;
    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[8]?.window);
    expect(controller.focusFirstColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(controller.focusLastColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[8]?.window);
    expect(controller.focusLastColumn()).toBe(false);
    expect(minimizedWindows.every(({ window }) => window.minimized)).toBe(true);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)).columns,
    ).toEqual(beforeColumns);
    expect(minimizedWindows.map(({ window }) => window.frameGeometry)).toEqual(
      minimizedFrames,
    );
    expect(minimizedWindows.map(({ writeCount }) => writeCount)).toEqual(
      minimizedWrites,
    );
  });

  it.each([
    "fullscreen",
    "maximized",
    "native tiled",
    "restore settling",
    "toggle unsettled",
  ] as const)(
    "stops at a non-minimized %s blocker while scanning focus targets",
    (blockedState) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const windows = Array.from({ length: 7 }, (_value, index) =>
        createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
      );
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      const layout = installTestLayout(
        controller,
        output,
        desktop,
        "column:active",
        [
          {
            id: "column:active",
            width: { kind: "fixed", value: 300 },
            windowIds: ["window-1", "window-2", "window-3", "window-4"],
          },
          {
            id: "column:nearest",
            width: { kind: "fixed", value: 300 },
            windowIds: ["window-5", "window-6"],
          },
          {
            id: "column:farther",
            width: { kind: "fixed", value: 300 },
            windowIds: ["window-7"],
          },
        ],
      );
      fixture.workspace.activeWindow = windows[0]?.window ?? null;
      const firstMinimized = windows[1];
      const verticalBlocker = windows[2];
      const columnMinimized = windows[4];
      const horizontalBlocker = windows[5];

      if (
        !firstMinimized ||
        !verticalBlocker ||
        !columnMinimized ||
        !horizontalBlocker
      ) {
        throw new Error("missing blocked focus fixture");
      }

      setWindowState("minimized", firstMinimized, true);
      blockWindowFocus(controller, verticalBlocker, blockedState);
      setWindowState("minimized", columnMinimized, true);
      blockWindowFocus(controller, horizontalBlocker, blockedState);
      flushManualScheduler(scheduler);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;

      expect(controller.focusDown()).toBe(false);
      expect(controller.focusRight()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
      expect(firstMinimized.window.minimized).toBe(true);
      expect(columnMinimized.window.minimized).toBe(true);
    },
  );

  it("keeps focus and geometry after a partial edge-focus failure", () => {
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
    windows[1]?.setWriteBehavior(() => {
      throw new Error("geometry rejected");
    });
    console.warn = () => undefined;

    try {
      expect(controller.focusFirstColumn()).toBe(false);
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
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(scheduler.pendingCount).toBe(0);
    expect(controller.focusFirstColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
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

  it("consumes the top right member into the active column without changing focus", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 5 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const unrelated = createTrackedWindow(
      "window-unrelated",
      otherOutput,
      desktop,
      { frameGeometry: { height: 230, width: 310, x: 1120, y: 45 } },
    );
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [...windows.map((window) => window.window), unrelated.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 150 },
      gap: 10,
    });

    controller.start();
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:active",
      [
        {
          id: "column:active",
          width: { kind: "fixed", value: 300 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { clientHeight: 240, kind: "fixed" },
          ],
          windowIds: ["window-1", "window-2"],
        },
        {
          id: "column:source",
          width: { kind: "fixed", value: 260 },
          windowHeights: [
            { clientHeight: 330, kind: "fixed" },
            { kind: "auto", weight: 4 },
          ],
          windowIds: ["window-3", "window-4"],
        },
        {
          id: "column:trailing",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-5"],
        },
      ],
    );
    expect(
      layout.setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        -35,
      ),
    ).toBe(true);
    controller.reconcile();
    fixture.workspace.activeWindow = windows[1]?.window ?? null;
    const activationCount = fixture.activationCount;
    const unrelatedSnapshot = layout.snapshot(
      outputId(otherOutput.name),
      desktopId(desktop.id),
    );
    const unrelatedFrame = { ...unrelated.window.frameGeometry };
    const unrelatedWrites = unrelated.writeCount;

    expect(controller.consumeWindowIntoColumn()).toBe(true);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual({
      activeColumnId: "column:active",
      columns: [
        {
          id: "column:active",
          width: { kind: "fixed", value: 300 },
          windowHeights: [
            { kind: "auto", weight: 2 },
            { clientHeight: 240, kind: "fixed" },
            { kind: "auto", weight: 1 },
          ],
          windowIds: ["window-1", "window-2", "window-3"],
        },
        {
          id: "column:source",
          width: { kind: "fixed", value: 260 },
          windowIds: ["window-4"],
        },
        {
          id: "column:trailing",
          width: { kind: "fixed", value: 360 },
          windowIds: ["window-5"],
        },
      ],
      desktopId: "desktop-1",
      outputId: "DP-1",
      viewportOffset: -35,
    });
    expect(windows[2]?.window.frameGeometry).toMatchObject({
      width: 300,
      x: windows[0]?.window.frameGeometry.x,
    });
    expect(windows[2]?.window.frameGeometry.y).toBeGreaterThan(
      windows[1]?.window.frameGeometry.y ?? Number.POSITIVE_INFINITY,
    );
    expect(windows[3]?.window.frameGeometry.width).toBe(260);
    expect(windows[3]?.window.frameGeometry.x).toBeGreaterThan(
      windows[0]?.window.frameGeometry.x ?? Number.POSITIVE_INFINITY,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
    expect(fixture.activationCount).toBe(activationCount);
    expect(
      layout.snapshot(outputId(otherOutput.name), desktopId(desktop.id)),
    ).toEqual(unrelatedSnapshot);
    expect(unrelated.window.frameGeometry).toEqual(unrelatedFrame);
    expect(unrelated.writeCount).toBe(unrelatedWrites);
  });

  it.each([
    { activeIndex: 0, expectedFocusIndex: 0, name: "non-bottom active" },
    { activeIndex: 2, expectedFocusIndex: 1, name: "bottom active" },
  ])(
    "expels the bottom member to the right and preserves $name focus",
    ({ activeIndex, expectedFocusIndex }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const windows = Array.from({ length: 4 }, (_value, index) =>
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
        gap: 10,
      });

      controller.start();
      const layout = installTestLayout(
        controller,
        output,
        desktop,
        "column:source",
        [
          {
            id: "column:source",
            width: { kind: "proportion", value: 0.45 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { kind: "auto", weight: 3 },
              { clientHeight: 280, kind: "fixed" },
            ],
            windowIds: ["window-1", "window-2", "window-3"],
          },
          {
            id: "column:existing-right",
            width: { kind: "fixed", value: 240 },
            windowIds: ["window-4"],
          },
        ],
      );
      expect(
        layout.setViewportOffset(
          outputId(output.name),
          desktopId(desktop.id),
          -27,
        ),
      ).toBe(true);
      controller.reconcile();
      fixture.workspace.activeWindow = windows[activeIndex]?.window ?? null;
      const activationCount = fixture.activationCount;

      expect(controller.expelWindowFromColumn()).toBe(true);
      const snapshot = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );

      expect(snapshot).toEqual({
        activeColumnId: "column:source",
        columns: [
          {
            id: "column:source",
            width: { kind: "proportion", value: 0.45 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { kind: "auto", weight: 3 },
            ],
            windowIds: ["window-1", "window-2"],
          },
          {
            id: "column:window-3",
            width: { kind: "proportion", value: 0.45 },
            windowIds: ["window-3"],
          },
          {
            id: "column:existing-right",
            width: { kind: "fixed", value: 240 },
            windowIds: ["window-4"],
          },
        ],
        desktopId: "desktop-1",
        outputId: "DP-1",
        viewportOffset: -27,
      });
      expect(fixture.workspace.activeWindow).toBe(
        windows[expectedFocusIndex]?.window,
      );
      expect(fixture.workspace.activeWindow).not.toBe(windows[2]?.window);
      expect(fixture.activationCount).toBe(
        activationCount + (activeIndex === 2 ? 1 : 0),
      );
      expect(windows[2]?.window.frameGeometry.x).toBeGreaterThan(
        windows[0]?.window.frameGeometry.x ?? Number.POSITIVE_INFINITY,
      );
      expect(windows[2]?.window.frameGeometry.x).toBeLessThan(
        windows[3]?.window.frameGeometry.x ?? Number.NEGATIVE_INFINITY,
      );
      expect(
        Math.abs(
          (windows[2]?.window.frameGeometry.width ?? 0) -
            (windows[0]?.window.frameGeometry.width ?? 0),
        ),
      ).toBeLessThanOrEqual(1);
    },
  );

  it("rejects consume and expel boundaries without frame or viewport writes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const only = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [only.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    const layout = runtimeLayout(controller);
    expect(
      layout.setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        -31,
      ),
    ).toBe(true);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frame = { ...only.window.frameGeometry };
    const writes = only.writeCount;
    const activationCount = fixture.activationCount;

    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(only.window.frameGeometry).toEqual(frame);
    expect(only.writeCount).toBe(writes);
    expect(fixture.workspace.activeWindow).toBe(only.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("rejects suspended and floating ownership in affected columns", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop);
    const source = createTrackedWindow("window-2", output, desktop);
    const sourceBottom = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [active.window, source.window, sourceBottom.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:active", [
      {
        id: "column:active",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-2", "window-3"],
      },
    ]);
    fixture.workspace.activeWindow = active.window;
    setWindowState("fullscreen", source, true);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    const suspended = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = [active, source, sourceBottom].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = [active, source, sourceBottom].map(
      (window) => window.writeCount,
    );

    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(suspended);
    expect(
      [active, source, sourceBottom].map(
        (window) => window.window.frameGeometry,
      ),
    ).toEqual(frames);
    expect(
      [active, source, sourceBottom].map((window) => window.writeCount),
    ).toEqual(writes);

    setWindowState("fullscreen", source, false);

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.toggleFloating()).toBe(true);
    const floating = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const floatingFrame = { ...active.window.frameGeometry };
    const floatingWrites = active.writeCount;
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(floating);
    expect(active.window.frameGeometry).toEqual(floatingFrame);
    expect(active.writeCount).toBe(floatingWrites);
  });

  it("rejects automatic floating active windows without touching tiled state", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("window-tiled", output, desktop);
    const automatic = createTrackedWindow("window-automatic", output, desktop, {
      dialog: true,
      normalWindow: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tiled.window, automatic.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = automatic.window;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = [tiled, automatic].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = [tiled, automatic].map((window) => window.writeCount);

    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(
      [tiled, automatic].map((window) => window.window.frameGeometry),
    ).toEqual(frames);
    expect([tiled, automatic].map((window) => window.writeCount)).toEqual(
      writes,
    );
    expect(fixture.workspace.activeWindow).toBe(automatic.window);
  });

  it("gates column stack edits across context, topology, toggle, and capacity barriers", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const source = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, source.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:active", [
      {
        id: "column:active",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = first.window;
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
    const frames = [first, second, source].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = [first, second, source].map((window) => window.writeCount);

    state.topologyStabilizing = true;
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    state.topologyStabilizing = false;

    state.toggleGeometryTransitions.set("window-1", {
      contextKey: key,
      expectedFrame: { ...first.window.frameGeometry, x: -100 },
      settlementArmed: false,
    });
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    state.toggleGeometryTransitions.clear();

    state.capacityCanceledParks.set(key, {});
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    state.capacityCanceledParks.clear();

    state.capacityLeasesByContext.set(key, new Set([{}]));
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    expect(controller.expelWindowFromColumn()).toBe(false);
    state.capacityLeasesByContext.clear();

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(
      [first, second, source].map((window) => window.window.frameGeometry),
    ).toEqual(frames);
    expect([first, second, source].map((window) => window.writeCount)).toEqual(
      writes,
    );
    expect(fixture.workspace.activeWindow).toBe(first.window);
    expect(controller.consumeWindowIntoColumn()).toBe(true);
  });

  it("rejects column stack edits when affected members leave the live context", () => {
    const output = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop);
    const second = createTrackedWindow("window-2", output, desktop);
    const source = createTrackedWindow("window-3", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output, otherOutput],
      [desktop],
      [first.window, second.window, source.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:active", [
      {
        id: "column:active",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:source",
        width: { kind: "fixed", value: 300 },
        windowIds: ["window-3"],
      },
    ]);
    fixture.workspace.activeWindow = first.window;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = [first, second, source].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const writes = [first, second, source].map((window) => window.writeCount);

    Object.defineProperty(source.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    expect(controller.consumeWindowIntoColumn()).toBe(false);
    Object.defineProperty(source.window, "output", {
      configurable: true,
      value: output,
    });
    Object.defineProperty(second.window, "output", {
      configurable: true,
      value: otherOutput,
    });
    expect(controller.expelWindowFromColumn()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(before);
    expect(
      [first, second, source].map((window) => window.window.frameGeometry),
    ).toEqual(frames);
    expect([first, second, source].map((window) => window.writeCount)).toEqual(
      writes,
    );
    expect(fixture.workspace.activeWindow).toBe(first.window);
  });

  it.each(["consume", "expel"] as const)(
    "rolls back a %s column stack edit after asynchronous partial writes",
    (operation) => {
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
        gap: 10,
        schedule: scheduler.schedule,
      });
      const queuedWrites: Array<{
        readonly commit: () => void;
        readonly frame: KWinWindow["frameGeometry"];
      }> = [];
      const warning = console.warn;

      controller.start();
      const layout = installTestLayout(
        controller,
        output,
        desktop,
        "column:active",
        [
          {
            id: "column:active",
            width: { kind: "fixed", value: 360 },
            windowHeights: [
              { kind: "auto", weight: 2 },
              { clientHeight: 270, kind: "fixed" },
            ],
            windowIds: ["window-1", "window-2"],
          },
          {
            id: "column:right",
            width: { kind: "fixed", value: 300 },
            windowIds: ["window-3"],
          },
        ],
      );
      fixture.workspace.activeWindow = windows[1]?.window ?? null;

      while (scheduler.pendingCount > 0) {
        scheduler.flush();
      }

      expect(
        layout.setViewportOffset(
          outputId(output.name),
          desktopId(desktop.id),
          -23,
        ),
      ).toBe(true);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map((window) => ({
        ...window.window.frameGeometry,
      }));
      const activationCount = fixture.activationCount;
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
        expect(
          operation === "consume"
            ? controller.consumeWindowIntoColumn()
            : controller.expelWindowFromColumn(),
        ).toBe(false);
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

      while (scheduler.pendingCount > 0) {
        scheduler.flush();
      }

      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map((window) => window.window.frameGeometry)).toEqual(
        frames,
      );
      expect(fixture.workspace.activeWindow).toBe(windows[1]?.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        operation === "consume"
          ? controller.consumeWindowIntoColumn()
          : controller.expelWindowFromColumn(),
      ).toBe(true);

      if (operation === "expel") {
        expect(fixture.workspace.activeWindow).toBe(windows[0]?.window);
        expect(fixture.workspace.activeWindow).not.toBe(windows[1]?.window);
      }
    },
  );

  it("allows consecutive column stack edits without a settlement probe", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 7 }, (_value, index) =>
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
      columnWidth: { kind: "fixed", value: 180 },
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    installTestLayout(controller, output, desktop, "column:active", [
      {
        id: "column:leading-stack",
        width: { kind: "fixed", value: 180 },
        windowIds: ["window-1", "window-2"],
      },
      {
        id: "column:active",
        width: { kind: "fixed", value: 180 },
        windowIds: ["window-3", "window-4"],
      },
      {
        id: "column:first-source",
        width: { kind: "fixed", value: 180 },
        windowIds: ["window-5"],
      },
      {
        id: "column:second-source",
        width: { kind: "fixed", value: 180 },
        windowIds: ["window-6", "window-7"],
      },
    ]);
    fixture.workspace.activeWindow = windows[3]?.window ?? null;

    while (scheduler.pendingCount > 0) {
      scheduler.flush();
    }

    expect(controller.consumeWindowIntoColumn()).toBe(true);
    expect(controller.consumeWindowIntoColumn()).toBe(true);
    expect(controller.expelWindowFromColumn()).toBe(true);
    expect(controller.expelWindowFromColumn()).toBe(true);
    expect(controller.insertWindowIntoStackLeft()).toBe(true);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      {
        id: "column:leading-stack",
        windowIds: ["window-1", "window-2", "window-4"],
      },
      { id: "column:active", windowIds: ["window-3"] },
      { id: "column:window-5", windowIds: ["window-5"] },
      { id: "column:window-6", windowIds: ["window-6"] },
      { id: "column:second-source", windowIds: ["window-7"] },
    ]);
    expect(fixture.workspace.activeWindow).toBe(windows[3]?.window);
    expect(
      (
        controller as unknown as {
          readonly toggleGeometryTransitions: ReadonlyMap<WindowId, unknown>;
        }
      ).toggleGeometryTransitions.size,
    ).toBe(0);
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
      kind: "proportion",
      value: 310 / 990 + 0.1,
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
      kind: "proportion",
      value: 310 / 990 + 0.1,
    });
    expect(active.window.frameGeometry).toMatchObject({
      height: 254,
      width: 399,
      x: 10,
      y: 273,
    });
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("switches between remembered tiled and floating windows without layout writes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiledRemembered = createTrackedWindow(
      "tiled-remembered",
      output,
      desktop,
    );
    const tiledTopmost = createTrackedWindow("tiled-topmost", output, desktop);
    const floatingRemembered = createTrackedWindow(
      "floating-remembered",
      output,
      desktop,
    );
    const floatingTopmost = createTrackedWindow(
      "floating-topmost",
      output,
      desktop,
    );
    const windows = [
      tiledRemembered,
      tiledTopmost,
      floatingRemembered,
      floatingTopmost,
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = floatingRemembered.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = tiledTopmost.window;
    fixture.workspace.activeWindow = tiledRemembered.window;
    const layout = runtimeLayout(controller);
    layout.setViewportOffset(outputId(output.name), desktopId(desktop.id), -73);
    controller.reconcile();

    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);
    const activationCount = fixture.activationCount;

    expect(before.viewportOffset).toBe(-73);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(floatingRemembered.window);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(tiledRemembered.window);
    expect(controller.focusFloating()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(floatingRemembered.window);
    expect(controller.focusFloating()).toBe(false);
    expect(controller.focusTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(tiledRemembered.window);
    expect(controller.focusTiling()).toBe(false);

    expect(fixture.activationCount).toBe(activationCount + 4);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
  });

  it.each(
    (["layer", "directional"] as const).flatMap((mode) =>
      (["commit then throw", "minimize", "remove"] as const).map(
        (behavior) => ({ behavior, mode }),
      ),
    ),
  )(
    "recovers from a $behavior activation during $mode floating focus",
    ({ behavior, mode }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const tiled = createTrackedWindow("tiled", output, desktop);
      const target = createTrackedWindow("target", output, desktop);
      const active = createTrackedWindow("active", output, desktop);
      const windows = [tiled, target, active];
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

      expect(controller.start()).toBe(true);
      fixture.workspace.activeWindow = target.window;
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = active.window;
      expect(controller.toggleFloating()).toBe(true);
      target.setFrameGeometry({ height: 100, width: 100, x: 700, y: 400 });
      active.setFrameGeometry({ height: 100, width: 100, x: 400, y: 400 });
      fixture.workspace.activeWindow = target.window;
      const originalActive = mode === "layer" ? tiled.window : active.window;
      fixture.workspace.activeWindow = originalActive;
      const layout = runtimeLayout(controller);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;
      let targetRequest = true;

      fixture.setActivationBehavior((window, commit) => {
        if (window !== target.window || !targetRequest) {
          commit();
          return;
        }

        targetRequest = false;
        commit();

        if (behavior === "commit then throw") {
          throw new Error("injected focus failure");
        }

        if (behavior === "minimize") {
          setWindowState("minimized", target, true);
        } else {
          fixture.windowRemoved.emit(target.window);
        }
      });

      const focused =
        mode === "layer" ? controller.focusFloating() : controller.focusRight();
      fixture.setActivationBehavior(null);

      expect(focused).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(originalActive);
      expect(fixture.activationCount).toBe(activationCount + 2);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
      expect(controller.floatingCount).toBe(behavior === "remove" ? 1 : 2);
      expect(target.window.minimized).toBe(behavior === "minimize");
    },
  );

  it.each(
    (["horizontal", "vertical"] as const).flatMap((mode) =>
      (["reject", "commit then throw", "minimize", "remove"] as const).map(
        (behavior) => ({ behavior, mode }),
      ),
    ),
  )(
    "recovers a tiled $mode focus when activation is $behavior",
    ({ behavior, mode }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const active = createTrackedWindow("active", output, desktop);
      const vertical = createTrackedWindow("vertical", output, desktop);
      const horizontal = createTrackedWindow("horizontal", output, desktop);
      const far = createTrackedWindow("far", output, desktop);
      const windows = [active, vertical, horizontal, far];
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      const layout = installTestLayout(
        controller,
        output,
        desktop,
        "column:stack",
        [
          {
            id: "column:stack",
            width: { kind: "fixed", value: 700 },
            windowIds: ["active", "vertical"],
          },
          {
            id: "column:horizontal",
            width: { kind: "fixed", value: 700 },
            windowIds: ["horizontal"],
          },
          {
            id: "column:far",
            width: { kind: "fixed", value: 700 },
            windowIds: ["far"],
          },
        ],
      );
      fixture.workspace.activeWindow = active.window;
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const target = mode === "horizontal" ? horizontal : vertical;
      const activationCount = fixture.activationCount;
      let targetRequest = true;

      fixture.setActivationBehavior((window, commit) => {
        if (window !== target.window || !targetRequest) {
          commit();
          return;
        }

        targetRequest = false;

        if (behavior === "reject") {
          return;
        }

        commit();

        if (behavior === "commit then throw") {
          throw new Error("injected focus failure");
        }

        if (behavior === "minimize") {
          setWindowState("minimized", target, true);
        } else {
          fixture.windowRemoved.emit(target.window);
        }
      });

      const focused =
        mode === "horizontal"
          ? controller.focusRight()
          : controller.focusDown();
      fixture.setActivationBehavior(null);

      expect(focused).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(active.window);
      expect(fixture.activationCount).toBe(
        activationCount + (behavior === "reject" ? 1 : 2),
      );
      if (behavior !== "remove") {
        expect(
          layout.snapshot(outputId(output.name), desktopId(desktop.id)),
        ).toEqual(before);
      }

      if (behavior === "minimize") {
        expect(target.window.minimized).toBe(true);
        setWindowState("minimized", target, false);
        flushManualScheduler(scheduler);
      } else if (behavior === "remove") {
        flushManualScheduler(scheduler);
        expect(testLayoutColumns(controller, output, desktop)).toEqual(
          mode === "horizontal"
            ? [
                {
                  id: "column:stack",
                  windowIds: ["active", "vertical"],
                },
                { id: "column:far", windowIds: ["far"] },
              ]
            : [
                { id: "column:stack", windowIds: ["active"] },
                {
                  id: "column:horizontal",
                  windowIds: ["horizontal"],
                },
                { id: "column:far", windowIds: ["far"] },
              ],
        );

        if (mode === "horizontal") {
          expect(far.window.frameGeometry.x).toBeLessThan(frames[3]?.x ?? 0);
        } else {
          expect(active.window.frameGeometry.height).toBeGreaterThan(
            frames[0]?.height ?? 0,
          );
        }
      }

      if (behavior !== "remove") {
        expect(windows.map(({ window }) => window.frameGeometry)).toEqual(
          frames,
        );
      }
      expect(fixture.workspace.activeWindow).toBe(active.window);
    },
  );

  it("restores remembered layer targets after focus starts a topology barrier", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const output = trackedOutput.output;
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const floating = createTrackedWindow("floating", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tiled.window, floating.window],
    );
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
      schedule: workScheduler.schedule,
      scheduleResume: resumeScheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = tiled.window;
    const key = `${output.name}\u0000${desktop.id}`;
    const state = controller as unknown as {
      readonly lastFloatingFocus: ReadonlyMap<string, WindowId>;
      readonly lastTiledFocus: ReadonlyMap<string, WindowId>;
    };
    const rememberedFloating = state.lastFloatingFocus.get(key);
    const rememberedTiled = state.lastTiledFocus.get(key);
    let targetRequest = true;

    fixture.setActivationBehavior((window, commit) => {
      commit();

      if (window !== floating.window || !targetRequest) {
        return;
      }

      targetRequest = false;
      trackedOutput.setGeometry({ height: 800, width: 1000, x: 100, y: 0 });
      trackedOutput.geometryChanged.emit();
    });

    expect(controller.focusFloating()).toBe(false);
    fixture.setActivationBehavior(null);
    expect(fixture.workspace.activeWindow).toBe(tiled.window);
    expect(state.lastFloatingFocus.get(key)).toBe(rememberedFloating);
    expect(state.lastTiledFocus.get(key)).toBe(rememberedTiled);
    expect(resumeScheduler.pendingCount).toBe(1);

    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(fixture.workspace.activeWindow).toBe(tiled.window);
  });

  it("restores the remembered member of a tiled stack", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const stackFirst = createTrackedWindow("stack-first", output, desktop);
    const stackRemembered = createTrackedWindow(
      "stack-remembered",
      output,
      desktop,
    );
    const other = createTrackedWindow("other", output, desktop);
    const floating = createTrackedWindow("floating", output, desktop);
    const windows = [stackFirst, stackRemembered, other, floating];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 300 },
          windowIds: ["stack-first", "stack-remembered"],
        },
        {
          id: "column:other",
          width: { kind: "fixed", value: 300 },
          windowIds: ["other"],
        },
      ],
    );
    fixture.workspace.activeWindow = stackFirst.window;
    fixture.workspace.activeWindow = stackRemembered.window;
    fixture.workspace.activeWindow = floating.window;
    layout.setViewportOffset(outputId(output.name), desktopId(desktop.id), -44);
    controller.reconcile();
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);

    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(stackRemembered.window);
    expect(controller.lastWriteCount).toBe(0);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(floating.window);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
  });

  it.each([
    {
      name: "dialog",
      overrides: { dialog: true, normalWindow: false },
    },
    {
      name: "transient",
      overrides: { transient: true },
    },
    {
      name: "fixed-size",
      overrides: {
        clientGeometry: { height: 180, width: 280, x: 10, y: 10 },
        frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
        maxSize: { height: 180, width: 280 },
        minSize: { height: 180, width: 280 },
      },
    },
  ] satisfies readonly {
    readonly name: string;
    readonly overrides: Partial<KWinWindow>;
  }[])(
    "switches focus to and from a $name automatic floating window",
    ({ overrides }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const tiled = createTrackedWindow("tiled", output, desktop);
      const automatic = createTrackedWindow(
        "automatic",
        output,
        desktop,
        overrides,
      );
      const windows = [tiled, automatic];
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        windows.map(({ window }) => window),
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 300 },
        gap: 10,
      });

      expect(controller.start()).toBe(true);
      expect(controller.managedCount).toBe(1);
      expect(controller.automaticFloatingCount).toBe(1);
      fixture.workspace.activeWindow = tiled.window;
      const layout = runtimeLayout(controller);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;

      expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
      expect(fixture.workspace.activeWindow).toBe(automatic.window);
      expect(controller.focusTiling()).toBe(true);
      expect(fixture.workspace.activeWindow).toBe(tiled.window);
      expect(controller.focusTiling()).toBe(false);
      expect(controller.focusFloating()).toBe(true);
      expect(fixture.workspace.activeWindow).toBe(automatic.window);
      expect(controller.focusFloating()).toBe(false);

      expect(fixture.activationCount).toBe(activationCount + 3);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    },
  );

  it("does not switch focus when either window layer is empty", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const tiledFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tiled.window],
    );
    const tiledController = new RuntimeController(tiledFixture.workspace, {
      clientAreaOption: 2,
    });

    expect(tiledController.start()).toBe(true);
    const tiledLayout = runtimeLayout(tiledController).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const tiledWrites = tiled.writeCount;
    const tiledActivationCount = tiledFixture.activationCount;

    expect(tiledController.switchFocusBetweenFloatingAndTiling()).toBe(false);
    expect(tiledController.focusFloating()).toBe(false);
    expect(tiledController.focusTiling()).toBe(false);
    expect(tiledFixture.activationCount).toBe(tiledActivationCount);
    expect(tiled.writeCount).toBe(tiledWrites);
    expect(
      runtimeLayout(tiledController).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(tiledLayout);

    const automatic = createTrackedWindow("automatic", output, desktop, {
      clientGeometry: { height: 180, width: 280, x: 10, y: 10 },
      frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
      maxSize: { height: 180, width: 280 },
      minSize: { height: 180, width: 280 },
    });
    const floatingFixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [automatic.window],
    );
    const floatingController = new RuntimeController(
      floatingFixture.workspace,
      { clientAreaOption: 2 },
    );

    expect(floatingController.start()).toBe(true);
    expect(floatingController.managedCount).toBe(0);
    expect(floatingController.automaticFloatingCount).toBe(1);
    const floatingLayout = runtimeLayout(floatingController).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const floatingWrites = automatic.writeCount;
    const floatingActivationCount = floatingFixture.activationCount;

    expect(floatingController.switchFocusBetweenFloatingAndTiling()).toBe(
      false,
    );
    expect(floatingController.focusTiling()).toBe(false);
    expect(floatingController.focusFloating()).toBe(false);
    expect(floatingFixture.activationCount).toBe(floatingActivationCount);
    expect(automatic.writeCount).toBe(floatingWrites);
    expect(
      runtimeLayout(floatingController).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(floatingLayout);
  });

  it("falls back within each layer after remembered windows are removed", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const staleTiled = createTrackedWindow("stale-tiled", output, desktop);
    const tiledFallback = createTrackedWindow(
      "tiled-fallback",
      output,
      desktop,
    );
    const staleFloating = createTrackedWindow(
      "stale-floating",
      output,
      desktop,
    );
    const floatingFallback = createTrackedWindow(
      "floating-fallback",
      output,
      desktop,
    );
    const windows = [
      staleTiled,
      tiledFallback,
      staleFloating,
      floatingFallback,
    ];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = staleFloating.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = staleTiled.window;
    fixture.workspace.activeWindow = staleFloating.window;
    fixture.windowRemoved.emit(staleTiled.window);
    const layoutAfterTiledRemoval = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const writesAfterTiledRemoval = windows.map(({ writeCount }) => writeCount);

    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(tiledFallback.window);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layoutAfterTiledRemoval);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(
      writesAfterTiledRemoval,
    );

    expect(controller.focusFloating()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(staleFloating.window);
    fixture.windowRemoved.emit(staleFloating.window);
    fixture.workspace.activeWindow = tiledFallback.window;
    const layoutAfterFloatingRemoval = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const writesAfterFloatingRemoval = windows.map(
      ({ writeCount }) => writeCount,
    );

    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(floatingFallback.window);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(layoutAfterFloatingRemoval);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(
      writesAfterFloatingRemoval,
    );
  });

  it("finds the nearest visible tiled window beyond a minimized active column", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const left = createTrackedWindow("left", output, desktop);
    const minimizedTop = createTrackedWindow("minimized-top", output, desktop);
    const minimizedBottom = createTrackedWindow(
      "minimized-bottom",
      output,
      desktop,
    );
    const right = createTrackedWindow("right", output, desktop);
    const floating = createTrackedWindow("floating", output, desktop);
    const windows = [left, minimizedTop, minimizedBottom, right, floating];
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
      gap: 10,
      schedule: scheduler.schedule,
      scheduleResume: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    const floatingFrame = { ...floating.window.frameGeometry };
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:minimized",
      [
        {
          id: "column:left",
          width: { kind: "fixed", value: 280 },
          windowIds: ["left"],
        },
        {
          id: "column:minimized",
          width: { kind: "proportion", value: 0.45 },
          windowHeights: [
            { clientHeight: 240, kind: "fixed" },
            { kind: "auto", weight: 3 },
          ],
          windowIds: ["minimized-top", "minimized-bottom"],
        },
        {
          id: "column:right",
          width: { kind: "fixed", value: 320 },
          windowIds: ["right"],
        },
      ],
    );
    fixture.workspace.activeWindow = floating.window;
    setWindowState("minimized", minimizedTop, true);
    setWindowState("minimized", minimizedBottom, true);
    flushManualScheduler(scheduler);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);
    const activations: Array<{
      readonly id: string;
      readonly minimized: boolean;
    }> = [];
    fixture.windowActivated.connect((window) => {
      if (window) {
        activations.push({
          id: String(window.internalId),
          minimized: window.minimized,
        });
      }
    });

    expect(controller.focusTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(right.window);
    expect(activations).toEqual([{ id: "right", minimized: false }]);
    expect(minimizedTop.window.minimized).toBe(true);
    expect(minimizedBottom.window.minimized).toBe(true);
    expect(controller.floatingCount).toBe(1);
    expect(floating.window.frameGeometry).toEqual(floatingFrame);
    const after = layout.snapshot(outputId(output.name), desktopId(desktop.id));
    expect(after.columns).toEqual(before.columns);
    expect(after.activeColumnId).toBe(columnId("column:right"));
    expect(after.viewportOffset).toBeGreaterThan(before.viewportOffset);
    expect(right.window.frameGeometry.x).toBeGreaterThanOrEqual(10);
    expect(
      right.window.frameGeometry.x + right.window.frameGeometry.width,
    ).toBeLessThanOrEqual(1000);
    expect(minimizedTop.window.frameGeometry).toEqual(frames[1]);
    expect(minimizedBottom.window.frameGeometry).toEqual(frames[2]);
    expect(floating.window.frameGeometry).toEqual(frames[4]);
    expect(minimizedTop.writeCount).toBe(writes[1]);
    expect(minimizedBottom.writeCount).toBe(writes[2]);
    expect(floating.writeCount).toBe(writes[4]);
    expect(right.writeCount).toBeGreaterThan(writes[3] ?? 0);
  });

  it.each(["right", "left"] as const)(
    "reveals an offscreen tiled layer target on the %s before activating it",
    (direction) => {
      const setup = createTiledLayerRevealFixture(direction);
      const before = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      const frames = setup.windows.map(({ window }) => ({
        ...window.frameGeometry,
      }));
      const writes = setup.windows.map(({ writeCount }) => writeCount);
      let activationSnapshot: ReturnType<LayoutEngine["snapshot"]> | undefined;
      let activationFrame: KWinWindow["frameGeometry"] | undefined;
      let activationWrites: readonly number[] | undefined;
      setup.fixture.windowActivated.connect((window) => {
        if (window === setup.target.window) {
          activationSnapshot = setup.layout.snapshot(
            outputId(setup.output.name),
            desktopId(setup.desktop.id),
          );
          activationFrame = { ...setup.target.window.frameGeometry };
          activationWrites = setup.windows.map(({ writeCount }) => writeCount);
        }
      });

      expect(setup.controller.focusTiling()).toBe(true);
      const after = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      expect(setup.fixture.workspace.activeWindow).toBe(setup.target.window);
      expect(after.activeColumnId).toBe(columnId("column:target"));
      expect(after.viewportOffset).toBe(direction === "right" ? 640 : 10);
      expect(setup.target.window.frameGeometry).toMatchObject({
        width: 400,
        x: direction === "right" ? 600 : 0,
      });
      expect(activationSnapshot).toEqual(after);
      expect(activationFrame).toEqual(setup.target.window.frameGeometry);
      expect(activationWrites).toEqual(
        setup.windows.map(({ writeCount }) => writeCount),
      );
      expect(setup.scheduler.pendingCount).toBe(0);
      expect(setup.controller.lastWriteCount).toBe(1);
      expect(setup.target.writeCount).toBe((writes[0] ?? 0) + 1);
      expect(setup.minimized.map(({ writeCount }) => writeCount)).toEqual(
        writes.slice(1, 4),
      );
      expect(setup.floating.writeCount).toBe(writes[writes.length - 1]);
      expect(setup.minimized.map(({ window }) => window.frameGeometry)).toEqual(
        frames.slice(1, 4),
      );
      expect(before.activeColumnId).not.toBe(after.activeColumnId);
    },
  );

  it.each(["reject", "throw", "commit then throw"] as const)(
    "rolls back a tiled layer reveal when focus is %s",
    (behavior) => {
      const setup = createTiledLayerRevealFixture("right");
      const before = setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      );
      const frames = setup.windows.map(({ window }) => ({
        ...window.frameGeometry,
      }));
      const writes = setup.windows.map(({ writeCount }) => writeCount);
      const state = setup.controller as unknown as {
        readonly lastFloatingFocus: ReadonlyMap<string, WindowId>;
        readonly lastTiledFocus: ReadonlyMap<string, WindowId>;
      };
      const key = `${setup.output.name}\u0000${setup.desktop.id}`;
      const rememberedFloating = state.lastFloatingFocus.get(key);
      let targetRequest = true;
      setup.fixture.setActivationBehavior((window, commit) => {
        if (window !== setup.target.window || !targetRequest) {
          commit();
          return;
        }

        targetRequest = false;

        if (behavior === "reject") {
          return;
        }

        if (behavior === "commit then throw") {
          commit();
        }

        throw new Error("injected focus failure");
      });

      expect(setup.controller.focusTiling()).toBe(false);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
      expect(
        setup.layout.snapshot(
          outputId(setup.output.name),
          desktopId(setup.desktop.id),
        ),
      ).toEqual(before);
      expect(setup.windows.map(({ window }) => window.frameGeometry)).toEqual(
        frames,
      );
      expect(setup.target.writeCount).toBe((writes[0] ?? 0) + 2);
      expect(setup.minimized.map(({ writeCount }) => writeCount)).toEqual(
        writes.slice(1, 4),
      );
      expect(setup.floating.writeCount).toBe(writes[writes.length - 1]);
      expect(state.lastFloatingFocus.get(key)).toBe(rememberedFloating);
      expect(state.lastTiledFocus.get(key)).toBeUndefined();
      expect(setup.scheduler.pendingCount).toBe(0);
    },
  );

  it.each(["minimize", "remove"] as const)(
    "forgets a tiled layer target invalidated by %s in the active column",
    (behavior) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const target = createTrackedWindow("target", output, desktop);
      const sibling = createTrackedWindow("sibling", output, desktop);
      const floating = createTrackedWindow("floating", output, desktop);
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        [target.window, sibling.window, floating.window],
      );
      const scheduler = new ManualScheduler();
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      expect(controller.toggleFloating()).toBe(true);
      installTestLayout(controller, output, desktop, "column:stack", [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 400 },
          windowIds: ["target", "sibling"],
        },
      ]);
      fixture.workspace.activeWindow = target.window;
      fixture.workspace.activeWindow = floating.window;
      const key = `${output.name}\u0000${desktop.id}`;
      const state = controller as unknown as {
        readonly lastFloatingFocus: ReadonlyMap<string, WindowId>;
        readonly lastTiledFocus: ReadonlyMap<string, WindowId>;
      };
      const rememberedFloating = state.lastFloatingFocus.get(key);
      let targetRequest = true;
      fixture.setActivationBehavior((window, commit) => {
        commit();

        if (window !== target.window || !targetRequest) {
          return;
        }

        targetRequest = false;

        if (behavior === "minimize") {
          setWindowState("minimized", target, true);
        } else {
          fixture.windowRemoved.emit(target.window);
        }
      });

      expect(state.lastTiledFocus.get(key)).toBe(windowId("target"));
      expect(controller.focusTiling()).toBe(false);
      fixture.setActivationBehavior(null);
      expect(fixture.workspace.activeWindow).toBe(floating.window);
      expect(state.lastFloatingFocus.get(key)).toBe(rememberedFloating);
      expect(state.lastTiledFocus.get(key)).toBeUndefined();

      if (behavior === "minimize") {
        setWindowState("minimized", target, false);
      }

      flushManualScheduler(scheduler);
      expect(
        testLayoutColumns(controller, output, desktop).flatMap(
          (column) => column.windowIds,
        ),
      ).toEqual(behavior === "remove" ? ["sibling"] : ["target", "sibling"]);
    },
  );

  it.each(["minimize", "remove"] as const)(
    "forgets a revealed tiled layer target invalidated by %s",
    (behavior) => {
      const setup = createTiledLayerRevealFixture("right");
      setup.fixture.workspace.activeWindow = setup.target.window;
      setup.fixture.workspace.activeWindow = setup.floating.window;
      const key = `${setup.output.name}\u0000${setup.desktop.id}`;
      const state = setup.controller as unknown as {
        readonly dirtyContexts: ReadonlySet<string>;
        readonly lastFloatingFocus: ReadonlyMap<string, WindowId>;
        readonly lastTiledFocus: ReadonlyMap<string, WindowId>;
      };
      const rememberedFloating = state.lastFloatingFocus.get(key);
      let targetRequest = true;
      setup.fixture.setActivationBehavior((window, commit) => {
        commit();

        if (window !== setup.target.window || !targetRequest) {
          return;
        }

        targetRequest = false;

        if (behavior === "minimize") {
          setWindowState("minimized", setup.target, true);
        } else {
          setup.fixture.windowRemoved.emit(setup.target.window);
        }
      });

      expect(state.lastTiledFocus.get(key)).toBe(windowId("target"));
      expect(setup.controller.focusTiling()).toBe(false);
      setup.fixture.setActivationBehavior(null);
      expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
      expect(state.lastFloatingFocus.get(key)).toBe(rememberedFloating);
      expect(state.lastTiledFocus.get(key)).toBeUndefined();

      if (behavior === "minimize") {
        setWindowState("minimized", setup.target, false);
      }

      flushManualScheduler(setup.scheduler);
      expect(
        testLayoutColumns(setup.controller, setup.output, setup.desktop).some(
          (column) => column.windowIds.includes("target"),
        ),
      ).toBe(behavior !== "remove");
      expect(state.dirtyContexts.has(key)).toBe(false);
    },
  );

  it("rolls back a partially written tiled layer reveal before focus", () => {
    const setup = createTiledLayerRevealFixture("right", true);
    const sibling = setup.targetSibling;

    if (!sibling) {
      throw new Error("missing partial reveal sibling");
    }

    const before = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const frames = setup.windows.map(({ window }) => ({
      ...window.frameGeometry,
    }));
    const writes = setup.windows.map(({ writeCount }) => writeCount);
    const activationCount = setup.fixture.activationCount;
    const warning = console.warn;
    sibling.setWriteBehavior(() => {
      throw new Error("injected geometry failure");
    });
    console.warn = () => undefined;

    try {
      expect(setup.controller.focusTiling()).toBe(false);
    } finally {
      console.warn = warning;
      sibling.setWriteBehavior(null);
    }

    expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
    expect(setup.fixture.activationCount).toBe(activationCount);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(before);
    expect(setup.windows.map(({ window }) => window.frameGeometry)).toEqual(
      frames,
    );
    expect(setup.target.writeCount).toBe((writes[0] ?? 0) + 2);
    expect(sibling.writeCount).toBe((writes[1] ?? 0) + 2);
    expect(setup.scheduler.pendingCount).toBe(1);
    flushManualScheduler(setup.scheduler);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
  });

  it("defers frame recovery when topology supersedes a tiled layer reveal", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const workScheduler = new ManualScheduler();
    const resumeScheduler = new ManualScheduler();
    const setup = createTiledLayerRevealFixture("right", false, {
      output: trackedOutput.output,
      resumeScheduler,
      scheduler: workScheduler,
    });
    const before = setup.layout.snapshot(
      outputId(setup.output.name),
      desktopId(setup.desktop.id),
    );
    const targetFrame = { ...setup.target.window.frameGeometry };
    const targetWrites = setup.target.writeCount;
    const activationCount = setup.fixture.activationCount;
    const key = `${setup.output.name}\u0000${setup.desktop.id}`;
    const state = setup.controller as unknown as {
      readonly dirtyContexts: ReadonlySet<string>;
    };
    let superseded = false;
    setup.target.setWriteBehavior((_frame, commit) => {
      commit();

      if (superseded) {
        return;
      }

      superseded = true;
      trackedOutput.setGeometry({
        height: 800,
        width: 1000,
        x: 200,
        y: 0,
      });
      trackedOutput.geometryChanged.emit();
    });

    expect(setup.controller.focusTiling()).toBe(false);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
    expect(setup.fixture.activationCount).toBe(activationCount);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(before);
    expect(setup.target.window.frameGeometry).not.toEqual(targetFrame);
    expect(setup.target.writeCount).toBe(targetWrites + 1);
    expect(state.dirtyContexts.has(key)).toBe(true);
    expect(resumeScheduler.pendingCount).toBe(1);

    setup.target.setWriteBehavior(null);
    flushTopologyRecovery(resumeScheduler, workScheduler);
    expect(setup.fixture.workspace.activeWindow).toBe(setup.floating.window);
    expect(
      setup.layout.snapshot(
        outputId(setup.output.name),
        desktopId(setup.desktop.id),
      ),
    ).toEqual(before);
    expect(setup.target.window.frameGeometry).toMatchObject({
      width: 400,
      x: 1440,
    });
    expect(setup.target.writeCount).toBe(targetWrites + 2);
    expect(state.dirtyContexts.has(key)).toBe(false);
    expect(resumeScheduler.pendingCount).toBe(0);
    expect(workScheduler.pendingCount).toBe(0);
  });

  it.each([
    "fullscreen",
    "maximized",
    "native tiled",
    "restore settling",
    "toggle unsettled",
  ] as const)(
    "does not bypass a %s tiled layer candidate after minimized members",
    (blocker) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const left = createTrackedWindow("left", output, desktop);
      const activeMinimized = createTrackedWindow(
        "active-minimized",
        output,
        desktop,
      );
      const candidateMinimized = createTrackedWindow(
        "candidate-minimized",
        output,
        desktop,
      );
      const blocked = createTrackedWindow("blocked", output, desktop);
      const farther = createTrackedWindow("farther", output, desktop);
      const floating = createTrackedWindow("floating", output, desktop);
      const windows = [
        left,
        activeMinimized,
        candidateMinimized,
        blocked,
        farther,
        floating,
      ];
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      expect(controller.toggleFloating()).toBe(true);
      const layout = installTestLayout(
        controller,
        output,
        desktop,
        "column:active-minimized",
        [
          {
            id: "column:left",
            width: { kind: "fixed", value: 240 },
            windowIds: ["left"],
          },
          {
            id: "column:active-minimized",
            width: { kind: "fixed", value: 250 },
            windowIds: ["active-minimized"],
          },
          {
            id: "column:blocked",
            width: { kind: "fixed", value: 260 },
            windowIds: ["candidate-minimized", "blocked"],
          },
          {
            id: "column:farther",
            width: { kind: "fixed", value: 270 },
            windowIds: ["farther"],
          },
        ],
      );
      fixture.workspace.activeWindow = floating.window;
      setWindowState("minimized", activeMinimized, true);
      setWindowState("minimized", candidateMinimized, true);
      blockWindowFocus(controller, blocked, blocker);
      flushManualScheduler(scheduler);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const activationCount = fixture.activationCount;

      expect(controller.focusTiling()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(floating.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(activeMinimized.window.minimized).toBe(true);
      expect(candidateMinimized.window.minimized).toBe(true);
    },
  );

  it.each([
    "fullscreen",
    "maximized",
    "native tiled",
    "restore settling",
    "toggle unsettled",
  ] as const)(
    "does not bypass a remembered %s floating layer candidate",
    (blocker) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const tiled = createTrackedWindow("tiled", output, desktop);
      const eligible = createTrackedWindow("eligible", output, desktop);
      const blocked = createTrackedWindow("blocked", output, desktop);
      const windows = [tiled, eligible, blocked];
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = eligible.window;
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = blocked.window;
      fixture.workspace.activeWindow = tiled.window;
      blockWindowFocus(controller, blocked, blocker);
      flushManualScheduler(scheduler);
      const layout = runtimeLayout(controller);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;

      expect(controller.focusFloating()).toBe(false);
      expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(tiled.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    },
  );

  it("keeps remembered layer focus isolated between output contexts", () => {
    const firstOutput = createOutput("DP-1", 0);
    const secondOutput = createOutput("HDMI-A-1", 1000);
    const desktop = { id: "desktop-1" };
    const firstTiled = createTrackedWindow("first-tiled", firstOutput, desktop);
    const firstRemembered = createTrackedWindow(
      "first-remembered",
      firstOutput,
      desktop,
    );
    const firstTopmost = createTrackedWindow(
      "first-topmost",
      firstOutput,
      desktop,
    );
    const secondTiled = createTrackedWindow(
      "second-tiled",
      secondOutput,
      desktop,
    );
    const secondRemembered = createTrackedWindow(
      "second-remembered",
      secondOutput,
      desktop,
    );
    const secondTopmost = createTrackedWindow(
      "second-topmost",
      secondOutput,
      desktop,
    );
    const windows = [
      firstTiled,
      firstRemembered,
      firstTopmost,
      secondTiled,
      secondRemembered,
      secondTopmost,
    ];
    const fixture = createWorkspace(
      firstOutput,
      desktop,
      [firstOutput, secondOutput],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = secondRemembered.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = firstTopmost.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = firstRemembered.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = firstTiled.window;

    const firstLayout = runtimeLayout(controller).snapshot(
      outputId(firstOutput.name),
      desktopId(desktop.id),
    );
    const secondLayout = runtimeLayout(controller).snapshot(
      outputId(secondOutput.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);

    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(firstRemembered.window);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(firstTiled.window);

    fixture.workspace.activeWindow = secondTiled.window;
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(secondRemembered.window);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(secondTiled.window);

    expect(
      runtimeLayout(controller).snapshot(
        outputId(firstOutput.name),
        desktopId(desktop.id),
      ),
    ).toEqual(firstLayout);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(secondOutput.name),
        desktopId(desktop.id),
      ),
    ).toEqual(secondLayout);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
  });

  it("keeps remembered layer focus isolated between desktop contexts", () => {
    const output = createOutput("DP-1", 0);
    const firstDesktop = { id: "desktop-1" };
    const secondDesktop = { id: "desktop-2" };
    const firstTiled = createTrackedWindow("first-tiled", output, firstDesktop);
    const firstRemembered = createTrackedWindow(
      "first-remembered",
      output,
      firstDesktop,
    );
    const firstTopmost = createTrackedWindow(
      "first-topmost",
      output,
      firstDesktop,
    );
    const secondTiled = createTrackedWindow(
      "second-tiled",
      output,
      secondDesktop,
    );
    const secondRemembered = createTrackedWindow(
      "second-remembered",
      output,
      secondDesktop,
    );
    const secondTopmost = createTrackedWindow(
      "second-topmost",
      output,
      secondDesktop,
    );
    const windows = [
      firstTiled,
      firstRemembered,
      firstTopmost,
      secondTiled,
      secondRemembered,
      secondTopmost,
    ];
    const fixture = createWorkspace(
      output,
      firstDesktop,
      [output],
      [firstDesktop, secondDesktop],
      windows.map(({ window }) => window),
    );
    fixture.workspace.activeWindow = firstTopmost.window;
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = firstRemembered.window;
    expect(controller.toggleFloating()).toBe(true);

    fixture.setCurrentDesktop(output, secondDesktop);
    fixture.workspace.activeWindow = secondTopmost.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = secondRemembered.window;
    expect(controller.toggleFloating()).toBe(true);

    fixture.setCurrentDesktop(output, firstDesktop);
    fixture.workspace.activeWindow = firstTiled.window;
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(firstRemembered.window);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(firstTiled.window);

    fixture.setCurrentDesktop(output, secondDesktop);
    fixture.workspace.activeWindow = secondTiled.window;
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(secondRemembered.window);
    expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(secondTiled.window);
  });

  it.each([
    {
      decoyFrame: { height: 100, width: 20, x: 450, y: 450 },
      direction: "left",
      expectedFrame: { height: 100, width: 980, x: 0, y: 5_000 },
    },
    {
      decoyFrame: { height: 100, width: 100, x: 501, y: 450 },
      direction: "right",
      expectedFrame: { height: 100, width: 20, x: 510, y: -5_000 },
    },
    {
      decoyFrame: { height: 20, width: 100, x: 450, y: 450 },
      direction: "up",
      expectedFrame: { height: 980, width: 100, x: 5_000, y: 0 },
    },
    {
      decoyFrame: { height: 100, width: 100, x: 450, y: 501 },
      direction: "down",
      expectedFrame: { height: 20, width: 100, x: -5_000, y: 510 },
    },
  ] as const)(
    "focuses the closest floating center on the $direction axis",
    ({ decoyFrame, direction, expectedFrame }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const tiled = createTrackedWindow("tiled", output, desktop);
      const expected = createTrackedWindow("expected", output, desktop);
      const decoy = createTrackedWindow("decoy", output, desktop);
      const active = createTrackedWindow("active", output, desktop);
      const windows = [tiled, expected, decoy, active];
      const fixture = createWorkspace(
        output,
        desktop,
        [output],
        [desktop],
        windows.map(({ window }) => window),
      );
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        columnWidth: { kind: "fixed", value: 300 },
        gap: 10,
      });

      expect(controller.start()).toBe(true);

      for (const floating of [expected, decoy, active]) {
        fixture.workspace.activeWindow = floating.window;
        expect(controller.toggleFloating()).toBe(true);
      }

      active.setFrameGeometry({ height: 200, width: 200, x: 400, y: 400 });
      expected.setFrameGeometry(expectedFrame);
      decoy.setFrameGeometry(decoyFrame);
      fixture.workspace.activeWindow = active.window;
      const layout = runtimeLayout(controller);
      layout.setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        -37,
      );
      controller.reconcile();
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;
      const focused =
        direction === "left"
          ? controller.focusLeft()
          : direction === "right"
            ? controller.focusRight()
            : direction === "up"
              ? controller.focusUp()
              : controller.focusDown();

      expect(focused).toBe(true);
      expect(fixture.workspace.activeWindow).toBe(expected.window);
      expect(fixture.activationCount).toBe(activationCount + 1);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    },
  );

  it("navigates between manual and automatic floating windows and remembers the result", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const manual = createTrackedWindow("manual", output, desktop);
    const automatic = createTrackedWindow("automatic", output, desktop, {
      clientGeometry: { height: 100, width: 100, x: 550, y: 450 },
      frameGeometry: { height: 100, width: 100, x: 550, y: 450 },
      maxSize: { height: 100, width: 100 },
      minSize: { height: 100, width: 100 },
    });
    const windows = [tiled, manual, automatic];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    fixture.workspace.activeWindow = manual.window;
    expect(controller.toggleFloating()).toBe(true);
    manual.setFrameGeometry({ height: 100, width: 100, x: 350, y: 450 });
    automatic.setFrameGeometry({
      height: 100,
      width: 100,
      x: 550,
      y: 450,
    });
    fixture.workspace.activeWindow = manual.window;
    const layout = runtimeLayout(controller);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);
    const activationCount = fixture.activationCount;

    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(automatic.window);
    expect(controller.focusTiling()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(tiled.window);
    expect(controller.focusFloating()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(automatic.window);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(manual.window);

    expect(fixture.activationCount).toBe(activationCount + 4);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
  });

  it("uses floating stack order for directional ties and does not wrap", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const bottomTie = createTrackedWindow("bottom-tie", output, desktop);
    const overlap = createTrackedWindow("overlap", output, desktop);
    const active = createTrackedWindow("active", output, desktop);
    const topTie = createTrackedWindow("top-tie", output, desktop);
    const floating = [bottomTie, overlap, active, topTie];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tiled.window, ...floating.map(({ window }) => window)],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);

    for (const candidate of floating) {
      fixture.workspace.activeWindow = candidate.window;
      expect(controller.toggleFloating()).toBe(true);
    }

    bottomTie.setFrameGeometry({ height: 100, width: 100, x: 350, y: 100 });
    overlap.setFrameGeometry({ height: 100, width: 100, x: 450, y: 450 });
    active.setFrameGeometry({ height: 100, width: 100, x: 450, y: 450 });
    topTie.setFrameGeometry({ height: 100, width: 100, x: 350, y: 700 });
    fixture.workspace.activeWindow = active.window;

    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(topTie.window);

    fixture.workspace.activeWindow = bottomTie.window;
    const activationCount = fixture.activationCount;
    expect(controller.focusLeft()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(bottomTie.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("uses floating left edges for Home and right edges for End", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const leftBottom = createTrackedWindow("left-bottom", output, desktop);
    const rightBottom = createTrackedWindow("right-bottom", output, desktop);
    const leftByCenter = createTrackedWindow("left-by-center", output, desktop);
    const rightByCenter = createTrackedWindow(
      "right-by-center",
      output,
      desktop,
    );
    const active = createTrackedWindow("active", output, desktop);
    const leftTop = createTrackedWindow("left-top", output, desktop);
    const rightTop = createTrackedWindow("right-top", output, desktop);
    const floating = [
      leftBottom,
      rightBottom,
      leftByCenter,
      rightByCenter,
      active,
      leftTop,
      rightTop,
    ];
    const windows = [tiled, ...floating];
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);

    for (const candidate of floating) {
      fixture.workspace.activeWindow = candidate.window;
      expect(controller.toggleFloating()).toBe(true);
    }

    leftBottom.setFrameGeometry({ height: 100, width: 1_000, x: 0, y: 100 });
    leftTop.setFrameGeometry({ height: 100, width: 1_000, x: 0, y: 200 });
    leftByCenter.setFrameGeometry({ height: 100, width: 10, x: 10, y: 300 });
    rightBottom.setFrameGeometry({ height: 100, width: 10, x: 900, y: 400 });
    rightTop.setFrameGeometry({ height: 100, width: 10, x: 900, y: 500 });
    rightByCenter.setFrameGeometry({
      height: 100,
      width: 1_000,
      x: 890,
      y: 600,
    });
    active.setFrameGeometry({ height: 100, width: 100, x: 400, y: 700 });
    fixture.workspace.activeWindow = active.window;
    const layout = runtimeLayout(controller);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);

    expect(controller.focusFirstColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(leftTop.window);
    expect(controller.focusLastColumn()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(rightBottom.window);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
  });

  it("excludes minimized and foreign-context floating candidates", () => {
    const firstOutput = createOutput("DP-1", 0);
    const secondOutput = createOutput("HDMI-A-1", 1_000);
    const firstDesktop = { id: "desktop-1" };
    const secondDesktop = { id: "desktop-2" };
    const tiled = createTrackedWindow("tiled", firstOutput, firstDesktop);
    const eligible = createTrackedWindow(
      "eligible",
      firstOutput,
      firstDesktop,
      { dialog: true, normalWindow: false },
    );
    const active = createTrackedWindow("active", firstOutput, firstDesktop);
    const minimized = createTrackedWindow(
      "minimized",
      firstOutput,
      firstDesktop,
      { dialog: true, minimized: true, normalWindow: false },
    );
    const foreignOutput = createTrackedWindow(
      "foreign-output",
      secondOutput,
      firstDesktop,
      { dialog: true, normalWindow: false },
    );
    const foreignDesktop = createTrackedWindow(
      "foreign-desktop",
      firstOutput,
      secondDesktop,
      { dialog: true, normalWindow: false },
    );
    const windows = [
      tiled,
      eligible,
      active,
      minimized,
      foreignOutput,
      foreignDesktop,
    ];
    const fixture = createWorkspace(
      firstOutput,
      firstDesktop,
      [firstOutput, secondOutput],
      [firstDesktop, secondDesktop],
      windows.map(({ window }) => window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    fixture.workspace.activeWindow = active.window;
    expect(controller.toggleFloating()).toBe(true);
    active.setFrameGeometry({ height: 100, width: 100, x: 400, y: 400 });
    eligible.setFrameGeometry({ height: 100, width: 100, x: 600, y: 400 });
    minimized.setFrameGeometry({ height: 100, width: 100, x: 501, y: 400 });
    foreignOutput.setFrameGeometry({
      height: 100,
      width: 100,
      x: 502,
      y: 400,
    });
    foreignDesktop.setFrameGeometry({
      height: 100,
      width: 100,
      x: 503,
      y: 400,
    });
    fixture.workspace.activeWindow = active.window;

    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(eligible.window);
  });

  it("skips a minimized manual-floating window without changing its placement", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tiled = createTrackedWindow("tiled", output, desktop);
    const eligible = createTrackedWindow("eligible", output, desktop);
    const minimized = createTrackedWindow("minimized", output, desktop);
    const active = createTrackedWindow("active", output, desktop);
    const windows = [tiled, eligible, minimized, active];
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
      scheduleResume: scheduler.schedule,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = eligible.window;
    expect(controller.toggleFloating()).toBe(true);
    fixture.workspace.activeWindow = minimized.window;
    expect(controller.toggleFloating()).toBe(true);
    active.setFrameGeometry({ height: 100, width: 100, x: 400, y: 400 });
    minimized.setFrameGeometry({ height: 100, width: 100, x: 501, y: 400 });
    eligible.setFrameGeometry({ height: 100, width: 100, x: 600, y: 400 });
    fixture.workspace.activeWindow = active.window;
    setWindowState("minimized", minimized, true);
    flushManualScheduler(scheduler);
    const layout = runtimeLayout(controller);
    const before = layout.snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
    const writes = windows.map(({ writeCount }) => writeCount);

    expect(controller.floatingCount).toBe(3);
    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(eligible.window);
    expect(minimized.window.minimized).toBe(true);
    expect(controller.floatingCount).toBe(3);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
    expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
    expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);

    setWindowState("minimized", minimized, false);
    flushManualScheduler(scheduler);
    expect(controller.floatingCount).toBe(3);
    expect(minimized.window.frameGeometry).toEqual(frames[2]);
    expect(
      layout.snapshot(outputId(output.name), desktopId(desktop.id)),
    ).toEqual(before);
  });

  it.each(
    (
      [
        "fullscreen",
        "maximized",
        "native tiled",
        "restore settling",
        "toggle unsettled",
      ] as const
    ).flatMap((blocker) =>
      (
        [
          {
            blockedFrame: { height: 100, width: 100, x: 400, y: 500 },
            destination: "left",
            eligibleFrame: { height: 100, width: 100, x: 300, y: 500 },
          },
          {
            blockedFrame: { height: 100, width: 100, x: 600, y: 500 },
            destination: "right",
            eligibleFrame: { height: 100, width: 100, x: 700, y: 500 },
          },
          {
            blockedFrame: { height: 100, width: 100, x: 500, y: 400 },
            destination: "up",
            eligibleFrame: { height: 100, width: 100, x: 500, y: 300 },
          },
          {
            blockedFrame: { height: 100, width: 100, x: 500, y: 600 },
            destination: "down",
            eligibleFrame: { height: 100, width: 100, x: 500, y: 700 },
          },
          {
            blockedFrame: { height: 100, width: 100, x: 100, y: 500 },
            destination: "first",
            eligibleFrame: { height: 100, width: 100, x: 200, y: 500 },
          },
          {
            blockedFrame: { height: 100, width: 100, x: 900, y: 500 },
            destination: "last",
            eligibleFrame: { height: 100, width: 100, x: 800, y: 500 },
          },
        ] as const
      ).map((testCase) => ({ ...testCase, blocker })),
    ),
  )(
    "does not bypass a $blocker floating $destination target",
    ({ blockedFrame, blocker, destination, eligibleFrame }) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const tiled = createTrackedWindow("tiled", output, desktop);
      const eligible = createTrackedWindow("eligible", output, desktop);
      const blocked = createTrackedWindow("blocked", output, desktop);
      const active = createTrackedWindow("active", output, desktop);
      const windows = [tiled, eligible, blocked, active];
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = blocked.window;
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = eligible.window;
      expect(controller.toggleFloating()).toBe(true);
      active.setFrameGeometry({ height: 100, width: 100, x: 500, y: 500 });
      blocked.setFrameGeometry(blockedFrame);
      eligible.setFrameGeometry(eligibleFrame);
      fixture.workspace.activeWindow = active.window;
      blockWindowFocus(controller, blocked, blocker);
      flushManualScheduler(scheduler);
      const layout = runtimeLayout(controller);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;
      const focused =
        destination === "left"
          ? controller.focusLeft()
          : destination === "right"
            ? controller.focusRight()
            : destination === "up"
              ? controller.focusUp()
              : destination === "down"
                ? controller.focusDown()
                : destination === "first"
                  ? controller.focusFirstColumn()
                  : controller.focusLastColumn();

      expect(focused).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(active.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    },
  );

  it.each([
    "fullscreen",
    "maximized",
    "native tiled",
    "restore settling",
    "toggle unsettled",
  ] as const)(
    "keeps every floating focus command inert while active is %s",
    (blocker) => {
      const output = createOutput("DP-1", 0);
      const desktop = { id: "desktop-1" };
      const target = createTrackedWindow("target", output, desktop);
      const active = createTrackedWindow("active", output, desktop);
      const windows = [target, active];
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
        gap: 10,
        schedule: scheduler.schedule,
        scheduleResume: scheduler.schedule,
      });

      expect(controller.start()).toBe(true);
      expect(controller.toggleFloating()).toBe(true);
      fixture.workspace.activeWindow = target.window;
      expect(controller.toggleFloating()).toBe(true);
      active.setFrameGeometry({ height: 100, width: 100, x: 500, y: 500 });
      target.setFrameGeometry({ height: 100, width: 100, x: 700, y: 700 });
      fixture.workspace.activeWindow = active.window;
      blockWindowFocus(controller, active, blocker);
      flushManualScheduler(scheduler);
      const layout = runtimeLayout(controller);
      const before = layout.snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      );
      const frames = windows.map(({ window }) => ({ ...window.frameGeometry }));
      const writes = windows.map(({ writeCount }) => writeCount);
      const activationCount = fixture.activationCount;

      expect(controller.focusLeft()).toBe(false);
      expect(controller.focusRight()).toBe(false);
      expect(controller.focusUp()).toBe(false);
      expect(controller.focusDown()).toBe(false);
      expect(controller.focusFirstColumn()).toBe(false);
      expect(controller.focusLastColumn()).toBe(false);
      expect(controller.switchFocusBetweenFloatingAndTiling()).toBe(false);
      expect(controller.focusTiling()).toBe(false);
      expect(controller.focusFloating()).toBe(false);
      expect(fixture.workspace.activeWindow).toBe(active.window);
      expect(fixture.activationCount).toBe(activationCount);
      expect(
        layout.snapshot(outputId(output.name), desktopId(desktop.id)),
      ).toEqual(before);
      expect(windows.map(({ window }) => window.frameGeometry)).toEqual(frames);
      expect(windows.map(({ writeCount }) => writeCount)).toEqual(writes);
    },
  );

  it("keeps tiled directional focus behavior when floating windows exist", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const stackTop = createTrackedWindow("stack-top", output, desktop);
    const stackBottom = createTrackedWindow("stack-bottom", output, desktop);
    const right = createTrackedWindow("right", output, desktop);
    const floating = createTrackedWindow("floating", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [stackTop.window, stackBottom.window, right.window, floating.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 300 },
      gap: 10,
    });

    expect(controller.start()).toBe(true);
    expect(controller.toggleFloating()).toBe(true);
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 300 },
        windowIds: ["stack-top", "stack-bottom"],
      },
      {
        id: "column:right",
        width: { kind: "fixed", value: 300 },
        windowIds: ["right"],
      },
    ]);
    floating.setFrameGeometry({ height: 100, width: 100, x: 1, y: 1 });
    fixture.workspace.activeWindow = stackTop.window;
    const floatingFrame = { ...floating.window.frameGeometry };
    const floatingWrites = floating.writeCount;

    expect(controller.focusDown()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(stackBottom.window);
    expect(controller.focusUp()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(stackTop.window);
    expect(controller.focusRight()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(right.window);
    expect(controller.focusLeft()).toBe(true);
    expect(fixture.workspace.activeWindow).toBe(stackTop.window);
    expect(floating.window.frameGeometry).toEqual(floatingFrame);
    expect(floating.writeCount).toBe(floatingWrites);
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
                clientFrame: KWinWindow["clientGeometry"];
                fingerprint: string;
                frame: KWinWindow["frameGeometry"];
                kind: "client" | "frame";
                noBorder: boolean | undefined;
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
              clientFrame: { height: 1, width: 1, x: 1, y: 1 },
              fingerprint: "stale-context",
              frame: { height: 1, width: 1, x: 1, y: 1 },
              kind: "frame",
              noBorder: false,
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

  it("moves the active column directly to both strip edges", () => {
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
    expect(controller.moveColumnToFirst()).toBe(true);
    expect(positions()).toEqual([495, 990, 0]);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-3", windowIds: ["window-3"] },
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-2", windowIds: ["window-2"] },
    ]);
    expect(controller.moveColumnToFirst()).toBe(false);

    expect(controller.moveColumnToLast()).toBe(true);
    expect(positions()).toEqual([-475, 20, 515]);
    expect(testLayoutColumns(controller, output, desktop)).toEqual([
      { id: "column:window-1", windowIds: ["window-1"] },
      { id: "column:window-2", windowIds: ["window-2"] },
      { id: "column:window-3", windowIds: ["window-3"] },
    ]);
    expect(controller.moveColumnToLast()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("rolls back a direct edge move after a partial geometry failure", () => {
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
    const beforeLayout = testLayoutColumns(controller, output, desktop);
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    windows[1]?.setWriteBehavior(() => {
      throw new Error("geometry rejected");
    });
    console.warn = () => undefined;

    try {
      expect(controller.moveColumnToFirst()).toBe(false);
    } finally {
      console.warn = warning;
      windows[1]?.setWriteBehavior(null);
    }

    expect(testLayoutColumns(controller, output, desktop)).toEqual(
      beforeLayout,
    );
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
    expect(fixture.workspace.activeWindow).toBe(windows[2]?.window);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(scheduler.pendingCount).toBe(0);
    expect(controller.moveColumnToFirst()).toBe(true);
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
      value: 0.6,
    });
    expect(active.window.frameGeometry.width).toBe(584);
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
      value: 0.4,
    });
    expect(active.window.frameGeometry.width).toBe(386);
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

  it("cycles preset column widths in both directions", () => {
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
      gap: 10,
    });

    controller.start();

    expect(controller.switchPresetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 2 / 3,
    });
    expect(active.window.frameGeometry.width).toBe(650);

    expect(controller.switchPresetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1 / 3,
    });
    expect(active.window.frameGeometry.width).toBe(320);

    expect(controller.switchPresetColumnWidthBack()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 2 / 3,
    });
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("selects the nearest preset in the requested direction", () => {
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
      gap: 10,
    });

    controller.start();
    const layout = runtimeLayout(controller);
    const id = windowId(String(active.window.internalId));

    expect(
      layout.setActiveColumnWidth(id, { kind: "fixed", value: 321 }),
    ).toEqual({ kind: "proportion", value: 0.5 });
    controller.reconcile();
    expect(controller.switchPresetColumnWidthBack()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1 / 3,
    });

    expect(
      layout.setActiveColumnWidth(id, { kind: "fixed", value: 319 }),
    ).toEqual({ kind: "proportion", value: 1 / 3 });
    controller.reconcile();
    expect(controller.switchPresetColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1 / 3,
    });
  });

  it("changes and resets singleton height including a state-only clamp", () => {
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
      gap: 10,
    });

    controller.start();
    const automaticFrame = { ...active.window.frameGeometry };
    const automaticWrites = active.writeCount;

    expect(automaticFrame.height).toBe(780);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { kind: "auto", weight: 1 },
    ]);
    expect(controller.increaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry).toEqual(automaticFrame);
    expect(active.writeCount).toBe(automaticWrites);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { clientHeight: 780, kind: "fixed" },
    ]);
    expect(controller.increaseWindowHeight()).toBe(false);

    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBe(701);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { clientHeight: 701, kind: "fixed" },
    ]);
    expect(controller.increaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBe(780);

    const writesBeforeReset = active.writeCount;
    expect(controller.resetWindowHeight()).toBe(true);
    expect(active.window.frameGeometry).toEqual(automaticFrame);
    expect(active.writeCount).toBe(writesBeforeReset);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { kind: "auto", weight: 1 },
    ]);
    expect(controller.resetWindowHeight()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
  });

  it("redistributes a two-window stack and resets it to automatic", () => {
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
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 400 },
        windowIds: ["window-1", "window-2"],
      },
    ]);

    expect(
      [first, active].map((window) => window.window.frameGeometry.height),
    ).toEqual([385, 385]);
    expect(controller.increaseWindowHeight()).toBe(true);
    expect(
      [first, active].map((window) => window.window.frameGeometry.height),
    ).toEqual([306, 464]);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { kind: "auto", weight: 1 },
      { clientHeight: 464, kind: "fixed" },
    ]);

    expect(controller.resetWindowHeight()).toBe(true);
    expect(
      [first, active].map((window) => window.window.frameGeometry.height),
    ).toEqual([385, 385]);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { kind: "auto", weight: 1 },
      { kind: "auto", weight: 1 },
    ]);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("retains sibling weights while resizing an already fixed member", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      minSize: { height: 200, width: 1 },
    });
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
      gap: 10,
    });

    controller.start();
    const layout = installTestLayout(
      controller,
      output,
      desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 400 },
          windowIds: ["window-1", "window-2", "window-3"],
        },
      ],
    );
    const edit = layout.setActiveColumnWindowHeights(windowId("window-3"), [
      { kind: "auto", weight: 1 },
      { kind: "auto", weight: 3 },
      { clientHeight: 200, kind: "fixed" },
    ]);

    if (!edit) {
      throw new Error("could not install window-height state");
    }

    layout.discardWindowHeightEditRollback(edit.rollback);
    controller.reconcile();
    expect(
      [first, second, active].map(
        (window) => window.window.frameGeometry.height,
      ),
    ).toEqual([200, 360, 200]);

    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(
      [first, second, active].map(
        (window) => window.window.frameGeometry.height,
      ),
    ).toEqual([200, 439, 121]);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { kind: "auto", weight: 1 },
      { kind: "auto", weight: 3 },
      { clientHeight: 121, kind: "fixed" },
    ]);
  });

  it("cycles default window-height presets forward, backward, and around", () => {
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
      gap: 10,
    });

    controller.start();

    for (const [index, frameHeight] of [
      [0, 253],
      [1, 385],
      [2, 517],
      [0, 253],
    ] as const) {
      expect(controller.switchPresetWindowHeight()).toBe(true);
      expect(active.window.frameGeometry.height).toBe(frameHeight);
      expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
        { index, kind: "preset" },
      ]);
    }

    expect(controller.switchPresetWindowHeightBack()).toBe(true);
    expect(active.window.frameGeometry.height).toBe(517);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { index: 2, kind: "preset" },
    ]);
  });

  it("stores decorated fixed heights in client coordinates", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop, {
      clientGeometry: { height: 196, width: 280, x: 10, y: 12 },
      frameGeometry: { height: 220, width: 300, x: 0, y: 0 },
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
      gap: 10,
    });

    controller.start();
    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBe(701);
    expect(active.window.clientGeometry.height).toBe(677);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { clientHeight: 677, kind: "fixed" },
    ]);
  });

  it("accepts sub-epsilon negative decoration noise", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop, {
      clientGeometry: { height: 200.0000005, width: 300, x: 0, y: 0 },
      frameGeometry: { height: 200, width: 300, x: 0, y: 0 },
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
      gap: 10,
    });

    controller.start();
    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBe(701);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { clientHeight: 701, kind: "fixed" },
    ]);
    expect(controller.increaseWindowHeight()).toBe(true);
  });

  it("reaches the one-pixel core minimum when the client minimum is zero", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow("window-1", output, desktop, {
      minSize: { height: 0, width: 1 },
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
      gap: 10,
    });

    controller.start();

    for (let step = 0; step < 10; step += 1) {
      expect(controller.decreaseWindowHeight()).toBe(true);
    }

    expect(active.window.frameGeometry.height).toBe(1);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual([
      { clientHeight: 1, kind: "fixed" },
    ]);
    expect(controller.decreaseWindowHeight()).toBe(false);
  });

  it("aligns window-height constraints to physical pixels", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const active = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
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
      gap: 10,
    });
    const constraints = active.window as unknown as {
      maxSize: KWinWindow["maxSize"];
      minSize: KWinWindow["minSize"];
    };

    trackedOutput.setScale(1.25);
    controller.start();
    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBeCloseTo(700.8, 10);

    constraints.maxSize = { height: 730, width: 10_000 };
    expect(controller.increaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBeCloseTo(729.6, 10);
    expect(
      activeColumnWindowHeights(controller, trackedOutput.output, desktop),
    ).toEqual([{ clientHeight: 729.6, kind: "fixed" }]);

    constraints.minSize = { height: 711, width: 1 };
    expect(controller.decreaseWindowHeight()).toBe(true);
    expect(active.window.frameGeometry.height).toBeCloseTo(711.2, 10);
    expect(
      activeColumnWindowHeights(controller, trackedOutput.output, desktop),
    ).toEqual([{ clientHeight: 711.2, kind: "fixed" }]);
    expect(controller.decreaseWindowHeight()).toBe(false);
  });

  it("reserves fractional sibling minima before storing a fixed height", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow(
      "window-1",
      trackedOutput.output,
      desktop,
      { minSize: { height: 101, width: 1 } },
    );
    const active = createTrackedWindow(
      "window-2",
      trackedOutput.output,
      desktop,
    );
    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output],
      [desktop],
      [first.window, active.window],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      gap: 10,
    });

    trackedOutput.setScale(1.25);
    controller.start();
    const layout = installTestLayout(
      controller,
      trackedOutput.output,
      desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 400 },
          windowIds: ["window-1", "window-2"],
        },
      ],
    );
    const edit = layout.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 1 },
      { clientHeight: 590, kind: "fixed" },
    ]);

    if (!edit) {
      throw new Error("could not install window-height state");
    }

    layout.discardWindowHeightEditRollback(edit.rollback);
    controller.reconcile();
    expect(controller.increaseWindowHeight()).toBe(true);
    expect(first.window.frameGeometry.height).toBeGreaterThanOrEqual(101);
    expect(
      activeColumnWindowHeights(controller, trackedOutput.output, desktop),
    ).toEqual([
      { kind: "auto", weight: 1 },
      { clientHeight: 668, kind: "fixed" },
    ]);
  });

  it("restores exact stack frames and height state after a partial write", () => {
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
    const warning = console.warn;

    controller.start();
    installTestLayout(controller, output, desktop, "column:stack", [
      {
        id: "column:stack",
        width: { kind: "fixed", value: 400 },
        windowIds: ["window-1", "window-2"],
      },
    ]);
    expect(controller.increaseWindowHeight()).toBe(true);
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = [first, active].map((window) => ({
      ...window.window.frameGeometry,
    }));
    const beforeHeights = activeColumnWindowHeights(
      controller,
      output,
      desktop,
    );
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
      expect(controller.decreaseWindowHeight()).toBe(false);
    } finally {
      console.warn = warning;
      active.setWriteBehavior(null);
    }

    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(activeColumnWindowHeights(controller, output, desktop)).toEqual(
      beforeHeights,
    );
    expect(
      [first, active].map((window) => window.window.frameGeometry),
    ).toEqual(beforeFrames);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("toggles full-width columns and discards the restore on manual resize", () => {
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
      gap: 10,
    });

    controller.start();

    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1,
    });
    expect(active.window.frameGeometry.width).toBe(980);
    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });

    expect(controller.maximizeColumn()).toBe(true);
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.9,
    });
    expect(controller.maximizeColumn()).toBe(true);
    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.9,
    });
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("discards full-width restore state when a column ID is reused", () => {
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
    fixture.workspace.activeWindow = first.window;
    expect(controller.maximizeColumn()).toBe(true);
    expect(controller.moveWindowRight()).toBe(true);
    expect(controller.moveWindowLeft()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 0.5,
    });

    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1,
    });
  });

  it("discards full-width restore state when the last column member closes", () => {
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
      gap: 10,
    });

    controller.start();
    expect(controller.maximizeColumn()).toBe(true);
    fixture.windowRemoved.emit(active.window);

    const replacement = createTrackedWindow("window-1", output, desktop);
    fixture.windowAdded.emit(replacement.window);
    fixture.workspace.activeWindow = replacement.window;
    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1,
    });
  });

  it("centers the active column without changing order or focus", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const middle = windows[1];

    if (!middle) {
      throw new Error("missing middle column fixture");
    }

    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 500 },
      gap: 10,
    });

    controller.start();
    fixture.workspace.activeWindow = middle.window;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.centerColumn()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(270);
    expect(middle.window.frameGeometry.x).toBe(250);
    expect(after.columns).toEqual(before.columns);
    expect(controller.centerColumn()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(middle.window);
  });

  it("settles centering when the exact midpoint is between physical pixels", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const middle = windows[1];

    if (!middle) {
      throw new Error("missing middle column fixture");
    }

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

    controller.start();
    fixture.workspace.activeWindow = middle.window;

    expect(controller.centerColumn()).toBe(true);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(248);
    expect(middle.window.frameGeometry).toMatchObject({
      width: 485,
      x: 257,
    });
    expect(controller.centerColumn()).toBe(false);
  });

  it("centers a lone column with a signed viewport offset", () => {
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

    expect(controller.centerColumn()).toBe(true);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(-340);
    expect(active.window.frameGeometry).toMatchObject({ width: 300, x: 350 });
    expect(controller.centerColumn()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("centers the first and last columns beyond normal strip bounds", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const first = windows[0];
    const last = windows[2];

    if (!first || !last) {
      throw new Error("missing edge column fixture");
    }

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
    fixture.workspace.activeWindow = first.window;
    const order = testLayoutColumns(controller, output, desktop);
    const activationCount = fixture.activationCount;

    expect(controller.centerColumn()).toBe(true);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(-340);
    expect(first.window.frameGeometry.x).toBe(350);

    fixture.workspace.activeWindow = last.window;
    expect(controller.centerColumn()).toBe(true);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(280);
    expect(last.window.frameGeometry.x).toBe(350);
    expect(testLayoutColumns(controller, output, desktop)).toEqual(order);
    expect(fixture.workspace.activeWindow).toBe(last.window);
    expect(fixture.activationCount).toBe(activationCount + 1);
  });

  it("expands a visible column to fill the remaining width", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[1];

    if (!active) {
      throw new Error("missing active column fixture");
    }

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
    fixture.workspace.activeWindow = active.window;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const activationCount = fixture.activationCount;

    expect(controller.expandColumnToAvailableWidth()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(0);
    expect(after.columns.map((column) => column.id)).toEqual(
      before.columns.map((column) => column.id),
    );
    expect(after.columns.map((column) => column.windowIds)).toEqual(
      before.columns.map((column) => column.windowIds),
    );
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 460,
    });
    expect(windows.map((window) => window.window.frameGeometry)).toEqual([
      { height: 780, width: 250, x: 10, y: 10 },
      { height: 780, width: 460, x: 270, y: 10 },
      { height: 780, width: 250, x: 740, y: 10 },
    ]);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("enters full width from a lone visible column without toggling back", () => {
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

    expect(controller.expandColumnToAvailableWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1,
    });
    expect(active.window.frameGeometry).toMatchObject({ width: 980, x: 10 });
    expect(controller.expandColumnToAvailableWidth()).toBe(false);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 1,
    });

    expect(controller.maximizeColumn()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 300,
    });
    expect(active.window.frameGeometry).toMatchObject({ width: 300, x: 10 });
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("does not expand when visible columns already consume the work area", () => {
    const output = createOutput("DP-1", 0);
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

    expect(controller.expandColumnToAvailableWidth()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(windows.map((window) => window.window.frameGeometry)).toEqual(
      beforeFrames,
    );
  });

  it("does not change column view actions when the active column is partial", () => {
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
      columnWidth: { kind: "fixed", value: 1200 },
      gap: 10,
    });

    controller.start();
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrame = { ...active.window.frameGeometry };

    expect(controller.expandColumnToAvailableWidth()).toBe(false);
    expect(controller.centerVisibleColumns()).toBe(false);
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ),
    ).toEqual(beforeLayout);
    expect(active.window.frameGeometry).toEqual(beforeFrame);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("aligns visible columns when the active width is already at its maximum", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 4 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop, {
        ...(index === 2 ? { maxSize: { height: 10_000, width: 300 } } : {}),
      }),
    );
    const active = windows[2];
    const leftmost = windows[1];

    if (!active || !leftmost) {
      throw new Error("missing maximum-width fixture");
    }

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
    fixture.workspace.activeWindow = active.window;
    expect(
      runtimeLayout(controller).setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        100,
      ),
    ).toBe(true);
    controller.reconcile();
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const activationCount = fixture.activationCount;

    expect(controller.expandColumnToAvailableWidth()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(310);
    expect(after.columns).toEqual(before.columns);
    expect(leftmost.window.frameGeometry).toMatchObject({ width: 300, x: 10 });
    expect(active.window.frameGeometry).toMatchObject({ width: 300, x: 320 });
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("rolls back available-width expansion after a partial geometry failure", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 4 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[2];
    const rejecting = windows[3];

    if (!active || !rejecting) {
      throw new Error("missing rollback fixture");
    }

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
    const warning = console.warn;

    controller.start();
    fixture.workspace.activeWindow = active.window;
    expect(
      runtimeLayout(controller).setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        100,
      ),
    ).toBe(true);
    controller.reconcile();
    const beforeLayout = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const beforeFrames = windows.map((window) => ({
      ...window.window.frameGeometry,
    }));
    const activationCount = fixture.activationCount;
    let rejectNextWrite = true;
    rejecting.setWriteBehavior((_frame, commit) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("geometry rejected");
      }

      commit();
    });
    console.warn = () => undefined;

    try {
      expect(controller.expandColumnToAvailableWidth()).toBe(false);
    } finally {
      console.warn = warning;
      rejecting.setWriteBehavior(null);
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
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);

    expect(controller.expandColumnToAvailableWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "fixed",
      value: 460,
    });
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(260);
  });

  it("centers a lone visible column with a signed viewport offset", () => {
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
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );

    expect(controller.centerVisibleColumns()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(-340);
    expect(after.columns).toEqual(before.columns);
    expect(active.window.frameGeometry).toMatchObject({ width: 300, x: 350 });
    expect(controller.centerVisibleColumns()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("centers every fully visible fitting column as one group", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 3 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[1];

    if (!active) {
      throw new Error("missing visible-group fixture");
    }

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
    fixture.workspace.activeWindow = active.window;
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const activationCount = fixture.activationCount;

    expect(controller.centerVisibleColumns()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(-105);
    expect(after.columns).toEqual(before.columns);
    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      115, 375, 635,
    ]);
    expect(windows[0]?.window.frameGeometry.x).toBe(
      1000 -
        ((windows[2]?.window.frameGeometry.x ?? 0) +
          (windows[2]?.window.frameGeometry.width ?? 0)),
    );
    expect(controller.centerVisibleColumns()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("centers an interior fully visible subset without changing its columns", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const windows = Array.from({ length: 5 }, (_value, index) =>
      createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
    );
    const active = windows[2];

    if (!active) {
      throw new Error("missing interior visible-group fixture");
    }

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
    fixture.workspace.activeWindow = active.window;
    expect(
      runtimeLayout(controller).setViewportOffset(
        outputId(output.name),
        desktopId(desktop.id),
        300,
      ),
    ).toBe(true);
    controller.reconcile();
    const before = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    const activationCount = fixture.activationCount;

    expect(controller.centerVisibleColumns()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(output.name),
      desktopId(desktop.id),
    );
    expect(after.viewportOffset).toBe(280);
    expect(after.columns).toEqual(before.columns);
    expect(windows.map((window) => window.window.frameGeometry.x)).toEqual([
      -270, 40, 350, 660, 970,
    ]);
    expect(windows[1]?.window.frameGeometry.x).toBe(
      1000 -
        ((windows[3]?.window.frameGeometry.x ?? 0) +
          (windows[3]?.window.frameGeometry.width ?? 0)),
    );
    expect(controller.centerVisibleColumns()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(activationCount);
  });

  it("recognizes snapped edge columns when centering at fractional scale", () => {
    const trackedOutput = createTrackedOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    trackedOutput.setScale(1.25);
    const windows = Array.from({ length: 5 }, (_value, index) =>
      createTrackedWindow(
        `window-${String(index + 1)}`,
        trackedOutput.output,
        desktop,
      ),
    );
    const active = windows[4];

    if (!active) {
      throw new Error("missing fractional-scale fixture");
    }

    const fixture = createWorkspace(
      trackedOutput.output,
      desktop,
      [trackedOutput.output],
      [desktop],
      windows.map((window) => window.window),
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
      columnWidth: { kind: "fixed", value: 200 },
      gap: 10,
    });

    controller.start();
    expect(
      runtimeLayout(controller).setViewportOffset(
        outputId(trackedOutput.output.name),
        desktopId(desktop.id),
        60,
      ),
    ).toBe(true);
    controller.reconcile();
    expect(
      active.window.frameGeometry.x + active.window.frameGeometry.width,
    ).toBe(990.4);

    expect(controller.centerVisibleColumns()).toBe(true);
    const after = runtimeLayout(controller).snapshot(
      outputId(trackedOutput.output.name),
      desktopId(desktop.id),
    );
    const left = windows[1]?.window.frameGeometry.x ?? 0;
    const right =
      (windows[4]?.window.frameGeometry.x ?? 0) +
      (windows[4]?.window.frameGeometry.width ?? 0);
    expect(after.viewportOffset).toBeCloseTo(135.2, 10);
    expect(left).toBeCloseTo(84.8, 10);
    expect(right).toBeCloseTo(915.2, 10);
    expect(left).toBeCloseTo(1000 - right, 10);
    expect(controller.centerVisibleColumns()).toBe(false);
    expect(fixture.workspace.activeWindow).toBe(active.window);
    expect(fixture.activationCount).toBe(0);
  });

  it("converts a fixed column for percentage adjustments and resets it", () => {
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
      kind: "proportion",
      value: 310 / 990 + 0.1,
    });
    expect(active.window.frameGeometry.width).toBe(399);
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 310 / 990,
    });
    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(activeColumnWidth(controller, output, desktop)).toEqual({
      kind: "proportion",
      value: 310 / 990 - 0.1,
    });
    expect(active.window.frameGeometry.width).toBe(201);
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
    expect(active.window.frameGeometry.width).toBe(370);
    expect(controller.increaseColumnWidth()).toBe(false);

    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(271);
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
    first.setWriteBehavior((_frame, commit) => {
      first.setWriteBehavior(null);
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
      kind: "proportion",
      value: 159.6 / 990,
    });
    expect(active.window.frameGeometry.width).toBe(149.6);
    expect(controller.increaseColumnWidth()).toBe(false);

    expect(controller.decreaseColumnWidth()).toBe(true);
    expect(
      activeColumnWidth(controller, trackedOutput.output, desktop),
    ).toEqual({
      kind: "proportion",
      value: 111.6 / 990,
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
      kind: "proportion",
      value: 410 / 990,
    });
    expect(controller.increaseColumnWidth()).toBe(true);
    expect(active.window.frameGeometry.width).toBe(499);
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
      kind: "proportion",
      value: 530 / 990,
    });
    expect(controller.increaseColumnWidth()).toBe(false);
    expect(active.window.frameGeometry.width).toBe(520);

    for (const expected of [421, 322, 250]) {
      expect(controller.decreaseColumnWidth()).toBe(true);
      expect(active.window.frameGeometry.width).toBe(expected);
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
      value: 0.6,
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

    for (const expected of [301, 202]) {
      expect(setup.controller.decreaseColumnWidth()).toBe(true);
      expect(
        activeColumnWidth(setup.controller, setup.output.output, setup.desktop),
      ).toMatchObject({ kind: "proportion" });
      expect(setup.windows[2]?.window.frameGeometry.width).toBe(expected);
      expect(setup.controller.managedCount).toBe(2);
      setup.workScheduler.flush();
      expect(setup.controller.managedCount).toBe(2);
    }

    expect(setup.controller.decreaseColumnWidth()).toBe(true);
    expect(
      activeColumnWidth(setup.controller, setup.output.output, setup.desktop),
    ).toMatchObject({ kind: "proportion" });
    expect(setup.windows[2]?.window.frameGeometry.width).toBe(103);
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
    expect(
      runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktop.id),
      ).viewportOffset,
    ).toBe(485);
    expect(second.window.frameGeometry.x).toBe(-475);
    expect(third.window.frameGeometry.x).toBe(20);
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

  it("keeps an all-desktop application borderless while layout ownership changes", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const first = createTrackedWindow("window-1", output, desktop, {
      noBorder: false,
    });
    const second = createTrackedWindow("window-2", output, desktop, {
      noBorder: false,
    });
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [first.window, second.window],
    );
    const scheduler = new ManualScheduler();
    const controller = new RuntimeController(fixture.workspace, {
      borderlessWindows: true,
      clientAreaOption: 2,
      gap: 10,
      schedule: scheduler.schedule,
    });

    controller.start();
    expect(first.window.noBorder).toBe(true);
    expect(second.window.noBorder).toBe(true);
    Object.defineProperties(first.window, {
      desktops: { configurable: true, value: [] },
      onAllDesktops: { configurable: true, value: true },
    });
    first.desktopsChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(1);
    expect(first.window.noBorder).toBe(true);
    expect(second.window.noBorder).toBe(true);
    expect(second.window.frameGeometry.x).toBe(10);

    Object.defineProperties(first.window, {
      desktops: { configurable: true, value: [desktop] },
      onAllDesktops: { configurable: true, value: false },
    });
    first.desktopsChanged.emit();
    scheduler.flush();

    expect(controller.managedCount).toBe(2);
    expect(first.window.noBorder).toBe(true);
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

  it("retains a custom capacity lease when height restoration is infeasible", () => {
    const setup = createCapacityFixture(2, { kind: "fixed", value: 100 });
    const warning = console.warn;

    setup.controller.start();
    const layout = installTestLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 1200 },
          windowIds: ["window-1", "window-2"],
        },
      ],
    );
    const edit = layout.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 1 },
      { clientHeight: 300, kind: "fixed" },
    ]);

    if (!edit) {
      throw new Error("could not install window-height state");
    }

    layout.discardWindowHeightEditRollback(edit.rollback);
    setup.controller.reconcile();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(0);

    for (const window of setup.windows) {
      Object.defineProperty(window.window, "minSize", {
        configurable: true,
        value: { height: 500, width: 1 },
      });
    }

    const state = setup.controller as unknown as {
      readonly capacityLeaseByWindow: ReadonlyMap<WindowId, unknown>;
      restoreCapacityLeases(key: string): boolean;
    };
    console.warn = () => undefined;
    let restored: boolean | undefined;

    try {
      expect(() => {
        restored = state.restoreCapacityLeases("DP-1\u0000desktop-1");
      }).not.toThrow();
    } finally {
      console.warn = warning;
    }

    expect(restored).toBe(false);
    expect(state.capacityLeaseByWindow.size).toBe(2);
    expect(setup.controller.managedCount).toBe(0);
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
    const groupWindowHeights: readonly WindowHeight[] = [
      { kind: "auto", weight: 2 },
      { index: 1, kind: "preset" },
    ];
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
      groupWindowHeights,
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
        windowHeights: groupWindowHeights,
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

  it("compacts a filtered custom stack during topology readmission", () => {
    const setup = createCapacityFixture(3, { kind: "fixed", value: 100 });

    setup.controller.start();
    const layout = installGroupedCapacityLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
      [
        { kind: "auto", weight: 2 },
        { clientHeight: 300, kind: "fixed" },
      ],
    );

    setup.controller.reconcile();
    const replacement = createTrackedOutput(setup.output.output.name, 0);

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
    setup.fixture.setScreens([replacement.output]);
    setup.fixture.screensChanged.emit();
    Object.defineProperty(setup.windows[1]?.window ?? {}, "transient", {
      configurable: true,
      value: true,
    });
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);

    expect(setup.controller.managedCount).toBe(2);
    expect(setup.controller.automaticFloatingCount).toBe(1);
    expect(
      layout.snapshot(
        outputId(replacement.output.name),
        desktopId(setup.desktop.id),
      ).columns,
    ).toContainEqual({
      id: "column:group",
      width: { kind: "fixed", value: 700 },
      windowIds: ["window-1"],
    });
  });

  it("defers infeasible custom height state during topology readmission", () => {
    const setup = createCapacityFixture(2, { kind: "fixed", value: 100 });
    let workAreaHeight = 800;
    Object.defineProperty(setup.fixture.workspace, "clientArea", {
      configurable: true,
      value: (_option: number, output: KWinOutput) => ({
        height: workAreaHeight,
        width: 1000,
        x: output.geometry.x,
        y: output.geometry.y,
      }),
    });
    const warning = console.warn;

    for (const window of setup.windows) {
      Object.defineProperty(window.window, "minSize", {
        configurable: true,
        value: { height: 200, width: 1 },
      });
    }

    setup.controller.start();
    const layout = installTestLayout(
      setup.controller,
      setup.output.output,
      setup.desktop,
      "column:stack",
      [
        {
          id: "column:stack",
          width: { kind: "fixed", value: 1200 },
          windowIds: ["window-1", "window-2"],
        },
      ],
    );
    const edit = layout.setActiveColumnWindowHeights(windowId("window-2"), [
      { kind: "auto", weight: 1 },
      { clientHeight: 300, kind: "fixed" },
    ]);

    if (!edit) {
      throw new Error("could not install window-height state");
    }

    layout.discardWindowHeightEditRollback(edit.rollback);
    setup.controller.reconcile();
    setup.fixture.setScreens([setup.output.output, setup.addedOutput.output]);
    setup.fixture.screensChanged.emit();
    flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
    flushCapacityParking(setup.resumeScheduler, setup.workScheduler);
    expect(setup.controller.managedCount).toBe(0);
    const replacement = createTrackedOutput(setup.output.output.name, 0);
    workAreaHeight = 300;

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
    console.warn = () => undefined;

    try {
      expect(() => {
        flushTopologyRecovery(setup.resumeScheduler, setup.workScheduler);
      }).not.toThrow();
    } finally {
      console.warn = warning;
    }

    expect(setup.controller.managedCount).toBe(0);
    expect(
      layout.snapshot(
        outputId(replacement.output.name),
        desktopId(setup.desktop.id),
      ).columns,
    ).toEqual([]);
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

  it("focuses adjacent desktops on the active output without wrapping", () => {
    const activeOutput = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktops = [
      { id: "desktop-1" },
      { id: "desktop-2" },
      { id: "desktop-3" },
    ] as const;
    const fixture = createWorkspace(
      activeOutput,
      desktops[1],
      [activeOutput, otherOutput],
      desktops,
      [],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(controller.focusPreviousDesktop()).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(activeOutput)?.id).toBe(
      "desktop-1",
    );
    expect(fixture.workspace.currentDesktopForScreen?.(otherOutput)?.id).toBe(
      "desktop-2",
    );
    expect(controller.focusPreviousDesktop()).toBe(false);
    expect(controller.focusNextDesktop()).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(activeOutput)?.id).toBe(
      "desktop-2",
    );
  });

  it("focuses numbered desktops on the active output and clamps to the tail", () => {
    const activeOutput = createOutput("DP-1", 0);
    const otherOutput = createOutput("HDMI-A-1", 1000);
    const desktops = [
      { id: "desktop-1" },
      { id: "desktop-2" },
      { id: "desktop-tail" },
    ] as const;
    const fixture = createWorkspace(
      activeOutput,
      desktops[1],
      [activeOutput, otherOutput],
      desktops,
      [],
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(controller.focusDesktop(1)).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(activeOutput)).toBe(
      desktops[0],
    );
    expect(fixture.workspace.currentDesktopForScreen?.(otherOutput)).toBe(
      desktops[1],
    );
    expect(controller.focusDesktop(1)).toBe(false);
    expect(controller.focusDesktop(9)).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(activeOutput)).toBe(
      desktops[2],
    );
    expect(fixture.workspace.currentDesktopForScreen?.(otherOutput)).toBe(
      desktops[1],
    );
    expect(fixture.desktopSwitchCount).toBe(2);

    for (const invalid of [0, -1, 1.5, Number.NaN]) {
      expect(controller.focusDesktop(invalid)).toBe(false);
    }

    expect(fixture.desktopSwitchCount).toBe(2);
  });

  it("focuses adjacent desktops through the global fallback", () => {
    const output = createOutput("DP-1", 0);
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
    const fixture = createWorkspace(
      output,
      desktops[0],
      [output],
      desktops,
      [],
      false,
    );
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(controller.focusPreviousDesktop()).toBe(false);
    expect(controller.focusNextDesktop()).toBe(true);
    expect(fixture.workspace.currentDesktop?.id).toBe("desktop-2");
    expect(controller.focusNextDesktop()).toBe(false);
  });

  it("maintains one shared trailing desktop through the lifecycle adapter", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tracked = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tracked.window],
    );
    const desktopsChanged = new Signal<[]>();
    let desktops: KWinVirtualDesktop[] = [desktop];
    let createCount = 0;
    let removeCount = 0;
    Object.defineProperties(fixture.workspace, {
      createDesktop: {
        configurable: true,
        value: (position: number) => {
          createCount += 1;
          desktops.splice(position, 0, {
            id: `created-${String(createCount)}`,
          });
          desktopsChanged.emit();
        },
      },
      desktops: {
        configurable: true,
        get: () => desktops,
      },
      desktopsChanged: { configurable: true, value: desktopsChanged },
      removeDesktop: {
        configurable: true,
        value: (removed: KWinVirtualDesktop) => {
          removeCount += 1;
          desktops = desktops.filter((candidate) => candidate !== removed);
          desktopsChanged.emit();
        },
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);

    expect(controller.moveWindowToNextDesktop()).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
      "created-2",
    ]);
    expect(controller.moveWindowToPreviousDesktop()).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);

    fixture.windowRemoved.emit(tracked.window);
    expect(desktops.map((candidate) => candidate.id)).toEqual(["desktop-1"]);
    expect(removeCount).toBe(2);
  });

  it("creates a fresh shared tail after a numbered column transfer", () => {
    const output = createOutput("DP-1", 0);
    const desktop = { id: "desktop-1" };
    const tracked = createTrackedWindow("window-1", output, desktop);
    const fixture = createWorkspace(
      output,
      desktop,
      [output],
      [desktop],
      [tracked.window],
    );
    const desktopsChanged = new Signal<[]>();
    let desktops: KWinVirtualDesktop[] = [desktop];
    let createCount = 0;
    Object.defineProperties(fixture.workspace, {
      createDesktop: {
        configurable: true,
        value: (position: number) => {
          createCount += 1;
          desktops.splice(position, 0, {
            id: `created-${String(createCount)}`,
          });
          desktopsChanged.emit();
        },
      },
      desktops: {
        configurable: true,
        get: () => desktops,
      },
      desktopsChanged: { configurable: true, value: desktopsChanged },
      removeDesktop: {
        configurable: true,
        value: (removed: KWinVirtualDesktop) => {
          desktops = desktops.filter((candidate) => candidate !== removed);
          desktopsChanged.emit();
        },
      },
    });
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    expect(controller.start()).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);
    expect(controller.moveColumnToDesktop(9)).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
      "created-2",
    ]);
    expect(tracked.window.desktops).toEqual([desktops[1]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[1],
    );

    expect(controller.focusDesktop(9)).toBe(true);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[2],
    );
    expect(controller.focusDesktop(2)).toBe(true);
    expect(controller.moveColumnToDesktop(1)).toBe(true);
    expect(desktops.map((candidate) => candidate.id)).toEqual([
      "desktop-1",
      "created-1",
    ]);
    expect(tracked.window.desktops).toEqual([desktop]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(desktop);
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

    expect(controller.moveColumnToPreviousDesktop()).toBe(false);
    expect(controller.moveColumnToNextDesktop()).toBe(true);
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
    expect(controller.moveColumnToNextDesktop()).toBe(false);
    expect(controller.moveColumnToPreviousDesktop()).toBe(true);
    expect(moved.window.desktops).toEqual([desktops[0]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[0],
    );
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      { id: "column:source", windowIds: ["source"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
  });

  it("moves the active stack to a numbered desktop and clamps to the tail", () => {
    const { controller, desktops, destinations, fixture, moved, output } =
      createDesktopTransferFixture({
        destinationCount: 2,
        sourceStack: true,
      });

    expect(controller.moveColumnToDesktop(9)).toBe(true);
    expect(moved.window.desktops).toEqual([desktops[1]]);
    expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
      desktops[1],
    );
    expect(fixture.workspace.activeWindow).toBe(moved.window);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([]);
    expect(testLayoutColumns(controller, output, desktops[1])).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:source", windowIds: ["source", "moved"] },
      { id: "column:destination-2", windowIds: ["destination-2"] },
    ]);
    expect(activeColumnWidth(controller, output, desktops[1])).toEqual({
      kind: "proportion",
      value: 0.5,
    });
    expect(destinations[1]?.window.frameGeometry.x).toBeGreaterThan(
      moved.window.frameGeometry.x,
    );
    expect(controller.moveColumnToDesktop(2)).toBe(false);

    for (const invalid of [0, -1, 1.5, Number.NaN]) {
      expect(controller.moveColumnToDesktop(invalid)).toBe(false);
    }
  });

  it("migrates full-width restore state when a desktop transfer renames the column", () => {
    const transfer = createDesktopTransferFixture({
      targetColumnId: "column:moved",
    });

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(transfer.controller.moveColumnToNextDesktop()).toBe(true);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual([
      { id: "column:moved", windowIds: ["destination"] },
      { id: "column:transfer:moved", windowIds: ["moved"] },
    ]);

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual({ kind: "proportion", value: 0.5 });
  });

  it("moves a whole stack by default and keeps single-window transfer secondary", () => {
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

    expect(controller.moveColumnToNextDesktop()).toBe(true);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      {
        id: "column:trailing",
        windowIds: [String(trailing.window.internalId)],
      },
    ]);
    expect(
      runtimeLayout(controller)
        .snapshot(outputId(output.name), desktopId(desktops[1].id))
        .columns.map((column) => [column.width, column.windowIds]),
    ).toEqual([
      [{ kind: "fixed", value: 280 }, [destination.window.internalId]],
      [
        { kind: "fixed", value: 620 },
        [source.window.internalId, moved.window.internalId],
      ],
    ]);
    expect(source.window.desktops).toEqual([desktops[1]]);
    expect(moved.window.desktops).toEqual([desktops[1]]);
    expect(fixture.workspace.activeWindow).toBe(moved.window);

    expect(controller.moveColumnToPreviousDesktop()).toBe(true);
    expect(testLayoutColumns(controller, output, desktops[0])).toEqual([
      {
        id: "column:trailing",
        windowIds: [String(trailing.window.internalId)],
      },
      {
        id: "column:stack",
        windowIds: [
          String(source.window.internalId),
          String(moved.window.internalId),
        ],
      },
    ]);

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
      {
        id: "column:trailing",
        windowIds: [String(trailing.window.internalId)],
      },
      { id: "column:stack", windowIds: [String(source.window.internalId)] },
      { id: "column:moved", windowIds: [String(moved.window.internalId)] },
    ]);
  });

  it("rolls back every member when a stacked desktop assignment fails", () => {
    const transfer = createDesktopTransferFixture({ sourceStack: true });
    const sourceFrame = { ...transfer.source.window.frameGeometry };
    const movedFrame = { ...transfer.moved.window.frameGeometry };
    const sourceLayout = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[0].id),
    );
    const targetLayout = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[1].id),
    );
    transfer.source.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === transfer.desktops[1].id) {
        transfer.source.setFrameGeometry({
          height: 310,
          width: 410,
          x: 210,
          y: 120,
        });
      }
    });
    transfer.moved.setDesktopWriteBehavior((next, commit) => {
      if (next[0]?.id === transfer.desktops[1].id) {
        commit();
        transfer.moved.setFrameGeometry({
          height: 320,
          width: 420,
          x: 220,
          y: 130,
        });
        throw new Error("stack member desktop rejected");
      }

      commit();
    });

    expect(transfer.controller.moveColumnToNextDesktop()).toBe(false);
    expect(transfer.source.window.desktops).toEqual([transfer.desktops[0]]);
    expect(transfer.moved.window.desktops).toEqual([transfer.desktops[0]]);
    expect(transfer.source.window.frameGeometry).toEqual(sourceFrame);
    expect(transfer.moved.window.frameGeometry).toEqual(movedFrame);
    expect(transfer.source.desktopWriteCount).toBe(2);
    expect(transfer.moved.desktopWriteCount).toBe(2);
    expect(transfer.fixture.desktopSwitchCount).toBe(0);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[0].id),
      ),
    ).toEqual(sourceLayout);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[1].id),
      ),
    ).toEqual(targetLayout);
  });

  it("migrates full-width restore state with a renamed stacked column", () => {
    const transfer = createDesktopTransferFixture({
      sourceStack: true,
      targetColumnId: "column:source",
    });

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(transfer.controller.moveColumnToNextDesktop()).toBe(true);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual([
      { id: "column:source", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["source", "moved"] },
    ]);

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual({ kind: "proportion", value: 0.5 });
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

  it("moves only the active manual floating window and keeps tiled layouts unchanged", () => {
    const transfer = createDesktopTransferFixture();

    expect(transfer.controller.toggleFloating()).toBe(true);
    const floatingFrame = {
      height: 260,
      width: 360,
      x: 120,
      y: 90,
    };
    transfer.moved.setFrameGeometry(floatingFrame);
    const sourceBefore = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[0].id),
    );
    const targetBefore = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[1].id),
    );
    const tiledFrames = [
      { ...transfer.source.window.frameGeometry },
      { ...transfer.destination.window.frameGeometry },
    ];
    const tiledWrites = [
      transfer.source.writeCount,
      transfer.destination.writeCount,
    ];

    expect(transfer.controller.moveColumnToNextDesktop()).toBe(true);
    expect(transfer.moved.window.desktops).toEqual([transfer.desktops[1]]);
    expect(transfer.moved.window.frameGeometry).toEqual(floatingFrame);
    expect(transfer.fixture.workspace.activeWindow).toBe(transfer.moved.window);
    expect(
      transfer.fixture.workspace.currentDesktopForScreen?.(transfer.output),
    ).toBe(transfer.desktops[1]);
    expect(transfer.controller.floatingCount).toBe(1);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[0].id),
      ),
    ).toEqual(sourceBefore);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[1].id),
      ),
    ).toEqual(targetBefore);
    expect([
      transfer.source.window.frameGeometry,
      transfer.destination.window.frameGeometry,
    ]).toEqual(tiledFrames);
    expect([
      transfer.source.writeCount,
      transfer.destination.writeCount,
    ]).toEqual(tiledWrites);
    const desktopWrites = transfer.moved.desktopWriteCount;
    expect(transfer.controller.moveColumnToDesktop(2)).toBe(false);
    expect(transfer.moved.desktopWriteCount).toBe(desktopWrites);
    expect(transfer.moved.window.frameGeometry).toEqual(floatingFrame);

    expect(transfer.controller.toggleFloating()).toBe(true);
    expect(transfer.controller.floatingCount).toBe(0);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.output,
        transfer.desktops[0],
      ),
    ).toEqual([{ id: "column:source", windowIds: ["source"] }]);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.output,
        transfer.desktops[1],
      ),
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["moved"] },
    ]);
  });

  it.each([
    { name: "fixed normal", overrides: { resizeable: false } },
    {
      name: "relation-free dialog",
      overrides: { dialog: true, normalWindow: false },
    },
    {
      name: "constraint-mismatched fixed normal",
      overrides: {
        maxSize: { height: 100, width: 100 },
        minSize: { height: 100, width: 100 },
      },
    },
  ] satisfies readonly {
    readonly name: string;
    readonly overrides: Partial<KWinWindow>;
  }[])(
    "moves a $name floating window to a numbered desktop",
    ({ overrides }) => {
      const output = createOutput("DP-1", 0);
      const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
      const tiled = createTrackedWindow("tiled", output, desktops[0]);
      const destination = createTrackedWindow(
        "destination",
        output,
        desktops[1],
      );
      const automatic = createTrackedWindow("automatic", output, desktops[0], {
        frameGeometry: { height: 240, width: 320, x: 130, y: 100 },
        ...overrides,
      });
      const fixture = createWorkspace(output, desktops[0], [output], desktops, [
        tiled.window,
        destination.window,
        automatic.window,
      ]);
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
        gap: 10,
      });

      controller.start();
      fixture.workspace.activeWindow = automatic.window;
      const sourceBefore = runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[0].id),
      );
      const targetBefore = runtimeLayout(controller).snapshot(
        outputId(output.name),
        desktopId(desktops[1].id),
      );
      const automaticFrame = { ...automatic.window.frameGeometry };
      const automaticWrites = automatic.writeCount;
      const tiledFrames = [
        { ...tiled.window.frameGeometry },
        { ...destination.window.frameGeometry },
      ];
      const tiledWrites = [tiled.writeCount, destination.writeCount];

      expect(controller.moveColumnToDesktop(9)).toBe(true);
      expect(automatic.window.desktops).toEqual([desktops[1]]);
      expect(automatic.window.frameGeometry).toEqual(automaticFrame);
      expect(fixture.workspace.activeWindow).toBe(automatic.window);
      expect(fixture.workspace.currentDesktopForScreen?.(output)).toBe(
        desktops[1],
      );
      expect(controller.automaticFloatingCount).toBe(1);
      expect(automatic.writeCount).toBe(automaticWrites);
      expect(
        runtimeLayout(controller).snapshot(
          outputId(output.name),
          desktopId(desktops[0].id),
        ),
      ).toEqual(sourceBefore);
      expect(
        runtimeLayout(controller).snapshot(
          outputId(output.name),
          desktopId(desktops[1].id),
        ),
      ).toEqual(targetBefore);
      expect([
        tiled.window.frameGeometry,
        destination.window.frameGeometry,
      ]).toEqual(tiledFrames);
      expect([tiled.writeCount, destination.writeCount]).toEqual(tiledWrites);
    },
  );

  it("rolls back an automatic transfer without an unsafe frame write", () => {
    const output = createOutput("DP-1", 0);
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;
    const automatic = createTrackedWindow("automatic", output, desktops[0], {
      frameGeometry: { height: 240, width: 320, x: 130, y: 100 },
      maxSize: { height: 100, width: 100 },
      minSize: { height: 100, width: 100 },
    });
    const fixture = createWorkspace(output, desktops[0], [output], desktops, [
      automatic.window,
    ]);
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });
    const mechanismFrame = {
      height: 180,
      width: 280,
      x: 20,
      y: 30,
    };

    controller.start();
    automatic.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === desktops[1].id) {
        automatic.setFrameGeometry(mechanismFrame);
      }
    });

    expect(controller.moveColumnToNextDesktop()).toBe(false);
    expect(automatic.window.desktops).toEqual([desktops[0]]);
    expect(automatic.window.frameGeometry).toEqual(mechanismFrame);
    expect(automatic.desktopWriteCount).toBe(2);
    expect(automatic.writeCount).toBe(0);
    expect(fixture.desktopSwitchCount).toBe(0);
    expect(fixture.workspace.activeWindow).toBe(automatic.window);
  });

  it("rejects related floating windows before assigning a desktop", () => {
    const output = createOutput("DP-1", 0);
    const desktops = [{ id: "desktop-1" }, { id: "desktop-2" }] as const;

    for (const [id, overrides] of [
      ["modal", { modal: true }],
      ["transient", { transient: true }],
    ] satisfies readonly (readonly [string, Partial<KWinWindow>])[]) {
      const related = createTrackedWindow(id, output, desktops[0], overrides);
      const fixture = createWorkspace(output, desktops[0], [output], desktops, [
        related.window,
      ]);
      const controller = new RuntimeController(fixture.workspace, {
        clientAreaOption: 2,
      });

      controller.start();
      expect(controller.moveColumnToNextDesktop()).toBe(false);
      expect(related.desktopWriteCount).toBe(0);
      expect(fixture.desktopSwitchCount).toBe(0);
    }

    const parent = createTrackedWindow("parent", output, desktops[0]);
    const child = createTrackedWindow("child", output, desktops[0], {
      transient: true,
      transientFor: parent.window,
    });
    const fixture = createWorkspace(output, desktops[0], [output], desktops, [
      parent.window,
      child.window,
    ]);
    const controller = new RuntimeController(fixture.workspace, {
      clientAreaOption: 2,
    });

    controller.start();
    fixture.workspace.activeWindow = parent.window;
    expect(controller.toggleFloating()).toBe(true);
    expect(controller.moveColumnToNextDesktop()).toBe(false);
    expect(parent.desktopWriteCount).toBe(0);
    expect(child.desktopWriteCount).toBe(0);
    expect(fixture.desktopSwitchCount).toBe(0);

    fixture.workspace.activeWindow = child.window;
    expect(controller.moveColumnToDesktop(9)).toBe(false);
    expect(parent.desktopWriteCount).toBe(0);
    expect(child.desktopWriteCount).toBe(0);
    expect(fixture.desktopSwitchCount).toBe(0);
  });

  it("restores a manual floating window when KWin rejects its desktop assignment", () => {
    const transfer = createDesktopTransferFixture();

    expect(transfer.controller.toggleFloating()).toBe(true);
    const floatingFrame = {
      height: 260,
      width: 360,
      x: 120,
      y: 90,
    };
    transfer.moved.setFrameGeometry(floatingFrame);
    const sourceBefore = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[0].id),
    );
    const targetBefore = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.output.name),
      desktopId(transfer.desktops[1].id),
    );
    transfer.moved.setDesktopWriteBehavior((next, commit) => {
      commit();

      if (next[0]?.id === transfer.desktops[1].id) {
        transfer.moved.setFrameGeometry({
          height: 220,
          width: 300,
          x: 10,
          y: 20,
        });
        throw new Error("desktop assignment rejected");
      }
    });

    expect(transfer.controller.moveColumnToNextDesktop()).toBe(false);
    expect(transfer.moved.window.desktops).toEqual([transfer.desktops[0]]);
    expect(transfer.moved.window.frameGeometry).toEqual(floatingFrame);
    expect(transfer.moved.desktopWriteCount).toBe(2);
    expect(transfer.fixture.desktopSwitchCount).toBe(0);
    expect(transfer.fixture.workspace.activeWindow).toBe(transfer.moved.window);
    expect(transfer.controller.floatingCount).toBe(1);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[0].id),
      ),
    ).toEqual(sourceBefore);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.output.name),
        desktopId(transfer.desktops[1].id),
      ),
    ).toEqual(targetBefore);
  });

  it("rejects suspension, topology, capacity, and waiting barriers", () => {
    const suspended = createDesktopTransferFixture();
    setWindowState("fullscreen", suspended.destination, true);
    expect(suspended.controller.moveWindowToNextDesktop()).toBe(false);

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
        controller.moveColumnToOutputLeft(),
      target: { x: -1000, y: 0 },
    },
    {
      direction: "right",
      move: (controller: RuntimeController) =>
        controller.moveColumnToOutputRight(),
      target: { x: 1000, y: 0 },
    },
    {
      direction: "up",
      move: (controller: RuntimeController) =>
        controller.moveColumnToOutputUp(),
      target: { x: 0, y: -800 },
    },
    {
      direction: "down",
      move: (controller: RuntimeController) =>
        controller.moveColumnToOutputDown(),
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

  it("moves every stacked member through a default output transfer", () => {
    const transfer = createOutputTransferFixture({ sourceStack: true });

    expect(transfer.controller.moveColumnToOutputRight()).toBe(true);
    expect(transfer.fixture.outputTransferCount).toBe(2);
    expect(transfer.moved.desktopWriteCount).toBe(0);
    expect(transfer.source.window.output).toBe(transfer.targetOutput);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
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
    ).toEqual([
      { id: "column:destination", windowIds: ["destination"] },
      { id: "column:source", windowIds: ["source", "moved"] },
    ]);
    expect(transfer.fixture.workspace.activeWindow).toBe(transfer.moved.window);
    expect(transfer.controller.moveColumnToOutputRight()).toBe(false);
    expect(transfer.fixture.outputTransferCount).toBe(2);
  });

  it("rolls back every member when a stacked output assignment fails", () => {
    const transfer = createOutputTransferFixture({ sourceStack: true });
    const sourceFrame = { ...transfer.source.window.frameGeometry };
    const movedFrame = { ...transfer.moved.window.frameGeometry };
    const sourceLayout = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.sourceOutput.name),
      desktopId(transfer.sourceDesktop.id),
    );
    const targetLayout = runtimeLayout(transfer.controller).snapshot(
      outputId(transfer.targetOutput.name),
      desktopId(transfer.targetDesktop.id),
    );
    transfer.fixture.setOutputTransferBehavior((window, output, commit) => {
      commit();

      if (
        window === transfer.source.window &&
        output === transfer.targetOutput
      ) {
        transfer.source.setFrameGeometry({
          height: 310,
          width: 410,
          x: 1210,
          y: 120,
        });
      } else if (
        window === transfer.moved.window &&
        output === transfer.targetOutput
      ) {
        transfer.moved.setFrameGeometry({
          height: 320,
          width: 420,
          x: 1220,
          y: 130,
        });
        throw new Error("stack member output rejected");
      }
    });

    expect(transfer.controller.moveColumnToOutputRight()).toBe(false);
    expect(transfer.source.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.source.window.frameGeometry).toEqual(sourceFrame);
    expect(transfer.moved.window.frameGeometry).toEqual(movedFrame);
    expect(transfer.fixture.outputTransferCount).toBe(4);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.sourceOutput.name),
        desktopId(transfer.sourceDesktop.id),
      ),
    ).toEqual(sourceLayout);
    expect(
      runtimeLayout(transfer.controller).snapshot(
        outputId(transfer.targetOutput.name),
        desktopId(transfer.targetDesktop.id),
      ),
    ).toEqual(targetLayout);
  });

  it("migrates full-width restore state with a renamed output stack", () => {
    const transfer = createOutputTransferFixture({
      movedWidth: 0.3,
      sourceStack: true,
      targetColumnId: "column:source",
      targetColumnWidth: 0.3,
    });

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      runtimeLayout(transfer.controller).setActiveColumnWidth(
        windowId(String(transfer.moved.window.internalId)),
        { kind: "proportion", value: 0.3 },
      ),
    ).toEqual({ kind: "proportion", value: 1 });
    transfer.controller.reconcile();
    expect(transfer.controller.moveColumnToOutputRight()).toBe(true);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual([
      { id: "column:source", windowIds: ["destination"] },
      { id: "column:moved", windowIds: ["source", "moved"] },
    ]);

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual({ kind: "proportion", value: 0.3 });
  });

  it("uses the target output's visible desktop without switching either output", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    const desktopAssignments: string[][] = [];
    transfer.moved.setDesktopWriteBehavior((desktops, commit) => {
      desktopAssignments.push(desktops.map((desktop) => desktop.id));
      commit();
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(true);
    expect(transfer.moved.window.output).toBe(transfer.targetOutput);
    expect(transfer.moved.window.desktops).toEqual([transfer.targetDesktop]);
    expect(transfer.moved.desktopWriteCount).toBe(2);
    expect(desktopAssignments).toEqual([
      [transfer.sourceDesktop.id, transfer.targetDesktop.id],
      [transfer.targetDesktop.id],
    ]);
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

  it("migrates full-width restore state when an output transfer renames the column", () => {
    const transfer = createOutputTransferFixture({
      movedWidth: 0.3,
      sourceOnly: true,
      targetColumnId: "column:moved",
      targetColumnWidth: 0.3,
    });

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      runtimeLayout(transfer.controller).setActiveColumnWidth(
        windowId(String(transfer.moved.window.internalId)),
        { kind: "proportion", value: 0.4 },
      ),
    ).toEqual({ kind: "proportion", value: 1 });
    transfer.controller.reconcile();
    expect(transfer.controller.moveColumnToOutputRight()).toBe(true);
    expect(
      testLayoutColumns(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual([
      { id: "column:moved", windowIds: ["destination"] },
      { id: "column:transfer:moved", windowIds: ["moved"] },
    ]);

    expect(transfer.controller.maximizeColumn()).toBe(true);
    expect(
      activeColumnWidth(
        transfer.controller,
        transfer.targetOutput,
        transfer.targetDesktop,
      ),
    ).toEqual({ kind: "proportion", value: 0.3 });
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

  it("preserves external multi-desktop membership during output rollback", () => {
    const transfer = createOutputTransferFixture({ differentDesktop: true });
    const externalDesktop = { id: "desktop-external" };
    transfer.fixture.setOutputTransferBehavior((_window, _output, commit) => {
      commit();
      Object.defineProperty(transfer.moved.window, "desktops", {
        configurable: true,
        value: [transfer.targetDesktop, externalDesktop],
      });
    });

    expect(transfer.controller.moveWindowToOutputRight()).toBe(false);
    expect(transfer.moved.window.output).toBe(transfer.sourceOutput);
    expect(transfer.moved.window.desktops).toEqual([
      transfer.targetDesktop,
      externalDesktop,
    ]);
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
    readonly targetColumnId?: string;
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
      destinations.length === 0
        ? null
        : columnId(options.targetColumnId ?? "column:destination"),
    columns: destinations.map((window, index) => ({
      column: {
        id: columnId(
          index === 0
            ? (options.targetColumnId ?? "column:destination")
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
    readonly sourceStack?: boolean;
    readonly targetColumnId?: string;
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
    activeColumnId: columnId(
      options.sourceStack ? "column:source" : "column:moved",
    ),
    columns: options.sourceStack
      ? [
          {
            column: {
              id: columnId("column:source"),
              width: { kind: "proportion", value: 0.5 },
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
    activeColumnId: columnId(options.targetColumnId ?? "column:destination"),
    columns: destinations.map((window, index) => ({
      column: {
        id: columnId(
          index === 0
            ? (options.targetColumnId ?? "column:destination")
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

function activeColumnWindowHeights(
  controller: RuntimeController,
  output: KWinOutput,
  desktop: KWinVirtualDesktop,
): readonly WindowHeight[] | null {
  const snapshot = runtimeLayout(controller).snapshot(
    outputId(output.name),
    desktopId(desktop.id),
  );
  const active = snapshot.columns.find(
    (column) => column.id === snapshot.activeColumnId,
  );

  return active ? columnWindowHeights(active) : null;
}

interface TestLayoutColumn {
  readonly id: string;
  readonly width: {
    readonly kind: "fixed" | "proportion";
    readonly value: number;
  };
  readonly windowHeights?: readonly WindowHeight[];
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
        ...(column.windowHeights
          ? {
              windowHeights: column.windowHeights.map((height) => ({
                ...height,
              })),
            }
          : {}),
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

interface StackedFullscreenFixture {
  readonly active: TrackedWindow;
  readonly controller: RuntimeController;
  readonly desktop: KWinVirtualDesktop;
  readonly fixture: WorkspaceFixture;
  readonly fullscreen: FullscreenControl;
  readonly layout: LayoutEngine;
  readonly output: KWinOutput;
  readonly scheduler: ManualScheduler;
  readonly windows: readonly TrackedWindow[];
}

interface TiledLayerRevealFixture {
  readonly controller: RuntimeController;
  readonly desktop: KWinVirtualDesktop;
  readonly fixture: WorkspaceFixture;
  readonly floating: TrackedWindow;
  readonly layout: LayoutEngine;
  readonly minimized: readonly TrackedWindow[];
  readonly output: KWinOutput;
  readonly resumeScheduler: ManualScheduler;
  readonly scheduler: ManualScheduler;
  readonly target: TrackedWindow;
  readonly targetSibling: TrackedWindow | null;
  readonly windows: readonly TrackedWindow[];
}

function createTiledLayerRevealFixture(
  direction: "left" | "right",
  targetStack = false,
  options: {
    readonly output?: KWinOutput;
    readonly resumeScheduler?: ManualScheduler;
    readonly scheduler?: ManualScheduler;
  } = {},
): TiledLayerRevealFixture {
  const output = options.output ?? createOutput("DP-1", 0);
  const desktop = { id: "desktop-1" };
  const target = createTrackedWindow("target", output, desktop);
  const targetSibling = targetStack
    ? createTrackedWindow("target-sibling", output, desktop)
    : null;
  const firstMinimized = createTrackedWindow("minimized-1", output, desktop);
  const secondMinimized = createTrackedWindow("minimized-2", output, desktop);
  const thirdMinimized = createTrackedWindow("minimized-3", output, desktop);
  const floating = createTrackedWindow("floating", output, desktop);
  const minimized = [firstMinimized, secondMinimized, thirdMinimized];
  const windows = [
    target,
    ...(targetSibling ? [targetSibling] : []),
    ...minimized,
    floating,
  ];
  const fixture = createWorkspace(
    output,
    desktop,
    [output],
    [desktop],
    windows.map(({ window }) => window),
  );
  const scheduler = options.scheduler ?? new ManualScheduler();
  const resumeScheduler = options.resumeScheduler ?? scheduler;
  const controller = new RuntimeController(fixture.workspace, {
    clientAreaOption: 2,
    gap: 10,
    schedule: scheduler.schedule,
    scheduleResume: resumeScheduler.schedule,
  });

  if (!controller.start() || !controller.toggleFloating()) {
    throw new Error("could not initialize tiled layer reveal fixture");
  }

  const targetColumn: TestLayoutColumn = {
    id: "column:target",
    width: { kind: "fixed", value: 400 },
    ...(targetSibling
      ? {
          windowHeights: [
            { kind: "auto", weight: 2 },
            { kind: "auto", weight: 3 },
          ],
        }
      : {}),
    windowIds: ["target", ...(targetSibling ? ["target-sibling"] : [])],
  };
  const minimizedColumns: readonly TestLayoutColumn[] = minimized.map(
    (_window, index) => ({
      id: `column:minimized-${String(index + 1)}`,
      width: { kind: "fixed", value: 400 },
      windowIds: [`minimized-${String(index + 1)}`],
    }),
  );
  const columns =
    direction === "right"
      ? [...minimizedColumns, targetColumn]
      : [targetColumn, ...minimizedColumns];
  const activeColumnId =
    direction === "right" ? "column:minimized-1" : "column:minimized-3";
  const layout = installTestLayout(
    controller,
    output,
    desktop,
    activeColumnId,
    columns,
  );
  fixture.workspace.activeWindow = floating.window;

  for (const candidate of minimized) {
    setWindowState("minimized", candidate, true);
  }

  flushManualScheduler(scheduler);

  return {
    controller,
    desktop,
    fixture,
    floating,
    layout,
    minimized,
    output,
    resumeScheduler,
    scheduler,
    target,
    targetSibling,
    windows,
  };
}

function createStackedFullscreenFixture(
  activeIndex: number,
  options: FullscreenControlOptions = {},
): StackedFullscreenFixture {
  const output = createOutput("DP-1", 0);
  const desktop = { id: "desktop-1" };
  const windows = Array.from({ length: 4 }, (_value, index) =>
    createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
  );
  const active = windows[activeIndex];

  if (!active || activeIndex > 2) {
    throw new Error("invalid stacked fullscreen active index");
  }

  const fullscreen = controlFullscreen(active, options);
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

  if (!controller.start()) {
    throw new Error("could not start stacked fullscreen fixture");
  }

  const layout = installTestLayout(
    controller,
    output,
    desktop,
    "column:stack",
    [
      {
        id: "column:stack",
        width: { kind: "proportion", value: 0.45 },
        windowHeights: [
          { kind: "auto", weight: 2 },
          { clientHeight: 240, kind: "fixed" },
          { kind: "auto", weight: 4 },
        ],
        windowIds: ["window-1", "window-2", "window-3"],
      },
      {
        id: "column:right",
        width: { kind: "fixed", value: 240 },
        windowIds: ["window-4"],
      },
    ],
  );
  fixture.workspace.activeWindow = active.window;
  flushManualScheduler(scheduler);

  return {
    active,
    controller,
    desktop,
    fixture,
    fullscreen,
    layout,
    output,
    scheduler,
    windows,
  };
}

interface StackedMaximizeFixture {
  readonly active: TrackedWindow;
  readonly controller: RuntimeController;
  readonly desktop: KWinVirtualDesktop;
  readonly fixture: WorkspaceFixture;
  readonly layout: LayoutEngine;
  readonly maximize: MaximizeControl;
  readonly output: KWinOutput;
  readonly scheduler: ManualScheduler;
  readonly windows: readonly TrackedWindow[];
}

function createStackedMaximizeFixture(
  activeIndex: number,
  options: MaximizeControlOptions = {},
): StackedMaximizeFixture {
  const output = createOutput("DP-1", 0);
  const desktop = { id: "desktop-1" };
  const windows = Array.from({ length: 4 }, (_value, index) =>
    createTrackedWindow(`window-${String(index + 1)}`, output, desktop),
  );
  const active = windows[activeIndex];

  if (!active || activeIndex > 2) {
    throw new Error("invalid stacked maximize active index");
  }

  const maximize = controlMaximize(active, options);
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

  if (!controller.start()) {
    throw new Error("could not start stacked maximize fixture");
  }

  const layout = installTestLayout(
    controller,
    output,
    desktop,
    "column:stack",
    [
      {
        id: "column:stack",
        width: { kind: "proportion", value: 0.45 },
        windowHeights: [
          { kind: "auto", weight: 2 },
          { clientHeight: 240, kind: "fixed" },
          { kind: "auto", weight: 4 },
        ],
        windowIds: ["window-1", "window-2", "window-3"],
      },
      {
        id: "column:right",
        width: { kind: "fixed", value: 240 },
        windowIds: ["window-4"],
      },
    ],
  );
  fixture.workspace.activeWindow = active.window;
  flushManualScheduler(scheduler);

  return {
    active,
    controller,
    desktop,
    fixture,
    layout,
    maximize,
    output,
    scheduler,
    windows,
  };
}

function flushManualScheduler(scheduler: ManualScheduler): void {
  let callbacks = 0;

  while (scheduler.pendingCount > 0 && callbacks < 100) {
    scheduler.flush();
    callbacks += 1;
  }

  if (scheduler.pendingCount > 0) {
    throw new Error("manual scheduler did not settle");
  }
}

function stackedExtractionRuntimeState(controller: RuntimeController): unknown {
  const state = controller as unknown as {
    readonly columnFullWidthRestore: ReadonlyMap<
      string,
      ReadonlyMap<
        string,
        { readonly kind: "fixed" | "proportion"; readonly value: number }
      >
    >;
    readonly dirtyContexts: ReadonlySet<string>;
    readonly fullscreenRequestProbes?: ReadonlyMap<WindowId, unknown>;
    readonly lastTiledFocus: ReadonlyMap<string, WindowId>;
    readonly pendingAdmissionContexts: ReadonlySet<string>;
    readonly pendingFullscreenTargets?: ReadonlyMap<WindowId, boolean>;
    readonly pendingWindowSyncs: ReadonlySet<WindowId>;
    readonly requestedSuspensions: ReadonlyMap<WindowId, ReadonlySet<string>>;
    readonly resumeSamples: ReadonlyMap<
      WindowId,
      {
        readonly contextKey: string | null;
        readonly frame: KWinWindow["frameGeometry"];
      }
    >;
    readonly stackedNativeStateOperation: unknown;
    readonly suspendedWindows: ReadonlySet<WindowId>;
    readonly transientResumeProbes: ReadonlyMap<
      WindowId,
      { readonly completedAttempts: number; readonly pending: boolean }
    >;
    readonly unconfirmedFullscreenTargets?: ReadonlyMap<WindowId, boolean>;
    readonly windowTransferOperation: unknown;
  };
  const sorted = <T>(values: Iterable<T>): T[] =>
    [...values].sort((first, second) =>
      String(first).localeCompare(String(second)),
    );

  return {
    columnFullWidthRestore: sorted(state.columnFullWidthRestore.keys()).map(
      (key) => [
        key,
        sorted(state.columnFullWidthRestore.get(key)?.keys() ?? []).map(
          (id) => [id, { ...state.columnFullWidthRestore.get(key)?.get(id) }],
        ),
      ],
    ),
    dirtyContexts: sorted(state.dirtyContexts),
    fullscreenRequestProbes: sorted(
      state.fullscreenRequestProbes?.keys() ?? [],
    ),
    lastTiledFocus: sorted(state.lastTiledFocus.keys()).map((key) => [
      key,
      state.lastTiledFocus.get(key),
    ]),
    pendingAdmissionContexts: sorted(state.pendingAdmissionContexts),
    pendingFullscreenTargets: sorted(
      state.pendingFullscreenTargets?.keys() ?? [],
    ).map((id) => [id, state.pendingFullscreenTargets?.get(id)]),
    pendingWindowSyncs: sorted(state.pendingWindowSyncs),
    requestedSuspensions: sorted(state.requestedSuspensions.keys()).map(
      (id) => [id, sorted(state.requestedSuspensions.get(id) ?? [])],
    ),
    resumeSamples: sorted(state.resumeSamples.keys()).map((id) => {
      const sample = state.resumeSamples.get(id);
      return [
        id,
        sample
          ? { contextKey: sample.contextKey, frame: { ...sample.frame } }
          : null,
      ];
    }),
    stackedNativeStateOperation: state.stackedNativeStateOperation !== null,
    suspendedWindows: sorted(state.suspendedWindows),
    transientResumeProbes: sorted(state.transientResumeProbes.keys()).map(
      (id) => [id, { ...state.transientResumeProbes.get(id) }],
    ),
    unconfirmedFullscreenTargets: sorted(
      state.unconfirmedFullscreenTargets?.keys() ?? [],
    ).map((id) => [id, state.unconfirmedFullscreenTargets?.get(id)]),
    windowTransferOperation: state.windowTransferOperation !== null,
  };
}

function markOnlyRuntimeContextDirty(controller: RuntimeController): void {
  const state = controller as unknown as {
    readonly contexts: ReadonlyMap<string, unknown>;
    readonly dirtyContexts: Set<string>;
  };
  const keys = [...state.contexts.keys()];

  if (keys.length !== 1 || !keys[0]) {
    throw new Error("stacked maximize fixture has an unexpected context set");
  }

  state.dirtyContexts.add(keys[0]);
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
  groupWindowHeights?: readonly WindowHeight[],
): LayoutEngine {
  const layout = new LayoutEngine();

  layout.restoreColumns({
    activeColumnId: columnId("column:active"),
    columns: [
      {
        column: {
          id: columnId("column:group"),
          width: { kind: "fixed", value: 700 },
          ...(groupWindowHeights
            ? {
                windowHeights: groupWindowHeights.map((height) => ({
                  ...height,
                })),
              }
            : {}),
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
