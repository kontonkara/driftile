import { describe, expect, it } from "vitest";

import type { Rect } from "../../../src/core/geometry";
import {
  activityId,
  desktopId,
  outputId,
  windowId,
} from "../../../src/core/ids";
import type { KWinWindow, KWinWorkspace } from "../../../src/platform/kwin/api";
import {
  frameSizeConstraintBounds,
  isWindowInContext,
  KWinGeometryAdapter,
  respectsSizeConstraints,
} from "../../../src/platform/kwin/geometry-adapter";

interface TestX11SizeHints {
  readonly baseSize: { readonly height: number; readonly width: number };
  readonly maximumAspectRatio: {
    readonly height: number;
    readonly width: number;
  };
  readonly minimumAspectRatio: {
    readonly height: number;
    readonly width: number;
  };
  readonly resizeIncrement: {
    readonly height: number;
    readonly width: number;
  };
}

interface TestHintedWindow extends KWinWindow {
  testOnlyX11SizeHints: TestX11SizeHints;
}

function createWindow(overrides: Partial<KWinWindow> = {}): TestHintedWindow {
  return {
    clientGeometry: { height: 600, width: 800, x: 10, y: 30 },
    deleted: false,
    desktops: [{ id: "desktop-1" }],
    desktopWindow: false,
    dialog: false,
    dock: false,
    frameGeometry: { height: 640, width: 820, x: 0, y: 0 },
    fullScreen: false,
    internalId: "window-1",
    managed: true,
    maximizeMode: 0,
    maxSize: { height: 500, width: 700 },
    minSize: { height: 200, width: 300 },
    minimized: false,
    modal: false,
    move: false,
    moveable: true,
    normalWindow: true,
    onAllDesktops: false,
    output: {
      devicePixelRatio: 1,
      geometry: { height: 1080, width: 1920, x: 0, y: 0 },
      name: "output-1",
    },
    resize: false,
    resizeable: true,
    specialWindow: false,
    testOnlyX11SizeHints: {
      baseSize: { height: 1, width: 1 },
      maximumAspectRatio: { height: 9, width: 21 },
      minimumAspectRatio: { height: 9, width: 16 },
      resizeIncrement: { height: 128, width: 128 },
    },
    tile: null,
    transient: false,
    transientFor: null,
    ...overrides,
  };
}

function createGeometryAdapter(window: KWinWindow): KWinGeometryAdapter {
  const desktop = window.desktops[0];
  const output = window.output;

  if (!desktop || !output) {
    throw new Error("geometry adapter fixture requires a window context");
  }

  const inertSignal = {
    connect: () => undefined,
    disconnect: () => undefined,
  };
  const workspace = {
    activeScreen: output,
    activeWindow: window,
    clientArea: () => output.geometry,
    currentDesktop: desktop,
    currentDesktopChanged: inertSignal,
    desktops: [desktop],
    screens: [output],
    stackingOrder: [window],
    windowActivated: inertSignal,
    windowAdded: inertSignal,
    windowRemoved: inertSignal,
  } satisfies KWinWorkspace;

  return new KWinGeometryAdapter(
    workspace,
    {
      source: (id) => (id === String(window.internalId) ? window : undefined),
    },
    2,
  );
}

function canApplyFrame(window: KWinWindow, frame: Rect): boolean {
  return createGeometryAdapter(window).canApplyFrame(
    windowId(String(window.internalId)),
    frame,
    {
      desktopId: desktopId("desktop-1"),
      outputId: outputId("output-1"),
    },
  );
}

