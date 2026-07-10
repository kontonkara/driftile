import QtQuick
import QtQuick.Window

Window {
    id: root

    readonly property var applicationArguments: Qt.application.arguments
    readonly property string baseTitle: applicationArguments[applicationArguments.length - 1]
    readonly property bool markActive: applicationArguments.indexOf("--mark-active") >= 0

    color: "#202020"
    height: 240
    title: baseTitle + (markActive && active ? " [active]" : "")
    visible: true
    width: 360

    Text {
        anchors.centerIn: parent
        color: "#f0f0f0"
        font.pixelSize: 20
        text: root.title
    }
}
