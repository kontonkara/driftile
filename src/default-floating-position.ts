import {
  decodeFloatingPositionValue,
  encodeFloatingPositionValue,
  type ApplicationFloatingPosition,
} from "./application-floating-positions";

export const DEFAULT_FLOATING_POSITION_LIMITS = Object.freeze({
  encodedCharacters: 32,
});

export interface DecodedDefaultFloatingPosition {
  readonly canonicalValue: string;
  readonly floatingPosition: ApplicationFloatingPosition | null;
}

export const DISABLED_DEFAULT_FLOATING_POSITION = Object.freeze({
  canonicalValue: "",
  floatingPosition: null,
}) satisfies DecodedDefaultFloatingPosition;

export function decodeDefaultFloatingPosition(
  value: unknown,
): DecodedDefaultFloatingPosition | null {
  if (
    typeof value !== "string" ||
    value.length > DEFAULT_FLOATING_POSITION_LIMITS.encodedCharacters ||
    /[\r\n]/u.test(value)
  ) {
    return null;
  }

  const encoded = value.trim();

  if (encoded.length === 0) {
    return DISABLED_DEFAULT_FLOATING_POSITION;
  }

  const floatingPosition = decodeFloatingPositionValue(encoded);

  return floatingPosition
    ? Object.freeze({
        canonicalValue: encodeFloatingPositionValue(floatingPosition),
        floatingPosition,
      })
    : null;
}

export function sameDefaultFloatingPositions(
  left: ApplicationFloatingPosition | null,
  right: ApplicationFloatingPosition | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.anchor === right.anchor &&
      left.x === right.x &&
      left.y === right.y)
  );
}
