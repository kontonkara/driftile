import type { Point, Rect } from "../../core/geometry";
import type { ActivityId, DesktopId, OutputId, WindowId } from "../../core/ids";
import type { GeometryChange } from "../../core/reconcile";
import type { KWinVirtualDesktop, KWinWindow, KWinWorkspace } from "./api";

export interface ContextGeometry {
  readonly devicePixelRatio: number;
  readonly fingerprint: string;
  readonly pixelGridOrigin: Point;
  readonly workArea: Rect;
}

export interface WindowContext {
  readonly activityId?: ActivityId;
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

export interface FrameSizeConstraintBounds {
  readonly maximumHeight: number;
  readonly maximumWidth: number;
  readonly minimumHeight: number;
  readonly minimumWidth: number;
}

const GEOMETRY_EPSILON = 1e-6;

export interface KWinWindowLookup {
  source(windowId: string): KWinWindow | undefined;
}

export type KWinWriteAuthority = (
  windowId: WindowId,
  window: KWinWindow,
) => boolean;

export type KWinRectFactory = (
  x: number,
  y: number,
  width: number,
  height: number,
) => Rect;

export class KWinGeometryAdapter {
  private readonly clientAreaOption: number;
  private readonly createRect: KWinRectFactory;
  private readonly hasWriteAuthority: KWinWriteAuthority;
  private readonly windows: KWinWindowLookup;
  private readonly workspace: KWinWorkspace;

  constructor(
    workspace: KWinWorkspace,
    windows: KWinWindowLookup,
    clientAreaOption: number,
    createRect: KWinRectFactory = defaultRectFactory,
    hasWriteAuthority: KWinWriteAuthority = allowWrite,
  ) {
    this.clientAreaOption = clientAreaOption;
    this.createRect = createRect;
    this.hasWriteAuthority = hasWriteAuthority;
    this.windows = windows;
    this.workspace = workspace;
  }

  contextGeometry(
    outputId: OutputId,
    desktopId: DesktopId,
  ): ContextGeometry | null {
    const output = this.workspace.screens.find(
      (candidate) => candidate.name === outputId,
    );
    const desktop = this.findDesktop(desktopId);

    if (!output || !desktop) {
      return null;
    }

    const outputGeometry = toRect(output.geometry);
    const workArea = toRect(
      this.workspace.clientArea(this.clientAreaOption, output, desktop),
    );

    return {
      devicePixelRatio: output.devicePixelRatio,
      fingerprint: createContextFingerprint(
        output.devicePixelRatio,
        outputGeometry,
        workArea,
      ),
      pixelGridOrigin: {
        x: outputGeometry.x,
        y: outputGeometry.y,
      },
      workArea,
    };
  }

  observedFrames(
    windowIds: readonly WindowId[],
    context: WindowContext,
  ): ReadonlyMap<WindowId, Rect> {
    const frames = new Map<WindowId, Rect>();

    for (const windowId of windowIds) {
      const window = this.windows.source(windowId);

      if (
        window &&
        this.hasWriteAuthority(windowId, window) &&
        isWindowInContext(window, context, this.workspace.activities) &&
        isGeometryWritable(window)
      ) {
        frames.set(windowId, toRect(window.frameGeometry));
      }
    }

    return frames;
  }

  canApplyFrame(
    windowId: WindowId,
    frame: Rect,
    context: WindowContext,
  ): boolean {
    const window = this.windows.source(windowId);
    return Boolean(
      window &&
      this.hasWriteAuthority(windowId, window) &&
      canApplyToWindow(window, frame, context, this.workspace.activities),
    );
  }

  apply(
    changes: readonly GeometryChange[],
    context: WindowContext,
    canContinue?: (change: GeometryChange) => boolean,
  ): number {
    let writeCount = 0;

    for (const change of changes) {
      if (canContinue && !canContinue(change)) {
        break;
      }

      const window = this.windows.source(change.windowId);

      if (
        !window ||
        !this.hasWriteAuthority(change.windowId, window) ||
        !canApplyToWindow(
          window,
          change.frame,
          context,
          this.workspace.activities,
        )
      ) {
        continue;
      }

      try {
        window.frameGeometry = this.createRect(
          change.frame.x,
          change.frame.y,
          change.frame.width,
          change.frame.height,
        );
        writeCount += 1;
      } catch (error) {
        console.warn(
          `[driftile] geometry write failed window=${String(change.windowId)} error=${String(error)}`,
        );
      }
    }

    return writeCount;
  }

