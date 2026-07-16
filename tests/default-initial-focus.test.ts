import { describe, expect, it } from "vitest";

import {
  decodeDefaultInitialFocus,
  DEFAULT_INITIAL_FOCUS,
  DEFAULT_INITIAL_FOCUS_LIMITS,
} from "../src/default-initial-focus";

describe("default initial-focus policy", () => {
  it.each([
    ["default", DEFAULT_INITIAL_FOCUS],
    [" focused ", "focused"],
    ["   unfocused", "unfocused"],
  ] as const)("decodes %j into the canonical policy", (input, expected) => {
    expect(decodeDefaultInitialFocus(input)).toBe(expected);
  });

  it("preserves ordinary window-manager behavior by default", () => {
    expect(DEFAULT_INITIAL_FOCUS).toBe("default");
    expect(decodeDefaultInitialFocus(DEFAULT_INITIAL_FOCUS)).toBe(
      DEFAULT_INITIAL_FOCUS,
    );
  });

  it.each([
    null,
    undefined,
    {},
    [],
    0,
    true,
    "",
    "   ",
    "focus",
    "unfocus",
    "DEFAULT",
    "defaulted",
    "focused window",
    "\tdefault",
    "focused\n",
    "unfocused\r",
    "default\u0000",
    "default\u007f",
    "default\u0085",
    "default\u2028",
    "default\u2029",
  ])("rejects invalid input atomically: %j", (value) => {
    expect(decodeDefaultInitialFocus(value)).toBeNull();
  });

  it("bounds the raw encoded value before normalization", () => {
    const maximumPaddedValue = `${" ".repeat(7)}unfocused`;
    const overlongPaddedValue = ` ${maximumPaddedValue}`;

    expect(maximumPaddedValue).toHaveLength(
      DEFAULT_INITIAL_FOCUS_LIMITS.encodedCharacters,
    );
    expect(decodeDefaultInitialFocus(maximumPaddedValue)).toBe("unfocused");
    expect(overlongPaddedValue).toHaveLength(
      DEFAULT_INITIAL_FOCUS_LIMITS.encodedCharacters + 1,
    );
    expect(decodeDefaultInitialFocus(overlongPaddedValue)).toBeNull();
  });
});
