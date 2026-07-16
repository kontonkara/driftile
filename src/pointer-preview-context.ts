import type { ActivityId, DesktopId, OutputId } from "./core/ids";

export interface PointerPreviewContextKey {
  readonly activityId: ActivityId;
  readonly desktopId: DesktopId;
  readonly gap: number;
  readonly geometryFingerprint: string;
  readonly outputId: OutputId;
  readonly topologyRevision: number;
}

export interface PointerPreviewContextLease<TPreview> {
  readonly key: PointerPreviewContextKey;
  readonly preview: TPreview;
}

export class PointerPreviewContextCache<TPreview> {
  private currentLease: PointerPreviewContextLease<TPreview> | null = null;

  acquire(
    key: PointerPreviewContextKey,
    computePreview: () => TPreview,
  ): PointerPreviewContextLease<TPreview> {
    const current = this.currentLease;

    if (current && contextKeysEqual(current.key, key)) {
      return current;
    }

    this.currentLease = null;
    const stableKey = snapshotContextKey(key);
    const preview = computePreview();
    const lease = Object.freeze({
      key: stableKey,
      preview,
    });
    this.currentLease = lease;
    return lease;
  }

  owns(lease: PointerPreviewContextLease<TPreview>): boolean {
    return this.currentLease === lease;
  }

  release(lease: PointerPreviewContextLease<TPreview>): boolean {
    if (this.currentLease !== lease) {
      return false;
    }

    this.currentLease = null;
    return true;
  }

  clear(): boolean {
    if (this.currentLease === null) {
      return false;
    }

    this.currentLease = null;
    return true;
  }
}

function contextKeysEqual(
  left: PointerPreviewContextKey,
  right: PointerPreviewContextKey,
): boolean {
  return (
    left.outputId === right.outputId &&
    left.desktopId === right.desktopId &&
    left.activityId === right.activityId &&
    left.topologyRevision === right.topologyRevision &&
    left.geometryFingerprint === right.geometryFingerprint &&
    left.gap === right.gap
  );
}

function snapshotContextKey(
  key: PointerPreviewContextKey,
): PointerPreviewContextKey {
  return Object.freeze({
    activityId: key.activityId,
    desktopId: key.desktopId,
    gap: key.gap,
    geometryFingerprint: key.geometryFingerprint,
    outputId: key.outputId,
    topologyRevision: key.topologyRevision,
  });
}
