import type { WindowHeight } from "./core/layout-engine";
import { decodeWindowHeightPresetPercentages } from "./window-height-presets";

export const DEFAULT_WINDOW_HEIGHT_LIMITS = Object.freeze({
  encodedCharacters: 32,
  maximumPixels: 16_384,
  maximumPercent: 100,
  minimumPixels: 1,
  minimumPercent: 10,
});

export interface DefaultWindowHeight {
  readonly canonicalValue: string;
  readonly windowHeight: WindowHeight | null;
}

const canonicalFixed = /^(?:[1-9][0-9]{0,4})px$/u;
const canonicalPercent = /^(?:[1-9][0-9]|100)%?$/u;

export const AUTOMATIC_DEFAULT_WINDOW_HEIGHT = Object.freeze({
  canonicalValue: "auto",
  windowHeight: null,
}) satisfies DefaultWindowHeight;

export function decodeDefaultWindowHeight(
  value: unknown,
): DefaultWindowHeight | null {
  if (
    typeof value !== "string" ||
    value.length > DEFAULT_WINDOW_HEIGHT_LIMITS.encodedCharacters ||
    /[\r\n]/u.test(value)
  ) {
    return null;
  }

  const encoded = value.trim();

  if (encoded === "auto") {
    return AUTOMATIC_DEFAULT_WINDOW_HEIGHT;
  }

  if (canonicalFixed.test(encoded)) {
    const pixels = Number(encoded.slice(0, -2));

    if (
      pixels < DEFAULT_WINDOW_HEIGHT_LIMITS.minimumPixels ||
      pixels > DEFAULT_WINDOW_HEIGHT_LIMITS.maximumPixels
    ) {
      return null;
    }

    return createDefaultWindowHeight(`${String(pixels)}px`, {
      clientHeight: pixels,
      kind: "fixed",
    });
  }

  if (!canonicalPercent.test(encoded)) {
    return null;
  }

  const percent = Number(
    encoded.endsWith("%") ? encoded.slice(0, -1) : encoded,
  );
  const preset = decodeWindowHeightPresetPercentages(String(percent));
  const stateIndex = preset?.cycle[0]?.stateIndex;

  return stateIndex === undefined
    ? null
    : createDefaultWindowHeight(String(percent), {
        index: stateIndex,
        kind: "preset",
      });
}

export function sameDefaultWindowHeights(
  left: DefaultWindowHeight,
  right: DefaultWindowHeight,
): boolean {
  return left === right || left.canonicalValue === right.canonicalValue;
}

function createDefaultWindowHeight(
  canonicalValue: string,
  windowHeight: WindowHeight,
): DefaultWindowHeight {
  return Object.freeze({
    canonicalValue,
    windowHeight: Object.freeze({ ...windowHeight }),
  });
}
