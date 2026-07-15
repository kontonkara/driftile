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

    readonly property bool active: controller ? controller.active : false
    readonly property bool loading: controller ? controller.loading : false
    readonly property var overviewModel: controller ? controller.overviewModel : null

    visible: controller ? controller.active : false
    delegate: controller ? controller.overviewDelegate : null

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
}
