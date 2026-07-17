import QtCore
import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

    property bool deliveringResumeCallbacks: false
    property var nextResumeCallbacks: []
    property var resumeCallbacks: []
    property bool appliedTouchpadNavigation: false
    property bool appliedTouchpadWorkspaceNavigation: false
    property int appliedTouchpadNavigationFingerCount: 5
    property bool appliedTouchpadNaturalScroll: true
    property bool dropPreviewVisible: false
    property real dropPreviewX: 0
    property real dropPreviewY: 0
    property real dropPreviewWidth: 0
    property real dropPreviewHeight: 0
    property string dropPreviewDestinationKey: ""
    property string dropPreviewOwnerToken: ""

    readonly property LayoutStateStore layoutStateStore: LayoutStateStore {
        category: "Layout"
        key: "layout-v1"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-layout-state.ini"
    }

    readonly property DBusCall tabIndicatorCall: DBusCall {
        service: "org.kde.plasmashell"
        path: "/org/kde/osdService"
        dbusInterface: "org.kde.osdService"
        method: "showText"
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
            root.applySettings(root.readSettings())
        }
    }

    readonly property Loader touchpadNavigationLoader: Loader {
        active: false
    }

    readonly property Connections touchpadNavigationConnection: Connections {
        ignoreUnknownSignals: true
        target: touchpadNavigationLoader.item

        function onFocusLeftRequested() {
            Runtime.DriftileRuntime.focusLeft()
        }

        function onFocusRightRequested() {
            Runtime.DriftileRuntime.focusRight()
        }
    }

    readonly property Loader touchpadWorkspaceNavigationLoader: Loader {
        active: false
    }

    readonly property Connections touchpadWorkspaceNavigationConnection: Connections {
        ignoreUnknownSignals: true
        target: touchpadWorkspaceNavigationLoader.item

        function onFocusPreviousDesktopRequested() {
            Runtime.DriftileRuntime.focusPreviousDesktopUnderPointer()
        }

        function onFocusNextDesktopRequested() {
            Runtime.DriftileRuntime.focusNextDesktopUnderPointer()
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
    readonly property ShortcutHandler focusColumnOrOutputLeftShortcut: ShortcutHandler {
        name: "driftile_focus_column_or_output_left"
        text: "Driftile: Focus column or output left"
        onActivated: Runtime.DriftileRuntime.focusColumnOrOutputLeft()
    }
    readonly property ShortcutHandler focusColumnOrOutputRightShortcut: ShortcutHandler {
        name: "driftile_focus_column_or_output_right"
        text: "Driftile: Focus column or output right"
        onActivated: Runtime.DriftileRuntime.focusColumnOrOutputRight()
    }
    readonly property ShortcutHandler focusColumnRightOrFirstShortcut: ShortcutHandler {
        name: "driftile_focus_column_right_or_first"
        text: "Driftile: Focus column right or first"
        onActivated: Runtime.DriftileRuntime.focusColumnRightOrFirst()
    }
    readonly property ShortcutHandler focusColumnLeftOrLastShortcut: ShortcutHandler {
        name: "driftile_focus_column_left_or_last"
        text: "Driftile: Focus column left or last"
        onActivated: Runtime.DriftileRuntime.focusColumnLeftOrLast()
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
    readonly property ShortcutHandler focusColumn1Shortcut: ShortcutHandler {
        name: "driftile_focus_column_1"
        text: "Driftile: Focus column 1"
        onActivated: Runtime.DriftileRuntime.focusColumn(1)
    }
    readonly property ShortcutHandler focusColumn2Shortcut: ShortcutHandler {
        name: "driftile_focus_column_2"
        text: "Driftile: Focus column 2"
        onActivated: Runtime.DriftileRuntime.focusColumn(2)
    }
    readonly property ShortcutHandler focusColumn3Shortcut: ShortcutHandler {
        name: "driftile_focus_column_3"
        text: "Driftile: Focus column 3"
        onActivated: Runtime.DriftileRuntime.focusColumn(3)
    }
    readonly property ShortcutHandler focusColumn4Shortcut: ShortcutHandler {
        name: "driftile_focus_column_4"
        text: "Driftile: Focus column 4"
        onActivated: Runtime.DriftileRuntime.focusColumn(4)
    }
    readonly property ShortcutHandler focusColumn5Shortcut: ShortcutHandler {
        name: "driftile_focus_column_5"
        text: "Driftile: Focus column 5"
        onActivated: Runtime.DriftileRuntime.focusColumn(5)
    }
    readonly property ShortcutHandler focusColumn6Shortcut: ShortcutHandler {
        name: "driftile_focus_column_6"
        text: "Driftile: Focus column 6"
        onActivated: Runtime.DriftileRuntime.focusColumn(6)
    }
    readonly property ShortcutHandler focusColumn7Shortcut: ShortcutHandler {
        name: "driftile_focus_column_7"
        text: "Driftile: Focus column 7"
        onActivated: Runtime.DriftileRuntime.focusColumn(7)
    }
    readonly property ShortcutHandler focusColumn8Shortcut: ShortcutHandler {
        name: "driftile_focus_column_8"
        text: "Driftile: Focus column 8"
        onActivated: Runtime.DriftileRuntime.focusColumn(8)
    }
    readonly property ShortcutHandler focusColumn9Shortcut: ShortcutHandler {
        name: "driftile_focus_column_9"
        text: "Driftile: Focus column 9"
        onActivated: Runtime.DriftileRuntime.focusColumn(9)
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
    readonly property ShortcutHandler focusUpOrPreviousDesktopShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_or_previous_desktop"
        text: "Driftile: Focus up or previous desktop"
        onActivated: Runtime.DriftileRuntime.focusUpOrPreviousDesktop()
    }
    readonly property ShortcutHandler focusDownOrNextDesktopShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_or_next_desktop"
        text: "Driftile: Focus down or next desktop"
        onActivated: Runtime.DriftileRuntime.focusDownOrNextDesktop()
    }
    readonly property ShortcutHandler focusWindowOrOutputUpShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_or_output_up"
        text: "Driftile: Focus window or output up"
        onActivated: Runtime.DriftileRuntime.focusWindowOrOutputUp()
    }
    readonly property ShortcutHandler focusWindowOrOutputDownShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_or_output_down"
        text: "Driftile: Focus window or output down"
        onActivated: Runtime.DriftileRuntime.focusWindowOrOutputDown()
    }
    readonly property ShortcutHandler focusWindowDownOrColumnLeftShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_or_column_left"
        text: "Driftile: Focus down or column left"
        onActivated: Runtime.DriftileRuntime.focusWindowDownOrColumnLeft()
    }
    readonly property ShortcutHandler focusWindowDownOrColumnRightShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_or_column_right"
        text: "Driftile: Focus down or column right"
        onActivated: Runtime.DriftileRuntime.focusWindowDownOrColumnRight()
    }
    readonly property ShortcutHandler focusWindowUpOrColumnLeftShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_or_column_left"
        text: "Driftile: Focus up or column left"
        onActivated: Runtime.DriftileRuntime.focusWindowUpOrColumnLeft()
    }
    readonly property ShortcutHandler focusWindowUpOrColumnRightShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_or_column_right"
        text: "Driftile: Focus up or column right"
        onActivated: Runtime.DriftileRuntime.focusWindowUpOrColumnRight()
    }
    readonly property ShortcutHandler focusWindowTopShortcut: ShortcutHandler {
        name: "driftile_focus_window_top"
        text: "Driftile: Focus top window"
        onActivated: Runtime.DriftileRuntime.focusWindowTop()
    }
    readonly property ShortcutHandler focusWindowBottomShortcut: ShortcutHandler {
        name: "driftile_focus_window_bottom"
        text: "Driftile: Focus bottom window"
        onActivated: Runtime.DriftileRuntime.focusWindowBottom()
    }
    readonly property ShortcutHandler focusWindowDownOrTopShortcut: ShortcutHandler {
        name: "driftile_focus_window_down_or_top"
        text: "Driftile: Focus down or top"
        onActivated: Runtime.DriftileRuntime.focusWindowDownOrTop()
    }
    readonly property ShortcutHandler focusWindowUpOrBottomShortcut: ShortcutHandler {
        name: "driftile_focus_window_up_or_bottom"
        text: "Driftile: Focus up or bottom"
        onActivated: Runtime.DriftileRuntime.focusWindowUpOrBottom()
    }
    readonly property ShortcutHandler focusWindowInColumn1Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_1"
        text: "Driftile: Focus window 1 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(1)
    }
    readonly property ShortcutHandler focusWindowInColumn2Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_2"
        text: "Driftile: Focus window 2 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(2)
    }
    readonly property ShortcutHandler focusWindowInColumn3Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_3"
        text: "Driftile: Focus window 3 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(3)
    }
    readonly property ShortcutHandler focusWindowInColumn4Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_4"
        text: "Driftile: Focus window 4 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(4)
    }
    readonly property ShortcutHandler focusWindowInColumn5Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_5"
        text: "Driftile: Focus window 5 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(5)
    }
    readonly property ShortcutHandler focusWindowInColumn6Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_6"
        text: "Driftile: Focus window 6 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(6)
    }
    readonly property ShortcutHandler focusWindowInColumn7Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_7"
        text: "Driftile: Focus window 7 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(7)
    }
    readonly property ShortcutHandler focusWindowInColumn8Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_8"
        text: "Driftile: Focus window 8 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(8)
    }
    readonly property ShortcutHandler focusWindowInColumn9Shortcut: ShortcutHandler {
        name: "driftile_focus_window_in_column_9"
        text: "Driftile: Focus window 9 in column"
        onActivated: Runtime.DriftileRuntime.focusWindowInColumn(9)
    }
    readonly property ShortcutHandler focusWindowPreviousShortcut: ShortcutHandler {
        name: "driftile_focus_window_previous"
        text: "Driftile: Focus previous window"
        onActivated: Runtime.DriftileRuntime.focusWindowPrevious()
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
    readonly property ShortcutHandler moveColumnLeftOrToOutputLeftShortcut: ShortcutHandler {
        name: "driftile_move_column_left_or_to_output_left"
        text: "Driftile: Move column left or to output left"
        onActivated: Runtime.DriftileRuntime.moveColumnLeftOrToOutputLeft()
    }
    readonly property ShortcutHandler moveColumnRightOrToOutputRightShortcut: ShortcutHandler {
        name: "driftile_move_column_right_or_to_output_right"
        text: "Driftile: Move column right or to output right"
        onActivated: Runtime.DriftileRuntime.moveColumnRightOrToOutputRight()
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
    readonly property ShortcutHandler moveColumnToIndex1Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_1"
        text: "Driftile: Move column to position 1"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(1)
    }
    readonly property ShortcutHandler moveColumnToIndex2Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_2"
        text: "Driftile: Move column to position 2"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(2)
    }
    readonly property ShortcutHandler moveColumnToIndex3Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_3"
        text: "Driftile: Move column to position 3"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(3)
    }
    readonly property ShortcutHandler moveColumnToIndex4Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_4"
        text: "Driftile: Move column to position 4"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(4)
    }
    readonly property ShortcutHandler moveColumnToIndex5Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_5"
        text: "Driftile: Move column to position 5"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(5)
    }
    readonly property ShortcutHandler moveColumnToIndex6Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_6"
        text: "Driftile: Move column to position 6"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(6)
    }
    readonly property ShortcutHandler moveColumnToIndex7Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_7"
        text: "Driftile: Move column to position 7"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(7)
    }
    readonly property ShortcutHandler moveColumnToIndex8Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_8"
        text: "Driftile: Move column to position 8"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(8)
    }
    readonly property ShortcutHandler moveColumnToIndex9Shortcut: ShortcutHandler {
        name: "driftile_move_column_to_index_9"
        text: "Driftile: Move column to position 9"
        onActivated: Runtime.DriftileRuntime.moveColumnToIndex(9)
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
    readonly property ShortcutHandler swapWindowLeftShortcut: ShortcutHandler {
        name: "driftile_swap_window_left"
        text: "Driftile: Swap window left"
        onActivated: Runtime.DriftileRuntime.swapWindowLeft()
    }
    readonly property ShortcutHandler swapWindowRightShortcut: ShortcutHandler {
        name: "driftile_swap_window_right"
        text: "Driftile: Swap window right"
        onActivated: Runtime.DriftileRuntime.swapWindowRight()
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
    readonly property ShortcutHandler moveWindowUpOrToPreviousDesktopShortcut: ShortcutHandler {
        name: "driftile_move_window_up_or_to_previous_desktop"
        text: "Driftile: Move window up or to previous desktop"
        onActivated: Runtime.DriftileRuntime.moveWindowUpOrToPreviousDesktop()
    }
    readonly property ShortcutHandler moveWindowDownOrToNextDesktopShortcut: ShortcutHandler {
        name: "driftile_move_window_down_or_to_next_desktop"
        text: "Driftile: Move window down or to next desktop"
        onActivated: Runtime.DriftileRuntime.moveWindowDownOrToNextDesktop()
    }
    readonly property ShortcutHandler moveWindowUpOrToOutputUpShortcut: ShortcutHandler {
        name: "driftile_move_window_up_or_to_output_up"
        text: "Driftile: Move window up or to output up"
        onActivated: Runtime.DriftileRuntime.moveWindowUpOrToOutputUp()
    }
    readonly property ShortcutHandler moveWindowDownOrToOutputDownShortcut: ShortcutHandler {
        name: "driftile_move_window_down_or_to_output_down"
        text: "Driftile: Move window down or to output down"
        onActivated: Runtime.DriftileRuntime.moveWindowDownOrToOutputDown()
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
    readonly property ShortcutHandler moveWindowToFloatingShortcut: ShortcutHandler {
        name: "driftile_move_window_to_floating"
        text: "Driftile: Move window to floating"
        onActivated: Runtime.DriftileRuntime.moveWindowToFloating()
    }
    readonly property ShortcutHandler moveWindowToTilingShortcut: ShortcutHandler {
        name: "driftile_move_window_to_tiling"
        text: "Driftile: Move window to tiling"
        onActivated: Runtime.DriftileRuntime.moveWindowToTiling()
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
    readonly property ShortcutHandler focusLastUsedDesktopShortcut: ShortcutHandler {
        name: "driftile_focus_last_used_desktop"
        text: "Driftile: Focus last-used desktop"
        onActivated: Runtime.DriftileRuntime.focusLastUsedDesktop()
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
    readonly property ShortcutHandler moveDesktopToIndex1Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_1"
        text: "Driftile: Move desktop to position 1"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(1)
    }
    readonly property ShortcutHandler moveDesktopToIndex2Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_2"
        text: "Driftile: Move desktop to position 2"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(2)
    }
    readonly property ShortcutHandler moveDesktopToIndex3Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_3"
        text: "Driftile: Move desktop to position 3"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(3)
    }
    readonly property ShortcutHandler moveDesktopToIndex4Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_4"
        text: "Driftile: Move desktop to position 4"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(4)
    }
    readonly property ShortcutHandler moveDesktopToIndex5Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_5"
        text: "Driftile: Move desktop to position 5"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(5)
    }
    readonly property ShortcutHandler moveDesktopToIndex6Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_6"
        text: "Driftile: Move desktop to position 6"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(6)
    }
    readonly property ShortcutHandler moveDesktopToIndex7Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_7"
        text: "Driftile: Move desktop to position 7"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(7)
    }
    readonly property ShortcutHandler moveDesktopToIndex8Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_8"
        text: "Driftile: Move desktop to position 8"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(8)
    }
    readonly property ShortcutHandler moveDesktopToIndex9Shortcut: ShortcutHandler {
        name: "driftile_move_desktop_to_index_9"
        text: "Driftile: Move desktop to position 9"
        onActivated: Runtime.DriftileRuntime.moveDesktopToIndex(9)
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
    readonly property ShortcutHandler moveWindowToDesktop1Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_1"
        text: "Driftile: Move window to desktop 1"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(1)
    }
    readonly property ShortcutHandler moveWindowToDesktop2Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_2"
        text: "Driftile: Move window to desktop 2"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(2)
    }
    readonly property ShortcutHandler moveWindowToDesktop3Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_3"
        text: "Driftile: Move window to desktop 3"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(3)
    }
    readonly property ShortcutHandler moveWindowToDesktop4Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_4"
        text: "Driftile: Move window to desktop 4"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(4)
    }
    readonly property ShortcutHandler moveWindowToDesktop5Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_5"
        text: "Driftile: Move window to desktop 5"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(5)
    }
    readonly property ShortcutHandler moveWindowToDesktop6Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_6"
        text: "Driftile: Move window to desktop 6"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(6)
    }
    readonly property ShortcutHandler moveWindowToDesktop7Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_7"
        text: "Driftile: Move window to desktop 7"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(7)
    }
    readonly property ShortcutHandler moveWindowToDesktop8Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_8"
        text: "Driftile: Move window to desktop 8"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(8)
    }
    readonly property ShortcutHandler moveWindowToDesktop9Shortcut: ShortcutHandler {
        name: "driftile_move_window_to_desktop_9"
        text: "Driftile: Move window to desktop 9"
        onActivated: Runtime.DriftileRuntime.moveWindowToDesktop(9)
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
    readonly property ShortcutHandler focusOutputPreviousShortcut: ShortcutHandler {
        name: "driftile_focus_output_previous"
        text: "Driftile: Focus previous output"
        onActivated: Workspace.slotSwitchToPrevScreen()
    }
    readonly property ShortcutHandler focusOutputNextShortcut: ShortcutHandler {
        name: "driftile_focus_output_next"
        text: "Driftile: Focus next output"
        onActivated: Workspace.slotSwitchToNextScreen()
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
    readonly property ShortcutHandler moveColumnToOutputPreviousShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_previous"
        text: "Driftile: Move column to previous output"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputPrevious()
    }
    readonly property ShortcutHandler moveColumnToOutputNextShortcut: ShortcutHandler {
        name: "driftile_move_column_to_output_next"
        text: "Driftile: Move column to next output"
        onActivated: Runtime.DriftileRuntime.moveColumnToOutputNext()
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
    readonly property ShortcutHandler moveWindowToOutputPreviousShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_previous"
        text: "Driftile: Move window to previous output"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputPrevious()
    }
    readonly property ShortcutHandler moveWindowToOutputNextShortcut: ShortcutHandler {
        name: "driftile_move_window_to_output_next"
        text: "Driftile: Move window to next output"
        onActivated: Runtime.DriftileRuntime.moveWindowToOutputNext()
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
    readonly property ShortcutHandler switchPresetWindowWidthShortcut: ShortcutHandler {
        name: "driftile_switch_preset_window_width"
        text: "Driftile: Switch preset window width"
        onActivated: Runtime.DriftileRuntime.switchPresetWindowWidth()
    }
    readonly property ShortcutHandler switchPresetWindowWidthBackShortcut: ShortcutHandler {
        name: "driftile_switch_preset_window_width_back"
        text: "Driftile: Switch preset window width back"
        onActivated: Runtime.DriftileRuntime.switchPresetWindowWidthBack()
    }
    readonly property ShortcutHandler maximizeColumnShortcut: ShortcutHandler {
        name: "driftile_maximize_column"
        text: "Driftile: Maximize column"
        sequence: "Meta+F"
        onActivated: Runtime.DriftileRuntime.maximizeColumn()
    }
    readonly property ShortcutHandler toggleColumnTabbedDisplayShortcut: ShortcutHandler {
        name: "driftile_toggle_column_tabbed_display"
        text: "Driftile: Toggle tabbed column"
        sequence: "Meta+W"
        onActivated: Runtime.DriftileRuntime.toggleColumnTabbedDisplay()
    }
    readonly property ShortcutHandler setColumnStackedDisplayShortcut: ShortcutHandler {
        name: "driftile_set_column_stacked_display"
        text: "Driftile: Set stacked column display"
        onActivated: Runtime.DriftileRuntime.setColumnStackedDisplay()
    }
    readonly property ShortcutHandler setColumnTabbedDisplayShortcut: ShortcutHandler {
        name: "driftile_set_column_tabbed_display"
        text: "Driftile: Set tabbed column display"
        onActivated: Runtime.DriftileRuntime.setColumnTabbedDisplay()
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
    readonly property ShortcutHandler centerWindowShortcut: ShortcutHandler {
        name: "driftile_center_window"
        text: "Driftile: Center window"
        onActivated: Runtime.DriftileRuntime.centerWindow()
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
    readonly property ShortcutHandler closeWindowShortcut: ShortcutHandler {
        name: "driftile_close_window"
        text: "Driftile: Close window"
        sequence: "Meta+Q"
        onActivated: Workspace.slotWindowClose()
    }

    function readSettings() {
        return {
            applicationBorderlessExclusions: KWin.readConfig("ApplicationBorderlessExclusions", ""),
            applicationColumnPresentations: KWin.readConfig("ApplicationColumnPresentations", ""),
            applicationColumnWidths: KWin.readConfig("ApplicationColumnWidths", ""),
            applicationWindowHeights: KWin.readConfig("ApplicationWindowHeights", ""),
            applicationFocusCentering: KWin.readConfig("ApplicationFocusCentering", ""),
            applicationInitialDestinations: KWin.readConfig("ApplicationInitialDestinations", ""),
            applicationInitialFloating: KWin.readConfig("ApplicationInitialFloating", ""),
            applicationInitialLayouts: KWin.readConfig("ApplicationInitialLayouts", ""),
            applicationFloatingPositions: KWin.readConfig("ApplicationFloatingPositions", ""),
            applicationInitialFullWidth: KWin.readConfig("ApplicationInitialFullWidth", ""),
            applicationInitialMaximized: KWin.readConfig("ApplicationInitialMaximized", ""),
            applicationInitialFocused: KWin.readConfig("ApplicationInitialFocused", ""),
            applicationInitialUnfocused: KWin.readConfig("ApplicationInitialUnfocused", ""),
            applicationInitialFullscreen: KWin.readConfig("ApplicationInitialFullscreen", ""),
            applicationTilingExclusions: KWin.readConfig("ApplicationTilingExclusions", ""),
            alwaysCenterSingleColumn: KWin.readConfig("AlwaysCenterSingleColumn", false),
            borderlessWindows: KWin.readConfig("BorderlessWindows", true),
            centerFocusedColumn: KWin.readConfig("CenterFocusedColumn", false),
            centerFocusedColumnOnOverflow: KWin.readConfig("CenterFocusedColumnOnOverflow", false),
            columnWidthPresets: KWin.readConfig("ColumnWidthPresets", ""),
            columnWidthStepPixels: KWin.readConfig("ColumnWidthStepPixels", 0),
            columnWidthStepPercent: KWin.readConfig("ColumnWidthStepPercent", 10),
            defaultColumnPresentation: KWin.readConfig("DefaultColumnPresentation", "stacked"),
            defaultColumnWidthPercent: KWin.readConfig("DefaultColumnWidthPercent", 33),
            defaultColumnWidthPixels: KWin.readConfig("DefaultColumnWidthPixels", 0),
            useInitialWindowWidth: KWin.readConfig("UseInitialWindowWidth", false),
            defaultFloatingPosition: KWin.readConfig("DefaultFloatingPosition", ""),
            defaultInitialDestination: KWin.readConfig("DefaultInitialDestination", ""),
            defaultInitialFocus: KWin.readConfig("DefaultInitialFocus", "default"),
            defaultInitialLayout: KWin.readConfig("DefaultInitialLayout", "tiled"),
            defaultWindowHeight: KWin.readConfig("DefaultWindowHeight", "auto"),
            emptyDesktopAboveFirst: KWin.readConfig("EmptyDesktopAboveFirst", false),
            gap: KWin.readConfig("Gap", 16),
            numberedDesktopTargets: KWin.readConfig("NumberedDesktopTargets", ""),
            showTabIndicator: KWin.readConfig("ShowTabIndicator", true),
            touchpadNavigation: KWin.readConfig("TouchpadNavigation", false),
            touchpadWorkspaceNavigation: KWin.readConfig("TouchpadWorkspaceNavigation", false),
            workspaceAutoBackAndForth: KWin.readConfig("WorkspaceAutoBackAndForth", false),
            touchpadNavigationFingerCount: KWin.readConfig("TouchpadNavigationFingerCount", 5),
            touchpadNaturalScroll: KWin.readConfig("TouchpadNaturalScroll", true),
            windowHeightPresets: KWin.readConfig("WindowHeightPresets", ""),
            windowHeightStepPixels: KWin.readConfig("WindowHeightStepPixels", 0),
            windowHeightStepPercent: KWin.readConfig("WindowHeightStepPercent", 10)
        };
    }

    function applySettings(settings) {
        if (!Runtime.DriftileRuntime.applySettings(settings)) {
            return;
        }

        root.refreshTouchpadNavigationHandlers(false);
    }

    function refreshTouchpadNavigationHandlers(force) {
        const touchpadNavigation = Runtime.DriftileRuntime.getTouchpadNavigation();
        const touchpadWorkspaceNavigation = Runtime.DriftileRuntime.getTouchpadWorkspaceNavigation();
        const fingerCount = Runtime.DriftileRuntime.getTouchpadNavigationFingerCount();
        const naturalScroll = Runtime.DriftileRuntime.getTouchpadNaturalScroll();
        const gesturePropertiesChanged = fingerCount !== root.appliedTouchpadNavigationFingerCount
            || naturalScroll !== root.appliedTouchpadNaturalScroll;
        const touchpadNavigationChanged = touchpadNavigation !== root.appliedTouchpadNavigation;
        const touchpadWorkspaceNavigationChanged = touchpadWorkspaceNavigation
            !== root.appliedTouchpadWorkspaceNavigation;

        root.appliedTouchpadNavigation = touchpadNavigation;
        root.appliedTouchpadWorkspaceNavigation = touchpadWorkspaceNavigation;
        root.appliedTouchpadNavigationFingerCount = fingerCount;
        root.appliedTouchpadNaturalScroll = naturalScroll;

        if (force || touchpadNavigationChanged || gesturePropertiesChanged) {
            root.rebuildTouchpadNavigationHandler();
        }
        if (force || touchpadWorkspaceNavigationChanged || gesturePropertiesChanged) {
            root.rebuildTouchpadWorkspaceNavigationHandler();
        }
    }

    function rebuildTouchpadNavigationHandler() {
        touchpadNavigationLoader.active = false;
        touchpadNavigationLoader.source = "";

        if (!root.appliedTouchpadNavigation) {
            return;
        }

        touchpadNavigationLoader.setSource("TouchpadNavigation.qml", {
            fingerCount: root.appliedTouchpadNavigationFingerCount,
            naturalScroll: root.appliedTouchpadNaturalScroll
        });
        touchpadNavigationLoader.active = true;
    }

    function rebuildTouchpadWorkspaceNavigationHandler() {
        touchpadWorkspaceNavigationLoader.active = false;
        touchpadWorkspaceNavigationLoader.source = "";

        if (!root.appliedTouchpadWorkspaceNavigation) {
            return;
        }

        touchpadWorkspaceNavigationLoader.setSource("TouchpadWorkspaceNavigation.qml", {
            fingerCount: root.appliedTouchpadNavigationFingerCount,
            naturalScroll: root.appliedTouchpadNaturalScroll
        });
        touchpadWorkspaceNavigationLoader.active = true;
    }

    function createRect(x, y, width, height) {
        return Qt.rect(x, y, width, height);
    }

    function normalizedDropPreviewKey(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function showDropPreview(x, y, width, height, destinationKey, ownerToken) {
        const nextDestinationKey = root.normalizedDropPreviewKey(destinationKey);
        const nextOwnerToken = root.normalizedDropPreviewKey(ownerToken);

        if (root.dropPreviewVisible
                && root.dropPreviewX === x
                && root.dropPreviewY === y
                && root.dropPreviewWidth === width
                && root.dropPreviewHeight === height
                && root.dropPreviewDestinationKey === nextDestinationKey
                && root.dropPreviewOwnerToken === nextOwnerToken) {
            return;
        }

        Workspace.showOutline(x, y, width, height);
        root.dropPreviewVisible = true;
        root.dropPreviewX = x;
        root.dropPreviewY = y;
        root.dropPreviewWidth = width;
        root.dropPreviewHeight = height;
        root.dropPreviewDestinationKey = nextDestinationKey;
        root.dropPreviewOwnerToken = nextOwnerToken;
    }

    function hideDropPreview(ownerToken) {
        const nextOwnerToken = root.normalizedDropPreviewKey(ownerToken);

        if (!root.dropPreviewVisible
                || root.dropPreviewOwnerToken !== nextOwnerToken) {
            return;
        }

        Workspace.hideOutline();
        root.dropPreviewVisible = false;
        root.dropPreviewDestinationKey = "";
        root.dropPreviewOwnerToken = "";
    }

    function showTabIndicator(index, count, caption) {
        if (Workspace.isEffectActive("overview")
                || Workspace.isEffectActive("io.github.kontonkara.driftile.overview")) {
            return;
        }

        const position = Number(index) + 1;
        const title = String(caption).trim();
        const text = title.length > 0
            ? `Tab ${position}/${String(count)}: ${title}`
            : `Tab ${position}/${String(count)}`;
        tabIndicatorCall.arguments = ["view-list-icons", text];
        tabIndicatorCall.call();
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
                                    root.queueLayoutState,
                                    root.showDropPreview,
                                    root.hideDropPreview,
                                    root.showTabIndicator);
        root.refreshTouchpadNavigationHandlers(true);
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
