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

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing start marker: ${start}`).toBeGreaterThanOrEqual(
    0,
  );
  expect(endIndex, `missing end marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

const motionAnimation = section(
  desktopCard,
  'property string presentationMotionPhase: "invalid"',
  "id: numberGutter",
);
const motionSnapshots = section(
  desktopCard,
  "function presentationMotionKindIsValid(kind)",
  "function advancePresentationMotionRequestId()",
);
const motionScheduling = section(
  desktopCard,
  "function schedulePresentationMotion()",
  "function presentationMotionTracks(plan, fromSnapshot, targetSnapshot)",
);
const motionTracks = section(
  desktopCard,
  "function presentationMotionTracks(plan, fromSnapshot, targetSnapshot)",
  "function presentationMotionDuration(tracks, fromSnapshot, targetSnapshot)",
);
const motionLifecycle = section(
  desktopCard,
  "function presentationMotionKindIsValid(kind)",
  "function scheduleDesktopSurfaceReload()",
);
const motionVisuals = section(
  desktopCard,
  "function presentationMotionInterpolatedFrame(fromFrame, toFrame, progress)",
  "function scheduleDesktopSurfaceReload()",
);
const driftBindings = section(
  desktopCard,
  "onCurrentChanged:",
  "function presentationMotionKindIsValid(kind)",
);
const windowPresentation = section(
  desktopCard,
  "id: windowPresentation",
  "id: tabShell",
);
const candidateGeometryConnection = section(
  windowPresentation,
  "function onFrameGeometryChanged()",
  "function onFullScreenChanged()",
);
const tabPresentation = section(
  desktopCard,
  "id: tabShell",
  "id: thumbnailShell",
);
const thumbnailPresentation = section(
  desktopCard,
  "id: thumbnailShell",
  "id: minimizedPlaceholderShell",
);
const placeholderPresentation = section(
  desktopCard,
  "id: minimizedPlaceholderShell",
  "id: windowDropArea",
);
const emptyContentInput = section(
  desktopCard,
  "id: emptyContentInput",
  "id: columnDragEligibilityRefreshTimer",
);
const columnTouchDrag = section(
  desktopCard,
  "id: columnTouchDragHandler",
  "id: columnDragHandler",
);
const columnPointerDrag = section(
  desktopCard,
  "id: columnDragHandler",
  "id: emptyContentInput",
);
const windowTouchDrag = section(
  desktopCard,
  "id: thumbnailTouchDragHandler",
  "id: thumbnailDragHandler",
);
const windowPointerDrag = section(
  desktopCard,
  "id: thumbnailDragHandler",
  "id: minimizedPlaceholderShell",
);
const sceneMotionEligibility = section(
  scene,
  "readonly property bool spatialInternalMotionEligible:",
  "readonly property bool spatialZoomContextEligible:",
);
const scenePresentationState = section(
  scene,
  "readonly property string spatialPresentationPhase:",
  "readonly property bool spatialZoomContextEligible:",
);
const sceneMotionSettlement = section(
  scene,
  "function settleOverviewExitCardMotions(expectedDesktopId, expectedScreen)",
  "function beginWindowSpatialEdgePan(",
);
const sceneExitPreparation = section(
  scene,
  "function prepareOverviewWindowExitHandoff(",
  "function beginSpatialExitHandoff(",
);
const columnDragStart = section(
  desktopCard,
  "function beginColumnSpatialDrag(source, scenePosition)",
  "function moveColumnSpatialDrag(source, scenePosition)",
);
const windowDragStart = section(
  desktopCard,
  "function beginWindowSpatialDrag(source, scenePosition)",
  "function moveWindowSpatialDrag(source, scenePosition)",
);

