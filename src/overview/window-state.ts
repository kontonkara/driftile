export type OverviewWindowStateBadge = "Fullscreen" | "Maximized" | "Floating";

export interface OverviewWindowStatePlan {
  readonly badge: OverviewWindowStateBadge | null;
  readonly searchText: string;
}

const NO_STATE_PLAN = plan(null, "");
const FLOATING_PLAN = plan("Floating", "floating");
const MAXIMIZED_PLAN = plan("Maximized", "maximized");
const MAXIMIZED_FLOATING_PLAN = plan("Maximized", "maximized floating");
const FULLSCREEN_PLAN = plan("Fullscreen", "fullscreen");
const FULLSCREEN_FLOATING_PLAN = plan("Fullscreen", "fullscreen floating");
const FULLSCREEN_MAXIMIZED_PLAN = plan("Fullscreen", "fullscreen maximized");
const FULLSCREEN_MAXIMIZED_FLOATING_PLAN = plan(
  "Fullscreen",
  "fullscreen maximized floating",
);

const PLAN_BY_STATE_MASK: readonly OverviewWindowStatePlan[] = Object.freeze([
  NO_STATE_PLAN,
  FLOATING_PLAN,
  MAXIMIZED_PLAN,
  MAXIMIZED_FLOATING_PLAN,
  FULLSCREEN_PLAN,
  FULLSCREEN_FLOATING_PLAN,
  FULLSCREEN_MAXIMIZED_PLAN,
  FULLSCREEN_MAXIMIZED_FLOATING_PLAN,
]);

const MAXIMIZE_RESTORE = 0;
const MAXIMIZE_FULL = 3;

export function planOverviewWindowState(
  fields: unknown,
): OverviewWindowStatePlan | null {
  try {
    if (!isRecord(fields)) {
      return null;
    }

    const fullScreen = fields["fullScreen"];
    const maximizeMode = fields["maximizeMode"];
    const floating = fields["floating"];

    if (
      typeof fullScreen !== "boolean" ||
      typeof floating !== "boolean" ||
      typeof maximizeMode !== "number" ||
      !Number.isInteger(maximizeMode) ||
      maximizeMode < MAXIMIZE_RESTORE ||
      maximizeMode > MAXIMIZE_FULL
    ) {
      return null;
    }

    const stateMask =
      (fullScreen ? 4 : 0) |
      (maximizeMode === MAXIMIZE_FULL ? 2 : 0) |
      (floating ? 1 : 0);

    return PLAN_BY_STATE_MASK[stateMask] ?? null;
  } catch {
    return null;
  }
}

function plan(
  badge: OverviewWindowStateBadge | null,
  searchText: string,
): OverviewWindowStatePlan {
  return Object.freeze({ badge, searchText });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
