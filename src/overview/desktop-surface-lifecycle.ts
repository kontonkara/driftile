import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewDesktopSurfaceLifecycleScope {
  readonly activityIds: readonly string[];
  readonly allActivities: boolean;
  readonly allDesktops: boolean;
  readonly desktopIds: readonly string[];
  readonly output: object;
  readonly outputName: string;
}

export interface OverviewDesktopSurfaceLifecycleEvent {
  readonly global: boolean;
  readonly revision: number;
  readonly scopes: readonly OverviewDesktopSurfaceLifecycleScope[];
}

export interface OverviewDesktopSurfaceLifecycleRefreshInput {
  readonly activityId: string;
  readonly desktopId: string;
  readonly event: OverviewDesktopSurfaceLifecycleEvent;
  readonly output: object;
  readonly outputName: string;
}

export interface OverviewDesktopSurfaceLifecycleRefreshPlan {
  readonly revision: number;
  readonly targeted: boolean;
}

const MAXIMUM_SCOPE_COUNT = 64;
const MAXIMUM_IDS_PER_SCOPE = LAYOUT_PERSISTENCE_LIMITS.contexts;
const MAXIMUM_LIFECYCLE_REVISION = 2_147_483_647;

export function planOverviewDesktopSurfaceLifecycleRefresh(
  input: unknown,
): OverviewDesktopSurfaceLifecycleRefreshPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }
  } catch {
    return null;
  }

  let event: Record<string, unknown>;
  let revision: number;

  try {
    const candidateEvent = input["event"];
    if (!isRecord(candidateEvent)) {
      return null;
    }

    const candidateRevision = candidateEvent["revision"];
    if (!isLifecycleRevision(candidateRevision)) {
      return null;
    }

    event = candidateEvent;
    revision = candidateRevision;
  } catch {
    return null;
  }

  let context: {
    readonly activityId: string;
    readonly desktopId: string;
    readonly output: object;
    readonly outputName: string;
  };

  try {
    const output = input["output"];
    const outputName = input["outputName"];
    const desktopId = input["desktopId"];
    const activityId = input["activityId"];

    if (
      !isObjectIdentity(output) ||
      !isIdentifier(outputName) ||
      !isIdentifier(desktopId) ||
      !isIdentifier(activityId)
    ) {
      return null;
    }

    context = { activityId, desktopId, output, outputName };
  } catch {
    return null;
  }

  try {
    const global = event["global"];
    const scopes = event["scopes"];

    if (typeof global !== "boolean" || !Array.isArray(scopes)) {
      return safeGlobalPlan(revision);
    }
    if (global) {
      return scopes.length === 0
        ? freezePlan(revision, true)
        : safeGlobalPlan(revision);
    }
    if (scopes.length < 1 || scopes.length > MAXIMUM_SCOPE_COUNT) {
      return safeGlobalPlan(revision);
    }

    let targeted = false;
    for (const scope of scopes) {
      const match = validateAndMatchScope(scope, context);
      if (match === null) {
        return safeGlobalPlan(revision);
      }
      targeted = targeted || match;
    }

    return freezePlan(revision, targeted);
  } catch {
    return safeGlobalPlan(revision);
  }
}

function validateAndMatchScope(
  value: unknown,
  context: {
    readonly activityId: string;
    readonly desktopId: string;
    readonly output: object;
    readonly outputName: string;
  },
): boolean | null {
  if (!isRecord(value)) {
    return null;
  }

  const output = value["output"];
  const outputName = value["outputName"];
  const allDesktops = value["allDesktops"];
  const desktopIds = value["desktopIds"];
  const allActivities = value["allActivities"];
  const activityIds = value["activityIds"];

  if (
    !isObjectIdentity(output) ||
    !isIdentifier(outputName) ||
    typeof allDesktops !== "boolean" ||
    typeof allActivities !== "boolean"
  ) {
    return null;
  }

  const desktopMatch = validateIdSelection(
    allDesktops,
    desktopIds,
    context.desktopId,
  );
  const activityMatch = validateIdSelection(
    allActivities,
    activityIds,
    context.activityId,
  );
  if (desktopMatch === null || activityMatch === null) {
    return null;
  }

  const outputObjectMatches = output === context.output;
  const outputNameMatches = outputName === context.outputName;
  if (outputObjectMatches !== outputNameMatches) {
    return null;
  }

  return outputObjectMatches && desktopMatch && activityMatch;
}

function validateIdSelection(
  all: boolean,
  value: unknown,
  expectedId: string,
): boolean | null {
  if (
    !Array.isArray(value) ||
    value.length > MAXIMUM_IDS_PER_SCOPE ||
    (all ? value.length !== 0 : value.length === 0)
  ) {
    return null;
  }

  const uniqueIds = new Set<string>();
  let matched = all;
  for (const id of value) {
    if (!isIdentifier(id) || uniqueIds.has(id)) {
      return null;
    }
    uniqueIds.add(id);
    matched = matched || id === expectedId;
  }

  return matched;
}

function safeGlobalPlan(
  revision: number,
): OverviewDesktopSurfaceLifecycleRefreshPlan {
  return freezePlan(revision, true);
}

function freezePlan(
  revision: number,
  targeted: boolean,
): OverviewDesktopSurfaceLifecycleRefreshPlan {
  return Object.freeze({ revision, targeted });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectIdentity(value: unknown): value is object {
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

function isLifecycleRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAXIMUM_LIFECYCLE_REVISION
  );
}
