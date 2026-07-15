import type { Rect } from "../core/geometry";
import { outputId } from "../core/ids";
import {
  findAdjacentOutput,
  type OutputDirection,
  type OutputGeometry,
} from "../core/output-navigation";

export function findOverviewNavigationTarget(
  sourceId: unknown,
  targets: unknown,
  direction: unknown,
): string | null {
  try {
    if (
      typeof sourceId !== "string" ||
      sourceId.length === 0 ||
      !Array.isArray(targets) ||
      !isOutputDirection(direction)
    ) {
      return null;
    }

    const normalizedTargets: OutputGeometry[] = [];
    const targetIds = new Set<string>();
    let sourceFound = false;

    for (const target of targets) {
      if (!isRecord(target)) {
        continue;
      }

      const id = target["id"];

      if (typeof id !== "string" || id.length === 0) {
        continue;
      }

      const rect = snapshotRect(target["rect"]);

      if (!rect) {
        if (id === sourceId) {
          return null;
        }

        continue;
      }

      if (targetIds.has(id)) {
        return null;
      }

      targetIds.add(id);
      sourceFound ||= id === sourceId;
      normalizedTargets.push({ id: outputId(id), rect });
    }

    if (!sourceFound) {
      return null;
    }

    return findAdjacentOutput(outputId(sourceId), normalizedTargets, direction);
  } catch {
    return null;
  }
}

function snapshotRect(value: unknown): Rect | null {
  if (!isRecord(value) || Array.isArray(value)) {
    return null;
  }

  const x = value["x"];
  const y = value["y"];
  const width = value["width"];
  const height = value["height"];

  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(x + width) ||
    !Number.isFinite(y + height)
  ) {
    return null;
  }

  return { height, width, x, y };
}

function isOutputDirection(value: unknown): value is OutputDirection {
  return (
    value === "down" || value === "left" || value === "right" || value === "up"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
