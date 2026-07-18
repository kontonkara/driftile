import QtQuick
import org.kde.kwin

QtObject {
    id: root

    required property int fingerCount
    required property bool naturalScroll
    property string activeGestureOwner: ""
    property string gestureContextKey: ""
    property string gestureOutputKey: ""
    property bool gestureContextInvalidated: false

    signal focusPreviousDesktopRequested()
    signal focusNextDesktopRequested()

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

    function outputUnderPointer() {
        const point = Workspace.cursorPos;
        const screens = Workspace.screens;
        let match = null;
        let matches = 0;

        for (let index = 0; index < screens.length; index += 1) {
            const screen = screens[index];
            const geometry = screen.geometry;
            if (point.x >= geometry.x
                    && point.x < geometry.x + geometry.width
                    && point.y >= geometry.y
                    && point.y < geometry.y + geometry.height) {
                match = screen;
                matches += 1;
            }
        }

        return matches === 1 ? match : null;
    }

    function desktopForOutput(output) {
        if (!output) {
            return null;
        }

        if (typeof Workspace.currentDesktopForScreen !== "function") {
            return Workspace.currentDesktop;
        }

        try {
            const desktop = Workspace.currentDesktopForScreen(output);
            return desktop || null;
        } catch (_error) {
            return null;
        }
    }

    function currentGestureContext() {
        const output = root.outputUnderPointer();
        if (!output) {
            return null;
        }

        const desktop = root.desktopForOutput(output);
        if (!desktop) {
            return null;
        }

        const outputKey = root.outputKey(output);
        return {
            key: [root.valueKey(Workspace.currentActivity),
                  outputKey,
                  root.valueKey(desktop.id),
                  root.topologyKey()].join("|"),
            outputKey: outputKey
        };
    }

    function beginGesture(owner, progress) {
        if (!(progress > 0)) {
            return;
        }

        if (root.activeGestureOwner !== "") {
            return;
        }

        const context = root.currentGestureContext();
        if (!context) {
            root.resetGesture();
            return;
        }

        root.activeGestureOwner = owner;
        root.gestureContextKey = context.key;
        root.gestureOutputKey = context.outputKey;
        root.gestureContextInvalidated = false;
    }

    function invalidateGesture() {
        if (root.activeGestureOwner !== "") {
            root.gestureContextInvalidated = true;
        }
    }

    function invalidateGestureForPointerOutput() {
        if (root.activeGestureOwner !== ""
                && root.gestureOutputKey !== root.outputKey(root.outputUnderPointer())) {
            root.gestureContextInvalidated = true;
        }
    }

    function resetGesture() {
        root.activeGestureOwner = "";
        root.gestureContextKey = "";
        root.gestureOutputKey = "";
        root.gestureContextInvalidated = false;
    }

    function cancelGesture(owner) {
        if (owner === root.activeGestureOwner) {
            root.resetGesture();
        }
    }

    function completeGesture(owner) {
        const context = root.currentGestureContext();
        const accepted = owner === root.activeGestureOwner
            && !root.gestureContextInvalidated
            && context !== null
            && root.gestureContextKey === context.key;
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

        function onCursorPosChanged() {
            root.invalidateGestureForPointerOutput();
        }
    }

    readonly property SwipeGestureHandler upSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Up
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("up", progress)
        onCancelled: root.cancelGesture("up")
        onActivated: {
            if (!root.completeGesture("up")) {
                return;
            }
            if (root.naturalScroll) {
                root.focusNextDesktopRequested();
            } else {
                root.focusPreviousDesktopRequested();
            }
        }
    }

    readonly property SwipeGestureHandler downSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Down
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("down", progress)
        onCancelled: root.cancelGesture("down")
        onActivated: {
            if (!root.completeGesture("down")) {
                return;
            }
            if (root.naturalScroll) {
                root.focusPreviousDesktopRequested();
            } else {
                root.focusNextDesktopRequested();
            }
        }
    }

    Component.onCompleted: console.info("[driftile] touchpad-workspace-navigation lifecycle=created")
    Component.onDestruction: console.info("[driftile] touchpad-workspace-navigation lifecycle=destroyed")
}
