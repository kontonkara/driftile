import {
  decodeApplicationColumnWidthOverrides,
  EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  sameApplicationColumnWidthOverrides,
  type ApplicationColumnWidthOverrides,
} from "./application-overrides";
import {
  decodeColumnWidthPresetPercentages,
  EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
  sameColumnWidthPresetPercentages,
  type ColumnWidthPresetPercentages,
} from "./column-width-presets";

const MIN_GAP = 0;
const MAX_GAP = 64;
const MIN_DEFAULT_COLUMN_WIDTH_PERCENT = 10;
const MAX_DEFAULT_COLUMN_WIDTH_PERCENT = 100;
const MIN_RESIZE_STEP_PERCENT = 1;
const MAX_RESIZE_STEP_PERCENT = 50;
const SETTINGS_FIELD_COUNT = 8;

export interface DriftileSettings {
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly columnWidthPresets: ColumnWidthPresetPercentages;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidthPercent: number;
  readonly gap: number;
  readonly windowHeightStepPercent: number;
}

export const DEFAULT_DRIFTILE_SETTINGS: DriftileSettings = Object.freeze({
  applicationColumnWidths: EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  borderlessWindows: true,
  centerFocusedColumn: false,
  columnWidthPresets: EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
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
    !owns(candidate, "applicationColumnWidths") ||
    !owns(candidate, "borderlessWindows") ||
    !owns(candidate, "centerFocusedColumn") ||
    !owns(candidate, "columnWidthPresets") ||
    !owns(candidate, "columnWidthStepPercent") ||
    !owns(candidate, "defaultColumnWidthPercent") ||
    !owns(candidate, "gap") ||
    !owns(candidate, "windowHeightStepPercent")
  ) {
    return null;
  }

  const applicationColumnWidths = decodeApplicationColumnWidthOverrides(
    candidate["applicationColumnWidths"],
  );
  const borderlessWindows = candidate["borderlessWindows"];
  const centerFocusedColumn = candidate["centerFocusedColumn"];
  const columnWidthPresets = decodeColumnWidthPresetPercentages(
    candidate["columnWidthPresets"],
  );
  const columnWidthStepPercent = candidate["columnWidthStepPercent"];
  const defaultColumnWidthPercent = candidate["defaultColumnWidthPercent"];
  const gap = candidate["gap"];
  const windowHeightStepPercent = candidate["windowHeightStepPercent"];

  if (
    !applicationColumnWidths ||
    typeof borderlessWindows !== "boolean" ||
    typeof centerFocusedColumn !== "boolean" ||
    !columnWidthPresets ||
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
    applicationColumnWidths,
    borderlessWindows,
    centerFocusedColumn,
    columnWidthPresets,
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
    sameApplicationColumnWidthOverrides(
      left.applicationColumnWidths,
      right.applicationColumnWidths,
    ) &&
    left.borderlessWindows === right.borderlessWindows &&
    left.centerFocusedColumn === right.centerFocusedColumn &&
    sameColumnWidthPresetPercentages(
      left.columnWidthPresets,
      right.columnWidthPresets,
    ) &&
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
