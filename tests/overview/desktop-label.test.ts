import { describe, expect, it } from "vitest";
import { planOverviewDesktopLabel } from "../../src/overview/runtime";

describe("planOverviewDesktopLabel", () => {
  it("returns one immutable label for a public desktop name", () => {
    const result = planOverviewDesktopLabel({ name: "Development" });

    expect(result).toEqual({ label: "Development" });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("collapses whitespace and removes control and line separators", () => {
    expect(
      planOverviewDesktopLabel({
        name: "  Main\t\u0000  \u00a0 Work\u2028\u2029 Space  ",
      }),
    ).toEqual({ label: "Main Work Space" });
  });

  it("caps labels by Unicode code points without splitting surrogates", () => {
    const result = planOverviewDesktopLabel({
      name: `${"a".repeat(63)}😀ignored`,
    });

    expect(result).toEqual({ label: `${"a".repeat(63)}😀` });
    expect(Array.from(result?.label ?? "")).toHaveLength(64);
  });

  it("bounds scanning before an unusable prefix can hide unbounded work", () => {
    expect(
      planOverviewDesktopLabel({
        name: `${"\u0000".repeat(256)}Development`,
      }),
    ).toBeNull();
  });

  it.each([
    null,
    [],
    {},
    { name: undefined },
    { name: 42 },
    { name: "  \t\u0000\u007f\u0080\u2028\u2029  " },
  ])("fails closed for malformed or unusable desktop data (%o)", (desktop) => {
    expect(planOverviewDesktopLabel(desktop)).toBeNull();
  });

  it("fails closed for a hostile desktop name accessor", () => {
    const desktop = Object.defineProperty({}, "name", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewDesktopLabel(desktop)).toBeNull();
  });
});
