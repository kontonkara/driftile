import { describe, expect, it } from "vitest";
import {
  captureOverviewExitHandoff,
  planOverviewExitHandoffTransition,
  type OverviewExitHandoffState,
} from "../src/overview/exit-handoff";

describe("captureOverviewExitHandoff", () => {
  it("copies and freezes the complete pre-write handoff geometry", () => {
    const camera = { offsetX: -320, offsetY: 540, zoom: 0.5 };
    const sourceRect = { height: 240, width: 360, x: 120, y: 180 };
    const targetFrame = { height: 780, width: 620, x: 20, y: 40 };
    const input = captureInput({ camera, sourceRect, targetFrame });

    const state = captureOverviewExitHandoff(input);

    expect(state).toEqual({
      capture: {
        ...input,
        desktopRelation: "same-desktop",
      },
      phase: "captured",
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state?.capture)).toBe(true);
    expect(Object.isFrozen(state?.capture.camera)).toBe(true);
    expect(Object.isFrozen(state?.capture.sourceRect)).toBe(true);
    expect(Object.isFrozen(state?.capture.targetFrame)).toBe(true);

    camera.zoom = 0.25;
    sourceRect.x = 900;
    targetFrame.width = 1;

    expect(state?.capture.camera.zoom).toBe(0.5);
    expect(state?.capture.sourceRect.x).toBe(120);
    expect(state?.capture.targetFrame.width).toBe(620);
  });

  it("classifies same- and cross-desktop captures without consulting live state", () => {
    expect(
      captureOverviewExitHandoff(captureInput())?.capture.desktopRelation,
    ).toBe("same-desktop");
    expect(
      captureOverviewExitHandoff(captureInput({ targetDesktopId: "desktop-2" }))
        ?.capture.desktopRelation,
    ).toBe("cross-desktop");
  });

  it("accepts a desktop fallback without a window identity", () => {
    const state = captureOverviewExitHandoff(
      captureInput({
        targetKind: "desktop-fallback",
        targetWindowId: null,
      }),
    );

    expect(state?.capture).toMatchObject({
      targetKind: "desktop-fallback",
      targetWindowId: null,
    });
  });

  it("accepts the full positive QML counter range", () => {
    const state = captureOverviewExitHandoff(
      captureInput({
        generation: 2_147_483_647,
        sessionId: 2_147_483_647,
        token: 2_147_483_647,
      }),
    );

    expect(state?.capture).toMatchObject({
      generation: 2_147_483_647,
      sessionId: 2_147_483_647,
      token: 2_147_483_647,
    });
  });

  it.each([
    ["zero source width", { sourceRect: rect({ width: 0 }) }],
    ["negative target height", { targetFrame: rect({ height: -1 }) }],
    ["non-finite source coordinate", { sourceRect: rect({ x: Infinity }) }],
    ["non-finite target coordinate", { targetFrame: rect({ y: NaN }) }],
    ["zero camera zoom", { camera: camera({ zoom: 0 }) }],
    ["non-finite camera offset", { camera: camera({ offsetX: -Infinity }) }],
  ])("rejects %s", (_label, overrides) => {
    expect(captureOverviewExitHandoff(captureInput(overrides))).toBeNull();
  });

  it.each([
    { generation: 0 },
    { sessionId: 1.5 },
    { sourceDesktopId: "" },
    { sourceOutputId: "x".repeat(257) },
    { targetKind: "unknown" },
    { targetMinimized: "yes" },
    { targetOutputId: "" },
    { targetWindowId: null },
    { token: Number.MAX_SAFE_INTEGER },
  ])("rejects malformed capture identity (%o)", (overrides) => {
    expect(captureOverviewExitHandoff(captureInput(overrides))).toBeNull();
  });

  it("fails closed for hostile capture accessors", () => {
    const hostile = Object.defineProperty(captureInput(), "sourceRect", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(captureOverviewExitHandoff(hostile)).toBeNull();
  });
});

describe("planOverviewExitHandoffTransition", () => {
  it.each([
    ["same desktop", {}],
    ["cross desktop", { targetDesktopId: "desktop-2" }],
  ])(
    "promotes an exact non-minimized window on the %s",
    (_label, overrides) => {
      const state = requiredCapture(overrides);
      const plan = planOverviewExitHandoffTransition({
        event: settleEvent(state),
        state,
      });

      expect(plan).toMatchObject({
        disposition: "promote",
        promotion: {
          desktopRelation: state.capture.desktopRelation,
          targetDesktopId: state.capture.targetDesktopId,
          targetKind: "window",
          targetOutputId: "DP-1",
          targetWindowId: "window-7",
        },
        reason: null,
        state: { phase: "promoted" },
      });
      expect(plan?.promotion).toEqual(plan?.state.capture);
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan?.state)).toBe(true);
    },
  );

  it.each([
    ["output", { targetOutputId: "HDMI-A-1" }],
    ["desktop", { targetDesktopId: "desktop-2" }],
    ["window", { targetWindowId: "window-8" }],
    ["frame", { targetFrame: rect({ x: 21 }) }],
    ["session", { sessionId: 8 }],
    ["generation", { generation: 12 }],
    ["token", { token: 42 }],
  ])("falls back when the live target %s is not exact", (_label, overrides) => {
    const state = requiredCapture();
    const plan = planOverviewExitHandoffTransition({
      event: settleEvent(state, overrides),
      state,
    });

    expect(plan).toEqual({
      disposition: "fallback",
      promotion: null,
      reason: "stale",
      state: { capture: state.capture, phase: "fallback" },
    });
  });

  it("requires the exact topology generation before promotion", () => {
    const state = requiredCapture();

    expect(
      planOverviewExitHandoffTransition({
        event: settleEvent(state, { topologyGeneration: 12 }),
        state,
      }),
    ).toEqual({
      disposition: "fallback",
      promotion: null,
      reason: "topology",
      state: { capture: state.capture, phase: "fallback" },
    });
  });

  it.each([
    ["captured minimized target", { targetMinimized: true }, {}],
    ["newly minimized target", {}, { targetMinimized: true }],
  ])("uses a geometry-free fallback for a %s", (_label, capture, event) => {
    const state = requiredCapture(capture);
    const plan = planOverviewExitHandoffTransition({
      event: settleEvent(state, event),
      state,
    });

    expect(plan).toMatchObject({
      disposition: "fallback",
      promotion: null,
      reason: "minimized",
      state: { phase: "fallback" },
    });
  });

  it("resolves an explicit desktop target to a geometry-free fallback", () => {
    const state = requiredCapture({
      targetKind: "desktop-fallback",
      targetWindowId: null,
    });
    const plan = planOverviewExitHandoffTransition({
      event: settleEvent(state),
      state,
    });

    expect(plan).toMatchObject({
      disposition: "fallback",
      promotion: null,
      reason: "desktop-fallback",
      state: { phase: "fallback" },
    });
  });

  it.each(["stale", "topology"] as const)(
    "invalidates a promoted handoff through the %s fallback",
    (reason) => {
      const captured = requiredCapture();
      const promoted = requiredTransition(
        captured,
        settleEvent(captured),
      ).state;
      const plan = planOverviewExitHandoffTransition({
        event: ownedEvent(promoted, { reason, type: "invalidate" }),
        state: promoted,
      });

      expect(plan).toMatchObject({
        disposition: "fallback",
        promotion: null,
        reason,
        state: { phase: "fallback" },
      });
    },
  );

  it.each([
    ["interrupt", "interrupted"],
    ["reopen", "reopened"],
  ] as const)(
    "cancels a promoted handoff on %s without exposing geometry",
    (type, reason) => {
      const captured = requiredCapture();
      const promoted = requiredTransition(
        captured,
        settleEvent(captured),
      ).state;
      const plan = planOverviewExitHandoffTransition({
        event: ownedEvent(promoted, { type }),
        state: promoted,
      });

      expect(plan).toMatchObject({
        disposition: "cancel",
        promotion: null,
        reason,
        state: { phase: "canceled" },
      });
    },
  );

  it("keeps a canceled handoff terminal and side-effect free", () => {
    const captured = requiredCapture();
    const canceled = requiredTransition(
      captured,
      ownedEvent(captured, { type: "reopen" }),
    ).state;

    expect(
      planOverviewExitHandoffTransition({
        event: Object.defineProperty({}, "type", {
          get(): never {
            throw new Error("must not be read");
          },
        }),
        state: canceled,
      }),
    ).toEqual({
      disposition: "none",
      promotion: null,
      reason: null,
      state: canceled,
    });
  });

  it("rejects malformed settlement geometry instead of promoting it", () => {
    const state = requiredCapture();

    expect(
      planOverviewExitHandoffTransition({
        event: settleEvent(state, { targetFrame: rect({ width: 0 }) }),
        state,
      }),
    ).toBeNull();
  });

  it("fails closed for hostile transition accessors", () => {
    const state = requiredCapture();
    const hostile = Object.defineProperty({}, "event", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    Object.defineProperty(hostile, "state", { value: state });
    expect(planOverviewExitHandoffTransition(hostile)).toBeNull();
  });
});

