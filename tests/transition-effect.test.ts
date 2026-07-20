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
  caption?: string;
  windowRole?: string;
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
    caption: "Konsole",
    windowRole: "",
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
    readonly windowCaptionExclusions?: unknown;
    readonly windowRoleExclusions?: unknown;
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
  const activeAnimations = new Map<number, WindowStub>();
  const endingAnimations = new Map<number, WindowStub>();
  const cancelledAnimations: unknown[] = [];
  const retargetCalls: RetargetCall[] = [];
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
    WindowCaptionExclusions:
      options.windowCaptionExclusions === undefined
        ? ""
        : options.windowCaptionExclusions,
    WindowRoleExclusions:
      options.windowRoleExclusions === undefined
        ? ""
        : options.windowRoleExclusions,
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
      return request.animations.map(() => {
        const animationId = nextAnimationId++;
        activeAnimations.set(animationId, request.window);
        return animationId;
      });
    },
    animationTime(duration: number) {
      animationTimeCalls.push(duration);
      return options.scaledDuration ?? duration;
    },
    cancel(animation: unknown) {
      cancelledAnimations.push(animation);
      if (typeof animation !== "number") {
        return false;
      }
      return (
        activeAnimations.delete(animation) || endingAnimations.has(animation)
      );
    },
    retarget(animationId: number, target: unknown, duration: number) {
      retargetCalls.push({ animationId, target, duration });
      return activeAnimations.has(animationId);
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
    activeAnimationIds() {
      return [...activeAnimations.keys()].sort(
        (first, second) => first - second,
      );
    },
    animationRequests,
    animationTimeCalls,
    beginAnimationEnd(animationId: number) {
      const animationWindow = activeAnimations.get(animationId);
      if (animationWindow === undefined) {
        return false;
      }
      activeAnimations.delete(animationId);
      endingAnimations.set(animationId, animationWindow);
      return true;
    },
    cancelledAnimations,
    configChanged,
    effects,
    finishAnimationEnd(animationId: number) {
      const animationWindow = endingAnimations.get(animationId);
      if (animationWindow === undefined) {
        return false;
      }
      endingAnimations.delete(animationId);
      animationEnded.emit(animationWindow, 0);
      return true;
    },
    finishAnimations(window: WindowStub, animationCount = 2) {
      const animationIds = [...activeAnimations]
        .filter(([, animationWindow]) => animationWindow === window)
        .map(([animationId]) => animationId)
        .slice(0, animationCount);
      for (const animationId of animationIds) {
        activeAnimations.delete(animationId);
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
    expect(config).toContain(
      '<entry name="WindowCaptionExclusions" type="String">',
    );
    expect(config).toContain(
      '<entry name="WindowRoleExclusions" type="String">',
    );
    expect(configUi).toContain('name="kcfg_Duration"');
    expect(configUi).toContain('name="kcfg_EasingCurve"');
    expect(configUi).toContain('name="kcfg_AnimatePosition"');
    expect(configUi).toContain('name="kcfg_AnimateSize"');
    expect(configUi).toContain('name="kcfg_ResizeAnimationThreshold"');
    expect(configUi).toContain('name="kcfg_WindowClassExclusions"');
    expect(configUi).toContain('name="kcfg_WindowCaptionExclusions"');
    expect(configUi).toContain('name="kcfg_WindowRoleExclusions"');
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
    expect(sizeOnlyHarness.retargetCalls).toHaveLength(0);
    expect("driftileTransitionAnimation" in sizeOnlyHarness.window).toBe(false);

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

  it("retires an ending small-size retarget without stale state", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: -30,
      y: -20,
      width: 400,
      height: 300,
    });
    expect(harness.animationRequests[0]?.animations).toMatchObject([
      { type: "size" },
    ]);

    expect(harness.beginAnimationEnd(1)).toBe(true);
    changeGeometry(harness.window, {
      x: -30,
      y: -20,
      width: 405,
      height: 305,
    });

    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 405, value2: 305 },
        duration: 180,
      },
    ]);
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.cancelledAnimations).toHaveLength(0);
    expect("driftileTransitionAnimation" in harness.window).toBe(false);
    expect(harness.finishAnimationEnd(1)).toBe(true);
    expect("driftileTransitionAnimation" in harness.window).toBe(false);

    let staleStateReads = 0;
    Object.defineProperty(harness.window, "driftileTransitionAnimation", {
      configurable: true,
      get() {
        staleStateReads += 1;
        return undefined;
      },
    });
    harness.setFullScreenEffectActive(true);
    expect(staleStateReads).toBe(0);
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

  it("retargets a small resize correction without interrupting movement", () => {
    const window = createWindow({
      geometry: { x: -600, y: 30, width: 300, height: 200 },
    });
    const harness = createHarness({ window });
    changeGeometry(harness.window, {
      x: -420,
      y: 50,
      width: 400,
      height: 250,
    });
    changeGeometry(harness.window, {
      x: -400,
      y: 70,
      width: 408,
      height: 255,
    });
    changeGeometry(harness.window, {
      x: -400,
      y: 70,
      width: 416,
      height: 260,
    });

    expect(harness.retargetCalls).toEqual([
      {
        animationId: 1,
        target: { value1: 408, value2: 255 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 197.5 },
        duration: 180,
      },
      {
        animationId: 3,
        target: { value1: -196, value2: 0 },
        duration: 180,
      },
      {
        animationId: 1,
        target: { value1: 416, value2: 260 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 200 },
        duration: 180,
      },
      {
        animationId: 3,
        target: { value1: -192, value2: 0 },
        duration: 180,
      },
    ]);
    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.cancelledAnimations).toHaveLength(0);
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
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: -100, value2: 0 },
        duration: 180,
      },
      {
        animationId: 1,
        target: { value1: 250, value2: 170 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 0 },
        duration: 180,
      },
      {
        animationId: 1,
        target: { value1: 350, value2: 170 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 0 },
        duration: 180,
      },
      {
        animationId: 1,
        target: { value1: 450, value2: 170 },
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 0, value2: 0 },
        duration: 180,
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
      [1, 1, 2, 1, 2, 1, 2],
    );
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("bounds rapid off-output motion to one retargetable translation", () => {
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
    expect(harness.animationRequests[0]?.animations).toHaveLength(1);
    expect(harness.retargetCalls).toHaveLength(34);
    expect(
      harness.retargetCalls.every(
        ({ animationId, duration }) => animationId === 1 && duration === 180,
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
    expect(harness.cancelledAnimations).toEqual([1]);
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
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 400, value2: 285 },
        duration: 180,
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

    expect(harness.animationRequests).toHaveLength(1);

    harness.setFullScreenEffectActive(false);
    harness.setFullScreenEffectActive(false);
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[1]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 400, value2: 250 },
        },
        {
          type: "position",
          from: { value1: 170, value2: 130 },
          to: { value1: 240, value2: 175 },
        },
      ],
    });

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 3,
        target: { value1: 500, value2: 300 },
        duration: 180,
      },
      {
        animationId: 4,
        target: { value1: 310, value2: 220 },
        duration: 180,
      },
    ]);
    expect(harness.cancelledAnimations).toEqual([1, 2]);
  });

  it("keeps hidden desktop handoff motion after synchronous completion and a focus switch", () => {
    const activeWindow = createWindow({ visible: false });
    const focusTarget = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    const harness = createHarness({ window: activeWindow });
    harness.effects.windowAdded.emit(focusTarget);
    harness.effects.activeWindow = activeWindow;
    harness.setFullScreenEffectActive(true);

    changeGeometry(activeWindow, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    changeGeometry(focusTarget, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      activeWindow,
    ]);
    expect(harness.activeAnimationIds()).toEqual([1, 2]);

    harness.finishAnimations(activeWindow);

    expect(harness.activeAnimationIds()).toEqual([]);
    expect("driftileTransitionAnimation" in activeWindow).toBe(false);

    harness.effects.activeWindow = focusTarget;
    harness.effects.windowActivated.emit(focusTarget);

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      activeWindow,
      focusTarget,
    ]);
    expect(harness.activeAnimationIds()).toEqual([3, 4]);

    changeGeometry(activeWindow, {
      x: 80,
      y: 90,
      width: 520,
      height: 320,
    });
    changeGeometry(focusTarget, {
      x: 480,
      y: 90,
      width: 520,
      height: 320,
    });

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      activeWindow,
      focusTarget,
      activeWindow,
    ]);
    expect(harness.animationRequests[2]).toMatchObject({
      animations: [
        {
          type: "size",
          from: { value1: 500, value2: 300 },
          to: { value1: 520, value2: 320 },
        },
        {
          type: "position",
          from: { value1: 310, value2: 220 },
          to: { value1: 340, value2: 250 },
        },
      ],
      window: activeWindow,
    });
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 3,
        target: { value1: 520, value2: 320 },
        duration: 180,
      },
      {
        animationId: 4,
        target: { value1: 740, value2: 250 },
        duration: 180,
      },
    ]);
    expect(harness.activeAnimationIds()).toEqual([3, 4, 5, 6]);
    expect(harness.cancelledAnimations).toHaveLength(0);

    harness.finishAnimations(activeWindow);
    activeWindow.visible = true;
    activeWindow.windowHiddenChanged.emit(activeWindow);
    activeWindow.visible = false;
    activeWindow.windowHiddenChanged.emit(activeWindow);
    changeGeometry(activeWindow, {
      x: 100,
      y: 110,
      width: 540,
      height: 340,
    });

    expect(harness.animationRequests).toHaveLength(3);
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
        duration: 180,
      },
      {
        animationId: 2,
        target: { value1: 380, value2: 265 },
        duration: 180,
      },
    ]);
  });

  it("keeps outgoing desktop motion deferred until it becomes current", () => {
    const harness = createHarness();
    harness.setFullScreenEffectActive(true);

    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.window.onCurrentDesktop = false;
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests).toHaveLength(0);

    harness.window.onCurrentDesktop = true;
    harness.window.windowDesktopsChanged.emit(harness.window);

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

  it("preserves a new focus target after duplicate workspace activation", () => {
    const harness = createHarness();
    const target = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(target);
    harness.effects.activeWindow = harness.window;
    harness.setFullScreenEffectActive(true);
    harness.setFullScreenEffectActive(false);

    harness.effects.windowActivated.emit(harness.window);
    harness.effects.activeWindow = target;
    harness.effects.windowActivated.emit(target);
    changeGeometry(target, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      window: target,
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 490, value2: 130 },
          to: { value1: 710, value2: 220 },
        },
      ],
    });

    changeGeometry(target, {
      x: 480,
      y: 90,
      width: 520,
      height: 320,
    });
    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2],
    );
  });

  it("preserves a captured focus target when the handoff anchor closes", () => {
    const harness = createHarness();
    const target = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(target);
    harness.effects.activeWindow = harness.window;
    harness.setFullScreenEffectActive(true);
    harness.setFullScreenEffectActive(false);

    harness.effects.activeWindow = target;
    harness.effects.windowActivated.emit(target);
    harness.windowDeleted.emit(harness.window);
    harness.effects.activeWindow = null;
    changeGeometry(target, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.animationRequests[0]).toMatchObject({
      window: target,
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 490, value2: 130 },
          to: { value1: 710, value2: 220 },
        },
      ],
    });

    harness.effects.activeWindow = target;
    target.visible = true;
    target.windowHiddenChanged.emit(target);
  });

  it("captures a hidden focus target after desktop effect ownership ends", () => {
    const harness = createHarness();
    const target = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    const ineligible = createWindow({
      geometry: { x: 660, y: 30, width: 300, height: 200 },
      skipSwitcher: true,
      visible: false,
    });
    harness.effects.windowAdded.emit(target);
    harness.effects.windowAdded.emit(ineligible);
    harness.effects.activeWindow = harness.window;
    harness.setFullScreenEffectActive(true);
    harness.setFullScreenEffectActive(false);
    harness.effects.desktopChanged.emit(null, null, null, null);
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });

    changeGeometry(ineligible, {
      x: 760,
      y: 70,
      width: 500,
      height: 300,
    });
    changeGeometry(target, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      harness.window,
    ]);

    harness.effects.activeWindow = target;
    harness.effects.windowActivated.emit(target);

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[1]).toMatchObject({
      window: target,
      animations: [
        {
          type: "size",
          from: { value1: 300, value2: 200 },
          to: { value1: 500, value2: 300 },
        },
        {
          type: "position",
          from: { value1: 490, value2: 130 },
          to: { value1: 710, value2: 220 },
        },
      ],
    });

    target.visible = true;
    target.windowHiddenChanged.emit(target);

    const unrelated = createWindow({
      geometry: { x: 1000, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(unrelated);
    changeGeometry(unrelated, {
      x: 1120,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.effects.activeWindow = unrelated;
    harness.effects.windowActivated.emit(unrelated);

    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("settles a visible focus target after its geometry changes", () => {
    const harness = createHarness();
    const target = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
    });
    const unrelated = createWindow({
      geometry: { x: 660, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(target);
    harness.effects.windowAdded.emit(unrelated);
    harness.effects.activeWindow = harness.window;
    harness.setFullScreenEffectActive(true);
    harness.setFullScreenEffectActive(false);

    changeGeometry(target, {
      x: 460,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.effects.activeWindow = target;
    harness.effects.windowActivated.emit(target);

    changeGeometry(unrelated, {
      x: 780,
      y: 70,
      width: 500,
      height: 300,
    });
    harness.effects.activeWindow = unrelated;
    harness.effects.windowActivated.emit(unrelated);

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      target,
    ]);
    expect("driftileDeferredTransition" in unrelated).toBe(false);
    expect(harness.cancelledAnimations).toHaveLength(0);
  });

  it("replays a rapid focus handoff before desktop visibility settles", () => {
    const harness = createHarness({
      window: createWindow({ visible: false }),
    });
    const nextWindow = createWindow({
      geometry: { x: 340, y: 30, width: 300, height: 200 },
      visible: false,
    });
    const followingWindow = createWindow({
      geometry: { x: 660, y: 30, width: 300, height: 200 },
      visible: false,
    });
    harness.effects.windowAdded.emit(nextWindow);
    harness.effects.windowAdded.emit(followingWindow);
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
    changeGeometry(followingWindow, {
      x: 800,
      y: 90,
      width: 520,
      height: 320,
    });
    harness.setFullScreenEffectActive(false);

    expect(harness.animationRequests.map(({ window }) => window)).toEqual([
      harness.window,
      nextWindow,
      followingWindow,
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

    expect(harness.animationRequests).toHaveLength(3);
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
    expect(harness.animationRequests).toHaveLength(3);
    expect(harness.retargetCalls).toHaveLength(4);
    expect(harness.cancelledAnimations).toEqual([3, 4]);

    harness.finishAnimations(harness.window);
    changeGeometry(harness.window, {
      x: 120,
      y: 130,
      width: 560,
      height: 360,
    });
    expect(harness.animationRequests).toHaveLength(3);
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
    expect(afterReleaseHarness.animationRequests).toHaveLength(2);
    expect(afterReleaseHarness.animationRequests[1]?.window).toBe(
      afterReleaseHarness.window,
    );
    expect(afterReleaseHarness.retargetCalls).toHaveLength(0);

    afterReleaseHarness.finishAnimations(afterReleaseHarness.window);
    changeGeometry(afterReleaseHarness.window, {
      x: 100,
      y: 110,
      width: 540,
      height: 340,
    });
    expect(afterReleaseHarness.animationRequests).toHaveLength(2);
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

  it("keeps retarget duration aligned with the scaled base animation", () => {
    const cases = [
      {
        label: "short custom duration",
        options: { configuredDuration: 60 },
        initialDuration: 60,
      },
      {
        label: "faster system animation scale",
        options: { scaledDuration: 90 },
        initialDuration: 90,
      },
      {
        label: "slower system animation scale",
        options: { scaledDuration: 360 },
        initialDuration: 360,
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
      ).toEqual([testCase.initialDuration, testCase.initialDuration]);
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
    let observedWindowClass = "konsole org.kde.konsole";
    let windowClassReads = 0;
    const window = createWindow();
    Object.defineProperty(window, "windowClass", {
      configurable: true,
      get() {
        windowClassReads += 1;
        return observedWindowClass;
      },
    });
    const harness = createHarness({
      window,
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
    expect(windowClassReads).toBe(1);

    observedWindowClass = "Konsole org.kde.konsole";
    changeGeometry(harness.window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(windowClassReads).toBe(2);

    harness.setConfiguredValue(
      "WindowClassExclusions",
      "firefox firefox\u0000",
    );
    harness.configChanged.emit();
    observedWindowClass = "unlisted application";
    changeGeometry(harness.window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(windowClassReads).toBe(3);

    harness.setConfiguredValue("WindowClassExclusions", "");
    harness.configChanged.emit();
    changeGeometry(harness.window, {
      x: 100,
      y: 110,
      width: 700,
      height: 400,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(windowClassReads).toBe(4);
    expect(script).toContain("this.windowClassExclusions.has(windowClass)");
    expect(script).toContain("this.windowClassifications.get(window)");
    expect(script).toContain(
      "cachedClassification.windowClass === windowClass",
    );
    expect(script).toContain("this.windowClassifications.delete(window)");
  });

  it("matches changing captions and window roles without stale classifications", () => {
    let observedCaption = "Search";
    let observedWindowRole = "regular";
    let captionReads = 0;
    let windowRoleReads = 0;
    const window = createWindow();
    Object.defineProperties(window, {
      caption: {
        configurable: true,
        get() {
          captionReads += 1;
          return observedCaption;
        },
      },
      windowRole: {
        configurable: true,
        get() {
          windowRoleReads += 1;
          return observedWindowRole;
        },
      },
    });
    const harness = createHarness({
      window,
      windowCaptionExclusions: "  Search  ",
      windowRoleExclusions: "popup",
    });

    changeGeometry(window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.animationRequests).toHaveLength(0);

    observedCaption = "search";
    observedWindowRole = "popup";
    changeGeometry(window, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(harness.animationRequests).toHaveLength(0);

    observedWindowRole = "Popup";
    changeGeometry(window, {
      x: 80,
      y: 90,
      width: 600,
      height: 350,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(captionReads).toBe(3);
    expect(windowRoleReads).toBe(3);

    harness.setConfiguredValue("WindowCaptionExclusions", "Renamed search");
    harness.setConfiguredValue("WindowRoleExclusions", "");
    harness.configChanged.emit();
    observedCaption = "Renamed search";
    observedWindowRole = "popup";
    changeGeometry(window, {
      x: 100,
      y: 110,
      width: 700,
      height: 400,
    });
    expect(harness.animationRequests).toHaveLength(1);
    expect(captionReads).toBe(4);
    expect(windowRoleReads).toBe(3);

    harness.setConfiguredValue("WindowCaptionExclusions", "");
    harness.configChanged.emit();
    changeGeometry(window, {
      x: 120,
      y: 130,
      width: 800,
      height: 450,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(captionReads).toBe(4);
    expect(windowRoleReads).toBe(3);
    expect(script).toContain("cachedClassification.caption === caption");
    expect(script).toContain("cachedClassification.windowRole === windowRole");
  });

  it("fails closed when caption or window role exclusion config is malformed", () => {
    const malformedConfigurations: ReadonlyArray<readonly [string, unknown]> = [
      [
        "WindowCaptionExclusions",
        Array.from(
          { length: 129 },
          (_, index) => `window ${String(index)}`,
        ).join("\n"),
      ],
      ["WindowCaptionExclusions", "duplicate\nduplicate"],
      ["WindowRoleExclusions", "a".repeat(256)],
      ["WindowRoleExclusions", { role: "popup" }],
    ];

    for (const [name, malformedValue] of malformedConfigurations) {
      const harness = createHarness();
      harness.setConfiguredValue(name, malformedValue);
      harness.configChanged.emit();
      changeGeometry(harness.window, {
        x: 40,
        y: 50,
        width: 400,
        height: 250,
      });
      expect(harness.animationRequests, name).toHaveLength(0);

      harness.setConfiguredValue(name, "");
      harness.configChanged.emit();
      changeGeometry(harness.window, {
        x: 60,
        y: 70,
        width: 500,
        height: 300,
      });
      expect(harness.animationRequests, name).toHaveLength(1);
    }
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

    const malformedWindow = createWindow({
      windowClass: 42 as unknown as string,
    });
    const malformedHarness = createHarness({
      window: malformedWindow,
      windowClassExclusions: "org.kde.konsole",
    });
    changeGeometry(malformedWindow, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(malformedHarness.animationRequests).toHaveLength(1);
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

    let observedWindowClass = "krunner org.kde.krunner";
    let windowClassReads = 0;
    const cachedWindow = createWindow();
    Object.defineProperty(cachedWindow, "windowClass", {
      configurable: true,
      get() {
        windowClassReads += 1;
        return observedWindowClass;
      },
    });
    const cachedHarness = createHarness({
      window: cachedWindow,
      windowClassExclusions: "org.example.blocked",
    });
    changeGeometry(cachedWindow, {
      x: 640,
      y: 24,
      width: 640,
      height: 84,
    });
    changeGeometry(cachedWindow, {
      x: 620,
      y: 24,
      width: 660,
      height: 84,
    });
    expect(cachedHarness.animationRequests).toHaveLength(0);
    expect(windowClassReads).toBe(2);

    observedWindowClass = "krunner-helper org.example.krunner-helper";
    changeGeometry(cachedWindow, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(cachedHarness.animationRequests).toHaveLength(1);
    expect(windowClassReads).toBe(3);

    changeGeometry(cachedWindow, {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    });
    expect(cachedHarness.animationRequests).toHaveLength(1);
    expect(windowClassReads).toBe(4);
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

  it("coalesces delayed reports at the current target", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });

    const staleGeometry = { x: -800, y: 30, width: 300, height: 200 };
    harness.window.windowFrameGeometryChanged.emit(
      harness.window,
      staleGeometry,
    );
    harness.window.windowFrameGeometryChanged.emit(
      harness.window,
      staleGeometry,
    );

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.retargetCalls).toHaveLength(0);
    expect(harness.activeAnimationIds()).toEqual([1, 2]);

    harness.finishAnimations(harness.window);
    harness.window.windowFrameGeometryChanged.emit(
      harness.window,
      staleGeometry,
    );

    expect(harness.animationRequests).toHaveLength(1);
    expect(harness.activeAnimationIds()).toHaveLength(0);
    expect("driftileTransitionAnimation" in harness.window).toBe(false);
  });

  it("keeps rapid alternating cross-edge retargets on one synchronized pair", () => {
    const window = createWindow({
      geometry: { x: 100, y: 30, width: 300, height: 200 },
    });
    const harness = createHarness({ window });
    const targets = Array.from({ length: 65 }, (_, index) =>
      index % 2 === 0 ? -500 - index * 2 : 220 + index * 2,
    );

    for (const x of targets) {
      changeGeometry(window, { x, y: 30, width: 300, height: 200 });
      const retargetCount = harness.retargetCalls.length;
      window.windowFrameGeometryChanged.emit(window, {
        x: x > 0 ? -900 : 900,
        y: 30,
        width: 300,
        height: 200,
      });
      expect(harness.retargetCalls).toHaveLength(retargetCount);
    }

    expect(harness.animationRequests).toHaveLength(1);
    expect(
      harness.animationRequests[0]?.animations.map(({ type }) => type),
    ).toEqual(["position", "translation"]);
    expect(harness.retargetCalls).toHaveLength(128);
    expect(
      harness.retargetCalls.every(
        ({ animationId, duration }, index) =>
          animationId === (index % 2) + 1 && duration === 180,
      ),
    ).toBe(true);
    expect(harness.activeAnimationIds()).toEqual([1, 2]);
    expect(harness.cancelledAnimations).toHaveLength(0);

    harness.finishAnimations(window, 1);
    changeGeometry(window, { x: 460, y: 30, width: 300, height: 200 });

    expect(harness.animationRequests).toHaveLength(2);
    expect(
      harness.animationRequests[1]?.animations.map(({ type }) => type),
    ).toEqual(["position"]);
    expect(harness.retargetCalls).toHaveLength(130);
    expect(
      harness.retargetCalls.slice(-2).map(({ animationId }) => animationId),
    ).toEqual([1, 2]);
    expect(harness.cancelledAnimations).toHaveLength(0);
    expect(harness.activeAnimationIds()).toEqual([2, 3]);

    harness.finishAnimations(window);
    expect(harness.activeAnimationIds()).toHaveLength(0);
    expect("driftileTransitionAnimation" in window).toBe(false);

    const leftColumn = createWindow({
      geometry: { x: -330, y: 30, width: 640, height: 900 },
    });
    const middleColumn = createWindow({
      geometry: { x: 324, y: 30, width: 640, height: 900 },
    });
    const rightColumn = createWindow({
      geometry: { x: 978, y: 30, width: 640, height: 900 },
    });
    const columnsHarness = createHarness({ window: leftColumn });
    columnsHarness.effects.windowAdded.emit(middleColumn);
    columnsHarness.effects.windowAdded.emit(rightColumn);

    for (const offset of [-654, 0, -654, 0, -654, 0]) {
      for (const [column, x] of [
        [leftColumn, -330 + offset],
        [middleColumn, 324 + offset],
        [rightColumn, 978 + offset],
      ] as const) {
        changeGeometry(column, { x, y: 30, width: 640, height: 900 });
      }
    }

    expect(columnsHarness.animationRequests).toHaveLength(3);
    expect(columnsHarness.retargetCalls).toHaveLength(20);
    expect(columnsHarness.activeAnimationIds()).toEqual([1, 2, 3, 4]);
    expect(columnsHarness.cancelledAnimations).toHaveLength(0);
  });

  it("retargets an active column after its target geometry becomes hidden", () => {
    const leftColumn = createWindow({
      geometry: { x: 10, y: 30, width: 1000, height: 900 },
    });
    const middleColumn = createWindow({
      geometry: { x: 1024, y: 30, width: 660, height: 900 },
    });
    const rightColumn = createWindow({
      geometry: { x: 1698, y: 30, width: 660, height: 900 },
    });
    const harness = createHarness({ window: leftColumn });
    harness.effects.windowAdded.emit(middleColumn);
    harness.effects.windowAdded.emit(rightColumn);

    for (const [column, x] of [
      [leftColumn, -1340],
      [middleColumn, -326],
      [rightColumn, 348],
    ] as const) {
      changeGeometry(column, {
        ...column.geometry,
        x,
      });
    }

    leftColumn.visible = false;
    for (const [column, x] of [
      [leftColumn, -660],
      [middleColumn, 354],
      [rightColumn, 1028],
    ] as const) {
      changeGeometry(column, {
        ...column.geometry,
        x,
      });
    }

    expect(harness.animationRequests).toHaveLength(3);
    expect(harness.retargetCalls.map(({ animationId }) => animationId)).toEqual(
      [1, 2, 3, 4],
    );
    expect(harness.cancelledAnimations).toHaveLength(0);
    expect(harness.activeAnimationIds()).toEqual([1, 2, 3, 4]);
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

  it("replaces only an ending attribute without clearing its successor", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.beginAnimationEnd(2)).toBe(true);
    harness.window.geometry = {
      x: 60,
      y: 70,
      width: 500,
      height: 300,
    };
    harness.window.windowFrameGeometryChanged.emit(harness.window, {
      x: -800,
      y: 30,
      width: 300,
      height: 200,
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
    expect(harness.activeAnimationIds()).toEqual([1, 3]);
    expect(harness.finishAnimationEnd(2)).toBe(true);
    expect(harness.activeAnimationIds()).toEqual([1, 3]);
    expect("driftileTransitionAnimation" in harness.window).toBe(true);
    harness.finishAnimations(harness.window);
    expect("driftileTransitionAnimation" in harness.window).toBe(false);
  });

  it("keeps a position retarget while an ending size is replaced", () => {
    const harness = createHarness();
    changeGeometry(harness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    expect(harness.beginAnimationEnd(1)).toBe(true);
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
    expect(harness.activeAnimationIds()).toEqual([2, 3]);
    expect(harness.finishAnimationEnd(1)).toBe(true);
    expect(harness.activeAnimationIds()).toEqual([2, 3]);
    expect("driftileTransitionAnimation" in harness.window).toBe(true);
    harness.finishAnimations(harness.window);
    expect("driftileTransitionAnimation" in harness.window).toBe(false);
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
