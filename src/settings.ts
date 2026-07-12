const MIN_GAP = 0;
const MAX_GAP = 64;
const MIN_DEFAULT_COLUMN_WIDTH_PERCENT = 10;
const MAX_DEFAULT_COLUMN_WIDTH_PERCENT = 100;
const MIN_RESIZE_STEP_PERCENT = 1;
const MAX_RESIZE_STEP_PERCENT = 50;
const SETTINGS_FIELD_COUNT = 5;

export interface DriftileSettings {
  readonly borderlessWindows: boolean;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidthPercent: number;
  readonly gap: number;
  readonly windowHeightStepPercent: number;
}

export const DEFAULT_DRIFTILE_SETTINGS: DriftileSettings = Object.freeze({
  borderlessWindows: true,
  columnWidthStepPercent: 10,
  defaultColumnWidthPercent: 50,
  gap: 16,
  windowHeightStepPercent: 10,
});

export function decodeDriftileSettings(
  value: unknown,
): DriftileSettings | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    Reflect.ownKeys(candidate).length !== SETTINGS_FIELD_COUNT ||
    !owns(candidate, "borderlessWindows") ||
    !owns(candidate, "columnWidthStepPercent") ||
    !owns(candidate, "defaultColumnWidthPercent") ||
    !owns(candidate, "gap") ||
    !owns(candidate, "windowHeightStepPercent")
  ) {
    return null;
  }

  const borderlessWindows = candidate["borderlessWindows"];
  const columnWidthStepPercent = candidate["columnWidthStepPercent"];
  const defaultColumnWidthPercent = candidate["defaultColumnWidthPercent"];
  const gap = candidate["gap"];
  const windowHeightStepPercent = candidate["windowHeightStepPercent"];

  if (
    typeof borderlessWindows !== "boolean" ||
    !isBoundedInteger(
      columnWidthStepPercent,
      MIN_RESIZE_STEP_PERCENT,
      MAX_RESIZE_STEP_PERCENT,
    ) ||
    !isBoundedInteger(
      defaultColumnWidthPercent,
      MIN_DEFAULT_COLUMN_WIDTH_PERCENT,
      MAX_DEFAULT_COLUMN_WIDTH_PERCENT,
    ) ||
    !isBoundedInteger(gap, MIN_GAP, MAX_GAP) ||
    !isBoundedInteger(
      windowHeightStepPercent,
      MIN_RESIZE_STEP_PERCENT,
      MAX_RESIZE_STEP_PERCENT,
    )
  ) {
    return null;
  }

  return Object.freeze({
    borderlessWindows,
    columnWidthStepPercent,
    defaultColumnWidthPercent,
    gap,
    windowHeightStepPercent,
  });
}

export function sameDriftileSettings(
  left: DriftileSettings,
  right: DriftileSettings,
): boolean {
  return (
    left.borderlessWindows === right.borderlessWindows &&
    left.columnWidthStepPercent === right.columnWidthStepPercent &&
    left.defaultColumnWidthPercent === right.defaultColumnWidthPercent &&
    left.gap === right.gap &&
    left.windowHeightStepPercent === right.windowHeightStepPercent
  );
}

function owns(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
