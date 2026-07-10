import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

    readonly property ShortcutHandler focusLeftShortcut: ShortcutHandler {
        name: "Driftile Focus Left"
        text: "Driftile: Focus left"
        sequence: "Meta+Ctrl+H"
        onActivated: Runtime.DriftileRuntime.focusLeft()
    }
    readonly property ShortcutHandler focusRightShortcut: ShortcutHandler {
        name: "Driftile Focus Right"
        text: "Driftile: Focus right"
        sequence: "Meta+Ctrl+L"
        onActivated: Runtime.DriftileRuntime.focusRight()
    }

    function createRect(x, y, width, height) {
        return Qt.rect(x, y, width, height);
    }

    function schedule(callback) {
        Qt.callLater(callback);
    }

    Component.onCompleted: Runtime.DriftileRuntime.init(Workspace, Workspace.MaximizeArea,
                                                        root.createRect, root.schedule)
    Component.onDestruction: Runtime.DriftileRuntime.destroy()
}
