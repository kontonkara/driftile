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

    function liveOutput(output) {
        if (!output) {
            return null;
        }

        const screens = Workspace.screens;
        let matches = 0;
        for (let index = 0; index < screens.length; index += 1) {
            if (screens[index] === output) {
                matches += 1;
            }
        }
        return matches === 1 ? output : null;
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

    function activityForWindow(window) {
        const currentActivity = root.valueKey(Workspace.currentActivity);
        const activities = window.activities;

        if (activities === undefined || activities === null) {
            return currentActivity;
        }

        if (activities.length === 1) {
            const activity = root.valueKey(activities[0]);
            if (activity === ""
                    || (currentActivity !== "" && currentActivity !== activity)) {
                return null;
            }
            return activity;
        }

        const workspaceActivities = Workspace.activities;
        if (activities.length === 0
                && (!workspaceActivities || workspaceActivities.length <= 1)) {
            return currentActivity;
        }
        return null;
    }

    function currentGestureContext() {
        const window = Workspace.activeWindow;
        if (!window || window.deleted || window.onAllDesktops
                || window.internalId === undefined || window.internalId === null) {
            return null;
        }

        const windowId = root.valueKey(window.internalId);
        const output = root.liveOutput(window.output);
        if (windowId === "" || !output) {
            return null;
        }

        const desktop = root.desktopForOutput(output);
        if (!desktop || desktop.id === undefined || desktop.id === null) {
            return null;
        }

        const desktopId = root.valueKey(desktop.id);
        const desktops = window.desktops;
        if (desktopId === "" || !desktops || desktops.length !== 1
                || !desktops[0]
                || root.valueKey(desktops[0].id) !== desktopId) {
            return null;
        }

        const activity = root.activityForWindow(window);
        if (activity === null) {
            return null;
        }

        return {
            key: [activity,
                  desktopId,
                  windowId,
                  root.outputKey(output),
                  root.topologyKey()].join("|")
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

        function onCurrentDesktopChanged(_previous, _current, output) {
            const window = Workspace.activeWindow;
            if (!output || !window || window.output === output) {
                root.invalidateGesture();
            }
        }

        function onCurrentActivityChanged() {
            root.invalidateGesture();
        }

        function onActivitiesChanged() {
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
