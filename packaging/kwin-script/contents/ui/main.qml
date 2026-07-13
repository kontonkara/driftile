import QtCore
import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

    property bool deliveringResumeCallbacks: false
    property var nextResumeCallbacks: []
    property var resumeCallbacks: []

    readonly property LayoutStateStore layoutStateStore: LayoutStateStore {
        category: "Layout"
        key: "layout-v1"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-layout-state.ini"
    }

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
            Runtime.DriftileRuntime.applySettings(root.readSettings())
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
    readonly property ShortcutHandler focusFirstColumnShortcut: ShortcutHandler {
        name: "driftile_focus_column_first"
        text: "Driftile: Focus first column"
        sequence: "Meta+Home"
        onActivated: Runtime.DriftileRuntime.focusFirstColumn()
    }
    readonly property ShortcutHandler focusLastColumnShortcut: ShortcutHandler {
        name: "driftile_focus_column_last"
        text: "Driftile: Focus last column"
        sequence: "Meta+End"
        onActivated: Runtime.DriftileRuntime.focusLastColumn()
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
    readonly property ShortcutHandler moveColumnToFirstShortcut: ShortcutHandler {
        name: "driftile_move_column_to_first"
        text: "Driftile: Move column to first"
        sequence: "Meta+Ctrl+Home"
        onActivated: Runtime.DriftileRuntime.moveColumnToFirst()
    }
    readonly property ShortcutHandler moveColumnToLastShortcut: ShortcutHandler {
        name: "driftile_move_column_to_last"
        text: "Driftile: Move column to last"
        sequence: "Meta+Ctrl+End"
        onActivated: Runtime.DriftileRuntime.moveColumnToLast()
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
    readonly property ShortcutHandler consumeWindowIntoColumnShortcut: ShortcutHandler {
        name: "driftile_consume_window_into_column"
        text: "Driftile: Consume window into column"
        sequence: "Meta+,"
        onActivated: Runtime.DriftileRuntime.consumeWindowIntoColumn()
    }
    readonly property ShortcutHandler expelWindowFromColumnShortcut: ShortcutHandler {
        name: "driftile_expel_window_from_column"
        text: "Driftile: Expel window from column"
        sequence: "Meta+."
        onActivated: Runtime.DriftileRuntime.expelWindowFromColumn()
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
    readonly property ShortcutHandler switchLayerFocusShortcut: ShortcutHandler {
        name: "driftile_switch_focus_between_floating_and_tiling"
        text: "Driftile: Switch focus between floating and tiling"
        sequence: "Meta+Shift+V"
        onActivated: Runtime.DriftileRuntime.switchFocusBetweenFloatingAndTiling()
    }
    readonly property ShortcutHandler focusFloatingShortcut: ShortcutHandler {
        name: "driftile_focus_floating"
        text: "Driftile: Focus floating"
        onActivated: Runtime.DriftileRuntime.focusFloating()
    }
    readonly property ShortcutHandler focusTilingShortcut: ShortcutHandler {
        name: "driftile_focus_tiling"
        text: "Driftile: Focus tiling"
        onActivated: Runtime.DriftileRuntime.focusTiling()
    }
    readonly property ShortcutHandler toggleFullscreenShortcut: ShortcutHandler {
        name: "driftile_toggle_fullscreen"
        text: "Driftile: Toggle fullscreen"
        sequence: "Meta+Shift+F"
        onActivated: Runtime.DriftileRuntime.toggleFullscreen()
    }
    readonly property ShortcutHandler maximizeWindowToEdgesShortcut: ShortcutHandler {
        name: "driftile_maximize_window_to_edges"
        text: "Driftile: Maximize window to edges"
        sequence: "Meta+M"
        onActivated: Runtime.DriftileRuntime.maximizeWindowToEdges()
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
    readonly property ShortcutHandler moveDesktopDownShortcut: ShortcutHandler {
        name: "driftile_move_desktop_down"
        text: "Driftile: Move desktop down"
        sequence: "Meta+Shift+U"
        onActivated: Runtime.DriftileRuntime.moveDesktopDown()
    }
    readonly property ShortcutHandler moveDesktopDownPageShortcut: ShortcutHandler {
        name: "driftile_move_desktop_down_page_down"
        text: "Driftile: Move desktop down (Page Down)"
        sequence: "Meta+Shift+PgDown"
        onActivated: Runtime.DriftileRuntime.moveDesktopDown()
    }
    readonly property ShortcutHandler moveDesktopUpShortcut: ShortcutHandler {
        name: "driftile_move_desktop_up"
        text: "Driftile: Move desktop up"
        sequence: "Meta+Shift+I"
        onActivated: Runtime.DriftileRuntime.moveDesktopUp()
    }
    readonly property ShortcutHandler moveDesktopUpPageShortcut: ShortcutHandler {
        name: "driftile_move_desktop_up_page_up"
        text: "Driftile: Move desktop up (Page Up)"
        sequence: "Meta+Shift+PgUp"
        onActivated: Runtime.DriftileRuntime.moveDesktopUp()
    }
    readonly property ShortcutHandler focusDesktop1Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_1"
        text: "Driftile: Focus desktop 1"
        sequence: "Meta+1"
        onActivated: Runtime.DriftileRuntime.focusDesktop(1)
    }
    readonly property ShortcutHandler focusDesktop2Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_2"
        text: "Driftile: Focus desktop 2"
        sequence: "Meta+2"
        onActivated: Runtime.DriftileRuntime.focusDesktop(2)
    }
    readonly property ShortcutHandler focusDesktop3Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_3"
        text: "Driftile: Focus desktop 3"
        sequence: "Meta+3"
        onActivated: Runtime.DriftileRuntime.focusDesktop(3)
    }
    readonly property ShortcutHandler focusDesktop4Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_4"
        text: "Driftile: Focus desktop 4"
        sequence: "Meta+4"
        onActivated: Runtime.DriftileRuntime.focusDesktop(4)
    }
    readonly property ShortcutHandler focusDesktop5Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_5"
        text: "Driftile: Focus desktop 5"
        sequence: "Meta+5"
        onActivated: Runtime.DriftileRuntime.focusDesktop(5)
    }
    readonly property ShortcutHandler focusDesktop6Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_6"
        text: "Driftile: Focus desktop 6"
        sequence: "Meta+6"
        onActivated: Runtime.DriftileRuntime.focusDesktop(6)
    }
    readonly property ShortcutHandler focusDesktop7Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_7"
        text: "Driftile: Focus desktop 7"
        sequence: "Meta+7"
        onActivated: Runtime.DriftileRuntime.focusDesktop(7)
    }
    readonly property ShortcutHandler focusDesktop8Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_8"
        text: "Driftile: Focus desktop 8"
        sequence: "Meta+8"
        onActivated: Runtime.DriftileRuntime.focusDesktop(8)
    }
    readonly property ShortcutHandler focusDesktop9Shortcut: ShortcutHandler {
        name: "driftile_focus_desktop_9"
        text: "Driftile: Focus desktop 9"
        sequence: "Meta+9"
        onActivated: Runtime.DriftileRuntime.focusDesktop(9)
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
    readonly property ShortcutHandler moveColumnToDesktop1Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_1"
        text: "Driftile: Move column to desktop 1"
        sequence: "Meta+Ctrl+1"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(1)
    }
    readonly property ShortcutHandler moveColumnToDesktop2Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_2"
        text: "Driftile: Move column to desktop 2"
        sequence: "Meta+Ctrl+2"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(2)
    }
    readonly property ShortcutHandler moveColumnToDesktop3Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_3"
        text: "Driftile: Move column to desktop 3"
        sequence: "Meta+Ctrl+3"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(3)
    }
    readonly property ShortcutHandler moveColumnToDesktop4Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_4"
        text: "Driftile: Move column to desktop 4"
        sequence: "Meta+Ctrl+4"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(4)
    }
    readonly property ShortcutHandler moveColumnToDesktop5Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_5"
        text: "Driftile: Move column to desktop 5"
        sequence: "Meta+Ctrl+5"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(5)
    }
    readonly property ShortcutHandler moveColumnToDesktop6Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_6"
        text: "Driftile: Move column to desktop 6"
        sequence: "Meta+Ctrl+6"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(6)
    }
    readonly property ShortcutHandler moveColumnToDesktop7Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_7"
        text: "Driftile: Move column to desktop 7"
        sequence: "Meta+Ctrl+7"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(7)
    }
    readonly property ShortcutHandler moveColumnToDesktop8Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_8"
        text: "Driftile: Move column to desktop 8"
        sequence: "Meta+Ctrl+8"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(8)
    }
    readonly property ShortcutHandler moveColumnToDesktop9Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_desktop_9"
        text: "Driftile: Move column to desktop 9"
        sequence: "Meta+Ctrl+9"
        onActivated: Runtime.DriftileRuntime.moveColumnToDesktop(9)
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
    readonly property ShortcutHandler expandColumnToAvailableWidthShortcut: ShortcutHandler {
        name: "driftile_expand_column_to_available_width"
        text: "Driftile: Expand column to available width"
        sequence: "Meta+Ctrl+F"
        onActivated: Runtime.DriftileRuntime.expandColumnToAvailableWidth()
    }
    readonly property ShortcutHandler centerColumnShortcut: ShortcutHandler {
        name: "driftile_center_column"
        text: "Driftile: Center column"
        sequence: "Meta+C"
        onActivated: Runtime.DriftileRuntime.centerColumn()
    }
    readonly property ShortcutHandler centerVisibleColumnsShortcut: ShortcutHandler {
        name: "driftile_center_visible_columns"
        text: "Driftile: Center visible columns"
        sequence: "Meta+Ctrl+C"
        onActivated: Runtime.DriftileRuntime.centerVisibleColumns()
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
    // KGlobalAccel matches shifted punctuation by its produced symbol.
    readonly property ShortcutHandler decreaseWindowHeightShortcut: ShortcutHandler {
        name: "driftile_decrease_window_height"
        text: "Driftile: Decrease window height"
        sequence: "Meta+_"
        onActivated: Runtime.DriftileRuntime.decreaseWindowHeight()
    }
    readonly property ShortcutHandler increaseWindowHeightShortcut: ShortcutHandler {
        name: "driftile_increase_window_height"
        text: "Driftile: Increase window height"
        sequence: "Meta++"
        onActivated: Runtime.DriftileRuntime.increaseWindowHeight()
    }
    readonly property ShortcutHandler switchPresetWindowHeightShortcut: ShortcutHandler {
        name: "driftile_switch_preset_window_height"
        text: "Driftile: Switch preset window height"
        sequence: "Meta+Ctrl+Shift+R"
        onActivated: Runtime.DriftileRuntime.switchPresetWindowHeight()
    }
    readonly property ShortcutHandler switchPresetWindowHeightBackShortcut: ShortcutHandler {
        name: "driftile_switch_preset_window_height_back"
        text: "Driftile: Switch preset window height back"
        onActivated: Runtime.DriftileRuntime.switchPresetWindowHeightBack()
    }
    readonly property ShortcutHandler resetWindowHeightShortcut: ShortcutHandler {
        name: "driftile_reset_window_height"
        text: "Driftile: Reset window height"
        sequence: "Meta+Ctrl+R"
        onActivated: Runtime.DriftileRuntime.resetWindowHeight()
    }
    readonly property ShortcutHandler resetColumnWidthShortcut: ShortcutHandler {
        name: "driftile_reset_column_width"
        text: "Driftile: Reset column width"
        onActivated: Runtime.DriftileRuntime.resetColumnWidth()
    }

    function readSettings() {
        return {
            applicationColumnWidths: KWin.readConfig("ApplicationColumnWidths", ""),
            applicationTilingExclusions: KWin.readConfig("ApplicationTilingExclusions", ""),
            borderlessWindows: KWin.readConfig("BorderlessWindows", true),
            centerFocusedColumn: KWin.readConfig("CenterFocusedColumn", false),
            columnWidthPresets: KWin.readConfig("ColumnWidthPresets", ""),
            columnWidthStepPercent: KWin.readConfig("ColumnWidthStepPercent", 10),
            defaultColumnWidthPercent: KWin.readConfig("DefaultColumnWidthPercent", 50),
            gap: KWin.readConfig("Gap", 16),
            windowHeightStepPercent: KWin.readConfig("WindowHeightStepPercent", 10)
        };
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

    function queueLayoutState(canonicalState) {
        layoutStateStore.queue(canonicalState);
    }

    Component.onCompleted: {
        const loadedLayoutState = layoutStateStore.load();
        Runtime.DriftileRuntime.init(Workspace, Workspace.MaximizeArea,
                                    root.createRect, root.schedule,
                                    root.scheduleResume,
                                    root.readSettings(), loadedLayoutState,
                                    root.queueLayoutState);
    }
    Component.onDestruction: {
        try {
            Runtime.DriftileRuntime.flushLayoutState();
            layoutStateStore.flush();
        } finally {
            Runtime.DriftileRuntime.destroy();
        }
    }
}
