import QtQuick
import org.kde.kwin

QtObject {
    id: root

    required property int fingerCount
    required property bool naturalScroll

    signal focusPreviousDesktopRequested()
    signal focusNextDesktopRequested()

    readonly property SwipeGestureHandler upSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Up
        fingerCount: root.fingerCount
        onActivated: {
            if (root.naturalScroll) {
                root.focusNextDesktopRequested();
            } else {
                root.focusPreviousDesktopRequested();
            }
        }
    }

    readonly property SwipeGestureHandler downSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Down
        fingerCount: root.fingerCount
        onActivated: {
            if (root.naturalScroll) {
                root.focusPreviousDesktopRequested();
            } else {
                root.focusNextDesktopRequested();
            }
        }
    }

    Component.onCompleted: console.info("[driftile] touchpad-workspace-navigation lifecycle=created")
    Component.onDestruction: console.info("[driftile] touchpad-workspace-navigation lifecycle=destroyed")
}
