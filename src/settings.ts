import {
  decodeApplicationColumnWidthOverrides,
  EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  sameApplicationColumnWidthOverrides,
  type ApplicationColumnWidthOverrides,
} from "./application-overrides";
import {
  decodeApplicationColumnPresentations,
  EMPTY_APPLICATION_COLUMN_PRESENTATIONS,
  sameApplicationColumnPresentations,
  type ApplicationColumnPresentations,
} from "./application-column-presentations";
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
import type { ColumnPresentation } from "./core/layout-engine";
import {
  decodeWindowHeightPresetPercentages,
  EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
  sameWindowHeightPresetPercentages,
  type WindowHeightPresetPercentages,
} from "./window-height-presets";

const MIN_GAP = 0;
const MAX_GAP = 64;
const MIN_DEFAULT_COLUMN_WIDTH_PERCENT = 10;
const MAX_DEFAULT_COLUMN_WIDTH_PERCENT = 100;
const MIN_RESIZE_STEP_PERCENT = 1;
const MAX_RESIZE_STEP_PERCENT = 50;
const MIN_TOUCHPAD_NAVIGATION_FINGER_COUNT = 3;
const MAX_TOUCHPAD_NAVIGATION_FINGER_COUNT = 5;
const SETTINGS_FIELD_COUNT = 21;

export interface DriftileSettings {
  readonly applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  readonly applicationColumnPresentations: ApplicationColumnPresentations;
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly applicationFocusCentering: ApplicationFocusCentering;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly centerFocusedColumnOnOverflow: boolean;
  readonly columnWidthPresets: ColumnWidthPresetPercentages;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnPresentation: ColumnPresentation;
  readonly defaultColumnWidthPercent: number;
  readonly gap: number;
  readonly showTabIndicator: boolean;
  readonly touchpadNavigation: boolean;
  readonly touchpadNavigationFingerCount: number;
  readonly touchpadNaturalScroll: boolean;
  readonly touchpadWorkspaceNavigation: boolean;
  readonly windowHeightPresets: WindowHeightPresetPercentages;
  readonly windowHeightStepPercent: number;
}

