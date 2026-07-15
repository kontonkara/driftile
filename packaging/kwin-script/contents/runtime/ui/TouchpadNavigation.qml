import QtQuick
import org.kde.kwin

QtObject {
    id: root

    property int fingerCount: 5
    property bool naturalScroll: true

    signal focusLeftRequested()
    signal focusRightRequested()

    readonly property SwipeGestureHandler leftSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Left
        fingerCount: root.fingerCount
        onActivated: {
            if (root.naturalScroll) {
                root.focusRightRequested();
            } else {
                root.focusLeftRequested();
            }
        }
    }

    readonly property SwipeGestureHandler rightSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Right
        fingerCount: root.fingerCount
        onActivated: {
            if (root.naturalScroll) {
                root.focusLeftRequested();
            } else {
                root.focusRightRequested();
            }
        }
    }

    Component.onCompleted: console.info("[driftile] touchpad-navigation lifecycle=created")
    Component.onDestruction: console.info("[driftile] touchpad-navigation lifecycle=destroyed")
}