  private findDesktop(desktopId: DesktopId): KWinVirtualDesktop | undefined {
    return this.workspace.desktops.find(
      (candidate) => candidate.id === desktopId,
    );
  }
}

export function isGeometryWritable(window: KWinWindow): boolean {
  return (
    window.managed &&
    !window.deleted &&
    !hasGeometryAuthorityBlocker(window) &&
    window.moveable &&
    window.resizeable
  );
}

export function hasGeometryAuthorityBlocker(window: KWinWindow): boolean {
  return (
    window.fullScreen ||
    window.minimized ||
    window.maximizeMode !== 0 ||
    window.move ||
    window.resize ||
    window.tile !== null
  );
}

export function isWindowInContext(
  window: KWinWindow,
  context: WindowContext,
  activities?: readonly string[],
): boolean {
  return (
    window.normalWindow &&
    !window.dialog &&
    !window.specialWindow &&
    !window.onAllDesktops &&
    window.output?.name === context.outputId &&
    window.desktops.length === 1 &&
    window.desktops[0]?.id === context.desktopId &&
    windowMatchesActivity(window, context.activityId, activities)
  );
}

function windowMatchesActivity(
  window: KWinWindow,
  activity: ActivityId | undefined,
  activities: readonly string[] | undefined,
): boolean {
  if (activity === undefined || window.activities === undefined) {
    return true;
  }

  if (window.activities.length === 1) {
    return window.activities[0] === activity;
  }

  return window.activities.length === 0 && (activities?.length ?? 0) <= 1;
}

export function respectsSizeConstraints(
  frame: Rect,
  window: KWinWindow,
): boolean {
  const frameGeometry = window.frameGeometry;
  const clientGeometry = window.clientGeometry;
  const horizontalDecoration = decorationExtent(
    frameGeometry.width,
    clientGeometry.width,
  );
  const verticalDecoration = decorationExtent(
    frameGeometry.height,
    clientGeometry.height,
  );

  if (horizontalDecoration === null || verticalDecoration === null) {
    return false;
  }

  const minimumSize = window.minSize;
  const minimumWidth = minimumFrameBound(
    minimumSize.width,
    horizontalDecoration,
  );
  const minimumHeight = minimumFrameBound(
    minimumSize.height,
    verticalDecoration,
  );

  if (minimumWidth === null || minimumHeight === null) {
    return false;
  }

  const maximumSize = window.maxSize;
  const maximumWidth = maximumFrameBound(
    maximumSize.width,
    horizontalDecoration,
  );
  const maximumHeight = maximumFrameBound(
    maximumSize.height,
    verticalDecoration,
  );

  return (
    Number.isFinite(frame.width) &&
    frame.width >= 0 &&
    Number.isFinite(frame.height) &&
    frame.height >= 0 &&
    minimumAllows(frame.width, minimumWidth) &&
    minimumAllows(frame.height, minimumHeight) &&
    maximumAllows(frame.width, maximumWidth) &&
    maximumAllows(frame.height, maximumHeight)
  );
}

export function frameSizeConstraintBounds(
  window: KWinWindow,
): FrameSizeConstraintBounds | null {
  const frameGeometry = window.frameGeometry;
  const clientGeometry = window.clientGeometry;
  const horizontalDecoration = decorationExtent(
    frameGeometry.width,
    clientGeometry.width,
  );
  const verticalDecoration = decorationExtent(
    frameGeometry.height,
    clientGeometry.height,
  );

  if (horizontalDecoration === null || verticalDecoration === null) {
    return null;
  }

  const minimumSize = window.minSize;
  const minimumWidth = minimumFrameBound(
    minimumSize.width,
    horizontalDecoration,
  );
  const minimumHeight = minimumFrameBound(
    minimumSize.height,
    verticalDecoration,
  );

  if (minimumWidth === null || minimumHeight === null) {
    return null;
  }

  const maximumSize = window.maxSize;

  return {
    maximumHeight: maximumFrameBound(maximumSize.height, verticalDecoration),
    maximumWidth: maximumFrameBound(maximumSize.width, horizontalDecoration),
    minimumHeight,
    minimumWidth,
  };
}

function canApplyToWindow(
  window: KWinWindow,
  frame: Rect,
  context: WindowContext,
  activities: readonly string[] | undefined,
): boolean {
  return (
    isWindowInContext(window, context, activities) &&
    isGeometryWritable(window) &&
    respectsSizeConstraints(frame, window)
  );
}

function minimumAllows(value: number, minimum: number): boolean {
  return Number.isFinite(minimum) && value + GEOMETRY_EPSILON >= minimum;
}

function maximumAllows(value: number, maximum: number): boolean {
  return (
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    value <= maximum + GEOMETRY_EPSILON
  );
}

function decorationExtent(
  frameSize: number,
  clientSize: number,
): number | null {
  if (
    !Number.isFinite(frameSize) ||
    frameSize < 0 ||
    !Number.isFinite(clientSize) ||
    clientSize < 0
  ) {
    return null;
  }

  const extent = frameSize - clientSize;

  // Clamp only sub-pixel rounding noise; larger negative extents are invalid.
  if (extent < -GEOMETRY_EPSILON) {
    return null;
  }

  return extent > 0 ? extent : 0;
}

function minimumFrameBound(minimum: number, extent: number): number | null {
  if (!Number.isFinite(minimum) || minimum < 0) {
    return null;
  }

  const bound = minimum + extent;
  return Number.isFinite(bound) ? bound : null;
}

function maximumFrameBound(maximum: number, extent: number): number {
  if (!Number.isFinite(maximum) || maximum <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const bound = maximum + extent;
  return Number.isFinite(bound) ? bound : Number.POSITIVE_INFINITY;
}

function toRect(rect: Rect): Rect {
  return {
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  };
}

function defaultRectFactory(
  x: number,
  y: number,
  width: number,
  height: number,
): Rect {
  return { height, width, x, y };
}

function allowWrite(): boolean {
  return true;
}

function createContextFingerprint(
  devicePixelRatio: number,
  outputGeometry: Rect,
  workArea: Rect,
): string {
  return [
    devicePixelRatio,
    outputGeometry.x,
    outputGeometry.y,
    outputGeometry.width,
    outputGeometry.height,
    workArea.x,
    workArea.y,
    workArea.width,
    workArea.height,
  ].join("\u0000");
}
