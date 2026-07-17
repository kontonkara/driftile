import {
  decodeApplicationColumnWidthOverrides,
  EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  sameApplicationColumnWidthOverrides,
  type ApplicationColumnWidthOverrides,
} from "./application-overrides";
import {
  decodeApplicationWindowHeightOverrides,
  EMPTY_APPLICATION_WINDOW_HEIGHT_OVERRIDES,
  sameApplicationWindowHeightOverrides,
  type ApplicationWindowHeightOverrides,
} from "./application-window-heights";
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
  decodeApplicationInitialDestinations,
  EMPTY_APPLICATION_INITIAL_DESTINATIONS,
  sameApplicationInitialDestinations,
  type ApplicationInitialDestination,
  type ApplicationInitialDestinations,
} from "./application-initial-destinations";
import {
  decodeApplicationInitialFocused,
  EMPTY_APPLICATION_INITIAL_FOCUSED,
  sameApplicationInitialFocused,
  type ApplicationInitialFocused,
} from "./application-initial-focused";
import {
  decodeApplicationInitialUnfocused,
  EMPTY_APPLICATION_INITIAL_UNFOCUSED,
  sameApplicationInitialUnfocused,
  type ApplicationInitialUnfocused,
} from "./application-initial-unfocused";
import {
  decodeApplicationFloatingPositions,
  EMPTY_APPLICATION_FLOATING_POSITIONS,
  sameApplicationFloatingPositions,
  type ApplicationFloatingPosition,
  type ApplicationFloatingPositions,
} from "./application-floating-positions";
import {
  decodeApplicationInitialFullWidth,
  EMPTY_APPLICATION_INITIAL_FULL_WIDTH,
  sameApplicationInitialFullWidth,
  type ApplicationInitialFullWidth,
} from "./application-initial-full-width";
import {
  decodeApplicationInitialFullscreen,
  EMPTY_APPLICATION_INITIAL_FULLSCREEN,
  sameApplicationInitialFullscreen,
  type ApplicationInitialFullscreen,
} from "./application-initial-fullscreen";
import {
  decodeApplicationInitialMaximized,
  EMPTY_APPLICATION_INITIAL_MAXIMIZED,
  sameApplicationInitialMaximized,
  type ApplicationInitialMaximized,
} from "./application-initial-maximized";
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
  AUTOMATIC_DEFAULT_WINDOW_HEIGHT,
  decodeDefaultWindowHeight,
  sameDefaultWindowHeights,
  type DefaultWindowHeight,
} from "./default-window-height";
import {
  decodeDefaultFloatingPosition,
  sameDefaultFloatingPositions,
} from "./default-floating-position";
import {
  decodeDefaultInitialDestination,
  sameDefaultInitialDestinations,
} from "./default-initial-destination";
import {
  decodeDefaultInitialFocus,
  DEFAULT_INITIAL_FOCUS,
  type DefaultInitialFocus,
} from "./default-initial-focus";
import {
  decodeWindowHeightPresetPercentages,
  EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
  sameWindowHeightPresetPercentages,
  type WindowHeightPresetPercentages,
} from "./window-height-presets";
import {
  decodeNumberedDesktopTargets,
  EMPTY_NUMBERED_DESKTOP_TARGETS,
  sameNumberedDesktopTargets,
  type NumberedDesktopTargets,
} from "./numbered-desktop-targets";

const MIN_GAP = 0;
const MAX_GAP = 64;
const MIN_DEFAULT_COLUMN_WIDTH_PIXELS = 0;
const MAX_DEFAULT_COLUMN_WIDTH_PIXELS = 16_384;
const MIN_DEFAULT_COLUMN_WIDTH_PERCENT = 10;
const MAX_DEFAULT_COLUMN_WIDTH_PERCENT = 100;
const MIN_RESIZE_STEP_PERCENT = 1;
const MAX_RESIZE_STEP_PERCENT = 50;
const MIN_RESIZE_STEP_PIXELS = 0;
const MAX_RESIZE_STEP_PIXELS = 16_384;
const MIN_TOUCHPAD_NAVIGATION_FINGER_COUNT = 3;
const MAX_TOUCHPAD_NAVIGATION_FINGER_COUNT = 5;
const SETTINGS_FIELD_COUNT = 41;