describe("overview internal presentation motion contracts", () => {
  it("owns one bounded card-level progress animation", () => {
    expect(motionAnimation.match(/\bNumberAnimation\s*\{/gu)).toHaveLength(1);
    expect(motionAnimation).toContain("id: presentationMotionAnimation");
    expect(motionAnimation).toContain("target: card");
    expect(motionAnimation).toContain('property: "presentationMotionProgress"');
    expect(motionAnimation).toContain("easing.type: Easing.OutCubic");
    expect(motionAnimation).toContain(
      "onFinished: card.completePresentationMotion()",
    );
    expect(motionAnimation).not.toMatch(/\bBehavior\s+on\s+/u);
  });

  it("captures immutable stable identities and delegates planning and sampling to the runtime", () => {
    expect(motionSnapshots).toMatch(
      /candidate\.internalId === undefined[\s\S]*String\(candidate\.internalId\) !== windowId/u,
    );
    expect(motionSnapshots).toContain("Object.freeze(memberIds);");
    expect(motionSnapshots).toContain(
      "const snapshot = Object.freeze({ memberIds, selectedWindowId });",
    );
    expect(motionSnapshots).toMatch(
      /const record = Object\.freeze\(\{[\s\S]*windowId[\s\S]*\}\);/u,
    );
    expect(motionSnapshots).toContain(
      "records.sort((left, right) => left.windowId < right.windowId",
    );
    expect(motionSnapshots).toMatch(
      /liveGeometryEnabled && current && tiled[\s\S]*spatialLiveWindowPlanIsExact\(presentation\.spatialLiveFrame,[\s\S]*return tiled\.thumbnailFrame;/u,
    );
    expect(motionSnapshots).toMatch(
      /Object\.freeze\(records\);[\s\S]*Object\.freeze\(recordsByWindowId\);[\s\S]*Object\.freeze\(candidatesByWindowId\);[\s\S]*return Object\.freeze\(\{/u,
    );
    expect(motionSnapshots).toMatch(
      /function presentationMotionNativeThumbnailFrame\([\s\S]*spatialLiveWindowPlanIsExact\([\s\S]*presentationMotionRectSnapshot\(presentation\.frame\)/u,
    );
    expect(motionSnapshots).toMatch(
      /nativeThumbnailFramesByWindowId[\s\S]*visualFramesByWindowId[\s\S]*nativeThumbnailRecords[\s\S]*fingerprint/u,
    );
    expect(motionSnapshots).toMatch(
      /function captureReadyRenderedPresentationMotionSnapshot\([\s\S]*source\.nativeThumbnailFramesByWindowId\[windowId\][\s\S]*presentationMotionProjectedLiveCandidateFrame\(candidate, windowId\)/u,
    );
    expect(motionSnapshots).toMatch(
      /function captureRenderedPresentationMotionSnapshot\([\s\S]*fromVisualFrame[\s\S]*targetVisualFrame[\s\S]*presentationMotionInterpolatedFrame\([\s\S]*visualFramesByWindowId\[record\.windowId\] = renderedFrame/u,
    );
    expect(motionScheduling).toContain(
      "runtime.planOverviewSpatialPresentationMotion({",
    );
    expect(motionScheduling).toContain(
      "current: presentationMotionFromSnapshot.records",
    );
    expect(motionScheduling).toContain("next: confirmed.records");
    expect(motionSnapshots).toContain(
      "runtime.sampleOverviewSpatialPresentationMotion(track, progress)",
    );
    expect(windowPresentation).toContain(
      "onFrameChanged: card.scheduleWindowSpatialDragValidation(windowPresentation)",
    );
    expect(candidateGeometryConnection).toContain(
      "card.navigationTargetsChanged();",
    );
    expect(candidateGeometryConnection).not.toContain(
      "schedulePresentationMotion",
    );
  });

  it("validates candidates on two deferred turns before publishing exact survivor tracks", () => {
    expect(motionScheduling).toMatch(
      /Qt\.callLater\(card\.capturePresentationMotionCandidate, requestId\);/u,
    );
    expect(motionScheduling).toMatch(
      /presentationMotionCandidateSnapshot = candidate;\s*Qt\.callLater\(card\.commitPresentationMotionCandidate, requestId, candidate\);/u,
    );
    expect(motionScheduling).toMatch(
      /presentationMotionCandidateSnapshot !== candidate[\s\S]*const confirmed = capturePresentationMotionSnapshot\(\);[\s\S]*presentationMotionSnapshotsAreExact\(candidate, confirmed\)/u,
    );
    expect(motionSnapshots).toMatch(
      /first\.candidatesByWindowId\[record\.windowId\][\s\S]*!== second\.candidatesByWindowId\[record\.windowId\]/u,
    );
    expect(motionTracks).toMatch(
      /track\.disposition === "survivor"[\s\S]*fromSnapshot\.candidatesByWindowId\[track\.windowId\][\s\S]*!== targetSnapshot\.candidatesByWindowId\[track\.windowId\]/u,
    );
    expect(motionTracks).toMatch(
      /presentationMotionTrackSample\(track, 0\)[\s\S]*presentationMotionTrackSample\(track, 1\)[\s\S]*presentationMotionFramesEqual\(fromSample\.frame, track\.fromFrame\)[\s\S]*presentationMotionFramesEqual\(targetSample\.frame, track\.toFrame\)/u,
    );
    expect(motionTracks).toMatch(
      /Array\.isArray\(plan\.survivors\)[\s\S]*Array\.isArray\(plan\.entries\)[\s\S]*catch \(error\) \{\s*return null;/u,
    );
    expect(motionTracks).toMatch(
      /for \(const targetRecord of targetSnapshot\.records\)[\s\S]*presentationMotionRecordNeedsTrack\(sourceRecord, targetRecord\)[\s\S]*tracks\[targetRecord\.windowId\] !== undefined/u,
    );
    expect(motionTracks).toContain("Object.freeze(tracks);");
  });

  it("renders tab, thumbnail, and placeholder motion from visual frames without property Behaviors", () => {
    for (const presentation of [
      windowPresentation,
      tabPresentation,
      thumbnailPresentation,
      placeholderPresentation,
    ]) {
      expect(presentation).not.toMatch(
        /\bBehavior\s+on\s+(?:x|y|width|height|opacity)\b/u,
      );
    }

    expect(tabPresentation).toContain("card.presentationMotionTabVisualFrame(");
    expect(tabPresentation).toContain("card.presentationMotionTabOpacity(");
    expect(tabPresentation).toMatch(
      /x: visualFrame \? visualFrame\.x : 0[\s\S]*y: visualFrame \? visualFrame\.y : 0[\s\S]*width: visualBaseFrame \? visualBaseFrame\.width : 0[\s\S]*height: visualBaseFrame \? visualBaseFrame\.height : 0[\s\S]*opacity: windowPresentation\.opacity \* visualOpacity/u,
    );
    expect(tabPresentation).toContain("transform: Scale {");

    for (const presentation of [
      thumbnailPresentation,
      placeholderPresentation,
    ]) {
      expect(presentation).toContain("card.presentationMotionVisualFrame(");
      expect(presentation).toContain("card.presentationMotionVisualOpacity(");
      expect(presentation).toMatch(
        /x: visualFrame \? visualFrame\.x : 0[\s\S]*y: visualFrame \? visualFrame\.y : 0[\s\S]*width: visualBaseFrame \?[\s\S]*height: visualBaseFrame \?[\s\S]*visible: visualFrame !== null && visualOpacity > 0\.0001[\s\S]*opacity: visualOpacity[\s\S]*transform: Scale \{/u,
      );
    }
    expect(motionVisuals).toMatch(
      /function presentationMotionVisualValue\([\s\S]*visualStatesByWindowId\[windowId\][\s\S]*presentationMotionProgress[\s\S]*function presentationMotionVisualFrame\([\s\S]*presentationMotionSamplesByWindowId\[windowId\][\s\S]*function presentationMotionVisualOpacity\([\s\S]*presentationMotionVisualValue/u,
    );
  });

  it("interpolates selected-tab and minimized markers through adopted visual state", () => {
    expect(tabPresentation).toContain(
      "card.presentationMotionSelectedProgress(",
    );
    expect(tabPresentation).toContain(
      "opacity: tabShell.selectedVisualProgress",
    );
    expect(tabPresentation).toMatch(
      /readonly property real minimizedVisualProgress: card\.presentationMotionMinimizedProgress\([\s\S]*id: tabMinimizedMarker[\s\S]*opacity: tabShell\.minimizedVisualProgress/u,
    );
    expect(tabPresentation).toContain(
      "anchors.rightMargin: 4 + 12 * tabShell.minimizedVisualProgress",
    );
    expect(tabPresentation).toContain("color: tabShell.labelColor");
    expect(tabPresentation).toContain(": selectionBorderColor");
    expect(tabPresentation).not.toContain("selectedVisualProgress >= 0.5");
    expect(tabPresentation).not.toMatch(
      /(?:color|anchors\.rightMargin): tabShell\.minimizedTab \?/u,
    );
    expect(motionVisuals).toMatch(
      /function presentationMotionSelectedProgress\([\s\S]*presentationMotionVisualValue\(windowId, "selectedProgress"[\s\S]*function presentationMotionMinimizedProgress\([\s\S]*presentationMotionVisualValue\(windowId, "minimizedProgress"/u,
    );
  });

  it("keeps the motion lifecycle free of focus and compositor side effects", () => {
    expect(motionLifecycle).not.toMatch(
      /KWin\.Workspace\.[A-Za-z0-9_]+\s*=|\b(?:focusWindow|windowTapped|deactivate|deactivateImmediately)\s*\(/u,
    );
    expect(motionLifecycle).not.toContain("KWin.Workspace.activeWindow");

    const activeWindowReads = desktopCard.match(
      /KWin\.Workspace\.activeWindow/gu,
    );
    expect(activeWindowReads).toHaveLength(2);
    expect(tabPresentation).toContain(
      "KWin.Workspace.activeWindow === windowPresentation.candidate",
    );
    expect(tabPresentation).toContain("font.bold: tabShell.activeTab");
    expect(thumbnailPresentation).toContain(
      "border.width: KWin.Workspace.activeWindow === model.window ? 2 : 0",
    );
    expect(`${windowPresentation}\n${motionScheduling}`).not.toMatch(
      /onActiveWindowChanged|onWindowActivated|KWin\.Workspace\.activeWindow/u,
    );
  });

  it("admits motion in a settled scene while keeping conflicting direct manipulation idle", () => {
    expect(scenePresentationState).toMatch(
      /readonly property bool spatialPresentationSettled:[\s\S]*spatialPresentationInteractive && spatialPresentationPhase === "open"[\s\S]*spatialPresentationProgress >= 1/u,
    );
    expect(sceneMotionEligibility).toContain(
      "spatialInternalMotionPresentationEligible",
    );
    expect(scenePresentationState).toMatch(
      /readonly property bool spatialInternalMotionPresentationEligible:[\s\S]*spatialPresentationSettled[\s\S]*spatialPresentationPhase === "closing"/u,
    );
    expect(sceneMotionEligibility).toMatch(
      /readonly property bool spatialInternalMotionStartEligible:[\s\S]*spatialInternalMotionEligible && spatialPresentationSettled/u,
    );
    expect(sceneMotionEligibility).toContain("!overviewContextRefreshPending");
    expect(sceneMotionEligibility).toContain("overviewContextModelExact");
    expect(sceneMotionEligibility).toContain("!spatialDirectDragActive");
    expect(sceneMotionEligibility).toContain("spatialZoomOwner.length === 0");
    expect(sceneMotionEligibility).toContain(
      "spatialExternalZoomTransaction === null",
    );
    expect(sceneMotionEligibility).toContain("!spatialExternalZoomActive");
    expect(sceneMotionEligibility).not.toContain(
      "!spatialVerticalCameraAnimation.running",
    );
    expect(sceneMotionEligibility).toContain(
      "spatialHorizontalCameraMotionContext === null",
    );
    expect(scene).toContain(
      "spatialMotionEligible: root.spatialInternalMotionEligible",
    );
    expect(scene).toContain(
      "spatialMotionStartEligible: root.spatialInternalMotionStartEligible",
    );
    expect(scene).not.toMatch(
      /DesktopCard \{[\s\S]{0,400}enabled:[^\n]*[\s\S]{0,160}!internalMotionActive/u,
    );
    expect(emptyContentInput).toContain("&& !card.internalMotionActive");
    for (const dragPresentation of [
      columnTouchDrag,
      columnPointerDrag,
      windowTouchDrag,
      windowPointerDrag,
    ]) {
      expect(dragPresentation).toMatch(
        /PointerDevice\.GrabExclusive[\s\S]*settlePresentationMotion\(\)[\s\S]*store(?:ColumnDrag|SpatialDrag)HotSpot/u,
      );
      expect(dragPresentation).not.toContain("internalMotionActive");
    }
    expect(driftBindings).toMatch(
      /onTabRailPlansChanged:[\s\S]*schedulePresentationMotion\(\)[\s\S]*onSpatialRowGeometryPlanChanged:[\s\S]*schedulePresentationMotion\(\)[\s\S]*onColumnsChanged:[\s\S]*schedulePresentationMotion\(\)/u,
    );
  });

  it("invalidates drift and settles rendered motion before direct drag or exit capture", () => {
    for (const signal of [
      "onCurrentChanged",
      "onDesktopChanged",
      "onDesktopIdChanged",
      "onScreenChanged",
      "onOutputIdChanged",
      "onWidthChanged",
      "onHeightChanged",
      "onOverviewActivityIdChanged",
      "onOverviewContextGenerationChanged",
      "onOverviewSessionIdChanged",
      "onPreviewViewportOffsetChanged",
    ]) {
      const signalSection = section(
        driftBindings,
        `${signal}:`,
        signal === "onPreviewViewportOffsetChanged"
          ? "onSpatialDirectDragBlockedChanged:"
          : "\n    on",
      );
      expect(signalSection).toContain("resetPresentationMotionAfterDrift()");
    }
    expect(driftBindings).toMatch(
      /onSpatialDirectDragBlockedChanged:[\s\S]*if \(spatialDirectDragBlocked\) \{[\s\S]*resetPresentationMotionAfterDrift\(\)/u,
    );
    expect(driftBindings).toMatch(
      /onSpatialMotionEligibleChanged:[\s\S]*if \(!spatialMotionEligible\) \{[\s\S]*resetPresentationMotionAfterDrift\(\)/u,
    );
    expect(driftBindings).toMatch(
      /onCurrentChanged:[\s\S]*presentationMotionStructuralDriftShouldReset\(\)[\s\S]*onLiveGeometryEnabledChanged:[\s\S]*presentationMotionStructuralDriftShouldReset\(\)/u,
    );
    expect(motionLifecycle).toContain(
      "return spatialMotionStartEligible || !spatialMotionEligible;",
    );
    expect(motionVisuals).not.toContain("nativeFrame");
    expect(motionVisuals).toMatch(
      /const cachedSample = presentationMotionSamplesByWindowId\[windowId\];[\s\S]*presentationMotionTrackSample\([\s\S]*presentationMotionInterpolatedFrame\([\s\S]*\|\| fromFrame/u,
    );
    expect(motionVisuals).toMatch(
      /const sample = cachedSample \|\| presentationMotionTrackSample\([\s\S]*if \(sample\) \{\s*return sample\.frame;\s*\}[\s\S]*return presentationMotionInterpolatedFrame/u,
    );
    expect(columnDragStart).toContain("!settlePresentationMotion()");
    expect(windowDragStart).toContain("!settlePresentationMotion()");
    expect(sceneMotionSettlement).toMatch(
      /typeof expectedDesktopId !== "string"[\s\S]*expectedDesktopId\.length === 0[\s\S]*expectedScreen !== targetScreen/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /const targetIndex = desktopIds\.indexOf\(expectedDesktopId\);[\s\S]*targetIndex < 0[\s\S]*targetIndex !== desktopIds\.lastIndexOf\(expectedDesktopId\)/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /const targetCard = desktopCardAt\(targetIndex\);[\s\S]*targetCard\.desktopId !== expectedDesktopId[\s\S]*targetCard\.screen !== expectedScreen/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /for \(let index = 0; index < desktopRepeater\.count; index \+= 1\)[\s\S]*loader\.index === index[\s\S]*loader\.modelData === item\.desktopId[\s\S]*typeof item\.settlePresentationMotion === "function"/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /const phase = item\.presentationMotionPhase;[\s\S]*const motionActive = phase === "validating" \|\| phase === "animating";[\s\S]*phase !== "invalid" && phase !== "ready" && !motionActive[\s\S]*item\.internalMotionActive !== motionActive/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /if \(\(item === targetCard \|\| motionActive\)[\s\S]*item\.settlePresentationMotion\(\) !== true[\s\S]*item\.presentationMotionPhase !== "ready"[\s\S]*return false;/u,
    );
    expect(sceneMotionSettlement).toMatch(
      /const confirmedTargetCard = desktopCardAt\(targetIndex\);[\s\S]*confirmedTargetCard === targetCard[\s\S]*confirmedTargetCard\.desktopId === expectedDesktopId[\s\S]*confirmedTargetCard\.screen === expectedScreen[\s\S]*confirmedTargetCard\.presentationMotionPhase === "ready"/u,
    );
    expect(sceneMotionSettlement).not.toContain("desktopSurfaceResidencyRange");
    expect(
      sceneExitPreparation.match(
        /settleOverviewExitCardMotions\(expectedDesktopId, expectedScreen\)/gu,
      ),
    ).toHaveLength(2);
    expect(sceneExitPreparation).toMatch(
      /function prepareOverviewWindowExitHandoff\([\s\S]*if \(!settleOverviewExitCardMotions\(expectedDesktopId, expectedScreen\)\) \{\s*return 0;[\s\S]*function prepareOverviewDesktopExitHandoff\([\s\S]*if \(!settleOverviewExitCardMotions\(expectedDesktopId, expectedScreen\)\) \{\s*return 0;/u,
    );
  });
});
