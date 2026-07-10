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

    readonly property Timer topologyTimer: Timer {
        interval: 2000
        repeat: true
        running: true
        onTriggered: Runtime.DriftileRuntime.probeTopology()
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
    readonly property ShortcutHandler focusUpShortcut: ShortcutHandler {
        name: "Driftile Focus Up"
        text: "Driftile: Focus up"
        sequence: "Meta+Ctrl+K"
        onActivated: Runtime.DriftileRuntime.focusUp()
    }
    readonly property ShortcutHandler focusDownShortcut: ShortcutHandler {
        name: "Driftile Focus Down"
        text: "Driftile: Focus down"
        sequence: "Meta+Ctrl+J"
        onActivated: Runtime.DriftileRuntime.focusDown()
    }
    readonly property ShortcutHandler moveColumnLeftShortcut: ShortcutHandler {
        name: "Driftile Move Column Left"
        text: "Driftile: Move column left"
        sequence: "Meta+Ctrl+Shift+H"
        onActivated: Runtime.DriftileRuntime.moveColumnLeft()
    }
    readonly property ShortcutHandler moveColumnRightShortcut: ShortcutHandler {
        name: "Driftile Move Column Right"
        text: "Driftile: Move column right"
        sequence: "Meta+Ctrl+Shift+L"
        onActivated: Runtime.DriftileRuntime.moveColumnRight()
    }
    readonly property ShortcutHandler moveWindowLeftShortcut: ShortcutHandler {
        name: "Driftile Move Window Left"
        text: "Driftile: Move window left"
        sequence: "Meta+Ctrl+Alt+H"
        onActivated: Runtime.DriftileRuntime.moveWindowLeft()
    }
    readonly property ShortcutHandler moveWindowRightShortcut: ShortcutHandler {
        name: "Driftile Move Window Right"
        text: "Driftile: Move window right"
        sequence: "Meta+Ctrl+Alt+L"
        onActivated: Runtime.DriftileRuntime.moveWindowRight()
    }
    readonly property ShortcutHandler moveWindowUpShortcut: ShortcutHandler {
        name: "Driftile Move Window Up"
        text: "Driftile: Move window up"
        sequence: "Meta+Ctrl+Shift+K"
        onActivated: Runtime.DriftileRuntime.moveWindowUp()
    }
    readonly property ShortcutHandler moveWindowDownShortcut: ShortcutHandler {
        name: "Driftile Move Window Down"
        text: "Driftile: Move window down"
        sequence: "Meta+Ctrl+Shift+J"
        onActivated: Runtime.DriftileRuntime.moveWindowDown()
    }
    readonly property ShortcutHandler insertWindowIntoStackLeftShortcut: ShortcutHandler {
        name: "Driftile Insert Window into Stack Left"
        text: "Driftile: Insert window into stack left"
        sequence: "Meta+Ctrl+Alt+Shift+H"
        onActivated: Runtime.DriftileRuntime.insertWindowIntoStackLeft()
    }
    readonly property ShortcutHandler insertWindowIntoStackRightShortcut: ShortcutHandler {
        name: "Driftile Insert Window into Stack Right"
        text: "Driftile: Insert window into stack right"
        sequence: "Meta+Ctrl+Alt+Shift+L"
        onActivated: Runtime.DriftileRuntime.insertWindowIntoStackRight()
    }
    readonly property ShortcutHandler toggleFloatingShortcut: ShortcutHandler {
        name: "Driftile Toggle Floating"
        text: "Driftile: Toggle floating"
        sequence: "Meta+Ctrl+Space"
        onActivated: Runtime.DriftileRuntime.toggleFloating()
    }
    readonly property ShortcutHandler moveWindowToPreviousDesktopShortcut: ShortcutHandler {
        name: "Driftile Move Window to Previous Desktop"
        text: "Driftile: Move window to previous desktop"
        sequence: "Meta+Ctrl+Alt+K"
        onActivated: Runtime.DriftileRuntime.moveWindowToPreviousDesktop()
    }
    readonly property ShortcutHandler moveWindowToNextDesktopShortcut: ShortcutHandler {
        name: "Driftile Move Window to Next Desktop"
        text: "Driftile: Move window to next desktop"
        sequence: "Meta+Ctrl+Alt+J"
        onActivated: Runtime.DriftileRuntime.moveWindowToNextDesktop()
    }
    readonly property ShortcutHandler moveWindowToOutputLeftShortcut: ShortcutHandler {
        name: "Driftile Move Window to Output Left"
        text: "Driftile: Move window to output left"
        sequence: "Meta+Ctrl+Alt+Shift+Left"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputLeft()
    }
    readonly property ShortcutHandler moveWindowToOutputRightShortcut: ShortcutHandler {
        name: "Driftile Move Window to Output Right"
        text: "Driftile: Move window to output right"
        sequence: "Meta+Ctrl+Alt+Shift+Right"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputRight()
    }
    readonly property ShortcutHandler moveWindowToOutputUpShortcut: ShortcutHandler {
        name: "Driftile Move Window to Output Up"
        text: "Driftile: Move window to output up"
        sequence: "Meta+Ctrl+Alt+Shift+Up"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputUp()
    }
    readonly property ShortcutHandler moveWindowToOutputDownShortcut: ShortcutHandler {
        name: "Driftile Move Window to Output Down"
        text: "Driftile: Move window to output down"
        sequence: "Meta+Ctrl+Alt+Shift+Down"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputDown()
    }
    readonly property ShortcutHandler decreaseColumnWidthShortcut: ShortcutHandler {
        name: "Driftile Decrease Column Width"
        text: "Driftile: Decrease column width"
        sequence: "Meta+Ctrl+-"
        onActivated: Runtime.DriftileRuntime.decreaseColumnWidth()
    }
    readonly property ShortcutHandler increaseColumnWidthShortcut: ShortcutHandler {
        name: "Driftile Increase Column Width"
        text: "Driftile: Increase column width"
        sequence: "Meta+Ctrl+="
        onActivated: Runtime.DriftileRuntime.increaseColumnWidth()
    }
    readonly property ShortcutHandler resetColumnWidthShortcut: ShortcutHandler {
        name: "Driftile Reset Column Width"
        text: "Driftile: Reset column width"
        sequence: "Meta+Ctrl+0"
        onActivated: Runtime.DriftileRuntime.resetColumnWidth()
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
