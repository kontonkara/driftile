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

    readonly property bool active: controller ? controller.active : false
    readonly property bool loading: controller ? controller.loading : false
    readonly property var overviewModel: controller ? controller.overviewModel : null

    visible: controller ? controller.active : false
    delegate: controller ? controller.overviewDelegate : null

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
}
