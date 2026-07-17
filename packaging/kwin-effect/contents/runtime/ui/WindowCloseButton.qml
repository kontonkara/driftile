import QtQuick

Rectangle {
    id: button

    required property bool closeEligible
    required property bool keyboardSelected
    required property bool settingEnabled
    required property bool surfaceHovered
    required property bool surfaceLargeEnough

    signal closeRequested()

    visible: settingEnabled && closeEligible && surfaceLargeEnough && (surfaceHovered || keyboardSelected)
    color: closeTapHandler.pressed ? "#f2a83f58" : closeHoverHandler.hovered ? "#e6813046" : "#dc202a3a"
    border.width: 1
    border.color: closeHoverHandler.hovered || keyboardSelected ? "#fff1f4" : "#c9d3e2"
    radius: Math.min(width, height) / 2
    clip: true

    Text {
        anchors.centerIn: parent
        text: "×"
        color: "#ffffff"
        font.bold: true
        font.pixelSize: Math.max(9, Math.min(14, button.height * 0.78))
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        textFormat: Text.PlainText
    }

    HoverHandler {
        id: closeHoverHandler

        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        cursorShape: Qt.PointingHandCursor
    }

    TapHandler {
        id: closeTapHandler

        acceptedButtons: Qt.LeftButton
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        enabled: button.visible
        gesturePolicy: TapHandler.ReleaseWithinBounds
        grabPermissions: PointerHandler.CanTakeOverFromAnything
        onTapped: button.closeRequested()
    }
}
