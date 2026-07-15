import QtQuick

QtObject {
    id: root

    readonly property string runtimeNonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    readonly property Loader selectorLoader: Loader {
        source: `${Qt.resolvedUrl("../runtime/selector.qml")}?nonce=${root.runtimeNonce}`
    }
}
