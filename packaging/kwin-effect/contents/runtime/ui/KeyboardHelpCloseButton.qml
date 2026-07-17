import QtQuick

Rectangle {
    id: button

    signal closeRequested()

    implicitWidth: 58
    implicitHeight: 26
    color: closeTapHandler.pressed ? "#f2a83f58" : closeHoverHandler.hovered ? "#e6813046" : "#dc202a3a"
    border.width: 1
    border.color: closeHoverHandler.hovered ? "#fff1f4" : "#c9d3e2"
    radius: 6

    Text {
        anchors.fill: parent
        anchors.margins: 5
        text: "Close"
        textFormat: Text.PlainText
        color: "#ffffff"
        font.bold: true
        font.pixelSize: 12
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }

    HoverHandler {
        id: closeHoverHandler

        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        cursorShape: Qt.PointingHandCursor
    }

    TapHandler {
        id: closeTapHandler

        acceptedButtons: Qt.LeftButton
        gesturePolicy: TapHandler.ReleaseWithinBounds
        grabPermissions: PointerHandler.CanTakeOverFromAnything
        onTapped: button.closeRequested()
    }
}
