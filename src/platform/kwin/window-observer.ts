import type { KWinOutput, KWinRect, KWinWindow, KWinWorkspace } from "./api";

export type ObservedWindowKind = "dialog" | "normal" | "other";
export type WindowSuspensionRequest =
  | "maximized-requested"
  | "maximized-settling"
  | "native-tile-committed"
  | "native-tile-requested"
  | "native-tile-settling";

export interface ObservedWindow {
  readonly desktopIds: readonly string[];
  readonly id: string;
  readonly kind: ObservedWindowKind;
  readonly outputId: string;
}

export interface WindowObserverEvents {
  readonly added?: (window: ObservedWindow) => void;
  readonly changed?: (windowId: string) => void;
  readonly fullScreenChanged?: (windowId: string, fullScreen: boolean) => void;
  readonly maximizedAboutToChange?: (windowId: string, mode: number) => void;
  readonly removed?: (windowId: string) => void;
  readonly suspensionSettled?: (
    windowId: string,
    request: WindowSuspensionRequest,
  ) => void;
  readonly stateChanged?: (windowId: string) => void;
  readonly suspending?: (
    windowId: string,
    request: WindowSuspensionRequest,
  ) => void;
  readonly tracked?: (windowId: string) => void;
}

interface WindowEntry {
  readonly handleAutomaticFloatingChanged: () => void;
  readonly handleClientGeometryChanged: (oldGeometry: KWinRect) => void;
  readonly handleConstraintChanged: () => void;
  readonly handleDecorationPolicyChanged: () => void;
  readonly handleDesktopsChanged: () => void;
  readonly handleFullScreenChanged: () => void;
  readonly handleFrameGeometryChanged: (oldGeometry: KWinRect) => void;
  readonly handleInteractiveStateChanged: () => void;
  readonly handleMaximizedAboutToChange: (mode: number) => void;
  readonly handleMaximizedChanged: () => void;
  readonly handleOutputChanged: (oldOutput?: KWinOutput | null) => void;
  readonly handleRequestedTileChanged: () => void;
  readonly handleStateChanged: () => void;
  readonly handleTileChanged: (tile: object | null) => void;
  constraintFingerprint: string;
  observed: ObservedWindow | null;
  readonly source: KWinWindow;
}

const INVALID_CONSTRAINT_FINGERPRINT = "invalid";
const CONSTRAINT_EPSILON = 1e-6;

export class WindowObserver {
  private readonly events: WindowObserverEvents;
  private readonly windows = new Map<string, WindowEntry>();
  private readonly workspace: KWinWorkspace;
  private started = false;

  constructor(workspace: KWinWorkspace, events: WindowObserverEvents = {}) {
    this.events = events;
    this.workspace = workspace;
  }

  get size(): number {
    return this.windows.size;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.workspace.windowAdded.connect(this.handleWindowAdded);
    this.workspace.windowRemoved.connect(this.handleWindowRemoved);

    this.discoverWindows();
  }

