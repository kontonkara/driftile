import QtQuick
import "../code/main.js" as Runtime

QtObject {
    Component.onCompleted: Runtime.DriftileRuntime.init(workspace)
    Component.onDestruction: Runtime.DriftileRuntime.destroy()
}
