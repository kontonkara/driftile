export const COLUMN_WIDTH_PRESET_LIMITS = Object.freeze({
  documentCharacters: 256,
  entries: 16,
  maximumPercent: 100,
  minimumPercent: 10,
});

export interface ColumnWidthPresetPercentages {
  readonly canonicalValue: string;
  readonly percentages: readonly number[];
}

const canonicalPercent = /^(?:1[0-9]|[2-9][0-9]|100)$/u;

export const EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES = createPercentages([]);

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

  const percentages: number[] = [];
  let previous = COLUMN_WIDTH_PRESET_LIMITS.minimumPercent - 1;

  for (const candidate of candidates) {
    const encoded = candidate.trim();

    if (!canonicalPercent.test(encoded)) {
      return null;
    }

    const percent = Number(encoded);

    if (
      percent < COLUMN_WIDTH_PRESET_LIMITS.minimumPercent ||
      percent > COLUMN_WIDTH_PRESET_LIMITS.maximumPercent ||
      percent <= previous
    ) {
      return null;
    }

    percentages.push(percent);
    previous = percent;
  }

  return createPercentages(percentages);
}

export function sameColumnWidthPresetPercentages(
  left: ColumnWidthPresetPercentages,
  right: ColumnWidthPresetPercentages,
): boolean {
  return left === right || left.canonicalValue === right.canonicalValue;
}

function createPercentages(
  percentages: readonly number[],
): ColumnWidthPresetPercentages {
  const immutablePercentages = Object.freeze([...percentages]);

  return Object.freeze({
    canonicalValue: immutablePercentages.join(","),
    percentages: immutablePercentages,
  });
}
