import { describe, expect, it } from "vitest";

import {
  APPLICATION_TILING_EXCLUSION_LIMITS,
  decodeApplicationTilingExclusions,
  EMPTY_APPLICATION_TILING_EXCLUSIONS,
  sameApplicationTilingExclusions,
} from "../src/application-tiling-exclusions";

function decoded(value: unknown) {
  const result = decodeApplicationTilingExclusions(value);

  if (!result) {
    throw new Error("application tiling exclusion fixture is invalid");
  }

  return result;
}

function document(entries: readonly string[]): string {
  return entries.join("\n");
}

describe("application tiling exclusion codec", () => {
  it("normalizes entries into deterministic immutable lookup state", () => {
    const input = document([
      " org.mozilla.firefox ",
      "org.example.Editor=tool",
      "org.kde.kcalc",
    ]);
    const exclusions = decoded(input);

    expect(exclusions.canonicalEntries).toEqual([
      "org.example.Editor=tool",
      "org.kde.kcalc",
      "org.mozilla.firefox",
    ]);
    expect(exclusions.excludes("org.mozilla.firefox")).toBe(true);
    expect(exclusions.excludes("org.example.Editor=tool")).toBe(true);
    expect(exclusions.excludes("org.mozilla.Firefox")).toBe(false);
    expect(exclusions.excludes(" org.mozilla.firefox ")).toBe(false);
    expect(exclusions.excludes("missing")).toBe(false);
    expect(Object.isFrozen(exclusions)).toBe(true);
    expect(Object.isFrozen(exclusions.canonicalEntries)).toBe(true);
    expect(input).toBe(
      " org.mozilla.firefox \norg.example.Editor=tool\norg.kde.kcalc",
    );
  });

  it("accepts empty input and ignores blank editor lines", () => {
    const exclusions = decoded("\n  \n org.example.Editor \n\t\n");

    expect(EMPTY_APPLICATION_TILING_EXCLUSIONS.canonicalEntries).toEqual([]);
    expect(EMPTY_APPLICATION_TILING_EXCLUSIONS.excludes("anything")).toBe(
      false,
    );
    expect(exclusions.canonicalEntries).toEqual(["org.example.Editor"]);
  });

  it("compares normalized semantics instead of input order and spacing", () => {
    const first = decoded(document(["zeta", " alpha "]));
    const second = decoded(document(["alpha", "zeta"]));
    const changed = decoded(document(["alpha", "omega"]));

    expect(sameApplicationTilingExclusions(first, first)).toBe(true);
    expect(sameApplicationTilingExclusions(first, second)).toBe(true);
    expect(sameApplicationTilingExclusions(first, changed)).toBe(false);
  });

  it.each([
    ["null", null],
    ["an object", {}],
    ["an array", ["org.example.Editor"]],
    ["a number", 1],
  ])("rejects %s instead of a configuration string", (_name, value) => {
    expect(decodeApplicationTilingExclusions(value)).toBeNull();
  });

  it("enforces the entry count bound", () => {
    const maximum = Array.from(
      { length: APPLICATION_TILING_EXCLUSION_LIMITS.entries },
      (_, index) => `application-${String(index)}`,
    );

    expect(decodeApplicationTilingExclusions(document(maximum))).not.toBeNull();
    expect(
      decodeApplicationTilingExclusions(
        document([...maximum, "one-entry-too-many"]),
      ),
    ).toBeNull();
  });

  it("enforces raw-entry and identifier byte bounds", () => {
    const maximumIdentifier = "a".repeat(
      APPLICATION_TILING_EXCLUSION_LIMITS.identifierBytes,
    );
    const maximumRaw = `${maximumIdentifier}${" ".repeat(257)}`;

    expect(maximumRaw).toHaveLength(
      APPLICATION_TILING_EXCLUSION_LIMITS.rawEntryCharacters,
    );
    expect(decodeApplicationTilingExclusions(maximumRaw)).not.toBeNull();
    expect(decodeApplicationTilingExclusions(`${maximumRaw} `)).toBeNull();
    expect(decodeApplicationTilingExclusions(" ".repeat(513))).toBeNull();
    expect(
      decodeApplicationTilingExclusions(`${maximumIdentifier}a`),
    ).toBeNull();
  });

  it("counts non-ASCII identifiers as UTF-8", () => {
    const maximumIdentifier = "é".repeat(127);

    expect(decodeApplicationTilingExclusions(maximumIdentifier)).not.toBeNull();
    expect(
      decodeApplicationTilingExclusions(`${maximumIdentifier}é`),
    ).toBeNull();
  });

  it("rejects invalid UTF-16 input", () => {
    expect(decodeApplicationTilingExclusions("invalid\ud800")).toBeNull();
    expect(decodeApplicationTilingExclusions("invalid\udc00")).toBeNull();
  });

  it("rejects an oversized configuration before splitting it", () => {
    expect(
      decodeApplicationTilingExclusions(
        " ".repeat(APPLICATION_TILING_EXCLUSION_LIMITS.documentCharacters + 1),
      ),
    ).toBeNull();
  });

  it.each(["delete\u007fkey", "c1\u0085key", "embedded\ttab"])(
    "rejects an identifier containing control characters: %j",
    (identifier) => {
      expect(decodeApplicationTilingExclusions(identifier)).toBeNull();
    },
  );

  it("rejects duplicate normalized identifiers atomically", () => {
    expect(
      decodeApplicationTilingExclusions(
        document(["org.kde.kcalc", " org.kde.kcalc "]),
      ),
    ).toBeNull();
  });
});
