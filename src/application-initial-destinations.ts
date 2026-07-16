export const APPLICATION_INITIAL_DESTINATION_LIMITS = Object.freeze({
  documentCharacters: 65_664,
  desktopNameBytes: 255,
  entries: 128,
  identifierBytes: 255,
  outputNameBytes: 255,
  rawEntryCharacters: 512,
});

export interface ApplicationInitialDestination {
  readonly desktop?: number;
  readonly desktopName?: string;
  readonly output?: string;
}

export interface ApplicationInitialDestinations {
  readonly canonicalEntries: readonly string[];
  initialDestinationFor(
    desktopFileName: string,
  ): ApplicationInitialDestination | undefined;
}

interface ParsedInitialDestination {
  readonly desktopFileName: string;
  readonly destination: ApplicationInitialDestination;
}

const canonicalDesktop = /^(?:[1-9]|1[0-9]|2[0-5])$/u;

export const EMPTY_APPLICATION_INITIAL_DESTINATIONS =
  decodeApplicationInitialDestinations("") as ApplicationInitialDestinations;

export function decodeApplicationInitialDestinations(
  value: unknown,
): ApplicationInitialDestinations | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_INITIAL_DESTINATION_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedDestinations: ParsedInitialDestination[] = [];
  const destinations = new Map<string, ApplicationInitialDestination>();

  for (const candidate of candidates) {
    if (
      candidate.length >
      APPLICATION_INITIAL_DESTINATION_LIMITS.rawEntryCharacters
    ) {
      return null;
    }

    if (candidate.trim().length === 0) {
      continue;
    }

    if (
      parsedDestinations.length >=
      APPLICATION_INITIAL_DESTINATION_LIMITS.entries
    ) {
      return null;
    }

    const parsed = parseInitialDestination(candidate);

    if (!parsed || destinations.has(parsed.desktopFileName)) {
      return null;
    }

    parsedDestinations.push(parsed);
    destinations.set(parsed.desktopFileName, parsed.destination);
  }

  parsedDestinations.sort(compareInitialDestinations);
  const canonicalEntries = Object.freeze(
    parsedDestinations.map(({ desktopFileName, destination }) =>
      encodeInitialDestination(desktopFileName, destination),
    ),
  );

  return Object.freeze({
    canonicalEntries,
    initialDestinationFor: (
      desktopFileName: string,
    ): ApplicationInitialDestination | undefined =>
      destinations.get(desktopFileName),
  });
}

export function sameApplicationInitialDestinations(
  left: ApplicationInitialDestinations,
  right: ApplicationInitialDestinations,
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

function parseInitialDestination(
  value: string,
): ParsedInitialDestination | null {
  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedDestination = value.slice(separator + 1);
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes > APPLICATION_INITIAL_DESTINATION_LIMITS.identifierBytes ||
    hasControlCharacter(desktopFileName)
  ) {
    return null;
  }

  const fields = encodedDestination.split(",");

  if (fields.length < 1 || fields.length > 3) {
    return null;
  }

  let desktop: number | undefined;
  let desktopName: string | undefined;
  let output: string | undefined;

  for (const field of fields) {
    if (field.length === 0 || field.trim() !== field) {
      return null;
    }

    if (field.startsWith("desktop:")) {
      if (desktop !== undefined || desktopName !== undefined) {
        return null;
      }

      const encodedDesktop = field.slice("desktop:".length);

      if (!canonicalDesktop.test(encodedDesktop)) {
        return null;
      }

      desktop = Number(encodedDesktop);
      continue;
    }

    if (field.startsWith("desktop-name:")) {
      if (desktop !== undefined || desktopName !== undefined) {
        return null;
      }

      const encodedDesktopName = field.slice("desktop-name:".length);
      const desktopNameBytes = utf8ByteLength(encodedDesktopName);

      if (
        encodedDesktopName.length === 0 ||
        encodedDesktopName.trim() !== encodedDesktopName ||
        desktopNameBytes === null ||
        desktopNameBytes >
          APPLICATION_INITIAL_DESTINATION_LIMITS.desktopNameBytes ||
        hasControlCharacter(encodedDesktopName)
      ) {
        return null;
      }

      desktopName = encodedDesktopName;
      continue;
    }

    if (field.startsWith("output:")) {
      if (output !== undefined) {
        return null;
      }

      const outputName = field.slice("output:".length);
      const outputNameBytes = utf8ByteLength(outputName);

      if (
        outputName.length === 0 ||
        outputName.trim() !== outputName ||
        outputNameBytes === null ||
        outputNameBytes >
          APPLICATION_INITIAL_DESTINATION_LIMITS.outputNameBytes ||
        hasControlCharacter(outputName)
      ) {
        return null;
      }

      output = outputName;
      continue;
    }

    return null;
  }

  if (
    desktop === undefined &&
    desktopName === undefined &&
    output === undefined
  ) {
    return null;
  }

  const destination = Object.freeze({
    ...(desktop === undefined ? {} : { desktop }),
    ...(desktopName === undefined ? {} : { desktopName }),
    ...(output === undefined ? {} : { output }),
  });

  return { desktopFileName, destination };
}

function encodeInitialDestination(
  desktopFileName: string,
  destination: ApplicationInitialDestination,
): string {
  const fields: string[] = [];

  if (destination.desktop !== undefined) {
    fields.push(`desktop:${String(destination.desktop)}`);
  } else if (destination.desktopName !== undefined) {
    fields.push(`desktop-name:${destination.desktopName}`);
  }

  if (destination.output !== undefined) {
    fields.push(`output:${destination.output}`);
  }

  return `${desktopFileName}=${fields.join(",")}`;
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

function compareInitialDestinations(
  left: ParsedInitialDestination,
  right: ParsedInitialDestination,
): number {
  if (left.desktopFileName < right.desktopFileName) {
    return -1;
  }

  return left.desktopFileName > right.desktopFileName ? 1 : 0;
}
