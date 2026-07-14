import {
  decodeApplicationColumnWidthOverrides,
  EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  sameApplicationColumnWidthOverrides,
  type ApplicationColumnWidthOverrides,
} from "./application-overrides";
import {
  decodeApplicationBorderlessExclusions,
  EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  sameApplicationBorderlessExclusions,
  type ApplicationBorderlessExclusions,
} from "./application-borderless-exclusions";
import {
  decodeApplicationInitialFloating,
  EMPTY_APPLICATION_INITIAL_FLOATING,
  sameApplicationInitialFloating,
  type ApplicationInitialFloating,
} from "./application-initial-floating";
import {
  decodeApplicationFocusCentering,
  EMPTY_APPLICATION_FOCUS_CENTERING,
  sameApplicationFocusCentering,
  type ApplicationFocusCentering,
} from "./application-focus-centering";
import {
  decodeApplicationTilingExclusions,
  EMPTY_APPLICATION_TILING_EXCLUSIONS,
  sameApplicationTilingExclusions,
  type ApplicationTilingExclusions,
} from "./application-tiling-exclusions";
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
const SETTINGS_FIELD_COUNT = 13;

export interface DriftileSettings {
  readonly applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly applicationFocusCentering: ApplicationFocusCentering;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly columnWidthPresets: ColumnWidthPresetPercentages;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnWidthPercent: number;
  readonly gap: number;
  readonly touchpadNavigation: boolean;
  readonly windowHeightStepPercent: number;
}

export const DEFAULT_DRIFTILE_SETTINGS: DriftileSettings = Object.freeze({
  applicationBorderlessExclusions: EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  applicationColumnWidths: EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  applicationFocusCentering: EMPTY_APPLICATION_FOCUS_CENTERING,
  applicationInitialFloating: EMPTY_APPLICATION_INITIAL_FLOATING,
  applicationTilingExclusions: EMPTY_APPLICATION_TILING_EXCLUSIONS,
  borderlessWindows: true,
  centerFocusedColumn: false,
  columnWidthPresets: EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
  columnWidthStepPercent: 10,
  defaultColumnWidthPercent: 50,
  gap: 16,
  touchpadNavigation: false,
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
    !owns(candidate, "applicationBorderlessExclusions") ||
    !owns(candidate, "applicationColumnWidths") ||
    !owns(candidate, "applicationFocusCentering") ||
    !owns(candidate, "applicationInitialFloating") ||
    !owns(candidate, "applicationTilingExclusions") ||
    !owns(candidate, "borderlessWindows") ||
    !owns(candidate, "centerFocusedColumn") ||
    !owns(candidate, "columnWidthPresets") ||
    !owns(candidate, "columnWidthStepPercent") ||
    !owns(candidate, "defaultColumnWidthPercent") ||
    !owns(candidate, "gap") ||
    !owns(candidate, "touchpadNavigation") ||
    !owns(candidate, "windowHeightStepPercent")
  ) {
    return null;
  }

  const applicationBorderlessExclusions = decodeApplicationBorderlessExclusions(
    candidate["applicationBorderlessExclusions"],
  );
  const applicationColumnWidths = decodeApplicationColumnWidthOverrides(
    candidate["applicationColumnWidths"],
  );
  const applicationFocusCentering = decodeApplicationFocusCentering(
    candidate["applicationFocusCentering"],
  );
  const applicationInitialFloating = decodeApplicationInitialFloating(
    candidate["applicationInitialFloating"],
  );
  const applicationTilingExclusions = decodeApplicationTilingExclusions(
    candidate["applicationTilingExclusions"],
  );
  const borderlessWindows = candidate["borderlessWindows"];
  const centerFocusedColumn = candidate["centerFocusedColumn"];
  const columnWidthPresets = decodeColumnWidthPresetPercentages(
    candidate["columnWidthPresets"],
  );
  const columnWidthStepPercent = candidate["columnWidthStepPercent"];
  const defaultColumnWidthPercent = candidate["defaultColumnWidthPercent"];
  const gap = candidate["gap"];
  const touchpadNavigation = candidate["touchpadNavigation"];
  const windowHeightStepPercent = candidate["windowHeightStepPercent"];

  if (
    !applicationBorderlessExclusions ||
    !applicationColumnWidths ||
    !applicationFocusCentering ||
    !applicationInitialFloating ||
    !applicationTilingExclusions ||
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
    typeof touchpadNavigation !== "boolean" ||
    !isBoundedInteger(
      windowHeightStepPercent,
      MIN_RESIZE_STEP_PERCENT,
      MAX_RESIZE_STEP_PERCENT,
    )
  ) {
    return null;
  }

  return Object.freeze({
    applicationBorderlessExclusions,
    applicationColumnWidths,
    applicationFocusCentering,
    applicationInitialFloating,
    applicationTilingExclusions,
    borderlessWindows,
    centerFocusedColumn,
    columnWidthPresets,
    columnWidthStepPercent,
    defaultColumnWidthPercent,
    gap,
    touchpadNavigation,
    windowHeightStepPercent,
  });
}

export function sameDriftileSettings(
  left: DriftileSettings,
  right: DriftileSettings,
): boolean {
  return (
    sameApplicationBorderlessExclusions(
      left.applicationBorderlessExclusions,
      right.applicationBorderlessExclusions,
    ) &&
    sameApplicationColumnWidthOverrides(
      left.applicationColumnWidths,
      right.applicationColumnWidths,
    ) &&
    sameApplicationFocusCentering(
      left.applicationFocusCentering,
      right.applicationFocusCentering,
    ) &&
    sameApplicationInitialFloating(
      left.applicationInitialFloating,
      right.applicationInitialFloating,
    ) &&
    sameApplicationTilingExclusions(
      left.applicationTilingExclusions,
      right.applicationTilingExclusions,
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
    left.touchpadNavigation === right.touchpadNavigation &&
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
