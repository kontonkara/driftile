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
  readonly windowHiddenChanged: Signal<[WindowStub]>;
  readonly windowDesktopsChanged: Signal<[WindowStub]>;
  visible: boolean;
  onCurrentDesktop: boolean;
  isOnActivity(activityId: string): boolean;
  deleted: boolean;
  minimized: boolean;
  fullScreen: boolean;
  hiddenByShowDesktop: boolean;
  specialWindow: boolean;
  popupWindow: boolean;
  appletPopup: boolean;
  onScreenDisplay: boolean;
  outline: boolean;
  lockScreen: boolean;
  internalWindow: object | null;
  modal: boolean;
  normalWindow: boolean;
  managed: boolean;
  moveable: boolean;
  hasDecoration: boolean;
  keepAbove: boolean;
  move: boolean;
  resize: boolean;
  skipSwitcher: boolean;
  windowClass?: string;
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
    windowHiddenChanged: createSignal<[WindowStub]>(),
    windowDesktopsChanged: createSignal<[WindowStub]>(),
    visible: true,
    onCurrentDesktop: true,
    isOnActivity: () => true,
    deleted: false,
    minimized: false,
    fullScreen: false,
    hiddenByShowDesktop: false,
    specialWindow: false,
    popupWindow: false,
    appletPopup: false,
    onScreenDisplay: false,
    outline: false,
    lockScreen: false,
    internalWindow: null,
    modal: false,
    normalWindow: true,
    managed: true,
    moveable: true,
    hasDecoration: true,
    keepAbove: false,
    move: false,
    resize: false,
    skipSwitcher: false,
    windowClass: "konsole org.kde.konsole",
    transientFor: () => null,
    ...overrides,
  };
}

