const MAX_QUERY_CODE_POINTS = 128;
const MAX_QUERY_SCAN_CODE_POINTS = MAX_QUERY_CODE_POINTS * 4;
const MAX_QUERY_TERMS = 8;
const MAX_SEARCH_FIELD_CODE_POINTS = 512;
const MAX_DESKTOP_NAME_SEARCH_FIELD_CODE_POINTS = 64;

const SEARCH_FIELD_NAMES = [
  "caption",
  "resourceClass",
  "resourceName",
  "desktopFileName",
  "state",
  "desktopName",
] as const;

export function appendOverviewSearchText(
  current: unknown,
  input: unknown,
): string {
  return readQueryCharacters(current, input).join("");
}

export function removeLastOverviewSearchCharacter(current: unknown): string {
  const characters = readQueryCharacters(current);
  characters.pop();
  return characters.join("");
}

export function matchesOverviewWindowSearch(
  query: unknown,
  fields: unknown,
): boolean {
  try {
    const terms = searchTerms(query);

    if (terms.length === 0) {
      return true;
    }

    if (!isRecord(fields)) {
      return false;
    }

    const searchableFields: string[] = [];

    for (const name of SEARCH_FIELD_NAMES) {
      const value = fields[name];

      if (value === undefined) {
        continue;
      }

      if (typeof value !== "string") {
        return false;
      }

      searchableFields.push(
        codePointPrefix(
          value,
          name === "desktopName"
            ? MAX_DESKTOP_NAME_SEARCH_FIELD_CODE_POINTS
            : MAX_SEARCH_FIELD_CODE_POINTS,
        ).toLowerCase(),
      );
    }

    if (searchableFields.length === 0) {
      return false;
    }

    return terms.every((term) =>
      searchableFields.some((field) => field.includes(term)),
    );
  } catch {
    return false;
  }
}

function readQueryCharacters(...values: readonly unknown[]): string[] {
  const characters: string[] = [];
  let scannedCodePoints = 0;

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    let offset = 0;
    while (
      offset < value.length &&
      scannedCodePoints < MAX_QUERY_SCAN_CODE_POINTS &&
      characters.length < MAX_QUERY_CODE_POINTS
    ) {
      const codePoint = value.codePointAt(offset);
      if (codePoint === undefined) {
        break;
      }

      const nextOffset = offset + (codePoint > 0xffff ? 2 : 1);
      scannedCodePoints += 1;

      if (!isControlCodePoint(codePoint)) {
        characters.push(value.slice(offset, nextOffset));
      }

      offset = nextOffset;
    }
  }

  return characters;
}

function searchTerms(query: unknown): string[] {
  const normalized = readQueryCharacters(query).join("").trim();

  return normalized.length === 0
    ? []
    : normalized
        .split(/\s+/u)
        .slice(0, MAX_QUERY_TERMS)
        .map((term) => term.toLowerCase());
}

function codePointPrefix(value: string, maximum: number): string {
  let codePoints = 0;
  let offset = 0;

  while (offset < value.length && codePoints < maximum) {
    const codePoint = value.codePointAt(offset);
    if (codePoint === undefined) {
      break;
    }

    offset += codePoint > 0xffff ? 2 : 1;
    codePoints += 1;
  }

  return value.slice(0, offset);
}

function isControlCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    codePoint === 0x7f ||
    (codePoint >= 0x80 && codePoint <= 0x9f)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
