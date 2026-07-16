import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  countOverviewWindowNavigationTargets,
  findOverviewNavigationTarget,
  findOverviewSequentialNavigationTarget,
  planOverviewWheelNavigation,
} from "../../src/overview/runtime";

describe("planOverviewWheelNavigation", () => {
  it("accumulates a partial delta into one step", () => {
    const partial = planOverviewWheelNavigation(0, 60);
    expect(partial).toEqual({
      direction: null,
      remainder: 60,
      steps: 0,
    });
    expect(planOverviewWheelNavigation(partial?.remainder, 60)).toEqual({
      direction: "previous",
      remainder: 0,
      steps: 1,
    });
  });

  it("caps multi-step events and resets on reversal", () => {
    expect(planOverviewWheelNavigation(119, 480)).toEqual({
      direction: "previous",
      remainder: 119,
      steps: 4,
    });
    expect(planOverviewWheelNavigation(90, -120)).toEqual({
      direction: "next",
      remainder: 0,
      steps: 1,
    });
  });

  it.each([
    [120, 0],
    [0, 481],
    [0.5, 120],
    [0, 120.5],
    [0, null],
  ])("fails closed for invalid input (%o, %o)", (remainder, delta) => {
    expect(planOverviewWheelNavigation(remainder, delta)).toBeNull();
  });
});

describe("countOverviewWindowNavigationTargets", () => {
  it("counts only unique valid window targets", () => {
    expect(
      countOverviewWindowNavigationTargets([
        { kind: "window", windowId: "window-a" },
        { kind: "desktop", windowId: "desktop-a" },
        { kind: "window", windowId: "window-b" },
        { kind: "window", windowId: "window-a" },
        { kind: "window", windowId: "" },
      ]),
    ).toBe(2);
  });

  it("fails closed for oversized or hostile input", () => {
    const limit =
      LAYOUT_PERSISTENCE_LIMITS.windows + LAYOUT_PERSISTENCE_LIMITS.contexts;
    const hostile = Object.defineProperty({ kind: "window" }, "windowId", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      countOverviewWindowNavigationTargets(Array.from({ length: limit + 1 })),
    ).toBeNull();
    expect(
      countOverviewWindowNavigationTargets([
        { kind: "window", windowId: "window-a" },
        hostile,
      ]),
    ).toBeNull();
  });
});

describe("findOverviewNavigationTarget", () => {
  it.each([
    ["left", "left-near"],
    ["right", "right-near"],
    ["up", "up-near"],
    ["down", "down-near"],
  ] as const)(
    "selects the nearest aligned target to the %s",
    (direction, expected) => {
      expect(
        findOverviewNavigationTarget(
          "source",
          [
            target("source", 0, 0),
            target("left-far", -220, 0),
            target("left-near", -110, 0),
            target("right-near", 110, 0),
            target("right-far", 220, 0),
            target("up-near", 0, -110),
            target("up-far", 0, -220),
            target("down-near", 0, 110),
            target("down-far", 0, 220),
          ],
          direction,
        ),
      ).toBe(expected);
    },
  );

  it("does not wrap at a directional boundary", () => {
    const targets = [
      target("source", 0, 0),
      target("right", 110, 0),
      target("down", 0, 110),
    ];

    expect(findOverviewNavigationTarget("source", targets, "left")).toBeNull();
    expect(findOverviewNavigationTarget("source", targets, "up")).toBeNull();
  });

  it("prefers perpendicular overlap before raw distance", () => {
    expect(
      findOverviewNavigationTarget(
        "source",
        [
          target("source", 0, 0),
          target("close-diagonal", 101, 101),
          target("far-aligned", 500, 50),
        ],
        "right",
      ),
    ).toBe("far-aligned");
  });

  it("uses a deterministic id tie-break independent of input order", () => {
    const source = target("source", 0, 0);
    const first = target("target-b", 110, 0);
    const second = target("target-a", 110, 0);

    expect(
      findOverviewNavigationTarget("source", [source, first, second], "right"),
    ).toBe("target-a");
    expect(
      findOverviewNavigationTarget("source", [source, second, first], "right"),
    ).toBe("target-a");
  });

  it("ignores malformed non-source candidates and extra QML fields", () => {
    expect(
      findOverviewNavigationTarget(
        "source",
        [
          { ...target("source", 0, 0), current: true },
          null,
          { id: 42, rect: { height: 100, width: 100, x: 110, y: 0 } },
          target("", 110, 0),
          { id: "missing-rect" },
          { id: "zero-width", rect: { height: 100, width: 0, x: 110, y: 0 } },
          { ...target("valid", 220, 0), desktop: { id: "desktop-2" } },
        ],
        "right",
      ),
    ).toBe("valid");
  });

  it("rejects malformed inputs and source geometry", () => {
    const validTargets = [target("source", 0, 0), target("right", 110, 0)];

    expect(findOverviewNavigationTarget(1, validTargets, "right")).toBeNull();
    expect(findOverviewNavigationTarget("", validTargets, "right")).toBeNull();
    expect(findOverviewNavigationTarget("source", {}, "right")).toBeNull();
    expect(
      findOverviewNavigationTarget("source", validTargets, "next"),
    ).toBeNull();
    expect(
      findOverviewNavigationTarget(
        "source",
        [
          { id: "source", rect: { height: 100, width: -1, x: 0, y: 0 } },
          target("right", 110, 0),
        ],
        "right",
      ),
    ).toBeNull();
    expect(
      findOverviewNavigationTarget(
        "source",
        [target("other", 0, 0), target("right", 110, 0)],
        "right",
      ),
    ).toBeNull();
  });

  it("rejects duplicate valid target ids", () => {
    expect(
      findOverviewNavigationTarget(
        "source",
        [
          target("source", 0, 0),
          target("duplicate", 110, 0),
          target("duplicate", 220, 0),
        ],
        "right",
      ),
    ).toBeNull();
  });

  it("ignores non-finite non-source rectangles", () => {
    expect(
      findOverviewNavigationTarget(
        "source",
        [
          target("source", 0, 0),
          target("infinite", Number.POSITIVE_INFINITY, 0),
          target("nan", 110, Number.NaN),
          target("valid", 220, 0),
        ],
        "right",
      ),
    ).toBe("valid");
  });

  it("fails closed when target property access throws", () => {
    const hostile = Object.defineProperty({}, "id", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      findOverviewNavigationTarget(
        "source",
        [target("source", 0, 0), hostile, target("right", 110, 0)],
        "right",
      ),
    ).toBeNull();
  });
});

