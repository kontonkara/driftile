export const APPLICATION_TILING_EXCLUSION_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  entries: 128,
  identifierBytes: 255,
  rawEntryCharacters: 512,
});

export interface ApplicationTilingExclusions {
  readonly canonicalEntries: readonly string[];
  excludes(desktopFileName: string): boolean;
}

export const EMPTY_APPLICATION_TILING_EXCLUSIONS =
  decodeApplicationTilingExclusions("") as ApplicationTilingExclusions;

export function decodeApplicationTilingExclusions(
  value: unknown,
): ApplicationTilingExclusions | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_TILING_EXCLUSION_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const identifiers: string[] = [];
  const excludedIdentifiers = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.trim().length === 0) {
      continue;
    }

    if (identifiers.length >= APPLICATION_TILING_EXCLUSION_LIMITS.entries) {
      return null;
    }

    const identifier = parseIdentifier(candidate);

    if (!identifier || excludedIdentifiers.has(identifier)) {
      return null;
    }

    identifiers.push(identifier);
    excludedIdentifiers.add(identifier);
  }

  identifiers.sort(compareIdentifiers);
  const canonicalEntries = Object.freeze(identifiers);

  return Object.freeze({
    canonicalEntries,
    excludes: (desktopFileName: string): boolean =>
      excludedIdentifiers.has(desktopFileName),
  });
}

export function sameApplicationTilingExclusions(
  left: ApplicationTilingExclusions,
  right: ApplicationTilingExclusions,
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

function parseIdentifier(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_TILING_EXCLUSION_LIMITS.rawEntryCharacters
  ) {
    return null;
  }

  const identifier = value.trim();
  const identifierBytes = utf8ByteLength(identifier);

  if (
    identifier.length === 0 ||
    identifierBytes === null ||
    identifierBytes > APPLICATION_TILING_EXCLUSION_LIMITS.identifierBytes ||
    hasControlCharacter(identifier)
  ) {
    return null;
  }

  return identifier;
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

      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
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

function compareIdentifiers(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}