describe("frameSizeConstraintBounds", () => {
  it("adds server-side decoration extents to both client bounds", () => {
    expect(frameSizeConstraintBounds(createWindow())).toEqual({
      maximumHeight: 540,
      maximumWidth: 720,
      minimumHeight: 240,
      minimumWidth: 320,
    });
  });

  it("keeps client-side decoration bounds unchanged", () => {
    const geometry = { height: 480, width: 640, x: 25, y: 50 };
    const window = createWindow({
      clientGeometry: geometry,
      frameGeometry: geometry,
    });

    expect(frameSizeConstraintBounds(window)).toEqual({
      maximumHeight: 500,
      maximumWidth: 700,
      minimumHeight: 200,
      minimumWidth: 300,
    });
  });

  it("preserves fractional client bounds and decoration extents", () => {
    const window = createWindow({
      clientGeometry: { height: 391.75, width: 492.25, x: 0, y: 0 },
      frameGeometry: { height: 400.5, width: 500.75, x: 0, y: 0 },
      maxSize: { height: 300.625, width: 300.125 },
      minSize: { height: 80.125, width: 100.25 },
    });

    expect(frameSizeConstraintBounds(window)).toEqual({
      maximumHeight: 309.375,
      maximumWidth: 308.625,
      minimumHeight: 88.875,
      minimumWidth: 108.75,
    });
  });

  it("represents non-positive and non-finite maxima as unbounded", () => {
    const window = createWindow({
      maxSize: { height: Number.NaN, width: 0 },
    });
    const bounds = frameSizeConstraintBounds(window);

    expect(bounds?.maximumWidth).toBe(Number.POSITIVE_INFINITY);
    expect(bounds?.maximumHeight).toBe(Number.POSITIVE_INFINITY);

    const negative = frameSizeConstraintBounds(
      createWindow({
        maxSize: { height: -1, width: Number.NEGATIVE_INFINITY },
      }),
    );

    expect(negative?.maximumWidth).toBe(Number.POSITIVE_INFINITY);
    expect(negative?.maximumHeight).toBe(Number.POSITIVE_INFINITY);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "fails closed for an invalid minimum of %s",
    (minimum) => {
      const window = createWindow({
        minSize: { height: 200, width: minimum },
      });

      expect(frameSizeConstraintBounds(window)).toBeNull();
      expect(
        respectsSizeConstraints(
          { height: 300, width: 400, x: 0, y: 0 },
          window,
        ),
      ).toBe(false);
    },
  );

  it("clamps only sub-epsilon negative decoration noise", () => {
    const window = createWindow({
      clientGeometry: {
        height: 600.0000005,
        width: 800.0000005,
        x: 0,
        y: 0,
      },
      frameGeometry: { height: 600, width: 800, x: 0, y: 0 },
    });

    expect(frameSizeConstraintBounds(window)).toEqual({
      maximumHeight: 500,
      maximumWidth: 700,
      minimumHeight: 200,
      minimumWidth: 300,
    });
  });

  it.each([
    {
      clientGeometry: { height: 600, width: 821, x: 0, y: 0 },
      frameGeometry: { height: 640, width: 820, x: 0, y: 0 },
      label: "negative horizontal decoration",
    },
    {
      clientGeometry: { height: 641, width: 800, x: 0, y: 0 },
      frameGeometry: { height: 640, width: 820, x: 0, y: 0 },
      label: "negative vertical decoration",
    },
    {
      clientGeometry: { height: 600, width: Number.NaN, x: 0, y: 0 },
      frameGeometry: { height: 640, width: 820, x: 0, y: 0 },
      label: "non-finite client geometry",
    },
    {
      clientGeometry: { height: 600, width: 800, x: 0, y: 0 },
      frameGeometry: {
        height: Number.POSITIVE_INFINITY,
        width: 820,
        x: 0,
        y: 0,
      },
      label: "non-finite frame geometry",
    },
  ])("fails closed for $label", ({ clientGeometry, frameGeometry }) => {
    const window = createWindow({ clientGeometry, frameGeometry });

    expect(frameSizeConstraintBounds(window)).toBeNull();
    expect(
      respectsSizeConstraints({ height: 300, width: 400, x: 0, y: 0 }, window),
    ).toBe(false);
  });
});

describe("isWindowInContext", () => {
  it("requires an exact single activity when activity ownership is known", () => {
    const context = {
      activityId: activityId("work"),
      desktopId: desktopId("desktop-1"),
      outputId: outputId("output-1"),
    };

    expect(
      isWindowInContext(createWindow({ activities: ["work"] }), context),
    ).toBe(true);
    expect(
      isWindowInContext(createWindow({ activities: ["personal"] }), context),
    ).toBe(false);
    expect(
      isWindowInContext(
        createWindow({ activities: ["work", "personal"] }),
        context,
      ),
    ).toBe(false);
    expect(
      isWindowInContext(createWindow({ activities: [] }), context, ["work"]),
    ).toBe(true);
    expect(
      isWindowInContext(createWindow({ activities: [] }), context, [
        "work",
        "personal",
      ]),
    ).toBe(false);
  });
});

describe("respectsSizeConstraints", () => {
  const constrained = createWindow({
    clientGeometry: { height: 380, width: 490, x: 5, y: 15 },
    frameGeometry: { height: 400, width: 500, x: 0, y: 0 },
    maxSize: { height: 300, width: 400 },
    minSize: { height: 200, width: 100 },
  });

  it.each([
    [{ height: 220, width: 110, x: 0, y: 0 }, true],
    [{ height: 320, width: 410, x: 0, y: 0 }, true],
    [{ height: 220, width: 109.9, x: 0, y: 0 }, false],
    [{ height: 219.9, width: 110, x: 0, y: 0 }, false],
    [{ height: 320, width: 410.1, x: 0, y: 0 }, false],
    [{ height: 320.1, width: 410, x: 0, y: 0 }, false],
  ] satisfies readonly (readonly [Rect, boolean])[])(
    "checks frame %j against frame-aware bounds",
    (frame, expected) => {
      expect(respectsSizeConstraints(frame, constrained)).toBe(expected);
    },
  );

  it("accepts finite frames when client maxima are unbounded", () => {
    const window = createWindow({
      maxSize: {
        height: Number.POSITIVE_INFINITY,
        width: Number.POSITIVE_INFINITY,
      },
    });

    expect(
      respectsSizeConstraints(
        { height: 100_000, width: 100_000, x: 0, y: 0 },
        window,
      ),
    ).toBe(true);
  });

  it("ignores structurally extra base, increment, and aspect hints", () => {
    const window = createWindow();
    const frame = { height: 500, width: 320, x: 100, y: 50 };
    const hints = window.testOnlyX11SizeHints;
    const clientWidth =
      frame.width - (window.frameGeometry.width - window.clientGeometry.width);
    const clientHeight =
      frame.height -
      (window.frameGeometry.height - window.clientGeometry.height);

    expect(
      (clientWidth - hints.baseSize.width) % hints.resizeIncrement.width,
    ).not.toBe(0);
    expect(
      (clientHeight - hints.baseSize.height) % hints.resizeIncrement.height,
    ).not.toBe(0);
    expect(clientWidth / clientHeight).toBeLessThan(
      hints.minimumAspectRatio.width / hints.minimumAspectRatio.height,
    );
    expect(respectsSizeConstraints(frame, window)).toBe(true);
    expect(canApplyFrame(window, frame)).toBe(true);
  });

  it("keeps fractional hard bounds and decoration extents authoritative", () => {
    const window = createWindow({
      clientGeometry: { height: 391.75, width: 492.25, x: 0, y: 0 },
      frameGeometry: { height: 400.5, width: 500.75, x: 0, y: 0 },
      maxSize: { height: 300.625, width: 300.125 },
      minSize: { height: 80.125, width: 100.25 },
      output: {
        devicePixelRatio: 1.25,
        geometry: { height: 864, width: 1536, x: 0, y: 0 },
        name: "output-1",
      },
    });
    const boundary = { height: 309.375, width: 108.75, x: 0, y: 0 };
    const belowMinimum = { ...boundary, width: 108.748 };
    const aboveMaximum = { ...boundary, height: 309.377 };

    expect(respectsSizeConstraints(boundary, window)).toBe(true);
    expect(canApplyFrame(window, boundary)).toBe(true);
    expect(respectsSizeConstraints(belowMinimum, window)).toBe(false);
    expect(canApplyFrame(window, belowMinimum)).toBe(false);
    expect(respectsSizeConstraints(aboveMaximum, window)).toBe(false);
    expect(canApplyFrame(window, aboveMaximum)).toBe(false);
  });

  it("fails closed for malformed hard bounds despite advisory metadata", () => {
    const window = createWindow({
      minSize: { height: 200, width: Number.NaN },
    });
    const frame = { height: 300, width: 400, x: 0, y: 0 };

    window.testOnlyX11SizeHints = {
      baseSize: { height: Number.NaN, width: Number.NEGATIVE_INFINITY },
      maximumAspectRatio: { height: 0, width: Number.NaN },
      minimumAspectRatio: { height: -1, width: Number.POSITIVE_INFINITY },
      resizeIncrement: { height: 0, width: -1 },
    };

    expect(respectsSizeConstraints(frame, window)).toBe(false);
    expect(canApplyFrame(window, frame)).toBe(false);
  });

  it.each([
    { height: 300, width: Number.NaN, x: 0, y: 0 },
    { height: Number.POSITIVE_INFINITY, width: 400, x: 0, y: 0 },
    { height: 300, width: -1, x: 0, y: 0 },
    { height: -1, width: 400, x: 0, y: 0 },
  ])("rejects malformed candidate frame %j", (frame) => {
    expect(respectsSizeConstraints(frame, constrained)).toBe(false);
  });
});
