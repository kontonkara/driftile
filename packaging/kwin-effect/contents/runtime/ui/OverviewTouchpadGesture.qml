import QtQuick
import org.kde.kwin as KWin

QtObject {
    id: root

    required property int fingerCount
    property string activeGestureOwner: ""
    property string blockedGestureOwner: ""
    property string gestureContextKey: ""

    signal openRequested()
    signal closeRequested()

    function valueKey(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function outputKey(output) {
        if (!output || !output.geometry) {
            return "";
        }

        const geometry = output.geometry;
        return JSON.stringify([root.valueKey(output.name),
                               geometry.x,
                               geometry.y,
                               geometry.width,
                               geometry.height]);
    }

    function desktopForOutput(output) {
        if (!output) {
            return null;
        }

        if (typeof KWin.Workspace.currentDesktopForScreen !== "function") {
            return KWin.Workspace.currentDesktop;
        }

        try {
            return KWin.Workspace.currentDesktopForScreen(output) || null;
        } catch (error) {
            return null;
        }
    }

    function currentGestureContextKey() {
        const screens = KWin.Workspace.screens;
        const desktops = KWin.Workspace.desktops;
        if (!screens || !Number.isInteger(screens.length)
                || screens.length < 1 || screens.length > 64
                || !desktops || !Number.isInteger(desktops.length)
                || desktops.length < 1 || desktops.length > 256) {
            return "";
        }

        const selectedDesktopKeys = [];
        for (let index = 0; index < screens.length; index += 1) {
            const output = screens[index];
            const outputIdentity = root.outputKey(output);
            const desktop = root.desktopForOutput(output);
            const desktopIdentity = desktop ? root.valueKey(desktop.id) : "";
            if (outputIdentity.length === 0 || desktopIdentity.length === 0) {
                return "";
            }
            selectedDesktopKeys.push([outputIdentity, desktopIdentity]);
        }
        selectedDesktopKeys.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);

        const desktopKeys = [];
        for (let index = 0; index < desktops.length; index += 1) {
            const desktop = desktops[index];
            const desktopIdentity = desktop ? root.valueKey(desktop.id) : "";
            if (desktopIdentity.length === 0) {
                return "";
            }
            desktopKeys.push(desktopIdentity);
        }

        return JSON.stringify([root.valueKey(KWin.Workspace.currentActivity),
                               selectedDesktopKeys,
                               desktopKeys]);
    }

    function beginGesture(owner, progress) {
        if (!(progress > 0)) {
            return;
        }
        if (owner !== "open" && owner !== "close") {
            return;
        }
        if (root.activeGestureOwner !== "" || root.blockedGestureOwner !== "") {
            return;
        }

        const contextKey = root.currentGestureContextKey();
        if (contextKey.length === 0) {
            return;
        }

        root.activeGestureOwner = owner;
        root.gestureContextKey = contextKey;
    }

    function invalidateGestureContext() {
        if (root.activeGestureOwner === "") {
            return;
        }

        root.blockedGestureOwner = root.activeGestureOwner;
        root.activeGestureOwner = "";
        root.gestureContextKey = "";
    }

    function resetGesture() {
        root.activeGestureOwner = "";
        root.blockedGestureOwner = "";
        root.gestureContextKey = "";
    }

    function cancelGesture(owner) {
        if (owner === root.activeGestureOwner || owner === root.blockedGestureOwner) {
            root.resetGesture();
        }
    }

    function completeGesture(owner) {
        if (owner === root.blockedGestureOwner) {
            root.resetGesture();
            return false;
        }
        if (owner !== root.activeGestureOwner) {
            return false;
        }

        const accepted = root.gestureContextKey.length > 0
            && root.gestureContextKey === root.currentGestureContextKey();
        root.resetGesture();
        return accepted;
    }

    readonly property Connections workspaceContextConnection: Connections {
        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onCurrentDesktopChanged() {
            root.invalidateGestureContext();
        }

        function onCurrentActivityChanged() {
            root.invalidateGestureContext();
        }

        function onDesktopsChanged() {
            root.invalidateGestureContext();
        }

        function onScreensChanged() {
            root.invalidateGestureContext();
        }

        function onVirtualScreenGeometryChanged() {
            root.invalidateGestureContext();
        }
    }

    readonly property KWin.SwipeGestureHandler upSwipe: KWin.SwipeGestureHandler {
        deviceType: KWin.SwipeGestureHandler.Device.Touchpad
        direction: KWin.SwipeGestureHandler.Direction.Up
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("open", progress)
        onCancelled: root.cancelGesture("open")
        onActivated: {
            if (!root.completeGesture("open")) {
                return;
            }
            root.openRequested();
        }
    }

    readonly property KWin.SwipeGestureHandler downSwipe: KWin.SwipeGestureHandler {
        deviceType: KWin.SwipeGestureHandler.Device.Touchpad
        direction: KWin.SwipeGestureHandler.Direction.Down
        fingerCount: root.fingerCount
        onProgressChanged: root.beginGesture("close", progress)
        onCancelled: root.cancelGesture("close")
        onActivated: {
            if (!root.completeGesture("close")) {
                return;
            }
            root.closeRequested();
        }
    }

    Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")
    Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")
}
