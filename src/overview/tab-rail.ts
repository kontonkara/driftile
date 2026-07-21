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
  readonly visible: boolean;
  readonly windowId: string;
}

export interface OverviewTabRailInput {
  readonly anchorIndex: number;
  readonly columnFrame: OverviewTabRailRect;
  readonly memberCount: number;
  readonly memberWindowIds: readonly string[];
  readonly minimumY: number;
  readonly presentation: "tabbed";
  readonly selectedIndex: number;
  readonly viewport: OverviewTabRailRect;
}

export interface OverviewTabRailPlan {
  readonly anchorIndex: number;
  readonly chipFrames: readonly OverviewTabRailChipFrame[];
  readonly firstVisibleIndex: number;
  readonly hiddenAfter: number;
  readonly hiddenBefore: number;
  readonly lastVisibleIndex: number;
  readonly railFrame: OverviewTabRailRect;
  readonly visibleCapacity: number;
}

const MINIMUM_CHIP_WIDTH = 28;
const MAXIMUM_CHIP_WIDTH = 120;
const MINIMUM_CHIP_HEIGHT = 16;
const MAXIMUM_CHIP_HEIGHT = 24;
const CHIP_GAP = 4;
const MAXIMUM_RAIL_INSET = 8;
const MAXIMUM_WINDOW_ID_LENGTH = 4096;

export function planOverviewTabRail(
  input: unknown,
): OverviewTabRailPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const anchorIndex = input["anchorIndex"];
    const presentation = input["presentation"];
    const memberCount = input["memberCount"];
    const memberWindowIdsValue = input["memberWindowIds"];
    const minimumY = input["minimumY"];
    const selectedIndex = input["selectedIndex"];
    const columnFrame = snapshotRect(input["columnFrame"]);
    const viewport = snapshotRect(input["viewport"]);

    if (
      presentation !== "tabbed" ||
      !validMemberCount(memberCount) ||
      !validCoordinate(minimumY) ||
      !validMemberIndex(anchorIndex, memberCount) ||
      !validSelectedIndex(selectedIndex, memberCount) ||
      columnFrame === null ||
      viewport === null
    ) {
      return null;
    }

    const memberWindowIds = snapshotMemberWindowIds(
      memberWindowIdsValue,
      memberCount,
    );

    if (memberWindowIds === null) {
      return null;
    }

    const visibleFrame = intersectRects(columnFrame, viewport);

    if (visibleFrame === null) {
      return null;
    }

    const availableTop = Math.max(visibleFrame.y, minimumY);
    const availableHeight = visibleFrame.y + visibleFrame.height - availableTop;

    if (!validDimension(availableHeight)) {
      return null;
    }

    const visibleCapacity = Math.min(
      memberCount,
      Math.floor(
        (visibleFrame.width + CHIP_GAP) / (MINIMUM_CHIP_WIDTH + CHIP_GAP),
      ),
    );

    if (!validVisibleCapacity(visibleCapacity, memberCount)) {
      return null;
    }

    const firstVisibleIndex = Math.min(
      memberCount - visibleCapacity,
      Math.max(0, anchorIndex - Math.floor((visibleCapacity - 1) / 2)),
    );
    const lastVisibleIndex = firstVisibleIndex + visibleCapacity - 1;
    const gapsWidth = (visibleCapacity - 1) * CHIP_GAP;
    const minimumRailWidth = visibleCapacity * MINIMUM_CHIP_WIDTH + gapsWidth;

    const horizontalInset = Math.min(
      MAXIMUM_RAIL_INSET,
      (visibleFrame.width - minimumRailWidth) / 2,
    );
    const usableWidth = visibleFrame.width - horizontalInset * 2;
    const chipWidth = Math.min(
      MAXIMUM_CHIP_WIDTH,
      (usableWidth - gapsWidth) / visibleCapacity,
    );
    const railWidth = visibleCapacity * chipWidth + gapsWidth;
    const verticalInset = Math.min(
      MAXIMUM_RAIL_INSET,
      (availableHeight - MINIMUM_CHIP_HEIGHT) / 2,
    );

    if (verticalInset < 0) {
      return null;
    }

    const chipHeight = Math.min(
      MAXIMUM_CHIP_HEIGHT,
      availableHeight - verticalInset * 2,
    );
    const railX = visibleFrame.x + (visibleFrame.width - railWidth) / 2;
    const railY = availableTop + verticalInset;

    if (
      !validDimension(chipWidth) ||
      chipWidth < MINIMUM_CHIP_WIDTH ||
      !validDimension(chipHeight) ||
      chipHeight < MINIMUM_CHIP_HEIGHT ||
      !validDimension(railWidth) ||
      !validCoordinate(railX) ||
      !validCoordinate(railX + railWidth) ||
      !validCoordinate(railY) ||
      !validCoordinate(railY + chipHeight)
    ) {
      return null;
    }

    const chipFrames: OverviewTabRailChipFrame[] = [];

    for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
      const x =
        railX + (memberIndex - firstVisibleIndex) * (chipWidth + CHIP_GAP);

      if (!validCoordinate(x) || !validCoordinate(x + chipWidth)) {
        return null;
      }

      chipFrames.push(
        Object.freeze({
          height: chipHeight,
          memberIndex,
          selected: memberIndex === selectedIndex,
          visible:
            memberIndex >= firstVisibleIndex && memberIndex <= lastVisibleIndex,
          width: chipWidth,
          windowId: memberWindowIds[memberIndex] as string,
          x: normalizeZero(x),
          y: normalizeZero(railY),
        }),
      );
    }

    return Object.freeze({
      anchorIndex,
      chipFrames: Object.freeze(chipFrames),
      firstVisibleIndex,
      hiddenAfter: memberCount - lastVisibleIndex - 1,
      hiddenBefore: firstVisibleIndex,
      lastVisibleIndex,
      railFrame: Object.freeze({
        height: chipHeight,
        width: railWidth,
        x: normalizeZero(railX),
        y: normalizeZero(railY),
      }),
      visibleCapacity,
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
  return validMemberIndex(value, memberCount);
}

function validMemberIndex(
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

function snapshotMemberWindowIds(
  value: unknown,
  memberCount: number,
): readonly string[] | null {
  if (!Array.isArray(value) || value.length !== memberCount) {
    return null;
  }

  const snapshot: string[] = [];
  const uniqueWindowIds = new Set<string>();

  for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
    const windowId: unknown = value[memberIndex];

    if (
      typeof windowId !== "string" ||
      windowId.length === 0 ||
      windowId.length > MAXIMUM_WINDOW_ID_LENGTH ||
      uniqueWindowIds.has(windowId)
    ) {
      return null;
    }

    uniqueWindowIds.add(windowId);
    snapshot.push(windowId);
  }

  return snapshot;
}

function validVisibleCapacity(value: number, memberCount: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= memberCount;
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
