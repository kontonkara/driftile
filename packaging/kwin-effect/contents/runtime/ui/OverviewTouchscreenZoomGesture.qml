import QtQuick

Item {
    id: root

    required property bool gestureEnabled
    property real lastScale: 1
    property bool zoomOwned: false

    signal zoomStarted(real scale, real sceneX, real sceneY)
    signal zoomProgressed(real scale)
    signal zoomCommitted(real scale)
    signal zoomCancelled()

    enabled: gestureEnabled

    onGestureEnabledChanged: {
        if (!gestureEnabled) {
            root.cancelZoom();
        }
    }

    function validScale(scale) {
        const numeric = Number(scale);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    }

    function beginZoom(scale, localPosition) {
        if (root.zoomOwned) {
            return false;
        }

        const position = localPosition && Number.isFinite(localPosition.x)
            && Number.isFinite(localPosition.y) ? localPosition : Qt.point(0, 0);
        root.lastScale = root.validScale(scale);
        root.zoomOwned = true;
        root.zoomStarted(root.lastScale, position.x, position.y);
        return true;
    }

    function progressZoom(scale) {
        if (!root.zoomOwned) {
            return false;
        }

        root.lastScale = root.validScale(scale);
        root.zoomProgressed(root.lastScale);
        return true;
    }

    function commitZoom() {
        if (!root.zoomOwned) {
            return false;
        }

        const committedScale = root.lastScale;
        root.zoomOwned = false;
        root.lastScale = 1;
        root.zoomCommitted(committedScale);
        return true;
    }

    function cancelZoom() {
        if (!root.zoomOwned) {
            return false;
        }

        root.zoomOwned = false;
        root.lastScale = 1;
        root.zoomCancelled();
        return true;
    }

    function cancelInactiveZoom() {
        if (!touchscreenPinch.active) {
            root.cancelZoom();
        }
    }

    PinchHandler {
        id: touchscreenPinch

        target: null
        enabled: root.gestureEnabled
        acceptedDevices: PointerDevice.TouchScreen
        acceptedModifiers: Qt.NoModifier
        minimumPointCount: 2
        maximumPointCount: 2
        scaleAxis.enabled: true
        rotationAxis.enabled: false
        xAxis.enabled: false
        yAxis.enabled: false
        grabPermissions: PointerHandler.CanTakeOverFromHandlersOfDifferentType
                         | PointerHandler.CanTakeOverFromItems
                         | PointerHandler.ApprovesTakeOverByAnything

        onActiveChanged: {
            if (active) {
                root.beginZoom(activeScale, centroid.position);
            } else if (root.zoomOwned) {
                Qt.callLater(root.cancelInactiveZoom);
            }
        }
        onScaleChanged: {
            if (active) {
                root.progressZoom(activeScale);
            }
        }
        onCanceled: root.cancelZoom()
        onGrabChanged: (transition, point) => {
            if (!root.zoomOwned) {
                return;
            }
            if (transition === PointerDevice.CancelGrabExclusive
                    || transition === PointerDevice.CancelGrabPassive) {
                root.cancelZoom();
            } else if (transition === PointerDevice.UngrabExclusive) {
                if (point && point.state === EventPoint.Released) {
                    root.commitZoom();
                } else {
                    root.cancelZoom();
                }
            }
        }
    }
}
