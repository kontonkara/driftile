export type DefaultInitialFocus = "default" | "focused" | "unfocused";

export const DEFAULT_INITIAL_FOCUS_LIMITS = Object.freeze({
  encodedCharacters: 16,
});

export const DEFAULT_INITIAL_FOCUS: DefaultInitialFocus = "default";

export function decodeDefaultInitialFocus(
  value: unknown,
): DefaultInitialFocus | null {
  if (
    typeof value !== "string" ||
    value.length > DEFAULT_INITIAL_FOCUS_LIMITS.encodedCharacters ||
    containsControlCharacter(value)
  ) {
    return null;
  }

  switch (value.trim()) {
    case DEFAULT_INITIAL_FOCUS:
      return DEFAULT_INITIAL_FOCUS;
    case "focused":
      return "focused";
    case "unfocused":
      return "unfocused";
    default:
      return null;
  }
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return true;
    }
  }

  return false;
}
