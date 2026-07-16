import { APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS } from "./application-overrides";
import type { WindowHeight } from "./core/layout-engine";
import { decodeWindowHeightPresetPercentages } from "./window-height-presets";

export const APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS =
  APPLICATION_COLUMN_WIDTH_OVERRIDE_LIMITS;

export interface ApplicationWindowHeightOverrides {
  readonly canonicalEntries: readonly string[];
  windowHeightFor(desktopFileName: string): WindowHeight | undefined;
}

interface ParsedOverride {
  readonly canonicalHeight: string;
  readonly desktopFileName: string;
  readonly height: WindowHeight;
}

const canonicalFixed = /^(?:[1-9][0-9]{0,4})px$/u;
const canonicalPercent = /^(?:[1-9][0-9]|100)%?$/u;

export const EMPTY_APPLICATION_WINDOW_HEIGHT_OVERRIDES =
  decodeApplicationWindowHeightOverrides(
    "",
  ) as ApplicationWindowHeightOverrides;

export function decodeApplicationWindowHeightOverrides(
  value: unknown,
): ApplicationWindowHeightOverrides | null {
  if (
    typeof value !== "string" ||
    value.length > APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.documentCharacters
  ) {
    return null;
  }

  const candidates = value.length === 0 ? [] : value.split("\n");
  const parsedOverrides: ParsedOverride[] = [];
  const heights = new Map<string, WindowHeight>();

  for (const candidate of candidates) {
    if (candidate.trim().length === 0) {
      continue;
    }

    if (
      parsedOverrides.length >=
      APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.entries
    ) {
      return null;
    }

    const parsed = parseOverride(candidate);

    if (!parsed || heights.has(parsed.desktopFileName)) {
      return null;
    }

    parsedOverrides.push(parsed);
    heights.set(parsed.desktopFileName, parsed.height);
  }

  parsedOverrides.sort(compareOverrides);
  const canonicalEntries = Object.freeze(
    parsedOverrides.map(
      ({ canonicalHeight, desktopFileName }) =>
        `${desktopFileName}=${canonicalHeight}`,
    ),
  );

  return Object.freeze({
    canonicalEntries,
    windowHeightFor: (desktopFileName: string): WindowHeight | undefined =>
      heights.get(desktopFileName),
  });
}

export function sameApplicationWindowHeightOverrides(
  left: ApplicationWindowHeightOverrides,
  right: ApplicationWindowHeightOverrides,
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
    value.length > APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.rawEntryCharacters
  ) {
    return null;
  }

  const separator = value.indexOf("=");

  if (separator < 0 || value.indexOf("=", separator + 1) >= 0) {
    return null;
  }

  const desktopFileName = value.slice(0, separator).trim();
  const encodedHeight = value.slice(separator + 1).trim();
  const identifierBytes = utf8ByteLength(desktopFileName);

  if (
    desktopFileName.length === 0 ||
    identifierBytes === null ||
    identifierBytes >
      APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.identifierBytes ||
    hasControlCharacter(desktopFileName)
  ) {
    return null;
  }

  if (canonicalFixed.test(encodedHeight)) {
    const pixels = Number(encodedHeight.slice(0, -2));

    if (
      pixels < APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.minimumFixed ||
      pixels > APPLICATION_WINDOW_HEIGHT_OVERRIDE_LIMITS.maximumFixed
    ) {
      return null;
    }

    return {
      canonicalHeight: encodedHeight,
      desktopFileName,
      height: Object.freeze({ clientHeight: pixels, kind: "fixed" }),
    };
  }

  if (!canonicalPercent.test(encodedHeight)) {
    return null;
  }

  const percent = Number(
    encodedHeight.endsWith("%") ? encodedHeight.slice(0, -1) : encodedHeight,
  );
  const preset = decodeWindowHeightPresetPercentages(String(percent));
  const stateIndex = preset?.cycle[0]?.stateIndex;

  if (stateIndex === undefined) {
    return null;
  }

  return {
    canonicalHeight: String(percent),
    desktopFileName,
    height: Object.freeze({ index: stateIndex, kind: "preset" }),
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
