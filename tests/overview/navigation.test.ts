import { describe, expect, it } from "vitest";
import { findOverviewNavigationTarget } from "../../src/overview/runtime";

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

function target(id: string, x: number, y: number, width = 100, height = 100) {
  return { id, rect: { height, width, x, y } };
}
