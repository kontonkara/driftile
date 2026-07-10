import type { KWinOutput, KWinWindow, KWinWorkspace } from "./api";

export type ObservedWindowKind = "dialog" | "normal";

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
}

interface WindowEntry {
  readonly handleDesktopsChanged: () => void;
  readonly handleMoveResizeChanged: () => void;
  readonly handleOutputChanged: (oldOutput?: KWinOutput | null) => void;
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
    const refreshMoveResize = (): void => {
      this.refreshMoveResize(id, window);
    };
    const entry: WindowEntry = {
      handleDesktopsChanged: refresh,
      handleMoveResizeChanged: refreshMoveResize,
      handleOutputChanged: refresh,
      observed: observedWindow,
      source: window,
    };

    this.windows.set(id, entry);
    window.desktopsChanged?.connect(entry.handleDesktopsChanged);
    window.interactiveMoveResizeFinished?.connect(
      entry.handleMoveResizeChanged,
    );
    window.moveResizedChanged?.connect(entry.handleMoveResizeChanged);
    window.outputChanged?.connect(entry.handleOutputChanged);

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

  private refreshMoveResize(id: string, source: KWinWindow): void {
    const entry = this.windows.get(id);

    if (entry?.source === source) {
      this.events.changed?.(id);
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
  entry.source.interactiveMoveResizeFinished?.disconnect(
    entry.handleMoveResizeChanged,
  );
  entry.source.moveResizedChanged?.disconnect(entry.handleMoveResizeChanged);
  entry.source.outputChanged?.disconnect(entry.handleOutputChanged);
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
