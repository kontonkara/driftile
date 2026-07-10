import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

    property bool deliveringResumeCallbacks: false
    property var nextResumeCallbacks: []
    property var resumeCallbacks: []

    readonly property Timer resumeTimer: Timer {
        interval: 50
        repeat: false

        onTriggered: {
            const callbacks = root.resumeCallbacks;
            root.resumeCallbacks = [];
            root.deliveringResumeCallbacks = true;

            try {
                for (let index = 0; index < callbacks.length; index += 1) {
                    try {
                        callbacks[index]();
                    } catch (error) {
                        console.warn(`[driftile] delayed callback failed error=${String(error)}`);
                    }
                }
            } finally {
                root.deliveringResumeCallbacks = false;

                if (root.nextResumeCallbacks.length > 0) {
                    root.resumeCallbacks = root.nextResumeCallbacks;
                    root.nextResumeCallbacks = [];
                    resumeTimer.start();
                }
            }
        }
    }

    readonly property ShortcutHandler focusLeftShortcut: ShortcutHandler {
        name: "Driftile Focus Left"
        text: "Driftile: Focus left"
        sequence: "Meta+Ctrl+H"
        onActivated: Runtime.DriftileRuntime.focusLeft()
    }
    readonly property ShortcutHandler focusRightShortcut: ShortcutHandler {
        name: "Driftile Focus Right"
        text: "Driftile: Focus right"
        sequence: "Meta+Ctrl+L"
        onActivated: Runtime.DriftileRuntime.focusRight()
    }

    function createRect(x, y, width, height) {
        return Qt.rect(x, y, width, height);
    }

    function schedule(callback) {
        Qt.callLater(callback);
    }

    function scheduleResume(callback) {
        if (resumeTimer.running || root.deliveringResumeCallbacks) {
            root.nextResumeCallbacks.push(callback);
            return;
        }

        root.resumeCallbacks.push(callback);
        resumeTimer.start();
    }

    Component.onCompleted: Runtime.DriftileRuntime.init(Workspace, Workspace.MaximizeArea,
                                                        root.createRect, root.schedule,
                                                        root.scheduleResume)
    Component.onDestruction: Runtime.DriftileRuntime.destroy()
}
