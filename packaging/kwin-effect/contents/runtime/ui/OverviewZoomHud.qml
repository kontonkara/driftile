import QtQuick

Rectangle {
    id: root

    required property bool shown
    required property real zoom
    readonly property string zoomLabel: `${Math.round(zoom * 100)}%`

    implicitWidth: Math.max(64, zoomText.implicitWidth + 24)
    implicitHeight: 34
    visible: shown && Number.isFinite(zoom) && zoom > 0
    enabled: false
    color: "#e61a2230"
    border.width: 1
    border.color: "#86aee8"
    radius: 8

    Text {
        id: zoomText

        anchors.fill: parent
        anchors.leftMargin: 12
        anchors.rightMargin: 12
        text: root.zoomLabel
        textFormat: Text.PlainText
        color: "#f3f7ff"
        font.bold: true
        font.pixelSize: 14
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
}
