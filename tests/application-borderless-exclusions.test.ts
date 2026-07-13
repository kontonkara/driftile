import { describe, expect, it } from "vitest";

import {
  APPLICATION_BORDERLESS_EXCLUSION_LIMITS,
  decodeApplicationBorderlessExclusions,
  EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  sameApplicationBorderlessExclusions,
} from "../src/application-borderless-exclusions";

function decoded(value: unknown) {
  const result = decodeApplicationBorderlessExclusions(value);

  if (!result) {
    throw new Error("application borderless exclusion fixture is invalid");
  }

  return result;
}

describe("application borderless exclusion codec", () => {
  it("normalizes entries into immutable exact-match lookup state", () => {
    const exclusions = decoded(
      " org.mozilla.firefox \n\norg.kde.kcalc\norg.example.Editor=tool",
    );

    expect(exclusions.canonicalEntries).toEqual([
      "org.example.Editor=tool",
      "org.kde.kcalc",
      "org.mozilla.firefox",
    ]);
    expect(exclusions.excludes("org.mozilla.firefox")).toBe(true);
    expect(exclusions.excludes("org.mozilla.Firefox")).toBe(false);
    expect(exclusions.excludes(" org.mozilla.firefox ")).toBe(false);
    expect(Object.isFrozen(exclusions)).toBe(true);
    expect(Object.isFrozen(exclusions.canonicalEntries)).toBe(true);
  });

  it("provides an immutable empty default and ignores blank lines", () => {
    const exclusions = decoded("\n \n\t\n org.example.Editor \n");

    expect(EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS.canonicalEntries).toEqual(
      [],
    );
    expect(EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS.excludes("anything")).toBe(
      false,
    );
    expect(Object.isFrozen(EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS)).toBe(true);
    expect(exclusions.canonicalEntries).toEqual(["org.example.Editor"]);
  });

  it("compares canonical semantics instead of source order and spacing", () => {
    const first = decoded("zeta\n alpha ");
    const equivalent = decoded("alpha\nzeta");
    const changed = decoded("alpha\nomega");

    expect(sameApplicationBorderlessExclusions(first, first)).toBe(true);
    expect(sameApplicationBorderlessExclusions(first, equivalent)).toBe(true);
    expect(sameApplicationBorderlessExclusions(first, changed)).toBe(false);
  });

  it("exposes the shared exact identifier bounds", () => {
    expect(APPLICATION_BORDERLESS_EXCLUSION_LIMITS).toEqual({
      documentCharacters: 65_664,
      entries: 128,
      identifierBytes: 255,
      rawEntryCharacters: 512,
    });
    expect(Object.isFrozen(APPLICATION_BORDERLESS_EXCLUSION_LIMITS)).toBe(true);
  });

  it.each([
    ["a non-string document", {}],
    ["a duplicate identifier", "org.example.Editor\n org.example.Editor "],
    ["a control character", "org.example.\u0085Editor"],
    ["invalid UTF-16", "org.example.\ud800Editor"],
    ["an oversized identifier", "a".repeat(256)],
    ["an oversized raw line", `${"a".repeat(255)}${" ".repeat(258)}`],
    ["an oversized blank line", " ".repeat(513)],
    [
      "an oversized document",
      " ".repeat(
        APPLICATION_BORDERLESS_EXCLUSION_LIMITS.documentCharacters + 1,
      ),
    ],
  ])("rejects %s atomically", (_description, value) => {
    expect(decodeApplicationBorderlessExclusions(value)).toBeNull();
  });
});
