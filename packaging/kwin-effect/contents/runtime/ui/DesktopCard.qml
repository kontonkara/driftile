import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

Item {
    id: card

    required property var context
    required property bool current
    required property var desktop
    required property bool desktopReorderEnabled
    required property bool desktopReorderSource
    required property string desktopId
    required property var floatingWindows
    required property bool liveGeometryEnabled
    required property string outputId
    required property string outputName
    required property real presentationProgress
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
    property bool windowWorkspaceHoverTarget: false

    signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)
    signal desktopReorderCanceled(string expectedDesktopId)
    signal desktopReorderGrabbed(var candidate, string expectedDesktopId, var expectedScreen, real sceneX,
                                 real sceneY)
    signal desktopReorderMoved(string expectedDesktopId, real sceneX, real sceneY)
    signal desktopReorderReleased(string expectedDesktopId, real sceneX, real sceneY)
    signal navigationTargetsChanged()
    signal windowDropped(var candidate, string expectedWindowId, var expectedSourceDesktop,
                         string expectedSourceDesktopId, var expectedTargetDesktop,
                         string expectedTargetDesktopId, var expectedScreen, var exactTarget)
    signal windowCloseRequested(var candidate, string expectedWindowId, var expectedDesktop,
                                string expectedDesktopId, var expectedScreen)
    signal windowSpatialDragStarted(var source, real sceneX, real sceneY)
    signal windowSpatialDragMoved(var source, real sceneX, real sceneY)
    signal windowSpatialDragFinished(var source)
    signal windowWorkspaceHoverEntered(var source, var expectedTargetDesktop,
                                       string expectedTargetDesktopId, var expectedTargetScreen,
                                       real sceneX, real sceneY)
    signal windowWorkspaceHoverMoved(var source, var expectedTargetDesktop,
                                     string expectedTargetDesktopId, var expectedTargetScreen,
                                     real sceneX, real sceneY)
    signal windowWorkspaceHoverLeft(var source, var expectedTargetDesktop,
                                    string expectedTargetDesktopId, var expectedTargetScreen)
    signal windowTapped(var candidate, string expectedWindowId, var expectedDesktop, string expectedDesktopId,
                        var expectedScreen)

    readonly property var columns: context ? context.columns : []
    readonly property var desktopLabel: planDesktopLabel(desktop)
    readonly property bool desktopNamePresented: showDesktopNames && desktopLabel !== null
        && width >= 560 && height >= 72
    readonly property real contentLeft: 0
    readonly property real contentTop: 0
    readonly property real contentWidth: Math.max(1, width)
    readonly property real contentHeight: Math.max(1, height)
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
    property int spatialLiveGeometryRevision: 0
    property int attentionRevision: 0
    property bool windowDropHoverOwned: false
    property var windowDropHoverSource: null
    property string windowDropHoverSourceWindowId: ""
    property var windowDropHoverDesktop: null
    property string windowDropHoverDesktopId: ""
    property var windowDropHoverScreen: null
    property var windowDropHoverSnapshot: null
    property var windowDropHoverTarget: null
    property bool windowDropHoverCrossWorkspace: false

    opacity: searchDeemphasized ? 0.42 : 1

    Item {
        id: numberGutter

        readonly property bool keyboardSelected: !card.current && card.searchQuery.trim().length === 0
            && card.keyboardSelectionId === card.desktopNavigationTargetId()
        readonly property bool attentionRequested: card.anyWindowDemandsAttention(card.attentionRevision)

        x: Math.max(6, Math.min(card.width - width - 6,
                                card.viewportOriginX >= width + 12
                                ? card.viewportOriginX - width - 10
                                : card.viewportOriginX + 10))
        y: Math.max(6, Math.min(card.height - height - 6, card.viewportOriginY + 8))
        width: 36
        height: 36
        opacity: card.presentationProgress
        z: 9500

        Text {
            anchors.fill: parent
            anchors.margins: 4
            text: String(card.indexOfDesktop(card.desktopId) + 1)
            color: card.current ? "#f3f7ff" : "#b6c1d2"
            font.bold: card.current
            font.pixelSize: Math.max(12, Math.min(18, numberGutter.height * 0.45))
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }

        Rectangle {
            id: desktopAttentionBadge

            anchors.top: parent.top
            anchors.right: parent.right
            anchors.margins: 1
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
            anchors.margins: 1
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

        x: Math.max(numberGutter.x + numberGutter.width + 8,
                    Math.max(6, card.viewportOriginX + 10))
        y: numberGutter.y + Math.max(0, (numberGutter.height - height) / 2)
        width: Math.max(0, Math.min(220, card.width - x - 8))
        height: 24
        visible: card.desktopNamePresented && width >= 48
        opacity: card.presentationProgress
        z: 9500

        Text {
            anchors.fill: parent
            anchors.leftMargin: 2
            anchors.rightMargin: 4
            text: card.desktopLabel ? card.desktopLabel.label : ""
            color: card.current ? "#e8eef9" : "#9eabbe"
            font.bold: card.current
            font.pixelSize: Math.max(10, Math.min(14, desktopNameGutter.height * 0.52))
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
            id: projectedOutputSurface

            x: card.viewportOriginX
            y: card.viewportOriginY
            width: card.projectedViewportWidth
            height: card.projectedViewportHeight
            visible: width > 0 && height > 0
            enabled: false
            color: "#171e2a"
            opacity: card.presentationProgress
            radius: 2
            z: -100

            Rectangle {
                anchors.fill: parent
                color: windowDropArea.validTarget ? "#282f4057"
                                                  : card.desktopReorderSource ? "#1850607a"
                                                                              : "transparent"
            }

            Rectangle {
                anchors.fill: parent
                color: "transparent"
                border.width: windowDropArea.validTarget || card.desktopReorderSource ? 2 : 0
                border.color: windowDropArea.validTarget ? "#86aee8"
                                                         : "#668baad6"
                radius: 2
            }
        }

        Repeater {
            id: columnRepeater

            model: card.columns

            Item {
                id: columnShell

                required property var modelData
                required property int index

                readonly property var liveGeometryPlan: card.spatialLiveColumnPlan(index)
                readonly property var frame: card.columnShellFrame(index, liveGeometryPlan)

                x: frame.x
                y: 0
                width: frame.width
                height: viewport.height
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
                minimizedWindows: false
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
                readonly property var minimizedPlaceholderFrame: minimizedActivationEligible
                    ? card.planMinimizedPlaceholderFrame(frame) : null
                readonly property var windowLabel: card.planWindowLabel(candidate, matchesSearch && model.window
                    && ((!minimizedWindow && selectedThumbnail && frame !== null && frame !== undefined)
                        || (minimizedPlaceholderFrame !== null && minimizedPlaceholderFrame !== undefined)))
                readonly property bool dragEligible: card.windowSnapshotCanDrag(windowPresentation)
                readonly property bool closeEligible: card.windowSnapshotCanRequestClose(windowPresentation)
                readonly property var sourceDesktop: card.desktop
                readonly property string sourceDesktopId: card.desktopId
                readonly property var sourceScreen: card.screen
                readonly property var sourceCard: card
                readonly property var thumbnailTarget: thumbnailShell
                readonly property var minimizedPlaceholderTarget: minimizedPlaceholderShell
                property bool spatialDragLifecycleActive: false

                width: viewport.width
                height: viewport.height
                opacity: thumbnailShell.Drag.active ? 0.72 : 1
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
                        wId: windowPresentation.windowId
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: KWin.Workspace.activeWindow === model.window ? 2 : 0
                        border.color: "#f4f8ff"
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
                        border.width: thumbnailShell.keyboardSelected ? 2 : 0
                        border.color: "#86aee8"
                        z: 3
                    }

                    WindowCloseButton {
                        id: thumbnailCloseButton

                        anchors.top: parent.top
                        anchors.right: parent.right
                        anchors.topMargin: 5
                        anchors.rightMargin: 5
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
                                    if (action !== Qt.MoveAction) {
                                        card.requestCrossOutputWindowDrop(source, point);
                                    }
                                    card.finishWindowSpatialDrag(source);
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

    }

    DropArea {
        id: windowDropArea

        readonly property bool validTarget: containsDrag && card.windowDropHoverOwned
            && card.windowDropHoverTarget !== null && card.windowDropHoverOwnershipIsValid()
        readonly property var spatialPreview: validTarget
            ? card.planWindowDropPreview(card.windowDropHoverTarget, card.windowDropHoverSnapshot) : null

        anchors.fill: parent
        enabled: card.enabled && card.searchQuery.trim().length === 0
        keys: ["driftile-window"]
        z: 10000

        Rectangle {
            id: spatialWindowDropPreviewSurface

            readonly property var plan: windowDropArea.spatialPreview

            x: plan ? plan.surface.x : 0
            y: plan ? plan.surface.y : 0
            width: plan ? plan.surface.width : 0
            height: plan ? plan.surface.height : 0
            visible: plan !== null
            enabled: false
            color: !plan ? "transparent"
                         : plan.kind === "empty-row" ? "#4d86aee8"
                         : plan.kind === "stack-insertion" ? "#3dffd166" : "#3386aee8"
            border.width: plan && plan.kind === "empty-row" ? 2 : 1
            border.color: !plan ? "transparent"
                               : plan.kind === "stack-insertion" ? "#d9ffd166" : "#d986aee8"
            radius: 3
            opacity: card.presentationProgress
            antialiasing: false
            z: 1
        }

        Rectangle {
            id: spatialWindowDropPreviewMarker

            readonly property var plan: windowDropArea.spatialPreview
            readonly property var marker: plan ? plan.marker : null

            x: marker ? marker.x : 0
            y: marker ? marker.y : 0
            width: marker ? marker.width : 0
            height: marker ? marker.height : 0
            visible: marker !== null
            enabled: false
            color: plan && plan.kind === "stack-insertion" ? "#fff0b35f" : "#ff9fc5ff"
            radius: 2
            opacity: card.presentationProgress
            antialiasing: false
            z: 2
        }

        onEntered: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)
            ? card.claimWindowDropHover(drag.source, drag)
            : card.rejectWindowDropHover()
        onPositionChanged: drag => drag.accepted = card.windowDropIsValid(drag.source, drag.keys)
            ? card.windowDropHoverOwned
              ? card.moveWindowDropHover(drag.source, drag)
              : card.claimWindowDropHover(drag.source, drag)
            : card.rejectWindowDropHover()
        onExited: card.clearWindowDropHover()
        onContainsDragChanged: {
            if (!containsDrag) {
                card.clearWindowDropHover();
            }
        }
        onDropped: drop => {
            const source = drop.source;
            if (!card.windowDropIsValid(source, drop.keys) || !card.moveWindowDropHover(source, drop)) {
                card.clearWindowDropHover();
                drop.accepted = false;
                return;
            }

            const exactTarget = card.windowDropHoverTarget;
            if (!card.windowDropPlannerTargetIsExact(exactTarget, card.windowDropHoverSnapshot)) {
                card.clearWindowDropHover();
                drop.accepted = false;
                return;
            }

            drop.action = Qt.MoveAction;
            drop.accepted = true;
            card.clearWindowDropHover();
            card.windowDropped(source.candidate, source.windowId, source.sourceDesktop, source.sourceDesktopId,
                               card.desktop, card.desktopId, card.screen, exactTarget);
        }

        Connections {
            target: card.windowDropHoverSource
            ignoreUnknownSignals: true

            function onCandidateChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onDestroyed() {
                card.clearWindowDropHover();
            }

            function onDragEligibleChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onMinimizedWindowChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onSourceDesktopChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onSourceDesktopIdChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onSourceScreenChanged() {
                card.clearInvalidWindowDropHover();
            }

            function onSpatialDragLifecycleActiveChanged() {
                card.clearInvalidWindowDropHover();
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        visible: card.windowWorkspaceHoverTarget
        color: "transparent"
        border.width: 2
        border.color: "#86aee8"
        opacity: card.presentationProgress
        z: 9999
    }

    onCurrentChanged: card.navigationTargetsChanged()
    onContextChanged: card.clearInvalidWindowDropHover()
    onDesktopChanged: card.clearWindowDropHover()
    onDesktopIdChanged: card.clearWindowDropHover()
    onEnabledChanged: {
        if (!enabled) {
            card.clearWindowDropHover();
        }
    }
    onScreenChanged: card.clearWindowDropHover()
    onOutputIdChanged: card.clearInvalidWindowDropHover()
    onColumnFramesChanged: card.clearInvalidWindowDropHover()
    onTiledPresentationsChanged: card.clearInvalidWindowDropHover()
    onSpatialLiveColumnFramesChanged: card.clearInvalidWindowDropHover()
    onSpatialRowGeometryPlanChanged: card.clearInvalidWindowDropHover()
    onWidthChanged: card.clearInvalidWindowDropHover()
    onHeightChanged: card.clearInvalidWindowDropHover()
    onSearchQueryChanged: {
        card.navigationTargetsChanged();
        if (searchQuery.trim().length > 0) {
            card.clearWindowDropHover();
        }
    }

    Component.onDestruction: card.clearWindowDropHover()

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
                ? presentation.minimizedPlaceholderTarget : presentation.thumbnailTarget;
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

    function crossOutputWindowDropSourceIsExact(source) {
        try {
            return source && source.sourceCard === card && source.sourceScreen === screen
                    && source.sourceDesktop === desktop && source.sourceDesktopId === desktopId
                    && source.dragEligible === true && source.spatialDragLifecycleActive === true
                    && spatialDragSourceIsOwned(source) && windowCanDrag(source)
                    && windowDropTargetIsExact() && windowDropSourceTiledPresentationIsExact(source);
        } catch (error) {
            return false;
        }
    }

    function planCrossOutputWindowDropTarget(source, localPosition) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            if (!sourceCard || sourceCard === card || typeof sourceCard.outputId !== "string"
                    || sourceCard.outputId.length === 0 || sourceCard.outputId === outputId
                    || typeof sourceCard.crossOutputWindowDropSourceIsExact !== "function"
                    || source.sourceScreen === screen
                    || !sourceCard.crossOutputWindowDropSourceIsExact(source)
                    || !windowDropTargetIsExact() || !windowDropSourceWorkspaceRelationIsExact(source)
                    || !spatialDragScenePointIsFinite(localPosition)) {
                return null;
            }

            const snapshot = buildWindowDropPlannerSnapshot();
            const target = hitWindowDropPlannerSnapshot(snapshot, localPosition);
            return windowDropPlannerTargetIsExact(target, snapshot) ? target : null;
        } catch (error) {
            return null;
        }
    }

    function spatialDragScenePointIsFinite(scenePosition) {
        return scenePosition && Number.isFinite(scenePosition.x) && Number.isFinite(scenePosition.y);
    }

    function claimWindowDropHover(source, drag) {
        const localPosition = windowDropLocalPosition(drag);
        const scenePosition = windowDropScenePosition(drag);
        if (!localPosition || !scenePosition) {
            clearWindowDropHover();
            return false;
        }

        if (windowDropHoverOwned) {
            if (windowDropHoverOwnershipMatches(source)) {
                return moveWindowDropHoverToPositions(source, localPosition, scenePosition);
            }
            clearWindowDropHover();
        }

        try {
            const snapshot = buildWindowDropPlannerSnapshot();
            const target = hitWindowDropPlannerSnapshot(snapshot, localPosition);
            if (!snapshot || !target || !windowDropSourceWorkspaceRelationIsExact(source)) {
                clearWindowDropHover();
                return false;
            }

            const crossWorkspace = windowDropSourceTargetsDifferentWorkspace(source);
            windowDropHoverSource = source;
            windowDropHoverSourceWindowId = source.windowId;
            windowDropHoverDesktop = desktop;
            windowDropHoverDesktopId = desktopId;
            windowDropHoverScreen = screen;
            windowDropHoverSnapshot = snapshot;
            windowDropHoverTarget = target;
            windowDropHoverCrossWorkspace = crossWorkspace;
            windowDropHoverOwned = true;
            if (crossWorkspace) {
                windowWorkspaceHoverEntered(source, desktop, desktopId, screen,
                                            scenePosition.x, scenePosition.y);
            }
            return true;
        } catch (error) {
            clearWindowDropHover();
            return false;
        }
    }

    function moveWindowDropHover(source, drag) {
        const localPosition = windowDropLocalPosition(drag);
        const scenePosition = windowDropScenePosition(drag);
        if (!localPosition || !scenePosition) {
            clearWindowDropHover();
            return false;
        }
        return moveWindowDropHoverToPositions(source, localPosition, scenePosition);
    }

    function moveWindowDropHoverToPositions(source, localPosition, scenePosition) {
        if (!windowDropHoverOwnershipMatches(source) || !spatialDragScenePointIsFinite(localPosition)
                || !spatialDragScenePointIsFinite(scenePosition)) {
            clearWindowDropHover();
            return false;
        }

        const target = hitWindowDropPlannerSnapshot(windowDropHoverSnapshot, localPosition);
        if (!target) {
            clearWindowDropHover();
            return false;
        }

        windowDropHoverTarget = target;
        if (windowDropHoverCrossWorkspace) {
            windowWorkspaceHoverMoved(source, windowDropHoverDesktop, windowDropHoverDesktopId,
                                      windowDropHoverScreen, scenePosition.x, scenePosition.y);
        }
        return true;
    }

    function rejectWindowDropHover() {
        clearWindowDropHover();
        return false;
    }

    function clearInvalidWindowDropHover() {
        if (windowDropHoverOwned && !windowDropHoverOwnershipIsValid()) {
            clearWindowDropHover();
        }
    }

    function clearWindowDropHover() {
        if (!windowDropHoverOwned) {
            resetWindowDropHoverOwnership();
            return;
        }

        const source = windowDropHoverSource;
        const targetDesktop = windowDropHoverDesktop;
        const targetDesktopId = windowDropHoverDesktopId;
        const targetScreen = windowDropHoverScreen;
        const crossWorkspace = windowDropHoverCrossWorkspace;
        resetWindowDropHoverOwnership();
        if (crossWorkspace) {
            windowWorkspaceHoverLeft(source, targetDesktop, targetDesktopId, targetScreen);
        }
    }

    function resetWindowDropHoverOwnership() {
        windowDropHoverOwned = false;
        windowDropHoverSource = null;
        windowDropHoverSourceWindowId = "";
        windowDropHoverDesktop = null;
        windowDropHoverDesktopId = "";
        windowDropHoverScreen = null;
        windowDropHoverSnapshot = null;
        windowDropHoverTarget = null;
        windowDropHoverCrossWorkspace = false;
    }

    function windowDropHoverOwnershipIsValid() {
        return windowDropHoverOwnershipMatches(windowDropHoverSource)
                && windowDropIsValid(windowDropHoverSource, ["driftile-window"]);
    }

    function windowDropHoverOwnershipMatches(source) {
        try {
            const candidate = source ? source.candidate : null;
            return windowDropHoverOwned && source && source === windowDropHoverSource && candidate
                    && typeof source.windowId === "string" && source.windowId.length > 0
                    && source.windowId === windowDropHoverSourceWindowId
                    && candidate.internalId !== undefined && candidate.internalId !== null
                    && String(candidate.internalId) === windowDropHoverSourceWindowId
                    && source.spatialDragLifecycleActive === true && source.dragEligible === true
                    && source.minimizedWindow !== true && source.sourceScreen === screen
                    && windowDropSourceWorkspaceRelationIsExact(source)
                    && windowDropHoverCrossWorkspace === windowDropSourceTargetsDifferentWorkspace(source)
                    && windowDropHoverDesktop === desktop && windowDropHoverDesktopId === desktopId
                    && windowDropHoverScreen === screen && windowDropTargetIsExact()
                    && windowDropPlannerSnapshotIsExact(windowDropHoverSnapshot)
                    && windowDropPlannerTargetMatchesSnapshot(windowDropHoverTarget, windowDropHoverSnapshot);
        } catch (error) {
            return false;
        }
    }

    function windowDropLocalPosition(drag) {
        if (!drag || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
            return null;
        }
        return {
            x: Number(drag.x),
            y: Number(drag.y)
        };
    }

    function windowDropScenePosition(drag) {
        if (!drag || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
            return null;
        }

        try {
            const scenePosition = windowDropArea.mapToItem(null, drag.x, drag.y);
            return spatialDragScenePointIsFinite(scenePosition) ? scenePosition : null;
        } catch (error) {
            return null;
        }
    }

    function buildWindowDropPlannerSnapshot() {
        try {
            if (!windowDropTargetIsExact()) {
                return null;
            }

            const expectedContext = context;
            const expectedColumns = columns;
            const expectedColumnFrames = columnFrames;
            const expectedPresentations = tiledPresentations;
            const expectedLiveColumnFrames = spatialLiveColumnFrames;
            const expectedRowGeometryPlan = spatialRowGeometryPlan;
            const expectedDesktop = desktop;
            const expectedDesktopId = desktopId;
            const expectedScreen = screen;
            const expectedOutputId = outputId;
            const activityId = String(KWin.Workspace.currentActivity);
            const cardWidth = Number(width);
            const cardHeight = Number(height);
            if (!Array.isArray(expectedColumns) || expectedColumns.length > 512
                    || !Array.isArray(expectedColumnFrames)
                    || expectedColumnFrames.length !== expectedColumns.length
                    || !expectedPresentations || !expectedRowGeometryPlan
                    || !Number.isFinite(cardWidth) || cardWidth <= 0
                    || !Number.isFinite(cardHeight) || cardHeight <= 0
                    || (expectedContext === null
                        ? expectedColumns.length !== 0
                        : expectedContext.columns !== expectedColumns
                          || expectedContext.activityId !== activityId
                          || expectedContext.desktopId !== expectedDesktopId
                          || expectedContext.outputId !== expectedOutputId)
                    || (expectedLiveColumnFrames !== null
                        && (!Array.isArray(expectedLiveColumnFrames)
                            || expectedLiveColumnFrames.length !== expectedColumns.length))) {
                return null;
            }

            const rowFrame = {
                height: cardHeight,
                width: cardWidth,
                x: 0,
                y: 0
            };
            const plannerColumns = [];
            const knownWindowIds = Object.create(null);
            const previewFrames = Object.create(null);
            const targetWindowIds = Object.create(null);
            for (let columnIndex = 0; columnIndex < expectedColumns.length; columnIndex += 1) {
                const column = expectedColumns[columnIndex];
                const members = column ? column.members : null;
                const selectedMemberIndex = column ? column.selectedMemberIndex : -1;
                if (!column || !Array.isArray(members) || members.length < 1 || members.length > 256
                        || (column.presentation !== "stacked" && column.presentation !== "tabbed")
                        || !Number.isInteger(selectedMemberIndex) || selectedMemberIndex < 0
                        || selectedMemberIndex >= members.length) {
                    return null;
                }

                const sourceColumnFrame = spatialSourceColumnFrame(columnIndex);
                const projectedColumnFrame = expectedColumnFrames[columnIndex];
                const liveColumnPlan = expectedLiveColumnFrames === null
                    ? null : expectedLiveColumnFrames[columnIndex];
                if (!sourceColumnFrame || !projectedColumnFrame
                        || !Number.isFinite(projectedColumnFrame.x)
                        || !Number.isFinite(projectedColumnFrame.width)
                        || projectedColumnFrame.width <= 0
                        || (liveColumnPlan !== null
                            && !spatialLiveColumnPlanIsExact(liveColumnPlan, columnIndex))) {
                    return null;
                }

                const liveColumn = liveColumnPlan !== null;
                const projectedX = liveColumn ? Number(liveColumnPlan.x) : Number(projectedColumnFrame.x);
                const projectedWidth = liveColumn
                    ? Number(liveColumnPlan.width) : Number(projectedColumnFrame.width);
                const visibleColumnFrame = intersectRects(rowFrame, {
                    height: cardHeight,
                    width: projectedWidth,
                    x: projectedX,
                    y: 0
                });
                const previewColumnFrame = visibleColumnFrame
                    ? Object.freeze(plainRect(visibleColumnFrame)) : null;
                const plannerMembers = [];
                for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
                    const member = members[memberIndex];
                    const windowId = member ? member.windowId : null;
                    const tiled = typeof windowId === "string" ? expectedPresentations[windowId] : null;
                    const selected = column.presentation !== "tabbed"
                        || memberIndex === selectedMemberIndex;
                    if (typeof windowId !== "string" || windowId.length === 0
                            || knownWindowIds[windowId] === true || !tiled
                            || tiled.columnIndex !== columnIndex || tiled.memberIndex !== memberIndex
                            || tiled.selected !== selected || tiled.plannedColumnFrame !== sourceColumnFrame) {
                        return null;
                    }
                    knownWindowIds[windowId] = true;

                    const liveMemberFrame = liveColumn ? liveColumnPlan.memberFrames[memberIndex] : null;
                    if (!selected) {
                        if (tiled.thumbnailFrame !== null || liveMemberFrame !== null) {
                            return null;
                        }
                        continue;
                    }
                    if (!visibleColumnFrame) {
                        continue;
                    }

                    const projectedMemberFrame = liveColumn ? liveMemberFrame : tiled.thumbnailFrame;
                    if (!projectedMemberFrame
                            || !projectionGeometryScalarsAreValid(projectedMemberFrame.x,
                                                                  projectedMemberFrame.y,
                                                                  projectedMemberFrame.width,
                                                                  projectedMemberFrame.height)) {
                        return null;
                    }

                    const visibleMemberFrame = intersectRects(visibleColumnFrame, projectedMemberFrame);
                    if (!visibleMemberFrame) {
                        continue;
                    }
                    const previewMemberFrame = Object.freeze(plainRect(visibleMemberFrame));
                    plannerMembers.push({
                        frame: previewMemberFrame,
                        windowId
                    });
                    previewFrames[windowId] = Object.freeze({
                        columnFrame: previewColumnFrame,
                        memberFrame: previewMemberFrame
                    });
                    targetWindowIds[windowId] = true;
                }

                if (!visibleColumnFrame) {
                    continue;
                }
                if (plannerMembers.length === 0) {
                    return null;
                }
                plannerColumns.push({
                    frame: previewColumnFrame,
                    members: plannerMembers
                });
            }

            if (expectedColumns.length > 0 && plannerColumns.length === 0) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.buildOverviewSpatialWindowDropPlan !== "function"
                    || typeof runtime.hitTestOverviewSpatialWindowDrop !== "function") {
                return null;
            }

            const plan = runtime.buildOverviewSpatialWindowDropPlan({
                rows: [{
                    activityId,
                    columns: plannerColumns,
                    desktopId: expectedDesktopId,
                    frame: rowFrame,
                    outputId: expectedOutputId
                }]
            });
            if (!plan || !Object.isFrozen(plan)
                    || context !== expectedContext || columns !== expectedColumns
                    || (expectedContext !== null && expectedContext.columns !== expectedColumns)
                    || columnFrames !== expectedColumnFrames
                    || tiledPresentations !== expectedPresentations
                    || spatialLiveColumnFrames !== expectedLiveColumnFrames
                    || spatialRowGeometryPlan !== expectedRowGeometryPlan || desktop !== expectedDesktop
                    || desktopId !== expectedDesktopId || screen !== expectedScreen || outputId !== expectedOutputId
                    || Number(width) !== cardWidth || Number(height) !== cardHeight
                    || String(KWin.Workspace.currentActivity) !== activityId) {
                return null;
            }

            Object.freeze(previewFrames);
            Object.freeze(targetWindowIds);
            return Object.freeze({
                activityId,
                cardHeight,
                cardWidth,
                columnFrames: expectedColumnFrames,
                columns: expectedColumns,
                context: expectedContext,
                contextColumnCount: expectedColumns.length,
                desktop: expectedDesktop,
                desktopId: expectedDesktopId,
                liveColumnFrames: expectedLiveColumnFrames,
                outputId: expectedOutputId,
                plan,
                previewFrames,
                rowGeometryPlan: expectedRowGeometryPlan,
                screen: expectedScreen,
                targetWindowIds,
                tiledPresentations: expectedPresentations
            });
        } catch (error) {
            return null;
        }
    }

    function windowDropPlannerSnapshotIsExact(snapshot) {
        try {
            return snapshot && Object.isFrozen(snapshot) && Object.isFrozen(snapshot.plan)
                    && Object.isFrozen(snapshot.previewFrames) && Object.isFrozen(snapshot.targetWindowIds)
                    && windowDropTargetIsExact()
                    && snapshot.context === context && snapshot.columns === columns
                    && (snapshot.context === null
                        ? snapshot.contextColumnCount === 0
                        : snapshot.context.columns === snapshot.columns
                          && snapshot.context.activityId === snapshot.activityId
                          && snapshot.context.desktopId === snapshot.desktopId
                          && snapshot.context.outputId === snapshot.outputId)
                    && snapshot.columnFrames === columnFrames
                    && snapshot.tiledPresentations === tiledPresentations
                    && snapshot.liveColumnFrames === spatialLiveColumnFrames
                    && snapshot.rowGeometryPlan === spatialRowGeometryPlan
                    && snapshot.desktop === desktop && snapshot.desktopId === desktopId
                    && snapshot.screen === screen && snapshot.outputId === outputId
                    && snapshot.activityId === String(KWin.Workspace.currentActivity)
                    && snapshot.cardWidth === Number(width) && snapshot.cardHeight === Number(height)
                    && snapshot.contextColumnCount === snapshot.columns.length;
        } catch (error) {
            return false;
        }
    }

    function hitWindowDropPlannerSnapshot(snapshot, localPosition) {
        try {
            if (!windowDropPlannerSnapshotIsExact(snapshot)
                    || !spatialDragScenePointIsFinite(localPosition)) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.hitTestOverviewSpatialWindowDrop !== "function") {
                return null;
            }
            const target = runtime.hitTestOverviewSpatialWindowDrop(snapshot.plan, localPosition);
            return windowDropPlannerTargetMatchesSnapshot(target, snapshot) ? target : null;
        } catch (error) {
            return null;
        }
    }

    function windowDropPlannerTargetIsExact(target, snapshot) {
        return windowDropPlannerSnapshotIsExact(snapshot)
            && windowDropPlannerTargetMatchesSnapshot(target, snapshot);
    }

    function windowDropPlannerTargetMatchesSnapshot(target, snapshot) {
        try {
            if (!target || !snapshot || !Object.isFrozen(target) || target.rowIndex !== 0
                    || target.activityId !== snapshot.activityId
                    || target.desktopId !== snapshot.desktopId || target.outputId !== snapshot.outputId) {
                return false;
            }
            if (target.kind === "empty-row") {
                return snapshot.contextColumnCount === 0;
            }
            return (target.kind === "column-boundary" || target.kind === "stack-insertion")
                    && (target.position === "before" || target.position === "after")
                    && typeof target.targetWindowId === "string" && target.targetWindowId.length > 0
                    && snapshot.targetWindowIds[target.targetWindowId] === true;
        } catch (error) {
            return false;
        }
    }

    function planWindowDropPreview(target, snapshot) {
        try {
            if (!windowDropPlannerTargetIsExact(target, snapshot)
                    || !snapshot.previewFrames || !Object.isFrozen(snapshot.previewFrames)) {
                return null;
            }

            if (target.kind === "empty-row") {
                const minimumExtent = Math.min(snapshot.cardWidth, snapshot.cardHeight);
                const inset = Math.max(0, Math.min(10, Math.floor((minimumExtent - 1) / 4)));
                const surface = Object.freeze({
                    height: snapshot.cardHeight - inset * 2,
                    width: snapshot.cardWidth - inset * 2,
                    x: inset,
                    y: inset
                });
                return windowDropPreviewFrameIsBounded(surface, snapshot)
                    ? Object.freeze({ kind: target.kind, marker: null, surface }) : null;
            }

            const frames = snapshot.previewFrames[target.targetWindowId];
            if (!frames || !Object.isFrozen(frames) || !Object.isFrozen(frames.columnFrame)
                    || !Object.isFrozen(frames.memberFrame)
                    || !windowDropPreviewFrameIsBounded(frames.columnFrame, snapshot)
                    || !windowDropPreviewFrameIsBounded(frames.memberFrame, snapshot)) {
                return null;
            }

            if (target.kind === "stack-insertion") {
                const frame = frames.memberFrame;
                const thickness = Math.max(2, Math.min(6, frame.width, frame.height));
                const halfHeight = frame.height / 2;
                const surface = Object.freeze({
                    height: halfHeight,
                    width: frame.width,
                    x: frame.x,
                    y: target.position === "before" ? frame.y : frame.y + halfHeight
                });
                const marker = Object.freeze({
                    height: thickness,
                    width: frame.width,
                    x: frame.x,
                    y: target.position === "before" ? frame.y : frame.y + frame.height - thickness
                });
                return windowDropPreviewFrameIsBounded(surface, snapshot)
                        && windowDropPreviewFrameIsBounded(marker, snapshot)
                    ? Object.freeze({ kind: target.kind, marker, surface }) : null;
            }

            if (target.kind !== "column-boundary") {
                return null;
            }

            const frame = frames.columnFrame;
            const thickness = Math.max(2, Math.min(6, frame.width, frame.height));
            const surfaceWidth = Math.max(thickness, Math.min(28, frame.width / 4));
            const surface = Object.freeze({
                height: frame.height,
                width: surfaceWidth,
                x: target.position === "before" ? frame.x : frame.x + frame.width - surfaceWidth,
                y: frame.y
            });
            const marker = Object.freeze({
                height: frame.height,
                width: thickness,
                x: target.position === "before" ? frame.x : frame.x + frame.width - thickness,
                y: frame.y
            });
            return windowDropPreviewFrameIsBounded(surface, snapshot)
                    && windowDropPreviewFrameIsBounded(marker, snapshot)
                ? Object.freeze({ kind: target.kind, marker, surface }) : null;
        } catch (error) {
            return null;
        }
    }

    function windowDropPreviewFrameIsBounded(frame, snapshot) {
        return frame && snapshot
                && Number.isFinite(frame.x) && Number.isFinite(frame.y)
                && Number.isFinite(frame.width) && Number.isFinite(frame.height)
                && frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0
                && frame.x + frame.width <= snapshot.cardWidth
                && frame.y + frame.height <= snapshot.cardHeight;
    }

    function windowDropTargetIsExact() {
        try {
            const activityId = String(KWin.Workspace.currentActivity);
            const contextIsExact = context === null
                ? Array.isArray(columns) && columns.length === 0
                : context && context.columns === columns && context.desktopId === desktopId
                  && context.outputId === outputId && context.activityId === activityId;
            return enabled && typeof searchQuery === "string" && searchQuery.trim().length === 0
                    && desktop && screen && desktop.id !== undefined && desktop.id !== null
                    && typeof desktopId === "string" && desktopId.length > 0
                    && String(desktop.id) === desktopId
                    && typeof outputId === "string" && outputId.length > 0
                    && activityId.length > 0 && contextIsExact;
        } catch (error) {
            return false;
        }
    }

    function windowDropSourceWorkspaceRelationIsExact(source) {
        try {
            if (!source || !source.sourceDesktop || source.sourceDesktop.id === undefined
                    || source.sourceDesktop.id === null || typeof source.sourceDesktopId !== "string"
                    || source.sourceDesktopId.length === 0
                    || String(source.sourceDesktop.id) !== source.sourceDesktopId) {
                return false;
            }

            const sameDesktop = source.sourceDesktop === desktop;
            const sameDesktopId = source.sourceDesktopId === desktopId;
            return sameDesktop === sameDesktopId;
        } catch (error) {
            return false;
        }
    }

    function windowDropSourceTargetsDifferentWorkspace(source) {
        return source && source.sourceDesktop !== desktop && source.sourceDesktopId !== desktopId;
    }

    function windowDropSourceTiledPresentationIsExact(source) {
        try {
            const windowId = source ? source.windowId : "";
            const tiled = source ? source.tiledPresentation : null;
            const frame = source ? source.frame : null;
            return typeof windowId === "string" && windowId.length > 0 && tiled
                    && tiledPresentations[windowId] === tiled && tiled.selected === true
                    && Number.isInteger(tiled.columnIndex) && tiled.columnIndex >= 0
                    && Number.isInteger(tiled.memberIndex) && tiled.memberIndex >= 0
                    && frame && frame.floating === false;
        } catch (error) {
            return false;
        }
    }

    function windowDropIsValid(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-window") >= 0
                    && windowCanDrag(source) && source.dragEligible === true
                    && source.spatialDragLifecycleActive === true && windowDropTargetIsExact()
                    && source.sourceScreen === screen && windowDropSourceTiledPresentationIsExact(source)
                    && windowDropSourceWorkspaceRelationIsExact(source);
        } catch (error) {
            return false;
        }
    }

    function windowDropSourceIsEligible(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-window") >= 0
                    && windowCanDrag(source)
                    && source.dragEligible === true && source.spatialDragLifecycleActive === true
                    && source.minimizedWindow !== true && windowDropTargetIsExact()
                    && source.sourceScreen === screen && windowDropSourceTiledPresentationIsExact(source)
                    && windowDropSourceWorkspaceRelationIsExact(source);
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

    function planMinimizedPlaceholderFrame(frame) {
        if (!frame || !viewport || viewport.width <= 0 || viewport.height <= 0) {
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
        const plan = spatialRowGeometryPlan;
        const sourceFrames = plan ? plan.windowFrames : null;
        if (!context || !screen || !sourceFrames || !Number.isInteger(sourceFrames.length)) {
            return presentations;
        }

        let sourceFrameIndex = 0;
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
            const column = columns[columnIndex];
            if (!column || !column.members || !Number.isInteger(column.members.length)
                    || column.members.length < 1 || column.members.length > 256
                    || (column.presentation !== "stacked" && column.presentation !== "tabbed")
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0 || column.selectedMemberIndex >= column.members.length) {
                return Object.create(null);
            }

            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const sourceFrame = sourceFrames[sourceFrameIndex];
                if (!member || !sourceFrame || sourceFrame.columnId !== `overview-column-${columnIndex}`
                        || sourceFrame.columnIndex !== columnIndex || sourceFrame.memberIndex !== memberIndex
                        || sourceFrame.windowId !== member.windowId
                        || !projectionGeometryScalarsAreValid(sourceFrame.x, sourceFrame.y,
                                                              sourceFrame.width, sourceFrame.height)) {
                    return Object.create(null);
                }

                const selected = column.presentation !== "tabbed"
                    || memberIndex === column.selectedMemberIndex;
                const frame = {
                    floating: false,
                    height: sourceFrame.height * projectionScale,
                    width: sourceFrame.width * projectionScale,
                    x: viewportOriginX + (sourceFrame.x - logicalViewportOffset) * projectionScale,
                    y: viewportOriginY + sourceFrame.y * projectionScale
                };
                if (!projectionGeometryScalarsAreValid(frame.x, frame.y, frame.width, frame.height)) {
                    return Object.create(null);
                }

                presentations[member.windowId] = {
                    columnIndex,
                    memberIndex,
                    plannedColumnFrame: spatialSourceColumnFrame(columnIndex),
                    selected,
                    thumbnailFrame: selected ? frame : null
                };
                sourceFrameIndex += 1;
            }
        }

        return sourceFrameIndex === sourceFrames.length ? presentations : Object.create(null);
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

    function spatialLiveColumnPlan(columnIndex) {
        const liveFrames = spatialLiveColumnFrames;
        return liveFrames && Number.isInteger(columnIndex)
            && columnIndex >= 0 && columnIndex < liveFrames.length ? liveFrames[columnIndex] : null;
    }

    function columnShellFrame(columnIndex, livePlan) {
        return livePlan !== null ? livePlan : columnFrame(columnIndex);
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
                if (column.presentation === "tabbed"
                        && (!Number.isInteger(column.selectedMemberIndex)
                            || column.selectedMemberIndex < 0
                            || column.selectedMemberIndex >= column.members.length)) {
                    return null;
                }
                if (column.presentation === "tabbed") {
                    const memberIds = Object.create(null);
                    for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                        const member = column.members[memberIndex];
                        const memberId = member ? member.windowId : null;
                        if (typeof memberId !== "string" || memberId.length === 0 || memberIds[memberId] === true) {
                            return null;
                        }
                        memberIds[memberId] = true;
                    }
                }
                samples.push([]);
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
                const tabbed = column && column.presentation === "tabbed";
                if (!column || !member || member.windowId !== windowId
                        || !columnSamples || columnSamples.length >= members.length) {
                    return null;
                }
                if (tabbed && (column.selectedMemberIndex !== memberIndex || tiled.selected !== true
                               || columnSamples.length !== 0)) {
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
                const tabbed = column.presentation === "tabbed";

                const plan = runtime.aggregateOverviewSpatialLiveColumnGeometry({
                                                                                    columnIndex,
                                                                                    memberCount: column.members.length,
                                                                                    presentation: tabbed
                                                                                        ? "tabbed" : "stacked",
                                                                                    samples: samples[columnIndex],
                                                                                    selectedMemberIndex: tabbed
                                                                                        ? column.selectedMemberIndex
                                                                                        : undefined
                                                                                });
                frames.push(spatialLiveColumnPlanIsExact(plan, columnIndex) ? plan : null);
            }

            if (!liveGeometryEnabled || !current || context !== expectedContext || screen !== expectedScreen
                    || expectedContext.columns !== expectedColumns || tiledPresentations !== expectedPresentations
                    || windowRepeater.count !== windowCount || spatialLiveGeometryRevision !== revision) {
                return null;
            }
            return Object.freeze(frames);
        } catch (error) {
            return null;
        }
    }

    function spatialLiveColumnPlanIsExact(plan, columnIndex) {
        try {
            if (!plan || Array.isArray(plan) || !Number.isInteger(columnIndex)
                    || columnIndex < 0 || columnIndex >= columns.length || plan.columnIndex !== columnIndex
                    || !Number.isFinite(plan.x) || !Number.isFinite(plan.width) || plan.width <= 0
                    || !Number.isFinite(plan.x + plan.width) || !Array.isArray(plan.memberFrames)) {
                return false;
            }

            const column = columns[columnIndex];
            const members = column ? column.members : null;
            if (!column || !members
                    || !Number.isInteger(members.length) || members.length < 1 || members.length > 256
                    || plan.memberFrames.length !== members.length) {
                return false;
            }

            const tabbed = column.presentation === "tabbed";
            const selectedMemberIndex = column.selectedMemberIndex;
            if (tabbed && (!Number.isInteger(selectedMemberIndex) || selectedMemberIndex < 0
                           || selectedMemberIndex >= members.length
                           || plan.selectedMemberIndex !== selectedMemberIndex)) {
                return false;
            }

            for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
                const member = members[memberIndex];
                const frame = plan.memberFrames[memberIndex];
                if (!member || typeof member.windowId !== "string" || member.windowId.length === 0) {
                    return false;
                }
                if (tabbed && memberIndex !== selectedMemberIndex) {
                    if (frame !== null) {
                        return false;
                    }
                    continue;
                }
                if (!frame || Array.isArray(frame) || frame.windowId !== member.windowId
                        || frame.columnIndex !== columnIndex || frame.memberIndex !== memberIndex
                        || frame.floating !== false || frame.x !== plan.x || frame.width !== plan.width
                        || !projectionGeometryScalarsAreValid(frame.x, frame.y, frame.width, frame.height)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
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

    function frameForWindow(window, windowId, tiled, spatialLiveFrame) {
        if (tiled !== undefined) {
            const column = context && context.columns && Number.isInteger(tiled.columnIndex)
                && tiled.columnIndex >= 0 && tiled.columnIndex < context.columns.length
                ? context.columns[tiled.columnIndex] : null;
            if (column && column.presentation === "tabbed") {
                const liveFrame = spatialLiveTabbedWindowFrame(windowId, tiled, column);
                return liveFrame !== null ? liveFrame : tiled.thumbnailFrame;
            }
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

    function spatialLiveTabbedWindowFrame(windowId, tiled, column) {
        try {
            if (!liveGeometryEnabled || !current || !tiled || !column || column.presentation !== "tabbed"
                    || !column.members || !Number.isInteger(tiled.columnIndex)
                    || !Number.isInteger(tiled.memberIndex) || tiled.selected !== true
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex !== tiled.memberIndex
                    || tiled.memberIndex < 0 || tiled.memberIndex >= column.members.length
                    || context.columns[tiled.columnIndex] !== column
                    || tiledPresentations[windowId] !== tiled) {
                return null;
            }

            const member = column.members[tiled.memberIndex];
            const plan = spatialLiveColumnPlan(tiled.columnIndex);
            const frame = plan && plan.memberFrames ? plan.memberFrames[tiled.memberIndex] : null;
            if (!member || member.windowId !== windowId || !plan
                    || plan.selectedMemberIndex !== tiled.memberIndex
                    || !spatialLiveWindowPlanIsExact(frame, windowId, tiled)) {
                return null;
            }

            return frame;
        } catch (error) {
            return null;
        }
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
            if (!column || !column.members
                    || memberIndex < 0 || memberIndex >= column.members.length) {
                return null;
            }

            const expectedMembers = column.members;
            const expectedPresentation = column.presentation;
            const expectedSelectedMemberIndex = column.selectedMemberIndex;
            const tabbed = expectedPresentation === "tabbed";
            const member = expectedMembers[memberIndex];
            const sourceColumnFrame = spatialSourceColumnFrame(columnIndex);
            if (!member || member.windowId !== windowId || !sourceColumnFrame
                    || sourceColumnFrame !== tiled.plannedColumnFrame || tiled.selected !== true
                    || (tabbed && (!Number.isInteger(expectedSelectedMemberIndex)
                                   || expectedSelectedMemberIndex !== memberIndex))) {
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
                    || column.presentation !== expectedPresentation || column.members !== expectedMembers
                    || column.selectedMemberIndex !== expectedSelectedMemberIndex
                    || expectedMembers[memberIndex] !== member || member.windowId !== windowId
                    || tiledPresentations[windowId] !== tiled || tiled.columnIndex !== columnIndex
                    || tiled.memberIndex !== memberIndex || tiled.selected !== true
                    || (tabbed && expectedSelectedMemberIndex !== memberIndex)
                    || tiled.plannedColumnFrame !== sourceColumnFrame
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
