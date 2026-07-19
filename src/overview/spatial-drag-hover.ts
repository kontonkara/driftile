import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewSpatialDragHoverInput {
  readonly activationThresholdMilliseconds: number;
  readonly activeGeometryEpoch: number;
  readonly activeModelEpoch: number;
  readonly activeSessionId: number;
  readonly currentDesktopId: string;
  readonly elapsedMilliseconds: number;
  readonly geometryEpoch: number;
  readonly modelEpoch: number;
  readonly rowCount: number;
  readonly sessionId: number;
  readonly sourceDesktopId: string;
  readonly targetDesktopId: string;
  readonly targetRowIndex: number;
}

export type OverviewSpatialDragHoverIntent = "activate" | "pending";

export interface OverviewSpatialDragHoverPlan {
  readonly intent: OverviewSpatialDragHoverIntent;
  readonly targetDesktopId: string;
  readonly targetRowIndex: number;
}

export function planOverviewSpatialDragHover(
  input: unknown,
): OverviewSpatialDragHoverPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const activationThresholdMilliseconds =
      input["activationThresholdMilliseconds"];
    const activeGeometryEpoch = input["activeGeometryEpoch"];
    const activeModelEpoch = input["activeModelEpoch"];
    const activeSessionId = input["activeSessionId"];
    const currentDesktopId = input["currentDesktopId"];
    const elapsedMilliseconds = input["elapsedMilliseconds"];
    const geometryEpoch = input["geometryEpoch"];
    const modelEpoch = input["modelEpoch"];
    const rowCount = input["rowCount"];
    const sessionId = input["sessionId"];
    const sourceDesktopId = input["sourceDesktopId"];
    const targetDesktopId = input["targetDesktopId"];
    const targetRowIndex = input["targetRowIndex"];

    if (
      !isPositiveBoundedInteger(activeSessionId) ||
      !isPositiveBoundedInteger(sessionId) ||
      sessionId !== activeSessionId ||
      !isBoundedEpoch(activeModelEpoch) ||
      !isBoundedEpoch(modelEpoch) ||
      modelEpoch !== activeModelEpoch ||
      !isBoundedEpoch(activeGeometryEpoch) ||
      !isBoundedEpoch(geometryEpoch) ||
      geometryEpoch !== activeGeometryEpoch ||
      !isIdentifier(sourceDesktopId) ||
      !isIdentifier(targetDesktopId) ||
      !isIdentifier(currentDesktopId) ||
      targetDesktopId === sourceDesktopId ||
      targetDesktopId === currentDesktopId ||
      !isPositiveBoundedRowCount(rowCount) ||
      !isBoundedRowIndex(targetRowIndex, rowCount) ||
      !isNonNegativeBoundedNumber(elapsedMilliseconds) ||
      !isPositiveBoundedNumber(activationThresholdMilliseconds)
    ) {
      return null;
    }

    return Object.freeze({
      intent:
        elapsedMilliseconds < activationThresholdMilliseconds
          ? "pending"
          : "activate",
      targetDesktopId,
      targetRowIndex,
    });
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return false;
    }
  }

  return true;
}

function isPositiveBoundedInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function isBoundedEpoch(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function isPositiveBoundedRowCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.contexts
  );
}

function isBoundedRowIndex(value: unknown, rowCount: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < rowCount
  );
}

function isNonNegativeBoundedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function isPositiveBoundedNumber(value: unknown): value is number {
  return isNonNegativeBoundedNumber(value) && value > 0;
}
