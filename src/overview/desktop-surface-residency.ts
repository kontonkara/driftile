export interface OverviewDesktopSurfaceResidencyRange {
  readonly firstIndex: number;
  readonly lastIndex: number;
}

export interface OverviewDesktopSurfaceResidencyInput {
  readonly candidateRange: OverviewDesktopSurfaceResidencyRange | null;
  readonly currentWorkspaceIndex: number;
  readonly pinCurrent: boolean;
  readonly previousRange: OverviewDesktopSurfaceResidencyRange | null;
  readonly retainPrevious: boolean;
  readonly workspaceCount: number;
}

export type OverviewDesktopSurfaceResidencyPlan =
  OverviewDesktopSurfaceResidencyRange;

export const MAXIMUM_RESIDENT_ROWS = 12;

const MAXIMUM_WORKSPACE_COUNT = 512;

export function planOverviewDesktopSurfaceResidency(
  input: unknown,
): OverviewDesktopSurfaceResidencyPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const workspaceCount = input["workspaceCount"];
    const candidateValue = input["candidateRange"];
    const previousValue = input["previousRange"];
    const currentWorkspaceIndex = input["currentWorkspaceIndex"];
    const retainPrevious = input["retainPrevious"];
    const pinCurrent = input["pinCurrent"];

    if (
      !isSafeInteger(workspaceCount) ||
      workspaceCount < 1 ||
      workspaceCount > MAXIMUM_WORKSPACE_COUNT ||
      !isWorkspaceIndexOrMissing(currentWorkspaceIndex, workspaceCount) ||
      typeof retainPrevious !== "boolean" ||
      typeof pinCurrent !== "boolean"
    ) {
      return null;
    }

    const candidateRange = readRange(candidateValue, workspaceCount);
    const previousRange = readRange(previousValue, workspaceCount);
    if (candidateRange === undefined || previousRange === undefined) {
      return null;
    }

    let firstIndex: number;
    let lastIndex: number;

    if (candidateRange !== null) {
      firstIndex = candidateRange.firstIndex;
      lastIndex = candidateRange.lastIndex;

      if (retainPrevious && previousRange !== null) {
        const unionFirstIndex = Math.min(firstIndex, previousRange.firstIndex);
        const unionLastIndex = Math.max(lastIndex, previousRange.lastIndex);
        if (
          rangeSpan(unionFirstIndex, unionLastIndex) <= MAXIMUM_RESIDENT_ROWS
        ) {
          firstIndex = unionFirstIndex;
          lastIndex = unionLastIndex;
        }
      }
    } else if (previousRange !== null) {
      firstIndex = previousRange.firstIndex;
      lastIndex = previousRange.lastIndex;
    } else if (pinCurrent && currentWorkspaceIndex >= 0) {
      return freezeRange(currentWorkspaceIndex, currentWorkspaceIndex);
    } else {
      return null;
    }

    if (pinCurrent && currentWorkspaceIndex >= 0) {
      const pinnedFirstIndex = Math.min(firstIndex, currentWorkspaceIndex);
      const pinnedLastIndex = Math.max(lastIndex, currentWorkspaceIndex);
      if (
        rangeSpan(pinnedFirstIndex, pinnedLastIndex) <= MAXIMUM_RESIDENT_ROWS
      ) {
        firstIndex = pinnedFirstIndex;
        lastIndex = pinnedLastIndex;
      }
    }

    return freezeRange(firstIndex, lastIndex);
  } catch {
    return null;
  }
}

function readRange(
  value: unknown,
  workspaceCount: number,
): OverviewDesktopSurfaceResidencyRange | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const firstIndex = value["firstIndex"];
  const lastIndex = value["lastIndex"];
  if (
    !isSafeInteger(firstIndex) ||
    !isSafeInteger(lastIndex) ||
    firstIndex < 0 ||
    firstIndex > lastIndex ||
    lastIndex >= workspaceCount ||
    rangeSpan(firstIndex, lastIndex) > MAXIMUM_RESIDENT_ROWS
  ) {
    return undefined;
  }

  return { firstIndex, lastIndex };
}

function freezeRange(
  firstIndex: number,
  lastIndex: number,
): OverviewDesktopSurfaceResidencyPlan {
  return Object.freeze({ firstIndex, lastIndex });
}

function rangeSpan(firstIndex: number, lastIndex: number): number {
  return lastIndex - firstIndex + 1;
}

function isWorkspaceIndexOrMissing(
  value: unknown,
  workspaceCount: number,
): value is number {
  return (
    isSafeInteger(value) &&
    (value === -1 || (value >= 0 && value < workspaceCount))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
