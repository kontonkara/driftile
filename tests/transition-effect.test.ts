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

type AnimationOperation =
  | {
      readonly kind: "animate";
      readonly animationIds: readonly number[];
    }
  | {
      readonly kind: "cancel";
      readonly animationId: unknown;
    };

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
    readonly windowClassExclusions?: unknown;
  } = {},
) {
  const window = options.window ?? createWindow();
  const windowAdded = createSignal<[WindowStub]>();
  const windowDeleted = createSignal<[WindowStub]>();
  const hasActiveFullScreenEffectChanged = createSignal<[]>();
  const desktopChanged = createSignal<[unknown, unknown, unknown, unknown]>();
  const currentActivityChanged = createSignal<[string]>();
  const configChanged = createSignal<[]>();
  const animationRequests: AnimationRequest[] = [];
  const animationOperations: AnimationOperation[] = [];
  const cancelledAnimations: unknown[] = [];
  const retargetCalls: RetargetCall[] = [];
  const failedRetargets = new Set<number>();
  const animationTimeCalls: number[] = [];
  const configuredValues: Record<string, unknown> = {
    AnimatePosition: options.animatePosition ?? true,
    AnimateSize: options.animateSize ?? true,
    Duration: options.configuredDuration ?? 180,
    WindowClassExclusions:
      options.windowClassExclusions === undefined
        ? ""
        : options.windowClassExclusions,
  };
  let nextAnimationId = 1;
  const effects = {
    hasActiveFullScreenEffect: false,
    stackingOrder: [window],
    windowAdded,
    windowDeleted,
    hasActiveFullScreenEffectChanged,
    desktopChanged,
    currentActivityChanged,
  };

  runInNewContext(script, {
    Effect: {
      Position: "position",
      Size: "size",
      Translation: "translation",
    },
    QEasingCurve: {
      OutCubic: "out-cubic",
    },
    animate(request: AnimationRequest) {
      animationRequests.push(request);
      const animationIds = request.animations.map(() => nextAnimationId++);
      animationOperations.push({ kind: "animate", animationIds });
      return animationIds;
    },
    animationTime(duration: number) {
      animationTimeCalls.push(duration);
      return options.scaledDuration ?? duration;
    },
    cancel(animation: unknown) {
      cancelledAnimations.push(animation);
      animationOperations.push({ kind: "cancel", animationId: animation });
      return true;
    },
    retarget(animationId: number, target: unknown, duration: number) {
      retargetCalls.push({ animationId, target, duration });
      return !failedRetargets.has(animationId);
    },
    effect: {
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
    animationOperations,
    animationRequests,
    animationTimeCalls,
    cancelledAnimations,
    configChanged,
    effects,
    failedRetargets,
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
    expect(config).toContain('<entry name="AnimatePosition" type="Bool">');
    expect(config).toContain('<entry name="AnimateSize" type="Bool">');
    expect(config).toContain(
      '<entry name="WindowClassExclusions" type="String">',
    );
    expect(configUi).toContain('name="kcfg_Duration"');
    expect(configUi).toContain('name="kcfg_AnimatePosition"');
    expect(configUi).toContain('name="kcfg_AnimateSize"');
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

  it("uses translation for negative centers and resumes absolute retargeting", () => {
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
        type: "translation",
        from: { value1: -100, value2: -20 },
        to: { value1: 0, value2: 0 },
      },
    ]);
    changeGeometry(window, {
      x: -250,
      y: 70,
      width: 300,
      height: 200,
    });
    expect(harness.animationRequests).toHaveLength(2);
    expect(harness.animationRequests[1]?.animations).toMatchObject([
      {
        type: "translation",
        from: { value1: -50, value2: -20 },
        to: { value1: 0, value2: 0 },
      },
    ]);
    expect(harness.cancelledAnimations).toHaveLength(0);
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

    expect(harness.animationRequests).toHaveLength(4);
    expect(harness.animationRequests[3]?.animations).toMatchObject([
      {
        type: "position",
        from: { value1: 250, value2: 170 },
        to: { value1: 350, value2: 170 },
      },
    ]);
    expect(harness.cancelledAnimations).toEqual([1, 2, 3]);

    changeGeometry(window, {
      x: 300,
      y: 70,
      width: 300,
      height: 200,
    });
    expect(harness.animationRequests).toHaveLength(4);
    expect(harness.retargetCalls).toEqual([
      {
        animationId: 4,
        target: { value1: 450, value2: 170 },
        duration: 180,
      },
    ]);
  });

  it("starts cross-mode compensation before cancelling the previous mode", () => {
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

    expect(
      harness.animationRequests.map((request) => request.animations[0]?.type),
    ).toEqual([
      "position",
      "translation",
      "translation",
      "translation",
      "position",
    ]);
    expect(harness.animationOperations).toEqual([
      { kind: "animate", animationIds: [1] },
      { kind: "animate", animationIds: [2] },
      { kind: "cancel", animationId: 1 },
      { kind: "animate", animationIds: [3] },
      { kind: "animate", animationIds: [4] },
      { kind: "animate", animationIds: [5] },
      { kind: "cancel", animationId: 2 },
      { kind: "cancel", animationId: 3 },
      { kind: "cancel", animationId: 4 },
    ]);
  });

  it("bounds tracked translations and cancels every retained animation", () => {
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

    expect(harness.animationRequests).toHaveLength(35);
    expect(harness.cancelledAnimations).toEqual([1, 2, 3]);
    expect(harness.animationOperations.slice(-6)).toEqual([
      { kind: "animate", animationIds: [33] },
      { kind: "cancel", animationId: 1 },
      { kind: "animate", animationIds: [34] },
      { kind: "cancel", animationId: 2 },
      { kind: "animate", animationIds: [35] },
      { kind: "cancel", animationId: 3 },
    ]);

    window.move = true;
    changeGeometry(window, {
      x: -900,
      y: 30,
      width: 300,
      height: 200,
    });
    expect(harness.cancelledAnimations).toEqual(
      Array.from({ length: 35 }, (_, index) => index + 1),
    );
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
          type: "translation",
          from: { value1: -230, value2: -110 },
          to: { value1: 0, value2: 0 },
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
    harness.window.windowDesktopsChanged.emit(harness.window);
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
    harness.effects.desktopChanged.emit(null, null, null, null);
    expect(harness.animationRequests).toHaveLength(1);
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
    configHarness.setFullScreenEffectActive(false);
    expect(configHarness.animationRequests).toHaveLength(0);

    const deletedHarness = createHarness();
    deletedHarness.setFullScreenEffectActive(true);
    changeGeometry(deletedHarness.window, {
      x: 40,
      y: 50,
      width: 400,
      height: 250,
    });
    deletedHarness.windowDeleted.emit(deletedHarness.window);
    deletedHarness.setFullScreenEffectActive(false);
    expect(deletedHarness.animationRequests).toHaveLength(0);

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
