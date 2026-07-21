import QtQuick

Rectangle {
    id: strip

    component ActionButton: Rectangle {
        id: button

        required property string actionName
        required property bool actionEligible
        required property string label
        property bool destructive: false

        signal triggered()

        implicitWidth: 65
        implicitHeight: 24
        enabled: actionEligible
        opacity: actionEligible ? 1 : 0.42
        color: actionTapHandler.pressed
            ? (destructive ? "#f2a83f58" : "#f28ab4ee")
            : actionHoverHandler.hovered
              ? (destructive ? "#e6813046" : "#ec42648e")
              : "#cc202a3a"
        border.width: 1
        border.color: actionHoverHandler.hovered && actionEligible ? "#ffffff" : "#8395ad"
        radius: 4

        Accessible.name: actionName
        Accessible.role: Accessible.Button

        Text {
            anchors.fill: parent
            anchors.margins: 4
            text: button.label
            textFormat: Text.PlainText
            color: "#ffffff"
            font.bold: true
            font.pixelSize: 11
            fontSizeMode: Text.Fit
            minimumPixelSize: 8
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
        }

        HoverHandler {
            id: actionHoverHandler

            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            cursorShape: button.actionEligible ? Qt.PointingHandCursor : Qt.ArrowCursor
        }

        TapHandler {
            id: actionTapHandler

            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
            enabled: button.actionEligible
            gesturePolicy: TapHandler.ReleaseWithinBounds
            grabPermissions: PointerHandler.CanTakeOverFromAnything
            onTapped: button.triggered()
        }
    }

    required property string desktopName
    required property bool editing
    required property bool interactionEligible
    required property bool removeEligible
    required property string renameDraft

    signal cancelRenameRequested()
    signal removeRequested()
    signal renameDraftEdited(string draft)
    signal renameRequested()
    signal submitRenameRequested()

    implicitWidth: editing ? 286 : 142
    implicitHeight: 30
    visible: interactionEligible || editing
    enabled: visible
    color: "#e6111824"
    border.width: 1
    border.color: editing ? "#d9a9c7ef" : "#805f718a"
    radius: 6

    Row {
        id: actionRow

        anchors.fill: parent
        anchors.margins: 3
        spacing: 4
        visible: !strip.editing

        ActionButton {
            actionName: "Rename workspace"
            label: "Rename"
            actionEligible: strip.interactionEligible
            onTriggered: strip.renameRequested()
        }

        ActionButton {
            actionName: "Remove workspace"
            label: "Remove"
            actionEligible: strip.interactionEligible && strip.removeEligible
            destructive: true
            onTriggered: strip.removeRequested()
        }
    }

    Rectangle {
        id: editorFrame

        anchors.fill: parent
        anchors.margins: 3
        visible: strip.editing
        color: "#f01a2432"
        border.width: 1
        border.color: renameInput.activeFocus ? "#f2d7e8ff" : "#8395ad"
        radius: 4

        TextInput {
            id: renameInput

            anchors.left: parent.left
            anchors.right: submitButton.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.leftMargin: 7
            anchors.rightMargin: 5
            text: strip.renameDraft
            color: "#ffffff"
            selectionColor: "#6686aee8"
            selectedTextColor: "#ffffff"
            font.pixelSize: 12
            maximumLength: 256
            selectByMouse: true
            clip: true

            Accessible.name: `Rename workspace ${strip.desktopName}`
            Accessible.role: Accessible.EditableText

            onTextEdited: strip.renameDraftEdited(text)
            Keys.onPressed: event => {
                const modifiers = event.modifiers & ~Qt.KeypadModifier;
                if (!event.isAutoRepeat && modifiers === Qt.NoModifier
                        && (event.key === Qt.Key_Enter || event.key === Qt.Key_Return)) {
                    strip.submitRenameRequested();
                    event.accepted = true;
                    return;
                }
                if (!event.isAutoRepeat && modifiers === Qt.NoModifier
                        && event.key === Qt.Key_Escape) {
                    strip.cancelRenameRequested();
                    event.accepted = true;
                }
            }
        }

        ActionButton {
            id: submitButton

            anchors.right: cancelButton.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            width: 34
            actionName: "Save workspace name"
            label: "OK"
            actionEligible: strip.editing
            onTriggered: strip.submitRenameRequested()
        }

        ActionButton {
            id: cancelButton

            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            width: 34
            actionName: "Cancel workspace rename"
            label: "×"
            actionEligible: strip.editing
            onTriggered: strip.cancelRenameRequested()
        }
    }

    onEditingChanged: {
        if (editing) {
            renameInput.forceActiveFocus();
            renameInput.selectAll();
        }
    }
}