export interface DriftileSettings {
  readonly applicationBorderlessExclusions: ApplicationBorderlessExclusions;
  readonly applicationColumnPresentations: ApplicationColumnPresentations;
  readonly applicationColumnWidths: ApplicationColumnWidthOverrides;
  readonly applicationWindowHeights: ApplicationWindowHeightOverrides;
  readonly applicationFocusCentering: ApplicationFocusCentering;
  readonly applicationFloatingPositions: ApplicationFloatingPositions;
  readonly applicationInitialDestinations: ApplicationInitialDestinations;
  readonly applicationInitialFocused: ApplicationInitialFocused;
  readonly applicationInitialUnfocused: ApplicationInitialUnfocused;
  readonly applicationInitialFloating: ApplicationInitialFloating;
  readonly applicationInitialFullWidth: ApplicationInitialFullWidth;
  readonly applicationInitialFullscreen: ApplicationInitialFullscreen;
  readonly applicationInitialMaximized: ApplicationInitialMaximized;
  readonly applicationTilingExclusions: ApplicationTilingExclusions;
  readonly alwaysCenterSingleColumn: boolean;
  readonly borderlessWindows: boolean;
  readonly centerFocusedColumn: boolean;
  readonly centerFocusedColumnOnOverflow: boolean;
  readonly columnWidthPresets: ColumnWidthPresetPercentages;
  readonly columnWidthStepPixels: number;
  readonly columnWidthStepPercent: number;
  readonly defaultColumnPresentation: ColumnPresentation;
  readonly defaultColumnWidthPercent: number;
  readonly defaultColumnWidthPixels: number;
  readonly useInitialWindowWidth: boolean;
  readonly defaultFloatingPosition: ApplicationFloatingPosition | null;
  readonly defaultInitialDestination: ApplicationInitialDestination | null;
  readonly defaultInitialFocus: DefaultInitialFocus;
  readonly defaultWindowHeight: DefaultWindowHeight;
  readonly emptyDesktopAboveFirst: boolean;
  readonly gap: number;
  readonly numberedDesktopTargets: NumberedDesktopTargets;
  readonly showTabIndicator: boolean;
  readonly touchpadNavigation: boolean;
  readonly touchpadNavigationFingerCount: number;
  readonly touchpadNaturalScroll: boolean;
  readonly touchpadWorkspaceNavigation: boolean;
  readonly workspaceAutoBackAndForth: boolean;
  readonly windowHeightPresets: WindowHeightPresetPercentages;
  readonly windowHeightStepPixels: number;
  readonly windowHeightStepPercent: number;
}

