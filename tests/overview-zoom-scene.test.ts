import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scene = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewScene.qml",
    import.meta.url,
  ),
  "utf8",
);

function sourceBetween(start: string, end: string): string {
  const startIndex = scene.indexOf(start);
  const endIndex = scene.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return scene.slice(startIndex, endIndex);
}

describe("overview session zoom scene", () => {
  it("owns Ctrl+wheel and preserves physical direction", () => {
    const handler = sourceBetween(
      "id: spatialZoomWheelHandler",
      "id: spatialVerticalWheelHandler",
    );
    const route = sourceBetween(
      "function handleSpatialZoomWheel(event, point)",
      "function finishSpatialZoomWheelGesture()",
    );

    expect(handler).toContain("acceptedModifiers: Qt.KeyboardModifierMask");
    expect(handler).toContain("blocking: false");
    expect(handler).toContain('root.spatialZoomOwner === "wheel"');
    expect(handler).not.toContain("synchronizeSpatialZoomInputState()");
    expect(handler).toMatch(
      /onActiveChanged:[\s\S]*if \(!active\) \{\s*root\.finishSpatialZoomWheelGesture\(\);/u,
    );
    expect(scene).toContain(
      "spatialZoomInputEligible && spatialZoomOwner.length === 0",
    );
    expect(scene).not.toContain(
      "spatialZoomOwner.length === 0\n        && !spatialZoomWheelHandler.active",
    );
    expect(route).toContain(
      'const wheelOwnsGesture = spatialZoomOwner === "wheel";',
    );
    expect(route).toContain(
      "const controlHeld = (event.modifiers & Qt.ControlModifier) === Qt.ControlModifier;",
    );
    expect(route).toMatch(
      /if \(!controlHeld\) \{\s*if \(wheelOwnsGesture\) \{\s*event\.accepted = true;\s*return true;\s*\}\s*return false;/u,
    );
    expect(route).toMatch(
      /if \(mode\.length === 0 \|\| !Number\.isSafeInteger\(angleDelta\)\) \{\s*if \(wheelOwnsGesture\) \{\s*event\.accepted = true;\s*return true;/u,
    );
    expect(route).toContain(
      "runtime.normalizeOverviewPhysicalWheelAngleDelta(",
    );
    expect(route).toContain(
      "runtime.normalizeOverviewPhysicalWheelPixelDelta(",
    );
    expect(route).toContain('direction: combined < 0 ? "in" : "out"');
    expect(route).toContain(
      "Math.sign(spatialZoomWheelRemainder) !== Math.sign(angleDelta)",
    );
    expect(route).toContain("Math.min(4,");
    expect(route).toContain("Math.abs(combined) % 120");
    expect(route).toContain("Math.exp(-spatialZoomWheelPixelTotal / 1200)");
    expect(route).toContain("transaction.previewZoom / transaction.originZoom");
  });

  it("routes keyboard steps and reset before generic modifier rejection", () => {
    const keys = sourceBetween(
      "Keys.onPressed: event =>",
      "Component.onCompleted:",
    );
    const zoomIn = keys.indexOf('root.handleSpatialZoomKeyboard("in")');
    const modifierRejection = keys.indexOf(
      "(modifiers & forbiddenModifiers) !== Qt.NoModifier",
    );

    expect(zoomIn).toBeGreaterThanOrEqual(0);
    expect(zoomIn).toBeLessThan(modifierRejection);
    expect(keys).toContain('root.handleSpatialZoomKeyboard("out")');
    expect(keys).toContain('root.handleSpatialZoomKeyboard("reset")');
    expect(keys).toContain("Qt.Key_Plus");
    expect(keys).toContain("Qt.Key_Equal");
    expect(keys).toContain("Qt.Key_Minus");
    expect(keys).toContain("Qt.Key_0");
  });

  it("keeps scene zoom transactional and exact-session guarded", () => {
    const transaction = sourceBetween(
      "function beginSpatialZoomTransaction(owner, anchorSceneY)",
      "function handleDesktopTopologyChanged()",
    );

    expect(scene).toContain("readonly property real configuredOverviewZoom:");
    expect(scene).toContain("readonly property real overviewZoom: sceneEffect");
    expect(transaction).toContain("runtime.planOverviewSpatialZoomBegin({");
    expect(transaction).toContain("runtime.planOverviewSpatialZoomPreview({");
    expect(transaction).toContain(
      "runtime.planOverviewSpatialZoomFinish({ disposition, transaction })",
    );
    expect(transaction).toContain(
      "effect.activeSessionId === spatialZoomSessionId",
    );
    expect(transaction).toContain("effect.overviewModel === spatialZoomModel");
    expect(transaction).toContain(
      "sameStringList(desktopIds, spatialZoomDesktopIds)",
    );
    expect(transaction).toContain(
      "Math.abs(spatialContentY - transaction.previewContentY) <= 0.000001",
    );
    expect(transaction).toContain(
      "spatialZoomSceneToken, transaction.originZoom)",
    );
    expect(transaction).toContain(
      "spatialZoomSessionId, spatialZoomOutputId, spatialZoomSceneToken, plan.zoom)",
    );
    expect(transaction).toContain(
      "if (!refreshSpatialHorizontalViewports(true))",
    );
    expect(transaction).toContain(
      "restoreSpatialZoomHorizontalOffsets(previousHorizontalOffsets)",
    );
    const finish = sourceBetween(
      "function finishSpatialZoomTransaction(disposition)",
      "function clearSpatialZoomTransactionState()",
    );
    expect(finish).toContain(
      'const needsOriginFallback = !exactContext || !plan\n            || (disposition === "cancel" && !finished);',
    );
    expect(
      finish.indexOf('if (disposition === "cancel" && !finished)'),
    ).toBeLessThan(finish.indexOf("clearSpatialZoomTransactionState();"));
    expect(transaction).toContain("captureSpatialZoomHorizontalOffsets()");
    expect(transaction).toContain(
      "restoreSpatialZoomHorizontalOffsets(spatialZoomHorizontalOffsets)",
    );
    expect(transaction).toContain(
      "function applyControllerSpatialZoomRollback()",
    );
    expect(scene).toMatch(
      /Component\.onDestruction:[\s\S]*root\.unregisterPresentationReadiness\(true\);[\s\S]*root\.destroySpatialZoomScene\(\);/u,
    );
    expect(scene).toContain("function discardSpatialZoomTransaction()");
    expect(scene).toMatch(
      /function discardSpatialZoomTransaction\(\)[\s\S]*clearSpatialZoomInputState\(\);\s*clearSpatialZoomTransactionState\(\);/u,
    );
    expect(scene).toContain(
      "function cancelSpatialZoomTransaction(repairAfterDiscard = true)",
    );
    expect(scene).toContain(
      "if (!finished && spatialZoomTransaction !== null)",
    );
    expect(scene).toContain(
      "onOverviewZoomInputStateRevisionChanged: root.synchronizeSpatialZoomInputState()",
    );
    expect(scene).toContain("if (spatialZoomRegistrationSuppressed)");
    expect(scene).toContain("spatialZoomRegistrationSuppressed = true;");
  });

  it("preserves an exact local preview through delayed layout notification", () => {
    const layoutChanged = sourceBetween(
      "onOverviewSpatialLayoutChanged: {",
      "onOverviewZoomGestureDirectionChanged:",
    );
    const applyPlan = sourceBetween(
      "function applySpatialZoomPlan(plan)",
      "function previewSpatialZoomTransaction(scale)",
    );
    const preview = sourceBetween(
      "function previewSpatialZoomTransaction(scale)",
      "function applyControllerSpatialZoomRollback()",
    );

    expect(layoutChanged).toMatch(
      /else if \(spatialZoomTransaction !== null && !spatialZoomApplying\) \{\s*if \(!root\.spatialZoomContextIsExact\(\)\) \{\s*if \(!root\.applyControllerSpatialZoomRollback\(\)\) \{\s*root\.cancelSpatialZoomTransaction\(\);\s*root\.refreshOverviewSpatialSession\(true\);\s*\}\s*\}/u,
    );
    const transactionAssignment = applyPlan.indexOf(
      "spatialZoomTransaction = plan.transaction;",
    );
    expect(transactionAssignment).toBeGreaterThan(
      applyPlan.indexOf("spatialZoomApplying = true;"),
    );
    expect(transactionAssignment).toBeLessThan(
      applyPlan.lastIndexOf("spatialZoomApplying = false;"),
    );
    expect(preview).not.toContain("spatialZoomTransaction = plan.transaction;");
  });

  it("defers synchronous preview invalidation until zoom apply settles", () => {
    const eligibilityChanged = sourceBetween(
      "onSpatialZoomInputEligibleChanged: {",
      "onSpatialZoomSceneRegistrationEligibleChanged:",
    );
    const layoutChanged = sourceBetween(
      "onOverviewSpatialLayoutChanged: {",
      "onOverviewZoomGestureDirectionChanged:",
    );
    const applyPlan = sourceBetween(
      "function applySpatialZoomPlan(plan)",
      "function previewSpatialZoomTransaction(scale)",
    );

    const normalizedEligibilityChanged = eligibilityChanged.replace(
      /\s+/gu,
      " ",
    );
    expect
      .soft(normalizedEligibilityChanged)
      .toContain(
        "if (!spatialZoomInputEligible && !spatialZoomApplying) { root.cancelSpatialZoomTransaction(); }",
      );
    expect(layoutChanged).toContain(
      "spatialZoomTransaction !== null && !spatialZoomApplying",
    );
    const applySettled = applyPlan.lastIndexOf("spatialZoomApplying = false;");
    const postApply = applyPlan.slice(applySettled);
    const previewPlanGuard = postApply.indexOf("plan.transaction");
    const eligibilityGuard = postApply.indexOf("!spatialZoomInputEligible");
    const exactContextGuard = postApply.indexOf("!spatialZoomContextIsExact()");
    const cancellation = postApply.indexOf(
      "root.cancelSpatialZoomTransaction();",
    );
    const rejection = postApply.indexOf("applied = false;");

    expect
      .soft({
        cancelsAfterGuards:
          cancellation > Math.max(eligibilityGuard, exactContextGuard),
        checksEligibilityAfterApply: eligibilityGuard > previewPlanGuard,
        checksExactContextAfterApply: exactContextGuard > previewPlanGuard,
        rejectsInvalidPreview: rejection > cancellation,
        settlesApplying: applySettled >= 0,
        validatesPreviewPlans: previewPlanGuard >= 0,
      })
      .toEqual({
        cancelsAfterGuards: true,
        checksEligibilityAfterApply: true,
        checksExactContextAfterApply: true,
        rejectsInvalidPreview: true,
        settlesApplying: true,
        validatesPreviewPlans: true,
      });
  });

  it("arbitrates scene ownership and exposes passive touch feedback", () => {
    expect(scene).toContain("readonly property bool spatialZoomInputEligible:");
    expect(scene).toContain(
      "readonly property bool spatialTouchscreenZoomGestureEligible:",
    );
    for (const blockedState of [
      "desktopTopologyRefreshPending",
      "keyboardHelpVisible",
      "desktopReorderActive",
      "spatialWindowDragSource === null",
      "spatialTouchPanDragHandler.active",
      "spatialViewportDragHandler.active",
      "spatialHorizontalViewportDragHandler.active",
      "spatialHorizontalRowDragHandler.active",
    ]) {
      expect(scene).toContain(blockedState);
    }
    expect(scene).toContain("&& !spatialExternalZoomActive");
    expect(scene).toContain("|| spatialExternalZoomActive)");
    expect(scene).toContain("OverviewTouchscreenZoomGesture {");
    expect(scene).toContain(
      "gestureEnabled: root.spatialTouchscreenZoomGestureEligible",
    );
    expect(scene).toContain("OverviewZoomHud {");
    expect(scene).toContain(
      "spatialZoomOwner.length > 0 || spatialExternalZoomActive",
    );
    expect(scene).toContain("function beginExternalSpatialZoom(direction)");
    expect(scene).toContain("scale: overviewZoom / transaction.originZoom");
    expect(scene).toContain("effect.applyOverviewZoomInputState(");
    expect(scene).toContain("effect.clearOverviewZoomInputState(");
    expect(scene).toContain(
      "PointerHandler.ApprovesTakeOverByHandlersOfDifferentType",
    );
    for (const helpEntry of [
      'keys: "Ctrl+wheel"',
      'keys: "Ctrl++ / Ctrl+-"',
      'keys: "Ctrl+0"',
      'keys: "Pinch"',
    ]) {
      expect(scene).toContain(helpEntry);
    }
  });

  it("preserves horizontal row offsets by desktop identity", () => {
    const refresh = sourceBetween(
      "function refreshSpatialHorizontalViewports(preserveViewport)",
      "function planSpatialHorizontalGeometry(",
    );

    expect(refresh).toContain(
      "const previousOffsetsByDesktopId = Object.create(null);",
    );
    expect(refresh).toContain(
      "previousOffsetsByDesktopId[previousDesktopId] = previousOffset;",
    );
    expect(refresh).toContain(
      "const preservedOffset = preserve ? previousOffsetsByDesktopId[desktopId] : undefined;",
    );
    expect(refresh).toContain(
      "Math.min(bounds.maximum, Math.max(bounds.minimum, previous))",
    );
    expect(refresh).not.toContain(
      "sameStringList(previousDesktopIds, currentDesktopIds)",
    );
  });
});
