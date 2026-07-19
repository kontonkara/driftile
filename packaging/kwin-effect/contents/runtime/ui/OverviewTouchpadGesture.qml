import QtQuick
import org.kde.kwin as KWin

QtObject {
    id: root

    required property int fingerCount
    property string activeGestureOwner: ""
    property string blockedGestureOwner: ""
    property string gestureContextKey: ""

    signal gestureStarted(string owner, real progress)
    signal gestureProgressed(string owner, real progress)
    signal gestureCancelled(string owner)
    signal gestureActivated(string owner)
    signal gestureInvalidated(string owner)

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

    function boundedGestureProgress(progress) {
        const numeric = Number(progress);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        return Math.max(0, Math.min(1, numeric));
    }

    function updateGesture(owner, progress) {
        if (owner !== "open" && owner !== "close") {
            return;
        }

        const boundedProgress = root.boundedGestureProgress(progress);
        if (root.activeGestureOwner === owner) {
            if (root.gestureContextKey.length === 0
                    || root.gestureContextKey !== root.currentGestureContextKey()) {
                root.invalidateGestureContext();
                return;
            }

            root.gestureProgressed(owner, boundedProgress);
            return;
        }
        if (boundedProgress <= 0 || root.activeGestureOwner !== ""
                || root.blockedGestureOwner !== "") {
            return;
        }

        const contextKey = root.currentGestureContextKey();
        if (contextKey.length === 0) {
            return;
        }

        root.activeGestureOwner = owner;
        root.gestureContextKey = contextKey;
        root.gestureStarted(owner, boundedProgress);
    }

    function invalidateGestureContext() {
        if (root.activeGestureOwner === "") {
            return;
        }

        const owner = root.activeGestureOwner;
        root.blockedGestureOwner = owner;
        root.activeGestureOwner = "";
        root.gestureContextKey = "";
        root.gestureInvalidated(owner);
    }

    function resetGesture() {
        root.activeGestureOwner = "";
        root.blockedGestureOwner = "";
        root.gestureContextKey = "";
    }

    function cancelGesture(owner) {
        if (owner === root.blockedGestureOwner) {
            root.resetGesture();
            return;
        }
        if (owner !== root.activeGestureOwner) {
            return;
        }

        root.resetGesture();
        root.gestureCancelled(owner);
    }

    function activateGesture(owner) {
        if (owner === root.blockedGestureOwner) {
            root.resetGesture();
            return;
        }
        if (owner !== root.activeGestureOwner) {
            return;
        }

        const accepted = root.gestureContextKey.length > 0
            && root.gestureContextKey === root.currentGestureContextKey();
        root.resetGesture();
        if (accepted) {
            root.gestureActivated(owner);
        } else {
            root.gestureCancelled(owner);
        }
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
        onProgressChanged: root.updateGesture("open", progress)
        onCancelled: root.cancelGesture("open")
        onActivated: root.activateGesture("open")
    }

    readonly property KWin.SwipeGestureHandler downSwipe: KWin.SwipeGestureHandler {
        deviceType: KWin.SwipeGestureHandler.Device.Touchpad
        direction: KWin.SwipeGestureHandler.Direction.Down
        fingerCount: root.fingerCount
        onProgressChanged: root.updateGesture("close", progress)
        onCancelled: root.cancelGesture("close")
        onActivated: root.activateGesture("close")
    }

    Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")
    Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")
}
