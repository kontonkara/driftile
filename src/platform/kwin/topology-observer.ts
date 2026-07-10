import type { KWinOutput, KWinWindow, KWinWorkspace } from "./api";

export interface TopologyObserverEvents {
  readonly changed: (outputName?: string) => void;
}

interface DockEntry {
  readonly handleChanged: () => void;
  readonly handleOutputChanged: (oldOutput?: KWinOutput | null) => void;
  lastOutputName: string | undefined;
  readonly source: KWinWindow;
}

interface OutputEntry {
  readonly handleGeometryChanged: () => void;
  readonly handleScaleChanged: () => void;
  readonly instanceId: number;
  pendingRevision: number;
  settledRevision: number;
  snapshot: OutputSnapshot;
  readonly source: KWinOutput;
}

interface OutputSnapshot {
  readonly geometry: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
  readonly scale: number;
}

export class TopologyObserver {
  private readonly docks = new Map<string, DockEntry>();
  private readonly events: TopologyObserverEvents;
  private nextInvalidationRevision = 1;
  private nextOutputInstanceId = 1;
  private readonly outputs = new Map<string, OutputEntry>();
  private started = false;
  private readonly workspace: KWinWorkspace;

  constructor(workspace: KWinWorkspace, events: TopologyObserverEvents) {
    this.events = events;
    this.workspace = workspace;
  }

