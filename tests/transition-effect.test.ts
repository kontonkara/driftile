import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const effectRoot = new URL(
  "../packaging/kwin-transition-effect/",
  import.meta.url,
);
const metadata = JSON.parse(
  readFileSync(new URL("metadata.json", effectRoot), "utf8"),
) as {
  readonly KPackageStructure?: string;
  readonly KPlugin?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};
const script = readFileSync(
  new URL("contents/code/main.js", effectRoot),
  "utf8",
);
const config = readFileSync(
  new URL("contents/config/main.xml", effectRoot),
  "utf8",
);
const configUi = readFileSync(
  new URL("contents/ui/config.ui", effectRoot),
  "utf8",
);

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Signal<Arguments extends unknown[]> {
  connect(handler: (...arguments_: Arguments) => void): void;
  emit(...arguments_: Arguments): void;
}

interface WindowStub {
  geometry: Rect;
  readonly windowFrameGeometryChanged: Signal<[WindowStub, Rect]>;
  visible: boolean;
  deleted: boolean;
  minimized: boolean;
  fullScreen: boolean;
  hiddenByShowDesktop: boolean;
  specialWindow: boolean;
  normalWindow: boolean;
  managed: boolean;
  move: boolean;
  resize: boolean;
  readonly [key: string]: unknown;
}

interface Animation {
  readonly type: string;
  readonly from: unknown;
  readonly to: unknown;
  readonly curve: string;
}

interface AnimationRequest {
  readonly window: WindowStub;
  readonly duration: number;
  readonly animations: readonly Animation[];
}

function createSignal<Arguments extends unknown[]>(): Signal<Arguments> {
  const handlers: Array<(...arguments_: Arguments) => void> = [];
  return {
    connect(handler) {
      handlers.push(handler);
    },
    emit(...arguments_) {
      for (const handler of handlers) {
        handler(...arguments_);
      }
    },
  };
}

function createWindow(overrides: Partial<WindowStub> = {}): WindowStub {
  return {
    geometry: { x: 20, y: 30, width: 300, height: 200 },
    windowFrameGeometryChanged: createSignal<[WindowStub, Rect]>(),
    visible: true,
    deleted: false,
    minimized: false,
    fullScreen: false,
    hiddenByShowDesktop: false,
    specialWindow: false,
    normalWindow: true,
    managed: true,
    move: false,
    resize: false,
    ...overrides,
  };
}

function createHarness(
  options: {
    readonly window?: WindowStub;
    readonly configuredDuration?: number;
    readonly scaledDuration?: number;
  } = {},
) {
  const window = options.window ?? createWindow();
  const windowAdded = createSignal<[WindowStub]>();
  const windowDeleted = createSignal<[WindowStub]>();
  const configChanged = createSignal<[]>();
  const animationRequests: AnimationRequest[] = [];
  const cancelledAnimations: unknown[] = [];
  const animationTimeCalls: number[] = [];
  let configuredDuration = options.configuredDuration ?? 180;
  let nextAnimationId = 1;
  const effects = {
    hasActiveFullScreenEffect: false,
    stackingOrder: [window],
    windowAdded,
    windowDeleted,
  };

  runInNewContext(script, {
    Effect: {
      Size: "size",
      Translation: "translation",
    },
    QEasingCurve: {
      OutCubic: "out-cubic",
    },
    animate(request: AnimationRequest) {
      animationRequests.push(request);
      const ids = [nextAnimationId, nextAnimationId + 1];
      nextAnimationId += 2;
      return ids;
    },
    animationTime(duration: number) {
      animationTimeCalls.push(duration);
      return options.scaledDuration ?? duration;
    },
    cancel(animation: unknown) {
      cancelledAnimations.push(animation);
      return true;
    },
    effect: {
      configChanged,
      readConfig(name: string, fallback: number) {
        return name === "Duration" ? configuredDuration : fallback;
      },
    },
    effects,
  });

  return {
    animationRequests,
    animationTimeCalls,
    cancelledAnimations,
    configChanged,
    effects,
    setConfiguredDuration(duration: number) {
      configuredDuration = duration;
    },
    window,
    windowDeleted,
  };
}

function changeGeometry(window: WindowStub, geometry: Rect): void {
  const oldGeometry = { ...window.geometry };
  window.geometry = geometry;
  window.windowFrameGeometryChanged.emit(window, oldGeometry);
}

