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
  popupWindow: boolean;
  appletPopup: boolean;
  modal: boolean;
  normalWindow: boolean;
  managed: boolean;
  moveable: boolean;
  hasDecoration: boolean;
  keepAbove: boolean;
  move: boolean;
  resize: boolean;
  skipSwitcher: boolean;
  transientFor(): WindowStub | null;
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

interface RetargetCall {
  readonly animationId: number;
  readonly target: unknown;
  readonly duration: number;
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
    popupWindow: false,
    appletPopup: false,
    modal: false,
    normalWindow: true,
    managed: true,
    moveable: true,
    hasDecoration: true,
    keepAbove: false,
    move: false,
    resize: false,
    skipSwitcher: false,
    transientFor: () => null,
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
  const retargetCalls: RetargetCall[] = [];
  const failedRetargets = new Set<number>();
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
      Position: "position",
      Size: "size",
    },
    QEasingCurve: {
      OutCubic: "out-cubic",
    },
    animate(request: AnimationRequest) {
      animationRequests.push(request);
      return request.animations.map(() => nextAnimationId++);
    },
    animationTime(duration: number) {
      animationTimeCalls.push(duration);
      return options.scaledDuration ?? duration;
    },
    cancel(animation: unknown) {
      cancelledAnimations.push(animation);
      return true;
    },
    retarget(animationId: number, target: unknown, duration: number) {
      retargetCalls.push({ animationId, target, duration });
      return !failedRetargets.has(animationId);
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
    failedRetargets,
    retargetCalls,
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
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 310, value2: 220 },
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
        type: "position",
        from: { value1: 170, value2: 130 },
        to: { value1: 230, value2: 190 },
      },
    ]);

    const sizeHarness = createHarness();
    changeGeometry(sizeHarness.window, {
      x: -80,
      y: -20,
      width: 500,
      height: 300,
    });
    expect(sizeHarness.animationRequests[0]?.animations).toMatchObject([
      { type: "size" },
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
      { popupWindow: true },
      { appletPopup: true },
      { modal: true },
      { normalWindow: false },
      { managed: false },
      { moveable: false },
      { hasDecoration: false, keepAbove: true },
      { hasDecoration: false, skipSwitcher: true },
      { transientFor: () => createWindow() },
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

    const skippedHarness = createHarness({
      window: createWindow({ skipSwitcher: true }),
    });
    changeGeometry(skippedHarness.window, {
      x: 50,
      y: 60,
      width: 400,
      height: 250,
    });
    expect(skippedHarness.animationRequests).toHaveLength(1);
    expect(script).not.toMatch(/resourceClass|resourceName|windowClass/u);
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

  it("retargets consecutive geometry changes without restarting active attributes", () => {
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
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 500, value2: 300 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 310, value2: 220 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 330, value2: 240 },
        duration: 180,
      },
    ]);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("restarts only an attribute whose retarget request failed", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    harness.failedRetargets.add(2);
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2],
    );
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[1]?.animations).toMatchObject([
      {
        type: "position",
        from: { value1: 240, value2: 175 },
        to: { value1: 310, value2: 220 },
      },
    ]);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("cancels active state on ineligibility, config reload, and deletion", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });

    harness.window.move = true;
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.cancelledAnimations).toEqual([1, 2]);

    harness.window.move = false;
    changeGeometry(harness.window, {
      x: 100,
      y: 110,
      width: 600,
      height: 350,
    });
    harness.configChanged.emit();
    expect(harness.cancelledAnimations).toEqual([1, 2, 3, 4]);

    changeGeometry(harness.window, {
      x: 120,
      y: 130,
      width: 700,
      height: 400,
    });

    harness.windowDeleted.emit(harness.window);
    expect(harness.cancelledAnimations).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
