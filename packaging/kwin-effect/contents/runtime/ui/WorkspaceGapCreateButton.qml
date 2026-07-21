import QtQuick

Rectangle {
    id: button

    required property bool actionEligible

    signal createRequested()

    implicitWidth: 24
    implicitHeight: 24
    visible: actionEligible
    enabled: visible
    color: createTapHandler.pressed ? "#f28ab4ee"
        : createHoverHandler.hovered ? "#ec719edb" : "#dc1a2637"
    border.width: 1
    border.color: createHoverHandler.hovered ? "#ffffff" : "#c9d8ec"
    radius: width / 2

    Accessible.name: "Create workspace here"
    Accessible.role: Accessible.Button

    Text {
        anchors.centerIn: parent
        text: "+"
        textFormat: Text.PlainText
        color: "#ffffff"
        font.bold: true
        font.pixelSize: 18
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }

    HoverHandler {
        id: createHoverHandler

        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        cursorShape: Qt.PointingHandCursor
    }

    TapHandler {
        id: createTapHandler

        acceptedButtons: Qt.LeftButton
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
        enabled: button.actionEligible
        gesturePolicy: TapHandler.ReleaseWithinBounds
        grabPermissions: PointerHandler.CanTakeOverFromAnything
        onTapped: button.createRequested()
    }
}