  discoverWindows(): void {
    if (!this.started) {
      return;
    }

    for (const window of this.workspace.stackingOrder) {
      this.add(window);
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.workspace.windowAdded.disconnect(this.handleWindowAdded);
    this.workspace.windowRemoved.disconnect(this.handleWindowRemoved);

    for (const entry of this.windows.values()) {
      disconnectWindowSignals(entry);
    }

    this.windows.clear();
    this.started = false;
  }

  snapshot(): readonly ObservedWindow[] {
    const windows: ObservedWindow[] = [];

    for (const entry of this.windows.values()) {
      if (entry.observed) {
        windows.push(entry.observed);
      }
    }

    return windows;
  }

  source(windowId: string): KWinWindow | undefined {
    return this.windows.get(windowId)?.source;
  }

  probeVisibleConstraintChanges(): number {
    if (!this.started) {
      return 0;
    }

    const selectedDesktopIds = this.selectedDesktopIdsByOutput();
    let changedCount = 0;

    for (const [id, entry] of [...this.windows]) {
      if (
        this.windows.get(id) !== entry ||
        !entry.observed ||
        entry.source.minimized
      ) {
        continue;
      }

      const selectedDesktopId = selectedDesktopIds.get(entry.observed.outputId);

      if (
        !selectedDesktopId ||
        !entry.observed.desktopIds.includes(selectedDesktopId)
      ) {
        continue;
      }

      if (this.refreshConstraintFingerprint(id, entry.source)) {
        changedCount += 1;
      }
    }

    return changedCount;
  }

  private readonly handleWindowAdded = (window: KWinWindow): void => {
    this.add(window);
  };

  private readonly handleWindowRemoved = (window: KWinWindow): void => {
    const id = windowId(window);
    const entry = this.windows.get(id);

    if (entry && entry.source === window) {
      disconnectWindowSignals(entry);
      this.windows.delete(id);
      this.events.removed?.(id);
    }
  };

  private add(window: KWinWindow): void {
    if (!isTrackableWindow(window)) {
      return;
    }

    const id = windowId(window);
    const observedWindow = normalizeWindow(window);

    if (this.windows.has(id)) {
      return;
    }

    const refresh = (): void => {
      this.refresh(id, window);
    };
    const refreshState = (): void => {
      this.refreshState(id, window);
    };
    const refreshConstraint = (): void => {
      this.refreshConstraintFingerprint(id, window);
    };
    const refreshClientGeometry = (oldGeometry: KWinRect): void => {
      if (geometrySizeChanged(oldGeometry, window, "clientGeometry")) {
        refreshConstraint();
      }
    };
    const refreshFrameGeometry = (oldGeometry: KWinRect): void => {
      if (geometrySizeChanged(oldGeometry, window, "frameGeometry")) {
        refreshConstraint();
      }
    };
    const refreshInteractiveState = (): void => {
      refreshConstraint();
      refreshState();
    };
    const refreshDecorationPolicy = (): void => {
      refreshConstraint();
      refreshState();
    };
    const refreshAutomaticFloating = (): void => {
      this.refresh(id, window, true);
    };
    let committedTile: object | null | undefined;
    let maximizeRequested = window.maximizeMode !== 0;
    let tileRequested = window.tile !== null;
    const entry: WindowEntry = {
      handleAutomaticFloatingChanged: refreshAutomaticFloating,
      handleClientGeometryChanged: refreshClientGeometry,
      handleConstraintChanged: refreshConstraint,
      handleDecorationPolicyChanged: refreshDecorationPolicy,
      handleDesktopsChanged: refresh,
      handleFullScreenChanged: () => {
        this.events.fullScreenChanged?.(id, window.fullScreen);
        refreshState();
      },
      handleFrameGeometryChanged: refreshFrameGeometry,
      handleInteractiveStateChanged: refreshInteractiveState,
      handleMaximizedAboutToChange: (mode) => {
        if (mode !== 0) {
          this.events.maximizedAboutToChange?.(id, mode);
          this.events.suspensionSettled?.(id, "maximized-settling");
          this.events.suspending?.(id, "maximized-requested");
          maximizeRequested = true;
        } else {
          this.events.suspensionSettled?.(id, "maximized-requested");

          if (maximizeRequested) {
            this.events.suspending?.(id, "maximized-settling");
          }

          maximizeRequested = false;
        }

        refreshState();

        if (mode === 0) {
          this.events.maximizedAboutToChange?.(id, mode);
        }
      },
      handleMaximizedChanged: () => {
        const maximized = window.maximizeMode !== 0;

        if (maximized === maximizeRequested) {
          this.events.suspensionSettled?.(id, "maximized-requested");

          if (!maximized) {
            this.events.suspensionSettled?.(id, "maximized-settling");
          }
        }

        refreshState();
      },
      handleOutputChanged: refresh,
      handleRequestedTileChanged: () => {
        if (window.tile !== null) {
          this.events.suspensionSettled?.(id, "native-tile-settling");

          if (committedTile === window.tile) {
            this.events.suspensionSettled?.(id, "native-tile-requested");
          } else {
            this.events.suspending?.(id, "native-tile-requested");
          }

          tileRequested = true;
        } else {
          this.events.suspensionSettled?.(id, "native-tile-requested");

          if (committedTile === null) {
            this.events.suspensionSettled?.(id, "native-tile-settling");
          } else if (tileRequested) {
            this.events.suspending?.(id, "native-tile-settling");
          }

          tileRequested = false;
        }

        refreshState();
      },
      handleStateChanged: refreshState,
      handleTileChanged: (tile) => {
        committedTile = tile;

        if (tile !== null) {
          this.events.suspending?.(id, "native-tile-committed");

          if (window.tile === tile) {
            this.events.suspensionSettled?.(id, "native-tile-requested");
          }
        } else {
          this.events.suspensionSettled?.(id, "native-tile-committed");
          this.events.suspensionSettled?.(id, "native-tile-settling");

          if (window.tile === null) {
            this.events.suspensionSettled?.(id, "native-tile-requested");
          }
        }

        refreshState();
      },
      constraintFingerprint: constraintFingerprint(window),
      observed: observedWindow,
      source: window,
    };

    this.windows.set(id, entry);
    window.clientGeometryChanged?.connect(entry.handleClientGeometryChanged);
    window.desktopsChanged?.connect(entry.handleDesktopsChanged);
    window.frameGeometryChanged?.connect(entry.handleFrameGeometryChanged);
    window.fullScreenChanged?.connect(entry.handleFullScreenChanged);
    window.interactiveMoveResizeFinished?.connect(
      entry.handleInteractiveStateChanged,
    );
    window.maximizedAboutToChange?.connect(entry.handleMaximizedAboutToChange);
    window.maximizeableChanged?.connect(entry.handleConstraintChanged);
    window.maximizedChanged?.connect(entry.handleMaximizedChanged);
    window.minimizedChanged?.connect(entry.handleStateChanged);
    window.modalChanged?.connect(entry.handleAutomaticFloatingChanged);
    window.moveResizedChanged?.connect(entry.handleInteractiveStateChanged);
    window.outputChanged?.connect(entry.handleOutputChanged);
    window.requestedTileChanged?.connect(entry.handleRequestedTileChanged);
    window.tileChanged?.connect(entry.handleTileChanged);
    window.transientChanged?.connect(entry.handleAutomaticFloatingChanged);
    this.events.tracked?.(id);
    window.decorationChanged?.connect(entry.handleDecorationPolicyChanged);
    window.decorationPolicyChanged?.connect(
      entry.handleDecorationPolicyChanged,
    );
    window.noBorderChanged?.connect(entry.handleDecorationPolicyChanged);

    if (observedWindow) {
      this.events.added?.(observedWindow);
    }
  }

  private refresh(
    id: string,
    source: KWinWindow,
    forceNotification = false,
  ): void {
    const entry = this.windows.get(id);

    if (!entry || entry.source !== source) {
      return;
    }

    const observed = normalizeWindow(source);

    if (!forceNotification && sameObservedWindow(entry.observed, observed)) {
      return;
    }

    entry.observed = observed;
    this.events.changed?.(id);
  }

  private refreshState(id: string, source: KWinWindow): void {
    const entry = this.windows.get(id);

    if (entry?.source === source) {
      this.events.stateChanged?.(id);
    }
  }

  private refreshConstraintFingerprint(
    id: string,
    source: KWinWindow,
  ): boolean {
    const entry = this.windows.get(id);

    if (!entry || entry.source !== source) {
      return false;
    }

    const fingerprint = constraintFingerprint(source);

    if (entry.constraintFingerprint === fingerprint) {
      return false;
    }

    entry.constraintFingerprint = fingerprint;
    this.events.changed?.(id);
    return true;
  }

  private selectedDesktopIdsByOutput(): ReadonlyMap<string, string> {
    const selectedDesktopIds = new Map<string, string>();

    try {
      const outputs = this.workspace.screens;

      if (typeof this.workspace.currentDesktopForScreen === "function") {
        for (const output of outputs) {
          try {
            const selected = this.workspace.currentDesktopForScreen(output);

            if (output.name.length > 0 && selected?.id.length) {
              selectedDesktopIds.set(output.name, selected.id);
            }
          } catch {
            // An unreadable output selection is not safe to probe.
          }
        }

        return selectedDesktopIds;
      }

      const selected = this.workspace.currentDesktop;

      if (!selected?.id.length) {
        return selectedDesktopIds;
      }

      for (const output of outputs) {
        if (output.name.length > 0) {
          selectedDesktopIds.set(output.name, selected.id);
        }
      }
    } catch {
      selectedDesktopIds.clear();
    }

    return selectedDesktopIds;
  }
}

export function normalizeWindow(window: KWinWindow): ObservedWindow | null {
  const automaticFloatingRole = hasAutomaticFloatingRole(window);

  if (
    window.specialWindow ||
    window.deleted ||
    !window.managed ||
    window.desktopWindow ||
    window.dock ||
    window.onAllDesktops ||
    window.desktops.length === 0 ||
    (!window.normalWindow && !automaticFloatingRole) ||
    !window.output
  ) {
    return null;
  }

  return {
    desktopIds: window.desktops.map((desktop) => desktop.id),
    id: windowId(window),
    kind: window.dialog ? "dialog" : window.normalWindow ? "normal" : "other",
    outputId: window.output.name,
  };
}

function isTrackableWindow(window: KWinWindow): boolean {
  return (
    !window.deleted && window.managed && !window.desktopWindow && !window.dock
  );
}

function hasAutomaticFloatingRole(window: KWinWindow): boolean {
  return Boolean(
    window.dialog || window.modal || window.transient || window.transientFor,
  );
}

function windowId(window: KWinWindow): string {
  return String(window.internalId);
}

function disconnectWindowSignals(entry: WindowEntry): void {
  entry.source.decorationChanged?.disconnect(
    entry.handleDecorationPolicyChanged,
  );
  entry.source.decorationPolicyChanged?.disconnect(
    entry.handleDecorationPolicyChanged,
  );
  entry.source.noBorderChanged?.disconnect(entry.handleDecorationPolicyChanged);
  entry.source.clientGeometryChanged?.disconnect(
    entry.handleClientGeometryChanged,
  );
  entry.source.desktopsChanged?.disconnect(entry.handleDesktopsChanged);
  entry.source.frameGeometryChanged?.disconnect(
    entry.handleFrameGeometryChanged,
  );
  entry.source.fullScreenChanged?.disconnect(entry.handleFullScreenChanged);
  entry.source.interactiveMoveResizeFinished?.disconnect(
    entry.handleInteractiveStateChanged,
  );
  entry.source.maximizedAboutToChange?.disconnect(
    entry.handleMaximizedAboutToChange,
  );
  entry.source.maximizeableChanged?.disconnect(entry.handleConstraintChanged);
  entry.source.maximizedChanged?.disconnect(entry.handleMaximizedChanged);
  entry.source.minimizedChanged?.disconnect(entry.handleStateChanged);
  entry.source.modalChanged?.disconnect(entry.handleAutomaticFloatingChanged);
  entry.source.moveResizedChanged?.disconnect(
    entry.handleInteractiveStateChanged,
  );
  entry.source.outputChanged?.disconnect(entry.handleOutputChanged);
  entry.source.requestedTileChanged?.disconnect(
    entry.handleRequestedTileChanged,
  );
  entry.source.tileChanged?.disconnect(entry.handleTileChanged);
  entry.source.transientChanged?.disconnect(
    entry.handleAutomaticFloatingChanged,
  );
}

function constraintFingerprint(window: KWinWindow): string {
  try {
    const frame = window.frameGeometry;
    const client = window.clientGeometry;
    const minimum = window.minSize;
    const maximum = window.maxSize;
    const resizeable = window.resizeable;
    const horizontalDecoration = decorationExtent(frame.width, client.width);
    const verticalDecoration = decorationExtent(frame.height, client.height);

    if (
      typeof resizeable !== "boolean" ||
      !validMinimum(minimum.width) ||
      !validMinimum(minimum.height) ||
      !validMaximum(maximum.width) ||
      !validMaximum(maximum.height) ||
      horizontalDecoration === null ||
      verticalDecoration === null ||
      (maximum.width > 0 &&
        Number.isFinite(maximum.width) &&
        maximum.width < minimum.width) ||
      (maximum.height > 0 &&
        Number.isFinite(maximum.height) &&
        maximum.height < minimum.height)
    ) {
      return INVALID_CONSTRAINT_FINGERPRINT;
    }

    return [
      "valid",
      resizeable ? "1" : "0",
      numberFingerprint(minimum.width),
      numberFingerprint(minimum.height),
      maximumFingerprint(maximum.width),
      maximumFingerprint(maximum.height),
      numberFingerprint(horizontalDecoration),
      numberFingerprint(verticalDecoration),
    ].join("\u0000");
  } catch {
    return INVALID_CONSTRAINT_FINGERPRINT;
  }
}

function geometrySizeChanged(
  oldGeometry: KWinRect,
  window: KWinWindow,
  property: "clientGeometry" | "frameGeometry",
): boolean {
  try {
    const current = window[property];

    return (
      oldGeometry.width !== current.width ||
      oldGeometry.height !== current.height
    );
  } catch {
    return true;
  }
}

function validMinimum(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validMaximum(value: number): boolean {
  return typeof value === "number";
}

function decorationExtent(frame: number, client: number): number | null {
  if (
    typeof frame !== "number" ||
    !Number.isFinite(frame) ||
    frame < 0 ||
    typeof client !== "number" ||
    !Number.isFinite(client) ||
    client < 0
  ) {
    return null;
  }

  const extent = frame - client;

  if (extent < -CONSTRAINT_EPSILON) {
    return null;
  }

  return extent > 0 ? extent : 0;
}

function maximumFingerprint(value: number): string {
  return !Number.isFinite(value) || value <= 0
    ? "unbounded"
    : numberFingerprint(value);
}

function numberFingerprint(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

function sameObservedWindow(
  left: ObservedWindow | null,
  right: ObservedWindow | null,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.outputId === right.outputId &&
    sameStrings(left.desktopIds, right.desktopIds)
  );
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