describe("transition effect package", () => {
  it("declares an optional public scripted effect with bounded duration config", () => {
    expect(metadata.KPackageStructure).toBe("KWin/Effect");
    expect(metadata.KPlugin).toMatchObject({
      Category: "Appearance",
      EnabledByDefault: false,
      Id: "io.github.kontonkara.driftile.transitions",
      License: "GPL-3.0-or-later",
      Name: "Driftile Transitions",
    });
    expect(metadata["X-Plasma-API"]).toBe("javascript");
    expect(metadata["X-KDE-ConfigModule"]).toBe("kcm_kwin4_genericscripted");
    expect(config).toContain('<entry name="Duration" type="UInt">');
    expect(config).toContain("<default>180</default>");
    expect(configUi).toContain('name="kcfg_Duration"');
    expect(configUi).toContain("<number>1000</number>");

    expect(script).not.toMatch(
      /org\.kde\.kwin\.private|\bworkspace\b|\bTimer\b|setTimeout/u,
    );
    expect(script.match(/effects\.stackingOrder/gu)).toHaveLength(1);
    expect(script).not.toMatch(/(?:frameGeometry|geometry)\s*=/u);
  });

  it("animates eligible position and size changes from the previous frame", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      duration: 180,
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
          curve: "out-cubic",
        },
        {
          type: "translation",
          from: { value1: -140, value2: -90 },
          to: { value1: 0, value2: 0 },
          curve: "out-cubic",
        },
      ],
    });
  });

  it("uses only the required attributes for position-only and size-only changes", () => {
    const positionHarness = createHarness();
    changeGeometry(positionHarness.window, {
      x: 80,
      y: 90,
      width: 300,
      height: 200,
    });
    expect(positionHarness.animationRequests[0]?.animations).toMatchObject([
      {
        type: "translation",
        from: { value1: -60, value2: -60 },
      },
    ]);

    const sizeHarness = createHarness();
    changeGeometry(sizeHarness.window, {
      x: 20,
      y: 30,
      width: 500,
      height: 300,
    });
    expect(sizeHarness.animationRequests[0]?.animations).toMatchObject([
      { type: "size" },
      {
        type: "translation",
        from: { value1: -100, value2: -50 },
      },
    ]);
  });

  it("suppresses live user move and resize geometry signals", () => {
    for (const operation of ["move", "resize"] as const) {
      const window = createWindow({ [operation]: true });
      const harness = createHarness({ window });
      changeGeometry(window, {
        x: 50,
        y: 60,
        width: 400,
        height: 250,
      });
      expect(harness.animationRequests, operation).toHaveLength(0);
    }
  });

  it("suppresses ineligible windows and active fullscreen effects", () => {
    const ineligibleStates: ReadonlyArray<Partial<WindowStub>> = [
      { visible: false },
      { deleted: true },
      { minimized: true },
      { fullScreen: true },
      { hiddenByShowDesktop: true },
      { specialWindow: true },
      { normalWindow: false },
      { managed: false },
    ];

    for (const state of ineligibleStates) {
      const window = createWindow(state);
      const harness = createHarness({ window });
      changeGeometry(window, { x: 50, y: 60, width: 400, height: 250 });
      expect(harness.animationRequests, JSON.stringify(state)).toHaveLength(0);
    }

    const fullscreenHarness = createHarness();
    fullscreenHarness.effects.hasActiveFullScreenEffect = true;
    changeGeometry(fullscreenHarness.window, {
      x: 50,
      y: 60,
      width: 400,
      height: 250,
    });
    expect(fullscreenHarness.animationRequests).toHaveLength(0);
  });

  it("respects zero global duration and reloads bounded configuration", () => {
    const disabledHarness = createHarness({ scaledDuration: 0 });
    changeGeometry(disabledHarness.window, {
      x: 50,
      y: 60,
      width: 400,
      height: 250,
    });
    expect(disabledHarness.animationTimeCalls).toEqual([180]);
    expect(disabledHarness.animationRequests).toHaveLength(0);

    const configuredHarness = createHarness();
    configuredHarness.setConfiguredDuration(5000);
    configuredHarness.configChanged.emit();
    expect(configuredHarness.animationTimeCalls).toEqual([180, 1000]);
    changeGeometry(configuredHarness.window, {
      x: 50,
      y: 60,
      width: 400,
      height: 250,
    });
    expect(configuredHarness.animationRequests[0]?.duration).toBe(1000);
  });

  it("cancels and replaces per-window animation state", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.cancelledAnimations).toEqual([[1, 2]]);

    harness.window.move = true;
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.cancelledAnimations).toEqual([
      [1, 2],
      [3, 4],
    ]);

    harness.windowDeleted.emit(harness.window);
    expect(harness.cancelledAnimations).toHaveLength(2);
  });
});
