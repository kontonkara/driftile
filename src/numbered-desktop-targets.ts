export const NUMBERED_DESKTOP_TARGET_LIMITS = Object.freeze({
  desktopNameBytes: 255,
  documentCharacters: 4_617,
  entries: 9,
  rawEntryCharacters: 512,
});

export interface NumberedDesktopTargets {
  readonly canonicalEntries: readonly string[];
  desktopNameFor(slot: number): string | undefined;
}

interface ParsedDesktopTarget {
  readonly desktopName: string;
  readonly slot: number;
}

const canonicalSlot = /^[1-9]$/u;

export const EMPTY_NUMBERED_DESKTOP_TARGETS = createDesktopTargets(
  [],
  new Map(),
);

export function decodeNumberedDesktopTargets(
  value: unknown,
): NumberedDesktopTargets | null {
  if (
    typeof value !== "string" ||
    value.length > NUMBERED_DESKTOP_TARGET_LIMITS.documentCharacters
  ) {
    return null;
  }

  if (value.trim().length === 0) {
    return EMPTY_NUMBERED_DESKTOP_TARGETS;
  }

  const candidates = value.split("\n");
  const parsedTargets: ParsedDesktopTarget[] = [];
  const namesBySlot = new Map<number, string>();
  const configuredNames = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.length > NUMBERED_DESKTOP_TARGET_LIMITS.rawEntryCharacters) {
      return null;
    }

    if (candidate.trim().length === 0) {
      continue;
    }

    if (parsedTargets.length >= NUMBERED_DESKTOP_TARGET_LIMITS.entries) {
      return null;
    }

    const parsed = parseDesktopTarget(candidate);

    if (
      !parsed ||
      namesBySlot.has(parsed.slot) ||
      configuredNames.has(parsed.desktopName)
    ) {
      return null;
    }

    parsedTargets.push(parsed);
    namesBySlot.set(parsed.slot, parsed.desktopName);
    configuredNames.add(parsed.desktopName);
  }

  parsedTargets.sort((left, right) => left.slot - right.slot);
  return createDesktopTargets(parsedTargets, namesBySlot);
}

export function sameNumberedDesktopTargets(
  left: NumberedDesktopTargets,
  right: NumberedDesktopTargets,
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

function parseDesktopTarget(value: string): ParsedDesktopTarget | null {
  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const encodedSlot = value.slice(0, separator).trim();
  const desktopName = value.slice(separator + 1).trim();
  const desktopNameBytes = utf8ByteLength(desktopName);

  if (
    !canonicalSlot.test(encodedSlot) ||
    desktopName.length === 0 ||
    desktopNameBytes === null ||
    desktopNameBytes > NUMBERED_DESKTOP_TARGET_LIMITS.desktopNameBytes ||
    hasControlCharacter(desktopName)
  ) {
    return null;
  }

  return { desktopName, slot: Number(encodedSlot) };
}

function createDesktopTargets(
  parsedTargets: readonly ParsedDesktopTarget[],
  namesBySlot: ReadonlyMap<number, string>,
): NumberedDesktopTargets {
  const canonicalEntries = Object.freeze(
    parsedTargets.map(
      ({ desktopName, slot }) => `${String(slot)}=${desktopName}`,
    ),
  );

  return Object.freeze({
    canonicalEntries,
    desktopNameFor: (slot: number): string | undefined => namesBySlot.get(slot),
  });
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
