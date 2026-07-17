import QtQuick

Rectangle {
    id: badge

    required property int count

    implicitWidth: 30
    implicitHeight: 18
    color: "#e686aee8"
    border.width: 1
    border.color: "#eaf3ff"
    radius: implicitHeight / 2

    Text {
        anchors.fill: parent
        anchors.margins: 4
        text: String(badge.count)
        textFormat: Text.PlainText
        color: "#0b1625"
        font.bold: true
        font.pixelSize: 11
        fontSizeMode: Text.Fit
        minimumPixelSize: 7
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
}
