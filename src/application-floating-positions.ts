export const APPLICATION_FLOATING_POSITION_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  entries: 128,
  identifierBytes: 255,
  maximumOffset: 16_384,
  minimumOffset: -16_384,
  rawEntryCharacters: 512,
});

export type ApplicationFloatingPositionAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export interface ApplicationFloatingPosition {
  readonly anchor: ApplicationFloatingPositionAnchor;
  readonly x: number;
  readonly y: number;
}

export interface ApplicationFloatingPositions {
  readonly canonicalEntries: readonly string[];
  floatingPositionFor(
    desktopFileName: string,
  ): ApplicationFloatingPosition | undefined;
}

interface ParsedFloatingPosition {
  readonly desktopFileName: string;
  readonly position: ApplicationFloatingPosition;
}

const canonicalInteger = /^(?:0|-?[1-9][0-9]{0,4})$/u;

export const EMPTY_APPLICATION_FLOATING_POSITIONS =
  decodeApplicationFloatingPositions("") as ApplicationFloatingPositions;

export function decodeApplicationFloatingPositions(
  value: unknown,
): ApplicationFloatingPositions | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_FLOATING_POSITION_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedPositions: ParsedFloatingPosition[] = [];
  const positions = new Map<string, ApplicationFloatingPosition>();

  for (const candidate of candidates) {
    if (
      candidate.length > APPLICATION_FLOATING_POSITION_LIMITS.rawEntryCharacters
    ) {
      return null;
    }

    if (candidate.trim().length === 0) {
      continue;
    }

    if (
      parsedPositions.length >= APPLICATION_FLOATING_POSITION_LIMITS.entries
    ) {
      return null;
    }

    const parsed = parseFloatingPosition(candidate);

    if (!parsed || positions.has(parsed.desktopFileName)) {
      return null;
    }

    parsedPositions.push(parsed);
    positions.set(parsed.desktopFileName, parsed.position);
  }

  parsedPositions.sort(compareFloatingPositions);
  const canonicalEntries = Object.freeze(
    parsedPositions.map(({ desktopFileName, position }) =>
      encodeFloatingPosition(desktopFileName, position),
    ),
  );

  return Object.freeze({
    canonicalEntries,
    floatingPositionFor: (
      desktopFileName: string,
    ): ApplicationFloatingPosition | undefined =>
      positions.get(desktopFileName),
  });
}

export function sameApplicationFloatingPositions(
  left: ApplicationFloatingPositions,
  right: ApplicationFloatingPositions,
): boolean {
  if (left === right) {
    return true;
  }

  const leftEntries = left.canonicalEntries;
  const rightEntries = right.canonicalEntries;

  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every((entry, index) => entry === rightEntries[index])
  );
}

function parseFloatingPosition(value: string): ParsedFloatingPosition | null {
  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedPosition = value.slice(separator + 1).trim();
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes > APPLICATION_FLOATING_POSITION_LIMITS.identifierBytes ||
    hasControlCharacter(desktopFileName)
  ) {
    return null;
  }

  const fields = encodedPosition.split(",");
  const anchor = fields[0];
  const encodedX = fields[1];
  const encodedY = fields[2];

  if (
    fields.length !== 3 ||
    !isFloatingPositionAnchor(anchor) ||
    encodedX === undefined ||
    encodedY === undefined
  ) {
    return null;
  }

  const x = decodeOffset(encodedX);
  const y = decodeOffset(encodedY);

  if (x === null || y === null) {
    return null;
  }

  return {
    desktopFileName,
    position: Object.freeze({ anchor, x, y }),
  };
}

function decodeOffset(value: string): number | null {
  if (!canonicalInteger.test(value)) {
    return null;
  }

  const offset = Number(value);

  return offset >= APPLICATION_FLOATING_POSITION_LIMITS.minimumOffset &&
    offset <= APPLICATION_FLOATING_POSITION_LIMITS.maximumOffset
    ? offset
    : null;
}

function isFloatingPositionAnchor(
  value: string | undefined,
): value is ApplicationFloatingPositionAnchor {
  return (
    value === "top-left" ||
    value === "top" ||
    value === "top-right" ||
    value === "right" ||
    value === "bottom-right" ||
    value === "bottom" ||
    value === "bottom-left" ||
    value === "left"
  );
}

function encodeFloatingPosition(
  desktopFileName: string,
  position: ApplicationFloatingPosition,
): string {
  return `${desktopFileName}=${position.anchor},${String(position.x)},${String(position.y)}`;
}

function utf8ByteLength(value: string): number | null {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);

      if (trailing < 0xdc00 || trailing > 0xdfff) {
        return null;
      }

      bytes += 4;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return null;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || (code >= 127 && code <= 159)) {
      return true;
    }
  }

  return false;
}

function compareFloatingPositions(
  left: ParsedFloatingPosition,
  right: ParsedFloatingPosition,
): number {
  if (left.desktopFileName < right.desktopFileName) {
    return -1;
  }

  return left.desktopFileName > right.desktopFileName ? 1 : 0;
}
