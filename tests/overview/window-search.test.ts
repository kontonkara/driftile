import { describe, expect, it } from "vitest";
import {
  appendOverviewSearchText,
  matchesOverviewWindowSearch,
  removeLastOverviewSearchCharacter,
} from "../../src/overview/runtime";

describe("overview window search text editing", () => {
  it("appends text while preserving ordinary whitespace", () => {
    expect(appendOverviewSearchText("Konsole ", " window  ")).toBe(
      "Konsole  window  ",
    );
  });

  it("ignores non-string input and C0, C1, and DEL controls", () => {
    expect(
      appendOverviewSearchText(42, "a\u0000b\u001fc\u007fd\u0080e\u009ff"),
    ).toBe("abcdef");
    expect(appendOverviewSearchText("\u0000".repeat(128), "x")).toBe("x");
    expect(appendOverviewSearchText("query", null)).toBe("query");
  });

  it("caps the query by Unicode code points without splitting surrogates", () => {
    const prefix = "a".repeat(127);

    expect(appendOverviewSearchText(prefix, "😀ignored")).toBe(`${prefix}😀`);
    expect(
      Array.from(appendOverviewSearchText("😀".repeat(200), "x")),
    ).toHaveLength(128);
  });

  it("removes exactly one Unicode code point", () => {
    expect(removeLastOverviewSearchCharacter("a😀")).toBe("a");
    expect(removeLastOverviewSearchCharacter("😀")).toBe("");
    expect(removeLastOverviewSearchCharacter(42)).toBe("");
  });
});

describe("matchesOverviewWindowSearch", () => {
  it("matches collapsed case-insensitive AND terms across supported fields", () => {
    expect(
      matchesOverviewWindowSearch("  FIREfox   nightly ", {
        caption: "Mozilla Firefox",
        desktopFileName: "firefox-nightly.desktop",
        resourceClass: "Navigator",
        resourceName: "firefox",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("firefox missing", {
        caption: "Mozilla Firefox",
      }),
    ).toBe(false);
  });

  it("treats empty, whitespace-only, and non-string queries as unfiltered", () => {
    expect(matchesOverviewWindowSearch("", null)).toBe(true);
    expect(matchesOverviewWindowSearch("   \u00a0 ", null)).toBe(true);
    expect(matchesOverviewWindowSearch(undefined, null)).toBe(true);
  });

  it("uses no more than eight search terms", () => {
    const fields = { caption: "one two three four five six seven eight" };

    expect(
      matchesOverviewWindowSearch(
        "one two three four five six seven eight absent",
        fields,
      ),
    ).toBe(true);
  });

  it("scans each supported field through 512 Unicode code points", () => {
    expect(
      matchesOverviewWindowSearch("needle", {
        caption: `${"😀".repeat(511)}needle`,
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("x", {
        resourceClass: `${"😀".repeat(511)}xignored`,
      }),
    ).toBe(true);
  });

  it("does not match unsupported fields or across field boundaries", () => {
    expect(matchesOverviewWindowSearch("needle", { title: "needle" })).toBe(
      false,
    );
    expect(
      matchesOverviewWindowSearch("foobar", {
        caption: "foo",
        resourceName: "bar",
      }),
    ).toBe(false);
  });

  it("fails closed for malformed fields and throwing accessors", () => {
    expect(matchesOverviewWindowSearch("query", null)).toBe(false);
    expect(matchesOverviewWindowSearch("query", [])).toBe(false);
    expect(
      matchesOverviewWindowSearch("query", {
        caption: 42,
        resourceName: "query",
      }),
    ).toBe(false);

    const hostile = Object.defineProperty({}, "caption", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    expect(matchesOverviewWindowSearch("query", hostile)).toBe(false);
  });

  it("does not inspect fields when the query is empty", () => {
    const hostile = Object.defineProperty({}, "caption", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(matchesOverviewWindowSearch("  ", hostile)).toBe(true);
  });
});
