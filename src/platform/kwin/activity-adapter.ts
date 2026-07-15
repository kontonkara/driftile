import { activityId, type ActivityId } from "../../core/ids";
import type { KWinWorkspace } from "./api";

export const FALLBACK_ACTIVITY_ID = activityId("driftile-default-activity");

export class KWinActivityAdapter {
  constructor(private readonly workspace: KWinWorkspace) {}

  current(): ActivityId | null {
    const activities = knownActivities(this.workspace);
    const current = validActivity(this.workspace.currentActivity);

    if (
      current !== null &&
      (activities === null ||
        activities.length === 0 ||
        activities.includes(current))
    ) {
      return activityId(current);
    }

    if (activities?.length === 1) {
      return activityId(activities[0] as string);
    }

    if (activities === null || activities.length === 0) {
      return FALLBACK_ACTIVITY_ID;
    }

    return null;
  }

  forWindow(activityIds: readonly string[]): ActivityId | null {
    const memberships = uniqueActivities(activityIds);

    if (memberships === null || memberships.length > 1) {
      return null;
    }

    const activities = knownActivities(this.workspace);

    if (memberships.length === 1) {
      const membership = memberships[0] as string;

      return activities !== null &&
        activities.length > 0 &&
        !activities.includes(membership)
        ? null
        : activityId(membership);
    }

    if (activities !== null && activities.length > 1) {
      return null;
    }

    return this.current();
  }
}

function knownActivities(workspace: KWinWorkspace): readonly string[] | null {
  return workspace.activities === undefined
    ? null
    : uniqueActivities(workspace.activities);
}

function uniqueActivities(values: readonly string[]): readonly string[] | null {
  const activities: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const candidate = validActivity(value);

    if (candidate === null || seen.has(candidate)) {
      return null;
    }

    seen.add(candidate);
    activities.push(candidate);
  }

  return activities;
}

function validActivity(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    return null;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return null;
    }
  }

  return value;
}
