export function planOverviewDesktopDrop(
  desktopCount: number,
  sourceIndex: number,
  insertionSlot: number,
  keepEmptyDesktopAboveFirst = false,
): number | null {
  if (
    !Number.isSafeInteger(desktopCount) ||
    desktopCount < 2 ||
    !Number.isSafeInteger(sourceIndex) ||
    typeof keepEmptyDesktopAboveFirst !== "boolean" ||
    sourceIndex < (keepEmptyDesktopAboveFirst ? 1 : 0) ||
    sourceIndex >= desktopCount - 1 ||
    !Number.isSafeInteger(insertionSlot) ||
    insertionSlot < (keepEmptyDesktopAboveFirst ? 1 : 0) ||
    insertionSlot >= desktopCount
  ) {
    return null;
  }

  const targetIndex =
    insertionSlot > sourceIndex ? insertionSlot - 1 : insertionSlot;
  const firstMovableIndex = keepEmptyDesktopAboveFirst ? 1 : 0;

  return targetIndex === sourceIndex ||
    targetIndex < firstMovableIndex ||
    targetIndex >= desktopCount - 1
    ? null
    : targetIndex;
}