function requiredCapture(
  overrides: Record<string, unknown> = {},
): OverviewExitHandoffState {
  const state = captureOverviewExitHandoff(captureInput(overrides));
  if (state === null) {
    throw new Error("expected a valid exit handoff capture");
  }
  return state;
}

function requiredTransition(
  state: OverviewExitHandoffState,
  event: Record<string, unknown>,
) {
  const plan = planOverviewExitHandoffTransition({ event, state });
  if (plan === null) {
    throw new Error("expected a valid exit handoff transition");
  }
  return plan;
}

function captureInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    camera: camera(),
    generation: 11,
    sessionId: 7,
    sourceDesktopId: "desktop-1",
    sourceOutputId: "DP-1",
    sourceRect: rect({ height: 240, width: 360, x: 120, y: 180 }),
    targetDesktopId: "desktop-1",
    targetFrame: rect({ height: 780, width: 620, x: 20, y: 40 }),
    targetKind: "window",
    targetMinimized: false,
    targetOutputId: "DP-1",
    targetWindowId: "window-7",
    token: 41,
    ...overrides,
  };
}

function settleEvent(
  state: OverviewExitHandoffState,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const capture = state.capture;
  return {
    generation: capture.generation,
    sessionId: capture.sessionId,
    targetDesktopId: capture.targetDesktopId,
    targetFrame: { ...capture.targetFrame },
    targetMinimized: capture.targetMinimized,
    targetOutputId: capture.targetOutputId,
    targetWindowId: capture.targetWindowId,
    token: capture.token,
    topologyGeneration: capture.generation,
    type: "settle",
    ...overrides,
  };
}

function ownedEvent(
  state: OverviewExitHandoffState,
  event: Record<string, unknown>,
): Record<string, unknown> {
  return {
    generation: state.capture.generation,
    sessionId: state.capture.sessionId,
    token: state.capture.token,
    ...event,
  };
}

function rect(
  overrides: Partial<{
    height: number;
    width: number;
    x: number;
    y: number;
  }> = {},
) {
  return { height: 100, width: 100, x: 0, y: 0, ...overrides };
}

function camera(
  overrides: Partial<{
    offsetX: number;
    offsetY: number;
    zoom: number;
  }> = {},
) {
  return { offsetX: -320, offsetY: 540, zoom: 0.5, ...overrides };
}
