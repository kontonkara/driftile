import { describe, expect, it } from "vitest";
import type {
  KWinOutput,
  KWinRect,
  KWinSignal,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "../../../src/platform/kwin/api";
import {
  hasAutomaticFloatingRole,
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
    activities: [],
    activitiesChanged: new Signal<[]>(),
    clientGeometry: { height: 600, width: 800, x: 0, y: 0 },
    clientGeometryChanged: new Signal<[oldGeometry: KWinRect]>(),
    decorationChanged: new Signal<[]>(),
    decorationPolicyChanged: new Signal<[]>(),
    deleted: false,
    desktopFileName: "org.example.App",
    desktopFileNameChanged: new Signal<[]>(),
    desktops: [desktop],
    desktopsChanged: new Signal<[]>(),
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    frameGeometryChanged: new Signal<[oldGeometry: KWinRect]>(),
    fullScreen: false,
    fullScreenChanged: new Signal<[]>(),
    internalId: "window-1",
    interactiveMoveResizeFinished: new Signal<[]>(),
    interactiveMoveResizeStarted: new Signal<[]>(),
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
    noBorderChanged: new Signal<[]>(),
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
    utility: false,
    windowRoleChanged: new Signal<[]>(),
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

describe("hasAutomaticFloatingRole", () => {
  it.each([
    { dialog: true },
    { modal: true },
    { transient: true },
    { transientFor: {} },
    { utility: true },
    { windowRole: "Toolkit:Picture-In_Picture" },
    { windowRole: "Toolkit:PICTURE IN PICTURE" },
  ])("accepts an exact automatic-floating source", (source) => {
    expect(hasAutomaticFloatingRole(source)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "PictureInPicture",
    Object.assign([], { dialog: true }),
    { caption: "PictureInPicture" },
    { desktopFileName: "PictureInPicture" },
    { dialog: "true" },
    { transientFor: 1 },
    { windowRole: "PictureInPictureExtra" },
  ])("rejects an untrusted non-role source", (source) => {
    expect(hasAutomaticFloatingRole(source)).toBe(false);
  });

  it("fails closed when an external property cannot be read", () => {
    const source = Object.defineProperty({}, "dialog", {
      get: () => {
        throw new Error("unreadable");
      },
    });

    expect(hasAutomaticFloatingRole(source)).toBe(false);
  });
});

describe("normalizeWindow", () => {
  it("normalizes a regular window", () => {
    expect(normalizeWindow(createWindow())).toEqual({
      activityIds: [],
      desktopIds: ["desktop-1"],
      id: "window-1",
      kind: "normal",
      outputId: "DP-1",
    });
  });

  it("normalizes explicit activity memberships", () => {
    expect(
      normalizeWindow(
        createWindow({ activities: ["activity-1", "activity-2"] }),
      )?.activityIds,
    ).toEqual(["activity-1", "activity-2"]);
  });

  it("supports hosts without window activity APIs", () => {
    const source = createWindow();
    Object.defineProperties(source, {
      activities: { configurable: true, value: undefined },
      activitiesChanged: { configurable: true, value: undefined },
    });

    expect(normalizeWindow(source)?.activityIds).toEqual([]);
    expect(() => {
      const observer = new WindowObserver(createWorkspace([source]));
      observer.start();
      observer.stop();
    }).not.toThrow();
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

  it.each([
    {
      label: "utility",
      overrides: { normalWindow: false, utility: true },
    },
    {
      label: "picture-in-picture role",
      overrides: {
        normalWindow: false,
        windowRole: "Toolkit:Picture-In_Picture",
      },
    },
  ])("keeps a non-normal $label observable", ({ overrides }) => {
    expect(normalizeWindow(createWindow(overrides))?.kind).toBe("other");
  });

  it("ignores special windows", () => {
    expect(normalizeWindow(createWindow({ specialWindow: true }))).toBeNull();
  });

  it("ignores windows shown on every desktop", () => {
    expect(
      normalizeWindow(
        createWindow({
          desktops: [],
          normalWindow: false,
          onAllDesktops: true,
          windowRole: "PictureInPicture",
        }),
      ),
    ).toBeNull();
  });
});

describe("WindowObserver", () => {
  it("discovers a late stacking-order window without an added signal", () => {
    const stackingOrder: KWinWindow[] = [];
    const added: string[] = [];
    const observer = new WindowObserver(createWorkspace(stackingOrder), {
      added: (window) => added.push(window.id),
    });
    const lateWindow = createWindow();

    observer.start();
    expect(observer.size).toBe(0);

    stackingOrder.push(lateWindow);
    observer.discoverWindows();
    observer.discoverWindows();

    expect(observer.size).toBe(1);
    expect(observer.source("window-1")).toBe(lateWindow);
    expect(observer.snapshot().map((window) => window.id)).toEqual([
      "window-1",
    ]);
    expect(added).toEqual(["window-1"]);
  });

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
      changed: (windowId, cause) => changed.push(`${windowId}:${cause}`),
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
        activityIds: [],
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
    expect(changed).toEqual(["window-1:context", "window-1:context"]);
  });

  it("publishes activity membership changes as context changes", () => {
    const source = createWindow({ activities: ["activity-1"] });
    const activitiesChanged = source.activitiesChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId, cause) => changed.push(`${windowId}:${cause}`),
    });

    observer.start();
    expect(activitiesChanged.size).toBe(1);

    Object.defineProperty(source, "activities", {
      configurable: true,
      value: ["activity-2", "activity-3"],
    });
    activitiesChanged.emit();
    activitiesChanged.emit();

    expect(observer.snapshot()[0]?.activityIds).toEqual([
      "activity-2",
      "activity-3",
    ]);
    expect(changed).toEqual(["window-1:context"]);

    observer.stop();
    expect(activitiesChanged.size).toBe(0);
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

  it("publishes constraint and ownership classification changes", () => {
    const source = createWindow();
    const maximizeableChanged = source.maximizeableChanged as Signal<
      [maximizeable: boolean]
    >;
    const transientChanged = source.transientChanged as Signal<[]>;
    const modalChanged = source.modalChanged as Signal<[]>;
    const desktopFileNameChanged = source.desktopFileNameChanged as Signal<[]>;
    const windowRoleChanged = source.windowRoleChanged as Signal<[]>;
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId, cause) => changed.push(`${windowId}:${cause}`),
    });

    observer.start();
    Object.defineProperty(source, "resizeable", {
      configurable: true,
      value: false,
    });
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
    Object.defineProperty(source, "desktopFileName", {
      configurable: true,
      value: "org.example.Reclassified",
    });
    desktopFileNameChanged.emit();
    Object.defineProperty(source, "windowRole", {
      configurable: true,
      value: "PictureInPicture",
    });
    windowRoleChanged.emit();

    expect(changed).toEqual([
      "window-1:constraints",
      "window-1:classification",
      "window-1:classification",
      "window-1:classification",
      "window-1:classification",
    ]);
  });

  it("deduplicates hard-constraint refreshes across existing and geometry signals", () => {
    const source = createWindow();
    const maximumSize = source.maxSize;
    let constraintReads = 0;
    Object.defineProperty(source, "maxSize", {
      configurable: true,
      get: () => {
        constraintReads += 1;
        return maximumSize;
      },
    });
    const clientGeometryChanged = source.clientGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const decorationChanged = source.decorationChanged as Signal<[]>;
    const decorationPolicyChanged = source.decorationPolicyChanged as Signal<
      []
    >;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const frameGeometryChanged = source.frameGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const maximizeableChanged = source.maximizeableChanged as Signal<
      [maximizeable: boolean]
    >;
    const moveResizedChanged = source.moveResizedChanged as Signal<[]>;
    const noBorderChanged = source.noBorderChanged as Signal<[]>;
    const changed: string[] = [];
    const policyChanged: string[] = [];
    const stateChanged: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
      decorationPolicyChanged: (windowId) => policyChanged.push(windowId),
      stateChanged: (windowId) => stateChanged.push(windowId),
    });

    observer.start();
    Object.defineProperty(source, "minSize", {
      configurable: true,
      value: { height: 2, width: 3 },
    });
    maximizeableChanged.emit(true);
    frameGeometryChanged.emit({ ...source.frameGeometry });
    clientGeometryChanged.emit({ ...source.clientGeometry });

    expect(changed).toEqual(["window-1"]);

    const movedFrame = { ...source.frameGeometry, x: 120, y: 80 };
    const movedClient = { ...source.clientGeometry, x: 120, y: 80 };
    Object.defineProperties(source, {
      clientGeometry: { configurable: true, value: movedClient },
      frameGeometry: { configurable: true, value: movedFrame },
    });
    const readsBeforeMove = constraintReads;
    frameGeometryChanged.emit({ ...source.frameGeometry });
    clientGeometryChanged.emit({ ...source.clientGeometry });

    expect(changed).toEqual(["window-1"]);
    expect(constraintReads).toBe(readsBeforeMove);

    Object.defineProperty(source, "frameGeometry", {
      configurable: true,
      value: { ...movedFrame, height: 612, width: 820 },
    });
    frameGeometryChanged.emit(movedFrame);
    clientGeometryChanged.emit(movedClient);
    decorationChanged.emit();
    decorationPolicyChanged.emit();
    noBorderChanged.emit();
    moveResizedChanged.emit();
    finished.emit();

    expect(changed).toEqual(["window-1", "window-1"]);
    expect(policyChanged).toEqual(["window-1"]);
    expect(stateChanged).toEqual(Array.from({ length: 5 }, () => "window-1"));

    observer.stop();
    expect(decorationPolicyChanged.size).toBe(0);
    decorationPolicyChanged.emit();
    expect(policyChanged).toEqual(["window-1"]);
  });

  it("probes only observed windows visible on their selected output desktop", () => {
    const primary = { id: "desktop-1" };
    const secondary = { id: "desktop-2" };
    const left = createWindow().output;
    const right: KWinOutput = {
      devicePixelRatio: 1,
      geometry: { height: 1080, width: 1920, x: 1920, y: 0 },
      name: "HDMI-A-1",
    };

    if (!left) {
      throw new Error("missing visible constraint probe output");
    }

    const leftPrimary = createWindow({
      desktops: [primary],
      internalId: "left-primary",
      output: left,
    });
    const leftSecondary = createWindow({
      desktops: [secondary],
      internalId: "left-secondary",
      output: left,
    });
    const rightPrimary = createWindow({
      desktops: [primary],
      internalId: "right-primary",
      output: right,
    });
    const rightSecondary = createWindow({
      desktops: [secondary],
      internalId: "right-secondary",
      output: right,
    });
    const windows = [leftPrimary, leftSecondary, rightPrimary, rightSecondary];
    const workspace = createWorkspace(windows);
    const selected = new Map<string, KWinVirtualDesktop>([
      [left.name, primary],
      [right.name, secondary],
    ]);
    Object.defineProperties(workspace, {
      currentDesktopForScreen: {
        configurable: true,
        value: (output: KWinOutput) => selected.get(output.name) ?? null,
      },
      desktops: { configurable: true, value: [primary, secondary] },
      screens: { configurable: true, value: [left, right] },
    });
    const changed: string[] = [];
    const observer = new WindowObserver(workspace, {
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();

    for (const [index, window] of windows.entries()) {
      Object.defineProperty(window, "minSize", {
        configurable: true,
        value: { height: index + 2, width: index + 3 },
      });
    }

    expect(observer.probeVisibleConstraintChanges()).toBe(2);
    expect(changed).toEqual(["left-primary", "right-secondary"]);
    expect(observer.probeVisibleConstraintChanges()).toBe(0);

    selected.set(left.name, secondary);
    selected.set(right.name, primary);
    expect(observer.probeVisibleConstraintChanges()).toBe(2);
    expect(changed).toEqual([
      "left-primary",
      "right-secondary",
      "left-secondary",
      "right-primary",
    ]);
    expect(observer.probeVisibleConstraintChanges()).toBe(0);
  });

  it("defers silent hard-constraint probes while a visible-desktop window is minimized", () => {
    const source = createWindow({ minimized: true });
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });

    observer.start();
    Object.defineProperty(source, "minSize", {
      configurable: true,
      value: { height: 240, width: 360 },
    });

    expect(observer.probeVisibleConstraintChanges()).toBe(0);
    expect(changed).toEqual([]);

    Object.defineProperty(source, "minimized", {
      configurable: true,
      value: false,
    });
    expect(observer.probeVisibleConstraintChanges()).toBe(1);
    expect(changed).toEqual(["window-1"]);
    expect(observer.probeVisibleConstraintChanges()).toBe(0);
  });

  it("fails closed and settles throwing or malformed constraint getters", () => {
    const source = createWindow();
    Object.defineProperty(source, "maxSize", {
      configurable: true,
      get: () => {
        throw new Error("max size unavailable");
      },
    });
    const changed: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId) => changed.push(windowId),
    });

    expect(() => {
      observer.start();
    }).not.toThrow();
    expect(observer.probeVisibleConstraintChanges()).toBe(0);

    Object.defineProperty(source, "maxSize", {
      configurable: true,
      value: { height: 10_000, width: 10_000 },
    });
    expect(observer.probeVisibleConstraintChanges()).toBe(1);

    Object.defineProperty(source, "resizeable", {
      configurable: true,
      get: () => {
        throw new Error("resizeability unavailable");
      },
    });
    expect(observer.probeVisibleConstraintChanges()).toBe(1);
    expect(observer.probeVisibleConstraintChanges()).toBe(0);

    Object.defineProperties(source, {
      minSize: {
        configurable: true,
        value: { height: 1, width: -1 },
      },
      resizeable: { configurable: true, value: true },
    });
    expect(observer.probeVisibleConstraintChanges()).toBe(0);

    Object.defineProperty(source, "minSize", {
      configurable: true,
      value: { height: 1, width: 1 },
    });
    expect(observer.probeVisibleConstraintChanges()).toBe(1);
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

  it("orders interactive move lifecycle callbacks before state refreshes", () => {
    const source = createWindow({ move: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId, cause) => events.push(`changed:${windowId}:${cause}`),
      interactiveMoveFinished: (windowId) =>
        events.push(`finished:${windowId}`),
      interactiveMoveStarted: (windowId) => events.push(`started:${windowId}`),
      stateChanged: (windowId) => events.push(`state:${windowId}`),
    });

    observer.start();
    Object.defineProperty(source, "minSize", {
      configurable: true,
      value: { height: 2, width: 3 },
    });
    started.emit();
    Object.defineProperty(source, "move", {
      configurable: true,
      value: false,
    });
    finished.emit();

    expect(events).toEqual([
      "started:window-1",
      "changed:window-1:constraints",
      "state:window-1",
      "finished:window-1",
      "state:window-1",
    ]);
  });

  it("keeps interactive move lifecycle intact across context changes", () => {
    const source = createWindow({ move: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const outputChanged = source.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const desktopsChanged = source.desktopsChanged as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      changed: (windowId, cause) => events.push(`changed:${windowId}:${cause}`),
      interactiveMoveFinished: (windowId) =>
        events.push(`finished:${windowId}`),
      interactiveMoveStarted: (windowId) => events.push(`started:${windowId}`),
      stateChanged: (windowId) => events.push(`state:${windowId}`),
    });
    const nextOutput: KWinOutput = {
      devicePixelRatio: 1,
      geometry: { height: 1080, width: 1920, x: 1920, y: 0 },
      name: "HDMI-A-1",
    };

    observer.start();
    started.emit();
    Object.defineProperty(source, "output", {
      configurable: true,
      value: nextOutput,
    });
    outputChanged.emit();
    outputChanged.emit();
    Object.defineProperty(source, "desktops", {
      configurable: true,
      value: [{ id: "desktop-2" }],
    });
    desktopsChanged.emit();
    desktopsChanged.emit();
    Object.defineProperty(source, "move", {
      configurable: true,
      value: false,
    });
    finished.emit();

    expect(events).toEqual([
      "started:window-1",
      "state:window-1",
      "changed:window-1:context",
      "changed:window-1:context",
      "finished:window-1",
      "state:window-1",
    ]);
  });

  it("publishes cloned resize frames before state refreshes", () => {
    const initialFrame = { height: 600, width: 800, x: 20, y: 30 };
    const source = createWindow({ frameGeometry: initialFrame, resize: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const events: string[] = [];
    let acceptedFrame: KWinRect | undefined;
    let startedFrame: KWinRect | undefined;
    const observer = new WindowObserver(createWorkspace([source]), {
      interactiveMoveFinished: (windowId) =>
        events.push(`move-finished:${windowId}`),
      interactiveMoveStarted: (windowId) =>
        events.push(`move-started:${windowId}`),
      interactiveResizeFinished: (windowId, frame) => {
        acceptedFrame = frame;
        events.push(`resize-finished:${windowId}`);
      },
      interactiveResizeStarted: (windowId, frame) => {
        startedFrame = frame;
        events.push(`resize-started:${windowId}`);
      },
      stateChanged: (windowId) => events.push(`state:${windowId}`),
    });
    const finalFrame = { height: 720, width: 960, x: 40, y: 50 };

    observer.start();
    started.emit();
    Object.defineProperties(source, {
      frameGeometry: { configurable: true, value: finalFrame },
      resize: { configurable: true, value: false },
    });
    finished.emit();

    expect(events).toEqual([
      "resize-started:window-1",
      "state:window-1",
      "resize-finished:window-1",
      "state:window-1",
    ]);
    expect(startedFrame).toEqual(initialFrame);
    expect(startedFrame).not.toBe(initialFrame);
    expect(acceptedFrame).toEqual(finalFrame);
    expect(acceptedFrame).not.toBe(finalFrame);
  });

  it("deduplicates notify-before-direct resize lifecycle signals", () => {
    const source = createWindow({ resize: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const moveResizedChanged = source.moveResizedChanged as Signal<[]>;
    const lifecycle: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      interactiveResizeFinished: (windowId, frame) =>
        lifecycle.push(`finished:${windowId}:${String(frame.width)}`),
      interactiveResizeStarted: (windowId, frame) =>
        lifecycle.push(`started:${windowId}:${String(frame.width)}`),
    });

    observer.start();
    moveResizedChanged.emit();
    started.emit();
    Object.defineProperties(source, {
      frameGeometry: {
        configurable: true,
        value: { ...source.frameGeometry, width: 920 },
      },
      resize: { configurable: true, value: false },
    });
    moveResizedChanged.emit();
    finished.emit();

    expect(lifecycle).toEqual([
      "started:window-1:800",
      "finished:window-1:920",
    ]);
  });

  it("falls back to move-resized notifications for resize lifecycle", () => {
    const source = createWindow({ resize: true });
    Object.defineProperties(source, {
      interactiveMoveResizeFinished: {
        configurable: true,
        value: undefined,
      },
      interactiveMoveResizeStarted: {
        configurable: true,
        value: undefined,
      },
    });
    const moveResizedChanged = source.moveResizedChanged as Signal<[]>;
    const lifecycle: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      interactiveResizeFinished: (windowId, frame) =>
        lifecycle.push(`finished:${windowId}:${String(frame.height)}`),
      interactiveResizeStarted: (windowId, frame) =>
        lifecycle.push(`started:${windowId}:${String(frame.height)}`),
    });

    observer.start();
    moveResizedChanged.emit();
    Object.defineProperties(source, {
      frameGeometry: {
        configurable: true,
        value: { ...source.frameGeometry, height: 740 },
      },
      resize: { configurable: true, value: false },
    });
    moveResizedChanged.emit();

    expect(lifecycle).toEqual([
      "started:window-1:600",
      "finished:window-1:740",
    ]);
  });

  it("fails closed for ambiguous interactive sessions", () => {
    const source = createWindow({ move: true, resize: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const moveResizedChanged = source.moveResizedChanged as Signal<[]>;
    const lifecycle: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      interactiveMoveFinished: (windowId) =>
        lifecycle.push(`move-finished:${windowId}`),
      interactiveMoveStarted: (windowId) =>
        lifecycle.push(`move-started:${windowId}`),
      interactiveResizeFinished: (windowId) =>
        lifecycle.push(`resize-finished:${windowId}`),
      interactiveResizeStarted: (windowId) =>
        lifecycle.push(`resize-started:${windowId}`),
    });

    observer.start();
    started.emit();
    moveResizedChanged.emit();
    Object.defineProperties(source, {
      move: { configurable: true, value: false },
      resize: { configurable: true, value: false },
    });
    moveResizedChanged.emit();
    finished.emit();

    expect(lifecycle).toEqual([]);
  });

  it("ignores stray, premature, duplicate, and deleted resize finishes", () => {
    const source = createWindow({ resize: true });
    const started = source.interactiveMoveResizeStarted as Signal<[]>;
    const finished = source.interactiveMoveResizeFinished as Signal<[]>;
    const lifecycle: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      interactiveResizeFinished: (windowId) =>
        lifecycle.push(`finished:${windowId}`),
      interactiveResizeStarted: (windowId) =>
        lifecycle.push(`started:${windowId}`),
    });

    observer.start();
    finished.emit();
    started.emit();
    finished.emit();
    Object.defineProperty(source, "resize", {
      configurable: true,
      value: false,
    });
    finished.emit();
    finished.emit();
    Object.defineProperties(source, {
      deleted: { configurable: true, value: false },
      resize: { configurable: true, value: true },
    });
    started.emit();
    Object.defineProperties(source, {
      deleted: { configurable: true, value: true },
      resize: { configurable: true, value: false },
    });
    finished.emit();

    expect(lifecycle).toEqual([
      "started:window-1",
      "finished:window-1",
      "started:window-1",
    ]);
  });

  it("disconnects captured resize sessions on removal and stop", () => {
    const windowRemoved = new Signal<[window: KWinWindow]>();
    const removedSource = createWindow({ resize: true });
    const stoppedSource = createWindow({
      internalId: "window-2",
      resize: true,
    });
    const removedStarted = removedSource.interactiveMoveResizeStarted as Signal<
      []
    >;
    const removedFinished =
      removedSource.interactiveMoveResizeFinished as Signal<[]>;
    const stoppedStarted = stoppedSource.interactiveMoveResizeStarted as Signal<
      []
    >;
    const stoppedFinished =
      stoppedSource.interactiveMoveResizeFinished as Signal<[]>;
    const lifecycle: string[] = [];
    const observer = new WindowObserver(
      createWorkspace(
        [removedSource, stoppedSource],
        new Signal<[window: KWinWindow]>(),
        windowRemoved,
      ),
      {
        interactiveResizeFinished: (windowId) =>
          lifecycle.push(`finished:${windowId}`),
        interactiveResizeStarted: (windowId) =>
          lifecycle.push(`started:${windowId}`),
      },
    );

    observer.start();
    removedStarted.emit();
    stoppedStarted.emit();
    windowRemoved.emit(removedSource);
    observer.stop();
    Object.defineProperty(removedSource, "resize", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(stoppedSource, "resize", {
      configurable: true,
      value: false,
    });
    removedFinished.emit();
    stoppedFinished.emit();

    expect(lifecycle).toEqual(["started:window-1", "started:window-2"]);
  });

  it("publishes committed fullscreen state before the generic state refresh", () => {
    const source = createWindow();
    const fullScreenChanged = source.fullScreenChanged as Signal<[]>;
    const events: string[] = [];
    const observer = new WindowObserver(createWorkspace([source]), {
      fullScreenChanged: (windowId, fullScreen) =>
        events.push(`fullscreen:${windowId}:${String(fullScreen)}`),
      stateChanged: (windowId) =>
        events.push(`state:${windowId}:${String(source.fullScreen)}`),
    });

    observer.start();
    Object.defineProperty(source, "fullScreen", {
      configurable: true,
      value: true,
    });
    fullScreenChanged.emit();
    Object.defineProperty(source, "fullScreen", {
      configurable: true,
      value: false,
    });
    fullScreenChanged.emit();

    expect(events).toEqual([
      "fullscreen:window-1:true",
      "state:window-1:true",
      "fullscreen:window-1:false",
      "state:window-1:false",
    ]);
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
    const removedClientGeometry = removedSource.clientGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const removedDesktopFileName =
      removedSource.desktopFileNameChanged as Signal<[]>;
    const removedDesktops = removedSource.desktopsChanged as Signal<[]>;
    const removedFrameGeometry = removedSource.frameGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const removedFullScreen = removedSource.fullScreenChanged as Signal<[]>;
    const removedMoveResizeStarted =
      removedSource.interactiveMoveResizeStarted as Signal<[]>;
    const removedMoveResize = removedSource.moveResizedChanged as Signal<[]>;
    const removedOutput = removedSource.outputChanged as Signal<
      [oldOutput?: KWinOutput | null]
    >;
    const stoppedClientGeometry = stoppedSource.clientGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const stoppedDesktopFileName =
      stoppedSource.desktopFileNameChanged as Signal<[]>;
    const stoppedDecoration = stoppedSource.decorationChanged as Signal<[]>;
    const stoppedDesktops = stoppedSource.desktopsChanged as Signal<[]>;
    const stoppedFrameGeometry = stoppedSource.frameGeometryChanged as Signal<
      [oldGeometry: KWinRect]
    >;
    const stoppedMoveResize =
      stoppedSource.interactiveMoveResizeFinished as Signal<[]>;
    const stoppedMoveResizeStarted =
      stoppedSource.interactiveMoveResizeStarted as Signal<[]>;
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
      removedClientGeometry.size,
      removedDesktopFileName.size,
      removedDesktops.size,
      removedFrameGeometry.size,
      removedFullScreen.size,
      removedMoveResizeStarted.size,
      removedMoveResize.size,
      removedOutput.size,
      stoppedClientGeometry.size,
      stoppedDesktopFileName.size,
      stoppedDecoration.size,
      stoppedDesktops.size,
      stoppedFrameGeometry.size,
      stoppedMoveResize.size,
      stoppedMoveResizeStarted.size,
      stoppedOutput.size,
      stoppedTile.size,
      stoppedModal.size,
      stoppedMaximizeable.size,
      stoppedTransient.size,
    ]).toEqual(Array.from({ length: 20 }, () => 1));

    windowRemoved.emit(removedSource);
    expect([
      removedClientGeometry.size,
      removedDesktopFileName.size,
      removedDesktops.size,
      removedFrameGeometry.size,
      removedFullScreen.size,
      removedMoveResizeStarted.size,
      removedMoveResize.size,
      removedOutput.size,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

    observer.stop();
    expect([
      stoppedClientGeometry.size,
      stoppedDesktopFileName.size,
      stoppedDecoration.size,
      stoppedDesktops.size,
      stoppedFrameGeometry.size,
      stoppedMoveResize.size,
      stoppedMoveResizeStarted.size,
      stoppedOutput.size,
      stoppedTile.size,
      stoppedModal.size,
      stoppedMaximizeable.size,
      stoppedTransient.size,
    ]).toEqual(Array.from({ length: 12 }, () => 0));

    removedClientGeometry.emit({ ...removedSource.clientGeometry });
    removedDesktopFileName.emit();
    removedDesktops.emit();
    removedFrameGeometry.emit({ ...removedSource.frameGeometry });
    removedFullScreen.emit();
    removedMoveResizeStarted.emit();
    removedMoveResize.emit();
    removedOutput.emit();
    stoppedClientGeometry.emit({ ...stoppedSource.clientGeometry });
    stoppedDesktopFileName.emit();
    stoppedDecoration.emit();
    stoppedDesktops.emit();
    stoppedFrameGeometry.emit({ ...stoppedSource.frameGeometry });
    stoppedMoveResize.emit();
    stoppedMoveResizeStarted.emit();
    stoppedOutput.emit();
    stoppedTile.emit(null);
    stoppedModal.emit();
    stoppedMaximizeable.emit(true);
    stoppedTransient.emit();
    expect(changed).toEqual([]);
  });
});
