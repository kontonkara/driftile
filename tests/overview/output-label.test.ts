import { describe, expect, it } from "vitest";
import { planOverviewOutputLabel } from "../../src/overview/runtime";

describe("planOverviewOutputLabel", () => {
  it("returns one immutable label for a public output name", () => {
    const result = planOverviewOutputLabel({ name: "DP-1" });

    expect(result).toEqual({ label: "DP-1" });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("collapses whitespace and removes control and line separators", () => {
    expect(
      planOverviewOutputLabel({
        name: "  Dell\t\u0000  \u00a0 DP-1\u2028\u2029 Main  ",
      }),
    ).toEqual({ label: "Dell DP-1 Main" });
  });

  it("caps labels by Unicode code points without splitting surrogates", () => {
    const result = planOverviewOutputLabel({
      name: `${"a".repeat(63)}😀ignored`,
    });

    expect(result).toEqual({ label: `${"a".repeat(63)}😀` });
    expect(Array.from(result?.label ?? "")).toHaveLength(64);
  });

  it("bounds scanning before an unusable prefix can hide unbounded work", () => {
    expect(
      planOverviewOutputLabel({
        name: `${"\u0000".repeat(256)}DP-1`,
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
  ])("fails closed for malformed or unusable output data (%o)", (output) => {
    expect(planOverviewOutputLabel(output)).toBeNull();
  });

  it("fails closed for a hostile output name accessor", () => {
    const output = Object.defineProperty({}, "name", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewOutputLabel(output)).toBeNull();
  });
});
