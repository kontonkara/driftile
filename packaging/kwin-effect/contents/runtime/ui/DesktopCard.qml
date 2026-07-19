import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

Rectangle {
    id: card

    required property var context
    required property bool current
    required property var desktop
    required property bool desktopReorderEnabled
    required property bool desktopReorderSource
    required property string desktopId
    required property var floatingWindows
    required property bool liveGeometryEnabled
    required property string outputName
    required property var screen
    required property string searchQuery
    required property var searchQueryPlan
    required property int searchResultCount
    required property bool showApplicationIcons
    required property bool showApplicationIdentity
    required property bool showDesktopNames
    required property bool showWindowCloseButtons
    required property bool showWindowLabels
    required property bool showWindowStateBadges
    required property real previewViewportOffset
    required property var spatialRowGeometryPlan
    property string keyboardSelectionId: ""

    signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)
    signal desktopReorderCanceled(string expectedDesktopId)
    signal desktopReorderGrabbed(var candidate, string expectedDesktopId, var expectedScreen, real sceneX,
                                 real sceneY)
    signal desktopReorderMoved(string expectedDesktopId, real sceneX, real sceneY)
    signal desktopReorderReleased(string expectedDesktopId, real sceneX, real sceneY)
    signal navigationTargetsChanged()
    signal windowDropped(var candidate, string expectedWindowId, var expectedSourceDesktop,
                         string expectedSourceDesktopId, var expectedTargetDesktop,
                         string expectedTargetDesktopId, var expectedScreen)
    signal windowCloseRequested(var candidate, string expectedWindowId, var expectedDesktop,
                                string expectedDesktopId, var expectedScreen)
    signal windowSpatialDragStarted(var source, real sceneX, real sceneY)
    signal windowSpatialDragMoved(var source, real sceneX, real sceneY)
    signal windowSpatialDragFinished(var source)
    signal windowTapped(var candidate, string expectedWindowId, var expectedDesktop, string expectedDesktopId,
                        var expectedScreen)

    readonly property var columns: context ? context.columns : []
    readonly property var desktopLabel: planDesktopLabel(desktop)
    readonly property bool desktopNamePresented: showDesktopNames && desktopLabel !== null
        && width >= 560 && height >= 72
    readonly property real contentLeft: desktopNamePresented ? Math.max(112, Math.min(170, width * 0.14)) : 42
    readonly property real contentTop: 10
    readonly property real contentWidth: Math.max(1, width - contentLeft - 10)
    readonly property real contentHeight: Math.max(1, height - contentTop * 2)
    readonly property bool searchDeemphasized: searchQuery.trim().length > 0 && searchResultCount === 0
    readonly property var spatialRowDimensions: spatialRowGeometryPlan && spatialRowGeometryPlan.dimensions
        ? spatialRowGeometryPlan.dimensions : null
    readonly property real sourceViewportWidth: projectionExtent(spatialRowDimensions
                                                                 ? spatialRowDimensions.outputWidth
                                                                 : screen && screen.geometry
                                                                   ? screen.geometry.width : 0, contentWidth)
    readonly property real sourceViewportHeight: projectionExtent(spatialRowDimensions
                                                                  ? spatialRowDimensions.outputHeight
                                                                  : screen && screen.geometry
                                                                    ? screen.geometry.height : 0, contentHeight)
    readonly property real projectionScale: finitePositive(contentHeight / sourceViewportHeight,
                                                           finitePositive(contentWidth / sourceViewportWidth, 1))
    readonly property real projectedViewportWidth: finitePositive(sourceViewportWidth * projectionScale,
                                                                  contentWidth)
    readonly property real projectedViewportHeight: finitePositive(sourceViewportHeight * projectionScale,
                                                                   contentHeight)
    readonly property real viewportOriginX: finiteNumber((contentWidth - projectedViewportWidth) / 2, 0)
    readonly property real viewportOriginY: finiteNumber((contentHeight - projectedViewportHeight) / 2, 0)
    readonly property real logicalViewportOffset: finiteNumber(previewViewportOffset, 0)
    readonly property var columnFrames: buildColumnFrames()
    readonly property var tiledPresentations: buildTiledPresentations()
    readonly property var spatialLiveColumnFrames: buildSpatialLiveColumnFrames(spatialLiveGeometryRevision)
    readonly property var floatingWindowIds: buildFloatingWindowIds()
    property int columnDelegateRevision: 0
    property int spatialLiveGeometryRevision: 0
    property int attentionRevision: 0

    color: windowDropArea.validTarget ? "#ee2f4057"
                                      : desktopReorderSource ? "#f050607a" : current ? "#f02b3548" : "#dc171e2a"
    border.width: windowDropArea.validTarget || current ? 2 : 1
    border.color: windowDropArea.validTarget ? "#86aee8" : current ? "#a8c7ff" : "#526179"
    radius: 8
    clip: true
    opacity: searchDeemphasized ? 0.42 : 1

    Item {
        id: numberGutter

        readonly property bool keyboardSelected: !card.current && card.searchQuery.trim().length === 0
            && card.keyboardSelectionId === card.desktopNavigationTargetId()
        readonly property bool attentionRequested: card.anyWindowDemandsAttention(card.attentionRevision)

        width: 42
        height: card.height

        Text {
            x: 12
            anchors.verticalCenter: parent.verticalCenter
            width: numberGutter.width - 18
            text: String(card.indexOfDesktop(card.desktopId) + 1)
            color: card.current ? "#f3f7ff" : "#b6c1d2"
            font.bold: card.current
            font.pixelSize: Math.max(12, Math.min(20, card.height * 0.2))
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
        }

        Rectangle {
            id: desktopAttentionBadge

            anchors.top: parent.top
            anchors.right: parent.right
            anchors.margins: 7
            width: 10
            height: width
            visible: numberGutter.attentionRequested
            color: "#e2556f"
            border.width: 1
            border.color: "#fff1f4"
            radius: width / 2
            z: 1
        }

        Loader {
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 5
            width: item ? item.implicitWidth : 0
            height: item ? item.implicitHeight : 0
            active: card.searchQuery.trim().length > 0 && card.searchResultCount > 0
            z: 1

            sourceComponent: Component {
                SearchMatchBadge {
                    count: card.searchResultCount
                }
            }
        }

        Rectangle {
            anchors.fill: parent
            anchors.margins: 3
            visible: numberGutter.keyboardSelected
            color: "transparent"
            border.width: 3
            border.color: "#ffd166"
            radius: 4
            z: 2
        }

        TapHandler {
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            enabled: !card.current && card.desktop && card.screen
            onTapped: card.desktopTapped(card.desktop, card.desktopId, card.screen)
        }

        DragHandler {
            id: desktopReorderHandler

            target: null
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            acceptedModifiers: Qt.NoModifier
            enabled: card.desktopReorderEnabled && card.desktop && card.screen

            onCentroidChanged: {
                if (active) {
                    card.desktopReorderMoved(card.desktopId, centroid.scenePosition.x, centroid.scenePosition.y);
                }
            }
            onGrabChanged: (transition, point) => {
                if (transition === PointerDevice.GrabExclusive) {
                    card.desktopReorderGrabbed(card.desktop, card.desktopId, card.screen, point.scenePosition.x,
                                               point.scenePosition.y);
                } else if (transition === PointerDevice.UngrabExclusive) {
                    if (point.state === EventPoint.Released) {
                        card.desktopReorderReleased(card.desktopId, point.scenePosition.x, point.scenePosition.y);
                    } else {
                        card.desktopReorderCanceled(card.desktopId);
                    }
                } else if (transition === PointerDevice.CancelGrabExclusive
                           || transition === PointerDevice.CancelGrabPassive) {
                    card.desktopReorderCanceled(card.desktopId);
                }
            }
        }
    }

    Item {
        id: desktopNameGutter

        x: 42
        width: Math.max(0, card.contentLeft - 42)
        height: card.height
        visible: card.desktopNamePresented

        Text {
            anchors.fill: parent
            anchors.leftMargin: 7
            anchors.rightMargin: 9
            text: card.desktopLabel ? card.desktopLabel.label : ""
            color: card.current ? "#e8eef9" : "#9eabbe"
            font.bold: card.current
            font.pixelSize: Math.max(10, Math.min(14, card.height * 0.12))
            horizontalAlignment: Text.AlignLeft
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
        }
    }

    Item {
        id: viewport

        x: card.contentLeft
        y: card.contentTop
        width: card.contentWidth
        height: card.contentHeight
        clip: true

        Rectangle {
            x: card.viewportOriginX
            y: card.viewportOriginY
            width: card.projectedViewportWidth
            height: card.projectedViewportHeight
            visible: width > 0 && height > 0
            enabled: false
            color: "transparent"
            border.width: 1
            border.color: "#708ba2c4"
            radius: 3
            z: 2000
        }

        Repeater {
            id: columnRepeater

            model: card.columns

            onItemAdded: card.columnDelegateRevision += 1
            onItemRemoved: card.columnDelegateRevision += 1

            Rectangle {
                id: columnShell

                required property var modelData
                required property int index

                readonly property var frame: card.columnShellFrame(index)

                x: frame.x
                y: 0
                width: frame.width
                height: viewport.height
                color: "#351e2938"
                border.width: card.context && card.context.activeColumnIndex === index ? 2 : 1
                border.color: card.context && card.context.activeColumnIndex === index ? "#9fc2ff" : "#45536a"
                radius: 4

                Repeater {
                    model: modelData.members

                    Rectangle {
                        required property int index

                        readonly property var memberPresentation:
                            card.tiledPresentations[columnShell.modelData.members[index].windowId]
                        readonly property var memberFrame: memberPresentation ? memberPresentation.thumbnailFrame : null

                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: memberFrame ? memberFrame.y : 0
                        height: memberFrame ? memberFrame.height : 0
                        visible: memberFrame !== null
                        color: "transparent"
                        border.width: 1
                        border.color: "#304057"
                    }
                }
            }
        }

        Item {
            id: emptyContentInput

            anchors.fill: parent
            z: 1

            TapHandler {
                acceptedButtons: Qt.LeftButton
                acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                enabled: !card.current && card.desktop && card.screen
                         && card.searchQuery.trim().length === 0
                onTapped: point => {
                    if (!card.viewportPointHitsWindow(point.position)) {
                        card.desktopTapped(card.desktop, card.desktopId, card.screen);
                    }
                }
            }
        }

        Repeater {
            id: windowRepeater

            model: KWin.WindowFilterModel {
                activity: KWin.Workspace.currentActivity
                desktop: card.desktop
                screenName: card.screen ? String(card.screen.name) : ""
                windowModel: KWin.WindowModel {}
                minimizedWindows: true
                windowType: ~KWin.WindowFilterModel.Dock & ~KWin.WindowFilterModel.Desktop &
                            ~KWin.WindowFilterModel.Notification & ~KWin.WindowFilterModel.CriticalNotification
            }

            onItemAdded: {
                card.navigationTargetsChanged();
                card.attentionRevision += 1;
                card.spatialLiveGeometryRevision += 1;
            }
            onItemRemoved: {
                card.navigationTargetsChanged();
                card.attentionRevision += 1;
                card.spatialLiveGeometryRevision += 1;
            }

            Item {
                id: windowPresentation

                readonly property var candidate: model.window
                property var actionSnapshot: null
                property int windowStateRevision: 0
                readonly property bool attentionRequested: card.windowDemandsAttention(candidate)
                readonly property string windowId: model.window ? String(model.window.internalId) : ""
                readonly property var tiledPresentation: card.tiledPresentations[windowId]
                readonly property var spatialLiveFrame: card.planSpatialLiveWindowFrame(model.window, windowId,
                                                                                         tiledPresentation)
                readonly property var frame: card.frameForWindow(model.window, windowId, tiledPresentation,
                                                                  spatialLiveFrame)
                readonly property var windowState: card.planWindowState(candidate, frame, tiledPresentation,
                                                                        windowStateRevision)
                readonly property bool matchesSearch: card.windowMatchesSearch(candidate, windowState)
                readonly property bool selectedThumbnail: !tiledPresentation || tiledPresentation.selected
                readonly property bool minimizedWindow: model.window ? model.window.minimized : false
                readonly property bool minimizedActivationEligible: minimizedWindow
                    && card.windowSnapshotCanActivateMinimizedWindow(windowPresentation)
                readonly property bool hasMinimizedTabFrame: tiledPresentation && tiledPresentation.tabFrame !== null
                    && tiledPresentation.tabFrame !== undefined
                readonly property var minimizedPlaceholderFrame: minimizedActivationEligible
                    ? card.planMinimizedPlaceholderFrame(frame, hasMinimizedTabFrame) : null
                readonly property var windowLabel: card.planWindowLabel(candidate, matchesSearch && model.window
                    && ((!minimizedWindow && selectedThumbnail && frame !== null && frame !== undefined)
                        || hasMinimizedTabFrame
                        || (minimizedPlaceholderFrame !== null && minimizedPlaceholderFrame !== undefined)))
                readonly property bool dragEligible: card.windowSnapshotCanDrag(windowPresentation)
                readonly property bool closeEligible: card.windowSnapshotCanRequestClose(windowPresentation)
                readonly property var sourceDesktop: card.desktop
                readonly property string sourceDesktopId: card.desktopId
                readonly property var sourceScreen: card.screen
                readonly property var thumbnailTarget: thumbnailShell
                readonly property var tabTarget: tabShell
                readonly property var minimizedPlaceholderTarget: minimizedPlaceholderShell
                property bool spatialDragLifecycleActive: false

                width: viewport.width
                height: viewport.height
                opacity: thumbnailShell.Drag.active || tabShell.Drag.active ? 0.72 : 1
                z: frame && frame.floating ? 1000 + index : 100 + index

                onCandidateChanged: {
                    refreshActionSnapshot();
                    card.attentionRevision += 1;
                }
                onAttentionRequestedChanged: card.attentionRevision += 1
                onMinimizedPlaceholderFrameChanged: card.navigationTargetsChanged()
                onWindowStateChanged: card.navigationTargetsChanged()

                Component.onCompleted: refreshActionSnapshot()

                function refreshActionSnapshot() {
                    actionSnapshot = card.snapshotWindowActions(candidate);
                    card.navigationTargetsChanged();
                }

                Connections {
                    target: windowPresentation.candidate
                    ignoreUnknownSignals: true

                    function onDeletedChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onFrameGeometryChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onFullScreenChanged() {
                        windowPresentation.windowStateRevision += 1;
                    }

                    function onMaximizedChanged() {
                        windowPresentation.windowStateRevision += 1;
                    }

                    function onCaptionChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onDesktopFileNameChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onMinimizedChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onOutputChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onWindowClassChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onWantsInputChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onCloseableChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onDesktopsChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onManagedChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onModalChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onMoveableChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onNormalWindowChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onTransientChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }

                    function onTransientForChanged() {
                        windowPresentation.refreshActionSnapshot();
                    }
                }

                Item {
                    id: thumbnailShell

                    readonly property bool keyboardTarget: windowPresentation.matchesSearch
                        && !windowPresentation.minimizedWindow
                        && (!windowPresentation.tiledPresentation || windowPresentation.tiledPresentation.selected)
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 52 && height >= 40

                    x: windowPresentation.frame ? windowPresentation.frame.x : 0
                    y: windowPresentation.frame ? windowPresentation.frame.y : 0
                    width: windowPresentation.frame ? Math.max(1, windowPresentation.frame.width) : 0
                    height: windowPresentation.frame ? Math.max(1, windowPresentation.frame.height) : 0
                    visible: windowPresentation.selectedThumbnail && windowPresentation.frame !== null
                             && windowPresentation.frame !== undefined && model.window
                             && !windowPresentation.minimizedWindow && windowPresentation.matchesSearch
                    clip: true

                    Drag.active: false
                    Drag.source: windowPresentation
                    Drag.hotSpot.x: thumbnailDragHandler.centroid.pressPosition.x
                                    + thumbnailDragHandler.activeTranslation.x
                    Drag.hotSpot.y: thumbnailDragHandler.centroid.pressPosition.y
                                    + thumbnailDragHandler.activeTranslation.y
                    Drag.keys: ["driftile-window"]
                    Drag.proposedAction: Qt.MoveAction
                    Drag.supportedActions: Qt.MoveAction

                    Rectangle {
                        anchors.fill: parent
                        color: "#131a25"
                    }

                    KWin.WindowThumbnail {
                        anchors.fill: parent
                        wId: model.window.internalId
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: KWin.Workspace.activeWindow === model.window ? 2 : 1
                        border.color: KWin.Workspace.activeWindow === model.window ? "#f4f8ff" : "#71839e"
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.bottom: parent.bottom
                        height: 3
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        z: 1
                    }

                    Rectangle {
                        id: thumbnailAttentionBadge

                        anchors.top: parent.top
                        anchors.right: parent.right
                        anchors.margins: 4
                        width: Math.max(8, Math.min(16, Math.min(thumbnailShell.width, thumbnailShell.height) * 0.22))
                        height: width
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        border.width: 1
                        border.color: "#fff1f4"
                        radius: width / 2
                        z: 2

                        Text {
                            anchors.centerIn: parent
                            text: "!"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: Math.max(7, thumbnailAttentionBadge.height * 0.7)
                        }
                    }

                    Rectangle {
                        id: thumbnailWindowStateBadge

                        anchors.top: parent.top
                        anchors.left: parent.left
                        anchors.margins: 5
                        width: windowStateBadgeText.implicitWidth + 12
                        height: 18
                        visible: card.showWindowStateBadges && thumbnailShell.visible
                                 && thumbnailShell.width >= 96 && thumbnailShell.height >= 52
                                 && card.windowStateBadgeEligible(windowPresentation.candidate,
                                                                  windowPresentation.windowState,
                                                                  windowPresentation.selectedThumbnail,
                                                                  windowPresentation.minimizedWindow)
                        color: "#dc111824"
                        border.width: 1
                        border.color: "#a06f829f"
                        radius: 3
                        z: 2

                        Text {
                            id: windowStateBadgeText

                            anchors.fill: parent
                            anchors.leftMargin: 6
                            anchors.rightMargin: 6
                            text: windowPresentation.windowState && windowPresentation.windowState.badge !== null
                                ? windowPresentation.windowState.badge : ""
                            color: "#f3f7ff"
                            font.bold: true
                            font.pixelSize: 10
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                            elide: Text.ElideRight
                            textFormat: Text.PlainText
                        }
                    }

                    Rectangle {
                        id: thumbnailLabelFooter

                        readonly property bool hasSecondary: windowPresentation.windowLabel !== null
                            && windowPresentation.windowLabel.secondary !== null

                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.bottom: parent.bottom
                        anchors.leftMargin: 5
                        anchors.rightMargin: 5
                        anchors.bottomMargin: windowPresentation.attentionRequested ? 8 : 5
                        height: hasSecondary ? 34 : 22
                        visible: card.showWindowLabels && windowPresentation.windowLabel !== null
                                 && thumbnailShell.width >= 120
                                 && thumbnailShell.height >= (hasSecondary ? 72 : 52)
                        color: "#dc111824"
                        border.width: 1
                        border.color: "#805f718a"
                        radius: 3
                        clip: true
                        z: 2

                        WindowApplicationIcon {
                            id: thumbnailApplicationIcon

                            anchors.left: parent.left
                            anchors.leftMargin: 6
                            anchors.verticalCenter: parent.verticalCenter
                            width: 16
                            height: 16
                            candidate: windowPresentation.candidate
                            presentationEligible: card.showApplicationIcons && thumbnailLabelFooter.visible
                                && thumbnailLabelFooter.width >= 160
                        }

                        Text {
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.top: parent.top
                            anchors.leftMargin: thumbnailApplicationIcon.iconAvailable ? 28 : 6
                            anchors.rightMargin: 6
                            anchors.topMargin: thumbnailLabelFooter.hasSecondary ? 3 : 0
                            height: thumbnailLabelFooter.hasSecondary ? 15 : parent.height
                            text: windowPresentation.windowLabel ? windowPresentation.windowLabel.primary : ""
                            color: "#f3f7ff"
                            font.bold: true
                            font.pixelSize: thumbnailLabelFooter.hasSecondary ? 11 : 12
                            horizontalAlignment: Text.AlignLeft
                            verticalAlignment: Text.AlignVCenter
                            elide: Text.ElideRight
                            textFormat: Text.PlainText
                        }

                        Text {
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.bottom: parent.bottom
                            anchors.leftMargin: thumbnailApplicationIcon.iconAvailable ? 28 : 6
                            anchors.rightMargin: 6
                            anchors.bottomMargin: 2
                            height: 14
                            visible: thumbnailLabelFooter.hasSecondary
                            text: windowPresentation.windowLabel && windowPresentation.windowLabel.secondary !== null
                                ? windowPresentation.windowLabel.secondary : ""
                            color: "#aebbd0"
                            font.pixelSize: 9
                            horizontalAlignment: Text.AlignLeft
                            verticalAlignment: Text.AlignVCenter
                            elide: Text.ElideRight
                            textFormat: Text.PlainText
                        }
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: thumbnailShell.keyboardSelected ? 3 : 0
                        border.color: "#ffd166"
                        z: 3
                    }

                    WindowCloseButton {
                        id: thumbnailCloseButton

                        anchors.top: parent.top
                        anchors.right: parent.right
                        anchors.topMargin: 5
                        anchors.rightMargin: windowPresentation.attentionRequested ? 24 : 5
                        width: 18
                        height: 18
                        settingEnabled: card.showWindowCloseButtons
                        closeEligible: windowPresentation.closeEligible
                        surfaceHovered: thumbnailHoverHandler.hovered
                        keyboardSelected: thumbnailShell.keyboardSelected
                        surfaceLargeEnough: thumbnailShell.closeButtonLargeEnough
                        z: 4
                        onCloseRequested: card.windowCloseRequested(windowPresentation.candidate,
                                                                    windowPresentation.windowId,
                                                                    windowPresentation.sourceDesktop,
                                                                    windowPresentation.sourceDesktopId,
                                                                    windowPresentation.sourceScreen)
                    }

                    HoverHandler {
                        id: thumbnailHoverHandler

                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: thumbnailShell.visible && card.desktop && card.screen
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(thumbnailCloseButton, thumbnailShell,
                                                              point.position)) {
                                return;
                            }
                            card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                              card.desktopId, card.screen);
                        }
                    }

                    TapHandler {
                        acceptedButtons: Qt.MiddleButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: thumbnailShell.visible && windowPresentation.closeEligible
                        onTapped: card.windowCloseRequested(windowPresentation.candidate,
                                                           windowPresentation.windowId,
                                                           windowPresentation.sourceDesktop,
                                                           windowPresentation.sourceDesktopId,
                                                           windowPresentation.sourceScreen)
                    }

                    DragHandler {
                        id: thumbnailDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        acceptedModifiers: Qt.NoModifier
                        enabled: thumbnailShell.visible && windowPresentation.dragEligible

                        onActiveTranslationChanged: {
                            if (thumbnailDragHandler.active) {
                                card.moveWindowSpatialDrag(windowPresentation,
                                                           thumbnailDragHandler.centroid.scenePosition);
                            }
                        }

                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                thumbnailShell.Drag.active = true;
                                card.beginWindowSpatialDrag(windowPresentation, point.scenePosition);
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released) {
                                    const source = windowPresentation;
                                    const action = thumbnailShell.Drag.drop();
                                    thumbnailShell.Drag.active = false;
                                    card.finishWindowSpatialDrag(source);
                                    if (action === Qt.MoveAction) {
                                        return;
                                    }
                                    card.requestCrossOutputWindowDrop(source, point);
                                } else {
                                    thumbnailShell.Drag.cancel();
                                    thumbnailShell.Drag.active = false;
                                    card.finishWindowSpatialDrag(windowPresentation);
                                }
                            } else if (transition === PointerDevice.CancelGrabExclusive
                                       || transition === PointerDevice.CancelGrabPassive) {
                                thumbnailShell.Drag.cancel();
                                thumbnailShell.Drag.active = false;
                                card.finishWindowSpatialDrag(windowPresentation);
                            }
                        }
                    }
                }

                Rectangle {
                    id: tabShell

                    readonly property var frame: windowPresentation.tiledPresentation
                        ? windowPresentation.tiledPresentation.tabFrame : null
                    readonly property bool activationEligible: windowPresentation.tiledPresentation
                        && (windowPresentation.minimizedWindow
                            ? windowPresentation.minimizedActivationEligible
                            : !windowPresentation.tiledPresentation.selected)
                    readonly property bool keyboardTarget: activationEligible && windowPresentation.matchesSearch
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 52 && height >= 18

                    x: frame ? frame.x : 0
                    y: frame ? frame.y : 0
                    width: frame ? frame.width : 0
                    height: frame ? frame.height : 0
                    visible: frame !== null && model.window && windowPresentation.matchesSearch
                    opacity: windowPresentation.minimizedWindow ? 0.6 : 1
                    color: windowPresentation.minimizedWindow ? "#252e3d"
                                                               : windowPresentation.tiledPresentation
                                                                 && windowPresentation.tiledPresentation.selected
                                                                 ? "#7085a8" : "#34435a"
                    border.width: 1
                    border.color: windowPresentation.minimizedWindow ? "#536176"
                                                                     : windowPresentation.tiledPresentation
                                                                       && windowPresentation.tiledPresentation.selected
                                                                       ? "#f4f8ff" : "#71839e"
                    radius: 2
                    clip: true

                    Drag.active: false
                    Drag.source: windowPresentation
                    Drag.hotSpot.x: tabDragHandler.centroid.pressPosition.x + tabDragHandler.activeTranslation.x
                    Drag.hotSpot.y: tabDragHandler.centroid.pressPosition.y + tabDragHandler.activeTranslation.y
                    Drag.keys: ["driftile-window"]
                    Drag.proposedAction: Qt.MoveAction
                    Drag.supportedActions: Qt.MoveAction

                    WindowApplicationIcon {
                        id: tabApplicationIcon

                        anchors.left: parent.left
                        anchors.leftMargin: 5
                        anchors.verticalCenter: parent.verticalCenter
                        width: Math.max(10, Math.min(14, tabShell.height - 6))
                        height: width
                        candidate: windowPresentation.candidate
                        presentationEligible: card.showApplicationIcons && tabShell.visible
                            && tabShell.width >= 84 && tabShell.height >= 18
                    }

                    Text {
                        anchors.fill: parent
                        anchors.leftMargin: tabApplicationIcon.iconAvailable
                            ? tabApplicationIcon.x + tabApplicationIcon.width + 5 : 4
                        anchors.rightMargin: tabCloseButton.visible
                            ? (windowPresentation.attentionRequested ? 34 : 20)
                            : (windowPresentation.attentionRequested ? 18 : 4)
                        text: windowPresentation.windowLabel ? windowPresentation.windowLabel.primary
                                                             : windowPresentation.tiledPresentation
                                                               ? String(windowPresentation.tiledPresentation.memberIndex + 1)
                                                               : ""
                        color: windowPresentation.minimizedWindow ? "#8a96a8" : "#f3f7ff"
                        font.pixelSize: Math.max(8, Math.min(12, tabShell.height * 0.55))
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        width: 3
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        z: 1
                    }

                    Rectangle {
                        id: tabAttentionBadge

                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.rightMargin: 3
                        width: Math.max(8, Math.min(12, tabShell.height - 4))
                        height: width
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        border.width: 1
                        border.color: "#fff1f4"
                        radius: width / 2
                        z: 2

                        Text {
                            anchors.centerIn: parent
                            text: "!"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: Math.max(7, tabAttentionBadge.height * 0.72)
                        }
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: tabShell.keyboardSelected ? 3 : 0
                        border.color: "#ffd166"
                        radius: tabShell.radius
                        z: 3
                    }

                    WindowCloseButton {
                        id: tabCloseButton

                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.rightMargin: windowPresentation.attentionRequested ? 18 : 3
                        width: 14
                        height: 14
                        settingEnabled: card.showWindowCloseButtons
                        closeEligible: windowPresentation.closeEligible
                        surfaceHovered: tabHoverHandler.hovered
                        keyboardSelected: tabShell.keyboardSelected
                        surfaceLargeEnough: tabShell.closeButtonLargeEnough
                        z: 4
                        onCloseRequested: card.windowCloseRequested(windowPresentation.candidate,
                                                                    windowPresentation.windowId,
                                                                    windowPresentation.sourceDesktop,
                                                                    windowPresentation.sourceDesktopId,
                                                                    windowPresentation.sourceScreen)
                    }

                    HoverHandler {
                        id: tabHoverHandler

                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: tabShell.visible && tabShell.activationEligible && card.desktop && card.screen
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(tabCloseButton, tabShell, point.position)) {
                                return;
                            }
                            card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                              card.desktopId, card.screen);
                        }
                    }

                    TapHandler {
                        acceptedButtons: Qt.MiddleButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: tabShell.visible && windowPresentation.closeEligible
                        onTapped: card.windowCloseRequested(windowPresentation.candidate,
                                                           windowPresentation.windowId,
                                                           windowPresentation.sourceDesktop,
                                                           windowPresentation.sourceDesktopId,
                                                           windowPresentation.sourceScreen)
                    }

                    DragHandler {
                        id: tabDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        acceptedModifiers: Qt.NoModifier
                        enabled: tabShell.visible && windowPresentation.tiledPresentation
                                 && !windowPresentation.minimizedWindow && windowPresentation.dragEligible

                        onActiveTranslationChanged: {
                            if (tabDragHandler.active) {
                                card.moveWindowSpatialDrag(windowPresentation, tabDragHandler.centroid.scenePosition);
                            }
                        }

                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                tabShell.Drag.active = true;
                                card.beginWindowSpatialDrag(windowPresentation, point.scenePosition);
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released) {
                                    const source = windowPresentation;
                                    const action = tabShell.Drag.drop();
                                    tabShell.Drag.active = false;
                                    card.finishWindowSpatialDrag(source);
                                    if (action === Qt.MoveAction) {
                                        return;
                                    }
                                    card.requestCrossOutputWindowDrop(source, point);
                                } else {
                                    tabShell.Drag.cancel();
                                    tabShell.Drag.active = false;
                                    card.finishWindowSpatialDrag(windowPresentation);
                                }
                            } else if (transition === PointerDevice.CancelGrabExclusive
                                       || transition === PointerDevice.CancelGrabPassive) {
                                tabShell.Drag.cancel();
                                tabShell.Drag.active = false;
                                card.finishWindowSpatialDrag(windowPresentation);
                            }
                        }
                    }
                }

                Rectangle {
                    id: minimizedPlaceholderShell

                    readonly property var frame: windowPresentation.minimizedPlaceholderFrame
                    readonly property bool activationEligible: windowPresentation.minimizedActivationEligible
                    readonly property bool keyboardTarget: activationEligible && windowPresentation.matchesSearch
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 72 && height >= 20

                    x: frame ? frame.x : 0
                    y: frame ? frame.y : 0
                    width: frame ? frame.width : 0
                    height: frame ? frame.height : 0
                    visible: frame !== null && model.window && windowPresentation.minimizedWindow
                             && windowPresentation.matchesSearch
                    color: "#dc252e3d"
                    border.width: 1
                    border.color: "#66758b"
                    radius: 3
                    clip: true

                    WindowApplicationIcon {
                        id: minimizedPlaceholderApplicationIcon

                        anchors.left: parent.left
                        anchors.leftMargin: 7
                        anchors.verticalCenter: parent.verticalCenter
                        width: Math.max(10, Math.min(16, minimizedPlaceholderShell.height - 8))
                        height: width
                        candidate: windowPresentation.candidate
                        presentationEligible: card.showApplicationIcons && minimizedPlaceholderShell.visible
                            && minimizedPlaceholderShell.width >= 120
                            && minimizedPlaceholderShell.height >= 20
                    }

                    Text {
                        anchors.fill: parent
                        anchors.leftMargin: minimizedPlaceholderApplicationIcon.iconAvailable
                            ? minimizedPlaceholderApplicationIcon.x + minimizedPlaceholderApplicationIcon.width + 5 : 7
                        anchors.rightMargin: minimizedPlaceholderCloseButton.visible
                            ? (windowPresentation.attentionRequested ? 35 : 22)
                            : (windowPresentation.attentionRequested
                                ? Math.min(18, minimizedPlaceholderShell.width * 0.42) : 7)
                        text: windowPresentation.windowLabel
                            ? `Minimized · ${windowPresentation.windowLabel.primary}` : "Minimized"
                        color: "#d9e2ef"
                        font.pixelSize: Math.max(7, Math.min(11, minimizedPlaceholderShell.height * 0.48))
                        font.bold: true
                        verticalAlignment: Text.AlignVCenter
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        width: 3
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        z: 1
                    }

                    Rectangle {
                        id: minimizedPlaceholderAttentionBadge

                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.rightMargin: 4
                        width: Math.max(8, Math.min(12, minimizedPlaceholderShell.height - 6))
                        height: width
                        visible: windowPresentation.attentionRequested
                        color: "#e2556f"
                        border.width: 1
                        border.color: "#fff1f4"
                        radius: width / 2
                        z: 2

                        Text {
                            anchors.centerIn: parent
                            text: "!"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: Math.max(7, minimizedPlaceholderAttentionBadge.height * 0.72)
                        }
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: minimizedPlaceholderShell.keyboardSelected ? 3 : 0
                        border.color: "#ffd166"
                        radius: minimizedPlaceholderShell.radius
                        z: 3
                    }

                    WindowCloseButton {
                        id: minimizedPlaceholderCloseButton

                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.rightMargin: windowPresentation.attentionRequested ? 19 : 4
                        width: 14
                        height: 14
                        settingEnabled: card.showWindowCloseButtons
                        closeEligible: windowPresentation.closeEligible
                        surfaceHovered: minimizedPlaceholderHoverHandler.hovered
                        keyboardSelected: minimizedPlaceholderShell.keyboardSelected
                        surfaceLargeEnough: minimizedPlaceholderShell.closeButtonLargeEnough
                        z: 4
                        onCloseRequested: card.windowCloseRequested(windowPresentation.candidate,
                                                                    windowPresentation.windowId,
                                                                    windowPresentation.sourceDesktop,
                                                                    windowPresentation.sourceDesktopId,
                                                                    windowPresentation.sourceScreen)
                    }

                    HoverHandler {
                        id: minimizedPlaceholderHoverHandler

                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: minimizedPlaceholderShell.visible && minimizedPlaceholderShell.activationEligible
                                 && card.desktop && card.screen
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(minimizedPlaceholderCloseButton,
                                                              minimizedPlaceholderShell, point.position)) {
                                return;
                            }
                            card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                              card.desktopId, card.screen);
                        }
                    }

                    TapHandler {
                        acceptedButtons: Qt.MiddleButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: minimizedPlaceholderShell.visible && windowPresentation.closeEligible
                        onTapped: card.windowCloseRequested(windowPresentation.candidate,
                                                           windowPresentation.windowId,
                                                           windowPresentation.sourceDesktop,
                                                           windowPresentation.sourceDesktopId,
                                                           windowPresentation.sourceScreen)
                    }
                }
            }
        }

        Rectangle {
            id: activeColumnBadge

            readonly property int activeColumnIndex: card.context
                && Number.isInteger(card.context.activeColumnIndex) ? card.context.activeColumnIndex : -1
            readonly property var activeColumn: activeColumnIndex >= 0 && activeColumnIndex < card.columns.length
                ? card.context.columns[activeColumnIndex] : null
            readonly property var activeColumnShell: card.columnDelegateAt(columnRepeater, activeColumnIndex,
                                                                            card.columnDelegateRevision)
            readonly property bool frameValid: activeColumnShell !== null
                && Number.isFinite(activeColumnShell.x) && Number.isFinite(activeColumnShell.width)
                && activeColumnShell.width > 0
            readonly property real visibleLeft: frameValid ? Math.max(0, activeColumnShell.x) : 0
            readonly property real visibleRight: frameValid
                ? Math.min(viewport.width, activeColumnShell.x + activeColumnShell.width) : 0
            readonly property real visibleWidth: Math.max(0, visibleRight - visibleLeft)
            readonly property string label: card.layoutBadgeLabel(activeColumn)
            readonly property real labelWidth: Math.ceil(activeColumnBadgeText.implicitWidth)

            x: visibleLeft + 4
            y: viewport.height - height - 4
            width: labelWidth + 12
            height: 20
            visible: viewport.height >= 28 && label.length > 0 && frameValid
                     && visibleWidth >= labelWidth + 20
            color: "#e61a2230"
            border.width: 1
            border.color: "#9fc2ff"
            radius: 4
            z: 9000

            Text {
                id: activeColumnBadgeText

                anchors.centerIn: parent
                text: activeColumnBadge.label
                color: "#f3f7ff"
                font.bold: true
                font.pixelSize: 11
                textFormat: Text.PlainText
            }
        }
    }

    DropArea {
        id: windowDropArea

        readonly property bool validTarget: containsDrag && card.windowDropSourceIsEligible(drag.source, drag.keys)

        anchors.fill: parent
        keys: ["driftile-window"]
        z: 10000

        onEntered: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)
        onPositionChanged: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)
        onDropped: drop => {
            const source = drop.source;
            if (!card.windowDropIsValid(source, drop.keys)) {
                drop.accepted = false;
                return;
            }

            drop.action = Qt.MoveAction;
            drop.accepted = true;
            card.windowDropped(source.candidate, source.windowId, source.sourceDesktop, source.sourceDesktopId,
                               card.desktop, card.desktopId, card.screen);
        }
    }

    onCurrentChanged: card.navigationTargetsChanged()
    onSearchQueryChanged: card.navigationTargetsChanged()

    function collectNavigationTargets(sceneItem, includeOffscreen = false) {
        const targets = [];
        if (!sceneItem || !desktop || !screen || desktop.id === undefined || desktop.id === null
                || desktopId.length === 0 || String(desktop.id) !== desktopId) {
            return targets;
        }

        if (!current && searchQuery.trim().length === 0) {
            const gutterRect = clippedCardNavigationRect(numberGutter, sceneItem, includeOffscreen);
            if (gutterRect) {
                targets.push({
                    candidate: desktop,
                    desktop,
                    desktopId,
                    id: desktopNavigationTargetId(),
                    kind: "desktop",
                    rect: gutterRect,
                    screen
                });
            }
        }

        for (let index = 0; index < windowRepeater.count; index += 1) {
            const presentation = windowRepeater.itemAt(index);
            if (!presentation || !presentation.matchesSearch || !windowCanNavigate(presentation)) {
                continue;
            }

            const visual = presentation.minimizedWindow
                ? presentation.hasMinimizedTabFrame ? presentation.tabTarget : presentation.minimizedPlaceholderTarget
                                                        : presentation.tiledPresentation
                                                          && !presentation.tiledPresentation.selected
                                                          ? presentation.tabTarget : presentation.thumbnailTarget;
            const rect = clippedNavigationRect(visual, sceneItem, includeOffscreen);
            if (!rect) {
                continue;
            }

            targets.push({
                candidate: presentation.candidate,
                desktop,
                desktopId,
                id: navigationTargetId(presentation.windowId),
                kind: "window",
                rect,
                screen,
                window: presentation.candidate,
                windowId: presentation.windowId
            });
        }

        return targets;
    }

    function viewportPointHitsWindow(point) {
        for (let index = 0; index < windowRepeater.count; index += 1) {
            const presentation = windowRepeater.itemAt(index);
            if (!presentation) {
                continue;
            }
            if (visualContainsViewportPoint(presentation.thumbnailTarget, point)
                    || visualContainsViewportPoint(presentation.tabTarget, point)
                    || visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)) {
                return true;
            }
        }
        return false;
    }

    function visualContainsViewportPoint(visual, point) {
        if (!visual || !visual.visible || visual.width <= 0 || visual.height <= 0) {
            return false;
        }
        const localPoint = visual.mapFromItem(emptyContentInput, point.x, point.y);
        return localPoint.x >= 0 && localPoint.y >= 0
            && localPoint.x < visual.width && localPoint.y < visual.height;
    }

    function closeButtonContainsPoint(button, surface, point) {
        if (!button || !button.visible) {
            return false;
        }
        if (!surface || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || button.width <= 0 || button.height <= 0) {
            return true;
        }

        try {
            const localPoint = button.mapFromItem(surface, point.x, point.y);
            return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
                && localPoint.x >= 0 && localPoint.y >= 0
                && localPoint.x < button.width && localPoint.y < button.height;
        } catch (error) {
            return true;
        }
    }

    function desktopNavigationTargetId() {
        return JSON.stringify(["desktop", desktopId]);
    }

    function navigationTargetId(windowId) {
        return JSON.stringify(["window", desktopId, windowId]);
    }

    function snapshotWindowActions(candidate) {
        if (!candidate) {
            return null;
        }

        try {
            const internalId = candidate.internalId;
            let desktops = null;
            const desktopIds = [];
            if (candidate.desktops) {
                desktops = [];
                for (const candidateDesktop of candidate.desktops) {
                    desktops.push(candidateDesktop);
                    desktopIds.push(String(candidateDesktop.id));
                }
            }

            return {
                closeable: candidate.closeable === true && typeof candidate.closeWindow === "function",
                deleted: candidate.deleted === true,
                desktopIds,
                desktops,
                managed: candidate.managed === true,
                minimized: candidate.minimized === true,
                modal: candidate.modal,
                moveable: candidate.moveable === true,
                normalWindow: candidate.normalWindow === true,
                output: candidate.output,
                transient: candidate.transient,
                transientFor: candidate.transientFor,
                wantsInput: candidate.wantsInput === true,
                windowId: internalId === undefined || internalId === null ? "" : String(internalId)
            };
        } catch (error) {
            return null;
        }
    }

    function windowSnapshotCanDrag(presentation) {
        try {
            const snapshot = presentation ? presentation.actionSnapshot : null;
            const sourceDesktop = presentation ? presentation.sourceDesktop : null;
            const sourceDesktopId = presentation ? presentation.sourceDesktopId : null;
            const sourceScreen = presentation ? presentation.sourceScreen : null;
            if (!snapshot || presentation.matchesSearch !== true || snapshot.deleted || snapshot.minimized
                    || snapshot.wantsInput !== true || snapshot.normalWindow !== true || snapshot.managed !== true
                    || snapshot.moveable !== true || snapshot.modal !== false || snapshot.windowId.length === 0
                    || !sourceDesktop || typeof sourceDesktopId !== "string" || sourceDesktopId.length === 0
                    || !sourceScreen || snapshot.output !== sourceScreen
                    || snapshot.transient !== false || snapshot.transientFor !== null) {
                return false;
            }

            const desktops = snapshot.desktops;
            return desktops && desktops.length === 1 && desktops[0] === sourceDesktop
                    && snapshot.desktopIds.length === 1 && snapshot.desktopIds[0] === sourceDesktopId;
        } catch (error) {
            return false;
        }
    }

    function windowSnapshotCanRequestClose(presentation) {
        try {
            const snapshot = presentation ? presentation.actionSnapshot : null;
            const candidate = presentation ? presentation.candidate : null;
            const expectedDesktop = presentation ? presentation.sourceDesktop : null;
            const expectedDesktopId = presentation ? presentation.sourceDesktopId : "";
            const expectedScreen = presentation ? presentation.sourceScreen : null;
            if (!snapshot || !candidate || presentation.matchesSearch !== true || snapshot.deleted
                    || snapshot.managed !== true || snapshot.closeable !== true || snapshot.windowId.length === 0
                    || snapshot.windowId !== presentation.windowId
                    || snapshot.minimized !== (presentation.minimizedWindow === true)
                    || candidate.deleted === true || candidate.managed !== true || candidate.closeable !== true
                    || candidate.minimized !== snapshot.minimized
                    || candidate.internalId === undefined || candidate.internalId === null
                    || String(candidate.internalId) !== snapshot.windowId
                    || !expectedDesktop || typeof expectedDesktopId !== "string" || expectedDesktopId.length === 0
                    || !expectedScreen || snapshot.output !== expectedScreen || candidate.output !== expectedScreen) {
                return false;
            }

            if (!snapshot.desktops) {
                return false;
            }
            if (snapshot.desktops.length === 0) {
                return true;
            }

            for (let index = 0; index < snapshot.desktops.length; index += 1) {
                if (snapshot.desktops[index] === expectedDesktop && snapshot.desktopIds[index] === expectedDesktopId) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    function windowCanDrag(presentation) {
        try {
            const candidate = presentation ? presentation.candidate : null;
            const windowId = presentation ? presentation.windowId : null;
            const sourceDesktop = presentation ? presentation.sourceDesktop : null;
            const sourceDesktopId = presentation ? presentation.sourceDesktopId : null;
            const sourceScreen = presentation ? presentation.sourceScreen : null;
            if (!candidate || presentation.matchesSearch !== true || candidate.deleted || candidate.minimized
                    || presentation.minimizedWindow
                    || candidate.wantsInput !== true || candidate.normalWindow !== true
                    || candidate.managed !== true || candidate.moveable !== true || candidate.modal !== false
                    || candidate.internalId === undefined || candidate.internalId === null
                    || typeof windowId !== "string" || windowId.length === 0
                    || String(candidate.internalId) !== windowId || !sourceDesktop
                    || sourceDesktop.id === undefined || sourceDesktop.id === null
                    || typeof sourceDesktopId !== "string" || sourceDesktopId.length === 0
                    || String(sourceDesktop.id) !== sourceDesktopId || !sourceScreen
                    || candidate.output !== sourceScreen || candidate.transient !== false
                    || candidate.transientFor !== null) {
                return false;
            }

            const desktops = candidate.desktops;
            return desktops && desktops.length === 1 && desktops[0] === sourceDesktop
                    && String(desktops[0].id) === sourceDesktopId;
        } catch (error) {
            return false;
        }
    }

    function requestCrossOutputWindowDrop(source, point) {
        if (!source || !point || !screen || !Number.isFinite(point.scenePosition.x)
                || !Number.isFinite(point.scenePosition.y)) {
            return;
        }

        const effect = KWin.SceneView.effect;
        if (!effect || typeof effect.checkItemDroppedOutOfScreen !== "function") {
            return;
        }

        let globalPosition;
        try {
            globalPosition = screen.mapToGlobal(point.scenePosition);
        } catch (error) {
            return;
        }
        if (!globalPosition || !Number.isFinite(globalPosition.x) || !Number.isFinite(globalPosition.y)) {
            return;
        }

        try {
            effect.checkItemDroppedOutOfScreen(globalPosition, source);
        } catch (error) {
            return;
        }
    }

    function beginWindowSpatialDrag(source, scenePosition) {
        try {
            if (!spatialDragSourceIsOwned(source) || source.dragEligible !== true
                    || source.minimizedWindow === true || source.spatialDragLifecycleActive === true
                    || !spatialDragScenePointIsFinite(scenePosition)) {
                return;
            }

            source.spatialDragLifecycleActive = true;
            windowSpatialDragStarted(source, scenePosition.x, scenePosition.y);
        } catch (error) {
            return;
        }
    }

    function moveWindowSpatialDrag(source, scenePosition) {
        try {
            if (!spatialDragSourceIsOwned(source) || source.spatialDragLifecycleActive !== true
                    || !spatialDragScenePointIsFinite(scenePosition)) {
                return;
            }

            windowSpatialDragMoved(source, scenePosition.x, scenePosition.y);
        } catch (error) {
            return;
        }
    }

    function finishWindowSpatialDrag(source) {
        try {
            if (!source || source.spatialDragLifecycleActive !== true) {
                return;
            }

            source.spatialDragLifecycleActive = false;
            windowSpatialDragFinished(source);
        } catch (error) {
            return;
        }
    }

    function spatialDragSourceIsOwned(source) {
        try {
            const candidate = source ? source.candidate : null;
            return source && candidate && typeof source.windowId === "string" && source.windowId.length > 0
                    && candidate.internalId !== undefined && candidate.internalId !== null
                    && String(candidate.internalId) === source.windowId
                    && source.sourceDesktop === desktop && typeof source.sourceDesktopId === "string"
                    && source.sourceDesktopId.length > 0 && source.sourceDesktopId === desktopId
                    && source.sourceScreen === screen;
        } catch (error) {
            return false;
        }
    }

    function spatialDragScenePointIsFinite(scenePosition) {
        return scenePosition && Number.isFinite(scenePosition.x) && Number.isFinite(scenePosition.y);
    }

    function windowDropIsValid(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-window") >= 0
                    && windowCanDrag(source) && desktop && screen && desktop.id !== undefined && desktop.id !== null
                    && String(desktop.id) === desktopId && source.sourceScreen === screen
                    && source.sourceDesktopId !== desktopId;
        } catch (error) {
            return false;
        }
    }

    function windowDropSourceIsEligible(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-window") >= 0 && source
                    && source.dragEligible === true && desktop && screen && desktopId.length > 0
                    && source.sourceScreen === screen && source.sourceDesktopId !== desktopId;
        } catch (error) {
            return false;
        }
    }

    function windowIsActionable(candidate) {
        return candidate && !candidate.deleted && !candidate.minimized && candidate.wantsInput === true
                && candidate.output === screen && candidate.internalId !== undefined && candidate.internalId !== null
                && String(candidate.internalId).length > 0;
    }

    function windowCanNavigate(presentation) {
        return presentation && (windowIsActionable(presentation.candidate)
                                || windowSnapshotCanActivateMinimizedWindow(presentation));
    }

    function windowSnapshotCanActivateMinimizedWindow(presentation) {
        try {
            const snapshot = presentation ? presentation.actionSnapshot : null;
            const candidate = presentation ? presentation.candidate : null;
            const expectedDesktop = presentation ? presentation.sourceDesktop : null;
            const expectedDesktopId = presentation ? presentation.sourceDesktopId : "";
            const expectedScreen = presentation ? presentation.sourceScreen : null;
            if (!snapshot || !candidate || presentation.matchesSearch !== true
                    || presentation.minimizedWindow !== true
                    || snapshot.deleted || snapshot.minimized !== true || snapshot.managed !== true
                    || snapshot.wantsInput !== true || snapshot.windowId.length === 0
                    || snapshot.windowId !== presentation.windowId
                    || candidate.deleted === true || candidate.minimized !== true || candidate.managed !== true
                    || candidate.wantsInput !== true || candidate.internalId === undefined
                    || candidate.internalId === null || String(candidate.internalId) !== snapshot.windowId
                    || !expectedDesktop || typeof expectedDesktopId !== "string" || expectedDesktopId.length === 0
                    || !expectedScreen || snapshot.output !== expectedScreen || candidate.output !== expectedScreen) {
                return false;
            }

            const desktops = snapshot.desktops;
            if (!desktops) {
                return false;
            }
            if (desktops.length === 0) {
                return true;
            }

            for (let index = 0; index < desktops.length; index += 1) {
                if (desktops[index] === expectedDesktop && snapshot.desktopIds[index] === expectedDesktopId) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    function planMinimizedPlaceholderFrame(frame, hasMinimizedTabFrame) {
        if (hasMinimizedTabFrame === true || !frame || !viewport || viewport.width <= 0 || viewport.height <= 0) {
            return null;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewMinimizedPlaceholder !== "function") {
                return null;
            }

            const planned = runtime.planOverviewMinimizedPlaceholder(frame, {
                height: viewport.height,
                width: viewport.width,
                x: 0,
                y: 0
            });
            if (!planned || Array.isArray(planned) || typeof planned !== "object") {
                return null;
            }

            const x = planned.x;
            const y = planned.y;
            const width = planned.width;
            const height = planned.height;
            if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number"
                    || typeof height !== "number" || !Number.isFinite(x) || !Number.isFinite(y)
                    || !Number.isFinite(width) || !Number.isFinite(height) || width < 24 || height < 12
                    || width > 180 || height > 28) {
                return null;
            }

            const frameLeft = Math.max(0, frame.x);
            const frameTop = Math.max(0, frame.y);
            const frameRight = Math.min(viewport.width, frame.x + frame.width);
            const frameBottom = Math.min(viewport.height, frame.y + frame.height);
            if (!Number.isFinite(frameLeft) || !Number.isFinite(frameTop) || !Number.isFinite(frameRight)
                    || !Number.isFinite(frameBottom) || x < frameLeft || y < frameTop
                    || x + width > frameRight || y + height > frameBottom) {
                return null;
            }

            return {
                height,
                width,
                x,
                y
            };
        } catch (error) {
            return null;
        }
    }

    function planDesktopLabel(desktop) {
        if (!desktop) {
            return null;
        }

        try {
            const name = desktop.name;
            if (typeof name !== "string") {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewDesktopLabel !== "function") {
                return null;
            }

            const planned = runtime.planOverviewDesktopLabel({
                name
            });
            if (!planned || Array.isArray(planned) || typeof planned !== "object"
                    || !boundedPlainDesktopLabel(planned.label)) {
                return null;
            }

            return {
                label: planned.label
            };
        } catch (error) {
            return null;
        }
    }

    function boundedPlainDesktopLabel(value) {
        if (typeof value !== "string" || value.length === 0 || value.length > 128) {
            return false;
        }

        let codePoints = 0;
        for (let offset = 0; offset < value.length;) {
            const codePoint = value.codePointAt(offset);
            if (!Number.isInteger(codePoint) || codePoint <= 0x1f || codePoint === 0x7f
                    || (codePoint >= 0x80 && codePoint <= 0x9f)
                    || codePoint === 0x2028 || codePoint === 0x2029) {
                return false;
            }

            offset += codePoint > 0xffff ? 2 : 1;
            codePoints += 1;
            if (codePoints > 64) {
                return false;
            }
        }

        return true;
    }

    function planWindowState(candidate, frame, tiledPresentation, revision) {
        if (!candidate || !Number.isInteger(revision) || revision < 0) {
            return null;
        }

        try {
            if (candidate.deleted !== false) {
                return null;
            }

            const fullScreen = candidate.fullScreen;
            const maximizeMode = candidate.maximizeMode;
            let floating;
            if (frame !== null && frame !== undefined) {
                floating = frame.floating;
            } else if (tiledPresentation !== null && tiledPresentation !== undefined) {
                floating = false;
            } else {
                return null;
            }

            if (typeof fullScreen !== "boolean" || typeof floating !== "boolean"
                    || typeof maximizeMode !== "number" || !Number.isInteger(maximizeMode)
                    || maximizeMode < 0 || maximizeMode > 3) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewWindowState !== "function") {
                return null;
            }

            const planned = runtime.planOverviewWindowState({
                floating,
                fullScreen,
                maximizeMode
            });
            if (!windowStatePlanIsValid(planned)) {
                return null;
            }

            return {
                badge: planned.badge,
                searchText: planned.searchText
            };
        } catch (error) {
            return null;
        }
    }

    function windowStatePlanIsValid(planned) {
        if (!planned || Array.isArray(planned) || typeof planned !== "object"
                || typeof planned.searchText !== "string") {
            return false;
        }

        const badge = planned.badge;
        const searchText = planned.searchText;
        if (badge === null) {
            return searchText.length === 0;
        }
        if (badge === "Floating") {
            return searchText === "floating";
        }
        if (badge === "Maximized") {
            return searchText === "maximized" || searchText === "maximized floating";
        }
        if (badge === "Fullscreen") {
            return searchText === "fullscreen" || searchText === "fullscreen floating"
                    || searchText === "fullscreen maximized"
                    || searchText === "fullscreen maximized floating";
        }

        return false;
    }

    function windowStateBadgeEligible(candidate, windowState, selectedThumbnail, minimizedWindow) {
        if (!candidate || !windowState || windowState.badge === null || selectedThumbnail !== true
                || minimizedWindow === true) {
            return false;
        }

        try {
            return candidate.deleted === false && candidate.normalWindow === true;
        } catch (error) {
            return false;
        }
    }

    function planWindowLabel(candidate, eligible) {
        if (eligible !== true || !candidate) {
            return null;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewWindowLabel !== "function") {
                return null;
            }

            const caption = candidate.caption;
            const desktopFileName = candidate.desktopFileName;
            const resourceClass = candidate.resourceClass;
            const resourceName = candidate.resourceName;
            if (!windowLabelFieldIsValid(caption) || !windowLabelFieldIsValid(desktopFileName)
                    || !windowLabelFieldIsValid(resourceClass) || !windowLabelFieldIsValid(resourceName)) {
                return null;
            }

            const planned = runtime.planOverviewWindowLabel({
                caption: caption === null ? undefined : caption,
                desktopFileName: desktopFileName === null ? undefined : desktopFileName,
                resourceClass: resourceClass === null ? undefined : resourceClass,
                resourceName: resourceName === null ? undefined : resourceName
            }, card.showApplicationIdentity);
            if (!planned || Array.isArray(planned) || typeof planned !== "object") {
                return null;
            }

            const primary = planned.primary;
            const secondary = planned.secondary;
            if (!boundedPlainWindowLabel(primary)
                    || (secondary !== null && !boundedPlainWindowLabel(secondary))) {
                return null;
            }

            return {
                primary,
                secondary
            };
        } catch (error) {
            return null;
        }
    }

    function windowLabelFieldIsValid(value) {
        return value === undefined || value === null || typeof value === "string";
    }

    function boundedPlainWindowLabel(value) {
        if (typeof value !== "string" || value.length === 0 || value.length > 192) {
            return false;
        }

        let codePoints = 0;
        for (let offset = 0; offset < value.length;) {
            const codePoint = value.codePointAt(offset);
            if (!Number.isInteger(codePoint) || codePoint <= 0x1f || codePoint === 0x7f
                    || (codePoint >= 0x80 && codePoint <= 0x9f)
                    || codePoint === 0x2028 || codePoint === 0x2029) {
                return false;
            }

            offset += codePoint > 0xffff ? 2 : 1;
            codePoints += 1;
            if (codePoints > 96) {
                return false;
            }
        }

        return true;
    }

    function anyWindowDemandsAttention(revision) {
        if (!Number.isInteger(revision) || revision < 0) {
            return false;
        }

        for (let index = 0; index < windowRepeater.count; index += 1) {
            const presentation = windowRepeater.itemAt(index);
            if (presentation && presentation.candidate && presentation.attentionRequested === true) {
                return true;
            }
        }

        return false;
    }

    function windowDemandsAttention(candidate) {
        try {
            return candidate !== null && candidate !== undefined && candidate.deleted !== true
                    && candidate.demandsAttention === true;
        } catch (error) {
            return false;
        }
    }

    function windowMatchesSearch(candidate, windowState) {
        const query = typeof searchQuery === "string" ? searchQuery : "";
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.matchesOverviewWindowSearchPlan !== "function") {
                return query.trim().length === 0;
            }

            return runtime.matchesOverviewWindowSearchPlan(searchQueryPlan, {
                caption: candidate && candidate.caption !== undefined && candidate.caption !== null
                    ? String(candidate.caption) : "",
                resourceClass: candidate && candidate.resourceClass !== undefined && candidate.resourceClass !== null
                    ? String(candidate.resourceClass) : "",
                resourceName: candidate && candidate.resourceName !== undefined && candidate.resourceName !== null
                    ? String(candidate.resourceName) : "",
                desktopFileName: candidate && candidate.desktopFileName !== undefined
                    && candidate.desktopFileName !== null ? String(candidate.desktopFileName) : "",
                desktopName: card.desktopLabel ? card.desktopLabel.label : "",
                outputName: card.outputName,
                state: card.windowSearchState(candidate, windowState)
            }) === true;
        } catch (error) {
            return query.length === 0;
        }
    }

    function windowSearchState(candidate, windowState) {
        const states = [];
        if (windowDemandsAttention(candidate)) {
            states.push("urgent attention");
        }

        try {
            if (candidate && candidate.deleted !== true && candidate.minimized === true) {
                states.push("minimized");
            }
            if (windowStatePlanIsValid(windowState) && windowState.searchText.length > 0) {
                states.push(windowState.searchText);
            }
        } catch (error) {
            return states.join(" ");
        }

        return states.join(" ");
    }

    function clippedNavigationRect(visual, sceneItem, includeOffscreen = false) {
        if (!visual || !visual.visible || visual.width <= 0 || visual.height <= 0 || !viewport.visible || !card.visible) {
            return null;
        }

        try {
            let rect = plainRect(visual.mapToItem(sceneItem, 0, 0, visual.width, visual.height));
            const viewportRect = plainRect(viewport.mapToItem(sceneItem, 0, 0, viewport.width, viewport.height));
            const cardRect = plainRect(card.mapToItem(sceneItem, 0, 0, card.width, card.height));
            if (includeOffscreen === true) {
                const top = Math.max(rect.y, viewportRect.y, cardRect.y);
                const bottom = Math.min(rect.y + rect.height, viewportRect.y + viewportRect.height,
                                        cardRect.y + cardRect.height);
                rect = {
                    height: bottom - top,
                    width: rect.width,
                    x: rect.x,
                    y: top
                };
                return navigationRectIsValid(rect) ? rect : null;
            }
            rect = intersectRects(rect, viewportRect);
            rect = intersectRects(rect, cardRect);
            rect = intersectRects(rect, {
                height: sceneItem.height,
                width: sceneItem.width,
                x: 0,
                y: 0
            });
            return navigationRectIsValid(rect) ? rect : null;
        } catch (error) {
            return null;
        }
    }

    function clippedCardNavigationRect(visual, sceneItem, includeOffscreen = false) {
        if (!visual || !visual.visible || visual.width <= 0 || visual.height <= 0 || !card.visible) {
            return null;
        }

        try {
            let rect = plainRect(visual.mapToItem(sceneItem, 0, 0, visual.width, visual.height));
            rect = intersectRects(rect, plainRect(card.mapToItem(sceneItem, 0, 0, card.width, card.height)));
            if (includeOffscreen !== true) {
                rect = intersectRects(rect, {
                    height: sceneItem.height,
                    width: sceneItem.width,
                    x: 0,
                    y: 0
                });
            }
            return navigationRectIsValid(rect) ? rect : null;
        } catch (error) {
            return null;
        }
    }

    function navigationRectIsValid(rect) {
        return rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)
            && Number.isFinite(rect.width) && Number.isFinite(rect.height)
            && rect.width > 0 && rect.height > 0;
    }

    function intersectRects(first, second) {
        if (!first || !second) {
            return null;
        }

        const left = Math.max(first.x, second.x);
        const top = Math.max(first.y, second.y);
        const right = Math.min(first.x + first.width, second.x + second.width);
        const bottom = Math.min(first.y + first.height, second.y + second.height);
        if (right <= left || bottom <= top) {
            return null;
        }

        return {
            height: bottom - top,
            width: right - left,
            x: left,
            y: top
        };
    }

    function plainRect(rect) {
        return {
            height: Number(rect.height),
            width: Number(rect.width),
            x: Number(rect.x),
            y: Number(rect.y)
        };
    }

    function indexOfDesktop(id) {
        const desktops = KWin.Workspace.desktops;
        for (let index = 0; index < desktops.length; index += 1) {
            if (String(desktops[index].id) === id) {
                return index;
            }
        }

        return 0;
    }

    function buildTiledPresentations() {
        const presentations = Object.create(null);
        if (!context || !screen) {
            return presentations;
        }

        const gap = Math.max(2, Math.min(8, contentWidth * 0.008));
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
            const column = columns[columnIndex];
            const columnFrame = card.columnFrame(columnIndex);
            const columnX = columnFrame.x;
            const columnWidth = columnFrame.width;
            const tabbed = column.presentation === "tabbed";
            const memberHeights = tabbed ? [] : heightsForMembers(column.members);
            const tabStripHeight = tabbed ? boundedTabStripHeight() : 0;
            const tabWidth = tabbed ? Math.max(1, columnWidth - gap) / Math.max(1, column.members.length) : 0;
            const stripBodyGap = gap;
            const tabHeight = Math.max(1, tabStripHeight - stripBodyGap);
            const thumbnailY = tabbed ? tabStripHeight + stripBodyGap / 2 : gap / 2;
            const tabbedThumbnailHeight = Math.max(1, contentHeight - thumbnailY - gap / 2);
            let memberY = 0;

            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const memberHeight = tabbed ? contentHeight : memberHeights[memberIndex];
                const selected = !tabbed || memberIndex === column.selectedMemberIndex;
                presentations[member.windowId] = {
                    columnIndex,
                    memberIndex,
                    plannedColumnFrame: spatialSourceColumnFrame(columnIndex),
                    selected,
                    tabFrame: tabbed ? {
                        height: tabHeight,
                        width: tabWidth,
                        x: columnX + gap / 2 + tabWidth * memberIndex,
                        y: gap / 2
                    } : null,
                    thumbnailFrame: selected ? {
                        floating: false,
                        height: tabbed ? tabbedThumbnailHeight : Math.max(1, memberHeight - gap),
                        width: Math.max(1, columnWidth - gap),
                        x: columnX + gap / 2,
                        y: tabbed ? thumbnailY : memberY + gap / 2
                    } : null
                };
                memberY += memberHeight;
            }

        }

        return presentations;
    }

    function boundedTabStripHeight() {
        return Math.max(1, Math.min(28, contentHeight * 0.16));
    }

    function buildFloatingWindowIds() {
        const ids = Object.create(null);
        for (const floatingWindow of floatingWindows) {
            ids[floatingWindow.windowId] = true;
        }
        return ids;
    }

    function buildColumnFrames() {
        const plannedFrames = buildSpatialColumnFrames();
        return plannedFrames !== null ? plannedFrames : buildLegacyColumnFrames();
    }

    function buildSpatialColumnFrames() {
        const plan = spatialRowGeometryPlan;
        const dimensions = plan ? plan.dimensions : null;
        const sourceFrames = plan ? plan.columnFrames : null;
        if (!context || !dimensions || !sourceFrames || !Number.isInteger(sourceFrames.length)
                || sourceFrames.length !== columns.length || !Number.isFinite(dimensions.viewportInsetX)) {
            return null;
        }

        const frames = [];
        for (let columnIndex = 0; columnIndex < sourceFrames.length; columnIndex += 1) {
            const sourceFrame = sourceFrames[columnIndex];
            if (!sourceFrame || sourceFrame.columnIndex !== columnIndex
                    || !Number.isFinite(sourceFrame.contentX) || !Number.isFinite(sourceFrame.width)
                    || sourceFrame.width <= 0) {
                return null;
            }
            const x = viewportOriginX
                + (dimensions.viewportInsetX + sourceFrame.contentX - logicalViewportOffset) * projectionScale;
            const width = sourceFrame.width * projectionScale;
            if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) {
                return null;
            }
            frames.push({ width, x });
        }
        return frames;
    }

    function buildLegacyColumnFrames() {
        const frames = [];
        let x = viewportOriginX - logicalViewportOffset * projectionScale;
        for (const column of columns) {
            const width = widthForColumn(column.width);
            frames.push({
                width,
                x
            });
            x += width;
        }
        return frames;
    }

    function columnFrame(columnIndex) {
        const frame = columnFrames[columnIndex];
        if (!frame || !Number.isFinite(frame.x) || !Number.isFinite(frame.width) || frame.width <= 0) {
            return {
                width: 0,
                x: 0
            };
        }

        return frame;
    }

    function columnShellFrame(columnIndex) {
        const liveFrames = spatialLiveColumnFrames;
        const liveFrame = liveFrames && Number.isInteger(columnIndex)
            && columnIndex >= 0 && columnIndex < liveFrames.length ? liveFrames[columnIndex] : null;
        return spatialLiveColumnPlanIsExact(liveFrame, columnIndex) ? liveFrame : columnFrame(columnIndex);
    }

    function buildSpatialLiveColumnFrames(revision) {
        try {
            if (!Number.isInteger(revision) || !liveGeometryEnabled || !current || !context || !context.columns
                    || !screen || !Number.isInteger(context.columns.length) || context.columns.length > 512
                    || !Number.isInteger(windowRepeater.count) || windowRepeater.count < 0
                    || windowRepeater.count > 131072) {
                return null;
            }

            const expectedContext = context;
            const expectedColumns = expectedContext.columns;
            const expectedScreen = screen;
            const expectedPresentations = tiledPresentations;
            const windowCount = windowRepeater.count;
            const samples = [];
            for (let columnIndex = 0; columnIndex < expectedColumns.length; columnIndex += 1) {
                const column = expectedColumns[columnIndex];
                if (!column || !column.members || !Number.isInteger(column.members.length)
                        || column.members.length < 1 || column.members.length > 256) {
                    return null;
                }
                samples.push(column.presentation === "tabbed" ? null : []);
            }

            for (let index = 0; index < windowCount; index += 1) {
                const presentation = windowRepeater.itemAt(index);
                if (!presentation) {
                    continue;
                }

                const plan = presentation.spatialLiveFrame;
                if (plan === null || plan === undefined) {
                    continue;
                }

                const tiled = presentation.tiledPresentation;
                const windowId = presentation.windowId;
                if (!tiled || !spatialLiveWindowPlanIsExact(plan, windowId, tiled)) {
                    return null;
                }

                const columnIndex = plan.columnIndex;
                const memberIndex = plan.memberIndex;
                const column = expectedColumns[columnIndex];
                const members = column ? column.members : null;
                const member = members && memberIndex >= 0 && memberIndex < members.length
                    ? members[memberIndex] : null;
                const columnSamples = samples[columnIndex];
                if (!column || column.presentation === "tabbed" || !member || member.windowId !== windowId
                        || !columnSamples || columnSamples.length >= members.length) {
                    return null;
                }
                columnSamples.push(plan);
            }

            if (!liveGeometryEnabled || !current || context !== expectedContext || screen !== expectedScreen
                    || expectedContext.columns !== expectedColumns || tiledPresentations !== expectedPresentations
                    || windowRepeater.count !== windowCount || spatialLiveGeometryRevision !== revision) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.aggregateOverviewSpatialLiveColumnGeometry !== "function") {
                return null;
            }

            const frames = [];
            for (let columnIndex = 0; columnIndex < expectedColumns.length; columnIndex += 1) {
                const column = expectedColumns[columnIndex];
                if (column.presentation === "tabbed") {
                    frames.push(null);
                    continue;
                }

                const plan = runtime.aggregateOverviewSpatialLiveColumnGeometry({
                                                                                    columnIndex,
                                                                                    memberCount: column.members.length,
                                                                                    samples: samples[columnIndex]
                                                                                });
                frames.push(spatialLiveColumnPlanIsExact(plan, columnIndex) ? plan : null);
            }

            if (!liveGeometryEnabled || !current || context !== expectedContext || screen !== expectedScreen
                    || expectedContext.columns !== expectedColumns || tiledPresentations !== expectedPresentations
                    || windowRepeater.count !== windowCount || spatialLiveGeometryRevision !== revision) {
                return null;
            }
            return frames;
        } catch (error) {
            return null;
        }
    }

    function spatialLiveColumnPlanIsExact(plan, columnIndex) {
        return plan && !Array.isArray(plan) && plan.columnIndex === columnIndex
            && Number.isFinite(plan.x) && Number.isFinite(plan.width) && plan.width > 0
            && Number.isFinite(plan.x + plan.width);
    }

    function widthForColumn(width) {
        if (!width || !Number.isFinite(width.value) || width.value <= 0) {
            return 1;
        }
        if (width.kind === "fixed") {
            return Math.max(1, width.value * projectionScale);
        }
        if (width.kind === "proportion") {
            return Math.max(1, width.value * projectedViewportWidth);
        }

        return 1;
    }

    function layoutBadgeLabel(column) {
        if (!column || (column.presentation !== "stacked" && column.presentation !== "tabbed")) {
            return "";
        }

        const widthLabel = layoutBadgeWidthLabel(column.width);
        return widthLabel.length > 0 ? `${column.presentation} · ${widthLabel}` : "";
    }

    function columnDelegateAt(repeater, columnIndex, revision) {
        if (!repeater || !Number.isInteger(revision) || revision < 0 || columnIndex < 0
                || columnIndex >= repeater.count) {
            return null;
        }

        return repeater.itemAt(columnIndex);
    }

    function layoutBadgeWidthLabel(width) {
        if (!width || !Number.isFinite(width.value) || width.value <= 0) {
            return "";
        }

        if (width.kind === "fixed") {
            return width.value < 0.5 ? "<1 px" : `${Math.round(width.value)} px`;
        }
        if (width.kind !== "proportion") {
            return "";
        }

        const tenths = Math.round(width.value * 1000);
        if (tenths === 0) {
            return "<0.1%";
        }

        const whole = Math.floor(tenths / 10);
        const fraction = tenths % 10;
        return fraction === 0 ? `${whole}%` : `${whole}.${fraction}%`;
    }

    function heightsForMembers(members) {
        const targets = [];
        const autoWeights = [];
        let fixedTotal = 0;
        let autoWeightTotal = 0;

        for (const member of members) {
            const height = member.height;
            if (!height || height.kind === "auto") {
                const weight = height ? Math.max(0.01, height.weight) : 1;
                targets.push(0);
                autoWeights.push(weight);
                autoWeightTotal += weight;
                continue;
            }

            const target = height.kind === "fixed" ? Math.max(1, height.clientHeight * projectionScale) : presetHeight(
                                                         height.index, members.length);
            targets.push(target);
            autoWeights.push(0);
            fixedTotal += target;
        }

        const fixedScale = fixedTotal > contentHeight ? contentHeight / fixedTotal : 1;
        const remaining = Math.max(0, contentHeight - fixedTotal * fixedScale);
        const heights = [];

        for (let index = 0; index < members.length; index += 1) {
            const weight = autoWeights[index];
            heights.push(weight > 0 && autoWeightTotal > 0 ? remaining * weight / autoWeightTotal : targets[index]
                                                             * fixedScale);
        }

        return heights;
    }

    function presetHeight(index, memberCount) {
        if (index === 0) {
            return contentHeight / 3;
        }
        if (index === 1) {
            return contentHeight / 2;
        }
        if (index === 2) {
            return contentHeight * 2 / 3;
        }

        return contentHeight / Math.max(1, memberCount);
    }

    function frameForWindow(window, windowId, tiled, spatialLiveFrame) {
        if (tiled !== undefined) {
            if (spatialLiveWindowPlanIsExact(spatialLiveFrame, windowId, tiled)) {
                return spatialLiveFrame;
            }
            return tiled.thumbnailFrame;
        }
        if (!window || floatingWindowIds[windowId] !== true || !screen) {
            return null;
        }

        const geometry = window.frameGeometry;
        const screenGeometry = screen.geometry;
        if (!projectionGeometryIsValid(geometry) || !projectionGeometryIsValid(screenGeometry)) {
            return null;
        }
        return {
            floating: true,
            height: Math.max(1, geometry.height * projectionScale),
            width: Math.max(1, geometry.width * projectionScale),
            x: viewportOriginX + (geometry.x - screenGeometry.x) * projectionScale,
            y: viewportOriginY + (geometry.y - screenGeometry.y) * projectionScale
        };
    }

    function planSpatialLiveWindowFrame(window, windowId, tiled) {
        try {
            if (!liveGeometryEnabled || !current || !window || !tiled || !context || !context.columns
                    || !screen || typeof windowId !== "string" || windowId.length === 0
                    || !Number.isInteger(tiled.columnIndex) || !Number.isInteger(tiled.memberIndex)
                    || tiled.columnIndex < 0 || tiled.columnIndex >= context.columns.length) {
                return null;
            }

            const expectedContext = context;
            const expectedColumns = expectedContext.columns;
            const expectedScreen = screen;
            const columnIndex = tiled.columnIndex;
            const memberIndex = tiled.memberIndex;
            const column = expectedColumns[columnIndex];
            if (!column || column.presentation === "tabbed" || !column.members
                    || memberIndex < 0 || memberIndex >= column.members.length) {
                return null;
            }

            const expectedMembers = column.members;
            const member = expectedMembers[memberIndex];
            const sourceColumnFrame = spatialSourceColumnFrame(columnIndex);
            if (!member || member.windowId !== windowId || !sourceColumnFrame
                    || sourceColumnFrame !== tiled.plannedColumnFrame) {
                return null;
            }

            const deleted = window.deleted;
            const minimized = window.minimized;
            const output = window.output;
            const internalId = window.internalId;
            if (deleted !== false || minimized !== false || output !== expectedScreen
                    || internalId === undefined || internalId === null || String(internalId) !== windowId) {
                return null;
            }

            const liveGeometry = window.frameGeometry;
            const outputGeometry = expectedScreen.geometry;
            const liveX = liveGeometry ? Number(liveGeometry.x) : Number.NaN;
            const liveY = liveGeometry ? Number(liveGeometry.y) : Number.NaN;
            const liveWidth = liveGeometry ? Number(liveGeometry.width) : Number.NaN;
            const liveHeight = liveGeometry ? Number(liveGeometry.height) : Number.NaN;
            const outputX = outputGeometry ? Number(outputGeometry.x) : Number.NaN;
            const outputY = outputGeometry ? Number(outputGeometry.y) : Number.NaN;
            const outputWidth = outputGeometry ? Number(outputGeometry.width) : Number.NaN;
            const outputHeight = outputGeometry ? Number(outputGeometry.height) : Number.NaN;
            const scale = Number(projectionScale);
            const originX = Number(viewportOriginX);
            const originY = Number(viewportOriginY);

            if (!projectionGeometryScalarsAreValid(liveX, liveY, liveWidth, liveHeight)
                    || !projectionGeometryScalarsAreValid(outputX, outputY, outputWidth, outputHeight)
                    || !Number.isFinite(scale) || scale <= 0 || !Number.isFinite(originX)
                    || !Number.isFinite(originY)) {
                return null;
            }

            const confirmedLiveGeometry = window.frameGeometry;
            const confirmedOutputGeometry = expectedScreen.geometry;
            if (!liveGeometryEnabled || !current || context !== expectedContext || screen !== expectedScreen
                    || expectedContext.columns !== expectedColumns || expectedColumns[columnIndex] !== column
                    || column.presentation === "tabbed" || column.members !== expectedMembers
                    || expectedMembers[memberIndex] !== member || member.windowId !== windowId
                    || tiledPresentations[windowId] !== tiled || tiled.columnIndex !== columnIndex
                    || tiled.memberIndex !== memberIndex || tiled.plannedColumnFrame !== sourceColumnFrame
                    || spatialSourceColumnFrame(columnIndex) !== sourceColumnFrame || window.deleted !== false
                    || window.minimized !== false || window.output !== expectedScreen
                    || window.internalId === undefined || window.internalId === null
                    || String(window.internalId) !== windowId
                    || !projectionGeometryMatches(confirmedLiveGeometry, liveX, liveY, liveWidth, liveHeight)
                    || !projectionGeometryMatches(confirmedOutputGeometry, outputX, outputY,
                                                  outputWidth, outputHeight)
                    || Number(projectionScale) !== scale || Number(viewportOriginX) !== originX
                    || Number(viewportOriginY) !== originY) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.projectOverviewSpatialLiveGeometry !== "function") {
                return null;
            }

            const plan = runtime.projectOverviewSpatialLiveGeometry({
                                                                        columnIndex,
                                                                        liveHeight,
                                                                        liveWidth,
                                                                        liveX,
                                                                        liveY,
                                                                        memberIndex,
                                                                        outputHeight,
                                                                        outputWidth,
                                                                        outputX,
                                                                        outputY,
                                                                        projectionScale: scale,
                                                                        viewportOriginX: originX,
                                                                        viewportOriginY: originY,
                                                                        windowId
                                                                    });
            return spatialLiveWindowPlanIsExact(plan, windowId, tiled) ? plan : null;
        } catch (error) {
            return null;
        }
    }

    function spatialLiveWindowPlanIsExact(plan, windowId, tiled) {
        if (!plan || Array.isArray(plan) || plan.windowId !== windowId
                || plan.columnIndex !== tiled.columnIndex || plan.memberIndex !== tiled.memberIndex
                || plan.floating !== false
                || !projectionGeometryScalarsAreValid(plan.x, plan.y, plan.width, plan.height)) {
            return false;
        }

        return true;
    }

    function projectionGeometryScalarsAreValid(x, y, width, height) {
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && width > 0
            && Number.isFinite(height) && height > 0 && Number.isFinite(x + width)
            && Number.isFinite(y + height);
    }

    function projectionGeometryMatches(geometry, x, y, width, height) {
        return geometry && Number(geometry.x) === x && Number(geometry.y) === y
            && Number(geometry.width) === width && Number(geometry.height) === height;
    }

    function spatialSourceColumnFrame(columnIndex) {
        const plan = spatialRowGeometryPlan;
        const frames = plan ? plan.columnFrames : null;
        if (!frames || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= frames.length) {
            return null;
        }

        const frame = frames[columnIndex];
        return frame && frame.columnIndex === columnIndex
            && frame.columnId === `overview-column-${columnIndex}`
            && Number.isFinite(frame.contentX) && Number.isFinite(frame.width) && frame.width > 0
            ? frame : null;
    }

    function projectionExtent(value, fallback) {
        return finitePositive(Number(value), finitePositive(fallback, 1));
    }

    function finitePositive(value, fallback) {
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }

    function finiteNumber(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function projectionGeometryIsValid(geometry) {
        return geometry && Number.isFinite(Number(geometry.x)) && Number.isFinite(Number(geometry.y))
            && Number.isFinite(Number(geometry.width)) && Number(geometry.width) > 0
            && Number.isFinite(Number(geometry.height)) && Number(geometry.height) > 0;
    }
}
