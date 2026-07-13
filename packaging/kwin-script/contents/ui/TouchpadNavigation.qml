import QtQuick
import org.kde.kwin

QtObject {
    id: root

    signal focusLeftRequested()
    signal focusRightRequested()

    readonly property SwipeGestureHandler leftSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Left
        fingerCount: 5
        onActivated: root.focusRightRequested()
    }

    readonly property SwipeGestureHandler rightSwipe: SwipeGestureHandler {
        deviceType: SwipeGestureHandler.Device.Touchpad
        direction: SwipeGestureHandler.Direction.Right
        fingerCount: 5
        onActivated: root.focusLeftRequested()
    }

    Component.onCompleted: console.info("[driftile] touchpad-navigation lifecycle=created")
    Component.onDestruction: console.info("[driftile] touchpad-navigation lifecycle=destroyed")
}
