import { describe, expect, it } from "vitest";
import {
  MAXIMUM_RESIDENT_ROWS,
  planOverviewDesktopSurfaceResidency,
} from "../../src/overview/desktop-surface-residency";

describe("planOverviewDesktopSurfaceResidency", () => {
  it("retains the last exact range across a valid to invalid to valid sequence", () => {
    const initial = planOverviewDesktopSurfaceResidency(
      input({ candidateRange: range(3, 5) }),
    );
    const retained = planOverviewDesktopSurfaceResidency(
      input({ candidateRange: null, previousRange: initial }),
    );
    const recovered = planOverviewDesktopSurfaceResidency(
      input({ candidateRange: range(4, 6), previousRange: retained }),
    );

    expect(initial).toEqual(range(3, 5));
    expect(retained).toEqual(range(3, 5));
    expect(recovered).toEqual(range(4, 6));
  });

  it("prepares an adjacent range by retaining the previous resident rows", () => {
    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: range(4, 7),
          previousRange: range(2, 4),
          retainPrevious: true,
        }),
      ),
    ).toEqual(range(2, 7));
  });

  it("keeps only the candidate across a far jump that exceeds the cap", () => {
    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: range(30, 32),
          previousRange: range(1, 3),
          retainPrevious: true,
          workspaceCount: 64,
        }),
      ),
    ).toEqual(range(30, 32));
  });

  it("pins the current workspace only while the resulting span stays bounded", () => {
    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: range(4, 6),
          currentWorkspaceIndex: 3,
          pinCurrent: true,
        }),
      ),
    ).toEqual(range(3, 6));

    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: range(20, 22),
          currentWorkspaceIndex: 2,
          pinCurrent: true,
          workspaceCount: 32,
        }),
      ),
    ).toEqual(range(20, 22));
  });

  it("uses the current singleton when no exact range is available", () => {
    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: null,
          currentWorkspaceIndex: 511,
          pinCurrent: true,
          previousRange: null,
          workspaceCount: 512,
        }),
      ),
    ).toEqual(range(511, 511));

    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: null,
          currentWorkspaceIndex: 511,
          pinCurrent: false,
          previousRange: null,
          workspaceCount: 512,
        }),
      ),
    ).toBeNull();
  });

  it("accepts the exact residency cap and the final workspace bound", () => {
    expect(MAXIMUM_RESIDENT_ROWS).toBe(12);
    expect(
      planOverviewDesktopSurfaceResidency(
        input({
          candidateRange: range(500, 511),
          currentWorkspaceIndex: 511,
          workspaceCount: 512,
        }),
      ),
    ).toEqual(range(500, 511));
  });

  it.each([
    null,
    [],
    {},
    input({ workspaceCount: 0 }),
    input({ workspaceCount: 513 }),
    input({ workspaceCount: 1.5 }),
    input({ candidateRange: undefined }),
    input({ candidateRange: range(-1, 1) }),
    input({ candidateRange: range(3, 2) }),
    input({ candidateRange: range(0, 12) }),
    input({ candidateRange: range(0, 8), workspaceCount: 8 }),
    input({ previousRange: range(0, 12) }),
    input({ previousRange: {} }),
    input({ currentWorkspaceIndex: -2 }),
    input({ currentWorkspaceIndex: 8, workspaceCount: 8 }),
    input({ currentWorkspaceIndex: 1.5 }),
    input({ retainPrevious: "yes" }),
    input({ pinCurrent: "yes" }),
  ])("rejects malformed or unbounded input (%o)", (candidate) => {
    expect(planOverviewDesktopSurfaceResidency(candidate)).toBeNull();
  });

  it("fails closed for hostile top-level and range accessors", () => {
    const hostileInput = Object.defineProperty({}, "workspaceCount", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    const hostileRange = Object.defineProperty({}, "firstIndex", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewDesktopSurfaceResidency(hostileInput)).toBeNull();
    expect(
      planOverviewDesktopSurfaceResidency(
        input({ candidateRange: hostileRange }),
      ),
    ).toBeNull();
  });

  it("returns a frozen snapshot without mutating either input range", () => {
    const candidateRange = range(5, 7);
    const previousRange = range(3, 5);
    const plan = planOverviewDesktopSurfaceResidency(
      input({ candidateRange, previousRange, retainPrevious: true }),
    );

    expect(plan).toEqual(range(3, 7));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(plan).not.toBe(candidateRange);
    expect(plan).not.toBe(previousRange);
    expect(candidateRange).toEqual(range(5, 7));
    expect(previousRange).toEqual(range(3, 5));
  });
});

function input(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    candidateRange: range(2, 4),
    currentWorkspaceIndex: 2,
    pinCurrent: false,
    previousRange: null,
    retainPrevious: false,
    workspaceCount: 8,
    ...overrides,
  };
}

function range(firstIndex: number, lastIndex: number) {
  return { firstIndex, lastIndex };
}
