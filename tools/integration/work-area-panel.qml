import QtQuick
import QtQuick.Window
import org.kde.layershell 1.0 as LayerShell

Window {
    id: root

    color: "#202020"
    visible: true
    width: 64

    LayerShell.Window.anchors: LayerShell.Window.AnchorTop
        | LayerShell.Window.AnchorBottom
        | LayerShell.Window.AnchorLeft
    LayerShell.Window.exclusionZone: root.width
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityNone
    LayerShell.Window.layer: LayerShell.Window.LayerTop
    LayerShell.Window.scope: "driftile-integration-work-area"
    LayerShell.Window.wantsToBeOnActiveScreen: true
}