export const DEFAULT_DRIFTILE_SETTINGS: DriftileSettings = Object.freeze({
  applicationBorderlessExclusions: EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  applicationColumnPresentations: EMPTY_APPLICATION_COLUMN_PRESENTATIONS,
  applicationColumnWidths: EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  applicationFocusCentering: EMPTY_APPLICATION_FOCUS_CENTERING,
  applicationInitialFloating: EMPTY_APPLICATION_INITIAL_FLOATING,
  applicationTilingExclusions: EMPTY_APPLICATION_TILING_EXCLUSIONS,
  borderlessWindows: true,
  centerFocusedColumn: false,
  centerFocusedColumnOnOverflow: false,
  columnWidthPresets: EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
  columnWidthStepPercent: 10,
  defaultColumnPresentation: "stacked",
  defaultColumnWidthPercent: 33,
  gap: 16,
  showTabIndicator: true,
  touchpadNavigation: false,
  touchpadNavigationFingerCount: 5,
  touchpadNaturalScroll: true,
  touchpadWorkspaceNavigation: false,
  windowHeightPresets: EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
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
    !owns(candidate, "applicationColumnPresentations") ||
    !owns(candidate, "applicationColumnWidths") ||
    !owns(candidate, "applicationFocusCentering") ||
    !owns(candidate, "applicationInitialFloating") ||
    !owns(candidate, "applicationTilingExclusions") ||
    !owns(candidate, "borderlessWindows") ||
    !owns(candidate, "centerFocusedColumn") ||
    !owns(candidate, "centerFocusedColumnOnOverflow") ||
    !owns(candidate, "columnWidthPresets") ||
    !owns(candidate, "columnWidthStepPercent") ||
    !owns(candidate, "defaultColumnPresentation") ||
    !owns(candidate, "defaultColumnWidthPercent") ||
    !owns(candidate, "gap") ||
    !owns(candidate, "showTabIndicator") ||
    !owns(candidate, "touchpadNavigation") ||
    !owns(candidate, "touchpadNavigationFingerCount") ||
    !owns(candidate, "touchpadNaturalScroll") ||
    !owns(candidate, "touchpadWorkspaceNavigation") ||
    !owns(candidate, "windowHeightPresets") ||
    !owns(candidate, "windowHeightStepPercent")
  ) {
    return null;
  }

  const applicationBorderlessExclusions = decodeApplicationBorderlessExclusions(
    candidate["applicationBorderlessExclusions"],
  );
  const applicationColumnPresentations = decodeApplicationColumnPresentations(
    candidate["applicationColumnPresentations"],
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
  const centerFocusedColumnOnOverflow =
    candidate["centerFocusedColumnOnOverflow"];
  const columnWidthPresets = decodeColumnWidthPresetPercentages(
    candidate["columnWidthPresets"],
  );
  const columnWidthStepPercent = candidate["columnWidthStepPercent"];
  const defaultColumnPresentation = candidate["defaultColumnPresentation"];
  const defaultColumnWidthPercent = candidate["defaultColumnWidthPercent"];
  const gap = candidate["gap"];
  const showTabIndicator = candidate["showTabIndicator"];
  const touchpadNavigation = candidate["touchpadNavigation"];
  const touchpadNavigationFingerCount =
    candidate["touchpadNavigationFingerCount"];
  const touchpadNaturalScroll = candidate["touchpadNaturalScroll"];
  const touchpadWorkspaceNavigation = candidate["touchpadWorkspaceNavigation"];
  const windowHeightPresets = decodeWindowHeightPresetPercentages(
    candidate["windowHeightPresets"],
  );
  const windowHeightStepPercent = candidate["windowHeightStepPercent"];

  if (
    !applicationBorderlessExclusions ||
    !applicationColumnPresentations ||
    !applicationColumnWidths ||
    !applicationFocusCentering ||
    !applicationInitialFloating ||
    !applicationTilingExclusions ||
    typeof borderlessWindows !== "boolean" ||
    typeof centerFocusedColumn !== "boolean" ||
    typeof centerFocusedColumnOnOverflow !== "boolean" ||
    !columnWidthPresets ||
    !isBoundedInteger(
      columnWidthStepPercent,
      MIN_RESIZE_STEP_PERCENT,
      MAX_RESIZE_STEP_PERCENT,
    ) ||
    !isColumnPresentation(defaultColumnPresentation) ||
    !isBoundedInteger(
      defaultColumnWidthPercent,
      MIN_DEFAULT_COLUMN_WIDTH_PERCENT,
      MAX_DEFAULT_COLUMN_WIDTH_PERCENT,
    ) ||
    !isBoundedInteger(gap, MIN_GAP, MAX_GAP) ||
    typeof showTabIndicator !== "boolean" ||
    typeof touchpadNavigation !== "boolean" ||
    !isBoundedInteger(
      touchpadNavigationFingerCount,
      MIN_TOUCHPAD_NAVIGATION_FINGER_COUNT,
      MAX_TOUCHPAD_NAVIGATION_FINGER_COUNT,
    ) ||
    typeof touchpadNaturalScroll !== "boolean" ||
    typeof touchpadWorkspaceNavigation !== "boolean" ||
    !windowHeightPresets ||
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
    applicationColumnPresentations,
    applicationColumnWidths,
    applicationFocusCentering,
    applicationInitialFloating,
    applicationTilingExclusions,
    borderlessWindows,
    centerFocusedColumn,
    centerFocusedColumnOnOverflow,
    columnWidthPresets,
    columnWidthStepPercent,
    defaultColumnPresentation,
    defaultColumnWidthPercent,
    gap,
    showTabIndicator,
    touchpadNavigation,
    touchpadNavigationFingerCount,
    touchpadNaturalScroll,
    touchpadWorkspaceNavigation,
    windowHeightPresets,
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
    sameApplicationColumnPresentations(
      left.applicationColumnPresentations,
      right.applicationColumnPresentations,
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
    left.centerFocusedColumnOnOverflow ===
      right.centerFocusedColumnOnOverflow &&
    sameColumnWidthPresetPercentages(
      left.columnWidthPresets,
      right.columnWidthPresets,
    ) &&
    left.columnWidthStepPercent === right.columnWidthStepPercent &&
    left.defaultColumnPresentation === right.defaultColumnPresentation &&
    left.defaultColumnWidthPercent === right.defaultColumnWidthPercent &&
    left.gap === right.gap &&
    left.showTabIndicator === right.showTabIndicator &&
    left.touchpadNavigation === right.touchpadNavigation &&
    left.touchpadNavigationFingerCount ===
      right.touchpadNavigationFingerCount &&
    left.touchpadNaturalScroll === right.touchpadNaturalScroll &&
    left.touchpadWorkspaceNavigation === right.touchpadWorkspaceNavigation &&
    sameWindowHeightPresetPercentages(
      left.windowHeightPresets,
      right.windowHeightPresets,
    ) &&
    left.windowHeightStepPercent === right.windowHeightStepPercent
  );
}

function owns(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isColumnPresentation(value: unknown): value is ColumnPresentation {
  return value === "stacked" || value === "tabbed";
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
