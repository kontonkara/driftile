export const APPLICATION_COLUMN_PRESENTATION_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  entries: 128,
  identifierBytes: 255,
  rawEntryCharacters: 512,
});

export type ApplicationColumnPresentation = "stacked" | "tabbed";

export interface ApplicationColumnPresentations {
  readonly canonicalEntries: readonly string[];
  columnPresentationFor(
    desktopFileName: string,
  ): ApplicationColumnPresentation | undefined;
}

export const EMPTY_APPLICATION_COLUMN_PRESENTATIONS =
  decodeApplicationColumnPresentations("") as ApplicationColumnPresentations;

interface ParsedPresentation {
  readonly desktopFileName: string;
  readonly presentation: ApplicationColumnPresentation;
}

export function decodeApplicationColumnPresentations(
  value: unknown,
): ApplicationColumnPresentations | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_COLUMN_PRESENTATION_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedPresentations: ParsedPresentation[] = [];
  const presentations = new Map<string, ApplicationColumnPresentation>();

  for (const candidate of candidates) {
    if (
      candidate.length >
      APPLICATION_COLUMN_PRESENTATION_LIMITS.rawEntryCharacters
    ) {
      return null;
    }

    if (candidate.trim().length === 0) {
      continue;
    }

    if (
      parsedPresentations.length >=
      APPLICATION_COLUMN_PRESENTATION_LIMITS.entries
    ) {
      return null;
    }

    const parsed = parsePresentation(candidate);

    if (!parsed || presentations.has(parsed.desktopFileName)) {
      return null;
    }

    parsedPresentations.push(parsed);
    presentations.set(parsed.desktopFileName, parsed.presentation);
  }

  parsedPresentations.sort(comparePresentations);
  const canonicalEntries = Object.freeze(
    parsedPresentations.map(
      ({ desktopFileName, presentation }) =>
        `${desktopFileName}=${presentation}`,
    ),
  );

  return Object.freeze({
    canonicalEntries,
    columnPresentationFor: (
      desktopFileName: string,
    ): ApplicationColumnPresentation | undefined =>
      presentations.get(desktopFileName),
  });
}

export function sameApplicationColumnPresentations(
  left: ApplicationColumnPresentations,
  right: ApplicationColumnPresentations,
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

function parsePresentation(value: unknown): ParsedPresentation | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_COLUMN_PRESENTATION_LIMITS.rawEntryCharacters
  ) {
    return null;
  }

  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedPresentation = value.slice(separator + 1).trim();
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes > APPLICATION_COLUMN_PRESENTATION_LIMITS.identifierBytes ||
    hasControlCharacter(desktopFileName) ||
    !isApplicationColumnPresentation(encodedPresentation)
  ) {
    return null;
  }

  return {
    desktopFileName,
    presentation: encodedPresentation,
  };
}

function isApplicationColumnPresentation(
  value: string,
): value is ApplicationColumnPresentation {
  return value === "stacked" || value === "tabbed";
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

function comparePresentations(
  left: ParsedPresentation,
  right: ParsedPresentation,
): number {
  if (left.desktopFileName < right.desktopFileName) {
    return -1;
  }

  return left.desktopFileName > right.desktopFileName ? 1 : 0;
}