export const DEFAULT_DRIFTILE_SETTINGS: DriftileSettings = Object.freeze({
  applicationBorderlessExclusions: EMPTY_APPLICATION_BORDERLESS_EXCLUSIONS,
  applicationColumnPresentations: EMPTY_APPLICATION_COLUMN_PRESENTATIONS,
  applicationColumnWidths: EMPTY_APPLICATION_COLUMN_WIDTH_OVERRIDES,
  applicationWindowHeights: EMPTY_APPLICATION_WINDOW_HEIGHT_OVERRIDES,
  applicationFocusCentering: EMPTY_APPLICATION_FOCUS_CENTERING,
  applicationFloatingPositions: EMPTY_APPLICATION_FLOATING_POSITIONS,
  applicationInitialDestinations: EMPTY_APPLICATION_INITIAL_DESTINATIONS,
  applicationInitialFocused: EMPTY_APPLICATION_INITIAL_FOCUSED,
  applicationInitialUnfocused: EMPTY_APPLICATION_INITIAL_UNFOCUSED,
  applicationInitialFloating: EMPTY_APPLICATION_INITIAL_FLOATING,
  applicationInitialFullWidth: EMPTY_APPLICATION_INITIAL_FULL_WIDTH,
  applicationInitialFullscreen: EMPTY_APPLICATION_INITIAL_FULLSCREEN,
  applicationInitialMaximized: EMPTY_APPLICATION_INITIAL_MAXIMIZED,
  applicationTilingExclusions: EMPTY_APPLICATION_TILING_EXCLUSIONS,
  alwaysCenterSingleColumn: false,
  borderlessWindows: true,
  centerFocusedColumn: false,
  centerFocusedColumnOnOverflow: false,
  columnWidthPresets: EMPTY_COLUMN_WIDTH_PRESET_PERCENTAGES,
  columnWidthStepPixels: 0,
  columnWidthStepPercent: 10,
  defaultColumnPresentation: "stacked",
  defaultColumnWidthPercent: 33,
  defaultColumnWidthPixels: 0,
  useInitialWindowWidth: false,
  defaultFloatingPosition: null,
  defaultInitialDestination: null,
  defaultInitialFocus: DEFAULT_INITIAL_FOCUS,
  defaultWindowHeight: AUTOMATIC_DEFAULT_WINDOW_HEIGHT,
  emptyDesktopAboveFirst: false,
  gap: 16,
  numberedDesktopTargets: EMPTY_NUMBERED_DESKTOP_TARGETS,
  showTabIndicator: true,
  touchpadNavigation: false,
  touchpadNavigationFingerCount: 5,
  touchpadNaturalScroll: true,
  touchpadWorkspaceNavigation: false,
  workspaceAutoBackAndForth: false,
  windowHeightPresets: EMPTY_WINDOW_HEIGHT_PRESET_PERCENTAGES,
  windowHeightStepPixels: 0,
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
    !owns(candidate, "applicationWindowHeights") ||
    !owns(candidate, "applicationFocusCentering") ||
    !owns(candidate, "applicationFloatingPositions") ||
    !owns(candidate, "applicationInitialDestinations") ||
    !owns(candidate, "applicationInitialFocused") ||
    !owns(candidate, "applicationInitialUnfocused") ||
    !owns(candidate, "applicationInitialFloating") ||
    !owns(candidate, "applicationInitialFullWidth") ||
    !owns(candidate, "applicationInitialFullscreen") ||
    !owns(candidate, "applicationInitialMaximized") ||
    !owns(candidate, "applicationTilingExclusions") ||
    !owns(candidate, "alwaysCenterSingleColumn") ||
    !owns(candidate, "borderlessWindows") ||
    !owns(candidate, "centerFocusedColumn") ||
    !owns(candidate, "centerFocusedColumnOnOverflow") ||
    !owns(candidate, "columnWidthPresets") ||
    !owns(candidate, "columnWidthStepPixels") ||
    !owns(candidate, "columnWidthStepPercent") ||
    !owns(candidate, "defaultColumnPresentation") ||
    !owns(candidate, "defaultColumnWidthPercent") ||
    !owns(candidate, "defaultColumnWidthPixels") ||
    !owns(candidate, "useInitialWindowWidth") ||
    !owns(candidate, "defaultFloatingPosition") ||
    !owns(candidate, "defaultInitialDestination") ||
    !owns(candidate, "defaultInitialFocus") ||
    !owns(candidate, "defaultWindowHeight") ||
    !owns(candidate, "emptyDesktopAboveFirst") ||
    !owns(candidate, "gap") ||
    !owns(candidate, "numberedDesktopTargets") ||
    !owns(candidate, "showTabIndicator") ||
    !owns(candidate, "touchpadNavigation") ||
    !owns(candidate, "touchpadNavigationFingerCount") ||
    !owns(candidate, "touchpadNaturalScroll") ||
    !owns(candidate, "touchpadWorkspaceNavigation") ||
    !owns(candidate, "workspaceAutoBackAndForth") ||
    !owns(candidate, "windowHeightPresets") ||
    !owns(candidate, "windowHeightStepPixels") ||
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
  const applicationWindowHeights = decodeApplicationWindowHeightOverrides(
    candidate["applicationWindowHeights"],
  );
  const applicationFocusCentering = decodeApplicationFocusCentering(
    candidate["applicationFocusCentering"],
  );
  const applicationFloatingPositions = decodeApplicationFloatingPositions(
    candidate["applicationFloatingPositions"],
  );
  const applicationInitialDestinations = decodeApplicationInitialDestinations(
    candidate["applicationInitialDestinations"],
  );
  const applicationInitialFocused = decodeApplicationInitialFocused(
    candidate["applicationInitialFocused"],
  );
  const applicationInitialUnfocused = decodeApplicationInitialUnfocused(
    candidate["applicationInitialUnfocused"],
  );
  const applicationInitialFloating = decodeApplicationInitialFloating(
    candidate["applicationInitialFloating"],
  );
  const applicationInitialFullWidth = decodeApplicationInitialFullWidth(
    candidate["applicationInitialFullWidth"],
  );
  const applicationInitialFullscreen = decodeApplicationInitialFullscreen(
    candidate["applicationInitialFullscreen"],
  );
  const applicationInitialMaximized = decodeApplicationInitialMaximized(
    candidate["applicationInitialMaximized"],
  );
  const applicationTilingExclusions = decodeApplicationTilingExclusions(
    candidate["applicationTilingExclusions"],
  );
  const alwaysCenterSingleColumn = candidate["alwaysCenterSingleColumn"];
  const borderlessWindows = candidate["borderlessWindows"];
  const centerFocusedColumn = candidate["centerFocusedColumn"];
  const centerFocusedColumnOnOverflow =
    candidate["centerFocusedColumnOnOverflow"];
  const columnWidthPresets = decodeColumnWidthPresetPercentages(
    candidate["columnWidthPresets"],
  );
  const columnWidthStepPixels = candidate["columnWidthStepPixels"];
  const columnWidthStepPercent = candidate["columnWidthStepPercent"];
  const defaultColumnPresentation = candidate["defaultColumnPresentation"];
  const defaultColumnWidthPercent = candidate["defaultColumnWidthPercent"];
  const defaultColumnWidthPixels = candidate["defaultColumnWidthPixels"];
  const useInitialWindowWidth = candidate["useInitialWindowWidth"];
  const decodedDefaultFloatingPosition = decodeDefaultFloatingPosition(
    candidate["defaultFloatingPosition"],
  );
  const decodedDefaultInitialDestination = decodeDefaultInitialDestination(
    candidate["defaultInitialDestination"],
  );
  const defaultInitialFocus = decodeDefaultInitialFocus(
    candidate["defaultInitialFocus"],
  );
  const defaultWindowHeight = decodeDefaultWindowHeight(
    candidate["defaultWindowHeight"],
  );
  const emptyDesktopAboveFirst = candidate["emptyDesktopAboveFirst"];
  const gap = candidate["gap"];
  const numberedDesktopTargets = decodeNumberedDesktopTargets(
    candidate["numberedDesktopTargets"],
  );
  const showTabIndicator = candidate["showTabIndicator"];
  const touchpadNavigation = candidate["touchpadNavigation"];
  const touchpadNavigationFingerCount =
    candidate["touchpadNavigationFingerCount"];
  const touchpadNaturalScroll = candidate["touchpadNaturalScroll"];
  const touchpadWorkspaceNavigation = candidate["touchpadWorkspaceNavigation"];
  const workspaceAutoBackAndForth = candidate["workspaceAutoBackAndForth"];
  const windowHeightPresets = decodeWindowHeightPresetPercentages(
    candidate["windowHeightPresets"],
  );
  const windowHeightStepPixels = candidate["windowHeightStepPixels"];
  const windowHeightStepPercent = candidate["windowHeightStepPercent"];

  if (
    !applicationBorderlessExclusions ||
    !applicationColumnPresentations ||
    !applicationColumnWidths ||
    !applicationWindowHeights ||
    !applicationFocusCentering ||
    !applicationFloatingPositions ||
    !applicationInitialDestinations ||
    !applicationInitialFocused ||
    !applicationInitialUnfocused ||
    !applicationInitialFloating ||
    !applicationInitialFullWidth ||
    !applicationInitialFullscreen ||
    !applicationInitialMaximized ||
    !applicationTilingExclusions ||
    typeof alwaysCenterSingleColumn !== "boolean" ||
    typeof borderlessWindows !== "boolean" ||
    typeof centerFocusedColumn !== "boolean" ||
    typeof centerFocusedColumnOnOverflow !== "boolean" ||
    !columnWidthPresets ||
    !isBoundedInteger(
      columnWidthStepPixels,
      MIN_RESIZE_STEP_PIXELS,
      MAX_RESIZE_STEP_PIXELS,
    ) ||
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
    !isBoundedInteger(
      defaultColumnWidthPixels,
      MIN_DEFAULT_COLUMN_WIDTH_PIXELS,
      MAX_DEFAULT_COLUMN_WIDTH_PIXELS,
    ) ||
    typeof useInitialWindowWidth !== "boolean" ||
    !decodedDefaultFloatingPosition ||
    !decodedDefaultInitialDestination ||
    !defaultInitialFocus ||
    !defaultWindowHeight ||
    typeof emptyDesktopAboveFirst !== "boolean" ||
    !isBoundedNumber(gap, MIN_GAP, MAX_GAP) ||
    !numberedDesktopTargets ||
    typeof showTabIndicator !== "boolean" ||
    typeof touchpadNavigation !== "boolean" ||
    !isBoundedInteger(
      touchpadNavigationFingerCount,
      MIN_TOUCHPAD_NAVIGATION_FINGER_COUNT,
      MAX_TOUCHPAD_NAVIGATION_FINGER_COUNT,
    ) ||
    typeof touchpadNaturalScroll !== "boolean" ||
    typeof touchpadWorkspaceNavigation !== "boolean" ||
    typeof workspaceAutoBackAndForth !== "boolean" ||
    !windowHeightPresets ||
    !isBoundedInteger(
      windowHeightStepPixels,
      MIN_RESIZE_STEP_PIXELS,
      MAX_RESIZE_STEP_PIXELS,
    ) ||
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
    applicationWindowHeights,
    applicationFocusCentering,
    applicationFloatingPositions,
    applicationInitialDestinations,
    applicationInitialFocused,
    applicationInitialUnfocused,
    applicationInitialFloating,
    applicationInitialFullWidth,
    applicationInitialFullscreen,
    applicationInitialMaximized,
    applicationTilingExclusions,
    alwaysCenterSingleColumn,
    borderlessWindows,
    centerFocusedColumn,
    centerFocusedColumnOnOverflow,
    columnWidthPresets,
    columnWidthStepPixels,
    columnWidthStepPercent,
    defaultColumnPresentation,
    defaultColumnWidthPercent,
    defaultColumnWidthPixels,
    useInitialWindowWidth,
    defaultFloatingPosition: decodedDefaultFloatingPosition.floatingPosition,
    defaultInitialDestination:
      decodedDefaultInitialDestination.initialDestination,
    defaultInitialFocus,
    defaultWindowHeight,
    emptyDesktopAboveFirst,
    gap,
    numberedDesktopTargets,
    showTabIndicator,
    touchpadNavigation,
    touchpadNavigationFingerCount,
    touchpadNaturalScroll,
    touchpadWorkspaceNavigation,
    workspaceAutoBackAndForth,
    windowHeightPresets,
    windowHeightStepPixels,
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
    sameApplicationWindowHeightOverrides(
      left.applicationWindowHeights,
      right.applicationWindowHeights,
    ) &&
    sameApplicationFocusCentering(
      left.applicationFocusCentering,
      right.applicationFocusCentering,
    ) &&
    sameApplicationFloatingPositions(
      left.applicationFloatingPositions,
      right.applicationFloatingPositions,
    ) &&
    sameApplicationInitialDestinations(
      left.applicationInitialDestinations,
      right.applicationInitialDestinations,
    ) &&
    sameApplicationInitialFocused(
      left.applicationInitialFocused,
      right.applicationInitialFocused,
    ) &&
    sameApplicationInitialUnfocused(
      left.applicationInitialUnfocused,
      right.applicationInitialUnfocused,
    ) &&
    sameApplicationInitialFloating(
      left.applicationInitialFloating,
      right.applicationInitialFloating,
    ) &&
    sameApplicationInitialFullWidth(
      left.applicationInitialFullWidth,
      right.applicationInitialFullWidth,
    ) &&
    sameApplicationInitialFullscreen(
      left.applicationInitialFullscreen,
      right.applicationInitialFullscreen,
    ) &&
    sameApplicationInitialMaximized(
      left.applicationInitialMaximized,
      right.applicationInitialMaximized,
    ) &&
    sameApplicationTilingExclusions(
      left.applicationTilingExclusions,
      right.applicationTilingExclusions,
    ) &&
    left.alwaysCenterSingleColumn === right.alwaysCenterSingleColumn &&
    left.borderlessWindows === right.borderlessWindows &&
    left.centerFocusedColumn === right.centerFocusedColumn &&
    left.centerFocusedColumnOnOverflow ===
      right.centerFocusedColumnOnOverflow &&
    sameColumnWidthPresetPercentages(
      left.columnWidthPresets,
      right.columnWidthPresets,
    ) &&
    left.columnWidthStepPixels === right.columnWidthStepPixels &&
    left.columnWidthStepPercent === right.columnWidthStepPercent &&
    left.defaultColumnPresentation === right.defaultColumnPresentation &&
    left.defaultColumnWidthPercent === right.defaultColumnWidthPercent &&
    left.defaultColumnWidthPixels === right.defaultColumnWidthPixels &&
    left.useInitialWindowWidth === right.useInitialWindowWidth &&
    sameDefaultFloatingPositions(
      left.defaultFloatingPosition,
      right.defaultFloatingPosition,
    ) &&
    sameDefaultInitialDestinations(
      left.defaultInitialDestination,
      right.defaultInitialDestination,
    ) &&
    left.defaultInitialFocus === right.defaultInitialFocus &&
    sameDefaultWindowHeights(
      left.defaultWindowHeight,
      right.defaultWindowHeight,
    ) &&
    left.emptyDesktopAboveFirst === right.emptyDesktopAboveFirst &&
    left.gap === right.gap &&
    sameNumberedDesktopTargets(
      left.numberedDesktopTargets,
      right.numberedDesktopTargets,
    ) &&
    left.showTabIndicator === right.showTabIndicator &&
    left.touchpadNavigation === right.touchpadNavigation &&
    left.touchpadNavigationFingerCount ===
      right.touchpadNavigationFingerCount &&
    left.touchpadNaturalScroll === right.touchpadNaturalScroll &&
    left.touchpadWorkspaceNavigation === right.touchpadWorkspaceNavigation &&
    left.workspaceAutoBackAndForth === right.workspaceAutoBackAndForth &&
    sameWindowHeightPresetPercentages(
      left.windowHeightPresets,
      right.windowHeightPresets,
    ) &&
    left.windowHeightStepPixels === right.windowHeightStepPixels &&
    left.windowHeightStepPercent === right.windowHeightStepPercent
  );
}

function owns(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isColumnPresentation(value: unknown): value is ColumnPresentation {
  return value === "stacked" || value === "tabbed";
}

function isBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
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
