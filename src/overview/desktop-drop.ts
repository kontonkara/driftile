export function planOverviewDesktopDrop(
  desktopCount: number,
  sourceIndex: number,
  insertionSlot: number,
): number | null {
  if (
    !Number.isSafeInteger(desktopCount) ||
    desktopCount < 2 ||
    !Number.isSafeInteger(sourceIndex) ||
    sourceIndex < 0 ||
    sourceIndex >= desktopCount - 1 ||
    !Number.isSafeInteger(insertionSlot) ||
    insertionSlot < 0 ||
    insertionSlot >= desktopCount
  ) {
    return null;
  }

  const targetIndex =
    insertionSlot > sourceIndex ? insertionSlot - 1 : insertionSlot;

  return targetIndex === sourceIndex ? null : targetIndex;
}
