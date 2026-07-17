import QtQuick

Rectangle {
    id: hint

    signal openRequested()

    implicitWidth: 128
    implicitHeight: 20
    color: hintTapHandler.pressed ? "#f286aee8" : hintHoverHandler.hovered ? "#e62b3a50" : "#cc1a2230"
    border.width: 1
    border.color: hintHoverHandler.hovered ? "#d8e8ff" : "#66758c"
    radius: 7

    Text {
        anchors.fill: parent
        text: "F1  Keyboard help"
        textFormat: Text.PlainText
        color: "#c9d3e2"
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
