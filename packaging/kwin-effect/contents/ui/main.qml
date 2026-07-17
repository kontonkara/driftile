import QtQuick
import org.kde.kwin as KWin

KWin.SceneEffect {
    id: effect

    readonly property string runtimeNonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    readonly property Loader selectorLoader: Loader {
        source: `${Qt.resolvedUrl("../runtime/selector.qml")}?nonce=${effect.runtimeNonce}`
    }
    readonly property var controller: selectorLoader.item && selectorLoader.item.item
        ? selectorLoader.item.item
        : null
    readonly property bool configuredTouchpadGesture: touchpadGestureEnabledFromConfig()
    readonly property int configuredTouchpadGestureFingerCount: touchpadGestureFingerCountFromConfig()
    readonly property int configuredScreenEdge: screenEdgeFromConfig()
    readonly property color backdropColor: backdropColorFromConfig()
    readonly property bool showWindowLabels: showWindowLabelsFromConfig()
    readonly property bool showApplicationIdentity: showApplicationIdentityFromConfig()
    readonly property bool showWindowCloseButtons: showWindowCloseButtonsFromConfig()
    readonly property bool showWindowStateBadges: showWindowStateBadgesFromConfig()
    readonly property bool showDesktopNames: showDesktopNamesFromConfig()

    readonly property bool active: controller ? controller.active : false
    readonly property bool loading: controller ? controller.loading : false
    readonly property var overviewModel: controller ? controller.overviewModel : null

    visible: controller ? controller.active : false
    delegate: controller ? controller.overviewDelegate : null

    KWin.ScreenEdgeHandler {
        edge: effect.configuredScreenEdge
        enabled: edge !== KWin.ScreenEdgeHandler.NoEdge
        mode: KWin.ScreenEdgeHandler.Pointer

        onActivated: effect.activate()
    }

    onControllerChanged: syncTouchpadGestureSettings()
    onConfiguredTouchpadGestureChanged: syncTouchpadGestureSettings()
    onConfiguredTouchpadGestureFingerCountChanged: syncTouchpadGestureSettings()

    Component.onCompleted: syncTouchpadGestureSettings()

    function toggle() {
        if (controller) {
            controller.toggle();
        }
    }

    function activate() {
        if (controller) {
            controller.activate();
        }
    }

    function deactivate() {
        if (controller) {
            controller.deactivate();
        }
    }

    function syncTouchpadGestureSettings() {
        if (controller && typeof controller.applyTouchpadGestureSettings === "function") {
            controller.applyTouchpadGestureSettings(configuredTouchpadGesture,
                                                     configuredTouchpadGestureFingerCount);
        }
    }

    function touchpadGestureEnabledFromConfig() {
        const value = configuration ? configuration.TouchpadGesture : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function touchpadGestureFingerCountFromConfig() {
        const value = configuration ? Number(configuration.TouchpadGestureFingerCount) : 4;
        return Number.isFinite(value) && Math.floor(value) === value && value >= 3 && value <= 5 ? value : 4;
    }

    function screenEdgeFromConfig() {
        const value = configuration ? String(configuration.ScreenEdge).trim().toLowerCase() : "none";
        switch (value) {
        case "top-left":
            return KWin.ScreenEdgeHandler.TopLeftEdge;
        case "top":
            return KWin.ScreenEdgeHandler.TopEdge;
        case "top-right":
            return KWin.ScreenEdgeHandler.TopRightEdge;
        case "right":
            return KWin.ScreenEdgeHandler.RightEdge;
        case "bottom-right":
            return KWin.ScreenEdgeHandler.BottomRightEdge;
        case "bottom":
            return KWin.ScreenEdgeHandler.BottomEdge;
        case "bottom-left":
            return KWin.ScreenEdgeHandler.BottomLeftEdge;
        case "left":
            return KWin.ScreenEdgeHandler.LeftEdge;
        default:
            return KWin.ScreenEdgeHandler.NoEdge;
        }
    }

    function backdropColorFromConfig() {
        const fallback = "#e60b0f17";
        const value = configuration ? configuration.BackdropColor : undefined;
        if (typeof value === "string") {
            const candidate = value.trim();
            return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(candidate) ? candidate : fallback;
        }

        if (!value || !validColorChannel(value.r) || !validColorChannel(value.g)
                || !validColorChannel(value.b) || !validColorChannel(value.a)) {
            return fallback;
        }

        return value;
    }

    function showWindowLabelsFromConfig() {
        const value = configuration ? configuration.ShowWindowLabels : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function showApplicationIdentityFromConfig() {
        const value = configuration ? configuration.ShowApplicationIdentity : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function showWindowCloseButtonsFromConfig() {
        const value = configuration ? configuration.ShowWindowCloseButtons : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function showWindowStateBadgesFromConfig() {
        const value = configuration ? configuration.ShowWindowStateBadges : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function showDesktopNamesFromConfig() {
        const value = configuration ? configuration.ShowDesktopNames : undefined;
        return typeof value === "boolean" ? value : true;
    }

    function validColorChannel(value) {
        const channel = Number(value);
        return Number.isFinite(channel) && channel >= 0 && channel <= 1;
    }
}
