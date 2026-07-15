import type { Rect } from "./geometry";
import type { OutputId } from "./ids";

export type OutputDirection = "down" | "left" | "right" | "up";
export type SequentialOutputDirection = "next" | "previous";

export interface OutputGeometry {
  readonly id: OutputId;
  readonly rect: Rect;
}

interface CandidateScore {
  readonly centerDistanceSquared: number;
  readonly id: OutputId;
  readonly perpendicularCenterDistance: number;
  readonly perpendicularOverlapRank: 0 | 1;
  readonly primaryEdgeGap: number;
}

export function findAdjacentOutput(
  sourceId: OutputId,
  outputs: readonly OutputGeometry[],
  direction: OutputDirection,
): OutputId | null {
  const source = outputs.find(
    (output) => output.id === sourceId && isUsableRect(output.rect),
  );

  if (!source) {
    return null;
  }

  let best: CandidateScore | null = null;

  for (const candidate of outputs) {
    if (candidate.id === sourceId || !isUsableRect(candidate.rect)) {
      continue;
    }

    const score = scoreCandidate(source.rect, candidate, direction);

    if (score && (!best || compareScores(score, best) < 0)) {
      best = score;
    }
  }

  return best?.id ?? null;
}

export function findSequentialOutput(
  sourceId: OutputId,
  outputs: readonly OutputGeometry[],
  direction: SequentialOutputDirection,
): OutputId | null {
  const source = outputs.find(
    (output) => output.id === sourceId && isUsableRect(output.rect),
  );

  if (!source) {
    return null;
  }

  const ordered = [
    source,
    ...outputs.filter(
      (output) => output.id !== sourceId && isUsableRect(output.rect),
    ),
  ].sort(compareSequentialOutputs);

  if (ordered.length < 2) {
    return null;
  }

  const sourceIndex = ordered.indexOf(source);
  const targetIndex =
    direction === "next"
      ? (sourceIndex + 1) % ordered.length
      : (sourceIndex + ordered.length - 1) % ordered.length;
  return ordered[targetIndex]?.id ?? null;
}

function scoreCandidate(
  source: Rect,
  candidate: OutputGeometry,
  direction: OutputDirection,
): CandidateScore | null {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const candidateCenterX = candidate.rect.x + candidate.rect.width / 2;
  const candidateCenterY = candidate.rect.y + candidate.rect.height / 2;
  const horizontal = direction === "left" || direction === "right";
  const sourcePrimaryCenter = horizontal ? sourceCenterX : sourceCenterY;
  const candidatePrimaryCenter = horizontal
    ? candidateCenterX
    : candidateCenterY;

  if (!isInDirection(sourcePrimaryCenter, candidatePrimaryCenter, direction)) {
    return null;
  }

  const sourcePerpendicularStart = horizontal ? source.y : source.x;
  const sourcePerpendicularEnd = horizontal
    ? source.y + source.height
    : source.x + source.width;
  const candidatePerpendicularStart = horizontal
    ? candidate.rect.y
    : candidate.rect.x;
  const candidatePerpendicularEnd = horizontal
    ? candidate.rect.y + candidate.rect.height
    : candidate.rect.x + candidate.rect.width;
  const perpendicularOverlap =
    Math.min(sourcePerpendicularEnd, candidatePerpendicularEnd) -
    Math.max(sourcePerpendicularStart, candidatePerpendicularStart);
  const sourcePerpendicularCenter = horizontal ? sourceCenterY : sourceCenterX;
  const candidatePerpendicularCenter = horizontal
    ? candidateCenterY
    : candidateCenterX;
  const centerDeltaX = candidateCenterX - sourceCenterX;
  const centerDeltaY = candidateCenterY - sourceCenterY;

  return {
    centerDistanceSquared:
      centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY,
    id: candidate.id,
    perpendicularCenterDistance: Math.abs(
      candidatePerpendicularCenter - sourcePerpendicularCenter,
    ),
    perpendicularOverlapRank: perpendicularOverlap > 0 ? 0 : 1,
    primaryEdgeGap: primaryEdgeGap(source, candidate.rect, direction),
  };
}

function isInDirection(
  sourceCenter: number,
  candidateCenter: number,
  direction: OutputDirection,
): boolean {
  return direction === "left" || direction === "up"
    ? candidateCenter < sourceCenter
    : candidateCenter > sourceCenter;
}

function primaryEdgeGap(
  source: Rect,
  candidate: Rect,
  direction: OutputDirection,
): number {
  switch (direction) {
    case "left":
      return Math.max(0, source.x - (candidate.x + candidate.width));
    case "right":
      return Math.max(0, candidate.x - (source.x + source.width));
    case "up":
      return Math.max(0, source.y - (candidate.y + candidate.height));
    case "down":
      return Math.max(0, candidate.y - (source.y + source.height));
  }
}

function compareScores(left: CandidateScore, right: CandidateScore): number {
  return (
    left.perpendicularOverlapRank - right.perpendicularOverlapRank ||
    left.primaryEdgeGap - right.primaryEdgeGap ||
    left.perpendicularCenterDistance - right.perpendicularCenterDistance ||
    left.centerDistanceSquared - right.centerDistanceSquared ||
    compareIds(left.id, right.id)
  );
}

function compareSequentialOutputs(
  left: OutputGeometry,
  right: OutputGeometry,
): number {
  const leftBottom = left.rect.y + left.rect.height;
  const rightBottom = right.rect.y + right.rect.height;

  if (leftBottom <= right.rect.y) {
    return -1;
  }

  if (rightBottom <= left.rect.y) {
    return 1;
  }

  return (
    left.rect.x - right.rect.x ||
    left.rect.y - right.rect.y ||
    compareIds(left.id, right.id)
  );
}

function compareIds(left: OutputId, right: OutputId): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function isUsableRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}
