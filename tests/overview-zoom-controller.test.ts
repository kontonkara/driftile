import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const entrypoint = readFileSync(
  new URL("contents/ui/main.qml", effectRoot),
  "utf8",
);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);

describe("overview session zoom controller", () => {
  it("separates configured zoom from the shared session value", () => {
    expect(entrypoint).toContain(
      "readonly property real configuredOverviewZoom: overviewZoomFromConfig()",
    );
    expect(entrypoint).toMatch(
      /readonly property real overviewZoom: controller[\s\S]*controller\.overviewSessionZoom[\s\S]*: configuredOverviewZoom/u,
    );
    expect(entrypoint).toContain(
      "readonly property int overviewZoomRevision: controller",
    );
    expect(entrypoint).toContain(
      "readonly property int overviewZoomInputStateRevision: controller",
    );
    expect(entrypoint).toContain(
      "readonly property int overviewZoomGestureSessionId: controller",
    );
    expect(entrypoint).toContain(
      "readonly property string overviewZoomGestureDirection: controller",
    );
    expect(entrypoint).toMatch(
      /function syncOverviewZoomSetting\(\)[\s\S]*controller\.applyOverviewZoomSetting\(configuredOverviewZoom\);/u,
    );
    expect(controller).toContain("property real configuredOverviewZoom: 0.5");
    expect(controller).toContain("property real overviewSessionZoom: 0.5");
    expect(controller).toContain("property int overviewZoomRevision: 0");
    expect(controller).toContain(
      "property int overviewZoomInputStateRevision: 0",
    );
  });

  it("resets only a fresh activation and preserves a closing session", () => {
    const activation = controller.slice(
      controller.indexOf("function activate()"),
      controller.indexOf("function deactivate()"),
    );
    const activeBranch = activation.slice(
      activation.indexOf("if (active)"),
      activation.indexOf("if (loading || plasmaOverviewIsActive())"),
    );

    expect(activeBranch).toContain('presentationPhase === "closing"');
    expect(activeBranch).toContain(
      'startPresentationTransition("opening", 1, activeSessionId)',
    );
    expect(activeBranch).not.toContain("prepareOverviewZoomForFreshActivation");
    expect(
      activation.indexOf("prepareOverviewZoomForFreshActivation();"),
    ).toBeGreaterThan(
      activation.indexOf("if (loading || plasmaOverviewIsActive())"),
    );
    expect(
      activation.indexOf("prepareOverviewZoomForFreshActivation();"),
    ).toBeLessThan(activation.indexOf("layoutStateReader.sample(attemptId);"));
    expect(controller).toMatch(
      /function prepareOverviewZoomForFreshActivation\(\) \{[\s\S]*invalidateOverviewZoomInputStates\(\);[\s\S]*assignOverviewSessionZoom\(configuredOverviewZoom\);/u,
    );
  });

  it("arbitrates exact scene identities before loading one global pinch owner", () => {
    expect(
      controller.match(/Loader overviewTouchpadZoomGestureLoader/gu),
    ).toHaveLength(1);
    expect(controller).toContain(
      'loader.setSource("OverviewTouchpadZoomGesture.qml", {',
    );
    expect(controller).toContain("fingerCount: touchpadGestureFingerCount");
    expect(controller).toMatch(
      /function applyOverviewZoomInputState\(sessionId, outputId, sceneToken, eligible\)[\s\S]*state\.sceneToken !== sceneToken[\s\S]*return false;/u,
    );
    expect(controller).toMatch(
      /function clearOverviewZoomInputState\(sessionId, outputId, sceneToken\)[\s\S]*state\.sceneToken !== sceneToken[\s\S]*return false;/u,
    );
    expect(controller).toMatch(
      /function overviewZoomInputStatesAreEligible\(\)[\s\S]*states\.length !== outputIds\.length[\s\S]*matchingState\.eligible !== true/u,
    );
    expect(controller).toContain("function onZoomStarted(direction, progress)");
    expect(controller).toContain(
      "function onZoomProgressed(direction, progress)",
    );
    expect(controller).toContain("function onZoomCancelled(direction)");
    expect(controller).toContain("function onZoomCommitted(direction)");
    expect(controller).toContain("function onZoomInvalidated(direction)");
  });

  it("guards local mutations by exact scene ownership", () => {
    expect(entrypoint).toContain(
      "function setOverviewSessionZoom(sessionId, outputId, sceneToken, zoom)",
    );
    expect(entrypoint).toContain(
      "controller.setOverviewSessionZoom(sessionId, outputId, sceneToken, zoom)",
    );
    expect(controller).toMatch(
      /function setOverviewSessionZoom\(sessionId, outputId, sceneToken, value\)[\s\S]*overviewZoomSceneOwnsMutation\(sessionId, outputId, sceneToken\)[\s\S]*assignOverviewSessionZoom\(zoom\);[\s\S]*return true;/u,
    );
    expect(controller).toMatch(
      /function overviewZoomSceneOwnsMutation\(sessionId, outputId, sceneToken\)[\s\S]*matchingState\.sceneToken !== sceneToken[\s\S]*matchingState\.eligible !== false[\s\S]*matchingState\.eligible !== true/u,
    );
    expect(controller).toMatch(
      /function applyOverviewZoomInputState\(sessionId, outputId, sceneToken, eligible\)[\s\S]*model: overviewModel/u,
    );
    expect(controller).toMatch(
      /function overviewZoomSceneOwnsMutation\(sessionId, outputId, sceneToken\)[\s\S]*matchingState\.model !== overviewModel/u,
    );
    expect(controller).toMatch(
      /function overviewZoomSessionContextIsExact\(sessionId\)[\s\S]*activeSessionId === sessionId[\s\S]*presentationPhase === "open"[\s\S]*presentationProgress - 1/u,
    );
    expect(controller).toMatch(
      /function setOverviewSessionZoom\(sessionId, outputId, sceneToken, value\)[\s\S]*captureOverviewZoomLocalOwner\(sessionId, outputId, sceneToken\)/u,
    );
    expect(controller).toMatch(
      /function captureOverviewZoomLocalOwner\(sessionId, outputId, sceneToken\)[\s\S]*overviewZoomLocalOwnerInitialZoom = overviewSessionZoom;/u,
    );
    expect(controller).toMatch(
      /function applyOverviewZoomInputState\(sessionId, outputId, sceneToken, eligible\)[\s\S]*eligible && overviewZoomLocalOwnerIsExact[\s\S]*clearOverviewZoomLocalOwner\(\);/u,
    );
    expect(controller).toMatch(
      /function clearOverviewZoomInputState\(sessionId, outputId, sceneToken\)[\s\S]*overviewZoomLocalOwnerIsExact[\s\S]*rollbackActiveOverviewLocalZoom\(\);/u,
    );
  });

  it("rolls cancelled global previews back in the exact session", () => {
    expect(controller).toMatch(
      /function overviewZoomGlobalGestureCanBegin\(sessionId\)[\s\S]*overviewZoomInputStatesAreEligible\(\)/u,
    );
    expect(controller).toMatch(
      /function beginOverviewZoomGesture\(sessionId, direction, progress\)[\s\S]*overviewZoomGestureInitialZoom = overviewSessionZoom[\s\S]*applyOverviewZoomGesturePreview/u,
    );
    expect(controller).toMatch(
      /function commitOverviewZoomGesture\(sessionId, direction\)[\s\S]*overviewZoomGestureContextIsExact[\s\S]*clearOverviewZoomGestureState\(\);[\s\S]*return true;/u,
    );
    expect(controller).toMatch(
      /function cancelActiveOverviewZoomGesture\(\)[\s\S]*const initialZoom = overviewZoomGestureInitialZoom;[\s\S]*clearOverviewZoomGestureState\(\);[\s\S]*sessionId === activeSessionId[\s\S]*assignOverviewSessionZoom\(initialZoom\);/u,
    );
    expect(controller).toMatch(
      /function deactivate\(\)[\s\S]*invalidateOverviewZoomInputStates\(\);[\s\S]*startPresentationTransition\("closing", 0, activeSessionId\);/u,
    );
    expect(controller).toMatch(
      /function invalidateOverviewZoomInputStates\(\)[\s\S]*rollbackActiveOverviewLocalZoom\(\);[\s\S]*cancelActiveOverviewZoomGesture\(\);/u,
    );
  });

  it("defers model replacement until all zoom owners settle", () => {
    const desktopsChanged = controller.slice(
      controller.indexOf("function onDesktopsChanged()"),
      controller.indexOf("function onCurrentDesktopChanged()"),
    );
    expect(desktopsChanged).toContain(
      "controller.invalidateOverviewZoomGestureContext();",
    );
    expect(desktopsChanged).toContain("controller.requestLiveModelRefresh();");
    expect(desktopsChanged).not.toContain("invalidateOverviewZoomInputStates");
    expect(controller).toMatch(
      /function overviewZoomModelReplacementIsBlocked\(\)[\s\S]*overviewZoomGestureDirection !== ""[\s\S]*overviewZoomLocalOwnerSessionId > 0[\s\S]*state\.eligible === false/u,
    );
    expect(controller).toMatch(
      /function acceptLiveModelRefresh\(attemptId, document\)[\s\S]*overviewZoomModelReplacementIsBlocked\(\)[\s\S]*deferOverviewZoomLiveRefresh\(\);[\s\S]*overviewModel = result\.value;/u,
    );
    expect(controller).toMatch(
      /function scheduleDeferredOverviewZoomLiveRefresh\(\)[\s\S]*Qt\.callLater[\s\S]*controller\.requestLiveModelRefresh\(\);/u,
    );
  });

  it("keeps exact preview precision within the configured range", () => {
    const normalizer = controller.slice(
      controller.indexOf("function normalizedOverviewZoom(value)"),
      controller.indexOf("function assignOverviewSessionZoom(value)"),
    );
    expect(normalizer).toContain("Number.isFinite(value)");
    expect(normalizer).toContain("value < overviewZoomMinimum");
    expect(normalizer).toContain("value > overviewZoomMaximum");
    expect(normalizer).toContain("Object.is(value, -0) ? 0 : value");
    expect(normalizer).not.toContain("Math.round");
  });
});
