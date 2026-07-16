import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

interface OverviewWindowDesktopDropRequest {
  readonly outputId: string;
  readonly sourceDesktopId: string;
  readonly targetDesktopId: string;
  readonly windowId: string;
}

export function planOverviewWindowDesktopDrop(
  model: unknown,
  request: unknown,
): boolean {
  try {
    const drop = readRequest(request);
    const candidate = record(model);

    if (drop === null || candidate === null) {
      return false;
    }

    if (drop.sourceDesktopId === drop.targetDesktopId) {
      return false;
    }

    const currentActivityId = candidate["currentActivityId"];
    const desktopIds = indexIdentifiers(
      candidate["desktopIds"],
      LAYOUT_PERSISTENCE_LIMITS.contexts,
    );
    const outputIds = indexOutputs(candidate["outputs"]);
    const contexts = candidate["contexts"];
    const floatingWindows = candidate["floatingWindows"];

    if (
      !validIdentifier(currentActivityId) ||
      desktopIds === null ||
      outputIds === null ||
      !Array.isArray(contexts) ||
      contexts.length > LAYOUT_PERSISTENCE_LIMITS.contexts ||
      !Array.isArray(floatingWindows) ||
      floatingWindows.length > LAYOUT_PERSISTENCE_LIMITS.floatingWindows ||
      !desktopIds.has(drop.sourceDesktopId) ||
      !desktopIds.has(drop.targetDesktopId) ||
      !outputIds.has(drop.outputId)
    ) {
      return false;
    }

    const contextKeys = new Set<string>();
    const windowIds = new Set<string>();
    let sourceContextCount = 0;
    let exactTargetContextCount = 0;
    let sourceWindowCount = 0;
    let totalWindowCount = 0;

    for (const value of contexts) {
      const context = record(value);

      if (context === null) {
        return false;
      }

      const activityId = context["activityId"];
      const desktopId = context["desktopId"];
      const outputId = context["outputId"];
      const columns = context["columns"];

      if (
        activityId !== currentActivityId ||
        !validIdentifier(desktopId) ||
        !validIdentifier(outputId) ||
        !desktopIds.has(desktopId) ||
        !outputIds.has(outputId) ||
        !Array.isArray(columns) ||
        columns.length > LAYOUT_PERSISTENCE_LIMITS.columnsPerContext
      ) {
        return false;
      }

      const contextKey = `${activityId}\u0000${outputId}\u0000${desktopId}`;
      if (contextKeys.has(contextKey)) {
        return false;
      }
      contextKeys.add(contextKey);

      const matchesOutput = outputId === drop.outputId;
      const sourceContext = matchesOutput && desktopId === drop.sourceDesktopId;

      if (sourceContext) {
        sourceContextCount += 1;
      }

      if (desktopId === drop.targetDesktopId) {
        if (matchesOutput) {
          exactTargetContextCount += 1;
        }
      }

      for (const value of columns) {
        const column = record(value);
        const members = column?.["members"];

        if (
          column === null ||
          !Array.isArray(members) ||
          members.length > LAYOUT_PERSISTENCE_LIMITS.membersPerColumn
        ) {
          return false;
        }

        for (const value of members) {
          const member = record(value);
          const windowId = member?.["windowId"];

          totalWindowCount += 1;
          if (
            member === null ||
            !validIdentifier(windowId) ||
            totalWindowCount > LAYOUT_PERSISTENCE_LIMITS.windows ||
            windowIds.has(windowId)
          ) {
            return false;
          }
          windowIds.add(windowId);

          if (windowId === drop.windowId && sourceContext) {
            sourceWindowCount += 1;
          }
        }
      }
    }

    if (sourceContextCount !== 1 || exactTargetContextCount > 1) {
      return false;
    }

    for (const value of floatingWindows) {
      const floating = record(value);

      if (floating === null) {
        return false;
      }

      const activityId = floating["activityId"];
      const desktopId = floating["desktopId"];
      const outputId = floating["outputId"];
      const windowId = floating["windowId"];

      totalWindowCount += 1;
      if (
        activityId !== currentActivityId ||
        !validIdentifier(desktopId) ||
        !validIdentifier(outputId) ||
        !validIdentifier(windowId) ||
        !desktopIds.has(desktopId) ||
        !outputIds.has(outputId) ||
        totalWindowCount > LAYOUT_PERSISTENCE_LIMITS.windows ||
        windowIds.has(windowId)
      ) {
        return false;
      }
      windowIds.add(windowId);

      if (
        windowId === drop.windowId &&
        outputId === drop.outputId &&
        desktopId === drop.sourceDesktopId
      ) {
        sourceWindowCount += 1;
      }
    }

    return sourceWindowCount === 1 && windowIds.has(drop.windowId);
  } catch {
    return false;
  }
}

function readRequest(value: unknown): OverviewWindowDesktopDropRequest | null {
  const candidate = record(value);

  if (candidate === null) {
    return null;
  }

  const outputId = candidate["outputId"];
  const sourceDesktopId = candidate["sourceDesktopId"];
  const targetDesktopId = candidate["targetDesktopId"];
  const windowId = candidate["windowId"];

  if (
    !validIdentifier(outputId) ||
    !validIdentifier(sourceDesktopId) ||
    !validIdentifier(targetDesktopId) ||
    !validIdentifier(windowId)
  ) {
    return null;
  }

  return { outputId, sourceDesktopId, targetDesktopId, windowId };
}

function indexIdentifiers(value: unknown, limit: number): Set<string> | null {
  if (!Array.isArray(value) || value.length > limit) {
    return null;
  }

  const identifiers = new Set<string>();
  for (const identifier of value) {
    if (!validIdentifier(identifier) || identifiers.has(identifier)) {
      return null;
    }
    identifiers.add(identifier);
  }

  return identifiers;
}

function indexOutputs(value: unknown): Set<string> | null {
  if (
    !Array.isArray(value) ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.outputs
  ) {
    return null;
  }

  const identifiers = new Set<string>();
  for (const item of value) {
    const output = record(item);
    const outputId = output?.["outputId"];

    if (
      output === null ||
      !validIdentifier(outputId) ||
      identifiers.has(outputId)
    ) {
      return null;
    }
    identifiers.add(outputId);
  }

  return identifiers;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validIdentifier(value: unknown): value is string {
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
