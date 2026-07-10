import QtQuick
import QtQuick.Window

Window {
    color: "#202020"
    height: 240
    title: Qt.application.arguments[Qt.application.arguments.length - 1]
    visible: true
    width: 360
}
