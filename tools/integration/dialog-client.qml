import QtQuick
import QtQuick.Window

Window {
    id: parentWindow

    readonly property var applicationArguments: Qt.application.arguments
    readonly property string baseTitle: applicationArguments[applicationArguments.length - 2]
    readonly property string dialogBaseTitle: applicationArguments[applicationArguments.length - 1]

    color: "#202020"
    height: 240
    title: baseTitle + (active ? " [active]" : "")
    visible: true
    width: 360

    Text {
        anchors.centerIn: parent
        color: "#f0f0f0"
        font.pixelSize: 20
        text: parentWindow.title
    }

    Timer {
        interval: 3000
        running: true

        onTriggered: {
            dialogWindow.visible = true;
            dialogWindow.requestActivate();
        }
    }

    Window {
        id: dialogWindow

        color: "#303030"
        flags: Qt.Dialog
        height: 180
        modality: Qt.WindowModal
        title: parentWindow.dialogBaseTitle + (active ? " [active]" : "")
        transientParent: parentWindow
        visible: false
        width: 320

        Text {
            anchors.centerIn: parent
            color: "#f0f0f0"
            font.pixelSize: 18
            text: dialogWindow.title
        }
    }
}
