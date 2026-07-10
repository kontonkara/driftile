import type { KWinOutput, KWinWindow, KWinWorkspace } from "./api";

export type ObservedWindowKind = "dialog" | "normal";
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
}

interface WindowEntry {
  readonly handleDesktopsChanged: () => void;
  readonly handleMaximizedAboutToChange: (mode: number) => void;
  readonly handleMaximizedChanged: () => void;
  readonly handleOutputChanged: (oldOutput?: KWinOutput | null) => void;
  readonly handleRequestedTileChanged: () => void;
  readonly handleStateChanged: () => void;
  readonly handleTileChanged: (tile: object | null) => void;
  observed: ObservedWindow | null;
  readonly source: KWinWindow;
}

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
    let committedTile: object | null | undefined;
    let maximizeRequested = window.maximizeMode !== 0;
    let tileRequested = window.tile !== null;
    const entry: WindowEntry = {
      handleDesktopsChanged: refresh,
      handleMaximizedAboutToChange: (mode) => {
        if (mode !== 0) {
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
      observed: observedWindow,
      source: window,
    };

    this.windows.set(id, entry);
    window.desktopsChanged?.connect(entry.handleDesktopsChanged);
    window.fullScreenChanged?.connect(entry.handleStateChanged);
    window.interactiveMoveResizeFinished?.connect(entry.handleStateChanged);
    window.maximizedAboutToChange?.connect(entry.handleMaximizedAboutToChange);
    window.maximizedChanged?.connect(entry.handleMaximizedChanged);
    window.minimizedChanged?.connect(entry.handleStateChanged);
    window.moveResizedChanged?.connect(entry.handleStateChanged);
    window.outputChanged?.connect(entry.handleOutputChanged);
    window.requestedTileChanged?.connect(entry.handleRequestedTileChanged);
    window.tileChanged?.connect(entry.handleTileChanged);

    if (observedWindow) {
      this.events.added?.(observedWindow);
    }
  }

  private refresh(id: string, source: KWinWindow): void {
    const entry = this.windows.get(id);

    if (!entry || entry.source !== source) {
      return;
    }

    const observed = normalizeWindow(source);

    if (sameObservedWindow(entry.observed, observed)) {
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
}

export function normalizeWindow(window: KWinWindow): ObservedWindow | null {
  if (
    window.specialWindow ||
    window.deleted ||
    !window.managed ||
    window.desktopWindow ||
    window.dock ||
    window.onAllDesktops ||
    window.desktops.length === 0 ||
    (!window.normalWindow && !window.dialog) ||
    !window.output
  ) {
    return null;
  }

  return {
    desktopIds: window.desktops.map((desktop) => desktop.id),
    id: windowId(window),
    kind: window.dialog ? "dialog" : "normal",
    outputId: window.output.name,
  };
}

function isTrackableWindow(window: KWinWindow): boolean {
  return (
    !window.specialWindow &&
    !window.deleted &&
    window.managed &&
    !window.desktopWindow &&
    !window.dock &&
    (window.normalWindow || window.dialog)
  );
}

function windowId(window: KWinWindow): string {
  return String(window.internalId);
}

function disconnectWindowSignals(entry: WindowEntry): void {
  entry.source.desktopsChanged?.disconnect(entry.handleDesktopsChanged);
  entry.source.fullScreenChanged?.disconnect(entry.handleStateChanged);
  entry.source.interactiveMoveResizeFinished?.disconnect(
    entry.handleStateChanged,
  );
  entry.source.maximizedAboutToChange?.disconnect(
    entry.handleMaximizedAboutToChange,
  );
  entry.source.maximizedChanged?.disconnect(entry.handleMaximizedChanged);
  entry.source.minimizedChanged?.disconnect(entry.handleStateChanged);
  entry.source.moveResizedChanged?.disconnect(entry.handleStateChanged);
  entry.source.outputChanged?.disconnect(entry.handleOutputChanged);
  entry.source.requestedTileChanged?.disconnect(
    entry.handleRequestedTileChanged,
  );
  entry.source.tileChanged?.disconnect(entry.handleTileChanged);
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
