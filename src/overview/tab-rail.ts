import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export interface OverviewTabRailRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface OverviewTabRailChipFrame extends OverviewTabRailRect {
  readonly memberIndex: number;
  readonly selected: boolean;
}

export interface OverviewTabRailInput {
  readonly columnFrame: OverviewTabRailRect;
  readonly memberCount: number;
  readonly presentation: "tabbed";
  readonly selectedIndex: number;
  readonly viewport: OverviewTabRailRect;
}

export interface OverviewTabRailPlan {
  readonly chipFrames: readonly OverviewTabRailChipFrame[];
  readonly railFrame: OverviewTabRailRect;
}

const MINIMUM_CHIP_WIDTH = 28;
const MAXIMUM_CHIP_WIDTH = 120;
const MINIMUM_CHIP_HEIGHT = 16;
const MAXIMUM_CHIP_HEIGHT = 24;
const CHIP_GAP = 4;
const MAXIMUM_RAIL_INSET = 8;

export function planOverviewTabRail(
  input: unknown,
): OverviewTabRailPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const presentation = input["presentation"];
    const memberCount = input["memberCount"];
    const selectedIndex = input["selectedIndex"];
    const columnFrame = snapshotRect(input["columnFrame"]);
    const viewport = snapshotRect(input["viewport"]);

    if (
      presentation !== "tabbed" ||
      !validMemberCount(memberCount) ||
      !validSelectedIndex(selectedIndex, memberCount) ||
      columnFrame === null ||
      viewport === null
    ) {
      return null;
    }

    const visibleFrame = intersectRects(columnFrame, viewport);

    if (visibleFrame === null) {
      return null;
    }

    const gapsWidth = (memberCount - 1) * CHIP_GAP;
    const minimumRailWidth = memberCount * MINIMUM_CHIP_WIDTH + gapsWidth;

    if (visibleFrame.width < minimumRailWidth) {
      return null;
    }

    const horizontalInset = Math.min(
      MAXIMUM_RAIL_INSET,
      (visibleFrame.width - minimumRailWidth) / 2,
    );
    const usableWidth = visibleFrame.width - horizontalInset * 2;
    const chipWidth = Math.min(
      MAXIMUM_CHIP_WIDTH,
      (usableWidth - gapsWidth) / memberCount,
    );
    const railWidth = memberCount * chipWidth + gapsWidth;
    const verticalInset = Math.min(
      MAXIMUM_RAIL_INSET,
      (visibleFrame.height - MINIMUM_CHIP_HEIGHT) / 2,
    );

    if (verticalInset < 0) {
      return null;
    }

    const chipHeight = Math.min(
      MAXIMUM_CHIP_HEIGHT,
      visibleFrame.height - verticalInset * 2,
    );
    const railX = visibleFrame.x + (visibleFrame.width - railWidth) / 2;
    const railY = visibleFrame.y + verticalInset;

    if (
      !validDimension(chipWidth) ||
      chipWidth < MINIMUM_CHIP_WIDTH ||
      !validDimension(chipHeight) ||
      chipHeight < MINIMUM_CHIP_HEIGHT ||
      !validDimension(railWidth) ||
      !validCoordinate(railX) ||
      !validCoordinate(railY)
    ) {
      return null;
    }

    const chipFrames: OverviewTabRailChipFrame[] = [];

    for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
      const x = railX + memberIndex * (chipWidth + CHIP_GAP);

      chipFrames.push(
        Object.freeze({
          height: chipHeight,
          memberIndex,
          selected: memberIndex === selectedIndex,
          width: chipWidth,
          x: normalizeZero(x),
          y: normalizeZero(railY),
        }),
      );
    }

    return Object.freeze({
      chipFrames: Object.freeze(chipFrames),
      railFrame: Object.freeze({
        height: chipHeight,
        width: railWidth,
        x: normalizeZero(railX),
        y: normalizeZero(railY),
      }),
    });
  } catch {
    return null;
  }
}

function intersectRects(
  first: OverviewTabRailRect,
  second: OverviewTabRailRect,
): OverviewTabRailRect | null {
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const width = right - x;
  const height = bottom - y;

  return validDimension(width) && validDimension(height)
    ? { height, width, x, y }
    : null;
}

function snapshotRect(value: unknown): OverviewTabRailRect | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = value["x"];
  const y = value["y"];
  const width = value["width"];
  const height = value["height"];

  if (
    !validCoordinate(x) ||
    !validCoordinate(y) ||
    !validDimension(width) ||
    !validDimension(height) ||
    !validCoordinate(x + width) ||
    !validCoordinate(y + height)
  ) {
    return null;
  }

  return { height, width, x, y };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validMemberCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 2 &&
    value <= LAYOUT_PERSISTENCE_LIMITS.membersPerColumn
  );
}

function validSelectedIndex(
  value: unknown,
  memberCount: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < memberCount
  );
}

function validCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function validDimension(value: unknown): value is number {
  return validCoordinate(value) && value > 0;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
