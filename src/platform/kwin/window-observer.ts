import type { KWinWindow, KWinWorkspace } from "./api";

export type ObservedWindowKind = "dialog" | "normal";

export interface ObservedWindow {
  readonly desktopIds: readonly string[];
  readonly id: string;
  readonly kind: ObservedWindowKind;
  readonly outputId: string;
}

export class WindowObserver {
  private readonly windows = new Map<string, ObservedWindow>();
  private readonly workspace: KWinWorkspace;
  private started = false;

  constructor(workspace: KWinWorkspace) {
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
    this.windows.clear();
    this.started = false;
  }

  snapshot(): readonly ObservedWindow[] {
    return [...this.windows.values()];
  }

  private readonly handleWindowAdded = (window: KWinWindow): void => {
    this.add(window);
  };

  private readonly handleWindowRemoved = (window: KWinWindow): void => {
    this.windows.delete(windowId(window));
  };

  private add(window: KWinWindow): void {
    const observedWindow = normalizeWindow(window);

    if (observedWindow) {
      this.windows.set(observedWindow.id, observedWindow);
    }
  }
}

export function normalizeWindow(window: KWinWindow): ObservedWindow | null {
  if (
    window.specialWindow ||
    window.desktopWindow ||
    window.dock ||
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

function windowId(window: KWinWindow): string {
  return String(window.internalId);
}
