import { describe, expect, it } from "vitest";
import type { WindowGeometry } from "../../src/core/geometry";
import { columnId, windowId } from "../../src/core/ids";
import { diffWindowGeometries } from "../../src/core/reconcile";

const firstWindow = windowId("window-1");
const secondWindow = windowId("window-2");
const desired: readonly WindowGeometry[] = [
  {
    columnId: columnId("column-1"),
    frame: { height: 800, width: 600, x: 16, y: 16 },
    windowId: firstWindow,
  },
  {
    columnId: columnId("column-2"),
    frame: { height: 800, width: 600, x: 632, y: 16 },
    windowId: secondWindow,
  },
];

describe("diffWindowGeometries", () => {
  it("emits only changed frames", () => {
    const changes = diffWindowGeometries(
      desired,
      new Map([
        [firstWindow, { height: 800, width: 600, x: 16, y: 16 }],
        [secondWindow, { height: 700, width: 500, x: 0, y: 0 }],
      ]),
    );

    expect(changes).toEqual([
      {
        frame: { height: 800, width: 600, x: 632, y: 16 },
        windowId: "window-2",
      },
    ]);
  });

  it("is idempotent after the desired frames are observed", () => {
    const observed = new Map(
      desired.map((window) => [window.windowId, window.frame]),
    );

    expect(diffWindowGeometries(desired, observed)).toEqual([]);
    expect(diffWindowGeometries(desired, observed)).toEqual([]);
  });

  it("ignores windows that disappeared before reconciliation", () => {
    expect(diffWindowGeometries(desired, new Map())).toEqual([]);
  });

  it("ignores insignificant floating-point conversion noise", () => {
    const observed = new Map([
      [firstWindow, { height: 800, width: 600, x: 16 + Number.EPSILON, y: 16 }],
    ]);

    expect(diffWindowGeometries(desired.slice(0, 1), observed)).toEqual([]);
  });
});
