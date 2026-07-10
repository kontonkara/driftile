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

    readonly property Connections configurationConnection: Connections {
        target: Options

        function onConfigChanged() {
            Runtime.DriftileRuntime.setBorderlessWindows(
                KWin.readConfig("BorderlessWindows", true))
        }
    }

    readonly property Timer topologyTimer: Timer {
        interval: 2000
        repeat: true
        running: true
        onTriggered: Runtime.DriftileRuntime.probeTopology()
    }

    readonly property ShortcutHandler focusLeftShortcut: ShortcutHandler {
        name: "driftile_focus_column_left"
        text: "Driftile: Focus left"
        sequence: "Meta+H"
        onActivated: Runtime.DriftileRuntime.focusLeft()
    }
    readonly property ShortcutHandler focusLeftArrowShortcut: ShortcutHandler {
        name: "driftile_focus_column_left_arrow"
        text: "Driftile: Focus left (arrow)"
        sequence: "Meta+Left"
        onActivated: Runtime.DriftileRuntime.focusLeft()
    }
    readonly property ShortcutHandler focusRightShortcut: ShortcutHandler {
        name: "driftile_focus_column_right"
        text: "Driftile: Focus right"
        sequence: "Meta+L"
        onActivated: Runtime.DriftileRuntime.focusRight()
    }
    readonly property ShortcutHandler focusRightArrowShortcut: ShortcutHandler {
        name: "driftile_focus_column_right_arrow"
        text: "Driftile: Focus right (arrow)"
        sequence: "Meta+Right"
        onActivated: Runtime.DriftileRuntime.focusRight()
    }
    readonly property ShortcutHandler focusUpShortcut: ShortcutHandler {
        name: "driftile_focus_window_up"
        text: "Driftile: Focus up"
        sequence: "Meta+K"
        onActivated: Runtime.DriftileRuntime.focusUp()
    }
    readonly property ShortcutHandler focusUpArrowShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_arrow"
        text: "Driftile: Focus up (arrow)"
        sequence: "Meta+Up"
        onActivated: Runtime.DriftileRuntime.focusUp()
    }
    readonly property ShortcutHandler focusDownShortcut: ShortcutHandler {
        name: "driftile_focus_window_down"
        text: "Driftile: Focus down"
        sequence: "Meta+J"
        onActivated: Runtime.DriftileRuntime.focusDown()
    }
    readonly property ShortcutHandler focusDownArrowShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_arrow"
        text: "Driftile: Focus down (arrow)"
        sequence: "Meta+Down"
        onActivated: Runtime.DriftileRuntime.focusDown()
    }
    readonly property ShortcutHandler moveColumnLeftShortcut: ShortcutHandler {
        name: "driftile_move_column_left"
        text: "Driftile: Move column left"
        sequence: "Meta+Ctrl+H"
        onActivated: Runtime.DriftileRuntime.moveColumnLeft()
    }
    readonly property ShortcutHandler moveColumnLeftArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_left_arrow"
        text: "Driftile: Move column left (arrow)"
        sequence: "Meta+Ctrl+Left"
        onActivated: Runtime.DriftileRuntime.moveColumnLeft()
    }
    readonly property ShortcutHandler moveColumnRightShortcut: ShortcutHandler {
        name: "driftile_move_column_right"
        text: "Driftile: Move column right"
        sequence: "Meta+Ctrl+L"
        onActivated: Runtime.DriftileRuntime.moveColumnRight()
    }
    readonly property ShortcutHandler moveColumnRightArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_right_arrow"
        text: "Driftile: Move column right (arrow)"
        sequence: "Meta+Ctrl+Right"
        onActivated: Runtime.DriftileRuntime.moveColumnRight()
    }
    readonly property ShortcutHandler moveWindowLeftShortcut: ShortcutHandler {
        name: "driftile_move_window_left"
        text: "Driftile: Consume or expel window left"
        sequence: "Meta+["
        onActivated: Runtime.DriftileRuntime.moveWindowLeft()
    }
    readonly property ShortcutHandler moveWindowRightShortcut: ShortcutHandler {
        name: "driftile_move_window_right"
        text: "Driftile: Consume or expel window right"
        sequence: "Meta+]"
        onActivated: Runtime.DriftileRuntime.moveWindowRight()
    }
    readonly property ShortcutHandler moveWindowUpShortcut: ShortcutHandler {
        name: "driftile_move_window_up"
        text: "Driftile: Move window up"
        sequence: "Meta+Ctrl+K"
        onActivated: Runtime.DriftileRuntime.moveWindowUp()
    }
    readonly property ShortcutHandler moveWindowUpArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_up_arrow"
        text: "Driftile: Move window up (arrow)"
        sequence: "Meta+Ctrl+Up"
        onActivated: Runtime.DriftileRuntime.moveWindowUp()
    }
    readonly property ShortcutHandler moveWindowDownShortcut: ShortcutHandler {
        name: "driftile_move_window_down"
        text: "Driftile: Move window down"
        sequence: "Meta+Ctrl+J"
        onActivated: Runtime.DriftileRuntime.moveWindowDown()
    }
    readonly property ShortcutHandler moveWindowDownArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_down_arrow"
        text: "Driftile: Move window down (arrow)"
        sequence: "Meta+Ctrl+Down"
        onActivated: Runtime.DriftileRuntime.moveWindowDown()
    }
    readonly property ShortcutHandler insertWindowIntoStackLeftShortcut: ShortcutHandler {
        name: "driftile_insert_window_into_stack_left"
        text: "Driftile: Insert window into stack left"
        onActivated: Runtime.DriftileRuntime.insertWindowIntoStackLeft()
    }
    readonly property ShortcutHandler insertWindowIntoStackRightShortcut: ShortcutHandler {
        name: "driftile_insert_window_into_stack_right"
        text: "Driftile: Insert window into stack right"
        onActivated: Runtime.DriftileRuntime.insertWindowIntoStackRight()
    }
    readonly property ShortcutHandler toggleFloatingShortcut: ShortcutHandler {
        name: "driftile_toggle_floating"
        text: "Driftile: Toggle floating"
        sequence: "Meta+V"
        onActivated: Runtime.DriftileRuntime.toggleFloating()
    }
    readonly property ShortcutHandler focusPreviousDesktopShortcut: ShortcutHandler {
        name: "driftile_focus_previous_desktop"
        text: "Driftile: Focus previous desktop"
        sequence: "Meta+I"
        onActivated: Runtime.DriftileRuntime.focusPreviousDesktop()
    }
    readonly property ShortcutHandler focusPreviousDesktopPageShortcut: ShortcutHandler {
        name: "driftile_focus_previous_desktop_page_up"
        text: "Driftile: Focus previous desktop (Page Up)"
        sequence: "Meta+PgUp"
        onActivated: Runtime.DriftileRuntime.focusPreviousDesktop()
    }
    readonly property ShortcutHandler focusNextDesktopShortcut: ShortcutHandler {
        name: "driftile_focus_next_desktop"
        text: "Driftile: Focus next desktop"
        sequence: "Meta+U"
        onActivated: Runtime.DriftileRuntime.focusNextDesktop()
    }
    readonly property ShortcutHandler focusNextDesktopPageShortcut: ShortcutHandler {
        name: "driftile_focus_next_desktop_page_down"
        text: "Driftile: Focus next desktop (Page Down)"
        sequence: "Meta+PgDown"
        onActivated: Runtime.DriftileRuntime.focusNextDesktop()
    }
    readonly property ShortcutHandler moveColumnToPreviousDesktopShortcut: ShortcutHandler {
        name: "driftile_move_column_to_previous_desktop"
        text: "Driftile: Move column to previous desktop"
        sequence: "Meta+Ctrl+I"
        onActivated: Runtime.DriftileRuntime.moveColumnToPreviousDesktop()
    }
    readonly property ShortcutHandler moveColumnToPreviousDesktopPageShortcut: ShortcutHandler {
        name: "driftile_move_column_to_previous_desktop_page_up"
        text: "Driftile: Move column to previous desktop (Page Up)"
        sequence: "Meta+Ctrl+PgUp"
        onActivated: Runtime.DriftileRuntime.moveColumnToPreviousDesktop()
    }
    readonly property ShortcutHandler moveColumnToNextDesktopShortcut: ShortcutHandler {
        name: "driftile_move_column_to_next_desktop"
        text: "Driftile: Move column to next desktop"
        sequence: "Meta+Ctrl+U"
        onActivated: Runtime.DriftileRuntime.moveColumnToNextDesktop()
    }
    readonly property ShortcutHandler moveColumnToNextDesktopPageShortcut: ShortcutHandler {
        name: "driftile_move_column_to_next_desktop_page_down"
        text: "Driftile: Move column to next desktop (Page Down)"
        sequence: "Meta+Ctrl+PgDown"
        onActivated: Runtime.DriftileRuntime.moveColumnToNextDesktop()
    }
    readonly property ShortcutHandler moveWindowToPreviousDesktopShortcut: ShortcutHandler {
        name: "driftile_move_window_to_previous_desktop"
        text: "Driftile: Move window to previous desktop"
        onActivated: Runtime.DriftileRuntime.moveWindowToPreviousDesktop()
    }
    readonly property ShortcutHandler moveWindowToPreviousDesktopPageShortcut: ShortcutHandler {
        name: "driftile_move_window_to_previous_desktop_page_up"
        text: "Driftile: Move window to previous desktop (Page Up)"
        onActivated: Runtime.DriftileRuntime.moveWindowToPreviousDesktop()
    }
    readonly property ShortcutHandler moveWindowToNextDesktopShortcut: ShortcutHandler {
        name: "driftile_move_window_to_next_desktop"
        text: "Driftile: Move window to next desktop"
        onActivated: Runtime.DriftileRuntime.moveWindowToNextDesktop()
    }
    readonly property ShortcutHandler moveWindowToNextDesktopPageShortcut: ShortcutHandler {
        name: "driftile_move_window_to_next_desktop_page_down"
        text: "Driftile: Move window to next desktop (Page Down)"
        onActivated: Runtime.DriftileRuntime.moveWindowToNextDesktop()
    }
    readonly property ShortcutHandler focusOutputLeftShortcut: ShortcutHandler {
        name: "driftile_focus_output_left"
        text: "Driftile: Focus output left"
        sequence: "Meta+Shift+H"
        onActivated: Workspace.slotSwitchToLeftScreen()
    }
    readonly property ShortcutHandler focusOutputLeftArrowShortcut: ShortcutHandler {
        name: "driftile_focus_output_left_arrow"
        text: "Driftile: Focus output left (arrow)"
        sequence: "Meta+Shift+Left"
        onActivated: Workspace.slotSwitchToLeftScreen()
    }
    readonly property ShortcutHandler focusOutputRightShortcut: ShortcutHandler {
        name: "driftile_focus_output_right"
        text: "Driftile: Focus output right"
        sequence: "Meta+Shift+L"
        onActivated: Workspace.slotSwitchToRightScreen()
    }
    readonly property ShortcutHandler focusOutputRightArrowShortcut: ShortcutHandler {
        name: "driftile_focus_output_right_arrow"
        text: "Driftile: Focus output right (arrow)"
        sequence: "Meta+Shift+Right"
        onActivated: Workspace.slotSwitchToRightScreen()
    }
    readonly property ShortcutHandler focusOutputUpShortcut: ShortcutHandler {
        name: "driftile_focus_output_up"
        text: "Driftile: Focus output up"
        sequence: "Meta+Shift+K"
        onActivated: Workspace.slotSwitchToAboveScreen()
    }
    readonly property ShortcutHandler focusOutputUpArrowShortcut: ShortcutHandler {
        name: "driftile_focus_output_up_arrow"
        text: "Driftile: Focus output up (arrow)"
        sequence: "Meta+Shift+Up"
        onActivated: Workspace.slotSwitchToAboveScreen()
    }
    readonly property ShortcutHandler focusOutputDownShortcut: ShortcutHandler {
        name: "driftile_focus_output_down"
        text: "Driftile: Focus output down"
        sequence: "Meta+Shift+J"
        onActivated: Workspace.slotSwitchToBelowScreen()
    }
    readonly property ShortcutHandler focusOutputDownArrowShortcut: ShortcutHandler {
        name: "driftile_focus_output_down_arrow"
        text: "Driftile: Focus output down (arrow)"
        sequence: "Meta+Shift+Down"
        onActivated: Workspace.slotSwitchToBelowScreen()
    }
    readonly property ShortcutHandler moveColumnToOutputLeftShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_left"
        text: "Driftile: Move column to output left"
        sequence: "Meta+Ctrl+Shift+H"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputLeft()
    }
    readonly property ShortcutHandler moveColumnToOutputLeftArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_left_arrow"
        text: "Driftile: Move column to output left (arrow)"
        sequence: "Meta+Ctrl+Shift+Left"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputLeft()
    }
    readonly property ShortcutHandler moveColumnToOutputRightShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_right"
        text: "Driftile: Move column to output right"
        sequence: "Meta+Ctrl+Shift+L"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputRight()
    }
    readonly property ShortcutHandler moveColumnToOutputRightArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_right_arrow"
        text: "Driftile: Move column to output right (arrow)"
        sequence: "Meta+Ctrl+Shift+Right"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputRight()
    }
    readonly property ShortcutHandler moveColumnToOutputUpShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_up"
        text: "Driftile: Move column to output up"
        sequence: "Meta+Ctrl+Shift+K"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputUp()
    }
    readonly property ShortcutHandler moveColumnToOutputUpArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_up_arrow"
        text: "Driftile: Move column to output up (arrow)"
        sequence: "Meta+Ctrl+Shift+Up"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputUp()
    }
    readonly property ShortcutHandler moveColumnToOutputDownShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_down"
        text: "Driftile: Move column to output down"
        sequence: "Meta+Ctrl+Shift+J"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputDown()
    }
    readonly property ShortcutHandler moveColumnToOutputDownArrowShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_down_arrow"
        text: "Driftile: Move column to output down (arrow)"
        sequence: "Meta+Ctrl+Shift+Down"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputDown()
    }
    readonly property ShortcutHandler moveWindowToOutputLeftShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_left"
        text: "Driftile: Move window to output left"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputLeft()
    }
    readonly property ShortcutHandler moveWindowToOutputLeftArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_left_arrow"
        text: "Driftile: Move window to output left (arrow)"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputLeft()
    }
    readonly property ShortcutHandler moveWindowToOutputRightShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_right"
        text: "Driftile: Move window to output right"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputRight()
    }
    readonly property ShortcutHandler moveWindowToOutputRightArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_right_arrow"
        text: "Driftile: Move window to output right (arrow)"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputRight()
    }
    readonly property ShortcutHandler moveWindowToOutputUpShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_up"
        text: "Driftile: Move window to output up"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputUp()
    }
    readonly property ShortcutHandler moveWindowToOutputUpArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_up_arrow"
        text: "Driftile: Move window to output up (arrow)"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputUp()
    }
    readonly property ShortcutHandler moveWindowToOutputDownShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_down"
        text: "Driftile: Move window to output down"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputDown()
    }
    readonly property ShortcutHandler moveWindowToOutputDownArrowShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_down_arrow"
        text: "Driftile: Move window to output down (arrow)"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputDown()
    }
    readonly property ShortcutHandler switchPresetColumnWidthShortcut: ShortcutHandler {
        name: "driftile_switch_preset_column_width"
        text: "Driftile: Switch preset column width"
        sequence: "Meta+R"
        onActivated: Runtime.DriftileRuntime.switchPresetColumnWidth()
    }
    readonly property ShortcutHandler switchPresetColumnWidthBackShortcut: ShortcutHandler {
        name: "driftile_switch_preset_column_width_back"
        text: "Driftile: Switch preset column width back"
        sequence: "Meta+Shift+R"
        onActivated: Runtime.DriftileRuntime.switchPresetColumnWidthBack()
    }
    readonly property ShortcutHandler maximizeColumnShortcut: ShortcutHandler {
        name: "driftile_maximize_column"
        text: "Driftile: Maximize column"
        sequence: "Meta+F"
        onActivated: Runtime.DriftileRuntime.maximizeColumn()
    }
    readonly property ShortcutHandler centerColumnShortcut: ShortcutHandler {
        name: "driftile_center_column"
        text: "Driftile: Center column"
        sequence: "Meta+C"
        onActivated: Runtime.DriftileRuntime.centerColumn()
    }
    readonly property ShortcutHandler decreaseColumnWidthShortcut: ShortcutHandler {
        name: "driftile_decrease_column_width"
        text: "Driftile: Decrease column width"
        sequence: "Meta+-"
        onActivated: Runtime.DriftileRuntime.decreaseColumnWidth()
    }
    readonly property ShortcutHandler increaseColumnWidthShortcut: ShortcutHandler {
        name: "driftile_increase_column_width"
        text: "Driftile: Increase column width"
        sequence: "Meta+="
        onActivated: Runtime.DriftileRuntime.increaseColumnWidth()
    }
    readonly property ShortcutHandler increaseColumnWidthPlusShortcut: ShortcutHandler {
        name: "driftile_increase_column_width_plus"
        text: "Driftile: Increase column width (plus)"
        sequence: "Meta++"
        onActivated: Runtime.DriftileRuntime.increaseColumnWidth()
    }
    readonly property ShortcutHandler resetColumnWidthShortcut: ShortcutHandler {
        name: "driftile_reset_column_width"
        text: "Driftile: Reset column width"
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
                                                        root.scheduleResume,
                                                        KWin.readConfig("BorderlessWindows", true))
    Component.onDestruction: Runtime.DriftileRuntime.destroy()
}
