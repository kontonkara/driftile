import { describe, expect, it } from "vitest";

import {
  APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS,
  decodeApplicationWindowHeightOverrides,
  sameApplicationWindowHeightOverrides,
} from "../src/application-window-heights";

function decoded(value: unknown) {
  const result = decodeApplicationWindowHeightOverrides(value);

  if (!result) {
    throw new Error("application window-height fixture is invalid");
  }

  return result;
}

describe("application window-height override codec", () => {
  it("normalizes immutable exact application policies", () => {
    const input = " org.mozilla.firefox = 60% \norg.kde.kcalc=480px";
    const overrides = decoded(input);

    expect(overrides.canonicalEntries).toEqual([
      "org.kde.kcalc=480px",
      "org.mozilla.firefox=60",
    ]);
    expect(overrides.windowHeightFor("org.mozilla.firefox")).toEqual({
      index: 160,
      kind: "preset",
    });
    expect(overrides.windowHeightFor("org.kde.kcalc")).toEqual({
      clientHeight: 480,
      kind: "fixed",
    });
    expect(overrides.windowHeightFor("org.kde.KCalc")).toBeUndefined();
    expect(overrides.windowHeightFor(" org.kde.kcalc ")).toBeUndefined();
    expect(Object.isFrozen(overrides.windowHeightFor("org.kde.kcalc"))).toBe(
      true,
    );
    expect(Object.isFrozen(overrides.canonicalEntries)).toBe(true);
    expect(Object.isFrozen(overrides)).toBe(true);
    expect(input).toBe(" org.mozilla.firefox = 60% \norg.kde.kcalc=480px");
  });

  it("accepts empty input and inclusive bounds", () => {
    const empty = decoded("");
    const bounded = decoded(
      [
        "minimum-percent=10%",
        "maximum-percent=100",
        "minimum-fixed=1px",
        "maximum-fixed=16384px",
      ].join("\n"),
    );

    expect(empty.canonicalEntries).toEqual([]);
    expect(empty.windowHeightFor("anything")).toBeUndefined();
    expect(bounded.windowHeightFor("minimum-percent")).toEqual({
      index: 110,
      kind: "preset",
    });
    expect(bounded.windowHeightFor("maximum-percent")).toEqual({
      index: 200,
      kind: "preset",
    });
    expect(bounded.windowHeightFor("minimum-fixed")).toEqual({
      clientHeight: 1,
      kind: "fixed",
    });
    expect(bounded.windowHeightFor("maximum-fixed")).toEqual({
      clientHeight: 16_384,
      kind: "fixed",
    });
  });

  it("compares canonical semantics", () => {
    const first = decoded("zeta=750px\n alpha = 25% ");
    const equivalent = decoded("alpha=25\nzeta = 750px");
    const changed = decoded("alpha=25\nzeta=751px");

    expect(sameApplicationWindowHeightOverrides(first, equivalent)).toBe(true);
    expect(sameApplicationWindowHeightOverrides(first, changed)).toBe(false);
  });

  it("enforces document, entry, raw-entry, and identifier bounds", () => {
    const entries = Array.from(
      { length: APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.entries },
      (_, index) => `application-${String(index)}=50`,
    );
    const identifier = "a".repeat(
      APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.identifierBytes,
    );
    const raw = `${identifier}=${" ".repeat(253)}100`;

    expect(
      decodeApplicationWindowHeightOverrides(entries.join("\n")),
    ).not.toBeNull();
    expect(
      decodeApplicationWindowHeightOverrides(
        [...entries, "one-too-many=50"].join("\n"),
      ),
    ).toBeNull();
    expect(raw).toHaveLength(
      APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.rawEntryCharacters,
    );
    expect(decodeApplicationWindowHeightOverrides(raw)).not.toBeNull();
    expect(decodeApplicationWindowHeightOverrides(`${raw} `)).toBeNull();
    expect(
      decodeApplicationWindowHeightOverrides(`${identifier}a=50`),
    ).toBeNull();
    expect(
      decodeApplicationWindowHeightOverrides(
        " ".repeat(
          APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.documentCharacters + 1,
        ),
      ),
    ).toBeNull();
  });

  it.each([
    "missing-separator",
    "application=50=60",
    "=50",
    "application=9",
    "application=101",
    "application=010",
    "application=10.0",
    "application=10 %",
    "application=0px",
    "application=16385px",
    "application=01px",
    "application=1PX",
    "line\nbreak=50",
    "delete\u007fkey=50",
  ])("rejects an invalid entry: %j", (entry) => {
    expect(decodeApplicationWindowHeightOverrides(entry)).toBeNull();
  });

  it("rejects duplicate exact identifiers atomically", () => {
    expect(
      decodeApplicationWindowHeightOverrides(
        "org.kde.kcalc=40\n org.kde.kcalc = 60",
      ),
    ).toBeNull();
  });
});
