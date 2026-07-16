import { describe, expect, it } from "vitest";
import { planOverviewWindowDesktopDrop } from "../../src/overview/runtime";

const OUTPUT = "eDP-1";
const OTHER_OUTPUT = "DP-1";
const SOURCE_DESKTOP = "desktop-1";
const TARGET_DESKTOP = "desktop-2";
const EMPTY_DESKTOP = "desktop-empty";
const WINDOW = "window-a";

function context(
  desktopId: string,
  windowIds: readonly string[],
  outputId = OUTPUT,
  activityId = "work",
) {
  return {
    activeColumnIndex: windowIds.length === 0 ? null : 0,
    activityId,
    columns:
      windowIds.length === 0
        ? []
        : [
            {
              members: windowIds.map((windowId) => ({ windowId })),
              presentation: "stacked",
              selectedMemberIndex: 0,
              width: { kind: "proportion", value: 1 / 3 },
            },
          ],
    desktopId,
    outputId,
    viewportOffset: 0,
  };
}

function model(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    contexts: [
      context(SOURCE_DESKTOP, [WINDOW, "window-b"]),
      context(TARGET_DESKTOP, ["window-c"]),
    ],
    currentActivityId: "work",
    desktopIds: [SOURCE_DESKTOP, TARGET_DESKTOP, EMPTY_DESKTOP],
    floatingWindows: [
      {
        activityId: "work",
        anchor: {},
        desktopId: SOURCE_DESKTOP,
        outputId: OUTPUT,
        windowId: "window-floating",
      },
    ],
    outputs: [{ outputId: OUTPUT }, { outputId: OTHER_OUTPUT }],
    ...overrides,
  };
}

function request(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    outputId: OUTPUT,
    sourceDesktopId: SOURCE_DESKTOP,
    targetDesktopId: TARGET_DESKTOP,
    windowId: WINDOW,
    ...overrides,
  };
}

describe("planOverviewWindowDesktopDrop", () => {
  it("accepts one tiled source window and a same-output target context", () => {
    expect(planOverviewWindowDesktopDrop(model(), request())).toBe(true);
  });

  it("accepts one floating source window and an unmaterialized empty target", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model(),
        request({
          targetDesktopId: EMPTY_DESKTOP,
          windowId: "window-floating",
        }),
      ),
    ).toBe(true);
  });

  it.each([
    null,
    {},
    request({ outputId: "" }),
    request({ sourceDesktopId: "" }),
    request({ targetDesktopId: "" }),
    request({ windowId: "" }),
    request({ targetDesktopId: SOURCE_DESKTOP }),
  ])("rejects malformed or same-target requests", (candidate) => {
    expect(planOverviewWindowDesktopDrop(model(), candidate)).toBe(false);
  });

  it.each([
    request({ outputId: "unknown-output" }),
    request({ sourceDesktopId: "unknown-source" }),
    request({ targetDesktopId: "unknown-target" }),
    request({ windowId: "unknown-window" }),
  ])("rejects unknown request identities", (candidate) => {
    expect(planOverviewWindowDesktopDrop(model(), candidate)).toBe(false);
  });

  it("rejects a requested window duplicated across tiled and floating state", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          floatingWindows: [
            {
              activityId: "work",
              desktopId: SOURCE_DESKTOP,
              outputId: OUTPUT,
              windowId: WINDOW,
            },
          ],
        }),
        request(),
      ),
    ).toBe(false);
  });

  it("rejects a window owned only by a different context", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          contexts: [
            context(SOURCE_DESKTOP, ["window-b"]),
            context(TARGET_DESKTOP, [WINDOW]),
          ],
          floatingWindows: [],
        }),
        request(),
      ),
    ).toBe(false);
  });

  it("accepts a target materialized only on another output", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          contexts: [
            context(SOURCE_DESKTOP, [WINDOW]),
            context(TARGET_DESKTOP, [], OTHER_OUTPUT),
          ],
          floatingWindows: [],
        }),
        request(),
      ),
    ).toBe(true);
  });

  it("rejects non-current activity contexts and floating windows", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          contexts: [
            context(SOURCE_DESKTOP, [WINDOW]),
            context(TARGET_DESKTOP, [], OUTPUT, "personal"),
          ],
          floatingWindows: [],
        }),
        request(),
      ),
    ).toBe(false);

    expect(
      planOverviewWindowDesktopDrop(
        model({
          floatingWindows: [
            {
              activityId: "personal",
              desktopId: SOURCE_DESKTOP,
              outputId: OUTPUT,
              windowId: "window-floating",
            },
          ],
        }),
        request(),
      ),
    ).toBe(false);
  });

  it("rejects duplicate exact target contexts", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          contexts: [
            context(SOURCE_DESKTOP, [WINDOW]),
            context(TARGET_DESKTOP, []),
            context(TARGET_DESKTOP, []),
          ],
          floatingWindows: [],
        }),
        request(),
      ),
    ).toBe(false);
  });

  it("rejects duplicate model identities", () => {
    expect(
      planOverviewWindowDesktopDrop(
        model({
          desktopIds: [SOURCE_DESKTOP, TARGET_DESKTOP, TARGET_DESKTOP],
        }),
        request(),
      ),
    ).toBe(false);
  });

  it("fails closed for malformed models and throwing accessors", () => {
    expect(planOverviewWindowDesktopDrop({}, request())).toBe(false);

    const throwing = Object.defineProperty({}, "contexts", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    expect(planOverviewWindowDesktopDrop(throwing, request())).toBe(false);
  });
});
