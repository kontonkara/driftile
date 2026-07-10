import { describe, expect, it } from "vitest";
import type {
  KWinOutput,
  KWinRect,
  KWinSignal,
  KWinVirtualDesktop,
  KWinWindow,
  KWinWorkspace,
} from "../../../src/platform/kwin/api";
import { TopologyObserver } from "../../../src/platform/kwin/topology-observer";

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

interface OutputFixture {
  readonly geometryChanged: Signal<[]>;
  readonly scaleChanged: Signal<[]>;
  readonly source: KWinOutput;
  setGeometry(geometry: KWinRect): void;
  setScale(scale: number): void;
}

interface WindowFixture {
  readonly desktopsChanged: Signal<[]>;
  readonly frameGeometryChanged: Signal<[oldGeometry: KWinRect]>;
  readonly hiddenChanged: Signal<[]>;
  readonly minimizedChanged: Signal<[]>;
  readonly outputChanged: Signal<[oldOutput?: KWinOutput | null]>;
  readonly source: KWinWindow;
}

interface WorkspaceFixture {
  readonly screensChanged: Signal<[]>;
  readonly virtualScreenGeometryChanged: Signal<[]>;
  readonly windowAdded: Signal<[window: KWinWindow]>;
  readonly windowRemoved: Signal<[window: KWinWindow]>;
  readonly workspace: KWinWorkspace;
  setScreens(screens: readonly KWinOutput[]): void;
}

const desktop: KWinVirtualDesktop = { id: "desktop-1" };

function createOutput(name: string): OutputFixture {
  const geometryChanged = new Signal<[]>();
  const scaleChanged = new Signal<[]>();
  let geometry: KWinRect = {
    height: 1080,
    width: 1920,
    x: 0,
    y: 0,
  };
  let scale = 1;
  const source: KWinOutput = {
    get devicePixelRatio() {
      return scale;
    },
    get geometry() {
      return geometry;
    },
    geometryChanged,
    name,
    scaleChanged,
  };

  return {
    geometryChanged,
    scaleChanged,
    setGeometry(nextGeometry): void {
      geometry = nextGeometry;
    },
    setScale(nextScale): void {
      scale = nextScale;
    },
    source,
  };
}

function createWindow(
  output: KWinOutput | null,
  overrides: Partial<KWinWindow> = {},
): WindowFixture {
  const desktopsChanged = new Signal<[]>();
  const frameGeometryChanged = new Signal<[oldGeometry: KWinRect]>();
  const hiddenChanged = new Signal<[]>();
  const minimizedChanged = new Signal<[]>();
  const outputChanged = new Signal<[oldOutput?: KWinOutput | null]>();
  const source: KWinWindow = {
    clientGeometry: { height: 600, width: 800, x: 0, y: 0 },
    deleted: false,
    desktops: [desktop],
    desktopsChanged,
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    frameGeometryChanged,
    fullScreen: false,
    internalId: "window-1",
    managed: true,
    maxSize: { height: 10_000, width: 10_000 },
    maximizeMode: 0,
    minSize: { height: 1, width: 1 },
    minimized: false,
    minimizedChanged,
    modal: false,
    move: false,
    moveable: true,
    normalWindow: true,
    onAllDesktops: false,
    output,
    outputChanged,
    resize: false,
    resizeable: true,
    specialWindow: false,
    tile: null,
    transient: false,
    transientFor: null,
    ...overrides,
    hiddenChanged,
  };

  return {
    desktopsChanged,
    frameGeometryChanged,
    hiddenChanged,
    minimizedChanged,
    outputChanged,
    source,
  };
}

function createWorkspace(
  initialScreens: readonly KWinOutput[],
  stackingOrder: readonly KWinWindow[] = [],
): WorkspaceFixture {
  let screens = initialScreens;
  const screensChanged = new Signal<[]>();
  const virtualScreenGeometryChanged = new Signal<[]>();
  const windowAdded = new Signal<[window: KWinWindow]>();
  const windowRemoved = new Signal<[window: KWinWindow]>();
  const workspace: KWinWorkspace = {
    activeScreen: initialScreens[0] ?? null,
    activeWindow: null,
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
    get screens() {
      return screens;
    },
    screensChanged,
    stackingOrder,
    virtualScreenGeometryChanged,
    windowActivated: new Signal<[window: KWinWindow | null]>(),
    windowAdded,
    windowRemoved,
  };

  return {
    screensChanged,
    setScreens(nextScreens): void {
      screens = nextScreens;
    },
    virtualScreenGeometryChanged,
    windowAdded,
    windowRemoved,
    workspace,
  };
}

