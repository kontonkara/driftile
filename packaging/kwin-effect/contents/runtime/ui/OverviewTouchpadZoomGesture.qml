import QtQuick
import org.kde.kwin as KWin

QtObject {
    id: root

    required property int fingerCount
    property string activeGestureOwner: ""
    property string blockedGestureOwner: ""

    signal zoomStarted(string direction, real progress)
    signal zoomProgressed(string direction, real progress)
    signal zoomCancelled(string direction)
    signal zoomCommitted(string direction)
    signal zoomInvalidated(string direction)

    function boundedProgress(progress) {
        const numeric = Number(progress);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        return Math.max(0, Math.min(1, numeric));
    }

    function updateGesture(direction, progress) {
        if (direction !== "in" && direction !== "out") {
            return false;
        }

        const bounded = root.boundedProgress(progress);
        if (root.activeGestureOwner === direction) {
            root.zoomProgressed(direction, bounded);
            return true;
        }
        if (bounded <= 0 || root.activeGestureOwner !== ""
                || root.blockedGestureOwner !== "") {
            return false;
        }

        root.activeGestureOwner = direction;
        root.zoomStarted(direction, bounded);
        return true;
    }

    function resetGesture() {
        root.activeGestureOwner = "";
        root.blockedGestureOwner = "";
    }

    function cancelGesture(direction) {
        if (direction === root.blockedGestureOwner) {
            root.resetGesture();
            return true;
        }
        if (direction !== root.activeGestureOwner || direction === "") {
            return false;
        }

        root.resetGesture();
        root.zoomCancelled(direction);
        return true;
    }

    function commitGesture(direction) {
        if (direction === root.blockedGestureOwner) {
            root.resetGesture();
            return true;
        }
        if (direction !== root.activeGestureOwner || direction === "") {
            return false;
        }

        root.resetGesture();
        root.zoomCommitted(direction);
        return true;
    }

    function invalidateGesture() {
        if (root.activeGestureOwner === "") {
            return false;
        }

        const direction = root.activeGestureOwner;
        root.activeGestureOwner = "";
        root.blockedGestureOwner = direction;
        root.zoomInvalidated(direction);
        return true;
    }

    readonly property KWin.PinchGestureHandler expandingPinch: KWin.PinchGestureHandler {
        direction: KWin.PinchGestureHandler.Direction.Expanding
        fingerCount: root.fingerCount
        onProgressChanged: root.updateGesture("in", progress)
        onCancelled: root.cancelGesture("in")
        onActivated: root.commitGesture("in")
    }

    readonly property KWin.PinchGestureHandler contractingPinch: KWin.PinchGestureHandler {
        direction: KWin.PinchGestureHandler.Direction.Contracting
        fingerCount: root.fingerCount
        onProgressChanged: root.updateGesture("out", progress)
        onCancelled: root.cancelGesture("out")
        onActivated: root.commitGesture("out")
    }
}
