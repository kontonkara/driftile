import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

Rectangle {
    id: root

    color: sceneEffect && sceneEffect.backdropColor !== undefined
        ? sceneEffect.backdropColor
        : "#e60b0f17"
    clip: true
    focus: true

    readonly property var sceneEffect: KWin.SceneView.effect
    readonly property var targetScreen: KWin.SceneView.screen
    readonly property var currentDesktop: typeof KWin.SceneView.currentDesktop !== "undefined"
        ? KWin.SceneView.currentDesktop
        : KWin.Workspace.currentDesktop
    readonly property var overviewModel: sceneEffect ? sceneEffect.overviewModel : null
    readonly property bool showWindowLabels: sceneEffect && typeof sceneEffect.showWindowLabels === "boolean"
        ? sceneEffect.showWindowLabels
        : true
    readonly property bool showApplicationIdentity: sceneEffect
        && typeof sceneEffect.showApplicationIdentity === "boolean"
        ? sceneEffect.showApplicationIdentity
        : true
    readonly property bool showWindowCloseButtons: sceneEffect
        && typeof sceneEffect.showWindowCloseButtons === "boolean"
        ? sceneEffect.showWindowCloseButtons
        : true
    readonly property bool showWindowStateBadges: sceneEffect
        && typeof sceneEffect.showWindowStateBadges === "boolean"
        ? sceneEffect.showWindowStateBadges
        : true
    readonly property bool showDesktopNames: sceneEffect && typeof sceneEffect.showDesktopNames === "boolean"
        ? sceneEffect.showDesktopNames
        : true
    readonly property bool showApplicationIcons: sceneEffect
        && typeof sceneEffect.showApplicationIcons === "boolean"
        ? sceneEffect.showApplicationIcons
        : true
    readonly property bool showOutputNames: sceneEffect && typeof sceneEffect.showOutputNames === "boolean"
        ? sceneEffect.showOutputNames
        : true
    readonly property var searchQueryPlan: planSearchQuery(searchQuery)
    readonly property bool searchQueryValid: searchQueryPlan !== null
    readonly property bool outputLabelGeometryEligible: width >= 640 && height >= 360
        && searchQuery.length === 0
    readonly property int outputLabelLiveScreenCount: showOutputNames && outputLabelGeometryEligible
        ? liveScreenCountForOutputLabel(targetScreen) : 0
    readonly property bool outputLabelNeeded: searchQuery.length > 0 || outputLabelLiveScreenCount >= 2
    readonly property var outputLabelPlan: outputLabelNeeded ? planOutputLabel(targetScreen) : null
    readonly property string outputName: outputLabelPlan ? outputLabelPlan.label : ""
    readonly property string outputId: outputIdForScreen()
    readonly property var desktopIds: outputId.length > 0 ? orderedDesktopIds() : []
    readonly property int currentWorkspaceIndex: currentDesktop && currentDesktop.id !== undefined
        && currentDesktop.id !== null ? desktopIds.indexOf(String(currentDesktop.id)) : -1
    readonly property real overviewZoom: sceneEffect && Number.isFinite(sceneEffect.overviewZoom)
        ? sceneEffect.overviewZoom : 0.5
    readonly property var overviewSpatialLayout: planSpatialLayout()
    readonly property var overviewSpatialVisibleRange: planSpatialVisibleRange()
    readonly property real outerMargin: Math.max(20, Math.min(width, height) * 0.035)
    readonly property real cardGap: overviewSpatialLayout.gap
    readonly property real cardHeight: overviewSpatialLayout.cardHeight
    readonly property real cardWidth: overviewSpatialLayout.cardWidth
    readonly property real cardX: overviewSpatialLayout.cardX
    readonly property real cardTop: overviewSpatialLayout.edgeMargin - spatialContentY
    property bool desktopReorderAvailable: false
    property bool emptyDesktopAboveFirst: false
    property bool keyboardHelpVisible: false
    property string keyboardSelectionId: ""
    property int overviewWheelRemainder: 0
    property real spatialContentY: 0
    property var spatialWindowDragSource: null
    property string spatialWindowDragSourceDesktopId: ""
    property real spatialEdgePanSceneX: Number.NaN
    property real spatialEdgePanSceneY: Number.NaN
    property real spatialEdgePanPointerY: Number.NaN
    property string searchQuery: ""
    property int searchResultCount: 0
    property var searchResultCountsByDesktop: Object.create(null)
    property var searchResultOrdinalsByTarget: Object.create(null)
    readonly property int searchResultOrdinal: searchResultOrdinalForTarget(keyboardSelectionId)
    property bool desktopReorderActive: false
    property real desktopReorderCardGap: 0
    property real desktopReorderCardHeight: 0
    property real desktopReorderCardTop: 0
    property real desktopReorderCardWidth: 0
    property real desktopReorderCardX: 0
    property var desktopReorderCurrentDesktop: null
    property string desktopReorderCurrentDesktopId: ""
    property var desktopReorderDesktopIds: []
    property var desktopReorderDesktopObjects: []
    property var desktopReorderEffect: null
    property bool desktopReorderEmptyDesktopAboveFirst: false
    property int desktopReorderInsertionSlot: -1
    property var desktopReorderModel: null
    property var desktopReorderOutput: null
    property string desktopReorderOutputId: ""
    property real desktopReorderSceneHeight: 0
    property real desktopReorderSceneWidth: 0
    property var desktopReorderScreen: null
    property var desktopReorderSource: null
    property string desktopReorderSourceId: ""
    property int desktopReorderSourceIndex: -1

    onKeyboardSelectionIdChanged: root.centerKeyboardSelectionWorkspace()
    onOverviewSpatialLayoutChanged: {
        if (desktopReorderActive) {
            resetDesktopReorder();
        }
        if (!spatialLayoutIsValid(overviewSpatialLayout)) {
            resetSpatialEdgePanTracking();
        }
        resetSpatialViewport();
    }
    onSearchQueryChanged: Qt.callLater(root.repairKeyboardSelection)

    Keys.onPressed: event => {
        const modifiers = event.modifiers & ~Qt.KeypadModifier;
        const forbiddenModifiers = Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier;
        const controlOnly = modifiers === Qt.ControlModifier;
        const unmodified = modifiers === Qt.NoModifier;
        const searchTextModifier = unmodified || modifiers === Qt.ShiftModifier;
        if (keyboardHelpVisible) {
            if (!event.isAutoRepeat
                    && ((unmodified && event.key === Qt.Key_F1)
                        || (searchTextModifier && event.key === Qt.Key_Escape))) {
                keyboardHelpVisible = false;
            } else if (unmodified && keyboardHelpLoader.item) {
                keyboardHelpLoader.item.handleScrollKey(event.key);
            }
            event.accepted = true;
            return;
        }
        if (unmodified && event.key === Qt.Key_F1) {
            if (!event.isAutoRepeat) {
                keyboardHelpVisible = true;
            }
            event.accepted = true;
            return;
        }

        let handled = true;
        if (controlOnly && event.key === Qt.Key_Backspace && searchQuery.length > 0) {
            root.removeLastSearchClause();
        } else if (controlOnly && event.key === Qt.Key_U && searchQuery.length > 0) {
            searchQuery = "";
        } else if ((modifiers & forbiddenModifiers) !== Qt.NoModifier) {
            handled = false;
        } else if (unmodified && event.key === Qt.Key_Left) {
            root.navigateKeyboardSelection("left");
        } else if (unmodified && event.key === Qt.Key_Right) {
            root.navigateKeyboardSelection("right");
        } else if (unmodified && event.key === Qt.Key_Up) {
            root.navigateKeyboardSelection("up");
        } else if (unmodified && event.key === Qt.Key_Down) {
            root.navigateKeyboardSelection("down");
        } else if (unmodified && event.key === Qt.Key_Tab) {
            root.navigateKeyboardSequence("next");
        } else if ((modifiers === Qt.ShiftModifier && event.key === Qt.Key_Tab)
                   || event.key === Qt.Key_Backtab) {
            root.navigateKeyboardSequence("previous");
        } else if (unmodified && event.key === Qt.Key_Home) {
            root.navigateKeyboardSequence("first");
        } else if (unmodified && event.key === Qt.Key_End) {
            root.navigateKeyboardSequence("last");
        } else if (unmodified && event.key === Qt.Key_Delete) {
            root.closeKeyboardSelection();
        } else if (unmodified
                   && (event.key === Qt.Key_Enter || event.key === Qt.Key_Return
                       || (event.key === Qt.Key_Space && searchQuery.length === 0))) {
            root.activateKeyboardSelection();
        } else if (searchTextModifier && event.key === Qt.Key_Backspace && searchQuery.length > 0) {
            root.removeLastSearchCharacter();
        } else if (searchTextModifier && event.key === Qt.Key_Escape) {
            if (searchQuery.length > 0) {
                searchQuery = "";
            } else if (sceneEffect) {
                sceneEffect.deactivate();
            }
        } else if (searchTextModifier && root.isPrintableSearchText(event.text)) {
            root.appendSearchText(event.text);
        } else {
            handled = false;
        }

        event.accepted = handled;
    }

    Component.onCompleted: {
        desktopReorderAvailable = typeof KWin.Workspace.moveDesktop === "function";
        refreshEmptyDesktopBoundarySetting();
        resetSpatialViewport();
        forceActiveFocus();
        Qt.callLater(root.repairKeyboardSelection);
    }

    Connections {
        target: root.sceneEffect
        ignoreUnknownSignals: true

        function onActiveChanged() {
            root.keyboardHelpVisible = false;
            if (!root.sceneEffect || root.sceneEffect.active !== true) {
                root.overviewWheelRemainder = 0;
                root.searchQuery = "";
                root.spatialContentY = 0;
                root.resetSpatialEdgePanTracking();
            } else {
                root.refreshEmptyDesktopBoundarySetting();
                root.resetSpatialViewport();
            }
        }

        function onItemDroppedOutOfScreen(globalPosition, source, screen) {
            root.handleCrossOutputWindowDrop(globalPosition, source, screen);
        }
    }

    Connections {
        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onDesktopsChanged() {
            root.closeStaleOverview();
        }

        function onCurrentActivityChanged() {
            root.closeStaleOverview();
        }

        function onActivitiesChanged() {
            root.closeStaleOverview();
        }

        function onScreensChanged() {
            root.closeStaleOverview();
        }

        function onWindowAdded() {
            root.closeStaleOverview();
        }

        function onWindowRemoved() {
            root.closeStaleOverview();
        }
    }

    Timer {
        id: spatialEdgePanTimer

        interval: 16
        repeat: true
        running: root.spatialEdgePanCanRun()
        triggeredOnStart: false
        onTriggered: root.advanceSpatialEdgePan(interval)
    }

    WheelHandler {
        target: null
        enabled: !root.keyboardHelpVisible
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        acceptedModifiers: Qt.NoModifier
        orientation: Qt.Vertical

        onWheel: event => root.handleOverviewWheel(event)
    }

    Item {
        id: spatialViewportInput

        property var panLayout: null
        property real panStartContentY: 0

        anchors.fill: parent
        enabled: root.sceneEffect && root.sceneEffect.active === true
                 && !root.keyboardHelpVisible && !root.desktopReorderActive
                 && root.overviewSpatialLayout.contentHeight > root.height
        containmentMask: QtObject {
            function contains(point) {
                return root.spatialViewportBackdropContains(point);
            }
        }

        DragHandler {
            id: spatialViewportDragHandler

            target: null
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.TouchPad | PointerDevice.TouchScreen
            acceptedModifiers: Qt.NoModifier
            grabPermissions: PointerHandler.TakeOverForbidden
            xAxis.enabled: false
            yAxis.enabled: true

            onActiveChanged: {
                if (active) {
                    spatialViewportInput.panLayout = root.overviewSpatialLayout;
                    spatialViewportInput.panStartContentY = root.spatialContentY;
                    root.setSpatialContentY(spatialViewportInput.panStartContentY - activeTranslation.y);
                } else {
                    spatialViewportInput.panLayout = null;
                }
            }
            onActiveTranslationChanged: {
                if (active && spatialViewportInput.panLayout === root.overviewSpatialLayout) {
                    root.setSpatialContentY(spatialViewportInput.panStartContentY - activeTranslation.y);
                }
            }
        }
    }

    Repeater {
        id: desktopRepeater

        model: root.desktopIds

        onItemAdded: Qt.callLater(root.repairKeyboardSelection)
        onItemRemoved: Qt.callLater(root.repairKeyboardSelection)

        Loader {
            id: desktopCardLoader

            required property string modelData
            required property int index

            x: root.cardX
            y: root.cardTop + index * (root.cardHeight + root.cardGap)
            width: root.cardWidth
            height: root.cardHeight
            active: root.desktopCardShouldLoad(index, modelData)
            onActiveChanged: Qt.callLater(root.repairKeyboardSelection)
            onLoaded: Qt.callLater(root.repairKeyboardSelection)

            sourceComponent: Component {
                DesktopCard {
                    enabled: !root.keyboardHelpVisible
                    context: root.contextFor(desktopCardLoader.modelData)
                    current: root.currentDesktop !== null
                        && String(root.currentDesktop.id) === desktopCardLoader.modelData
                    desktop: root.desktopForId(desktopCardLoader.modelData)
                    desktopReorderEnabled: root.desktopReorderAvailable
                                             && root.desktopIds.length > (root.emptyDesktopAboveFirst ? 3 : 2)
                                             && desktopCardLoader.index >= (root.emptyDesktopAboveFirst ? 1 : 0)
                                             && desktopCardLoader.index < root.desktopIds.length - 1
                    desktopReorderSource: root.desktopReorderActive
                        && root.desktopReorderSourceId === desktopCardLoader.modelData
                    desktopId: desktopCardLoader.modelData
                    floatingWindows: root.floatingFor(desktopCardLoader.modelData)
                    keyboardSelectionId: root.keyboardSelectionId
                    outputName: root.outputName
                    searchQuery: root.searchQuery
                    searchQueryPlan: root.searchQueryPlan
                    searchResultCount: root.searchResultCountForDesktop(desktopCardLoader.modelData)
                    screen: root.targetScreen
                    showApplicationIdentity: root.showApplicationIdentity
                    showApplicationIcons: root.showApplicationIcons
                    showWindowCloseButtons: root.showWindowCloseButtons
                    showWindowLabels: root.showWindowLabels
                    showWindowStateBadges: root.showWindowStateBadges
                    showDesktopNames: root.showDesktopNames
                    onDesktopReorderCanceled: expectedDesktopId => root.cancelDesktopReorder(expectedDesktopId)
                    onDesktopReorderGrabbed: (candidate, expectedDesktopId, expectedScreen, sceneX, sceneY) =>
                                                 root.beginDesktopReorder(candidate, expectedDesktopId, expectedScreen,
                                                                          sceneX, sceneY)
                    onDesktopReorderMoved: (expectedDesktopId, sceneX, sceneY) =>
                                               root.updateDesktopReorder(expectedDesktopId, sceneX, sceneY)
                    onDesktopReorderReleased: (expectedDesktopId, sceneX, sceneY) =>
                                                  root.finishDesktopReorder(expectedDesktopId, sceneX, sceneY)
                    onNavigationTargetsChanged: Qt.callLater(root.repairKeyboardSelection)
                    onDesktopTapped: (candidate, expectedDesktopId, expectedScreen) => root.selectDesktop(
                                         candidate, expectedDesktopId, expectedScreen)
                    onWindowTapped: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                     expectedScreen) => root.focusWindow(candidate, expectedWindowId,
                                                                          expectedDesktop, expectedDesktopId,
                                                                          expectedScreen)
                    onWindowCloseRequested: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                             expectedScreen) => root.closeWindow(candidate, expectedWindowId,
                                                                                  expectedDesktop, expectedDesktopId,
                                                                                  expectedScreen)
                    onWindowDropped: (candidate, expectedWindowId, expectedSourceDesktop, expectedSourceDesktopId,
                                      expectedTargetDesktop, expectedTargetDesktopId, expectedScreen) =>
                                         root.moveWindowToDesktop(candidate, expectedWindowId, expectedSourceDesktop,
                                                                  expectedSourceDesktopId, expectedTargetDesktop,
                                                                  expectedTargetDesktopId, expectedScreen)
                    onWindowSpatialDragStarted: (source, sceneX, sceneY) =>
                                                    root.beginWindowSpatialEdgePan(
                                                        source, desktopCardLoader.modelData, sceneX, sceneY)
                    onWindowSpatialDragMoved: (source, sceneX, sceneY) =>
                                                  root.updateWindowSpatialEdgePan(
                                                      source, desktopCardLoader.modelData, sceneX, sceneY)
                    onWindowSpatialDragFinished: source => root.finishWindowSpatialEdgePan(
                                                     source, desktopCardLoader.modelData)
                }
            }
        }
    }

    KeyboardHelpHint {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: Math.max(0, (root.outerMargin - height) / 2)
        visible: root.width >= 480 && root.height >= 320 && root.searchQuery.length === 0
            && !root.keyboardHelpVisible
        z: 19000
        onOpenRequested: root.keyboardHelpVisible = true
    }

    Rectangle {
        id: searchOverlay

        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: Math.max(8, root.outerMargin * 0.3)
        width: Math.min(Math.max(1, root.width - root.outerMargin * 2),
                        Math.max(160, searchOverlayText.implicitWidth + 28))
        height: 34
        visible: root.searchQuery.length > 0
        color: "#f21a2230"
        border.width: 1
        border.color: "#86aee8"
        radius: 8
        z: 20000

        Text {
            id: searchOverlayText

            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            text: !root.searchQueryValid
                ? `Invalid search query: ${root.searchQuery}`
                : root.searchResultCount === 0
                  ? `No matching windows: ${root.searchQuery}`
                : root.searchResultOrdinal > 0
                  ? `${root.searchResultOrdinal}/${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`
                  : `${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`
            textFormat: Text.PlainText
            color: "#f3f7ff"
            font.pixelSize: 14
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
    }

    Loader {
        id: keyboardHelpLoader

        anchors.fill: parent
        active: root.keyboardHelpVisible
        z: 30000

        sourceComponent: Component {
            Item {
                id: keyboardHelpOverlay

                readonly property real helpLineStep: 40

                function setHelpContentY(targetContentY) {
                    const maximumContentY = Math.max(0, helpViewport.contentHeight - helpViewport.height);
                    if (maximumContentY <= 0 || !Number.isFinite(targetContentY)) {
                        return;
                    }
                    helpViewport.contentY = Math.max(0, Math.min(maximumContentY, targetContentY));
                }

                function handleScrollKey(key) {
                    if (key === Qt.Key_Up) {
                        setHelpContentY(helpViewport.contentY - helpLineStep);
                    } else if (key === Qt.Key_Down) {
                        setHelpContentY(helpViewport.contentY + helpLineStep);
                    } else if (key === Qt.Key_PageUp) {
                        setHelpContentY(helpViewport.contentY - helpViewport.height);
                    } else if (key === Qt.Key_PageDown) {
                        setHelpContentY(helpViewport.contentY + helpViewport.height);
                    } else if (key === Qt.Key_Home) {
                        setHelpContentY(0);
                    } else if (key === Qt.Key_End) {
                        setHelpContentY(helpViewport.contentHeight - helpViewport.height);
                    }
                }

                function handleHelpWheel(event) {
                    if (!event) {
                        return;
                    }
                    event.accepted = true;

                    let delta = 0;
                    if (event.angleDelta && Number.isFinite(event.angleDelta.y)
                            && event.angleDelta.y !== 0) {
                        delta = -event.angleDelta.y * helpLineStep / 120;
                    } else if (event.pixelDelta && Number.isFinite(event.pixelDelta.y)
                               && event.pixelDelta.y !== 0) {
                        delta = -event.pixelDelta.y;
                    }
                    setHelpContentY(helpViewport.contentY + delta);
                }

                Rectangle {
                    anchors.fill: parent
                    color: "#b30b0f17"
                }

                TapHandler {
                    acceptedButtons: Qt.AllButtons
                    gesturePolicy: TapHandler.WithinBounds
                }

                Rectangle {
                    id: keyboardHelpPanel

                    readonly property var shortcuts: [
                        { keys: "Arrow keys", action: "Move selection" },
                        { keys: "Tab / Shift+Tab", action: "Select next / previous" },
                        { keys: "Home / End", action: "Select first / last" },
                        { keys: "Enter / Space", action: "Activate selection; Space works outside search" },
                        { keys: "Delete", action: "Close selected window" },
                        { keys: "Type text", action: "Search windows" },
                        { keys: "Backspace", action: "Remove last search character" },
                        { keys: "Ctrl+Backspace", action: "Remove last search clause" },
                        { keys: "Ctrl+U", action: "Clear search" },
                        { keys: "Escape", action: "Close help, clear search, or close Overview" },
                        { keys: "F1", action: "Toggle keyboard help" },
                        { keys: "Search fields", action: "title:, app:, desktop:, output:, state:" },
                        { keys: "Search operators", action: "\"phrase\", -exclude, | alternatives" }
                    ]

                    anchors.centerIn: parent
                    width: Math.min(560, Math.max(1, parent.width - Math.max(24, root.outerMargin * 2)))
                    height: Math.min(helpContent.implicitHeight + 40,
                                     Math.max(1, parent.height - Math.max(24, root.outerMargin * 2)))
                    color: "#fa1a2230"
                    border.width: 1
                    border.color: "#86aee8"
                    radius: 10
                    clip: true

                    Flickable {
                        id: helpViewport

                        anchors.fill: parent
                        anchors.margins: 20
                        contentWidth: width
                        contentHeight: helpContent.implicitHeight
                        boundsBehavior: Flickable.StopAtBounds
                        clip: true
                        interactive: contentHeight > height

                        WheelHandler {
                            target: null
                            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                            acceptedModifiers: Qt.KeyboardModifierMask
                            orientation: Qt.Vertical
                            blocking: true

                            onWheel: event => keyboardHelpOverlay.handleHelpWheel(event)
                        }

                        Column {
                            id: helpContent

                            width: helpViewport.width
                            spacing: 2

                            Item {
                                width: parent.width
                                height: Math.max(keyboardHelpTitle.implicitHeight,
                                                 keyboardHelpCloseButton.implicitHeight)

                                Text {
                                    id: keyboardHelpTitle

                                    anchors.left: parent.left
                                    anchors.right: keyboardHelpCloseButton.left
                                    anchors.rightMargin: 12
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: "Keyboard help"
                                    textFormat: Text.PlainText
                                    color: "#f3f7ff"
                                    font.bold: true
                                    font.pixelSize: 18
                                    elide: Text.ElideRight
                                }

                                KeyboardHelpCloseButton {
                                    id: keyboardHelpCloseButton

                                    anchors.right: parent.right
                                    anchors.verticalCenter: parent.verticalCenter
                                    onCloseRequested: root.keyboardHelpVisible = false
                                }
                            }

                            Text {
                                width: parent.width
                                bottomPadding: 8
                                text: "Scroll: Wheel, Up/Down, Page Up/Page Down, Home/End\nClose: F1, Escape, or Close"
                                textFormat: Text.PlainText
                                color: "#aebbd0"
                                font.pixelSize: 12
                                wrapMode: Text.Wrap
                            }

                            Repeater {
                                model: keyboardHelpPanel.shortcuts

                                Item {
                                    required property var modelData

                                    width: helpContent.width
                                    height: Math.max(shortcutKeys.implicitHeight, shortcutAction.implicitHeight) + 8

                                    Text {
                                        id: shortcutKeys

                                        width: Math.min(148, parent.width * 0.4)
                                        text: modelData.keys
                                        textFormat: Text.PlainText
                                        color: "#d8e8ff"
                                        font.bold: true
                                        font.pixelSize: 13
                                        wrapMode: Text.Wrap
                                    }

                                    Text {
                                        id: shortcutAction

                                        anchors.left: shortcutKeys.right
                                        anchors.leftMargin: 12
                                        anchors.right: parent.right
                                        text: modelData.action
                                        textFormat: Text.PlainText
                                        color: "#f3f7ff"
                                        font.pixelSize: 13
                                        wrapMode: Text.Wrap
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Loader {
        id: outputIdentityLoader

        anchors.top: parent.top
        anchors.right: parent.right
        anchors.topMargin: Math.max(8, root.outerMargin * 0.3)
        anchors.rightMargin: root.outerMargin
        width: item ? item.implicitWidth : 0
        height: item ? item.implicitHeight : 0
        active: root.outputLabelLiveScreenCount >= 2
        z: 19000

        sourceComponent: Component {
            OutputIdentityBadge {
                labelPlan: root.outputLabelPlan
            }
        }
    }

    Rectangle {
        readonly property real lineHeight: Math.max(2, Math.min(4, root.desktopReorderCardGap))

        x: root.desktopReorderCardX
        y: root.desktopReorderCardTop
           + root.desktopReorderInsertionSlot * (root.desktopReorderCardHeight + root.desktopReorderCardGap)
           - (root.desktopReorderInsertionSlot === 0 ? 0 : root.desktopReorderCardGap / 2) - lineHeight / 2
        width: root.desktopReorderCardWidth
        height: lineHeight
        visible: root.desktopReorderActive && root.desktopReorderInsertionSlot >= 0
        color: "#ffd166"
        radius: lineHeight / 2
        z: 10000
    }

    function planSpatialLayout() {
        const fallback = legacySpatialLayout();
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
                || desktopIds.length <= 0 || currentWorkspaceIndex < 0
                || currentWorkspaceIndex >= desktopIds.length) {
            return fallback;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialLayout !== "function") {
            return fallback;
        }

        try {
            const plan = runtime.planOverviewSpatialLayout({
                                                               sceneWidth: width,
                                                               sceneHeight: height,
                                                               workspaceCount: desktopIds.length,
                                                               currentWorkspaceIndex,
                                                               zoom: overviewZoom
                                                           });
            return spatialLayoutIsValid(plan) ? plan : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function spatialLayoutIsValid(plan) {
        if (!plan || !Number.isFinite(plan.cardWidth) || plan.cardWidth <= 0
                || !Number.isFinite(plan.cardHeight) || plan.cardHeight <= 0
                || !Number.isFinite(plan.cardX) || plan.cardX < 0
                || !Number.isFinite(plan.gap) || plan.gap <= 0
                || !Number.isFinite(plan.edgeMargin) || plan.edgeMargin < 0
                || !Number.isFinite(plan.contentHeight) || plan.contentHeight < height
                || !Number.isFinite(plan.initialContentY) || plan.initialContentY < 0
                || plan.cardX + plan.cardWidth > width || plan.cardHeight > height
                || plan.initialContentY > Math.max(0, plan.contentHeight - height)) {
            return false;
        }

        const aspectError = Math.abs(plan.cardWidth * height - plan.cardHeight * width);
        const aspectScale = Math.max(1, plan.cardWidth * height, plan.cardHeight * width);
        const currentCardCenter = plan.edgeMargin - plan.initialContentY
            + currentWorkspaceIndex * (plan.cardHeight + plan.gap) + plan.cardHeight / 2;
        return aspectError <= aspectScale * 0.000001
            && Math.abs(currentCardCenter - height / 2) <= Math.max(1, height) * 0.000001;
    }

    function legacySpatialLayout() {
        const edgeMargin = Math.max(20, Math.min(width, height) * 0.035);
        const gap = Math.max(2, Math.min(10, height * 0.012));
        const count = desktopIds.length;
        const legacyCardHeight = count > 0
            ? Math.max(1, (height - edgeMargin * 2 - gap * Math.max(0, count - 1)) / count) : 0;
        return {
            cardHeight: legacyCardHeight,
            cardWidth: Math.max(1, width - edgeMargin * 2),
            cardX: edgeMargin,
            contentHeight: Math.max(height, edgeMargin * 2 + legacyCardHeight * count
                                    + gap * Math.max(0, count - 1)),
            edgeMargin,
            gap,
            initialContentY: 0
        };
    }

    function planSpatialVisibleRange() {
        const fallback = allDesktopCardsRange();
        if (desktopIds.length <= 0) {
            return fallback;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialVisibleRange !== "function") {
            return fallback;
        }

        try {
            const plan = runtime.planOverviewSpatialVisibleRange({
                                                                     sceneHeight: height,
                                                                     contentHeight: overviewSpatialLayout.contentHeight,
                                                                     contentY: spatialContentY,
                                                                     edgeMargin: overviewSpatialLayout.edgeMargin,
                                                                     cardHeight,
                                                                     gap: cardGap,
                                                                     workspaceCount: desktopIds.length,
                                                                     overscan: 1
                                                                 });
            return spatialVisibleRangeIsValid(plan) ? plan : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function spatialVisibleRangeIsValid(plan) {
        return plan && Number.isInteger(plan.firstIndex) && Number.isInteger(plan.lastIndex)
            && plan.firstIndex >= 0 && plan.firstIndex <= plan.lastIndex
            && plan.lastIndex < desktopIds.length;
    }

    function allDesktopCardsRange() {
        return {
            firstIndex: 0,
            lastIndex: desktopIds.length - 1
        };
    }

    function desktopCardShouldLoad(index, expectedDesktopId) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopIds.length
                || typeof expectedDesktopId !== "string" || desktopIds[index] !== expectedDesktopId) {
            return true;
        }
        if (searchQuery.length > 0
                || (desktopReorderActive && desktopReorderSourceId === expectedDesktopId)
                || (spatialWindowDragSource !== null
                    && spatialWindowDragSourceDesktopId === expectedDesktopId)) {
            return true;
        }

        return index >= overviewSpatialVisibleRange.firstIndex
            && index <= overviewSpatialVisibleRange.lastIndex;
    }

    function desktopCardAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopRepeater.count) {
            return null;
        }

        const loader = desktopRepeater.itemAt(index);
        const expectedDesktopId = desktopIds[index];
        if (!loader || loader.index !== index || loader.modelData !== expectedDesktopId
                || loader.active !== true || !loader.item
                || loader.item.desktopId !== expectedDesktopId) {
            return null;
        }

        return loader.item;
    }

    function beginWindowSpatialEdgePan(source, expectedDesktopId, sceneX, sceneY) {
        if (desktopReorderActive || spatialWindowDragSource !== null
                || !windowSpatialDragSourceIsExact(source, expectedDesktopId)
                || !storeSpatialEdgePanScenePoint(sceneX, sceneY)) {
            return;
        }

        spatialWindowDragSource = source;
        spatialWindowDragSourceDesktopId = expectedDesktopId;
    }

    function updateWindowSpatialEdgePan(source, expectedDesktopId, sceneX, sceneY) {
        if (source !== spatialWindowDragSource
                || expectedDesktopId !== spatialWindowDragSourceDesktopId) {
            return;
        }
        if (!windowSpatialDragSourceIsExact(source, expectedDesktopId)) {
            resetSpatialEdgePanTracking();
            return;
        }

        storeSpatialEdgePanScenePoint(sceneX, sceneY);
    }

    function finishWindowSpatialEdgePan(source, expectedDesktopId) {
        if (source === spatialWindowDragSource
                && expectedDesktopId === spatialWindowDragSourceDesktopId) {
            resetSpatialEdgePanTracking();
        }
    }

    function windowSpatialDragSourceIsExact(source, expectedDesktopId) {
        try {
            if (!sceneEffect || sceneEffect.active !== true || !source
                    || source.spatialDragLifecycleActive !== true || source.dragEligible !== true
                    || source.minimizedWindow === true || typeof expectedDesktopId !== "string"
                    || expectedDesktopId.length === 0 || source.sourceDesktopId !== expectedDesktopId
                    || typeof source.windowId !== "string" || source.windowId.length === 0) {
                return false;
            }

            const candidate = source.candidate;
            const liveDesktop = source.sourceDesktop;
            const liveScreen = source.sourceScreen;
            if (!candidate || candidate.deleted || candidate.internalId === undefined
                    || candidate.internalId === null || String(candidate.internalId) !== source.windowId
                    || !liveDesktop || liveDesktop.id === undefined || liveDesktop.id === null
                    || String(liveDesktop.id) !== expectedDesktopId
                    || !liveScreen || liveScreen !== targetScreen
                    || candidate.output !== liveScreen) {
                return false;
            }

            const desktops = candidate.desktops;
            return desktops && desktops.length === 1 && desktops[0] === liveDesktop
                && String(desktops[0].id) === expectedDesktopId;
        } catch (error) {
            return false;
        }
    }

    function storeSpatialEdgePanScenePoint(sceneX, sceneY) {
        if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY)) {
            clearSpatialEdgePanScenePoint();
            return false;
        }

        let point;
        try {
            point = root.mapFromItem(null, sceneX, sceneY);
        } catch (error) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            clearSpatialEdgePanScenePoint();
            return false;
        }

        spatialEdgePanSceneX = sceneX;
        spatialEdgePanSceneY = sceneY;
        spatialEdgePanPointerY = point.y;
        return true;
    }

    function clearSpatialEdgePanScenePoint() {
        spatialEdgePanSceneX = Number.NaN;
        spatialEdgePanSceneY = Number.NaN;
        spatialEdgePanPointerY = Number.NaN;
    }

    function resetSpatialEdgePanTracking() {
        spatialWindowDragSource = null;
        spatialWindowDragSourceDesktopId = "";
        clearSpatialEdgePanScenePoint();
    }

    function resetSpatialViewport() {
        if (!spatialLayoutIsValid(overviewSpatialLayout)) {
            resetSpatialEdgePanTracking();
            spatialContentY = 0;
            return false;
        }

        const plan = planSpatialViewport(overviewSpatialLayout.initialContentY);
        if (!plan) {
            resetSpatialEdgePanTracking();
            spatialContentY = 0;
            return false;
        }

        spatialContentY = plan.contentY;
        return true;
    }

    function setSpatialContentY(requestedContentY) {
        const plan = planSpatialViewport(requestedContentY);
        if (!plan) {
            return false;
        }

        if (spatialContentY !== plan.contentY) {
            spatialContentY = plan.contentY;
        }
        return true;
    }

    function planSpatialViewport(requestedContentY) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialViewport !== "function") {
            return null;
        }

        try {
            const plan = runtime.planOverviewSpatialViewport({
                                                                 sceneHeight: height,
                                                                 contentHeight: overviewSpatialLayout.contentHeight,
                                                                 contentY: requestedContentY
                                                             });
            return spatialViewportPlanIsValid(plan) ? plan : null;
        } catch (error) {
            return null;
        }
    }

    function spatialViewportPlanIsValid(plan) {
        if (!plan || !Number.isFinite(plan.contentY) || plan.contentY < 0
                || !Number.isFinite(plan.maximumContentY) || plan.maximumContentY < 0
                || plan.contentY > plan.maximumContentY) {
            return false;
        }

        const expectedMaximum = overviewSpatialLayout.contentHeight - height;
        return Number.isFinite(expectedMaximum)
            && Math.abs(plan.maximumContentY - expectedMaximum) <= Math.max(1, height) * 0.000001;
    }

    function spatialEdgePanCanRun() {
        if (!sceneEffect || sceneEffect.active !== true
                || !spatialLayoutIsValid(overviewSpatialLayout)
                || overviewSpatialLayout.contentHeight <= height
                || !Number.isFinite(spatialContentY) || spatialContentY < 0
                || spatialContentY > overviewSpatialLayout.contentHeight - height
                || !Number.isFinite(spatialEdgePanSceneX)
                || !Number.isFinite(spatialEdgePanSceneY)
                || !Number.isFinite(spatialEdgePanPointerY)) {
            return false;
        }

        const maximumContentY = overviewSpatialLayout.contentHeight - height;
        const edgeZone = Math.min(height * 0.12, 96);
        const canMoveUp = spatialEdgePanPointerY < edgeZone && spatialContentY > 0;
        const canMoveDown = spatialEdgePanPointerY > height - edgeZone
            && spatialContentY < maximumContentY;
        if (!Number.isFinite(edgeZone) || edgeZone <= 0 || (!canMoveUp && !canMoveDown)) {
            return false;
        }

        return windowSpatialDragSourceIsExact(spatialWindowDragSource,
                                              spatialWindowDragSourceDesktopId)
            || desktopReorderSpatialEdgePanIsExact();
    }

    function desktopReorderSpatialEdgePanIsExact() {
        try {
            return desktopReorderActive && desktopReorderEffect === sceneEffect
                && desktopReorderEffect && desktopReorderEffect.active === true
                && desktopReorderModel === overviewModel && desktopReorderScreen === targetScreen
                && typeof desktopReorderSourceId === "string" && desktopReorderSourceId.length > 0
                && desktopReorderSource && desktopReorderSource.id !== undefined
                && desktopReorderSource.id !== null
                && String(desktopReorderSource.id) === desktopReorderSourceId
                && desktopReorderSourceIndex >= 0
                && desktopReorderSourceIndex < desktopReorderDesktopIds.length
                && desktopReorderDesktopIds[desktopReorderSourceIndex] === desktopReorderSourceId
                && desktopReorderDesktopObjects[desktopReorderSourceIndex] === desktopReorderSource
                && desktopReorderSceneWidth === width && desktopReorderSceneHeight === height
                && desktopReorderCardX === cardX && desktopReorderCardWidth === cardWidth
                && desktopReorderCardHeight === cardHeight && desktopReorderCardGap === cardGap;
        } catch (error) {
            return false;
        }
    }

    function advanceSpatialEdgePan(elapsedMilliseconds) {
        if (!spatialEdgePanCanRun() || elapsedMilliseconds !== 16) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialEdgePan !== "function") {
            clearSpatialEdgePanScenePoint();
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialEdgePan({
                                                         sceneHeight: height,
                                                         contentHeight: overviewSpatialLayout.contentHeight,
                                                         contentY: spatialContentY,
                                                         pointerY: spatialEdgePanPointerY,
                                                         elapsedMilliseconds
                                                     });
        } catch (error) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (!spatialEdgePanPlanIsValid(plan, elapsedMilliseconds)) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (!plan.active) {
            return false;
        }

        const reorderWasExact = desktopReorderSpatialEdgePanIsExact();
        if (!setSpatialContentY(plan.contentY) || spatialContentY !== plan.contentY) {
            clearSpatialEdgePanScenePoint();
            return false;
        }

        if (reorderWasExact && desktopReorderActive) {
            desktopReorderCardTop = cardTop;
            updateDesktopReorder(desktopReorderSourceId, spatialEdgePanSceneX, spatialEdgePanSceneY);
        }
        return true;
    }

    function spatialEdgePanPlanIsValid(plan, elapsedMilliseconds) {
        if (!plan || Array.isArray(plan) || typeof plan.active !== "boolean"
                || !Number.isFinite(plan.contentY) || plan.contentY < 0
                || plan.contentY > overviewSpatialLayout.contentHeight - height
                || elapsedMilliseconds !== spatialEdgePanTimer.interval) {
            return false;
        }

        const viewportPlan = planSpatialViewport(plan.contentY);
        if (!spatialViewportPlanIsValid(viewportPlan) || viewportPlan.contentY !== plan.contentY) {
            return false;
        }

        const delta = plan.contentY - spatialContentY;
        const tolerance = Math.max(1, height) * 0.000001;
        if (!plan.active) {
            return plan.direction === null && Math.abs(delta) <= tolerance;
        }

        const maximumDistance = Math.min(height * 1.5, 1800) * elapsedMilliseconds / 1000;
        return (plan.direction === "up" && delta < 0 || plan.direction === "down" && delta > 0)
            && Math.abs(delta) <= maximumDistance + tolerance;
    }

    function centerKeyboardSelectionWorkspace() {
        const selectedTargetId = keyboardSelectionId;
        if (selectedTargetId.length === 0) {
            return false;
        }

        const target = navigationTargetForId(collectNavigationTargets(), selectedTargetId);
        if (!target || typeof target.desktopId !== "string" || target.desktopId.length === 0) {
            return false;
        }

        const workspaceIndex = desktopIds.indexOf(target.desktopId);
        if (workspaceIndex < 0) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceCenter !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialWorkspaceCenter({
                                                                  sceneHeight: height,
                                                                  contentHeight: overviewSpatialLayout.contentHeight,
                                                                  cardHeight,
                                                                  gap: cardGap,
                                                                  workspaceCount: desktopIds.length,
                                                                  workspaceIndex
                                                              });
        } catch (error) {
            return false;
        }

        const confirmedTarget = navigationTargetForId(collectNavigationTargets(), selectedTargetId);
        if (!spatialViewportPlanIsValid(plan) || keyboardSelectionId !== selectedTargetId
                || !confirmedTarget || confirmedTarget.desktopId !== target.desktopId) {
            return false;
        }

        spatialContentY = plan.contentY;
        return true;
    }

    function spatialViewportBackdropContains(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height
                || keyboardHelpVisible || desktopReorderActive
                || spatialViewportOverlayContainsPoint(keyboardHelpHint, point)
                || spatialViewportOverlayContainsPoint(searchOverlay, point)
                || spatialViewportOverlayContainsPoint(outputIdentityLoader, point)) {
            return false;
        }

        if (point.x < cardX || point.x >= cardX + cardWidth) {
            return true;
        }

        const stride = cardHeight + cardGap;
        const relativeY = point.y - cardTop;
        if (!Number.isFinite(stride) || stride <= 0 || !Number.isFinite(relativeY) || relativeY < 0) {
            return true;
        }

        const workspaceIndex = Math.floor(relativeY / stride);
        if (workspaceIndex < 0 || workspaceIndex >= desktopIds.length) {
            return true;
        }

        return relativeY - workspaceIndex * stride >= cardHeight;
    }

    function spatialViewportOverlayContainsPoint(item, point) {
        if (!item || !item.visible || item.width <= 0 || item.height <= 0) {
            return false;
        }

        try {
            const localPoint = item.mapFromItem(spatialViewportInput, point.x, point.y);
            return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
                && localPoint.x >= 0 && localPoint.y >= 0
                && localPoint.x < item.width && localPoint.y < item.height;
        } catch (error) {
            return true;
        }
    }

    function beginDesktopReorder(candidate, expectedDesktopId, expectedScreen, sceneX, sceneY) {
        if (desktopReorderActive || spatialWindowDragSource !== null || !desktopReorderAvailable) {
            return;
        }
        resetDesktopReorder();

        const keepEmptyDesktopAboveFirst = emptyDesktopAboveFirstFromConfig();
        emptyDesktopAboveFirst = keepEmptyDesktopAboveFirst;
        const firstMovableIndex = keepEmptyDesktopAboveFirst ? 1 : 0;

        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
        const snapshot = liveDesktopSnapshot();
        const selectedDesktop = currentDesktop;
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !snapshot
                || snapshot.ids.length <= firstMovableIndex + 2
                || !sameStringList(snapshot.ids, desktopIds) || !selectedDesktop
                || String(selectedDesktop.id).length === 0) {
            return;
        }

        const sourceIndex = snapshot.ids.indexOf(expectedDesktopId);
        if (sourceIndex < firstMovableIndex || sourceIndex >= snapshot.ids.length - 1
                || snapshot.objects[sourceIndex] !== liveDesktop) {
            return;
        }

        desktopReorderActive = true;
        desktopReorderCardGap = cardGap;
        desktopReorderCardHeight = cardHeight;
        desktopReorderCardTop = cardTop;
        desktopReorderCardWidth = cardWidth;
        desktopReorderCardX = cardX;
        desktopReorderCurrentDesktop = selectedDesktop;
        desktopReorderCurrentDesktopId = String(selectedDesktop.id);
        desktopReorderDesktopIds = snapshot.ids;
        desktopReorderDesktopObjects = snapshot.objects;
        desktopReorderEffect = effect;
        desktopReorderEmptyDesktopAboveFirst = keepEmptyDesktopAboveFirst;
        desktopReorderModel = model;
        desktopReorderOutput = expectedOutput;
        desktopReorderOutputId = expectedOutputId;
        desktopReorderSceneHeight = height;
        desktopReorderSceneWidth = width;
        desktopReorderScreen = liveScreen;
        desktopReorderSource = liveDesktop;
        desktopReorderSourceId = expectedDesktopId;
        desktopReorderSourceIndex = sourceIndex;
        updateDesktopReorder(expectedDesktopId, sceneX, sceneY);
    }

    function updateDesktopReorder(expectedDesktopId, sceneX, sceneY) {
        if (!desktopReorderActive || expectedDesktopId !== desktopReorderSourceId) {
            return;
        }
        if (!storeSpatialEdgePanScenePoint(sceneX, sceneY)) {
            desktopReorderInsertionSlot = -1;
            return;
        }

        const insertionSlot = desktopReorderSlotAt(sceneX, sceneY);
        const targetIndex = plannedDesktopReorderIndex(insertionSlot);
        desktopReorderInsertionSlot = targetIndex === null ? -1 : insertionSlot;
    }

    function finishDesktopReorder(expectedDesktopId, sceneX, sceneY) {
        if (!desktopReorderActive || expectedDesktopId !== desktopReorderSourceId) {
            return;
        }

        storeSpatialEdgePanScenePoint(sceneX, sceneY);

        const insertionSlot = desktopReorderSlotAt(sceneX, sceneY);
        const targetIndex = plannedDesktopReorderIndex(insertionSlot);
        const effect = desktopReorderEffect;
        const model = desktopReorderModel;
        const liveScreen = desktopReorderScreen;
        const expectedOutput = desktopReorderOutput;
        const expectedOutputId = desktopReorderOutputId;
        const source = desktopReorderSource;
        const sourceId = desktopReorderSourceId;
        const sourceIndex = desktopReorderSourceIndex;
        const expectedIds = desktopReorderDesktopIds;
        const expectedObjects = desktopReorderDesktopObjects;
        const keepEmptyDesktopAboveFirst = desktopReorderEmptyDesktopAboveFirst;
        const firstMovableIndex = keepEmptyDesktopAboveFirst ? 1 : 0;
        const selectedDesktop = desktopReorderCurrentDesktop;
        const selectedDesktopId = desktopReorderCurrentDesktopId;
        const snapshot = liveDesktopSnapshot();
        const geometryUnchanged = width === desktopReorderSceneWidth && height === desktopReorderSceneHeight
            && cardX === desktopReorderCardX && cardWidth === desktopReorderCardWidth
            && cardTop === desktopReorderCardTop && cardGap === desktopReorderCardGap
            && cardHeight === desktopReorderCardHeight;
        const contextUnchanged = desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                                       source, sourceId) && selectedDesktop === currentDesktop
            && selectedDesktopId === String(currentDesktop ? currentDesktop.id : "");
        const orderUnchanged = snapshot && sameDesktopSnapshot(snapshot, expectedObjects, expectedIds)
            && sameStringList(snapshot.ids, desktopIds) && sourceIndex >= 0
            && sourceIndex >= firstMovableIndex && sourceIndex < snapshot.ids.length - 1
            && snapshot.objects[sourceIndex] === source
            && snapshot.ids[sourceIndex] === sourceId;
        const settingUnchanged = keepEmptyDesktopAboveFirst === emptyDesktopAboveFirstFromConfig();
        const canCommit = targetIndex !== null && geometryUnchanged && contextUnchanged && orderUnchanged
            && settingUnchanged
            && typeof KWin.Workspace.moveDesktop === "function";

        resetDesktopReorder();
        if (!canCommit) {
            return;
        }

        try {
            KWin.Workspace.moveDesktop(source, targetIndex);
        } catch (error) {
            return;
        }
    }

    function cancelDesktopReorder(expectedDesktopId) {
        if (desktopReorderActive && expectedDesktopId === desktopReorderSourceId) {
            resetDesktopReorder();
        }
    }

    function resetDesktopReorder() {
        desktopReorderActive = false;
        desktopReorderCardGap = 0;
        desktopReorderCardHeight = 0;
        desktopReorderCardTop = 0;
        desktopReorderCardWidth = 0;
        desktopReorderCardX = 0;
        desktopReorderCurrentDesktop = null;
        desktopReorderCurrentDesktopId = "";
        desktopReorderDesktopIds = [];
        desktopReorderDesktopObjects = [];
        desktopReorderEffect = null;
        desktopReorderEmptyDesktopAboveFirst = false;
        desktopReorderInsertionSlot = -1;
        desktopReorderModel = null;
        desktopReorderOutput = null;
        desktopReorderOutputId = "";
        desktopReorderSceneHeight = 0;
        desktopReorderSceneWidth = 0;
        desktopReorderScreen = null;
        desktopReorderSource = null;
        desktopReorderSourceId = "";
        desktopReorderSourceIndex = -1;
        if (spatialWindowDragSource === null) {
            clearSpatialEdgePanScenePoint();
        }
    }

    function desktopReorderSlotAt(sceneX, sceneY) {
        if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY) || desktopReorderDesktopIds.length <= 2
                || desktopReorderCardHeight <= 0 || desktopReorderCardGap < 0) {
            return -1;
        }

        let point;
        try {
            point = root.mapFromItem(null, sceneX, sceneY);
        } catch (error) {
            return -1;
        }

        const firstMovableIndex = desktopReorderEmptyDesktopAboveFirst ? 1 : 0;
        const movableCount = desktopReorderDesktopIds.length - 1;
        const stride = desktopReorderCardHeight + desktopReorderCardGap;
        const movableTop = desktopReorderCardTop + firstMovableIndex * stride;
        const protectedTop = desktopReorderCardTop + movableCount * stride;
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < desktopReorderCardX
                || point.x >= desktopReorderCardX + desktopReorderCardWidth
                || point.y < movableTop || point.y >= protectedTop) {
            return -1;
        }

        return Math.max(firstMovableIndex,
                        Math.min(movableCount, Math.floor((point.y - desktopReorderCardTop
                                                           + desktopReorderCardHeight / 2
                                                           + desktopReorderCardGap) / stride)));
    }

    function plannedDesktopReorderIndex(insertionSlot) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewDesktopDrop !== "function") {
            return null;
        }

        try {
            const targetIndex = runtime.planOverviewDesktopDrop(desktopReorderDesktopIds.length,
                                                                desktopReorderSourceIndex, insertionSlot,
                                                                desktopReorderEmptyDesktopAboveFirst);
            const firstMovableIndex = desktopReorderEmptyDesktopAboveFirst ? 1 : 0;
            return typeof targetIndex === "number" && targetIndex >= firstMovableIndex
                    && targetIndex < desktopReorderDesktopIds.length - 1 && Math.floor(targetIndex) === targetIndex
                ? targetIndex : null;
        } catch (error) {
            return null;
        }
    }

    function refreshEmptyDesktopBoundarySetting() {
        emptyDesktopAboveFirst = emptyDesktopAboveFirstFromConfig();
    }

    function emptyDesktopAboveFirstFromConfig() {
        try {
            const controller = sceneEffect ? sceneEffect.controller : null;
            return controller && typeof controller.emptyDesktopAboveFirstFromConfig === "function"
                ? controller.emptyDesktopAboveFirstFromConfig() === true : false;
        } catch (error) {
            return false;
        }
    }

    function liveDesktopSnapshot() {
        const ids = [];
        const objects = [];
        const knownIds = Object.create(null);
        for (const desktop of KWin.Workspace.desktops) {
            if (!desktop || desktop.id === undefined || desktop.id === null) {
                return null;
            }
            const desktopId = String(desktop.id);
            if (desktopId.length === 0 || knownIds[desktopId] === true) {
                return null;
            }
            knownIds[desktopId] = true;
            ids.push(desktopId);
            objects.push(desktop);
        }

        return ids.length >= 2 ? {
                                   ids,
                                   objects
                               } : null;
    }

    function sameDesktopSnapshot(snapshot, expectedObjects, expectedIds) {
        if (!snapshot || !expectedObjects || !sameStringList(snapshot.ids, expectedIds)
                || snapshot.objects.length !== expectedObjects.length) {
            return false;
        }
        for (let index = 0; index < expectedObjects.length; index += 1) {
            if (snapshot.objects[index] !== expectedObjects[index]) {
                return false;
            }
        }

        return true;
    }

    function sameStringList(first, second) {
        if (!first || !second || first.length !== second.length) {
            return false;
        }
        for (let index = 0; index < first.length; index += 1) {
            if (first[index] !== second[index]) {
                return false;
            }
        }

        return true;
    }

    function collectNavigationTargets() {
        const targets = [];
        for (let cardIndex = 0; cardIndex < desktopRepeater.count; cardIndex += 1) {
            const desktopCard = desktopCardAt(cardIndex);
            if (!desktopCard) {
                continue;
            }

            const cardTargets = desktopCard.collectNavigationTargets(root, true);
            for (const target of cardTargets) {
                targets.push(target);
            }
        }

        return targets;
    }

    function navigateKeyboardSelection(direction) {
        let targets = collectNavigationTargets();
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }
        targets = collectNavigationTargets();
        if (!navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewNavigationTarget(keyboardSelectionId, targets, direction);
            if (typeof targetId === "string" && navigationTargetForId(targets, targetId)) {
                keyboardSelectionId = targetId;
            }
        } catch (error) {
            return;
        }
    }

    function navigateKeyboardSequence(direction) {
        let targets = collectNavigationTargets();
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }
        targets = collectNavigationTargets();
        if (!navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewSequentialNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewSequentialNavigationTarget(keyboardSelectionId, targets, direction);
            if (typeof targetId === "string" && navigationTargetForId(targets, targetId)) {
                keyboardSelectionId = targetId;
            }
        } catch (error) {
            return;
        }
    }

    function handleOverviewWheel(event) {
        if (!event) {
            return;
        }
        try {
            event.accepted = false;
            if (keyboardHelpVisible || !sceneEffect || sceneEffect.active !== true
                    || event.modifiers !== Qt.NoModifier || !event.pixelDelta || !event.angleDelta
                    || !Number.isFinite(event.pixelDelta.y) || !Number.isFinite(event.angleDelta.y)) {
                return;
            }

            const pixelDeltaY = event.pixelDelta.y;
            const angleDeltaY = event.angleDelta.y;
            if (pixelDeltaY === 0 && angleDeltaY === 0) {
                return;
            }

            const handled = pixelDeltaY !== 0
                ? handleSpatialViewportWheel(angleDeltaY, pixelDeltaY)
                : searchQuery.length > 0
                    ? handleSearchResultWheel(angleDeltaY)
                    : handleSpatialWorkspaceWheel(angleDeltaY);
            if (handled) {
                event.accepted = true;
            }
        } catch (error) {
            return;
        }
    }

    function handleSpatialViewportWheel(angleDeltaY, pixelDeltaY) {
        if (!spatialWheelPresentationIsExact()) {
            return false;
        }

        const plan = planSpatialWheel(angleDeltaY, pixelDeltaY);
        if (!spatialViewportWheelPlanIsValid(plan, pixelDeltaY) || !spatialWheelPresentationIsExact()
                || !setSpatialContentY(plan.contentY) || spatialContentY !== plan.contentY) {
            return false;
        }

        overviewWheelRemainder = 0;
        return true;
    }

    function handleSpatialWorkspaceWheel(angleDeltaY) {
        if (!spatialWheelPresentationIsExact()) {
            return false;
        }

        const plan = planSpatialWheel(angleDeltaY, 0);
        if (!spatialWorkspaceWheelPlanIsValid(plan) || !spatialWheelPresentationIsExact()) {
            return false;
        }
        if (plan.steps > 0 && !requestSpatialWheelWorkspace(plan.direction, plan.steps)) {
            return false;
        }

        overviewWheelRemainder = plan.remainder;
        return true;
    }

    function handleSearchResultWheel(angleDeltaY) {
        const expectedSearchQuery = searchQuery;
        if (expectedSearchQuery.length === 0 || !spatialWheelPresentationIsExact()) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWheelNavigation !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewWheelNavigation(overviewWheelRemainder, angleDeltaY);
        } catch (error) {
            return false;
        }
        if (!spatialWorkspaceWheelPlanShapeIsValid(plan)
                || searchQuery !== expectedSearchQuery || !spatialWheelPresentationIsExact()) {
            return false;
        }

        overviewWheelRemainder = plan.remainder;
        for (let step = 0; step < plan.steps; step += 1) {
            navigateKeyboardSequence(plan.direction);
        }
        return true;
    }

    function planSpatialWheel(angleDeltaY, pixelDeltaY) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWheel !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewSpatialWheel({
                                                        angleDeltaY,
                                                        contentHeight: overviewSpatialLayout.contentHeight,
                                                        contentY: spatialContentY,
                                                        pixelDeltaY,
                                                        remainder: overviewWheelRemainder,
                                                        sceneHeight: height
                                                    });
        } catch (error) {
            return null;
        }
    }

    function spatialViewportWheelPlanIsValid(plan, pixelDeltaY) {
        const expectedContentY = Math.min(overviewSpatialLayout.contentHeight - height,
                                          Math.max(0, spatialContentY - pixelDeltaY));
        return plan && !Array.isArray(plan) && plan.intent === "viewport"
            && plan.remainder === 0 && plan.direction === undefined && plan.steps === undefined
            && spatialWheelContentYIsValid(plan.contentY) && plan.contentY === expectedContentY;
    }

    function spatialWorkspaceWheelPlanIsValid(plan) {
        return plan && !Array.isArray(plan) && plan.intent === "workspace"
            && spatialWheelContentYIsValid(plan.contentY) && plan.contentY === spatialContentY
            && spatialWorkspaceWheelPlanShapeIsValid(plan);
    }

    function spatialWorkspaceWheelPlanShapeIsValid(plan) {
        return plan && Number.isInteger(plan.remainder) && Math.abs(plan.remainder) < 120
            && Number.isInteger(plan.steps) && plan.steps >= 0 && plan.steps <= 4
            && (plan.steps === 0 ? plan.direction === null
                                : plan.direction === "next" || plan.direction === "previous");
    }

    function spatialWheelContentYIsValid(contentY) {
        return Number.isFinite(contentY) && contentY >= 0
            && contentY <= overviewSpatialLayout.contentHeight - height;
    }

    function spatialWheelPresentationIsExact() {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const liveDesktop = currentDesktop;
            const expectedDesktopId = liveDesktop && liveDesktop.id !== undefined && liveDesktop.id !== null
                ? String(liveDesktop.id) : "";
            return effect && effect.active === true && effect.overviewModel === model
                && model && targetScreen && outputId.length > 0
                && expectedDesktopId.length > 0 && spatialLayoutIsValid(overviewSpatialLayout)
                && currentWorkspaceIndex >= 0 && currentWorkspaceIndex < desktopIds.length
                && desktopIds[currentWorkspaceIndex] === expectedDesktopId
                && spatialWheelContentYIsValid(spatialContentY);
        } catch (error) {
            return false;
        }
    }

    function requestSpatialWheelWorkspace(direction, steps) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(targetScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const expectedDesktopIds = desktopIds;
        const sourceDesktop = currentDesktop;
        const sourceDesktopId = sourceDesktop && sourceDesktop.id !== undefined && sourceDesktop.id !== null
            ? String(sourceDesktop.id) : "";
        const sourceIndex = currentWorkspaceIndex;
        if (!spatialWheelPresentationIsExact() || sourceIndex < 0
                || expectedDesktopIds[sourceIndex] !== sourceDesktopId) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceWheelTarget !== "function") {
            return false;
        }

        let targetPlan = null;
        try {
            targetPlan = runtime.planOverviewSpatialWorkspaceWheelTarget({
                                                                            currentIndex: sourceIndex,
                                                                            direction,
                                                                            steps,
                                                                            workspaceCount: expectedDesktopIds.length
                                                                        });
        } catch (error) {
            return false;
        }
        if (!spatialWorkspaceWheelTargetPlanIsValid(targetPlan, sourceIndex, direction, steps,
                                                    expectedDesktopIds.length)
                || desktopIds !== expectedDesktopIds || currentDesktop !== sourceDesktop
                || currentWorkspaceIndex !== sourceIndex || !spatialWheelPresentationIsExact()) {
            return false;
        }
        if (targetPlan.appliedSteps === 0) {
            return targetPlan.targetIndex === sourceIndex;
        }

        const targetDesktopId = expectedDesktopIds[targetPlan.targetIndex];
        if (typeof targetDesktopId !== "string" || targetDesktopId.length === 0) {
            return false;
        }
        const targetDesktop = liveDesktopFor(desktopForId(targetDesktopId), targetDesktopId);
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                   sourceDesktop, sourceDesktopId)
                || !desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                          targetDesktop, targetDesktopId)
                || !requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                            targetDesktop, targetDesktopId)) {
            return false;
        }

        const selectionConfirmed = sceneEffect === effect && effect.active === true && overviewModel === model
            && currentDesktop === targetDesktop && currentWorkspaceIndex === targetPlan.targetIndex
            && desktopIds === expectedDesktopIds;
        if (!selectionConfirmed) {
            return false;
        }

        keyboardSelectionId = "";
        Qt.callLater(root.repairKeyboardSelection);
        return true;
    }

    function spatialWorkspaceWheelTargetPlanIsValid(plan, sourceIndex, direction, steps, workspaceCount) {
        if (!plan || Array.isArray(plan) || !Number.isInteger(plan.targetIndex)
                || plan.targetIndex < 0 || plan.targetIndex >= workspaceCount
                || !Number.isInteger(plan.appliedSteps) || plan.appliedSteps < 0
                || plan.appliedSteps > steps
                || plan.appliedSteps !== Math.abs(plan.targetIndex - sourceIndex)) {
            return false;
        }

        return direction === "previous" ? plan.targetIndex <= sourceIndex
                                        : direction === "next" && plan.targetIndex >= sourceIndex;
    }

    function activateKeyboardSelection() {
        const targets = collectNavigationTargets();
        const target = navigationTargetForId(targets, keyboardSelectionId);
        if (!target) {
            repairKeyboardSelectionFrom(targets);
            return;
        }

        if (target.kind === "desktop") {
            selectDesktop(target.candidate, target.desktopId, target.screen);
        } else if (target.kind === "window") {
            focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen);
        } else {
            repairKeyboardSelectionFrom(targets);
        }
    }

    function closeKeyboardSelection() {
        const targets = collectNavigationTargets();
        const target = navigationTargetForId(targets, keyboardSelectionId);
        if (!target) {
            repairKeyboardSelectionFrom(targets);
            return;
        }
        if (target.kind !== "window") {
            return;
        }

        closeWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen);
    }

    function repairKeyboardSelection() {
        repairKeyboardSelectionFrom(collectNavigationTargets());
    }

    function repairKeyboardSelectionFrom(targets) {
        searchResultCount = 0;
        searchResultCountsByDesktop = Object.create(null);
        searchResultOrdinalsByTarget = Object.create(null);
        if (searchQuery.length > 0 && searchQueryValid) {
            const runtime = OverviewRuntime.DriftileOverview;
            if (runtime && typeof runtime.summarizeOverviewWindowNavigationTargets === "function") {
                try {
                    const summary = runtime.summarizeOverviewWindowNavigationTargets(targets);
                    if (searchSummaryIsValid(summary, targets.length)) {
                        searchResultCount = summary.total;
                        searchResultCountsByDesktop = summary.byDesktop;
                        searchResultOrdinalsByTarget = summary.ordinalByTargetId;
                    }
                } catch (error) {
                    searchResultCount = 0;
                    searchResultCountsByDesktop = Object.create(null);
                    searchResultOrdinalsByTarget = Object.create(null);
                }
            }
        }

        if (navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const preferred = preferredInitialNavigationTarget(targets);
        keyboardSelectionId = preferred ? preferred.id : "";
    }

    function searchSummaryIsValid(summary, targetCount) {
        if (!summary || !Number.isInteger(summary.total) || summary.total < 0 || summary.total > targetCount
                || !summary.byDesktop || typeof summary.byDesktop !== "object"
                || Array.isArray(summary.byDesktop) || !summary.ordinalByTargetId
                || typeof summary.ordinalByTargetId !== "object" || Array.isArray(summary.ordinalByTargetId)) {
            return false;
        }

        for (const desktopId of Object.keys(summary.byDesktop)) {
            const count = summary.byDesktop[desktopId];
            if (desktopId.length === 0 || !Number.isInteger(count) || count <= 0 || count > summary.total) {
                return false;
            }
        }
        for (const targetId of Object.keys(summary.ordinalByTargetId)) {
            const ordinal = summary.ordinalByTargetId[targetId];
            if (targetId.length === 0 || !Number.isInteger(ordinal) || ordinal <= 0 || ordinal > summary.total) {
                return false;
            }
        }
        return true;
    }

    function searchResultCountForDesktop(desktopId) {
        const counts = searchResultCountsByDesktop;
        if (!counts || typeof desktopId !== "string" || desktopId.length === 0) {
            return 0;
        }

        const count = counts[desktopId];
        return Number.isInteger(count) && count > 0 ? count : 0;
    }

    function searchResultOrdinalForTarget(targetId) {
        const ordinals = searchResultOrdinalsByTarget;
        if (!ordinals || typeof targetId !== "string" || targetId.length === 0) {
            return 0;
        }

        const ordinal = ordinals[targetId];
        return Number.isInteger(ordinal) && ordinal > 0 && ordinal <= searchResultCount ? ordinal : 0;
    }

    function planSearchQuery(query) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowSearchQuery !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewWindowSearchQuery(query);
        } catch (error) {
            return null;
        }
    }

    function preferredInitialNavigationTarget(targets) {
        const activeWindow = KWin.Workspace.activeWindow;
        const activeDesktopId = currentDesktop ? String(currentDesktop.id) : "";
        let firstActive = null;
        let firstCurrentDesktop = null;
        let firstVisual = null;

        for (const target of targets) {
            if (target.kind === "window" && target.candidate === activeWindow) {
                if (target.desktopId === activeDesktopId) {
                    return target;
                }
                if (!firstActive || navigationTargetPrecedes(target, firstActive)) {
                    firstActive = target;
                }
            }
            if (target.kind === "window" && target.desktopId === activeDesktopId
                    && (!firstCurrentDesktop || navigationTargetPrecedes(target, firstCurrentDesktop))) {
                firstCurrentDesktop = target;
            }
            if (!firstVisual || navigationTargetPrecedes(target, firstVisual)) {
                firstVisual = target;
            }
        }

        return firstActive || firstCurrentDesktop || firstVisual;
    }

    function navigationTargetPrecedes(candidate, current) {
        if (candidate.rect.y !== current.rect.y) {
            return candidate.rect.y < current.rect.y;
        }
        if (candidate.rect.x !== current.rect.x) {
            return candidate.rect.x < current.rect.x;
        }

        return candidate.id < current.id;
    }

    function navigationTargetForId(targets, targetId) {
        if (typeof targetId !== "string" || targetId.length === 0) {
            return null;
        }

        let match = null;
        for (const target of targets) {
            if (target.id !== targetId) {
                continue;
            }
            if (match) {
                return null;
            }
            match = target;
        }

        return match;
    }

    function appendSearchText(input) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.appendOverviewSearchText !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.appendOverviewSearchText(current, input);
            if (typeof next === "string") {
                searchQuery = next;
            }
        } catch (error) {
            return;
        }
    }

    function removeLastSearchCharacter() {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.removeLastOverviewSearchCharacter !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.removeLastOverviewSearchCharacter(current);
            if (typeof next === "string") {
                searchQuery = next;
            }
        } catch (error) {
            return;
        }
    }

    function removeLastSearchClause() {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.removeLastOverviewSearchClause !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.removeLastOverviewSearchClause(current);
            if (typeof next === "string") {
                searchQuery = next;
            }
        } catch (error) {
            return;
        }
    }

    function isPrintableSearchText(input) {
        if (typeof input !== "string" || input.length === 0) {
            return false;
        }

        for (const character of input) {
            const codePoint = character.codePointAt(0);
            if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
                return false;
            }
        }

        return true;
    }

    function selectDesktop(candidate, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId)) {
            return;
        }

        if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId)) {
            return;
        }
        effect.deactivate();
    }

    function focusWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(expectedDesktop, expectedDesktopId);
        const expectedActivityId = String(KWin.Workspace.currentActivity);
        const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !windowContextIsExact(candidate, expectedWindowId,
                                                                               liveScreen, liveDesktop,
                                                                               expectedDesktopId,
                                                                               expectedActivityId)
                || !windowFocusStateIsExact(candidate, expectedMinimized, false)
                || (expectedMinimized && candidate.managed !== true)) {
            return;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop) {
            return;
        }

        let desktopSelectionConfirmed = false;
        if (activeDesktop !== liveDesktop || String(activeDesktop.id) !== expectedDesktopId) {
            if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                         expectedDesktopId)) {
                return;
            }
            desktopSelectionConfirmed = true;
        }

        if (expectedMinimized) {
            if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId)
                    || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                             expectedDesktopId, expectedActivityId)
                    || !windowFocusStateIsExact(candidate, true, false) || candidate.managed !== true) {
                return;
            }

            try {
                candidate.minimized = false;
            } catch (error) {
                return;
            }

            if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId)
                    || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                             expectedDesktopId, expectedActivityId)
                    || !windowFocusStateIsExact(candidate, false, true) || candidate.managed !== true) {
                return;
            }
        }

        let focusConfirmed = false;
        const selectedDesktop = currentDesktop;
        if (selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId && desktopContextIsExact(
                    effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop, expectedDesktopId)
                && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                        expectedActivityId)
                && windowFocusStateIsExact(candidate, false, true)) {
            try {
                if (KWin.Workspace.activeWindow !== candidate) {
                    KWin.Workspace.activeWindow = candidate;
                }
                focusConfirmed = KWin.Workspace.activeWindow === candidate;
                if (focusConfirmed && expectedMinimized) {
                    focusConfirmed = desktopContextIsExact(effect, model, liveScreen, expectedOutput,
                                                           expectedOutputId, liveDesktop, expectedDesktopId)
                        && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                               expectedDesktopId, expectedActivityId)
                        && windowFocusStateIsExact(candidate, false, true);
                }
            } catch (error) {
                focusConfirmed = false;
            }
        }

        if (focusConfirmed || (!expectedMinimized && desktopSelectionConfirmed)) {
            effect.deactivate();
        }
    }

    function requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId) {
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId)) {
            return false;
        }

        const screens = KWin.Workspace.screens;
        const hasSceneDesktop = typeof KWin.SceneView.currentDesktop !== "undefined";
        if (!hasSceneDesktop && (screens.length !== 1 || screens[0] !== liveScreen)) {
            return false;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop || activeDesktop === liveDesktop || String(activeDesktop.id) === expectedDesktopId) {
            return false;
        }

        try {
            if (hasSceneDesktop) {
                KWin.SceneView.currentDesktop = liveDesktop;
            } else {
                KWin.Workspace.currentDesktop = liveDesktop;
            }
        } catch (error) {
            return false;
        }

        const selectedDesktop = currentDesktop;
        return selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId;
    }

    function desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) {
        if (!effect || effect !== sceneEffect || effect.active !== true || !model || effect.overviewModel !== model
                || overviewModel !== model || !liveScreen || targetScreen !== liveScreen
                || liveScreenFor(liveScreen) !== liveScreen || !expectedOutput || expectedOutputId.length === 0
                || String(expectedOutput.outputId) !== expectedOutputId || outputId !== expectedOutputId
                || projectedOutput(model, liveScreen) !== expectedOutput || !liveDesktop || expectedDesktopId.length === 0
                || String(liveDesktop.id) !== expectedDesktopId
                || liveDesktopFor(liveDesktop, expectedDesktopId) !== liveDesktop) {
            return false;
        }

        return true;
    }

    function windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                  expectedActivityId) {
        return candidate && !candidate.deleted && candidate.wantsInput === true && expectedWindowId.length > 0
                && String(candidate.internalId) === expectedWindowId && candidate.output === liveScreen
                && String(KWin.Workspace.currentActivity) === expectedActivityId
                && windowUsesDesktop(candidate, liveDesktop, expectedDesktopId)
                && windowUsesActivity(candidate, expectedActivityId);
    }

    function windowFocusStateIsExact(candidate, expectedMinimized, rejectHidden) {
        return candidate && candidate.minimized === expectedMinimized && (!rejectHidden || !candidate.hidden);
    }

    function closeWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(expectedDesktop, expectedDesktopId);
        const expectedActivityId = String(KWin.Workspace.currentActivity);
        const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;
        if (!closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                       expectedMinimized)) {
            return;
        }

        try {
            if (!closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                           expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                           expectedMinimized)) {
                return;
            }
            candidate.closeWindow();
        } catch (error) {
            return;
        }
    }

    function closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                       expectedMinimized) {
        return desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId)
                && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                        expectedActivityId)
                && candidate.minimized === expectedMinimized
                && candidate.managed === true && candidate.closeable === true
                && typeof candidate.closeWindow === "function";
    }

    function windowUsesDesktop(candidate, expectedDesktop, expectedDesktopId) {
        const desktops = candidate.desktops;
        if (!desktops) {
            return false;
        }
        if (desktops.length === 0) {
            return true;
        }

        for (const desktop of desktops) {
            if (desktop === expectedDesktop && String(desktop.id) === expectedDesktopId) {
                return true;
            }
        }

        return false;
    }

    function windowUsesActivity(candidate, expectedActivityId) {
        const activities = candidate.activities;
        if (!activities) {
            return false;
        }
        if (activities.length === 0) {
            return true;
        }

        for (const activity of activities) {
            if (String(activity) === expectedActivityId) {
                return true;
            }
        }

        return false;
    }

    function handleCrossOutputWindowDrop(globalPosition, source, expectedTargetScreen) {
        const targetCard = crossOutputDropTargetAt(globalPosition, expectedTargetScreen);
        if (!targetCard || !source) {
            return;
        }

        moveWindowAcrossOutputs(source.candidate, source.windowId, source.sourceDesktop,
                                source.sourceDesktopId, source.sourceScreen, targetCard.desktop,
                                targetCard.desktopId, targetCard.screen, globalPosition);
    }

    function crossOutputDropTargetAt(globalPosition, expectedTargetScreen) {
        const liveTargetScreen = liveScreenFor(expectedTargetScreen);
        if (!globalPosition || !liveTargetScreen || liveTargetScreen !== targetScreen
                || !Number.isFinite(globalPosition.x) || !Number.isFinite(globalPosition.y)) {
            return null;
        }

        let localPosition;
        try {
            localPosition = liveTargetScreen.mapFromGlobal(globalPosition);
        } catch (error) {
            return null;
        }
        if (!localPosition || !Number.isFinite(localPosition.x) || !Number.isFinite(localPosition.y)
                || localPosition.x < 0 || localPosition.y < 0 || localPosition.x >= width
                || localPosition.y >= height) {
            return null;
        }

        let targetCard = null;
        for (let index = 0; index < desktopRepeater.count; index += 1) {
            const candidate = desktopCardAt(index);
            if (!candidate || !candidate.visible || candidate.screen !== liveTargetScreen
                    || !candidate.desktop || candidate.desktopId.length === 0) {
                continue;
            }

            let cardPosition;
            try {
                cardPosition = candidate.mapFromItem(root, localPosition.x, localPosition.y);
            } catch (error) {
                return null;
            }
            if (!cardPosition || !Number.isFinite(cardPosition.x) || !Number.isFinite(cardPosition.y)
                    || cardPosition.x < 0 || cardPosition.y < 0 || cardPosition.x >= candidate.width
                    || cardPosition.y >= candidate.height) {
                continue;
            }
            if (targetCard) {
                return null;
            }
            targetCard = candidate;
        }

        return targetCard;
    }

    function moveWindowAcrossOutputs(candidate, expectedWindowId, expectedSourceDesktop,
                                     expectedSourceDesktopId, expectedSourceScreen, expectedTargetDesktop,
                                     expectedTargetDesktopId, expectedTargetScreen, globalPosition) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveSourceScreen = liveScreenFor(expectedSourceScreen);
        const liveTargetScreen = liveScreenFor(expectedTargetScreen);
        const sourceWorkspaceOutput = candidate ? candidate.output : null;
        const targetWorkspaceOutput = workspaceOutputAt(globalPosition);
        const sourceOutput = projectedOutput(model, liveSourceScreen);
        const targetOutput = projectedOutput(model, liveTargetScreen);
        const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
        const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
        const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
        const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
        const currentActivity = KWin.Workspace.currentActivity;
        const expectedActivityId = currentActivity === undefined || currentActivity === null ? ""
                                                                                              : String(currentActivity);
        const state = {
            candidate,
            effect,
            expectedActivityId,
            expectedWindowId,
            liveSourceDesktop,
            liveSourceScreen,
            liveTargetDesktop,
            liveTargetScreen,
            model,
            sourceDesktopId: expectedSourceDesktopId,
            sourceOutput,
            sourceOutputId,
            sourceWorkspaceOutput,
            targetDesktopId: expectedTargetDesktopId,
            targetGlobalPosition: globalPosition,
            targetOutput,
            targetOutputId,
            targetWorkspaceOutput
        };

        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, sourceWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowDesktopDrop !== "function"
                || typeof KWin.Workspace.sendClientToScreen !== "function") {
            return;
        }

        let accepted = false;
        try {
            accepted = runtime.planOverviewWindowDesktopDrop(model, {
                                                                 sourceDesktopId: expectedSourceDesktopId,
                                                                 sourceOutputId,
                                                                 targetDesktopId: expectedTargetDesktopId,
                                                                 targetOutputId,
                                                                 windowId: expectedWindowId
                                                             }) === true;
        } catch (error) {
            return;
        }
        if (!accepted || !crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, sourceWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            return;
        }

        try {
            KWin.Workspace.sendClientToScreen(candidate, targetWorkspaceOutput);
        } catch (error) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        if (candidate.output !== targetWorkspaceOutput) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, targetWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }

        if (liveSourceDesktop !== liveTargetDesktop || expectedSourceDesktopId !== expectedTargetDesktopId) {
            try {
                candidate.desktops = [liveTargetDesktop];
            } catch (error) {
                settleFailedCrossOutputWindowDrop(state);
                return;
            }
        }

        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, targetWorkspaceOutput,
                                                       liveTargetDesktop, expectedTargetDesktopId,
                                                       expectedActivityId)
                || (expectedSourceDesktopId !== expectedTargetDesktopId
                    && windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId))) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        effect.deactivate();
    }

    function settleFailedCrossOutputWindowDrop(state) {
        if (!state || !state.candidate) {
            return;
        }
        const sourceStateIsExact = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                     state.sourceWorkspaceOutput,
                                                                     state.liveSourceDesktop,
                                                                     state.sourceDesktopId,
                                                                     state.expectedActivityId);
        if (sourceStateIsExact) {
            if (!crossOutputDropSceneIsExact(state) && state.effect && state.effect === sceneEffect
                    && state.effect.active === true) {
                state.effect.deactivate();
            }
            return;
        }

        compensateCrossOutputWindowDrop(state);
        if (state.effect && state.effect === sceneEffect && state.effect.active === true) {
            state.effect.deactivate();
        }
    }

    function compensateCrossOutputWindowDrop(state) {
        if (!crossOutputDropSceneIsExact(state) || state.candidate.output !== state.targetWorkspaceOutput
                || typeof KWin.Workspace.sendClientToScreen !== "function") {
            return false;
        }

        const atSourceDesktop = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                  state.targetWorkspaceOutput,
                                                                  state.liveSourceDesktop,
                                                                  state.sourceDesktopId,
                                                                  state.expectedActivityId);
        const atTargetDesktop = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                  state.targetWorkspaceOutput,
                                                                  state.liveTargetDesktop,
                                                                  state.targetDesktopId,
                                                                  state.expectedActivityId);
        if (!atSourceDesktop && !atTargetDesktop) {
            return false;
        }

        if (!atSourceDesktop) {
            try {
                state.candidate.desktops = [state.liveSourceDesktop];
            } catch (error) {
                return false;
            }
            if (!windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                   state.targetWorkspaceOutput, state.liveSourceDesktop,
                                                   state.sourceDesktopId, state.expectedActivityId)) {
                return false;
            }
        }

        if (!crossOutputDropSceneIsExact(state)) {
            return false;
        }
        try {
            KWin.Workspace.sendClientToScreen(state.candidate, state.sourceWorkspaceOutput);
        } catch (error) {
            return false;
        }

        return windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                 state.sourceWorkspaceOutput, state.liveSourceDesktop,
                                                 state.sourceDesktopId, state.expectedActivityId);
    }

    function crossOutputDropSceneIsExact(state) {
        if (!state || !state.effect || state.effect !== sceneEffect || state.effect.active !== true || !state.model
                || state.effect.overviewModel !== state.model || overviewModel !== state.model
                || !state.liveSourceScreen || !state.liveTargetScreen
                || state.liveSourceScreen === state.liveTargetScreen || targetScreen !== state.liveTargetScreen
                || liveScreenFor(state.liveSourceScreen) !== state.liveSourceScreen
                || liveScreenFor(state.liveTargetScreen) !== state.liveTargetScreen
                || !workspaceOutputIsLive(state.sourceWorkspaceOutput)
                || !workspaceOutputIsLive(state.targetWorkspaceOutput)
                || state.sourceWorkspaceOutput !== state.liveSourceScreen
                || state.targetWorkspaceOutput !== state.liveTargetScreen
                || state.sourceWorkspaceOutput === state.targetWorkspaceOutput
                || workspaceOutputAt(state.targetGlobalPosition) !== state.targetWorkspaceOutput
                || !state.sourceOutput
                || !state.targetOutput || state.sourceOutput === state.targetOutput
                || state.sourceOutputId.length === 0 || state.targetOutputId.length === 0
                || state.sourceOutputId === state.targetOutputId
                || String(state.sourceOutput.outputId) !== state.sourceOutputId
                || String(state.targetOutput.outputId) !== state.targetOutputId
                || projectedOutput(state.model, state.liveSourceScreen) !== state.sourceOutput
                || projectedOutput(state.model, state.liveTargetScreen) !== state.targetOutput
                || outputId !== state.targetOutputId || !state.liveSourceDesktop || !state.liveTargetDesktop
                || state.sourceDesktopId.length === 0 || state.targetDesktopId.length === 0
                || String(state.liveSourceDesktop.id) !== state.sourceDesktopId
                || String(state.liveTargetDesktop.id) !== state.targetDesktopId
                || liveDesktopFor(state.liveSourceDesktop, state.sourceDesktopId) !== state.liveSourceDesktop
                || liveDesktopFor(state.liveTargetDesktop, state.targetDesktopId) !== state.liveTargetDesktop) {
            return false;
        }

        return true;
    }

    function workspaceOutputAt(globalPosition) {
        if (!globalPosition || !Number.isFinite(globalPosition.x) || !Number.isFinite(globalPosition.y)
                || typeof KWin.Workspace.screenAt !== "function") {
            return null;
        }

        try {
            return KWin.Workspace.screenAt(globalPosition);
        } catch (error) {
            return null;
        }
    }

    function workspaceOutputIsLive(expectedOutput) {
        if (!expectedOutput) {
            return false;
        }

        let matches = 0;
        for (const output of KWin.Workspace.screens) {
            if (output === expectedOutput) {
                matches += 1;
            }
        }
        return matches === 1;
    }

    function moveWindowToDesktop(candidate, expectedWindowId, expectedSourceDesktop, expectedSourceDesktopId,
                                 expectedTargetDesktop, expectedTargetDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
        const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
        const currentActivity = KWin.Workspace.currentActivity;
        const expectedActivityId = currentActivity === undefined || currentActivity === null ? ""
                                                                                              : String(currentActivity);
        if (!windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveSourceDesktop,
                                                       expectedSourceDesktopId, expectedActivityId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowDesktopDrop !== "function") {
            return;
        }

        let accepted = false;
        try {
            accepted = runtime.planOverviewWindowDesktopDrop(model, {
                                                                 sourceDesktopId: expectedSourceDesktopId,
                                                                 sourceOutputId: expectedOutputId,
                                                                 targetDesktopId: expectedTargetDesktopId,
                                                                 targetOutputId: expectedOutputId,
                                                                 windowId: expectedWindowId
                                                             }) === true;
        } catch (error) {
            return;
        }
        if (!accepted || !windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                                        liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                                        expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveSourceDesktop,
                                                       expectedSourceDesktopId, expectedActivityId)) {
            return;
        }

        try {
            candidate.desktops = [liveTargetDesktop];
        } catch (error) {
            return;
        }

        if (!windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveTargetDesktop,
                                                       expectedTargetDesktopId, expectedActivityId)
                || windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId)) {
            return;
        }
        effect.deactivate();
    }

    function windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId) {
        return liveSourceDesktop !== liveTargetDesktop && expectedSourceDesktopId !== expectedTargetDesktopId
                && desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                         liveSourceDesktop, expectedSourceDesktopId)
                && desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                         liveTargetDesktop, expectedTargetDesktopId);
    }

    function windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, expectedDesktop,
                                               expectedDesktopId, expectedActivityId) {
        if (!candidate || candidate.deleted || candidate.minimized || candidate.wantsInput !== true
                || candidate.normalWindow !== true || candidate.managed !== true || candidate.moveable !== true
                || candidate.modal !== false || candidate.internalId === undefined || candidate.internalId === null
                || expectedWindowId.length === 0
                || String(candidate.internalId) !== expectedWindowId || candidate.output !== liveScreen
                || expectedActivityId.length === 0
                || String(KWin.Workspace.currentActivity) !== expectedActivityId
                || !windowUsesActivity(candidate, expectedActivityId) || candidate.transient !== false
                || candidate.transientFor !== null) {
            return false;
        }

        const desktops = candidate.desktops;
        return desktops && desktops.length === 1 && desktops[0] === expectedDesktop
                && String(desktops[0].id) === expectedDesktopId;
    }

    function orderedDesktopIds() {
        if (!overviewModel) {
            return [];
        }

        const knownIds = Object.create(null);
        const orderedIds = [];
        for (const desktopId of overviewModel.desktopIds) {
            knownIds[desktopId] = true;
        }
        for (const desktop of KWin.Workspace.desktops) {
            const desktopId = String(desktop.id);
            if (knownIds[desktopId] === true) {
                orderedIds.push(desktopId);
            }
        }

        return orderedIds;
    }

    function closeStaleOverview() {
        resetDesktopReorder();
        resetSpatialEdgePanTracking();
        if (sceneEffect) {
            sceneEffect.deactivate();
        }
    }

    function outputIdForScreen() {
        return projectedOutputId(overviewModel, targetScreen);
    }

    function liveScreenCountForOutputLabel(expectedScreen) {
        if (!expectedScreen) {
            return 0;
        }

        try {
            const screens = KWin.Workspace.screens;
            if (!screens || !Number.isInteger(screens.length) || screens.length < 2 || screens.length > 64) {
                return 0;
            }

            let targetMatches = 0;
            for (const screen of screens) {
                if (screen === expectedScreen) {
                    targetMatches += 1;
                }
            }

            return targetMatches === 1 ? screens.length : 0;
        } catch (error) {
            return 0;
        }
    }

    function planOutputLabel(screen) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewOutputLabel !== "function") {
            return null;
        }

        try {
            const planned = runtime.planOverviewOutputLabel(screen);
            return planned && !Array.isArray(planned) && typeof planned === "object"
                    && boundedPlainOutputLabel(planned.label) ? planned : null;
        } catch (error) {
            return null;
        }
    }

    function boundedPlainOutputLabel(value) {
        if (typeof value !== "string" || value.length === 0 || value.length > 128) {
            return false;
        }

        let codePoints = 0;
        for (const character of value) {
            codePoints += 1;
            if (codePoints > 64) {
                return false;
            }

            const codePoint = character.codePointAt(0);
            if (codePoint <= 0x1f || codePoint === 0x7f || codePoint >= 0x80 && codePoint <= 0x9f
                    || codePoint === 0x2028 || codePoint === 0x2029) {
                return false;
            }
        }

        return true;
    }

    function projectedOutputId(model, screen) {
        const output = projectedOutput(model, screen);
        return output ? String(output.outputId) : "";
    }

    function projectedOutput(model, screen) {
        if (!model || !screen) {
            return null;
        }

        const screenName = String(screen.name);
        let projected = null;
        for (const output of model.outputs) {
            if (output.name === screenName && outputDescriptorsMatch(output, screen)) {
                if (projected !== null) {
                    return null;
                }
                projected = output;
            }
        }

        return projected;
    }

    function liveScreenFor(expectedScreen) {
        let liveScreen = null;
        for (const screen of KWin.Workspace.screens) {
            if (screen === expectedScreen) {
                if (liveScreen !== null) {
                    return null;
                }
                liveScreen = screen;
            }
        }

        return liveScreen;
    }

    function liveDesktopFor(expectedDesktop, expectedDesktopId) {
        let liveDesktop = null;
        for (const desktop of KWin.Workspace.desktops) {
            if (desktop === expectedDesktop && String(desktop.id) === expectedDesktopId) {
                if (liveDesktop !== null) {
                    return null;
                }
                liveDesktop = desktop;
            }
        }

        return liveDesktop;
    }

    function outputDescriptorsMatch(output, screen) {
        return optionalIdentifier(output.manufacturer) === optionalIdentifier(screen.manufacturer) && optionalIdentifier(
                    output.model) === optionalIdentifier(screen.model) && optionalIdentifier(output.serialNumber)
                === optionalIdentifier(screen.serialNumber);
    }

    function optionalIdentifier(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function contextFor(desktopId) {
        if (!overviewModel || outputId.length === 0) {
            return null;
        }

        for (const context of overviewModel.contexts) {
            if (context.outputId === outputId && context.desktopId === desktopId) {
                return context;
            }
        }

        return null;
    }

    function floatingFor(desktopId) {
        if (!overviewModel || outputId.length === 0) {
            return [];
        }

        const windows = [];
        for (const floatingWindow of overviewModel.floatingWindows) {
            if (floatingWindow.outputId === outputId && floatingWindow.desktopId === desktopId) {
                windows.push(floatingWindow);
            }
        }

        return windows;
    }

    function desktopForId(desktopId) {
        for (const desktop of KWin.Workspace.desktops) {
            if (String(desktop.id) === desktopId) {
                return desktop;
            }
        }

        return null;
    }
}
