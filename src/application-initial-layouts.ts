export const APPLICATION_INITIAL_LAYOUT_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  entries: 128,
  identifierBytes: 255,
  rawEntryCharacters: 512,
});

export const DEFAULT_INITIAL_LAYOUT_LIMITS = Object.freeze({
  encodedCharacters: 16,
});

export type InitialLayout = "tiled" | "floating";

export interface ApplicationInitialLayouts {
  readonly canonicalEntries: readonly string[];
  initialLayoutFor(desktopFileName: string): InitialLayout | undefined;
}

interface ParsedInitialLayout {
  readonly desktopFileName: string;
  readonly initialLayout: InitialLayout;
}

export const DEFAULT_INITIAL_LAYOUT: InitialLayout = "tiled";

export const EMPTY_APPLICATION_INITIAL_LAYOUTS =
  decodeApplicationInitialLayouts("") as ApplicationInitialLayouts;

export function decodeApplicationInitialLayouts(
  value: unknown,
): ApplicationInitialLayouts | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_INITIAL_LAYOUT_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedLayouts: ParsedInitialLayout[] = [];
  const layouts = new Map<string, InitialLayout>();

  for (const candidate of candidates) {
    if (
      candidate.length > APPLICATION_INITIAL_LAYOUT_LIMITS.rawEntryCharacters ||
      hasControlCharacter(candidate)
    ) {
      return null;
    }

    if (candidate.trim().length === 0) {
      continue;
    }

    if (parsedLayouts.length >= APPLICATION_INITIAL_LAYOUT_LIMITS.entries) {
      return null;
    }

    const parsed = parseInitialLayout(candidate);

    if (!parsed || layouts.has(parsed.desktopFileName)) {
      return null;
    }

    parsedLayouts.push(parsed);
    layouts.set(parsed.desktopFileName, parsed.initialLayout);
  }

  parsedLayouts.sort(compareInitialLayouts);
  const canonicalEntries = Object.freeze(
    parsedLayouts.map(
      ({ desktopFileName, initialLayout }) =>
        `${desktopFileName}=${initialLayout}`,
    ),
  );

  return Object.freeze({
    canonicalEntries,
    initialLayoutFor: (desktopFileName: string): InitialLayout | undefined =>
      layouts.get(desktopFileName),
  });
}

export function decodeInitialLayout(value: unknown): InitialLayout | null {
  if (
    typeof value !== "string" ||
    value.length > DEFAULT_INITIAL_LAYOUT_LIMITS.encodedCharacters ||
    hasControlCharacter(value)
  ) {
    return null;
  }

  const initialLayout = value.trim();
  return isInitialLayout(initialLayout) ? initialLayout : null;
}

export function sameApplicationInitialLayouts(
  left: ApplicationInitialLayouts,
  right: ApplicationInitialLayouts,
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

export function sameInitialLayouts(
  left: InitialLayout,
  right: InitialLayout,
): boolean {
  return left === right;
}

function parseInitialLayout(value: string): ParsedInitialLayout | null {
  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedLayout = value.slice(separator + 1).trim();
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes > APPLICATION_INITIAL_LAYOUT_LIMITS.identifierBytes ||
    !isInitialLayout(encodedLayout)
  ) {
    return null;
  }

  return { desktopFileName, initialLayout: encodedLayout };
}

function isInitialLayout(value: string): value is InitialLayout {
  return value === "tiled" || value === "floating";
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

      if (index + 1 >= value.length || trailing < 0xdc00 || trailing > 0xdfff) {
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

function compareInitialLayouts(
  left: ParsedInitialLayout,
  right: ParsedInitialLayout,
): number {
  if (left.desktopFileName < right.desktopFileName) {
    return -1;
  }

  return left.desktopFileName > right.desktopFileName ? 1 : 0;
}
