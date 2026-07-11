import QtQuick
import QtQuick.Window

Window {
    id: root

    readonly property var applicationArguments: Qt.application.arguments
    readonly property string baseTitle: applicationArguments[applicationArguments.length - 1]
    readonly property string phaseTitle: baseTitle + (phase === 0 ? " initial" : phase === 1 ? " constrained" : " relaxed")
    property bool activationSeen: false
    property int phase: 0

    color: "#202020"
    height: 240
    maximumHeight: 16777215
    maximumWidth: 16777215
    minimumHeight: 1
    minimumWidth: phase === 1 ? 700 : 1
    title: phaseTitle + (active ? " [active]" : "")
    visible: true
    width: 360

    onActiveChanged: {
        if (active) {
            activationSeen = true;
        } else if (activationSeen && phase < 2) {
            phase += 1;
        }
    }

    Text {
        anchors.centerIn: parent
        color: "#f0f0f0"
        font.pixelSize: 20
        text: root.title
    }

}
