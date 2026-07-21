import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const desktopCard = readFileSync(
  new URL("contents/runtime/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const keyboardSelectionChange = scene.slice(
  scene.indexOf("onKeyboardSelectionIdChanged:"),
  scene.indexOf("onKeyboardHelpVisibleChanged:"),
);

const cardCapture = desktopCard.slice(
  desktopCard.indexOf("function captureTabRailWheelOwner("),
  desktopCard.indexOf("function tabRailWheelOwnerIsExact("),
);
const cardOwnerValidation = desktopCard.slice(
  desktopCard.indexOf("function tabRailWheelOwnerIsExact("),
  desktopCard.indexOf("function tabRailWheelTargetId("),
);
const cardTargetAndAdvance = desktopCard.slice(
  desktopCard.indexOf("function tabRailWheelTargetId("),
  desktopCard.indexOf("function windowSnapshotCanActivateMinimizedWindow("),
);
const cardOverflow = desktopCard.slice(
  desktopCard.indexOf("function tabRailOverflowCountForFrame("),
  desktopCard.indexOf("function tabFrameForPresentation("),
);
const wheelHandlers = scene.slice(
  scene.indexOf("id: spatialVerticalWheelHandler"),
  scene.indexOf("id: spatialTouchPanInput"),
);
const centralRoute = scene.slice(
  scene.indexOf("function routeOverviewWheel("),
  scene.indexOf("function captureOverviewTabRailWheelOwner("),
);
const sceneCapture = scene.slice(
  scene.indexOf("function captureOverviewTabRailWheelOwner("),
  scene.indexOf("function overviewTabRailWheelOwnerIsExact("),
);
const sceneOwnerValidation = scene.slice(
  scene.indexOf("function overviewTabRailWheelOwnerIsExact("),
  scene.indexOf("function handleOverviewTabRailWheel("),
);
const invalidSampleConsumption = scene.slice(
  scene.indexOf("function consumeInvalidOverviewTabRailWheelSample("),
  scene.indexOf("function overviewTabRailWheelOwnerIsExact("),
);
const railHandling = scene.slice(
  scene.indexOf("function handleOverviewTabRailWheel("),
  scene.indexOf("function overviewTabRailWheelPlanIsExact("),
);
const railPlanValidation = scene.slice(
  scene.indexOf("function overviewTabRailWheelPlanIsExact("),
  scene.indexOf("function spatialWheelAxisPlanIsValid("),
);
const shiftRoute = scene.slice(
  scene.indexOf("function routeOverviewShiftHorizontalWheel("),
  scene.indexOf("function releaseOverviewWheelAxisIfIdle("),
);
const release = scene.slice(
  scene.indexOf("function releaseOverviewWheelAxisIfIdle("),
  scene.indexOf("function handleOverviewWheel("),
);
const reset = scene.slice(
  scene.indexOf("function resetOverviewWheelState("),
  scene.indexOf("function resetOverviewHorizontalWheelState("),
);
const localSelection = scene.slice(
  scene.indexOf("function setKeyboardSelectionTargetWithoutViewport("),
  scene.indexOf("function synchronizeKeyboardSelectionViewport("),
);

function occurrenceCount(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("overview tab rail wheel scene ownership", () => {
  it("marks overflow only on the exact first and last rendered chips", () => {
    expect(desktopCard).toMatch(
      /readonly property int hiddenBeforeCount: card\.tabRailOverflowCountForFrame\([\s\S]*frame, "before"\)[\s\S]*readonly property int hiddenAfterCount: card\.tabRailOverflowCountForFrame\([\s\S]*frame, "after"\)/u,
    );
    expect(desktopCard).toMatch(
      /anchors\.left: parent\.left[\s\S]*width: 2\s*visible: tabShell\.hiddenBeforeCount > 0[\s\S]*anchors\.right: parent\.right[\s\S]*width: 2\s*visible: tabShell\.hiddenAfterCount > 0/u,
    );
    expect(cardOverflow).toMatch(
      /expectedFrame\.visible !== true[\s\S]*tiledPresentations\[expectedWindowId\] !== tiled[\s\S]*tabRailPlanIsExact\(plan, column, tiled\.columnIndex, sourceFrame,[\s\S]*anchorIndex\)[\s\S]*plan\.chipFrames\[tiled\.memberIndex\] !== expectedFrame/u,
    );
    expect(cardOverflow).toMatch(
      /direction === "before"[\s\S]*tiled\.memberIndex === plan\.firstVisibleIndex \? plan\.hiddenBefore : 0[\s\S]*tiled\.memberIndex === plan\.lastVisibleIndex \? plan\.hiddenAfter : 0/u,
    );
  });

  it("captures one exact rail and resolves only its nearest visible chip", () => {
    expect(cardCapture).toContain("function captureTabRailWheelOwner(");
    expect(cardCapture).toMatch(
      /const viewportPoint = viewport\.mapFromItem\(sceneItem, scenePoint\.x, scenePoint\.y\);[\s\S]*viewportPoint\.x < 0[\s\S]*viewportPoint\.y < 0[\s\S]*viewportPoint\.x >= viewport\.width[\s\S]*viewportPoint\.y >= viewport\.height/u,
    );
    expect(cardCapture).toMatch(
      /for \(let candidateIndex = 0; candidateIndex < columns\.length; candidateIndex \+= 1\)[\s\S]*const sourceFrame = tabRailColumnFrame\(candidateColumn, candidateIndex\);[\s\S]*tabRailPlanIsExact\(candidatePlan, candidateColumn, candidateIndex,[\s\S]*sourceFrame, anchorIndex\)/u,
    );
    expect(cardCapture).toMatch(
      /const rail = candidatePlan\.railFrame;[\s\S]*viewportPoint\.x < rail\.x \|\| viewportPoint\.y < rail\.y[\s\S]*viewportPoint\.x >= rail\.x \+ rail\.width[\s\S]*viewportPoint\.y >= rail\.y \+ rail\.height/u,
    );
    expect(cardCapture).toMatch(
      /if \(column !== null\) \{\s*return null;\s*\}\s*column = candidateColumn;\s*columnIndex = candidateIndex;\s*plan = candidatePlan;/u,
    );
    expect(cardCapture).toMatch(
      /for \(const chip of plan\.chipFrames\) \{\s*if \(!chip \|\| chip\.visible !== true\) \{\s*continue;[\s\S]*const distance = Math\.abs\(viewportPoint\.x - \(chip\.x \+ chip\.width \/ 2\)\);[\s\S]*hoveredMemberIndex = chip\.memberIndex;/u,
    );
    expect(cardCapture).toContain("if (hoveredMemberIndex < 0)");
    expect(cardCapture).not.toMatch(
      /tabTarget|clippedLogicalTabNavigationRect|mapFromItem\(viewport/u,
    );
  });

  it("freezes card, column, and navigation identity before claiming a gesture", () => {
    expect(cardCapture).toMatch(
      /const candidatePlan = tabRailPlans\[candidateIndex\];[\s\S]*tabRailPlanIsExact\(candidatePlan, candidateColumn, candidateIndex,[\s\S]*sourceFrame, anchorIndex\)/u,
    );
    expect(cardCapture).toMatch(
      /Object\.freeze\(navigationMemberIndexes\);\s*Object\.freeze\(navigationTargetIds\);\s*Object\.freeze\(navigationWindowIds\);\s*return Object\.freeze\(\{/u,
    );
    for (const identity of [
      "activityId: overviewActivityId",
      "card,",
      "column,",
      "columns,",
      "context,",
      "desktop,",
      "desktopId,",
      "outputId,",
      "screen",
    ]) {
      expect(cardCapture).toContain(identity);
    }
    expect(cardCapture).toContain(
      "expectedKeyboardSelectionId: keyboardSelectionId",
    );
    expect(cardCapture).toContain("currentNavigationIndex");
  });

  it("revalidates the frozen owner against current card and member topology", () => {
    expect(cardOwnerValidation).toMatch(
      /!owner \|\| !Object\.isFrozen\(owner\) \|\| owner\.card !== card[\s\S]*owner\.context !== context \|\| owner\.columns !== columns[\s\S]*context\.columns !== columns/u,
    );
    expect(cardOwnerValidation).toMatch(
      /owner\.desktop !== desktop[\s\S]*owner\.desktopId !== desktopId[\s\S]*owner\.screen !== screen[\s\S]*owner\.outputId !== outputId[\s\S]*owner\.activityId !== overviewActivityId/u,
    );
    expect(cardOwnerValidation).toContain(
      "owner.expectedKeyboardSelectionId !== keyboardSelectionId",
    );
    expect(cardOwnerValidation).toMatch(
      /Object\.isFrozen\(owner\.navigationMemberIndexes\)[\s\S]*Object\.isFrozen\(owner\.navigationTargetIds\)[\s\S]*Object\.isFrozen\(owner\.navigationWindowIds\)/u,
    );
    expect(cardOwnerValidation).toMatch(
      /columns\[owner\.columnIndex\] !== owner\.column[\s\S]*owner\.column\.presentation !== "tabbed"/u,
    );
    expect(cardOwnerValidation).toMatch(
      /presentation\.sourceCard !== card[\s\S]*presentation\.sourceDesktop !== desktop[\s\S]*presentation\.sourceDesktopId !== desktopId[\s\S]*presentation\.sourceScreen !== screen/u,
    );
    expect(cardOwnerValidation).toMatch(
      /owner\.navigationMemberIndexes\[navigationIndex\] !== memberIndex[\s\S]*owner\.navigationWindowIds\[navigationIndex\] !== member\.windowId[\s\S]*owner\.navigationTargetIds\[navigationIndex\][\s\S]*!== navigationTargetId\(member\.windowId\)/u,
    );
    expect(cardOwnerValidation).toContain(
      "return navigationIndex === owner.navigationWindowIds.length;",
    );
  });

  it("claims the rail in the central route before global vertical or horizontal behavior", () => {
    expect(sceneCapture).toMatch(
      /const workspaceIndex = spatialWorkspaceIndexAtPoint\(point\);[\s\S]*const expectedDesktopId = desktopIds\[workspaceIndex\];[\s\S]*const card = desktopCardAt\(workspaceIndex\);/u,
    );
    expect(sceneCapture).toMatch(
      /const owner = card\.captureTabRailWheelOwner\(root, point\);[\s\S]*Object\.isFrozen\(owner\)[\s\S]*owner\.card === card[\s\S]*owner\.desktopId === expectedDesktopId/u,
    );
    expect(sceneOwnerValidation).toMatch(
      /Object\.isFrozen\(owner\)[\s\S]*typeof owner\.card\.tabRailWheelOwnerIsExact === "function"[\s\S]*owner\.card\.tabRailWheelOwnerIsExact\(owner\)/u,
    );

    const captureIndex = centralRoute.indexOf(
      "overviewTabRailWheelOwner = captureOverviewTabRailWheelOwner(point);",
    );
    const claimIndex = centralRoute.indexOf(
      "const claimedAxis = overviewWheelAxisOwner.length === 0;",
    );
    const railIndex = centralRoute.indexOf(
      "if (overviewTabRailWheelGestureOwned)",
    );
    const globalIndex = centralRoute.indexOf(
      'const handled = plan.axis === "horizontal"',
    );
    expect(captureIndex).toBeGreaterThanOrEqual(0);
    expect(captureIndex).toBeLessThan(claimIndex);
    expect(claimIndex).toBeLessThan(railIndex);
    expect(railIndex).toBeLessThan(globalIndex);
    expect(centralRoute.slice(railIndex, globalIndex)).not.toMatch(
      /handleOverviewHorizontalWheel\(event, point\)|handleOverviewWheel\(event\)/u,
    );
  });

  it("consumes rail boundaries and invalid mid-gesture state without leaking", () => {
    const railBranch = centralRoute.slice(
      centralRoute.indexOf("if (overviewTabRailWheelGestureOwned)"),
      centralRoute.indexOf('const handled = plan.axis === "horizontal"'),
    );
    expect(railBranch).toMatch(
      /if \(!overviewTabRailWheelOwnerIsExact\(\)\) \{\s*invalidateOverviewTabRailWheelOwner\(\);\s*event\.accepted = true;\s*return true;/u,
    );
    expect(railBranch).toMatch(
      /if \(!handleOverviewTabRailWheel\(event, plan\.axis\)\) \{\s*invalidateOverviewTabRailWheelOwner\(\);\s*\}\s*event\.accepted = true;\s*return true;/u,
    );
    expect(centralRoute).toMatch(
      /overviewTabRailWheelOwner = captureOverviewTabRailWheelOwner\(point\);\s*overviewTabRailWheelGestureOwned = overviewTabRailWheelOwner !== null;/u,
    );
    expect(centralRoute).toMatch(
      /if \(!event\) \{\s*return consumeInvalidOverviewTabRailWheelSample\(event\);/u,
    );
    expect(centralRoute).toMatch(
      /if \(!spatialPointerInputEligible\) \{\s*return consumeInvalidOverviewTabRailWheelSample\(event\);/u,
    );
    expect(centralRoute).toMatch(
      /!spatialWheelAxisPlanIsValid\(plan, expectedAxisOwner\) \|\| plan\.axis === null\) \{\s*return consumeInvalidOverviewTabRailWheelSample\(event\);/u,
    );
    expect(invalidSampleConsumption).toMatch(
      /if \(!overviewTabRailWheelGestureOwned\) \{\s*return false;\s*\}\s*invalidateOverviewTabRailWheelOwner\(\);\s*if \(event\) \{\s*event\.accepted = true;\s*\}\s*return true;/u,
    );
    expect(reset).toMatch(
      /function invalidateOverviewTabRailWheelOwner\(\) \{\s*overviewTabRailWheelAngleRemainder = 0;\s*overviewTabRailWheelOwner = null;\s*overviewTabRailWheelPixelRemainder = 0;\s*\}/u,
    );
    expect(reset).not.toMatch(
      /function invalidateOverviewTabRailWheelOwner\(\)[\s\S]*overviewTabRailWheelGestureOwned = false;/u,
    );
    expect(railHandling).toMatch(/if \(!plan\.moved\) \{\s*return true;\s*\}/u);
    expect(railHandling.indexOf("if (!plan.moved)")).toBeLessThan(
      railHandling.indexOf("const targetId ="),
    );
    expect(railPlanValidation).toMatch(
      /if \(plan\.direction === null\) \{\s*return plan\.stepsApplied === 0\s*&& plan\.targetIndex === owner\.currentNavigationIndex;/u,
    );
  });

  it("normalizes the owned physical delta exactly once before planning", () => {
    expect(centralRoute).toMatch(
      /planOverviewSpatialWheelAxis\(\{[\s\S]*angleDeltaX: event\.angleDelta\.x,[\s\S]*angleDeltaY: event\.angleDelta\.y,[\s\S]*pixelDeltaX: event\.pixelDelta\.x,[\s\S]*pixelDeltaY: event\.pixelDelta\.y/u,
    );
    expect(centralRoute).not.toContain(
      "normalizeOverviewPhysicalWheelAngleDelta(",
    );
    expect(centralRoute).not.toContain(
      "normalizeOverviewPhysicalWheelPixelDelta(",
    );
    expect(
      occurrenceCount(
        railHandling,
        "runtime.normalizeOverviewPhysicalWheelAngleDelta(",
      ),
    ).toBe(1);
    expect(
      occurrenceCount(
        railHandling,
        "runtime.normalizeOverviewPhysicalWheelPixelDelta(",
      ),
    ).toBe(1);
    expect(railHandling).toMatch(
      /const rawAngleDelta = axis === "horizontal"[\s\S]*const rawPixelDelta = axis === "horizontal"[\s\S]*const angleDelta = runtime\.normalizeOverviewPhysicalWheelAngleDelta\([\s\S]*const pixelDelta = runtime\.normalizeOverviewPhysicalWheelPixelDelta\(/u,
    );
    expect(railHandling).toMatch(
      /planOverviewTabRailWheel\(\{\s*angleDelta,\s*angleRemainder: overviewTabRailWheelAngleRemainder,\s*currentIndex: owner\.currentNavigationIndex,\s*memberCount: owner\.navigationWindowIds\.length,\s*pixelDelta,\s*pixelRemainder: overviewTabRailWheelPixelRemainder/u,
    );
  });

  it("accepts only frozen consumed plans with bounded exclusive remainders", () => {
    expect(railPlanValidation).toMatch(
      /!plan \|\| !Object\.isFrozen\(plan\) \|\| plan\.consumed !== true/u,
    );
    expect(railPlanValidation).toMatch(
      /plan\.inputMode !== "angle" && plan\.inputMode !== "pixel"[\s\S]*plan\.direction !== null && plan\.direction !== "next"[\s\S]*plan\.direction !== "previous"/u,
    );
    expect(railPlanValidation).toMatch(
      /plan\.stepsApplied < 0 \|\| plan\.stepsApplied > 4[\s\S]*plan\.targetIndex >= owner\.navigationWindowIds\.length/u,
    );
    expect(railPlanValidation).toMatch(
      /Math\.abs\(plan\.angleRemainder\) >= 120[\s\S]*Math\.abs\(plan\.pixelRemainder\) >= 40/u,
    );
    expect(railPlanValidation).toMatch(
      /plan\.inputMode === "angle" && plan\.pixelRemainder !== 0[\s\S]*plan\.inputMode === "pixel" && plan\.angleRemainder !== 0/u,
    );
    expect(railPlanValidation).toMatch(
      /const distance = Math\.abs\(plan\.targetIndex - owner\.currentNavigationIndex\);[\s\S]*plan\.stepsApplied !== distance[\s\S]*plan\.moved !== \(distance > 0\)/u,
    );
    expect(railPlanValidation).toMatch(
      /if \(distance === 0\) \{\s*return plan\.direction === "next"\s*\? owner\.currentNavigationIndex === owner\.navigationWindowIds\.length - 1\s*: owner\.currentNavigationIndex === 0;/u,
    );
    expect(railPlanValidation).toMatch(
      /return plan\.direction === "next"\s*\? plan\.targetIndex > owner\.currentNavigationIndex\s*: plan\.targetIndex < owner\.currentNavigationIndex;/u,
    );
  });

  it("selects the exact target and advances the frozen owner identity", () => {
    expect(cardTargetAndAdvance).toMatch(
      /function tabRailWheelTargetId\(owner, targetNavigationIndex\)[\s\S]*!tabRailWheelOwnerIsExact\(owner\)[\s\S]*return owner\.navigationTargetIds\[targetNavigationIndex\];/u,
    );
    expect(railHandling).toMatch(
      /const targetId = owner\.card\.tabRailWheelTargetId\(owner, plan\.targetIndex\);[\s\S]*navigationTargetForId\(collectNavigationTargets\(\), targetId\)/u,
    );
    expect(railHandling).toMatch(
      /target\.id !== targetId \|\| target\.kind !== "window"[\s\S]*target\.desktopId !== owner\.desktopId \|\| target\.screen !== owner\.screen[\s\S]*!setKeyboardSelectionTargetWithoutViewport\(target\)/u,
    );
    expect(railHandling).not.toContain("setKeyboardSelectionTarget(target");
    expect(railHandling).toMatch(
      /const advancedOwner = owner\.card\.advanceTabRailWheelOwner\([\s\S]*owner, plan\.targetIndex, targetId\);[\s\S]*advancedOwner\.currentNavigationIndex !== plan\.targetIndex[\s\S]*advancedOwner\.expectedKeyboardSelectionId !== targetId[\s\S]*overviewTabRailWheelOwner = advancedOwner;[\s\S]*return overviewTabRailWheelOwnerIsExact\(\);/u,
    );
    expect(cardTargetAndAdvance).toMatch(
      /expectedKeyboardSelectionId !== owner\.navigationTargetIds\[targetNavigationIndex\][\s\S]*keyboardSelectionId !== expectedKeyboardSelectionId[\s\S]*const advanced = Object\.freeze\(\{/u,
    );
    expect(cardTargetAndAdvance).toContain(
      "return tabRailWheelOwnerIsExact(advanced) ? advanced : null;",
    );
  });

  it("reveals rail selection without recentering either overview camera", () => {
    expect(scene).toContain(
      "property bool keyboardSelectionViewportSyncSuppressed: false",
    );
    expect(keyboardSelectionChange).toMatch(
      /const synchronizeViewport = !keyboardSelectionViewportSyncSuppressed;[\s\S]*keyboardSelectionViewportSyncSuppressed = false;[\s\S]*if \(synchronizeViewport && expectedTargetId\.length > 0\) \{\s*Qt\.callLater\(root\.synchronizeKeyboardSelectionViewportTarget,/u,
    );
    expect(localSelection).toMatch(
      /keyboardSelectionViewportTarget = null;\s*keyboardSelectionViewportAnimateVisual = false;[\s\S]*if \(keyboardSelectionId === target\.id\) \{\s*return true;[\s\S]*keyboardSelectionViewportSyncSuppressed = true;\s*keyboardSelectionId = target\.id;[\s\S]*finally \{\s*keyboardSelectionViewportSyncSuppressed = false;/u,
    );
    expect(localSelection).not.toMatch(
      /synchronizeKeyboardSelectionViewport\(|setSpatialContentY\(|revealHorizontalNavigationTarget\(/u,
    );
  });

  it("consumes Shift during ownership and clears owner plus both remainders on release", () => {
    expect(shiftRoute).toMatch(
      /event\.modifiers !== Qt\.ShiftModifier[\s\S]*if \(overviewTabRailWheelGestureOwned\) \{\s*event\.accepted = true;\s*return true;\s*\}/u,
    );
    expect(shiftRoute.indexOf("overviewTabRailWheelGestureOwned")).toBeLessThan(
      shiftRoute.indexOf(
        "const claimedAxis = overviewWheelAxisOwner.length === 0;",
      ),
    );
    expect(
      wheelHandlers.match(
        /onActiveChanged: root\.releaseOverviewWheelAxisIfIdle\(\)/gu,
      ),
    ).toHaveLength(3);
    expect(release).toMatch(
      /!spatialVerticalWheelHandler\.active && !spatialHorizontalWheelHandler\.active[\s\S]*!spatialShiftHorizontalWheelHandler\.active[\s\S]*overviewWheelAxisOwner = "";\s*resetOverviewTabRailWheelState\(\);/u,
    );
    expect(reset).toMatch(
      /function resetOverviewWheelState\(\) \{\s*if \(overviewTabRailWheelGestureOwned\) \{\s*invalidateOverviewTabRailWheelOwner\(\);\s*\} else \{\s*resetOverviewTabRailWheelState\(\);/u,
    );
    expect(reset).toMatch(
      /function resetOverviewTabRailWheelState\(\) \{\s*overviewTabRailWheelAngleRemainder = 0;\s*overviewTabRailWheelGestureOwned = false;\s*overviewTabRailWheelOwner = null;\s*overviewTabRailWheelPixelRemainder = 0;/u,
    );
  });

  it("uses only public timer-free QML contracts for wheel ownership", () => {
    const contract = [
      cardCapture,
      cardOwnerValidation,
      cardTargetAndAdvance,
      cardOverflow,
      centralRoute,
      sceneCapture,
      sceneOwnerValidation,
      invalidSampleConsumption,
      railHandling,
      railPlanValidation,
      shiftRoute,
      release,
      reset,
    ].join("\n");

    expect(contract).not.toMatch(
      /org\.kde\.kwin\.private|\bTimer\s*\{|Qt\.callLater|setTimeout|setInterval/u,
    );
  });
});
