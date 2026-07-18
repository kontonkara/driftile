import QtQuick
import org.kde.kwin

QtObject {
    id: root

    required property int fingerCount
    required property bool naturalScroll
    property string activeGestureOwner: ""
    property string gestureContextKey: ""
    property bool gestureContextInvalidated: false

    signal focusLeftRequested()
    signal focusRightRequested()

    function valueKey(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function outputKey(output) {
        if (!output) {
            return "";
        }

        const geometry = output.geometry;
        return [root.valueKey(output.name),
                geometry.x,
                geometry.y,
                geometry.width,
                geometry.height].join(":");
    }

    function topologyKey() {
        const keys = [];
        const screens = Workspace.screens;
        for (let index = 0; index < screens.length; index += 1) {
            keys.push(root.outputKey(screens[index]));
        }
        keys.sort();
        return keys.join(",");
    }

    function currentContextKey() {
        const desktop = Workspace.currentDesktop;
        const window = Workspace.activeWindow;
        return [root.valueKey(Workspace.currentActivity),
                desktop ? root.valueKey(desktop.id) : "",
                window ? root.valueKey(window.internalId) : "",
                window ? root.outputKey(window.output) : root.outputKey(Workspace.activeScreen),
                root.topologyKey()].join("|");
    }

    function beginGesture(owner, progress) {
        if (!(progress > 0)) {
            return;
        }

        if (root.activeGestureOwner !== "") {
            return;
        }

        const contextKey = root.currentContextKey();
        root.activeGestureOwner = owner;
        root.gestureContextKey = contextKey;
        root.gestureContextInvalidated = false;
    }

    function invalidateGesture() {
        if (root.activeGestureOwner !== "") {
            root.gestureContextInvalidated = true;
        }
    }

    function resetGesture() {
        root.activeGestureOwner = "";
        root.gestureContextKey = "";
        root.gestureContextInvalidated = false;
    }

    function cancelGesture(owner) {
        if (owner === root.activeGestureOwner) {
            root.resetGesture();
        }
    }

    function completeGesture(owner) {
        const accepted = owner === root.activeGestureOwner
            && !root.gestureContextInvalidated
            && root.gestureContextKey === root.currentContextKey();
        root.resetGesture();
        return accepted;
    }

    readonly property Connections workspaceContextConnection: Connections {
        target: Workspace
        ignoreUnknownSignals: true

        function onCurrentDesktopChanged() {
            root.invalidateGesture();
        }

        function onCurrentActivityChanged() {
            root.invalidateGesture();
        }

        function onScreensChanged() {
            root.invalidateGesture();
        }

        function onVirtualScreenGeometryChanged() {
            root.invalidateGesture();
        }

        function onWindowActivated() {
            root.invalidateGesture();
        }
    }

    readonly property Connections activeWindowContextConnection: Connections {
        target: Workspace.activeWindow
        ignoreUnknownSignals: true

        function onOutputChanged() {
            root.invalidateGesture();
        }

        function onDesktopsChanged() {
            root.invalidateGesture();
        }

        function onActivitiesChanged() {
            root.invalidateGesture();
        }
    }

    readonly property SwipeGestureHandler leftSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Left
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("left", progress)
        onCancelled: root.cancelGesture("left")
        onActivated: {
            if (!root.completeGesture("left")) {
                return;
            }
            if (root.naturalScroll) {
                root.focusRightRequested();
            } else {
                root.focusLeftRequested();
            }
        }
    }

    readonly property SwipeGestureHandler rightSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Right
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("right", progress)
        onCancelled: root.cancelGesture("right")
        onActivated: {
            if (!root.completeGesture("right")) {
                return;
            }
            if (root.naturalScroll) {
                root.focusLeftRequested();
            } else {
                root.focusRightRequested();
            }
        }
    }

    Component.onCompleted: console.info("[driftile] touchpad-navigation lifecycle=created")
    Component.onDestruction: console.info("[driftile] touchpad-navigation lifecycle=destroyed")
}