  outputInstances(): ReadonlyMap<string, number> {
    return new Map(
      [...this.outputs].map(([name, entry]) => [name, entry.instanceId]),
    );
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.workspace.screensChanged?.connect(this.handleScreensChanged);
    this.workspace.virtualScreenGeometryChanged?.connect(
      this.handleVirtualGeometryChanged,
    );
    this.workspace.windowAdded.connect(this.handleWindowAdded);
    this.workspace.windowRemoved.connect(this.handleWindowRemoved);
    this.refreshOutputs();

    for (const window of this.workspace.stackingOrder) {
      this.observeDock(window);
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.workspace.screensChanged?.disconnect(this.handleScreensChanged);
    this.workspace.virtualScreenGeometryChanged?.disconnect(
      this.handleVirtualGeometryChanged,
    );
    this.workspace.windowAdded.disconnect(this.handleWindowAdded);
    this.workspace.windowRemoved.disconnect(this.handleWindowRemoved);

    for (const entry of this.outputs.values()) {
      disconnectOutput(entry);
    }

    for (const entry of this.docks.values()) {
      disconnectDock(entry);
    }

    this.outputs.clear();
    this.docks.clear();
  }

  private readonly handleScreensChanged = (): void => {
    if (this.refreshOutputs()) {
      this.settleAllOutputs();
      this.events.changed();
      return;
    }

    this.publishSettledOutputChanges();
  };

  private readonly handleVirtualGeometryChanged = (): void => {
    this.publishPendingOutputChanges();
  };

  private readonly handleWindowAdded = (window: KWinWindow): void => {
    if (this.observeDock(window)) {
      this.events.changed(window.output?.name);
    }
  };

  private readonly handleWindowRemoved = (window: KWinWindow): void => {
    const id = windowId(window);
    const entry = this.docks.get(id);

    if (entry?.source !== window) {
      return;
    }

    disconnectDock(entry);
    this.docks.delete(id);
    this.events.changed(window.output?.name ?? entry.lastOutputName);
  };

  private observeDock(window: KWinWindow): boolean {
    if (!window.dock || window.deleted) {
      return false;
    }

    const id = windowId(window);
    const previous = this.docks.get(id);

    if (previous?.source === window) {
      return false;
    }

    if (previous) {
      disconnectDock(previous);
    }

    const entry: DockEntry = {
      handleChanged: () => {
        const currentOutputName = window.output?.name;

        if (currentOutputName) {
          entry.lastOutputName = currentOutputName;
        }

        this.events.changed(currentOutputName ?? entry.lastOutputName);
      },
      handleOutputChanged: (oldOutput) => {
        const currentOutputName = window.output?.name;

        this.publishDockOutputs(
          oldOutput?.name ?? entry.lastOutputName,
          currentOutputName,
        );

        if (currentOutputName) {
          entry.lastOutputName = currentOutputName;
        }
      },
      lastOutputName: window.output?.name,
      source: window,
    };

    this.docks.set(id, entry);
    window.desktopsChanged?.connect(entry.handleChanged);
    window.frameGeometryChanged?.connect(entry.handleChanged);
    window.hiddenChanged?.connect(entry.handleChanged);
    window.minimizedChanged?.connect(entry.handleChanged);
    window.outputChanged?.connect(entry.handleOutputChanged);
    return true;
  }

  private publishDockOutputs(
    previousOutputName?: string,
    currentOutputName?: string,
  ): void {
    const outputNames = new Set<string>();

    if (previousOutputName) {
      outputNames.add(previousOutputName);
    }

    if (currentOutputName) {
      outputNames.add(currentOutputName);
    }

    if (outputNames.size === 0) {
      this.events.changed();
      return;
    }

    for (const outputName of outputNames) {
      this.events.changed(outputName);
    }
  }

  private publishPendingOutputChanges(): void {
    for (const [name, entry] of this.outputs) {
      if (
        entry.pendingRevision > entry.settledRevision ||
        outputSnapshotChanged(entry.snapshot, entry.source)
      ) {
        this.events.changed(name);
      }
    }
  }

  private publishSettledOutputChanges(): void {
    const changedOutputs: Array<{
      readonly entry: OutputEntry;
      readonly name: string;
      readonly pendingRevision: number;
      readonly snapshot: OutputSnapshot;
    }> = [];

    for (const [name, entry] of this.outputs) {
      const snapshot = snapshotOutput(entry.source);
      const pendingRevision = entry.pendingRevision;

      if (
        pendingRevision > entry.settledRevision ||
        !outputSnapshotsEqual(entry.snapshot, snapshot)
      ) {
        changedOutputs.push({ entry, name, pendingRevision, snapshot });
      }
    }

    for (const change of changedOutputs) {
      change.entry.snapshot = change.snapshot;
      change.entry.settledRevision = change.pendingRevision;
      this.events.changed(change.name);
    }
  }

  private settleAllOutputs(): void {
    for (const entry of this.outputs.values()) {
      entry.snapshot = snapshotOutput(entry.source);
      entry.settledRevision = entry.pendingRevision;
    }
  }

  private refreshOutputs(): boolean {
    const liveOutputs = new Map(
      this.workspace.screens.map((output) => [output.name, output]),
    );
    let structuralChange = false;

    for (const [name, entry] of this.outputs) {
      if (liveOutputs.get(name) === entry.source) {
        continue;
      }

      disconnectOutput(entry);
      this.outputs.delete(name);
      structuralChange = true;
    }

    for (const [name, output] of liveOutputs) {
      if (this.outputs.has(name)) {
        continue;
      }

      const entry: OutputEntry = {
        handleGeometryChanged: () => {
          this.handleOutputInvalidated(name, output);
        },
        handleScaleChanged: () => {
          this.handleOutputInvalidated(name, output);
        },
        instanceId: this.nextOutputInstanceId,
        pendingRevision: 0,
        settledRevision: 0,
        snapshot: snapshotOutput(output),
        source: output,
      };

      this.nextOutputInstanceId += 1;

      this.outputs.set(name, entry);
      structuralChange = true;
      output.geometryChanged?.connect(entry.handleGeometryChanged);
      output.scaleChanged?.connect(entry.handleScaleChanged);
    }

    return structuralChange;
  }

  private handleOutputInvalidated(name: string, source: KWinOutput): void {
    const entry = this.outputs.get(name);

    if (entry?.source !== source) {
      return;
    }

    entry.pendingRevision = this.nextInvalidationRevision;
    this.nextInvalidationRevision += 1;
    this.events.changed(name);
  }
}

function outputSnapshotChanged(
  snapshot: OutputSnapshot,
  output: KWinOutput,
): boolean {
  return !outputSnapshotsEqual(snapshot, snapshotOutput(output));
}

function outputSnapshotsEqual(
  left: OutputSnapshot,
  right: OutputSnapshot,
): boolean {
  return (
    left.scale === right.scale &&
    left.geometry.x === right.geometry.x &&
    left.geometry.y === right.geometry.y &&
    left.geometry.width === right.geometry.width &&
    left.geometry.height === right.geometry.height
  );
}

function snapshotOutput(output: KWinOutput): OutputSnapshot {
  return {
    geometry: {
      height: output.geometry.height,
      width: output.geometry.width,
      x: output.geometry.x,
      y: output.geometry.y,
    },
    scale: output.devicePixelRatio,
  };
}

function disconnectDock(entry: DockEntry): void {
  entry.source.desktopsChanged?.disconnect(entry.handleChanged);
  entry.source.frameGeometryChanged?.disconnect(entry.handleChanged);
  entry.source.hiddenChanged?.disconnect(entry.handleChanged);
  entry.source.minimizedChanged?.disconnect(entry.handleChanged);
  entry.source.outputChanged?.disconnect(entry.handleOutputChanged);
}

function disconnectOutput(entry: OutputEntry): void {
  entry.source.geometryChanged?.disconnect(entry.handleGeometryChanged);
  entry.source.scaleChanged?.disconnect(entry.handleScaleChanged);
}

function windowId(window: KWinWindow): string {
  return String(window.internalId);
}