function createObserver(
  workspace: KWinWorkspace,
  changes: string[],
): TopologyObserver {
  return new TopologyObserver(workspace, {
    changed: (outputName) => changes.push(outputName ?? "all"),
  });
}

describe("TopologyObserver", () => {
  it("keeps an early geometry invalidation targeted through settlement", () => {
    const displayPort = createOutput("DP-1");
    const hdmi = createOutput("HDMI-A-1");
    const fixture = createWorkspace([displayPort.source, hdmi.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    displayPort.geometryChanged.emit();
    fixture.screensChanged.emit();
    fixture.screensChanged.emit();

    expect(changes).toEqual(["DP-1", "DP-1"]);
    expect(changes).not.toContain("HDMI-A-1");
    expect(changes).not.toContain("all");
    expect([...observer.outputInstances()]).toEqual([
      ["DP-1", 1],
      ["HDMI-A-1", 2],
    ]);
  });

  it("publishes only outputs whose settled position or scale changed", () => {
    const displayPort = createOutput("DP-1");
    const hdmi = createOutput("HDMI-A-1");
    const fixture = createWorkspace([displayPort.source, hdmi.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    displayPort.setGeometry({
      height: 1080,
      width: 1920,
      x: -1920,
      y: 0,
    });
    fixture.screensChanged.emit();
    hdmi.setScale(1.5);
    fixture.screensChanged.emit();
    fixture.screensChanged.emit();

    expect(changes).toEqual(["DP-1", "HDMI-A-1"]);
  });

  it("publishes structural replacement and removal globally", () => {
    const original = createOutput("DP-1");
    const replacement = createOutput("DP-1");
    const added = createOutput("HDMI-A-1");
    const fixture = createWorkspace([original.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    const originalInstance = observer.outputInstances().get("DP-1");
    fixture.setScreens([replacement.source, added.source]);
    fixture.screensChanged.emit();

    expect(original.geometryChanged.size).toBe(0);
    expect(original.scaleChanged.size).toBe(0);
    expect(replacement.geometryChanged.size).toBe(1);
    expect(replacement.scaleChanged.size).toBe(1);
    expect(added.geometryChanged.size).toBe(1);
    expect(added.scaleChanged.size).toBe(1);
    expect(observer.outputInstances().get("DP-1")).not.toBe(originalInstance);
    expect(new Set(observer.outputInstances().values()).size).toBe(2);

    original.geometryChanged.emit();
    original.scaleChanged.emit();
    replacement.geometryChanged.emit();
    added.scaleChanged.emit();
    expect(changes).toEqual(["all", "DP-1", "HDMI-A-1"]);

    const addedInstance = observer.outputInstances().get("HDMI-A-1");
    fixture.setScreens([added.source]);
    fixture.screensChanged.emit();

    expect(replacement.geometryChanged.size).toBe(0);
    expect(replacement.scaleChanged.size).toBe(0);
    expect(observer.outputInstances()).toEqual(
      new Map([["HDMI-A-1", addedInstance]]),
    );
    replacement.geometryChanged.emit();
    expect(changes).toEqual(["all", "DP-1", "HDMI-A-1", "all"]);
  });

  it("waits for screens settlement before publishing a structural change", () => {
    const original = createOutput("DP-1");
    const replacement = createOutput("DP-1");
    const added = createOutput("HDMI-A-1");
    const fixture = createWorkspace([original.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.setScreens([replacement.source, added.source]);
    fixture.virtualScreenGeometryChanged.emit();

    expect(changes).toEqual([]);
    expect(original.geometryChanged.size).toBe(1);
    expect(replacement.geometryChanged.size).toBe(0);

    fixture.screensChanged.emit();
    expect(changes).toEqual(["all"]);
    expect(original.geometryChanged.size).toBe(0);
    expect(replacement.geometryChanged.size).toBe(1);
    expect(added.geometryChanged.size).toBe(1);
  });

  it("targets virtual geometry changes without losing pending outputs", () => {
    const displayPort = createOutput("DP-1");
    const hdmi = createOutput("HDMI-A-1");
    const fixture = createWorkspace([displayPort.source, hdmi.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    displayPort.setGeometry({
      height: 1080,
      width: 1920,
      x: -1920,
      y: 0,
    });
    fixture.virtualScreenGeometryChanged.emit();
    displayPort.geometryChanged.emit();
    fixture.virtualScreenGeometryChanged.emit();
    fixture.screensChanged.emit();
    fixture.virtualScreenGeometryChanged.emit();

    expect(changes).toEqual(["DP-1", "DP-1", "DP-1", "DP-1"]);
    expect(changes).not.toContain("HDMI-A-1");
    expect(changes).not.toContain("all");
  });

  it("retains an invalidation raised while publishing settlement", () => {
    const output = createOutput("DP-1");
    const fixture = createWorkspace([output.source]);
    const changes: string[] = [];
    let invalidateDuringSettlement = false;
    const observer = new TopologyObserver(fixture.workspace, {
      changed: (outputName) => {
        changes.push(outputName ?? "all");

        if (invalidateDuringSettlement) {
          invalidateDuringSettlement = false;
          output.geometryChanged.emit();
        }
      },
    });

    observer.start();
    output.geometryChanged.emit();
    invalidateDuringSettlement = true;
    fixture.screensChanged.emit();
    fixture.screensChanged.emit();
    fixture.screensChanged.emit();

    expect(changes).toEqual(["DP-1", "DP-1", "DP-1", "DP-1"]);
  });

  it("tracks dock lifecycle and every work-area signal", () => {
    const output = createOutput("DP-1");
    const nextOutput = createOutput("HDMI-A-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "dock-1",
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source, nextOutput.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.windowAdded.emit(dock.source);

    expect([
      dock.desktopsChanged.size,
      dock.frameGeometryChanged.size,
      dock.hiddenChanged.size,
      dock.minimizedChanged.size,
      dock.outputChanged.size,
    ]).toEqual([1, 1, 1, 1, 1]);

    dock.desktopsChanged.emit();
    dock.frameGeometryChanged.emit(dock.source.frameGeometry);
    dock.hiddenChanged.emit();
    dock.minimizedChanged.emit();
    Object.defineProperty(dock.source, "output", {
      configurable: true,
      value: nextOutput.source,
    });
    dock.outputChanged.emit(output.source);

    expect(changes).toEqual([
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "HDMI-A-1",
    ]);

    dock.outputChanged.emit(nextOutput.source);
    expect(changes[changes.length - 1]).toBe("HDMI-A-1");

    fixture.windowRemoved.emit(dock.source);
    expect([
      dock.desktopsChanged.size,
      dock.frameGeometryChanged.size,
      dock.hiddenChanged.size,
      dock.minimizedChanged.size,
      dock.outputChanged.size,
    ]).toEqual([0, 0, 0, 0, 0]);

    dock.desktopsChanged.emit();
    dock.frameGeometryChanged.emit(dock.source.frameGeometry);
    dock.hiddenChanged.emit();
    dock.minimizedChanged.emit();
    dock.outputChanged.emit();
    expect(changes).toEqual([
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "HDMI-A-1",
      "HDMI-A-1",
      "HDMI-A-1",
    ]);
  });

  it("uses the last known output while a dock output is transiently null", () => {
    const output = createOutput("DP-1");
    const nextOutput = createOutput("HDMI-A-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "dock-1",
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source, nextOutput.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.windowAdded.emit(dock.source);
    Object.defineProperty(dock.source, "output", {
      configurable: true,
      value: null,
    });
    dock.hiddenChanged.emit();
    dock.outputChanged.emit(output.source);

    Object.defineProperty(dock.source, "output", {
      configurable: true,
      value: nextOutput.source,
    });
    dock.outputChanged.emit(null);
    Object.defineProperty(dock.source, "output", {
      configurable: true,
      value: null,
    });
    dock.minimizedChanged.emit();

    expect(changes).toEqual([
      "DP-1",
      "DP-1",
      "DP-1",
      "DP-1",
      "HDMI-A-1",
      "HDMI-A-1",
    ]);
    expect(changes).not.toContain("all");
  });

  it("targets the last known output when a removed dock has no output", () => {
    const output = createOutput("DP-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "dock-1",
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.windowAdded.emit(dock.source);
    Object.defineProperty(dock.source, "output", {
      configurable: true,
      value: null,
    });
    fixture.windowRemoved.emit(dock.source);

    expect(changes).toEqual(["DP-1", "DP-1"]);
    expect(changes).not.toContain("all");
  });

  it("observes existing docks without publishing a synthetic change", () => {
    const output = createOutput("DP-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "dock-1",
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source], [dock.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    expect(changes).toEqual([]);
    expect(dock.frameGeometryChanged.size).toBe(1);

    dock.frameGeometryChanged.emit(dock.source.frameGeometry);
    expect(changes).toEqual(["DP-1"]);
  });

  it("ignores frame changes from normal and deleted dock windows", () => {
    const output = createOutput("DP-1");
    const normal = createWindow(output.source);
    const deletedDock = createWindow(output.source, {
      deleted: true,
      dock: true,
      internalId: "dock-deleted",
      normalWindow: false,
    });
    const fixture = createWorkspace(
      [output.source],
      [normal.source, deletedDock.source],
    );
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.windowAdded.emit(createWindow(output.source).source);
    normal.frameGeometryChanged.emit(normal.source.frameGeometry);
    deletedDock.frameGeometryChanged.emit(deletedDock.source.frameGeometry);

    expect(normal.frameGeometryChanged.size).toBe(0);
    expect(deletedDock.frameGeometryChanged.size).toBe(0);
    expect(changes).toEqual([]);
  });

  it("observes unmanaged Wayland layer-shell docks", () => {
    const output = createOutput("DP-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "layer-shell-dock",
      managed: false,
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    fixture.windowAdded.emit(dock.source);

    expect([
      dock.desktopsChanged.size,
      dock.frameGeometryChanged.size,
      dock.hiddenChanged.size,
      dock.minimizedChanged.size,
      dock.outputChanged.size,
    ]).toEqual([1, 1, 1, 1, 1]);
    expect(changes).toEqual(["DP-1"]);

    dock.frameGeometryChanged.emit(dock.source.frameGeometry);
    expect(changes).toEqual(["DP-1", "DP-1"]);
  });

  it("disconnects workspace, output, and dock handlers on stop", () => {
    const output = createOutput("DP-1");
    const dock = createWindow(output.source, {
      dock: true,
      internalId: "dock-1",
      normalWindow: false,
    });
    const fixture = createWorkspace([output.source], [dock.source]);
    const changes: string[] = [];
    const observer = createObserver(fixture.workspace, changes);

    observer.start();
    observer.start();
    expect([
      fixture.screensChanged.size,
      fixture.virtualScreenGeometryChanged.size,
      fixture.windowAdded.size,
      fixture.windowRemoved.size,
      output.geometryChanged.size,
      output.scaleChanged.size,
      dock.frameGeometryChanged.size,
    ]).toEqual([1, 1, 1, 1, 1, 1, 1]);

    observer.stop();
    observer.stop();
    expect([
      fixture.screensChanged.size,
      fixture.virtualScreenGeometryChanged.size,
      fixture.windowAdded.size,
      fixture.windowRemoved.size,
      output.geometryChanged.size,
      output.scaleChanged.size,
      dock.desktopsChanged.size,
      dock.frameGeometryChanged.size,
      dock.hiddenChanged.size,
      dock.minimizedChanged.size,
      dock.outputChanged.size,
    ]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(observer.outputInstances()).toEqual(new Map());

    fixture.screensChanged.emit();
    fixture.virtualScreenGeometryChanged.emit();
    fixture.windowAdded.emit(
      createWindow(output.source, {
        dock: true,
        internalId: "dock-2",
        normalWindow: false,
      }).source,
    );
    fixture.windowRemoved.emit(dock.source);
    output.geometryChanged.emit();
    output.scaleChanged.emit();
    dock.desktopsChanged.emit();
    dock.frameGeometryChanged.emit(dock.source.frameGeometry);
    dock.hiddenChanged.emit();
    dock.minimizedChanged.emit();
    dock.outputChanged.emit();

    expect(changes).toEqual([]);
  });
});
