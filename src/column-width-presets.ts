import type { ColumnWidth } from "./core/layout-engine";

export const COLUMN_WIDTH_PRESET_LIMITS = Object.freeze({
  documentCharacters: 256,
  entries: 16,
  maximumFixed: 16_384,
  maximumPercent: 100,
  minimumFixed: 1,
  minimumPercent: 10,
});

export interface ColumnWidthPresetPercentages {
  readonly canonicalValue: string;
  readonly percentages: readonly number[];
  readonly presets: readonly ColumnWidth[];
}

const canonicalFixed = /^(?:[1-9][0-9]{0,4})px$/u;
const canonicalPercent = /^(?:[1-9][0-9]{1,2})%?$/u;

export const EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES = createPresets([], []);

export function decodeColumnWidthPresetPercentages(
  value: unknown,
): ColumnWidthPresetPercentages | null {
  if (
    typeof value !== "string" ||
    value.length > COLUMN_WIDTH_PRESET_LIMITS.documentCharacters
  ) {
    return null;
  }

  if (value.trim().length === 0) {
    return EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES;
  }

  const candidates = value.split(",");

  if (
    candidates.length === 0 ||
    candidates.length > COLUMN_WIDTH_PRESET_LIMITS.entries
  ) {
    return null;
  }

  const canonicalValues: string[] = [];
  const percentages: number[] = [];
  const presets: ColumnWidth[] = [];
  let previousFixed = COLUMN_WIDTH_PRESET_LIMITS.minimumFixed - 1;
  let previousPercent = COLUMN_WIDTH_PRESET_LIMITS.minimumPercent - 1;

  for (const candidate of candidates) {
    const encoded = candidate.trim();

    if (canonicalFixed.test(encoded)) {
      const fixed = Number(encoded.slice(0, -2));

      if (
        fixed < COLUMN_WIDTH_PRESET_LIMITS.minimumFixed ||
        fixed > COLUMN_WIDTH_PRESET_LIMITS.maximumFixed ||
        fixed <= previousFixed
      ) {
        return null;
      }

      canonicalValues.push(encoded);
      presets.push({ kind: "fixed", value: fixed });
      previousFixed = fixed;
      continue;
    }

    if (!canonicalPercent.test(encoded)) {
      return null;
    }

    const percent = Number(
      encoded.endsWith("%") ? encoded.slice(0, -1) : encoded,
    );

    if (
      percent < COLUMN_WIDTH_PRESET_LIMITS.minimumPercent ||
      percent > COLUMN_WIDTH_PRESET_LIMITS.maximumPercent ||
      percent <= previousPercent
    ) {
      return null;
    }

    canonicalValues.push(String(percent));
    percentages.push(percent);
    presets.push({ kind: "proportion", value: percent / 100 });
    previousPercent = percent;
  }

  return createPresets(canonicalValues, percentages, presets);
}

export function sameColumnWidthPresetPercentages(
  left: ColumnWidthPresetPercentages,
  right: ColumnWidthPresetPercentages,
): boolean {
  return left === right || left.canonicalValue === right.canonicalValue;
}

function createPresets(
  canonicalValues: readonly string[],
  percentages: readonly number[],
  presets: readonly ColumnWidth[] = [],
): ColumnWidthPresetPercentages {
  const immutablePercentages = Object.freeze([...percentages]);
  const immutablePresets = Object.freeze(
    presets.map((preset) => Object.freeze({ ...preset })),
  );

  return Object.freeze({
    canonicalValue: canonicalValues.join(","),
    percentages: immutablePercentages,
    presets: immutablePresets,
  });
}
