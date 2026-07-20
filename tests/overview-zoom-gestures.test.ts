import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectUiRoot = new URL(
  "../packaging/kwin-effect/contents/runtime/ui/",
  import.meta.url,
);
const touchpadZoomGesture = readFileSync(
  new URL("OverviewTouchpadZoomGesture.qml", effectUiRoot),
  "utf8",
);
const touchscreenZoomGesture = readFileSync(
  new URL("OverviewTouchscreenZoomGesture.qml", effectUiRoot),
  "utf8",
);
const zoomHud = readFileSync(
  new URL("OverviewZoomHud.qml", effectUiRoot),
  "utf8",
);

describe("overview zoom gesture components", () => {
  it("maps one public touchpad pinch pair to signed transactional signals", () => {
    expect(
      touchpadZoomGesture.match(/KWin\.PinchGestureHandler \{/gu),
    ).toHaveLength(2);
    expect(touchpadZoomGesture).toContain("required property int fingerCount");
    expect(touchpadZoomGesture).toContain(
      "direction: KWin.PinchGestureHandler.Direction.Expanding",
    );
    expect(touchpadZoomGesture).toContain(
      "direction: KWin.PinchGestureHandler.Direction.Contracting",
    );
    expect(
      touchpadZoomGesture.match(/fingerCount: root\.fingerCount/gu),
    ).toHaveLength(2);
    expect(touchpadZoomGesture).toContain(
      'onProgressChanged: root.updateGesture("in", progress)',
    );
    expect(touchpadZoomGesture).toContain(
      'onProgressChanged: root.updateGesture("out", progress)',
    );
    expect(touchpadZoomGesture).toContain(
      'onCancelled: root.cancelGesture("in")',
    );
    expect(touchpadZoomGesture).toContain(
      'onCancelled: root.cancelGesture("out")',
    );
    expect(touchpadZoomGesture).toContain(
      'onActivated: root.commitGesture("in")',
    );
    expect(touchpadZoomGesture).toContain(
      'onActivated: root.commitGesture("out")',
    );
    for (const signal of [
      "zoomStarted(string direction, real progress)",
      "zoomProgressed(string direction, real progress)",
      "zoomCancelled(string direction)",
      "zoomCommitted(string direction)",
      "zoomInvalidated(string direction)",
    ]) {
      expect(touchpadZoomGesture).toContain(`signal ${signal}`);
    }
    expect(touchpadZoomGesture).toMatch(
      /Math\.max\(0, Math\.min\(1, numeric\)\)/u,
    );
    expect(touchpadZoomGesture).toMatch(
      /function invalidateGesture\(\)[\s\S]*root\.blockedGestureOwner = direction;[\s\S]*root\.zoomInvalidated\(direction\);/u,
    );
    expect(touchpadZoomGesture).not.toMatch(
      /\bdeviceType\s*:|org\.kde\.kwin\.private|ShortcutHandler|DBusCall|Timer/u,
    );
  });

  it("owns exactly two touchscreen points without transforming scene items", () => {
    expect(touchscreenZoomGesture.match(/\bPinchHandler \{/gu)).toHaveLength(1);
    expect(touchscreenZoomGesture).toContain(
      "required property bool gestureEnabled",
    );
    for (const signal of [
      "zoomStarted(real scale, real sceneX, real sceneY)",
      "zoomProgressed(real scale)",
      "zoomCommitted(real scale)",
      "zoomCancelled()",
    ]) {
      expect(touchscreenZoomGesture).toContain(`signal ${signal}`);
    }
    expect(touchscreenZoomGesture).toContain("target: null");
    expect(touchscreenZoomGesture).toContain(
      "acceptedDevices: PointerDevice.TouchScreen",
    );
    expect(touchscreenZoomGesture).toContain(
      "acceptedModifiers: Qt.NoModifier",
    );
    expect(touchscreenZoomGesture).toContain("minimumPointCount: 2");
    expect(touchscreenZoomGesture).toContain("maximumPointCount: 2");
    expect(touchscreenZoomGesture).toContain("scaleAxis.enabled: true");
    expect(touchscreenZoomGesture).toContain("rotationAxis.enabled: false");
    expect(touchscreenZoomGesture).toContain("xAxis.enabled: false");
    expect(touchscreenZoomGesture).toContain("yAxis.enabled: false");
    expect(touchscreenZoomGesture).toContain(
      "PointerHandler.CanTakeOverFromHandlersOfDifferentType",
    );
    expect(touchscreenZoomGesture).toContain(
      "PointerHandler.CanTakeOverFromItems",
    );
    expect(touchscreenZoomGesture).toContain(
      "PointerHandler.ApprovesTakeOverByAnything",
    );
    expect(touchscreenZoomGesture).toContain(
      "root.beginZoom(activeScale, centroid.position)",
    );
    expect(touchscreenZoomGesture).toContain("root.progressZoom(activeScale)");
    expect(touchscreenZoomGesture).toMatch(
      /PointerDevice\.CancelGrabExclusive[\s\S]*PointerDevice\.CancelGrabPassive[\s\S]*root\.cancelZoom\(\)/u,
    );
    expect(touchscreenZoomGesture).toMatch(
      /PointerDevice\.UngrabExclusive[\s\S]*point\.state === EventPoint\.Released[\s\S]*root\.commitZoom\(\)[\s\S]*root\.cancelZoom\(\)/u,
    );
    expect(touchscreenZoomGesture).toContain(
      "Qt.callLater(root.cancelInactiveZoom)",
    );
    expect(touchscreenZoomGesture).not.toMatch(
      /org\.kde\.kwin|KWin\.|MouseArea|WheelHandler|DragHandler|Timer|Animation|Behavior/u,
    );
  });

  it("renders a passive finite zoom percentage without owning input", () => {
    expect(zoomHud).toContain("required property bool shown");
    expect(zoomHud).toContain("required property real zoom");
    expect(zoomHud).toContain(
      "readonly property string zoomLabel: `${Math.round(zoom * 100)}%`",
    );
    expect(zoomHud).toContain(
      "visible: shown && Number.isFinite(zoom) && zoom > 0",
    );
    expect(zoomHud).toContain("enabled: false");
    expect(zoomHud).toContain("text: root.zoomLabel");
    expect(zoomHud).toContain("textFormat: Text.PlainText");
    expect(zoomHud).not.toMatch(
      /org\.kde\.kwin|KWin\.|MouseArea|(?:Tap|Drag|Pinch|Wheel)Handler|Timer|Animation|Behavior|focus\s*:/u,
    );
  });

  it("uses only public QML surfaces", () => {
    for (const source of [
      touchpadZoomGesture,
      touchscreenZoomGesture,
      zoomHud,
    ]) {
      expect(source).not.toContain("org.kde.kwin.private");
      expect(source).not.toMatch(/\.setValue\s*\(|callDBus|DBusCall/u);
    }
  });
});
