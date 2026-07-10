import QtQuick
import QtQuick.Window

Window {
    id: root

    readonly property var applicationArguments: Qt.application.arguments
    readonly property string baseTitle: applicationArguments[applicationArguments.length - 1]
    readonly property int clientHeight: 240
    readonly property int clientWidth: 360

    color: "#202020"
    flags: Qt.Window
    height: clientHeight
    maximumHeight: clientHeight
    maximumWidth: clientWidth
    minimumHeight: clientHeight
    minimumWidth: clientWidth
    title: baseTitle + (active ? " [active]" : "")
    visible: true
    width: clientWidth

    Text {
        anchors.centerIn: parent
        color: "#f0f0f0"
        font.pixelSize: 20
        text: root.title
    }
}
