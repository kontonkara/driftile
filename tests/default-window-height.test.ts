import { describe, expect, it } from "vitest";

import {
  AUTOMATIC_DEFAULT_WINDOW_HEIGHT,
  decodeDefaultWindowHeight,
  DEFAULT_WINDOW_HEIGHT_LIMITS,
  sameDefaultWindowHeights,
} from "../src/default-window-height";

function decoded(value: unknown) {
  const result = decodeDefaultWindowHeight(value);

  if (!result) {
    throw new Error("default window-height fixture is invalid");
  }

  return result;
}

describe("default window-height codec", () => {
  it("normalizes automatic, proportional, and fixed policies immutably", () => {
    const automatic = decoded(" auto ");
    const proportional = decoded(" 60% ");
    const fixed = decoded(" 480px ");

    expect(automatic).toBe(AUTOMATIC_DEFAULT_WINDOW_HEIGHT);
    expect(automatic).toEqual({ canonicalValue: "auto", windowHeight: null });
    expect(proportional).toEqual({
      canonicalValue: "60",
      windowHeight: { index: 160, kind: "preset" },
    });
    expect(fixed).toEqual({
      canonicalValue: "480px",
      windowHeight: { clientHeight: 480, kind: "fixed" },
    });
    expect(Object.isFrozen(automatic)).toBe(true);
    expect(Object.isFrozen(proportional)).toBe(true);
    expect(Object.isFrozen(proportional.windowHeight)).toBe(true);
    expect(Object.isFrozen(fixed.windowHeight)).toBe(true);
  });

  it("accepts inclusive proportional and fixed bounds", () => {
    expect(decoded("10")).toMatchObject({
      canonicalValue: "10",
      windowHeight: { index: 110, kind: "preset" },
    });
    expect(decoded("100%")).toMatchObject({
      canonicalValue: "100",
      windowHeight: { index: 200, kind: "preset" },
    });
    expect(decoded("1px")).toMatchObject({
      canonicalValue: "1px",
      windowHeight: { clientHeight: 1, kind: "fixed" },
    });
    expect(decoded("16384px")).toMatchObject({
      canonicalValue: "16384px",
      windowHeight: { clientHeight: 16_384, kind: "fixed" },
    });
  });

  it("compares canonical semantics", () => {
    const percent = decoded("60%");
    const bare = decoded("60");

    expect(sameDefaultWindowHeights(percent, bare)).toBe(true);
    expect(sameDefaultWindowHeights(percent, decoded("61"))).toBe(false);
  });

  it.each([
    null,
    {},
    [],
    60,
    "",
    "AUTO",
    "9",
    "101",
    "+10",
    "010",
    "10.0",
    "10 %",
    "0px",
    "16385px",
    "01px",
    "1.0px",
    "1PX",
    "auto\n",
  ])("rejects a non-canonical value: %j", (value) => {
    expect(decodeDefaultWindowHeight(value)).toBeNull();
  });

  it("rejects oversized input before normalization", () => {
    expect(
      decodeDefaultWindowHeight(
        " ".repeat(DEFAULT_WINDOW_HEIGHT_LIMITS.encodedCharacters + 1),
      ),
    ).toBeNull();
  });
});
