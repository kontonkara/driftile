import { describe, expect, it } from "vitest";

import type { Rect } from "../../../src/core/geometry";
import type { KWinWindow } from "../../../src/platform/kwin/api";
import {
  frameSizeConstraintBounds,
  respectsSizeConstraints,
} from "../../../src/platform/kwin/geometry-adapter";

function createWindow(overrides: Partial<KWinWindow> = {}): KWinWindow {
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
    tile: null,
    transient: false,
    transientFor: null,
    ...overrides,
  };
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

  it.each([
    { height: 300, width: Number.NaN, x: 0, y: 0 },
    { height: Number.POSITIVE_INFINITY, width: 400, x: 0, y: 0 },
    { height: 300, width: -1, x: 0, y: 0 },
    { height: -1, width: 400, x: 0, y: 0 },
  ])("rejects malformed candidate frame %j", (frame) => {
    expect(respectsSizeConstraints(frame, constrained)).toBe(false);
  });
});
