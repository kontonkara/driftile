import { describe, expect, it } from "vitest";

import {
  APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS,
  decodeApplicationColumnWidthOverrides,
  sameApplicationColumnWidthOverrides,
} from "../src/application-overrides";

function decoded(value: unknown) {
  const result = decodeApplicationColumnWidthOverrides(value);

  if (!result) {
    throw new Error("application override fixture is invalid");
  }

  return result;
}

function document(entries: readonly string[]): string {
  return entries.join("\n");
}

describe("application column-width override codec", () => {
  it("normalizes entries into deterministic immutable lookup state", () => {
    const input = document([" org.mozilla.firefox = 60 ", "org.kde.kcalc=100"]);
    const overrides = decoded(input);

    expect(overrides.canonicalEntries).toEqual([
      "org.kde.kcalc=100",
      "org.mozilla.firefox=60",
    ]);
    expect(overrides.columnWidthPercentFor("org.mozilla.firefox")).toBe(60);
    expect(overrides.columnWidthPercentFor("org.kde.kcalc")).toBe(100);
    expect(overrides.columnWidthPercentFor("org.kde.KCalc")).toBeUndefined();
    expect(overrides.columnWidthPercentFor(" org.kde.kcalc ")).toBeUndefined();
    expect(overrides.columnWidthPercentFor("missing")).toBeUndefined();
    expect(Object.isFrozen(overrides)).toBe(true);
    expect(Object.isFrozen(overrides.canonicalEntries)).toBe(true);
    expect(input).toBe(" org.mozilla.firefox = 60 \norg.kde.kcalc=100");
  });

  it("accepts empty input and inclusive percent bounds", () => {
    const empty = decoded("");
    const bounded = decoded(document(["minimum=10", "maximum=100"]));

    expect(empty.canonicalEntries).toEqual([]);
    expect(empty.columnWidthPercentFor("anything")).toBeUndefined();
    expect(bounded.columnWidthPercentFor("minimum")).toBe(10);
    expect(bounded.columnWidthPercentFor("maximum")).toBe(100);
  });

  it("ignores blank editor lines without weakening entry validation", () => {
    const overrides = decoded("\n  \n application=50 \n\t\n");

    expect(overrides.canonicalEntries).toEqual(["application=50"]);
  });

  it("compares normalized semantics rather than input order and spacing", () => {
    const first = decoded(document(["zeta=75", " alpha = 25 "]));
    const second = decoded(document(["alpha=25", "zeta = 75"]));
    const changed = decoded(document(["alpha=25", "zeta=76"]));

    expect(sameApplicationColumnWidthOverrides(first, first)).toBe(true);
    expect(sameApplicationColumnWidthOverrides(first, second)).toBe(true);
    expect(sameApplicationColumnWidthOverrides(first, changed)).toBe(false);
  });

  it.each([
    ["null", null],
    ["an object", {}],
    ["an array", ["application=50"]],
    ["a number", 50],
  ])("rejects %s instead of a configuration string", (_name, value) => {
    expect(decodeApplicationColumnWidthOverrides(value)).toBeNull();
  });

  it("enforces the entry count bound", () => {
    const maximum = Array.from(
      { length: APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.entries },
      (_, index) => `application-${String(index)}=50`,
    );

    expect(
      decodeApplicationColumnWidthOverrides(document(maximum)),
    ).not.toBeNull();
    expect(
      decodeApplicationColumnWidthOverrides(
        document([...maximum, "one-entry-too-many=50"]),
      ),
    ).toBeNull();
  });

  it("enforces raw-entry and identifier byte bounds", () => {
    const maximumIdentifier = "a".repeat(
      APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.identifierBytes,
    );
    const maximumRaw = `${maximumIdentifier}=${" ".repeat(253)}100`;

    expect(maximumRaw).toHaveLength(
      APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.rawEntryCharacters,
    );
    expect(decodeApplicationColumnWidthOverrides(maximumRaw)).not.toBeNull();
    expect(decodeApplicationColumnWidthOverrides(`${maximumRaw} `)).toBeNull();
    expect(
      decodeApplicationColumnWidthOverrides(`${maximumIdentifier}a=50`),
    ).toBeNull();
  });

  it("counts non-ASCII identifiers as UTF-8", () => {
    const maximumIdentifier = "é".repeat(127);

    expect(
      decodeApplicationColumnWidthOverrides(`${maximumIdentifier}=50`),
    ).not.toBeNull();
    expect(
      decodeApplicationColumnWidthOverrides(`${maximumIdentifier}é=50`),
    ).toBeNull();
  });

  it("rejects an oversized configuration before splitting it", () => {
    expect(
      decodeApplicationColumnWidthOverrides(
        " ".repeat(
          APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.documentCharacters + 1,
        ),
      ),
    ).toBeNull();
  });

  it.each(["", "   ", "line\nbreak", "delete\u007fkey", "c1\u0085key"])(
    "rejects an invalid application identifier: %j",
    (identifier) => {
      expect(
        decodeApplicationColumnWidthOverrides(`${identifier}=50`),
      ).toBeNull();
    },
  );

  it.each(["missing-separator", "application=50=60", "application==50", "=50"])(
    "rejects an invalid separator layout: %j",
    (entry) => {
      expect(decodeApplicationColumnWidthOverrides(entry)).toBeNull();
    },
  );

  it.each([
    "application=9",
    "application=101",
    "application=+10",
    "application=010",
    "application=10.0",
    "application=1e2",
    "application=10px",
    "application=",
  ])("rejects a non-canonical percent: %j", (entry) => {
    expect(decodeApplicationColumnWidthOverrides(entry)).toBeNull();
  });

  it("rejects duplicate normalized identifiers atomically", () => {
    expect(
      decodeApplicationColumnWidthOverrides(
        document(["org.kde.kcalc=40", " org.kde.kcalc = 60"]),
      ),
    ).toBeNull();
  });
});
