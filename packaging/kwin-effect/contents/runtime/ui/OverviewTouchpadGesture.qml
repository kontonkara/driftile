import QtQuick
import org.kde.kwin as KWin

QtObject {
    id: root

    required property int fingerCount

    signal openRequested()
    signal closeRequested()

    readonly property KWin.SwipeGestureHandler upSwipe: KWin.SwipeGestureHandler {
        deviceType: KWin.SwipeGestureHandler.Device.Touchpad
        direction: KWin.SwipeGestureHandler.Direction.Up
        fingerCount: root.fingerCount
        onActivated: root.openRequested()
    }

    readonly property KWin.SwipeGestureHandler downSwipe: KWin.SwipeGestureHandler {
        deviceType: KWin.SwipeGestureHandler.Device.Touchpad
        direction: KWin.SwipeGestureHandler.Direction.Down
        fingerCount: root.fingerCount
        onActivated: root.closeRequested()
    }

    Component.onCompleted: console.info("[driftile-overview] touchpad-gesture lifecycle=created")
    Component.onDestruction: console.info("[driftile-overview] touchpad-gesture lifecycle=destroyed")
}
