import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export type OverviewTouchPanAxis = "horizontal" | "pending" | "vertical";

export interface OverviewTouchPanAxisInput {
  readonly axis: OverviewTouchPanAxis;
  readonly horizontalAvailable: boolean;
  readonly translationX: number;
  readonly translationY: number;
  readonly verticalAvailable: boolean;
}

export interface OverviewTouchPanAxisPlan {
  readonly axis: OverviewTouchPanAxis;
}

const ACTIVATION_DISTANCE = 8;
const DOMINANCE_RATIO = 1.25;

const HORIZONTAL_PLAN: OverviewTouchPanAxisPlan = Object.freeze({
  axis: "horizontal",
});
const PENDING_PLAN: OverviewTouchPanAxisPlan = Object.freeze({
  axis: "pending",
});
const VERTICAL_PLAN: OverviewTouchPanAxisPlan = Object.freeze({
  axis: "vertical",
});

export function planOverviewTouchPanAxis(
  input: unknown,
): OverviewTouchPanAxisPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const axis = input["axis"];
    const horizontalAvailable = input["horizontalAvailable"];
    const translationX = input["translationX"];
    const translationY = input["translationY"];
    const verticalAvailable = input["verticalAvailable"];

    if (
      !isAxis(axis) ||
      typeof horizontalAvailable !== "boolean" ||
      !isBoundedTranslation(translationX) ||
      !isBoundedTranslation(translationY) ||
      typeof verticalAvailable !== "boolean"
    ) {
      return null;
    }

    if (axis === "horizontal") {
      return horizontalAvailable ? HORIZONTAL_PLAN : null;
    }

    if (axis === "vertical") {
      return verticalAvailable ? VERTICAL_PLAN : null;
    }

    const horizontalDistance = Math.abs(translationX);
    const verticalDistance = Math.abs(translationY);
    const horizontalDominant =
      horizontalDistance >= ACTIVATION_DISTANCE &&
      horizontalDistance >= verticalDistance * DOMINANCE_RATIO;
    const verticalDominant =
      verticalDistance >= ACTIVATION_DISTANCE &&
      verticalDistance >= horizontalDistance * DOMINANCE_RATIO;

    if (horizontalDominant) {
      return horizontalAvailable ? HORIZONTAL_PLAN : PENDING_PLAN;
    }

    if (verticalDominant) {
      return verticalAvailable ? VERTICAL_PLAN : PENDING_PLAN;
    }

    return PENDING_PLAN;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAxis(value: unknown): value is OverviewTouchPanAxis {
  return value === "pending" || value === "horizontal" || value === "vertical";
}

function isBoundedTranslation(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}
