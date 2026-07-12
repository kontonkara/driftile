export const APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  entries: 128,
  identifierBytes: 255,
  rawEntryCharacters: 512,
});

export interface ApplicationColumnWidthOverrides {
  readonly canonicalEntries: readonly string[];
  columnWidthPercentFor(desktopFileName: string): number | undefined;
}

export const EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES =
  decodeApplicationColumnWidthOverrides("") as ApplicationColumnWidthOverrides;

interface ParsedOverride {
  readonly desktopFileName: string;
  readonly percent: number;
}

const canonicalPercent = /^(?:[1-9][0-9]|100)$/u;

export function decodeApplicationColumnWidthOverrides(
  value: unknown,
): ApplicationColumnWidthOverrides | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedOverrides: ParsedOverride[] = [];
  const widths = new Map<string, number>();

  for (const candidate of candidates) {
    if (candidate.trim().length === 0) {
      continue;
    }

    if (
      parsedOverrides.length >= APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.entries
    ) {
      return null;
    }

    const parsed = parseOverride(candidate);

    if (!parsed || widths.has(parsed.desktopFileName)) {
      return null;
    }

    parsedOverrides.push(parsed);
    widths.set(parsed.desktopFileName, parsed.percent);
  }

  parsedOverrides.sort(compareOverrides);
  const canonicalEntries = Object.freeze(
    parsedOverrides.map(
      ({ desktopFileName, percent }) => `${desktopFileName}=${String(percent)}`,
    ),
  );

  return Object.freeze({
    canonicalEntries,
    columnWidthPercentFor: (desktopFileName: string): number | undefined =>
      widths.get(desktopFileName),
  });
}

export function sameApplicationColumnWidthOverrides(
  left: ApplicationColumnWidthOverrides,
  right: ApplicationColumnWidthOverrides,
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

function parseOverride(value: unknown): ParsedOverride | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.rawEntryCharacters
  ) {
    return null;
  }

  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedPercent = value.slice(separator + 1).trim();
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes >
      APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS.identifierBytes ||
    hasControlCharacter(desktopFileName) ||
    !canonicalPercent.test(encodedPercent)
  ) {
    return null;
  }

  return {
    desktopFileName,
    percent: Number(encodedPercent),
  };
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

function compareOverrides(left: ParsedOverride, right: ParsedOverride): number {
  if (left.desktopFileName < right.desktopFileName) {
    return -1;
  }

  return left.desktopFileName > right.desktopFileName ? 1 : 0;
}
