import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

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
