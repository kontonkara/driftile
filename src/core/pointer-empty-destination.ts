import {
  solveStripGeometry,
  type Point,
  type Rect,
  type WindowHeightBounds,
} from "./geometry";
import { activityId, columnId, desktopId, outputId, windowId } from "./ids";
import type {
  ColumnPresentation,
  ColumnWidth,
  LayoutContextSnapshot,
  WindowHeight,
} from "./layout-engine";

export interface PointerEmptyDestinationColumnPolicy {
  readonly presentation: ColumnPresentation;
  readonly selected: boolean;
  readonly width: ColumnWidth;
  readonly windowHeight?: WindowHeight;
}

export interface PointerEmptyDestinationWindowConstraints extends WindowHeightBounds {
  readonly maximumFrameWidth?: number;
  readonly minimumFrameWidth?: number;
}

export interface PointerEmptyDestinationPreviewInput {
  readonly centerSingleColumn?: boolean;
  readonly column: PointerEmptyDestinationColumnPolicy;
  readonly constraints?: PointerEmptyDestinationWindowConstraints;
  readonly devicePixelRatio: number;
  readonly gap: number;
  readonly pixelGridOrigin: Point;
  readonly windowHeightPresetResolver?: (
    stateIndex: number,
  ) => ColumnWidth | null;
  readonly windowHeightPresets?: readonly ColumnWidth[];
  readonly workArea: Rect;
}

const PREVIEW_ACTIVITY_ID = activityId("pointer-preview-activity");
const PREVIEW_COLUMN_ID = columnId("pointer-preview-column");
const PREVIEW_DESKTOP_ID = desktopId("pointer-preview-desktop");
const PREVIEW_OUTPUT_ID = outputId("pointer-preview-output");
const PREVIEW_WINDOW_ID = windowId("pointer-preview-window");

export function planPointerEmptyDestinationPreview(
  input: PointerEmptyDestinationPreviewInput,
): Readonly<Rect> | null {
  try {
    if (!input.column.selected) {
      return null;
    }

    const context = syntheticSingletonContext(input.column);
    const windowHeightBounds = input.constraints
      ? new Map([[PREVIEW_WINDOW_ID, heightBounds(input.constraints)]])
      : undefined;
    const solved = solveStripGeometry({
      ...(input.centerSingleColumn === undefined
        ? {}
        : { centerSingleColumn: input.centerSingleColumn }),
      context,
      devicePixelRatio: input.devicePixelRatio,
      gap: input.gap,
      pixelGridOrigin: input.pixelGridOrigin,
      ...(windowHeightBounds ? { windowHeightBounds } : {}),
      ...(input.windowHeightPresetResolver === undefined
        ? {}
        : { windowHeightPresetResolver: input.windowHeightPresetResolver }),
      ...(input.windowHeightPresets === undefined
        ? {}
        : { windowHeightPresets: input.windowHeightPresets }),
      workArea: input.workArea,
    });
    const geometry = solved.windows[0];

    if (
      solved.windows.length !== 1 ||
      geometry?.windowId !== PREVIEW_WINDOW_ID ||
      !usableFrame(geometry.frame) ||
      !frameRespectsConstraints(geometry.frame, input.constraints)
    ) {
      return null;
    }

    return Object.freeze({ ...geometry.frame });
  } catch {
    return null;
  }
}

function syntheticSingletonContext(
  policy: PointerEmptyDestinationColumnPolicy,
): LayoutContextSnapshot {
  const width = Object.freeze({ ...policy.width });
  const windowHeight = policy.windowHeight
    ? Object.freeze({ ...policy.windowHeight })
    : undefined;
  const column = Object.freeze({
    id: PREVIEW_COLUMN_ID,
    presentation: policy.presentation,
    selectedWindowId: PREVIEW_WINDOW_ID,
    width,
    ...(windowHeight ? { windowHeights: Object.freeze([windowHeight]) } : {}),
    windowIds: Object.freeze([PREVIEW_WINDOW_ID]),
  });

  return Object.freeze({
    activeColumnId: PREVIEW_COLUMN_ID,
    activityId: PREVIEW_ACTIVITY_ID,
    columns: Object.freeze([column]),
    desktopId: PREVIEW_DESKTOP_ID,
    outputId: PREVIEW_OUTPUT_ID,
    viewportOffset: 0,
  });
}

function heightBounds(
  constraints: PointerEmptyDestinationWindowConstraints,
): WindowHeightBounds {
  return Object.freeze({
    ...(constraints.decorationHeight === undefined
      ? {}
      : { decorationHeight: constraints.decorationHeight }),
    ...(constraints.maximumClientHeight === undefined
      ? {}
      : { maximumClientHeight: constraints.maximumClientHeight }),
    ...(constraints.minimumClientHeight === undefined
      ? {}
      : { minimumClientHeight: constraints.minimumClientHeight }),
  });
}

function usableFrame(frame: Rect): boolean {
  return (
    Number.isFinite(frame.x) &&
    Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) &&
    frame.width > 0 &&
    Number.isFinite(frame.height) &&
    frame.height > 0
  );
}

function frameRespectsConstraints(
  frame: Rect,
  constraints: PointerEmptyDestinationWindowConstraints | undefined,
): boolean {
  if (!constraints) {
    return true;
  }

  const decorationHeight = constraints.decorationHeight ?? 0;
  const minimumClientHeight = constraints.minimumClientHeight ?? 0;
  const maximumClientHeight = constraints.maximumClientHeight;
  const minimumFrameWidth = constraints.minimumFrameWidth ?? 0;
  const maximumFrameWidth = constraints.maximumFrameWidth;

  if (
    !nonNegativeFinite(decorationHeight) ||
    !nonNegativeFinite(minimumClientHeight) ||
    !nonNegativeFinite(minimumFrameWidth) ||
    !validMaximum(maximumClientHeight) ||
    !validMaximum(maximumFrameWidth)
  ) {
    return false;
  }

  const minimumFrameHeight =
    Math.max(1, minimumClientHeight) + decorationHeight;
  const maximumFrameHeight =
    maximumClientHeight === undefined || maximumClientHeight <= 0
      ? Number.POSITIVE_INFINITY
      : maximumClientHeight + decorationHeight;
  const resolvedMaximumFrameWidth =
    maximumFrameWidth === undefined || maximumFrameWidth <= 0
      ? Number.POSITIVE_INFINITY
      : maximumFrameWidth;
  const tolerance = 1e-6;

  return (
    frame.width + tolerance >= minimumFrameWidth &&
    frame.width - tolerance <= resolvedMaximumFrameWidth &&
    frame.height + tolerance >= minimumFrameHeight &&
    frame.height - tolerance <= maximumFrameHeight
  );
}

function nonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validMaximum(value: number | undefined): boolean {
  return (
    value === undefined ||
    value === Number.POSITIVE_INFINITY ||
    nonNegativeFinite(value)
  );
}