function createHarness(
  options: {
    readonly window?: WindowStub;
    readonly configuredDuration?: number;
    readonly scaledDuration?: number;
    readonly animatePosition?: unknown;
    readonly animateSize?: unknown;
    readonly easingCurve?: unknown;
    readonly resizeAnimationThreshold?: unknown;
    readonly windowClassExclusions?: unknown;
  } = {},
) {
  const window = options.window ?? createWindow();
  const windowAdded = createSignal<[WindowStub]>();
  const windowDeleted = createSignal<[WindowStub]>();
  const hasActiveFullScreenEffectChanged = createSignal<[]>();
  const desktopChanged = createSignal<[unknown, unknown, unknown, unknown]>();
  const windowActivated = createSignal<[WindowStub | null]>();
  const currentActivityChanged = createSignal<[string]>();
  const configChanged = createSignal<[]>();
  const animationEnded = createSignal<[WindowStub, number]>();
  const animationRequests: AnimationRequest[] = [];
  const cancelledAnimations: unknown[] = [];
  const retargetCalls: RetargetCall[] = [];
  const failedRetargets = new Set<number>();
  const animationTimeCalls: number[] = [];
  const configuredValues: Record<string, unknown> = {
    AnimatePosition: options.animatePosition ?? true,
    AnimateSize: options.animateSize ?? true,
    Duration: options.configuredDuration ?? 180,
    EasingCurve:
      options.easingCurve === undefined ? "out-cubic" : options.easingCurve,
    ResizeAnimationThreshold:
      options.resizeAnimationThreshold === undefined
        ? 10
        : options.resizeAnimationThreshold,
    WindowClassExclusions:
      options.windowClassExclusions === undefined
        ? ""
        : options.windowClassExclusions,
  };
  let nextAnimationId = 1;
  const effects = {
    activeWindow: null as WindowStub | null,
    currentActivity: "activity-1",
    hasActiveFullScreenEffect: false,
    stackingOrder: [window],
    windowAdded,
    windowDeleted,
    hasActiveFullScreenEffectChanged,
    desktopChanged,
    windowActivated,
    currentActivityChanged,
  };

  runInNewContext(script, {
    Effect: {
      Position: "position",
      Size: "size",
      Translation: "translation",
    },
    QEasingCurve: {
      Linear: "linear",
      OutQuad: "out-quad",
      OutCubic: "out-cubic",
      OutQuart: "out-quart",
      OutQuint: "out-quint",
      OutExpo: "out-expo",
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
      animationEnded,
      configChanged,
      readConfig(name: string, fallback: unknown) {
        return configuredValues[name] === undefined
          ? fallback
          : configuredValues[name];
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
    finishAnimations(window: WindowStub, animationCount = 2) {
      for (let index = 0; index < animationCount; index += 1) {
        animationEnded.emit(window, 0);
      }
    },
    retargetCalls,
    setConfiguredDuration(duration: number) {
      configuredValues.Duration = duration;
    },
    setConfiguredValue(name: string, value: unknown) {
      configuredValues[name] = value;
    },
    setFullScreenEffectActive(active: boolean) {
      effects.hasActiveFullScreenEffect = active;
      effects.hasActiveFullScreenEffectChanged.emit();
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
    expect(config).toContain('<entry name="EasingCurve" type="String">');
    expect(config).toContain('<entry name="AnimatePosition" type="Bool">');
    expect(config).toContain('<entry name="AnimateSize" type="Bool">');
    expect(config).toContain(
      '<entry name="ResizeAnimationThreshold" type="UInt">',
    );
    expect(config).toContain(
      '<entry name="WindowClassExclusions" type="String">',
    );
    expect(configUi).toContain('name="kcfg_Duration"');
    expect(configUi).toContain('name="kcfg_EasingCurve"');
    expect(configUi).toContain('name="kcfg_AnimatePosition"');
    expect(configUi).toContain('name="kcfg_AnimateSize"');
    expect(configUi).toContain('name="kcfg_ResizeAnimationThreshold"');
    expect(configUi).toContain('name="kcfg_WindowClassExclusions"');
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

  it("applies the configured easing curve to synchronized attributes", () => {
    const easingCurves = [
      "linear",
      "out-quad",
      "out-cubic",
      "out-quart",
      "out-quint",
      "out-expo",
    ] as const;

    for (const easingCurve of easingCurves) {
      const harness = createHarness({ easingCurve });
      changeGeometry(harness.window, {
        x: 60,
        y: 70,
        width: 500,
        height: 300,
      });

      expect(
        harness.animationRequests[0]?.animations.map(
          (animation) => animation.curve,
        ),
        easingCurve,
      ).toEqual([easingCurve, easingCurve]);
    }
  });

  it("falls back to out-cubic for malformed or inexact easing names", () => {
    for (const easingCurve of ["OutCubic", "out-cubic ", "unknown", 3, null]) {
      const harness = createHarness({ easingCurve });
      changeGeometry(harness.window, {
        x: 60,
        y: 70,
        width: 500,
        height: 300,
      });

      expect(
        harness.animationRequests[0]?.animations.map(
          (animation) => animation.curve,
        ),
        String(easingCurve),
      ).toEqual(["out-cubic", "out-cubic"]);
    }
  });

  it("suppresses only resize interpolation at or below the threshold", () => {
    const movingHarness = createHarness();
    changeGeometry(movingHarness.window, {
      x: 50,
      y: 70,
      width: 310,
      height: 190,
    });
    expect(movingHarness.animationRequests[0]?.animations).toMatchObject([
      {
        type: "position",
        from: { value1: 175, value2: 125 },
        to: { value1: 205, value2: 165 },
      },
    ]);

    const sizeOnlyHarness = createHarness();
    changeGeometry(sizeOnlyHarness.window, {
      x: 20,
      y: 30,
      width: 310,
      height: 190,
    });
    expect(sizeOnlyHarness.animationRequests).toHaveLength(0);

    const largeResizeHarness = createHarness();
    changeGeometry(largeResizeHarness.window, {
      x: 20,
      y: 30,
      width: 311,
      height: 200,
    });
    expect(largeResizeHarness.animationRequests[0]?.animations).toMatchObject([
      {
        type: "size",
        from: { value1: 300, value2: 200 },
        to: { value1: 311, value2: 200 },
      },
      {
        type: "position",
        from: { value1: 170, value2: 130 },
        to: { value1: 175.5, value2: 130 },
      },
    ]);
  });

  it("supports a zero resize threshold and falls back on malformed values", () => {
    const zeroThresholdHarness = createHarness({
      resizeAnimationThreshold: 0,
    });
    changeGeometry(zeroThresholdHarness.window, {
      x: 20,
      y: 30,
      width: 301,
      height: 200,
    });
    expect(
      zeroThresholdHarness.animationRequests[0]?.animations[0],
    ).toMatchObject({ type: "size" });

    const malformedThresholds: readonly unknown[] = [
      -1,
      65,
      1.5,
      "",
      "10px",
      false,
      null,
      {},
    ];
    for (const resizeAnimationThreshold of malformedThresholds) {
      const harness = createHarness({ resizeAnimationThreshold });
      changeGeometry(harness.window, {
        x: 20,
        y: 30,
        width: 310,
        height: 200,
      });
      expect(
        harness.animationRequests,
        String(resizeAnimationThreshold),
      ).toHaveLength(0);
    }
  });

  it("cancels a stale resize target without interrupting movement", () => {
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
      width: 408,
      height: 255,
    });

    expect(harness.cancelledAnimations).toEqual([1]);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 2,
        target: { value1: 264, value2: 197.5 },
        duration: 100,
      },
    ]);
    expect(harness.animationRequests).toHaveLength(1);
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

  it("retargets decomposed position across negative global coordinates", () => {
    const window = createWindow({
      geometry: { x: -400, y: 30, width: 300, height: 200 },
    });
    const harness = createHarness({ window });

    changeGeometry(window, {
      x: -300,
      y: 50,
      width: 300,
      height: 200,
    });

    expect(harness.animationRequests[0]?.animations).toMatchObject([
      {
        type: "position",
        from: { value1: 0, value2: 130 },
        to: { value1: 0, value2: 150 },
      },
      {
        type: "translation",
        from: { value1: -250, value2: 0 },
        to: { value1: -150, value2: 0 },
      },
    ]);
    changeGeometry(window, {
      x: -250,
      y: 70,
      width: 300,
      height: 200,
    });
    changeGeometry(window, {
      x: 100,
      y: 70,
      width: 300,
      height: 200,
    });
    changeGeometry(window, {
      x: 200,
      y: 70,
      width: 300,
      height: 200,
    });

    changeGeometry(window, {
      x: 300,
      y: 70,
      width: 300,
      height: 200,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 0, value2: 170 },
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: -100, value2: 0 },
        duration: 100,
      },
      {
        animationId: 1,
        target: { value1: 250, value2: 170 },
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 0 },
        duration: 100,
      },
      {
        animationId: 1,
        target: { value1: 350, value2: 170 },
        duration: 100,
      },
      {
        animationId: 1,
        target: { value1: 450, value2: 170 },
        duration: 100,
      },
    ]);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("keeps cross-edge retargeting on one position pair", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 30,
      width: 300,
      height: 200,
    });
    changeGeometry(harness.window, {
      x: -400,
      y: 30,
      width: 300,
      height: 200,
    });
    changeGeometry(harness.window, {
      x: -300,
      y: 30,
      width: 300,
      height: 200,
    });
    changeGeometry(harness.window, {
      x: 100,
      y: 30,
      width: 300,
      height: 200,
    });
    changeGeometry(harness.window, {
      x: 120,
      y: 30,
      width: 300,
      height: 200,
    });

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[0]?.animations).toMatchObject([
      { type: "position" },
    ]);
    expect(harness.animationRequests[1]?.animations).toMatchObject([
      {
        type: "translation",
        from: { value1: 0, value2: 0 },
        to: { value1: -250, value2: 0 },
      },
    ]);
    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2, 1, 2, 1],
    );
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("bounds rapid off-output motion to one retargetable position pair", () => {
    const window = createWindow({
      geometry: { x: -1000, y: 30, width: 300, height: 200 },
    });
    const harness = createHarness({ window });

    for (let index = 1; index <= 35; index += 1) {
      changeGeometry(window, {
        x: -1000 + index,
        y: 30,
        width: 300,
        height: 200,
      });
    }

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]?.animations).toHaveLength(2);
    expect(harness.retargetCalls).toHaveLength(34);
    expect(
      harness.retargetCalls.every(
        ({ animationId, duration }) => animationId === 2 && duration === 100,
      ),
    ).toBe(true);
    expect(harness.cancelledAnimations).toHaveLength(0);

    window.move = true;
    changeGeometry(window, {
      x: -900,
      y: 30,
      width: 300,
      height: 200,
    });
    expect(harness.cancelledAnimations).toEqual([1, 2]);
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

  it("suppresses ineligible and public shell windows", () => {
    const ineligibleStates: ReadonlyArray<Partial<WindowStub>> = [
      { visible: false },
      { deleted: true },
      { minimized: true },
      { fullScreen: true },
      { hiddenByShowDesktop: true },
      { specialWindow: true },
      { popupWindow: true },
      { appletPopup: true },
      { onScreenDisplay: true },
      { outline: true },
      { lockScreen: true },
      { internalWindow: {} },
      { skipSwitcher: true },
      { modal: true },
      { normalWindow: false },
      { managed: false },
      { moveable: false },
      { hasDecoration: false, keepAbove: true },
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
    expect(skippedHarness.animationRequests).toHaveLength(0);
    expect(script).not.toMatch(/window\.(?:resourceClass|resourceName)/u);
  });

  it("replays the earliest baseline once after fullscreen ownership ends", () => {
    const harness = createHarness();
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(() => {
      harness.effects.windowActivated.emit(null);
    }).not.toThrow();
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.setFullScreenEffectActive(true);
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(0);
    expect(harness.retargetCalls).toHaveLength(0);

    harness.setFullScreenEffectActive(false);
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 330, value2: 240 },
        },
      ],
    });

    changeGeometry(harness.window, {
      x: 100,
      y: 110,
      width: 600,
      height: 350,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 600, value2: 350 },
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: 400, value2: 285 },
        duration: 100,
      },
    ]);
  });

  it("hands active motion to fullscreen effect ownership", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.animationRequests).toHaveLength(1);

    harness.setFullScreenEffectActive(true);
    expect(harness.cancelledAnimations).toEqual([1, 2]);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(1);

    harness.setFullScreenEffectActive(false);
    harness.setFullScreenEffectActive(false);
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[1]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 400, value2: 250 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 240, value2: 175 },
          to: { value1: 310, value2: 220 },
        },
      ],
    });
  });

  it("touches only tracked animation windows when effect ownership changes", () => {
    const harness = createHarness();
    const secondWindow = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
    });
    const idleWindow = createWindow({
      geometry: { x: 660, y: 30, width: 300, height: 200 },
    });
    let idleAnimationReads = 0;
    Object.defineProperty(idleWindow, "driftileTransitionAnimation", {
      configurable: true,
      get() {
        idleAnimationReads += 1;
        return undefined;
      },
    });
    harness.effects.windowAdded.emit(secondWindow);
    harness.effects.windowAdded.emit(idleWindow);

    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(secondWindow, {
      x: 460,
      y: 50,
      width: 400,
      height: 250,
    });

    harness.setFullScreenEffectActive(true);
    harness.setFullScreenEffectActive(true);

    expect(harness.cancelledAnimations).toEqual([1, 2, 3, 4]);
    expect(idleAnimationReads).toBe(0);
  });

  it("drops a net-zero deferred transition without replay work", () => {
    const harness = createHarness();
    const originalGeometry = { ...harness.window.geometry };
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(harness.window, originalGeometry);
    harness.setFullScreenEffectActive(false);
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests).toHaveLength(0);
    expect(harness.retargetCalls).toHaveLength(0);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(1);
  });

  it("replays every visible pending window after activation", () => {
    const harness = createHarness();
    const secondWindow = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    const idleWindow = createWindow({
      geometry: { x: 660, y: 30, width: 300, height: 200 },
    });
    let idleDeferredReads = 0;
    Object.defineProperty(idleWindow, "driftileDeferredTransition", {
      configurable: true,
      get() {
        idleDeferredReads += 1;
        return undefined;
      },
    });
    harness.window.visible = false;
    harness.effects.windowAdded.emit(secondWindow);
    harness.effects.windowAdded.emit(idleWindow);
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(secondWindow, {
      x: 460,
      y: 50,
      width: 400,
      height: 250,
    });
    harness.setFullScreenEffectActive(false);
    expect(harness.animationRequests).toHaveLength(0);

    harness.window.visible = true;
    secondWindow.visible = true;
    harness.effects.activeWindow = harness.window;
    harness.effects.windowActivated.emit(harness.window);
    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      harness.window,
      secondWindow,
    ]);

    harness.effects.windowActivated.emit(harness.window);
    harness.effects.desktopChanged.emit(null, null, null, null);
    expect(harness.animationRequests).toHaveLength(2);
    expect(idleDeferredReads).toBe(0);
  });

  it("captures deferred geometry while a transition hides the window", () => {
    const harness = createHarness({
      window: createWindow({
        geometry: { x: -500, y: 30, width: 300, height: 200 },
      }),
    });
    harness.setFullScreenEffectActive(true);
    harness.window.visible = false;

    changeGeometry(harness.window, {
      x: -440,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(harness.window, {
      x: -380,
      y: 80,
      width: 520,
      height: 320,
    });

    expect(harness.animationRequests).toHaveLength(0);

    harness.window.visible = true;
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 520, value2: 320 },
        },
        {
          type: "position",
          from: { value1: 0, value2: 130 },
          to: { value1: 0, value2: 240 },
        },
        {
          type: "translation",
          from: { value1: -350, value2: 0 },
          to: { value1: -120, value2: 0 },
        },
      ],
    });
  });

  it("keeps deferred geometry until a hidden window becomes visible", () => {
    const harness = createHarness();
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    harness.window.visible = false;
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    harness.setFullScreenEffectActive(false);
    harness.window.windowHiddenChanged.emit(harness.window);
    harness.effects.desktopChanged.emit(null, null, null, null);
    harness.effects.currentActivityChanged.emit("other-activity");
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.animationRequests).toHaveLength(0);

    harness.window.visible = true;
    harness.effects.windowActivated.emit(harness.window);
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 600, value2: 350 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 380, value2: 265 },
        },
      ],
    });

    harness.window.windowHiddenChanged.emit(harness.window);
    harness.window.windowDesktopsChanged.emit(harness.window);
    harness.effects.desktopChanged.emit(null, null, null, null);
    expect(harness.animationRequests).toHaveLength(1);
  });

  it("replays active motion when desktop visibility settles late", () => {
    const harness = createHarness({
      window: createWindow({ visible: false }),
    });
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.effects.activeWindow = harness.window;
    harness.effects.windowActivated.emit(harness.window);

    expect(harness.animationRequests).toHaveLength(0);

    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 310, value2: 220 },
        },
      ],
    });

    harness.window.visible = true;
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 600, value2: 350 },
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: 380, value2: 265 },
        duration: 100,
      },
    ]);
  });

  it("preserves late active motion after desktop effect ownership ends", () => {
    const harness = createHarness({
      window: createWindow({ visible: false }),
    });
    harness.setFullScreenEffectActive(true);
    harness.effects.activeWindow = harness.window;
    harness.effects.windowActivated.emit(harness.window);
    harness.setFullScreenEffectActive(false);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(
      harness.animationRequests[0]?.animations.map(({ type }) => type),
    ).toEqual(["size", "position"]);

    harness.window.visible = true;
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2],
    );
  });

  it("replays a rapid focus handoff before desktop visibility settles", () => {
    const harness = createHarness({
      window: createWindow({ visible: false }),
    });
    const nextWindow = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(nextWindow);
    harness.effects.activeWindow = harness.window;
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    changeGeometry(nextWindow, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 520,
      height: 320,
    });
    changeGeometry(nextWindow, {
      x: 480,
      y: 90,
      width: 520,
      height: 320,
    });

    harness.effects.activeWindow = nextWindow;
    harness.effects.windowActivated.emit(nextWindow);
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      harness.window,
      nextWindow,
    ]);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 520, value2: 320 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 340, value2: 250 },
        },
      ],
    });

    changeGeometry(harness.window, {
      x: 100,
      y: 110,
      width: 540,
      height: 340,
    });
    changeGeometry(nextWindow, {
      x: 500,
      y: 110,
      width: 540,
      height: 340,
    });

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2, 3, 4],
    );
    expect(harness.cancelledAnimations).toHaveLength(0);

    nextWindow.onCurrentDesktop = false;
    harness.effects.desktopChanged.emit(null, null, null, null);
    changeGeometry(nextWindow, {
      x: 520,
      y: 130,
      width: 560,
      height: 360,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.retargetCalls).toHaveLength(4);
    expect(harness.cancelledAnimations).toEqual([3, 4]);

    harness.finishAnimations(harness.window);
    changeGeometry(harness.window, {
      x: 120,
      y: 130,
      width: 560,
      height: 360,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.retargetCalls).toHaveLength(4);

    const afterReleaseHarness = createHarness({
      window: createWindow({ visible: false }),
    });
    afterReleaseHarness.effects.activeWindow = afterReleaseHarness.window;
    afterReleaseHarness.setFullScreenEffectActive(true);
    afterReleaseHarness.setFullScreenEffectActive(false);
    changeGeometry(afterReleaseHarness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(afterReleaseHarness.animationRequests).toHaveLength(1);
    afterReleaseHarness.finishAnimations(afterReleaseHarness.window);
    afterReleaseHarness.effects.activeWindow = null;
    changeGeometry(afterReleaseHarness.window, {
      x: 80,
      y: 90,
      width: 520,
      height: 320,
    });
    expect(afterReleaseHarness.animationRequests).toHaveLength(1);
    expect(afterReleaseHarness.retargetCalls).toHaveLength(0);
  });

  it("replays deferred geometry on a later visible geometry opportunity", () => {
    const harness = createHarness();
    harness.setFullScreenEffectActive(true);
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    harness.window.visible = false;
    harness.setFullScreenEffectActive(false);

    harness.window.visible = true;
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 310, value2: 220 },
        },
      ],
    });
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
    expect(disabledHarness.retargetCalls).toHaveLength(0);

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

  it("scales the retarget cap without extending short durations", () => {
    const cases = [
      {
        label: "short custom duration",
        options: { configuredDuration: 60 },
        initialDuration: 60,
        retargetDuration: 60,
      },
      {
        label: "faster system animation scale",
        options: { scaledDuration: 90 },
        initialDuration: 90,
        retargetDuration: 50,
      },
      {
        label: "slower system animation scale",
        options: { scaledDuration: 360 },
        initialDuration: 360,
        retargetDuration: 200,
      },
    ] as const;

    for (const testCase of cases) {
      const harness = createHarness(testCase.options);
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

      expect(harness.animationRequests[0]?.duration, testCase.label).toBe(
        testCase.initialDuration,
      );
      expect(
        harness.retargetCalls.map(({ duration }) => duration),
        testCase.label,
      ).toEqual([testCase.retargetDuration, testCase.retargetDuration]);
    }
  });

  it("configures position and size animation independently", () => {
    const positionDisabled = createHarness({ animatePosition: false });
    changeGeometry(positionDisabled.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(positionDisabled.animationRequests[0]?.animations).toMatchObject([
      {
        type: "size",
        from: { value1: 300, value2: 200 },
        to: { value1: 500, value2: 300 },
      },
    ]);

    const sizeDisabled = createHarness({ animateSize: false });
    changeGeometry(sizeDisabled.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(sizeDisabled.animationRequests[0]?.animations).toMatchObject([
      {
        type: "position",
        from: { value1: 270, value2: 180 },
        to: { value1: 310, value2: 220 },
      },
    ]);

    const sizeOnlyDisabled = createHarness({ animateSize: false });
    changeGeometry(sizeOnlyDisabled.window, {
      x: 20,
      y: 30,
      width: 500,
      height: 300,
    });
    expect(sizeOnlyDisabled.animationRequests).toHaveLength(0);

    const bothDisabled = createHarness({
      animatePosition: false,
      animateSize: false,
    });
    changeGeometry(bothDisabled.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(bothDisabled.animationRequests).toHaveLength(0);

    bothDisabled.setConfiguredValue("AnimatePosition", true);
    bothDisabled.configChanged.emit();
    changeGeometry(bothDisabled.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(bothDisabled.animationRequests[0]?.animations).toMatchObject([
      { type: "position" },
    ]);
  });

  it("matches bounded window class exclusions exactly and reloads them", () => {
    const harness = createHarness({
      windowClassExclusions:
        "  konsole org.kde.konsole  \r\n\nfirefox firefox\n",
    });
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.animationRequests).toHaveLength(0);

    harness.window.windowClass = "Konsole org.kde.konsole";
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(1);

    harness.setConfiguredValue(
      "WindowClassExclusions",
      "firefox firefox\u0000",
    );
    harness.configChanged.emit();
    harness.window.windowClass = "unlisted application";
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.animationRequests).toHaveLength(1);

    harness.setConfiguredValue("WindowClassExclusions", "");
    harness.configChanged.emit();
    changeGeometry(harness.window, {
      x: 100,
      y: 110,
      width: 700,
      height: 400,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(script).toContain("this.windowClassExclusions.has(windowClass)");
  });

  it("rejects malformed or oversized exclusion input as a whole", () => {
    const validEntries = Array.from(
      { length: 128 },
      (_, index) => `org.example.app${String(index)}`,
    );
    const lastValidEntry = validEntries[validEntries.length - 1] ?? "";
    const validHarness = createHarness({
      window: createWindow({ windowClass: lastValidEntry }),
      windowClassExclusions: validEntries.join("\n"),
    });
    changeGeometry(validHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(validHarness.animationRequests).toHaveLength(0);

    const maximumByteEntry = `${"é".repeat(127)}a`;
    const maximumByteHarness = createHarness({
      window: createWindow({ windowClass: maximumByteEntry }),
      windowClassExclusions: maximumByteEntry,
    });
    changeGeometry(maximumByteHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(maximumByteHarness.animationRequests).toHaveLength(0);

    const invalidInputs: readonly unknown[] = [
      [...validEntries, "org.example.overflow"].join("\n"),
      "org.example.app0\norg.example.app0",
      "a".repeat(256),
      "org.kde.konsole\u0000",
      "org.kde.konsole\rorg.mozilla.firefox",
      "\ud800",
      "a".repeat(33025),
      { application: "org.kde.konsole" },
      null,
    ];

    for (const invalidInput of invalidInputs) {
      const harness = createHarness({
        windowClassExclusions: invalidInput,
      });
      changeGeometry(harness.window, {
        x: 40,
        y: 50,
        width: 400,
        height: 250,
      });
      expect(
        harness.animationRequests,
        String(invalidInput).slice(0, 80),
      ).toHaveLength(0);
    }
  });

  it("fails open when window class identity is unavailable", () => {
    const window = createWindow();
    delete window.windowClass;
    const harness = createHarness({
      window,
      windowClassExclusions: "org.kde.konsole",
    });

    changeGeometry(window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.animationRequests).toHaveLength(1);
  });

  it("keeps the shell launcher at its native compact geometry", () => {
    for (const windowClass of [
      "krunner krunner",
      "krunner org.kde.krunner",
      "org.kde.krunner org.kde.krunner",
    ]) {
      const window = createWindow({ windowClass });
      const harness = createHarness({ window });

      changeGeometry(window, {
        x: 640,
        y: 24,
        width: 640,
        height: 84,
      });

      expect(harness.animationRequests, windowClass).toHaveLength(0);
    }

    const ordinaryWindow = createWindow({
      windowClass: "krunner-helper org.example.krunner-helper",
    });
    const ordinaryHarness = createHarness({ window: ordinaryWindow });
    changeGeometry(ordinaryWindow, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(ordinaryHarness.animationRequests).toHaveLength(1);
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
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: 310, value2: 220 },
        duration: 100,
      },
      {
        animationId: 2,
        target: { value1: 330, value2: 240 },
        duration: 100,
      },
    ]);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("retires completed animation state before the next geometry change", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });

    harness.finishAnimations(harness.window);
    harness.setFullScreenEffectActive(true);
    expect(harness.cancelledAnimations).toHaveLength(0);
    harness.setFullScreenEffectActive(false);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.retargetCalls).toHaveLength(0);
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

  it("keeps a position retarget when only the size retarget fails", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    harness.failedRetargets.add(1);
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
        type: "size",
        from: { value1: 400, value2: 250 },
        to: { value1: 500, value2: 300 },
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

    const configHarness = createHarness();
    configHarness.setFullScreenEffectActive(true);
    changeGeometry(configHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    configHarness.configChanged.emit();
    let configDeferredReads = 0;
    Object.defineProperty(configHarness.window, "driftileDeferredTransition", {
      configurable: true,
      get() {
        configDeferredReads += 1;
        return undefined;
      },
    });
    configHarness.setFullScreenEffectActive(false);
    expect(configHarness.animationRequests).toHaveLength(0);
    expect(configDeferredReads).toBe(0);

    const deletedHarness = createHarness();
    deletedHarness.setFullScreenEffectActive(true);
    changeGeometry(deletedHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    deletedHarness.windowDeleted.emit(deletedHarness.window);
    let deletedDeferredReads = 0;
    Object.defineProperty(deletedHarness.window, "driftileDeferredTransition", {
      configurable: true,
      get() {
        deletedDeferredReads += 1;
        return undefined;
      },
    });
    deletedHarness.setFullScreenEffectActive(false);
    expect(deletedHarness.animationRequests).toHaveLength(0);
    expect(deletedDeferredReads).toBe(0);

    const ineligibleHarness = createHarness();
    ineligibleHarness.setFullScreenEffectActive(true);
    changeGeometry(ineligibleHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    ineligibleHarness.window.move = true;
    ineligibleHarness.setFullScreenEffectActive(false);
    expect(ineligibleHarness.animationRequests).toHaveLength(0);

    ineligibleHarness.window.move = false;
    changeGeometry(ineligibleHarness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(ineligibleHarness.animationRequests[0]?.animations).toMatchObject([
      {
        type: "size",
        from: { value1: 400, value2: 250 },
        to: { value1: 500, value2: 300 },
      },
      {
        type: "position",
        from: { value1: 240, value2: 175 },
        to: { value1: 310, value2: 220 },
      },
    ]);
  });
});
