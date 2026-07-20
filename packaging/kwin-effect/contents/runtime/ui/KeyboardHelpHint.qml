import QtQuick

Rectangle {
    id: hint

    signal openRequested()

    readonly property string label: "Type to search \u00b7 F1 help"

    implicitWidth: 168
    implicitHeight: 28
    color: hintTapHandler.pressed ? "#f23b526f" : hintHoverHandler.hovered ? "#e62b3a50" : "#cc1a2230"
    border.width: 1
    border.color: hintTapHandler.pressed ? "#ffffff" : hintHoverHandler.hovered ? "#d8e8ff" : "#66758c"
    radius: 7
    Accessible.name: hint.label
    Accessible.role: Accessible.Button
    Accessible.onPressAction: hint.openRequested()

    Text {
        anchors.fill: parent
        text: hint.label
        textFormat: Text.PlainText
        color: hintTapHandler.pressed ? "#ffffff" : hintHoverHandler.hovered ? "#eaf2ff" : "#d8e1ee"
        font.pixelSize: 11
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }

    HoverHandler {
        id: hintHoverHandler

        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        cursorShape: Qt.PointingHandCursor
    }

    TapHandler {
        id: hintTapHandler

        acceptedButtons: Qt.LeftButton
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
        gesturePolicy: TapHandler.ReleaseWithinBounds
        grabPermissions: PointerHandler.CanTakeOverFromAnything
        onTapped: hint.openRequested()
    }
}
