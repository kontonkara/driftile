import { describe, expect, it } from "vitest";
import { planOverviewWindowState } from "../../src/overview/runtime";

describe("planOverviewWindowState", () => {
  it("returns an empty plan for an ordinary tiled window", () => {
    expect(
      planOverviewWindowState({
        floating: false,
        fullScreen: false,
        maximizeMode: 0,
      }),
    ).toEqual({ badge: null, searchText: "" });
  });

  it.each([1, 2])(
    "does not present partial maximize mode %i as maximized",
    (maximizeMode) => {
      expect(
        planOverviewWindowState({
          floating: false,
          fullScreen: false,
          maximizeMode,
        }),
      ).toEqual({ badge: null, searchText: "" });
    },
  );

  it("uses fullscreen, maximized, and floating badge precedence", () => {
    expect(
      planOverviewWindowState({
        floating: true,
        fullScreen: false,
        maximizeMode: 0,
      }),
    ).toEqual({ badge: "Floating", searchText: "floating" });
    expect(
      planOverviewWindowState({
        floating: true,
        fullScreen: false,
        maximizeMode: 3,
      }),
    ).toEqual({
      badge: "Maximized",
      searchText: "maximized floating",
    });
    expect(
      planOverviewWindowState({
        floating: true,
        fullScreen: true,
        maximizeMode: 3,
      }),
    ).toEqual({
      badge: "Fullscreen",
      searchText: "fullscreen maximized floating",
    });
  });

  it("includes every true state in bounded lowercase search text", () => {
    const combinations = [
      {
        fields: { floating: false, fullScreen: true, maximizeMode: 0 },
        searchText: "fullscreen",
      },
      {
        fields: { floating: false, fullScreen: false, maximizeMode: 3 },
        searchText: "maximized",
      },
      {
        fields: { floating: true, fullScreen: true, maximizeMode: 0 },
        searchText: "fullscreen floating",
      },
      {
        fields: { floating: false, fullScreen: true, maximizeMode: 3 },
        searchText: "fullscreen maximized",
      },
    ] as const;

    for (const combination of combinations) {
      const result = planOverviewWindowState(combination.fields);

      expect(result?.searchText).toBe(combination.searchText);
      expect(result?.searchText).toMatch(/^[a-z]*(?: [a-z]+)*$/u);
      expect(result?.searchText.length).toBeLessThanOrEqual(29);
    }
  });

  it.each([
    null,
    [],
    {},
    { floating: false, fullScreen: false },
    { floating: false, fullScreen: false, maximizeMode: -1 },
    { floating: false, fullScreen: false, maximizeMode: 4 },
    { floating: false, fullScreen: false, maximizeMode: 1.5 },
    { floating: false, fullScreen: false, maximizeMode: Number.NaN },
    {
      floating: false,
      fullScreen: false,
      maximizeMode: Number.POSITIVE_INFINITY,
    },
    { floating: false, fullScreen: "false", maximizeMode: 0 },
    { floating: 0, fullScreen: false, maximizeMode: 0 },
  ])("fails closed for malformed state fields (%o)", (fields) => {
    expect(planOverviewWindowState(fields)).toBeNull();
  });

  it("fails closed for hostile state accessors", () => {
    for (const name of ["fullScreen", "maximizeMode", "floating"] as const) {
      const fields = Object.defineProperty(
        { floating: false, fullScreen: false, maximizeMode: 0 },
        name,
        {
          get(): never {
            throw new Error("unavailable");
          },
        },
      );

      expect(planOverviewWindowState(fields)).toBeNull();
    }
  });
});
