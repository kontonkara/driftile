import type { Point, Rect } from "../../core/geometry";
import type { DesktopId, OutputId, WindowId } from "../../core/ids";
import type { GeometryChange } from "../../core/reconcile";
import type { KWinVirtualDesktop, KWinWindow, KWinWorkspace } from "./api";

export interface ContextGeometry {
  readonly devicePixelRatio: number;
  readonly fingerprint: string;
  readonly pixelGridOrigin: Point;
  readonly workArea: Rect;
}

export interface WindowContext {
  readonly desktopId: DesktopId;
  readonly outputId: OutputId;
}

export interface KWinWindowLookup {
  source(windowId: string): KWinWindow | undefined;
}

export type KWinRectFactory = (
  x: number,
  y: number,
  width: number,
  height: number,
) => Rect;

export class KWinGeometryAdapter {
  private readonly clientAreaOption: number;
  private readonly createRect: KWinRectFactory;
  private readonly windows: KWinWindowLookup;
  private readonly workspace: KWinWorkspace;

  constructor(
    workspace: KWinWorkspace,
    windows: KWinWindowLookup,
    clientAreaOption: number,
    createRect: KWinRectFactory = defaultRectFactory,
  ) {
    this.clientAreaOption = clientAreaOption;
    this.createRect = createRect;
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
        isWindowInContext(window, context) &&
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
    return Boolean(window && canApplyToWindow(window, frame, context));
  }

  apply(changes: readonly GeometryChange[], context: WindowContext): number {
    let writeCount = 0;

    for (const change of changes) {
      const window = this.windows.source(change.windowId);

      if (!window || !canApplyToWindow(window, change.frame, context)) {
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
    !window.fullScreen &&
    !window.minimized &&
    !window.move &&
    !window.resize &&
    window.moveable &&
    window.resizeable &&
    window.maximizeMode === 0 &&
    window.tile === null
  );
}

export function isWindowInContext(
  window: KWinWindow,
  context: WindowContext,
): boolean {
  return (
    window.normalWindow &&
    !window.dialog &&
    !window.specialWindow &&
    !window.onAllDesktops &&
    window.output?.name === context.outputId &&
    window.desktops.length === 1 &&
    window.desktops[0]?.id === context.desktopId
  );
}

export function respectsSizeConstraints(
  frame: Rect,
  window: KWinWindow,
): boolean {
  return (
    minimumAllows(frame.width, window.minSize.width) &&
    minimumAllows(frame.height, window.minSize.height) &&
    maximumAllows(frame.width, window.maxSize.width) &&
    maximumAllows(frame.height, window.maxSize.height)
  );
}

function canApplyToWindow(
  window: KWinWindow,
  frame: Rect,
  context: WindowContext,
): boolean {
  return (
    isWindowInContext(window, context) &&
    isGeometryWritable(window) &&
    respectsSizeConstraints(frame, window)
  );
}

function minimumAllows(value: number, minimum: number): boolean {
  return Number.isFinite(minimum) && value + 1e-6 >= minimum;
}

function maximumAllows(value: number, maximum: number): boolean {
  return !Number.isFinite(maximum) || maximum <= 0 || value <= maximum + 1e-6;
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
