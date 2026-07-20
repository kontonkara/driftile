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
    readonly property real configuredOverviewZoom: overviewZoomFromConfig()
    readonly property color backdropColor: backdropColorFromConfig()
    readonly property real overviewZoom: controller && typeof controller.overviewSessionZoom === "number" && Number.isFinite(controller.overviewSessionZoom) && controller.overviewSessionZoom >= 0.2 && controller.overviewSessionZoom <= 0.75 ? controller.overviewSessionZoom : configuredOverviewZoom
    readonly property int overviewZoomRevision: controller && Number.isInteger(controller.overviewZoomRevision) && controller.overviewZoomRevision >= 0 ? controller.overviewZoomRevision : 0
    readonly property int overviewZoomInputStateRevision: controller && Number.isInteger(controller.overviewZoomInputStateRevision) && controller.overviewZoomInputStateRevision >= 0 ? controller.overviewZoomInputStateRevision : 0
    readonly property int overviewZoomGestureSessionId: controller
        && Number.isInteger(controller.overviewZoomGestureSessionId)
        && controller.overviewZoomGestureSessionId > 0
        ? controller.overviewZoomGestureSessionId : 0
    readonly property string overviewZoomGestureDirection: controller
        && (controller.overviewZoomGestureDirection === "in"
            || controller.overviewZoomGestureDirection === "out")
        ? controller.overviewZoomGestureDirection : ""
    readonly property bool showWindowLabels: showWindowLabelsFromConfig()
    readonly property bool showApplicationIdentity: showApplicationIdentityFromConfig()
    readonly property bool showWindowCloseButtons: showWindowCloseButtonsFromConfig()
    readonly property bool showWindowStateBadges: showWindowStateBadgesFromConfig()
    readonly property bool showDesktopNames: showDesktopNamesFromConfig()
    readonly property bool showApplicationIcons: showApplicationIconsFromConfig()
    readonly property bool showOutputNames: showOutputNamesFromConfig()
    readonly property bool overviewAlwaysCenterSingleColumn: controller
        && typeof controller.overviewAlwaysCenterSingleColumn === "boolean"
        ? controller.overviewAlwaysCenterSingleColumn
        : false
    readonly property real overviewGap: controller && typeof controller.overviewGap === "number"
        && Number.isFinite(controller.overviewGap) && controller.overviewGap >= 0
        && controller.overviewGap <= 64
        ? controller.overviewGap
        : 16

    readonly property bool active: controller ? controller.active : false
    readonly property int activeSessionId: controller && Number.isInteger(controller.activeSessionId)
        && controller.activeSessionId > 0 ? controller.activeSessionId : 0
    readonly property bool loading: controller ? controller.loading : false
    readonly property var overviewModel: controller ? controller.overviewModel : null
    readonly property real presentationProgress: controller
        && typeof controller.presentationProgress === "number"
        && Number.isFinite(controller.presentationProgress)
        ? Math.max(0, Math.min(1, controller.presentationProgress))
        : 0
    readonly property string presentationPhase: controller
        && typeof controller.presentationPhase === "string"
        ? controller.presentationPhase
        : "closed"

    visible: controller ? controller.active : false
    delegate: controller ? controller.overviewDelegate : null

    KWin.ScreenEdgeHandler {
        edge: effect.configuredScreenEdge
        enabled: edge !== KWin.ScreenEdgeHandler.NoEdge
        mode: KWin.ScreenEdgeHandler.Pointer

        onActivated: effect.activate()
    }

    onControllerChanged: {
        syncTouchpadGestureSettings();
        syncOverviewZoomSetting();
    }
    onConfiguredTouchpadGestureChanged: syncTouchpadGestureSettings()
    onConfiguredTouchpadGestureFingerCountChanged: syncTouchpadGestureSettings()
    onConfiguredOverviewZoomChanged: syncOverviewZoomSetting()

    Component.onCompleted: {
        syncTouchpadGestureSettings();
        syncOverviewZoomSetting();
    }

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

    function deactivateImmediately() {
        if (controller && typeof controller.deactivateImmediately === "function") {
            controller.deactivateImmediately();
        }
    }

    function submitSpatialDropCommand(source, target) {
        return controller && typeof controller.submitSpatialDropCommand === "function"
            ? controller.submitSpatialDropCommand(source, target) === true
            : false;
    }

    function applyOverviewZoomInputState(sessionId, outputId, sceneToken, eligible) {
        return controller && typeof controller.applyOverviewZoomInputState === "function" ? controller.applyOverviewZoomInputState(sessionId, outputId, sceneToken, eligible) === true : false;
    }

    function clearOverviewZoomInputState(sessionId, outputId, sceneToken) {
        return controller && typeof controller.clearOverviewZoomInputState === "function" ? controller.clearOverviewZoomInputState(sessionId, outputId, sceneToken) === true : false;
    }

    function setOverviewSessionZoom(sessionId, outputId, sceneToken, zoom) {
        return controller && typeof controller.setOverviewSessionZoom === "function" ? controller.setOverviewSessionZoom(sessionId, outputId, sceneToken, zoom) === true : false;
    }

    function resetOverviewSessionZoom(sessionId, outputId, sceneToken) {
        return controller && typeof controller.resetOverviewSessionZoom === "function" ? controller.resetOverviewSessionZoom(sessionId, outputId, sceneToken) === true : false;
    }

    function beginOverviewZoomGesture(sessionId, direction, progress) {
        return controller && typeof controller.beginOverviewZoomGesture === "function" ? controller.beginOverviewZoomGesture(sessionId, direction, progress) === true : false;
    }

    function updateOverviewZoomGesture(sessionId, direction, progress) {
        return controller && typeof controller.updateOverviewZoomGesture === "function" ? controller.updateOverviewZoomGesture(sessionId, direction, progress) === true : false;
    }

    function commitOverviewZoomGesture(sessionId, direction) {
        return controller && typeof controller.commitOverviewZoomGesture === "function" ? controller.commitOverviewZoomGesture(sessionId, direction) === true : false;
    }

    function cancelOverviewZoomGesture(sessionId, direction) {
        return controller && typeof controller.cancelOverviewZoomGesture === "function" ? controller.cancelOverviewZoomGesture(sessionId, direction) === true : false;
    }

    function invalidateOverviewZoomGesture(sessionId, direction) {
        return controller && typeof controller.invalidateOverviewZoomGesture === "function" ? controller.invalidateOverviewZoomGesture(sessionId, direction) === true : false;
    }

    function syncTouchpadGestureSettings() {
        if (controller && typeof controller.applyTouchpadGestureSettings === "function") {
            controller.applyTouchpadGestureSettings(configuredTouchpadGesture,
                                                     configuredTouchpadGestureFingerCount);
        }
    }

    function syncOverviewZoomSetting() {
        if (controller && typeof controller.applyOverviewZoomSetting === "function") {
            controller.applyOverviewZoomSetting(configuredOverviewZoom);
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

    function overviewZoomFromConfig() {
        const fallback = 0.5;
        const value = configuration ? Number(configuration.OverviewZoom) : fallback;
        return Number.isFinite(value) && value >= 0.2 && value <= 0.75 ? value : fallback;
    }

    function showWindowLabelsFromConfig() {
        const value = configuration ? configuration.ShowWindowLabels : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showApplicationIdentityFromConfig() {
        const value = configuration ? configuration.ShowApplicationIdentity : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showWindowCloseButtonsFromConfig() {
        const value = configuration ? configuration.ShowWindowCloseButtons : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showWindowStateBadgesFromConfig() {
        const value = configuration ? configuration.ShowWindowStateBadges : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showDesktopNamesFromConfig() {
        const value = configuration ? configuration.ShowDesktopNames : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showApplicationIconsFromConfig() {
        const value = configuration ? configuration.ShowApplicationIcons : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function showOutputNamesFromConfig() {
        const value = configuration ? configuration.ShowOutputNames : undefined;
        return typeof value === "boolean" ? value : false;
    }

    function validColorChannel(value) {
        const channel = Number(value);
        return Number.isFinite(channel) && channel >= 0 && channel <= 1;
    }
}