describe("findOverviewSequentialNavigationTarget", () => {
  const visuallyOrdered = [
    target("first-a", 0, 0),
    target("first-b", 0, 0),
    target("source", 100, 0),
    target("last", -100, 100),
  ];

  it.each([
    ["first", "first-a"],
    ["last", "last"],
    ["next", "last"],
    ["previous", "first-b"],
  ] as const)("selects the %s visual target", (direction, expected) => {
    expect(
      findOverviewSequentialNavigationTarget(
        "source",
        [...visuallyOrdered].reverse(),
        direction,
      ),
    ).toBe(expected);
  });

  it("uses visual order independent of input order", () => {
    const shuffled = [
      visuallyOrdered[2],
      visuallyOrdered[0],
      visuallyOrdered[3],
      visuallyOrdered[1],
    ];

    for (const direction of ["first", "last", "next", "previous"] as const) {
      expect(
        findOverviewSequentialNavigationTarget("source", shuffled, direction),
      ).toBe(
        findOverviewSequentialNavigationTarget(
          "source",
          visuallyOrdered,
          direction,
        ),
      );
    }
  });

  it("wraps next and previous at visual endpoints", () => {
    expect(
      findOverviewSequentialNavigationTarget("last", visuallyOrdered, "next"),
    ).toBe("first-a");
    expect(
      findOverviewSequentialNavigationTarget(
        "first-a",
        visuallyOrdered,
        "previous",
      ),
    ).toBe("last");
  });

  it("skips malformed non-source targets", () => {
    const oversizedId = "x".repeat(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters * 2 + 33,
    );

    expect(
      findOverviewSequentialNavigationTarget(
        "source",
        [
          null,
          [],
          { id: "" },
          target(oversizedId, 0, 0),
          { id: "invalid-rect", rect: { height: 0, width: 100, x: 0, y: 0 } },
          target("source", 100, 0),
          target("next", 200, 0),
        ],
        "next",
      ),
    ).toBe("next");
  });

  it("accepts the maximum bounded composite target id", () => {
    const maximumId = "x".repeat(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters * 2 + 32,
    );

    expect(
      findOverviewSequentialNavigationTarget(
        maximumId,
        [target(maximumId, 0, 0), target("next", 100, 0)],
        "next",
      ),
    ).toBe("next");
  });

  it("fails closed for invalid or missing sources and directions", () => {
    const validTargets = [target("source", 0, 0), target("next", 100, 0)];
    const oversizedId = "x".repeat(
      LAYOUT_PERSISTENCE_LIMITS.identifierCharacters * 2 + 33,
    );

    expect(
      findOverviewSequentialNavigationTarget("", validTargets, "next"),
    ).toBeNull();
    expect(
      findOverviewSequentialNavigationTarget(oversizedId, validTargets, "next"),
    ).toBeNull();
    expect(
      findOverviewSequentialNavigationTarget("missing", validTargets, "next"),
    ).toBeNull();
    expect(
      findOverviewSequentialNavigationTarget(
        "source",
        [
          { id: "source", rect: { height: 100, width: 0, x: 0, y: 0 } },
          target("next", 100, 0),
        ],
        "next",
      ),
    ).toBeNull();
    expect(
      findOverviewSequentialNavigationTarget("source", validTargets, "right"),
    ).toBeNull();
  });

  it("rejects duplicate valid ids and oversized target arrays", () => {
    expect(
      findOverviewSequentialNavigationTarget(
        "source",
        [
          target("source", 0, 0),
          target("duplicate", 100, 0),
          target("duplicate", 200, 0),
        ],
        "next",
      ),
    ).toBeNull();

    const oversizedTargets = Array.from(
      {
        length:
          LAYOUT_PERSISTENCE_LIMITS.windows +
          LAYOUT_PERSISTENCE_LIMITS.contexts +
          1,
      },
      (_, index) => target(`target-${String(index)}`, index, 0),
    );
    expect(
      findOverviewSequentialNavigationTarget(
        "target-0",
        oversizedTargets,
        "next",
      ),
    ).toBeNull();
  });

  it("fails closed when target access throws", () => {
    const hostileId = Object.defineProperty({}, "id", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    const hostileRect = {
      id: "hostile-rect",
      rect: Object.defineProperty({}, "x", {
        get(): never {
          throw new Error("unavailable");
        },
      }),
    };

    for (const hostile of [hostileId, hostileRect]) {
      expect(
        findOverviewSequentialNavigationTarget(
          "source",
          [target("source", 0, 0), hostile, target("next", 100, 0)],
          "next",
        ),
      ).toBeNull();
    }
  });
});

function target(id: string, x: number, y: number, width = 100, height = 100) {
  return { id, rect: { height, width, x, y } };
}
