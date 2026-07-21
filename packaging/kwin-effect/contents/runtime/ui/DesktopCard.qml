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
    required property bool desktopSurfaceEnabled
    required property var desktopSurfaceLifecycleEvent
    required property string desktopId
    required property var floatingWindows
    required property bool interactionEligible
    required property bool liveGeometryEnabled
    required property bool overviewAlwaysCenterSingleColumn
    required property int overviewContextGeneration
    required property int overviewSessionId
    required property real overviewGap
    required property string overviewActivityId
    required property string outputId
    required property string outputName
    required property var screen
    required property string searchQuery
    required property var searchQueryPlan
    required property int searchResultCount
    required property var spatialDropBasisProvider
    required property bool spatialDirectDragBlocked
    required property bool spatialMotionEligible
    required property bool spatialMotionStartEligible
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
    signal columnDropped(var source, var expectedTargetDesktop, string expectedTargetDesktopId,
                         var expectedScreen, var exactTarget, string basisFingerprint)
    signal columnSpatialDragStarted(var source, real sceneX, real sceneY)
    signal columnSpatialDragMoved(var source, real sceneX, real sceneY)
    signal columnSpatialDragFinished(var source)
    signal windowDropped(var candidate, string expectedWindowId, var expectedSourceDesktop,
                         string expectedSourceDesktopId, var expectedTargetDesktop,
                         string expectedTargetDesktopId, var expectedScreen, var exactTarget,
                         string basisFingerprint)
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
    readonly property string desktopSurfaceActivityId: KWin.Workspace.currentActivity === undefined
        || KWin.Workspace.currentActivity === null ? "" : String(KWin.Workspace.currentActivity)
    readonly property string desktopSurfaceActivityBindingId: desktopSurfaceActivityId.length > 0
        ? desktopSurfaceActivityId : "driftile-unavailable-activity"
    readonly property bool desktopSurfaceContextExact: desktopSurfaceContextIsExact()
    readonly property bool desktopSurfaceReloadContextExact: desktopSurfaceReloadContextIsExact()
    property bool desktopSurfaceContextInvalidated: false
    property bool desktopSurfaceReady: false
    property int desktopSurfaceReadyToken: 0
    property int desktopSurfaceLoadedToken: 0
    property int desktopSurfaceReloadRevision: 0
    property int desktopSurfaceReloadToken: 0
    property int desktopSurfaceReloadGeneration: 0
    property string desktopSurfaceReloadActivityId: ""
    property var desktopSurfaceReloadDesktop: null
    property string desktopSurfaceReloadDesktopId: ""
    property var desktopSurfaceReloadScreen: null
    property string desktopSurfaceReloadScreenName: ""
    property string desktopSurfaceReloadOutputId: ""
    readonly property real contentLeft: 0
    readonly property real contentTop: 0
    readonly property real contentWidth: Math.max(1, width)
    readonly property real contentHeight: Math.max(1, height)
    readonly property real columnControlLaneHeight: 26
    readonly property real tabRailMinimumY: contentTop + columnControlLaneHeight + 4
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
    readonly property var tabRailPlans: buildTabRailPlans()
    readonly property var floatingWindowIds: buildFloatingWindowIds()
    property int spatialLiveGeometryRevision: 0
    property int attentionRevision: 0
    property int columnDragEligibilityRevision: 0
    property bool columnDragEligibilityRefreshPending: false
    property var columnDragActiveSource: null
    property var columnPointerHoverSource: null
    property var columnPointerPressSource: null
    property bool columnDropHoverOwned: false
    property var columnDropHoverSource: null
    property string columnDropHoverSourceWindowId: ""
    property var columnDropHoverDesktop: null
    property string columnDropHoverDesktopId: ""
    property var columnDropHoverScreen: null
    property var columnDropHoverSnapshot: null
    property var columnDropHoverTarget: null
    property var columnDropHoverPreview: null
    property bool columnDropHoverCrossWorkspace: false
    property var windowDragActiveSource: null
    property int windowDragValidationRevision: 0
    property bool windowDropHoverOwned: false
    property var windowDropHoverSource: null
    property string windowDropHoverSourceWindowId: ""
    property var windowDropHoverDesktop: null
    property string windowDropHoverDesktopId: ""
    property var windowDropHoverScreen: null
    property var windowDropHoverSnapshot: null
    property var windowDropHoverTarget: null
    property var windowDropHoverPreview: null
    property bool windowDropHoverCrossWorkspace: false
    property string presentationMotionPhase: "invalid"
    property int presentationMotionRequestId: 0
    property int presentationMotionSeedRequestId: -1
    property bool presentationMotionValidationPending: false
    property real presentationMotionProgress: 1
    property var presentationMotionCandidateSnapshot: null
    property var presentationMotionFromSnapshot: null
    property var presentationMotionTargetSnapshot: null
    property var presentationMotionTracksByWindowId: Object.create(null)
    property var presentationMotionOwner: null
    readonly property bool internalMotionActive: presentationMotionPhase === "validating"
        || presentationMotionPhase === "animating"
    readonly property var presentationMotionSamplesByWindowId: buildPresentationMotionSamples(
        presentationMotionProgress, presentationMotionTracksByWindowId,
        presentationMotionPhase, presentationMotionOwner)

    opacity: searchDeemphasized ? 0.42 : 1

    NumberAnimation {
        id: presentationMotionAnimation

        target: card
        property: "presentationMotionProgress"
        from: 0
        to: 1
        duration: 150
        easing.type: Easing.OutCubic
        onFinished: card.completePresentationMotion()
    }

    Item {
        id: numberGutter

        readonly property bool keyboardSelected: card.searchQuery.trim().length === 0
            && card.keyboardSelectionId === card.desktopNavigationTargetId()
        readonly property bool attentionRequested: card.anyWindowDemandsAttention(card.attentionRevision)

        x: Math.max(6, Math.min(card.width - width - 6,
                                card.viewportOriginX >= width + 12
                                ? card.viewportOriginX - width - 10
                                : card.viewportOriginX + 10))
        y: Math.max(6, Math.min(card.height - height - 6, card.viewportOriginY + 8))
        width: 36
        height: 36
        z: 9500

        Rectangle {
            id: numberGutterBackplate

            anchors.fill: parent
            color: "#dc111824"
            border.width: 1
            border.color: "#805f718a"
            radius: 4
        }

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
            z: 1
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
            z: 2
        }

        Loader {
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 1
            width: item ? item.implicitWidth : 0
            height: item ? item.implicitHeight : 0
            active: card.searchQuery.trim().length > 0 && card.searchResultCount > 0
            z: 2

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
            z: 3
        }

        TapHandler {
            id: numberGutterTapHandler

            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
            gesturePolicy: TapHandler.DragThreshold
            enabled: card.desktop && card.screen
                && card.searchQuery.trim().length === 0 && !card.spatialDirectDragBlocked
            onTapped: card.desktopTapped(card.desktop, card.desktopId, card.screen)
        }

        DragHandler {
            id: desktopReorderHandler

            target: null
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            acceptedModifiers: Qt.NoModifier
            enabled: card.desktopReorderEnabled && card.desktop && card.screen
                && !card.spatialDirectDragBlocked

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
        z: 9500

        Rectangle {
            id: desktopNameGutterBackplate

            anchors.fill: parent
            color: "#dc111824"
            border.width: 1
            border.color: "#805f718a"
            radius: 4
        }

        Text {
            anchors.fill: parent
            anchors.leftMargin: 7
            anchors.rightMargin: 7
            text: card.desktopLabel ? card.desktopLabel.label : ""
            color: card.current ? "#e8eef9" : "#9eabbe"
            font.bold: card.current
            font.pixelSize: Math.max(10, Math.min(14, desktopNameGutter.height * 0.52))
            horizontalAlignment: Text.AlignLeft
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            z: 1
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
            clip: true
            color: "#171e2a"
            radius: 2
            z: -100

            Loader {
                id: desktopSurfaceLoader

                property bool desktopSurfaceComponentComplete: false
                readonly property bool desktopSurfacePresented: desktopSurfaceLoader.active
                    && desktopSurfaceLoader.status === Loader.Ready
                    && card.desktopSurfaceEnabled && card.desktopSurfaceContextExact
                    && card.desktopSurfaceReloadContextExact && card.desktopSurfaceReady
                    && card.desktopSurfaceReadyToken === card.desktopSurfaceReloadToken
                    && card.desktopSurfaceLoadedToken === card.desktopSurfaceReloadToken
                    && card.desktopSurfaceLoadedItemIsExact(desktopSurfaceLoader.item)

                anchors.fill: parent
                active: card.desktopSurfaceEnabled && card.desktopSurfaceContextExact
                    && card.desktopSurfaceReloadContextExact && card.desktopSurfaceReady
                    && card.desktopSurfaceReadyToken === card.desktopSurfaceReloadToken
                asynchronous: true
                enabled: false
                opacity: 0
                z: 0

                Component.onCompleted: {
                    desktopSurfaceComponentComplete = true;
                    synchronizeDesktopSurfacePresentation();
                }
                onActiveChanged: {
                    if (!active) {
                        card.rejectDesktopSurfaceLoad();
                    }
                    synchronizeDesktopSurfacePresentation();
                }
                onDesktopSurfacePresentedChanged: synchronizeDesktopSurfacePresentation()
                onLoaded: acceptDesktopSurfaceCandidate(desktopSurfaceLoader.item)
                onStatusChanged: {
                    if (status !== Loader.Ready) {
                        card.rejectDesktopSurfaceLoad();
                    }
                    synchronizeDesktopSurfacePresentation();
                }

                NumberAnimation {
                    id: desktopSurfaceFadeIn

                    target: desktopSurfaceLoader
                    property: "opacity"
                    from: 0
                    to: 1
                    duration: 90
                    easing.type: Easing.OutCubic
                }

                function synchronizeDesktopSurfacePresentation() {
                    if (!desktopSurfaceComponentComplete || !desktopSurfacePresented) {
                        desktopSurfaceFadeIn.stop();
                        opacity = 0;
                        return false;
                    }
                    if (desktopSurfaceFadeIn.running || opacity >= 1) {
                        return true;
                    }

                    opacity = 0;
                    desktopSurfaceFadeIn.restart();
                    return true;
                }

                function acceptDesktopSurfaceCandidate(candidate) {
                    const accepted = card.acceptDesktopSurfaceLoad(candidate);
                    synchronizeDesktopSurfacePresentation();
                    return accepted;
                }

                sourceComponent: Component {
                    KWin.DesktopBackground {
                        id: desktopBackground

                        property bool driftileContextCaptured: false
                        property int driftileContextGeneration: 0
                        property int driftileReloadToken: 0
                        property string driftileActivityId: ""
                        property var driftileDesktop: null
                        property string driftileDesktopId: ""
                        property var driftileScreen: null
                        property string driftileScreenName: ""
                        property string driftileOutputId: ""

                        anchors.fill: parent
                        output: driftileScreen
                        desktop: driftileDesktop
                        activity: driftileActivityId
                        enabled: false

                        Component.onCompleted: {
                            if (driftileContextCaptured) {
                                return;
                            }

                            driftileContextGeneration = card.desktopSurfaceReloadGeneration;
                            driftileReloadToken = card.desktopSurfaceReadyToken;
                            driftileActivityId = card.desktopSurfaceReloadActivityId;
                            driftileDesktop = card.desktopSurfaceReloadDesktop;
                            driftileDesktopId = card.desktopSurfaceReloadDesktopId;
                            driftileScreen = card.desktopSurfaceReloadScreen;
                            driftileScreenName = card.desktopSurfaceReloadScreenName;
                            driftileOutputId = card.desktopSurfaceReloadOutputId;
                            driftileContextCaptured = true;
                            desktopSurfaceLoader.acceptDesktopSurfaceCandidate(desktopBackground);
                        }
                    }
                }
            }

            Rectangle {
                anchors.fill: parent
                color: windowDropArea.validTarget ? "#282f4057"
                                                  : card.desktopReorderSource ? "#1850607a"
                                                                              : "transparent"
                z: 1
            }

            Rectangle {
                id: projectedOutputSurfaceBorder

                anchors.fill: parent
                color: "transparent"
                border.width: windowDropArea.validTarget || card.desktopReorderSource ? 2
                                                                                     : card.current ? 1 : 0
                border.color: windowDropArea.validTarget ? "#86aee8"
                                                         : card.desktopReorderSource ? "#668baad6"
                                                                                     : "#66758b"
                radius: 2
                z: 2
            }
        }

        Item {
            id: tabRailLayer

            anchors.fill: parent
            clip: true
            z: 10000
        }

        Repeater {
            id: columnRepeater

            model: card.columns.length

            Item {
                id: columnShell

                required property int index

                readonly property var sourceColumn: Number.isInteger(index)
                    && index >= 0 && index < card.columns.length ? card.columns[index] : null
                readonly property var liveGeometryPlan: card.spatialLiveColumnPlan(index)
                readonly property var frame: card.columnShellFrame(index, liveGeometryPlan)
                readonly property string selectedWindowId: card.selectedWindowIdForColumn(sourceColumn)
                readonly property bool dragHandleAvailable: {
                    const column = sourceColumn;
                    const selectedMemberIndex = column ? column.selectedMemberIndex : -1;
                    return column && card.indexedListHasBoundedLength(column.members, 1, 256)
                        && (column.presentation === "stacked" || column.presentation === "tabbed")
                        && Number.isInteger(selectedMemberIndex) && selectedMemberIndex >= 0
                        && selectedMemberIndex < column.members.length
                        && typeof selectedWindowId === "string" && selectedWindowId.length > 0
                        && column.members[selectedMemberIndex].windowId === selectedWindowId;
                }
                property var selectedPresentation: null
                readonly property var candidate: selectedPresentation ? selectedPresentation.candidate : null
                property bool dragEligible: false
                readonly property var sourceCard: card
                readonly property var sourceContext: card.context
                readonly property var sourceDesktop: card.desktop
                readonly property string sourceDesktopId: card.desktopId
                readonly property var sourceScreen: card.screen
                readonly property string scope: "column"
                readonly property var columnVisualTarget: columnShell
                property var columnDragSnapshot: null
                property bool columnSpatialDragLifecycleActive: false
                property bool touchColumnDragArmed: false
                property point spatialDragHotSpot: Qt.point(0, 0)

                x: frame.x
                y: 0
                width: frame.width
                height: viewport.height
                z: 9000

                Drag.active: false
                Drag.source: columnShell
                Drag.hotSpot.x: spatialDragHotSpot.x
                Drag.hotSpot.y: spatialDragHotSpot.y
                Drag.keys: ["driftile-column"]
                Drag.proposedAction: Qt.MoveAction
                Drag.supportedActions: Qt.MoveAction

                Component.onDestruction: {
                    cancelColumnDrag();
                    card.releaseColumnPointerHover(columnShell);
                }
                onIndexChanged: card.scheduleColumnDragEligibilityRefresh()
                onSourceColumnChanged: card.scheduleColumnDragEligibilityRefresh()
                onSelectedWindowIdChanged: card.scheduleColumnDragEligibilityRefresh()

                function invalidateColumnDragEligibility() {
                    selectedPresentation = null;
                    dragEligible = false;
                }

                function refreshColumnDragEligibility() {
                    if (card.columnDragEligibilityRefreshPending) {
                        invalidateColumnDragEligibility();
                        return false;
                    }
                    selectedPresentation = card.presentationForWindowId(selectedWindowId);
                    dragEligible = selectedPresentation !== null
                        && card.columnDragHandleIsEligible(columnShell);
                    return dragEligible;
                }

                function storeColumnDragHotSpot(scenePosition) {
                    if (!scenePosition || !Number.isFinite(scenePosition.x)
                            || !Number.isFinite(scenePosition.y)) {
                        return false;
                    }
                    try {
                        const localPosition = columnShell.mapFromItem(null, scenePosition.x, scenePosition.y);
                        if (!localPosition || !Number.isFinite(localPosition.x)
                                || !Number.isFinite(localPosition.y)) {
                            return false;
                        }
                        spatialDragHotSpot = Qt.point(localPosition.x, localPosition.y);
                        return true;
                    } catch (error) {
                        return false;
                    }
                }

                function cancelColumnDrag() {
                    columnShell.Drag.cancel();
                    columnShell.Drag.active = false;
                    card.finishColumnSpatialDrag(columnShell);
                    card.releaseColumnPointerPress(columnShell);
                    touchColumnDragArmed = false;
                }

                function releaseColumnDrag(scenePosition) {
                    if (!storeColumnDragHotSpot(scenePosition)) {
                        cancelColumnDrag();
                        return;
                    }
                    columnShell.Drag.drop();
                    columnShell.Drag.active = false;
                    card.finishColumnSpatialDrag(columnShell);
                    card.releaseColumnPointerPress(columnShell);
                    touchColumnDragArmed = false;
                }

                Item {
                    id: columnGrabHandle

                    anchors.top: parent.top
                    readonly property real visibleLeft: Math.max(0, Math.min(columnShell.width,
                                                                             -columnShell.x))
                    readonly property real visibleRight: Math.max(0, Math.min(columnShell.width,
                                                                              viewport.width - columnShell.x))
                    readonly property real visibleWidth: Math.max(0, visibleRight - visibleLeft)
                    x: visibleLeft + (visibleWidth - width) / 2
                    width: Math.min(56, visibleWidth)
                    height: card.columnControlLaneHeight
                    visible: columnShell.dragHandleAvailable && visibleWidth >= 12
                    enabled: visible && (!card.spatialDirectDragBlocked
                                          || card.columnDragActiveSource === columnShell)
                    z: 1

                    Rectangle {
                        anchors.top: parent.top
                        anchors.topMargin: 5
                        anchors.horizontalCenter: parent.horizontalCenter
                        width: Math.max(4, Math.min(38, parent.width - 4))
                        height: 7
                        color: columnShell.columnSpatialDragLifecycleActive ? "#f3f8ff" : "#c6d6ea"
                        border.width: 1
                        border.color: "#b0182433"
                        radius: height / 2
                    }

                    HoverHandler {
                        id: columnPointerHoverHandler

                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: columnGrabHandle.enabled
                        cursorShape: Qt.SizeAllCursor

                        onHoveredChanged: {
                            if (hovered) {
                                card.claimColumnPointerHover(columnShell);
                            } else {
                                card.releaseColumnPointerHover(columnShell);
                            }
                        }
                    }

                    TapHandler {
                        id: columnPointerPressHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        acceptedModifiers: Qt.NoModifier
                        gesturePolicy: TapHandler.ReleaseWithinBounds
                        enabled: columnGrabHandle.enabled
                        grabPermissions: PointerHandler.ApprovesTakeOverByHandlersOfDifferentType
                                         | PointerHandler.ApprovesCancellation

                        onPressedChanged: {
                            if (pressed) {
                                card.claimColumnPointerPress(columnShell);
                            } else if (point.state === EventPoint.Released) {
                                card.releaseColumnPointerPress(columnShell);
                            }
                        }
                    }

                    TapHandler {
                        id: columnTouchHoldHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.TouchScreen
                        acceptedModifiers: Qt.NoModifier
                        gesturePolicy: TapHandler.ReleaseWithinBounds
                        enabled: columnGrabHandle.enabled
                        grabPermissions: PointerHandler.ApprovesTakeOverByHandlersOfDifferentType
                                         | PointerHandler.ApprovesCancellation

                        onPressedChanged: {
                            if (pressed) {
                                columnShell.touchColumnDragArmed = false;
                                card.claimColumnPointerPress(columnShell);
                            } else if (point.state === EventPoint.Released
                                       && !columnTouchDragHandler.active) {
                                card.releaseColumnPointerPress(columnShell);
                                columnShell.touchColumnDragArmed = false;
                            }
                        }
                        onLongPressed: {
                            if (card.refreshColumnDragEligibilityAtPointer(columnShell)) {
                                columnShell.touchColumnDragArmed = true;
                            }
                        }
                    }

                    DragHandler {
                        id: columnTouchDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.TouchScreen
                        acceptedModifiers: Qt.NoModifier
                        dragThreshold: columnShell.touchColumnDragArmed ? 0 : 32767
                        enabled: columnGrabHandle.enabled
                        grabPermissions: PointerHandler.CanTakeOverFromHandlersOfSameType
                                         | PointerHandler.CanTakeOverFromHandlersOfDifferentType
                                         | PointerHandler.CanTakeOverFromItems
                                         | PointerHandler.ApprovesCancellation

                        onActiveTranslationChanged: {
                            if (active && columnShell.columnSpatialDragLifecycleActive) {
                                const scenePosition = centroid.scenePosition;
                                if (columnShell.storeColumnDragHotSpot(scenePosition)) {
                                    card.moveColumnSpatialDrag(columnShell, scenePosition);
                                }
                            }
                        }
                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                if (!columnShell.touchColumnDragArmed
                                        || !card.settlePresentationMotion()
                                        || !columnShell.storeColumnDragHotSpot(point.scenePosition)) {
                                    columnShell.cancelColumnDrag();
                                    return;
                                }
                                card.beginColumnSpatialDrag(columnShell, point.scenePosition);
                                if (!columnShell.columnSpatialDragLifecycleActive) {
                                    columnShell.cancelColumnDrag();
                                    return;
                                }
                                columnShell.Drag.active = true;
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released
                                        && columnShell.columnSpatialDragLifecycleActive) {
                                    columnShell.releaseColumnDrag(point.scenePosition);
                                } else {
                                    columnShell.cancelColumnDrag();
                                }
                            } else if (transition === PointerDevice.CancelGrabExclusive
                                       || transition === PointerDevice.CancelGrabPassive) {
                                columnShell.cancelColumnDrag();
                            }
                        }
                    }

                    DragHandler {
                        id: columnDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        acceptedModifiers: Qt.NoModifier
                        enabled: columnGrabHandle.enabled
                        grabPermissions: PointerHandler.CanTakeOverFromHandlersOfSameType
                                         | PointerHandler.CanTakeOverFromHandlersOfDifferentType
                                         | PointerHandler.CanTakeOverFromItems
                                         | PointerHandler.ApprovesCancellation

                        onActiveTranslationChanged: {
                            if (active && columnShell.columnSpatialDragLifecycleActive) {
                                const scenePosition = centroid.scenePosition;
                                if (columnShell.storeColumnDragHotSpot(scenePosition)) {
                                    card.moveColumnSpatialDrag(columnShell, scenePosition);
                                }
                            }
                        }
                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                if (!card.settlePresentationMotion()
                                        || !columnShell.storeColumnDragHotSpot(point.scenePosition)) {
                                    columnShell.cancelColumnDrag();
                                    return;
                                }
                                card.beginColumnSpatialDrag(columnShell, point.scenePosition);
                                if (!columnShell.columnSpatialDragLifecycleActive) {
                                    columnShell.cancelColumnDrag();
                                    return;
                                }
                                columnShell.Drag.active = true;
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released
                                        && columnShell.columnSpatialDragLifecycleActive) {
                                    columnShell.releaseColumnDrag(point.scenePosition);
                                } else {
                                    columnShell.cancelColumnDrag();
                                }
                            } else if (transition === PointerDevice.CancelGrabExclusive
                                       || transition === PointerDevice.CancelGrabPassive) {
                                columnShell.cancelColumnDrag();
                            }
                        }
                    }
                }
            }
        }

        Item {
            id: emptyContentInput

            anchors.fill: parent
            z: 1

            TapHandler {
                id: emptyContentTapHandler

                acceptedButtons: Qt.LeftButton
                acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
                gesturePolicy: TapHandler.DragThreshold
                enabled: card.desktop && card.screen
                    && card.searchQuery.trim().length === 0 && !card.spatialDirectDragBlocked
                    && !card.internalMotionActive
                onTapped: point => {
                    if (!card.viewportPointHitsWindow(point.position)) {
                        card.desktopTapped(card.desktop, card.desktopId, card.screen);
                    }
                }
            }
        }

        Timer {
            id: columnDragEligibilityRefreshTimer

            interval: 0
            repeat: false
            onTriggered: {
                card.columnDragEligibilityRefreshPending = false;
                card.advanceColumnDragEligibilityRevision();
                card.refreshColumnDragEligibilityDelegates();
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
                card.scheduleColumnDragEligibilityRefresh();
                card.schedulePresentationMotion();
            }
            onItemRemoved: {
                card.navigationTargetsChanged();
                card.attentionRevision += 1;
                card.spatialLiveGeometryRevision += 1;
                card.scheduleColumnDragEligibilityRefresh();
                card.schedulePresentationMotion();
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
                    && selectedThumbnail && matchesSearch && frame !== null
                readonly property var minimizedPlaceholderFrame: minimizedActivationEligible
                    ? card.planMinimizedPlaceholderFrame(frame) : null
                readonly property var tabFrame: card.tabFrameForPresentation(tiledPresentation, windowId)
                readonly property string primaryVisualKind: !matchesSearch || !model.window ? ""
                    : !minimizedWindow && selectedThumbnail && frame !== null ? "thumbnail"
                    : minimizedActivationEligible && minimizedPlaceholderFrame !== null ? "placeholder"
                    : tabFrame !== null ? "tab" : ""
                readonly property var windowLabel: card.planWindowLabel(candidate, matchesSearch && model.window
                    && ((!minimizedWindow && selectedThumbnail && frame !== null && frame !== undefined)
                        || (minimizedPlaceholderFrame !== null && minimizedPlaceholderFrame !== undefined)
                        || (tabFrame !== null && tabFrame !== undefined)))
                readonly property bool dragEligible: card.windowSnapshotCanDrag(windowPresentation)
                    && card.windowDropSourceTiledPresentationIsExact(windowPresentation)
                readonly property bool closeEligible: card.windowSnapshotCanRequestClose(windowPresentation)
                readonly property var sourceDesktop: card.desktop
                readonly property string sourceDesktopId: card.desktopId
                readonly property var sourceScreen: card.screen
                readonly property var sourceCard: card
                readonly property var thumbnailTarget: thumbnailShell
                readonly property var minimizedPlaceholderTarget: minimizedPlaceholderShell
                readonly property var tabTarget: tabShell
                property var windowDragSnapshot: null
                property bool spatialDragLifecycleActive: false
                property bool touchSpatialDragArmed: false

                width: viewport.width
                height: viewport.height
                opacity: thumbnailShell.Drag.active || card.columnDragWindowIsDimmed(windowId) ? 0.2 : 1
                z: frame && frame.floating ? 1000 + index : 100 + index

                onCandidateChanged: {
                    card.schedulePresentationMotion();
                    card.cancelInvalidWindowSpatialDragSource(windowPresentation);
                    refreshActionSnapshot();
                    card.attentionRevision += 1;
                }
                onAttentionRequestedChanged: card.attentionRevision += 1
                onActionSnapshotChanged: card.cancelInvalidWindowSpatialDragSource(windowPresentation)
                onDragEligibleChanged: card.scheduleWindowSpatialDragValidation(windowPresentation)
                onFrameChanged: card.scheduleWindowSpatialDragValidation(windowPresentation)
                onMinimizedPlaceholderFrameChanged: {
                    card.navigationTargetsChanged();
                    card.schedulePresentationMotion();
                }
                onMinimizedWindowChanged: {
                    card.cancelInvalidWindowSpatialDragSource(windowPresentation);
                    card.schedulePresentationMotion();
                }
                onPrimaryVisualKindChanged: {
                    card.navigationTargetsChanged();
                    card.schedulePresentationMotion();
                }
                onSourceDesktopChanged: card.cancelInvalidWindowSpatialDragSource(windowPresentation)
                onSourceDesktopIdChanged: card.cancelInvalidWindowSpatialDragSource(windowPresentation)
                onSourceScreenChanged: card.cancelInvalidWindowSpatialDragSource(windowPresentation)
                onTabFrameChanged: {
                    card.navigationTargetsChanged();
                    card.schedulePresentationMotion();
                }
                onTiledPresentationChanged: {
                    card.scheduleWindowSpatialDragValidation(windowPresentation);
                    card.schedulePresentationMotion();
                }
                onWindowIdChanged: {
                    card.cancelInvalidWindowSpatialDragSource(windowPresentation);
                    card.schedulePresentationMotion();
                }
                onWindowStateChanged: card.navigationTargetsChanged()

                Component.onCompleted: refreshActionSnapshot()
                Component.onDestruction: card.cancelWindowSpatialDragSource(windowPresentation)

                function cancelWindowDrag() {
                    thumbnailShell.Drag.cancel();
                    thumbnailShell.Drag.active = false;
                    card.finishWindowSpatialDrag(windowPresentation);
                    touchSpatialDragArmed = false;
                }

                function refreshActionSnapshot() {
                    actionSnapshot = card.snapshotWindowActions(candidate);
                    card.scheduleColumnDragEligibilityRefresh();
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

                Rectangle {
                    id: tabShell

                    parent: tabRailLayer

                    readonly property var frame: windowPresentation.tabFrame
                    readonly property var visualFrame: card.presentationMotionTabVisualFrame(
                        windowPresentation.windowId, frame)
                    readonly property var visualBaseFrame: frame !== null ? frame : visualFrame
                    readonly property real visualOpacity: card.presentationMotionTabOpacity(
                        windowPresentation.windowId, frame)
                    readonly property bool selectedTab: frame !== null && frame.selected === true
                    readonly property real selectedVisualProgress: card.presentationMotionSelectedProgress(
                        windowPresentation.windowId, selectedTab)
                    readonly property bool minimizedTab: windowPresentation.minimizedWindow
                    readonly property real minimizedVisualProgress: card.presentationMotionMinimizedProgress(
                        windowPresentation.windowId, minimizedTab)
                    readonly property bool attentionTab: windowPresentation.attentionRequested
                    readonly property bool activeTab: KWin.Workspace.activeWindow === windowPresentation.candidate
                    readonly property color restingColor: Qt.rgba(
                        (17 + 20 * minimizedVisualProgress) / 255,
                        (24 + 22 * minimizedVisualProgress) / 255,
                        (36 + 25 * minimizedVisualProgress) / 255,
                        220 / 255)
                    readonly property color labelColor: Qt.rgba(
                        (243 - 69 * minimizedVisualProgress) / 255,
                        (247 - 60 * minimizedVisualProgress) / 255,
                        (255 - 47 * minimizedVisualProgress) / 255,
                        1)
                    readonly property color selectionBorderColor: Qt.rgba(
                        (102 + 32 * selectedVisualProgress) / 255,
                        (117 + 57 * selectedVisualProgress) / 255,
                        (139 + 93 * selectedVisualProgress) / 255,
                        1)
                    readonly property bool activationEligible: windowPresentation.primaryVisualKind === "tab"
                        && frame !== null
                        && windowPresentation.matchesSearch
                    readonly property bool keyboardTarget: activationEligible
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 64 && height >= 20
                    property int activationGestureSerial: 0
                    property int activationTappedSerial: -1
                    property int activationCanceledSerial: -1
                    property int activationConsumedSerial: -1
                    property var minimizedActivationSnapshot: null

                    function nextActivationGestureSerial() {
                        if (activationGestureSerial >= 2147483646) {
                            activationTappedSerial = -1;
                            activationCanceledSerial = -1;
                            activationConsumedSerial = -1;
                            activationGestureSerial = 1;
                        } else {
                            activationGestureSerial += 1;
                        }
                        return activationGestureSerial;
                    }

                    function frameIsExact() {
                        return frame !== null
                            && card.tabFrameForPresentation(windowPresentation.tiledPresentation,
                                                            windowPresentation.windowId) === frame;
                    }

                    function activationIsExact() {
                        return tabShell.visible && tabShell.frameIsExact()
                            && windowPresentation.primaryVisualKind === "tab"
                            && windowPresentation.matchesSearch
                            && card.windowCanNavigate(windowPresentation);
                    }

                    function armMinimizedActivation(point) {
                        const serial = nextActivationGestureSerial();
                        minimizedActivationSnapshot = null;
                        if (!point || point.state !== EventPoint.Pressed
                                || !tabActivationHandler.enabled || !minimizedTab
                                || !activationIsExact()) {
                            return;
                        }

                        const localPosition = point.position;
                        const scenePosition = point.scenePosition;
                        const pointId = point.id;
                        if (!localPosition || !scenePosition || !Number.isFinite(pointId)
                                || !Number.isFinite(localPosition.x)
                                || !Number.isFinite(localPosition.y)
                                || !Number.isFinite(scenePosition.x)
                                || !Number.isFinite(scenePosition.y)
                                || !Number.isFinite(tabShell.width)
                                || !Number.isFinite(tabShell.height)
                                || tabShell.width <= 0 || tabShell.height <= 0
                                || !tabShell.contains(Qt.point(localPosition.x, localPosition.y))
                                || card.closeButtonContainsPoint(tabCloseButton, tabShell,
                                                                 localPosition)) {
                            activationCanceledSerial = serial;
                            return;
                        }

                        minimizedActivationSnapshot = Object.freeze({
                            serial,
                            candidate: windowPresentation.candidate,
                            windowId: windowPresentation.windowId,
                            sourceDesktop: windowPresentation.sourceDesktop,
                            sourceDesktopId: windowPresentation.sourceDesktopId,
                            sourceScreen: windowPresentation.sourceScreen,
                            frame: tabShell.frame,
                            overviewContextGeneration: card.overviewContextGeneration,
                            overviewActivityId: card.overviewActivityId,
                            outputId: card.outputId,
                            pointId,
                            device: point.device,
                            localX: localPosition.x,
                            localY: localPosition.y,
                            sceneX: scenePosition.x,
                            sceneY: scenePosition.y,
                            width: tabShell.width,
                            height: tabShell.height
                        });
                    }

                    function disarmMinimizedActivation(expectedSnapshot) {
                        const snapshot = minimizedActivationSnapshot;
                        if (!snapshot || (expectedSnapshot !== undefined
                                && expectedSnapshot !== null && expectedSnapshot !== snapshot)) {
                            return;
                        }
                        activationCanceledSerial = snapshot.serial;
                        minimizedActivationSnapshot = null;
                    }

                    function activationSnapshotMatchesCurrent(snapshot) {
                        return snapshot !== null && snapshot !== undefined
                            && snapshot.serial === activationGestureSerial
                            && snapshot.candidate === windowPresentation.candidate
                            && snapshot.windowId === windowPresentation.windowId
                            && snapshot.sourceDesktop === windowPresentation.sourceDesktop
                            && snapshot.sourceDesktopId === windowPresentation.sourceDesktopId
                            && snapshot.sourceScreen === windowPresentation.sourceScreen
                            && snapshot.frame === tabShell.frame
                            && snapshot.overviewContextGeneration === card.overviewContextGeneration
                            && snapshot.overviewActivityId === card.overviewActivityId
                            && snapshot.outputId === card.outputId
                            && snapshot.width === tabShell.width
                            && snapshot.height === tabShell.height
                            && tabShell.minimizedTab && tabActivationHandler.enabled
                            && tabShell.activationIsExact();
                    }

                    function armedActivationSnapshotIsExact(snapshot) {
                        return snapshot === minimizedActivationSnapshot
                            && activationTappedSerial !== snapshot.serial
                            && activationCanceledSerial !== snapshot.serial
                            && activationConsumedSerial !== snapshot.serial
                            && activationSnapshotMatchesCurrent(snapshot);
                    }

                    function activationSceneDisplacementIsWithinThreshold(snapshot, sceneX, sceneY) {
                        const threshold = tabActivationHandler.dragThreshold;
                        if (!snapshot || !Number.isFinite(sceneX) || !Number.isFinite(sceneY)
                                || !Number.isFinite(threshold) || threshold < 0) {
                            return false;
                        }
                        const deltaX = sceneX - snapshot.sceneX;
                        const deltaY = sceneY - snapshot.sceneY;
                        return deltaX * deltaX + deltaY * deltaY <= threshold * threshold;
                    }

                    function activationReleaseIsInside(snapshot, release) {
                        if (!release || release.serial !== snapshot.serial
                                || release.pointId !== snapshot.pointId
                                || release.device !== snapshot.device
                                || !activationSceneDisplacementIsWithinThreshold(
                                    snapshot, release.sceneX, release.sceneY)) {
                            return false;
                        }
                        const releaseLocalX = snapshot.localX + release.sceneX - snapshot.sceneX;
                        const releaseLocalY = snapshot.localY + release.sceneY - snapshot.sceneY;
                        if (!Number.isFinite(releaseLocalX) || !Number.isFinite(releaseLocalY)) {
                            return false;
                        }
                        const releaseLocalPosition = Qt.point(releaseLocalX, releaseLocalY);
                        return tabShell.contains(releaseLocalPosition)
                            && !card.closeButtonContainsPoint(tabCloseButton, tabShell,
                                                              releaseLocalPosition);
                    }

                    function dispatchExactActivation(serial, snapshot) {
                        if (serial !== activationGestureSerial
                                || activationCanceledSerial === serial
                                || activationConsumedSerial === serial
                                || (snapshot && !activationSnapshotMatchesCurrent(snapshot))
                                || !tabShell.activationIsExact()) {
                            return false;
                        }

                        const candidate = windowPresentation.candidate;
                        const expectedWindowId = windowPresentation.windowId;
                        const expectedDesktop = windowPresentation.sourceDesktop;
                        const expectedDesktopId = windowPresentation.sourceDesktopId;
                        const expectedScreen = windowPresentation.sourceScreen;
                        activationConsumedSerial = serial;
                        if (minimizedActivationSnapshot
                                && minimizedActivationSnapshot.serial === serial) {
                            minimizedActivationSnapshot = null;
                        }
                        card.windowTapped(candidate, expectedWindowId, expectedDesktop,
                                          expectedDesktopId, expectedScreen);
                        return true;
                    }

                    function handleActivationGrabChanged(transition, point) {
                        if ((transition === PointerDevice.GrabPassive
                                || transition === PointerDevice.GrabExclusive)
                                && point && point.state === EventPoint.Pressed) {
                            armMinimizedActivation(point);
                            return;
                        }
                        if (transition === PointerDevice.CancelGrabPassive
                                || transition === PointerDevice.CancelGrabExclusive) {
                            disarmMinimizedActivation();
                            return;
                        }
                        if (transition !== PointerDevice.UngrabPassive
                                && transition !== PointerDevice.UngrabExclusive) {
                            return;
                        }

                        const snapshot = minimizedActivationSnapshot;
                        if (!snapshot || !point || point.state !== EventPoint.Released
                                || !Number.isFinite(point.id)
                                || !point.scenePosition
                                || !Number.isFinite(point.scenePosition.x)
                                || !Number.isFinite(point.scenePosition.y)) {
                            disarmMinimizedActivation(snapshot);
                            return;
                        }
                        const release = Object.freeze({
                            serial: snapshot.serial,
                            pointId: point.id,
                            device: point.device,
                            sceneX: point.scenePosition.x,
                            sceneY: point.scenePosition.y
                        });
                        Qt.callLater(() => {
                            if (tabShell.armedActivationSnapshotIsExact(snapshot)
                                    && tabShell.activationReleaseIsInside(snapshot, release)) {
                                tabShell.dispatchExactActivation(snapshot.serial, snapshot);
                            } else {
                                tabShell.disarmMinimizedActivation(snapshot);
                            }
                        });
                    }

                    function closeIsExact() {
                        return tabShell.visible && tabShell.frameIsExact()
                            && windowPresentation.matchesSearch
                            && windowPresentation.closeEligible
                            && card.windowSnapshotCanRequestClose(windowPresentation);
                    }

                    x: visualFrame ? visualFrame.x : 0
                    y: visualFrame ? visualFrame.y : 0
                    width: visualBaseFrame ? visualBaseFrame.width : 0
                    height: visualBaseFrame ? visualBaseFrame.height : 0
                    visible: visualFrame !== null && visualOpacity > 0.0001
                        && model.window && windowPresentation.matchesSearch
                    opacity: windowPresentation.opacity * visualOpacity
                    color: tabActivationHandler.pressed ? "#f24b6482"
                        : tabHoverHandler.hovered ? "#e641526b"
                        : restingColor
                    border.width: keyboardSelected || activeTab ? 2 : 1
                    border.color: keyboardSelected ? "#ffd166"
                                                   : attentionTab ? "#e2556f"
                                                                  : activeTab ? "#f4f8ff"
                                                                              : selectionBorderColor
                    radius: 3
                    clip: true
                    z: 5000 + index
                    transform: Scale {
                        origin.x: 0
                        origin.y: 0
                        xScale: tabShell.visualFrame && tabShell.visualBaseFrame
                            && tabShell.visualBaseFrame.width > 0
                            ? tabShell.visualFrame.width / tabShell.visualBaseFrame.width : 1
                        yScale: tabShell.visualFrame && tabShell.visualBaseFrame
                            && tabShell.visualBaseFrame.height > 0
                            ? tabShell.visualFrame.height / tabShell.visualBaseFrame.height : 1
                    }

                    Rectangle {
                        anchors.fill: parent
                        visible: opacity > 0.0001
                        opacity: tabShell.selectedVisualProgress
                        color: "#e63a4960"
                        radius: tabShell.radius
                        enabled: false
                    }

                    WindowApplicationIcon {
                        id: tabApplicationIcon

                        anchors.left: parent.left
                        anchors.leftMargin: tabShell.attentionTab ? 8 : 5
                        anchors.verticalCenter: parent.verticalCenter
                        width: Math.max(10, Math.min(14, tabShell.height - 6))
                        height: width
                        candidate: windowPresentation.candidate
                        presentationEligible: card.showApplicationIcons && tabShell.visible
                            && tabShell.width >= 72 && tabShell.height >= 20
                    }

                    Text {
                        anchors.fill: parent
                        anchors.leftMargin: tabApplicationIcon.iconAvailable
                            ? tabApplicationIcon.x + tabApplicationIcon.width + 4
                            : tabShell.attentionTab ? 8 : 5
                        anchors.rightMargin: tabCloseButton.visible
                            ? 22 + 12 * tabShell.minimizedVisualProgress
                            : 5 + 8 * tabShell.minimizedVisualProgress
                        text: windowPresentation.windowLabel !== null
                            ? windowPresentation.windowLabel.primary
                            : `Tab ${tabShell.frame ? tabShell.frame.memberIndex + 1 : ""}`
                        color: tabShell.labelColor
                        font.bold: tabShell.activeTab
                        font.pixelSize: Math.max(7, Math.min(10, tabShell.height * 0.46))
                        horizontalAlignment: Text.AlignLeft
                        verticalAlignment: Text.AlignVCenter
                        elide: Text.ElideRight
                        textFormat: Text.PlainText
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        width: 3
                        visible: tabShell.attentionTab
                        color: "#e2556f"
                        z: 1
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.bottom: parent.bottom
                        height: 2
                        visible: opacity > 0.0001
                        opacity: tabShell.selectedVisualProgress
                        color: "#86aee8"
                        z: 1
                    }

                    Rectangle {
                        id: tabMinimizedMarker

                        anchors.right: parent.right
                        anchors.rightMargin: 5
                        anchors.verticalCenter: parent.verticalCenter
                        width: 6
                        height: 2
                        visible: opacity > 0.0001 && tabShell.width >= 36
                        opacity: tabShell.minimizedVisualProgress
                        color: "#aebbd0"
                        radius: 1
                        z: 1
                    }

                    WindowCloseButton {
                        id: tabCloseButton

                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.rightMargin: 4 + 12 * tabShell.minimizedVisualProgress
                        width: 14
                        height: 14
                        settingEnabled: card.showWindowCloseButtons
                        closeEligible: windowPresentation.closeEligible
                        keyboardSelected: tabShell.keyboardSelected
                        surfaceLargeEnough: tabShell.closeButtonLargeEnough
                        enabled: card.interactionEligible && !card.spatialDirectDragBlocked
                            && card.columnDragActiveSource === null
                            && card.columnPointerHoverSource === null
                            && card.columnPointerPressSource === null
                        z: 4
                        onCloseRequested: {
                            if (!tabShell.closeIsExact()) {
                                return;
                            }
                            card.windowCloseRequested(windowPresentation.candidate,
                                                      windowPresentation.windowId,
                                                      windowPresentation.sourceDesktop,
                                                      windowPresentation.sourceDesktopId,
                                                      windowPresentation.sourceScreen);
                        }
                    }

                    HoverHandler {
                        id: tabHoverHandler

                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: tabShell.visible && card.interactionEligible
                            && (tabShell.activationEligible || windowPresentation.closeEligible)
                            && !card.spatialDirectDragBlocked
                        cursorShape: Qt.PointingHandCursor
                    }

                    TapHandler {
                        id: tabActivationHandler

                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
                        gesturePolicy: TapHandler.ReleaseWithinBounds
                        grabPermissions: PointerHandler.ApprovesTakeOverByHandlersOfSameType
                                         | PointerHandler.ApprovesTakeOverByHandlersOfDifferentType
                                         | PointerHandler.ApprovesCancellation
                        enabled: tabShell.activationEligible && card.interactionEligible
                            && card.desktop && card.screen && card.columnDragActiveSource === null
                            && card.columnPointerHoverSource === null
                            && card.columnPointerPressSource === null && !card.spatialDirectDragBlocked
                        onEnabledChanged: {
                            if (!enabled) {
                                tabShell.disarmMinimizedActivation();
                            }
                        }
                        onCanceled: tabShell.disarmMinimizedActivation()
                        onLongPressed: tabShell.disarmMinimizedActivation()
                        onGrabChanged: (transition, point) =>
                            tabShell.handleActivationGrabChanged(transition, point)
                        onPressedChanged: {
                            const snapshot = tabShell.minimizedActivationSnapshot;
                            const scenePosition = point.scenePosition;
                            if (!pressed && snapshot && (!scenePosition
                                    || !tabShell.activationSceneDisplacementIsWithinThreshold(
                                        snapshot, scenePosition.x, scenePosition.y))) {
                                tabShell.disarmMinimizedActivation(snapshot);
                            }
                        }
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(tabCloseButton, tabShell,
                                                              point.position)) {
                                tabShell.disarmMinimizedActivation();
                                return;
                            }
                            const serial = tabShell.activationGestureSerial;
                            const snapshot = tabShell.minimizedActivationSnapshot;
                            tabShell.activationTappedSerial = serial;
                            if (snapshot && snapshot.serial === serial) {
                                tabShell.minimizedActivationSnapshot = null;
                            }
                            tabShell.dispatchExactActivation(serial, snapshot);
                        }
                    }

                    TapHandler {
                        acceptedButtons: Qt.MiddleButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: tabShell.visible && windowPresentation.closeEligible
                            && card.interactionEligible && card.columnDragActiveSource === null
                            && card.columnPointerHoverSource === null
                            && card.columnPointerPressSource === null && !card.spatialDirectDragBlocked
                        onTapped: {
                            if (!tabShell.closeIsExact()) {
                                return;
                            }
                            card.windowCloseRequested(windowPresentation.candidate,
                                                      windowPresentation.windowId,
                                                      windowPresentation.sourceDesktop,
                                                      windowPresentation.sourceDesktopId,
                                                      windowPresentation.sourceScreen);
                        }
                    }
                }

                Item {
                    id: thumbnailShell

                    readonly property var visualFrame: card.presentationMotionVisualFrame(
                        windowPresentation.windowId, "thumbnail", windowPresentation.frame,
                        windowPresentation.tiledPresentation !== null
                            && windowPresentation.tiledPresentation !== undefined)
                    readonly property var visualBaseFrame: windowPresentation.frame !== null
                        ? windowPresentation.frame : visualFrame
                    readonly property real visualOpacity: card.presentationMotionVisualOpacity(
                        windowPresentation.windowId, "thumbnail", windowPresentation.primaryVisualKind,
                        windowPresentation.tiledPresentation !== null
                            && windowPresentation.tiledPresentation !== undefined)
                    readonly property bool keyboardTarget: visible
                        && windowPresentation.primaryVisualKind === "thumbnail"
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 52 && height >= 40
                    property point spatialDragHotSpot: Qt.point(0, 0)

                    function storeSpatialDragHotSpot(scenePosition) {
                        if (!scenePosition || !Number.isFinite(scenePosition.x)
                                || !Number.isFinite(scenePosition.y)) {
                            return false;
                        }

                        try {
                            const localPosition = thumbnailShell.mapFromItem(
                                null, scenePosition.x, scenePosition.y);
                            if (!localPosition || !Number.isFinite(localPosition.x)
                                    || !Number.isFinite(localPosition.y)) {
                                return false;
                            }

                            thumbnailShell.spatialDragHotSpot = Qt.point(localPosition.x,
                                                                         localPosition.y);
                            return true;
                        } catch (error) {
                            return false;
                        }
                    }

                    x: visualFrame ? visualFrame.x : 0
                    y: visualFrame ? visualFrame.y : 0
                    width: visualBaseFrame ? Math.max(1, visualBaseFrame.width) : 0
                    height: visualBaseFrame ? Math.max(1, visualBaseFrame.height) : 0
                    visible: visualFrame !== null && visualOpacity > 0.0001 && model.window
                    opacity: visualOpacity
                    clip: true
                    transform: Scale {
                        origin.x: 0
                        origin.y: 0
                        xScale: thumbnailShell.visualFrame && thumbnailShell.visualBaseFrame
                            && thumbnailShell.visualBaseFrame.width > 0
                            ? thumbnailShell.visualFrame.width / thumbnailShell.visualBaseFrame.width : 1
                        yScale: thumbnailShell.visualFrame && thumbnailShell.visualBaseFrame
                            && thumbnailShell.visualBaseFrame.height > 0
                            ? thumbnailShell.visualFrame.height / thumbnailShell.visualBaseFrame.height : 1
                    }

                    Drag.active: false
                    Drag.source: windowPresentation
                    Drag.hotSpot.x: spatialDragHotSpot.x
                    Drag.hotSpot.y: spatialDragHotSpot.y
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
                        keyboardSelected: thumbnailShell.keyboardSelected
                        surfaceLargeEnough: thumbnailShell.closeButtonLargeEnough
                        enabled: card.columnPointerHoverSource === null
                            && card.columnPointerPressSource === null
                            && !card.spatialDirectDragBlocked
                        z: 4
                        onCloseRequested: card.windowCloseRequested(windowPresentation.candidate,
                                                                    windowPresentation.windowId,
                                                                    windowPresentation.sourceDesktop,
                                                                    windowPresentation.sourceDesktopId,
                                                                    windowPresentation.sourceScreen)
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: thumbnailShell.visible && card.desktop && card.screen
                            && card.columnPointerHoverSource === null
                            && card.columnPointerPressSource === null
                            && !card.spatialDirectDragBlocked
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
                            && card.columnPointerHoverSource === null
                            && !card.spatialDirectDragBlocked
                        onTapped: card.windowCloseRequested(windowPresentation.candidate,
                                                           windowPresentation.windowId,
                                                           windowPresentation.sourceDesktop,
                                                           windowPresentation.sourceDesktopId,
                                                           windowPresentation.sourceScreen)
                    }

                    TapHandler {
                        id: thumbnailTouchHoldHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.TouchScreen
                        acceptedModifiers: Qt.NoModifier
                        gesturePolicy: TapHandler.DragThreshold
                        enabled: thumbnailShell.visible && card.desktop && card.screen
                            && card.columnPointerPressSource === null
                            && (!card.spatialDirectDragBlocked
                                || windowPresentation.spatialDragLifecycleActive)

                        onPressedChanged: {
                            if (pressed || (point.state === EventPoint.Released
                                            && !thumbnailTouchDragHandler.active)) {
                                windowPresentation.touchSpatialDragArmed = false;
                            }
                        }
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(thumbnailCloseButton, thumbnailShell,
                                                              point.position)) {
                                return;
                            }
                            card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                              card.desktopId, card.screen);
                        }
                        onLongPressed: {
                            if (!windowPresentation.dragEligible
                                    || card.closeButtonContainsPoint(thumbnailCloseButton, thumbnailShell,
                                                                     point.pressPosition)) {
                                return;
                            }
                            windowPresentation.touchSpatialDragArmed = true;
                        }
                    }

                    DragHandler {
                        id: thumbnailTouchDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.TouchScreen
                        acceptedModifiers: Qt.NoModifier
                        dragThreshold: windowPresentation.touchSpatialDragArmed ? 0 : 32767
                        enabled: thumbnailShell.visible && windowPresentation.dragEligible
                                 && card.columnDragActiveSource === null
                                 && card.columnPointerPressSource === null
                                 && !card.spatialDirectDragBlocked
                            || card.windowDragHandlerOwnsLifecycle(windowPresentation)
                        grabPermissions: PointerHandler.CanTakeOverFromHandlersOfSameType
                                         | PointerHandler.CanTakeOverFromHandlersOfDifferentType
                                         | PointerHandler.CanTakeOverFromItems
                                         | PointerHandler.ApprovesTakeOverByAnything

                        function cancelSpatialDrag() {
                            thumbnailShell.Drag.cancel();
                            thumbnailShell.Drag.active = false;
                            card.finishWindowSpatialDrag(windowPresentation);
                            windowPresentation.touchSpatialDragArmed = false;
                        }

                        function releaseSpatialDrag(scenePosition) {
                            if (!thumbnailShell.storeSpatialDragHotSpot(scenePosition)) {
                                thumbnailTouchDragHandler.cancelSpatialDrag();
                                return;
                            }

                            const source = windowPresentation;
                            const globalPosition = card.crossOutputWindowDropGlobalPosition(scenePosition);
                            const action = thumbnailShell.Drag.drop();
                            if (action !== Qt.MoveAction) {
                                card.requestCrossOutputWindowDrop(source, globalPosition);
                            }
                            thumbnailShell.Drag.active = false;
                            card.finishWindowSpatialDrag(source);
                            windowPresentation.touchSpatialDragArmed = false;
                        }

                        onActiveTranslationChanged: {
                            if (thumbnailTouchDragHandler.active
                                    && windowPresentation.spatialDragLifecycleActive) {
                                const scenePosition = thumbnailTouchDragHandler.centroid.scenePosition;
                                if (!thumbnailShell.storeSpatialDragHotSpot(scenePosition)) {
                                    thumbnailTouchDragHandler.cancelSpatialDrag();
                                    return;
                                }
                                card.moveWindowSpatialDrag(windowPresentation,
                                                           scenePosition);
                            }
                        }

                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                if (!windowPresentation.touchSpatialDragArmed) {
                                    return;
                                }
                                if (!card.settlePresentationMotion()
                                        || !thumbnailShell.storeSpatialDragHotSpot(point.scenePosition)) {
                                    thumbnailTouchDragHandler.cancelSpatialDrag();
                                    return;
                                }
                                card.beginWindowSpatialDrag(windowPresentation, point.scenePosition);
                                if (!windowPresentation.spatialDragLifecycleActive) {
                                    thumbnailTouchDragHandler.cancelSpatialDrag();
                                    return;
                                }
                                thumbnailShell.Drag.active = true;
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released
                                        && windowPresentation.spatialDragLifecycleActive) {
                                    thumbnailTouchDragHandler.releaseSpatialDrag(point.scenePosition);
                                } else {
                                    thumbnailTouchDragHandler.cancelSpatialDrag();
                                }
                            } else if (transition === PointerDevice.CancelGrabExclusive
                                       || transition === PointerDevice.CancelGrabPassive) {
                                thumbnailTouchDragHandler.cancelSpatialDrag();
                            }
                        }
                    }

                    DragHandler {
                        id: thumbnailDragHandler

                        target: null
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        acceptedModifiers: Qt.NoModifier
                        enabled: thumbnailShell.visible && windowPresentation.dragEligible
                                 && card.columnDragActiveSource === null
                                 && card.columnPointerHoverSource === null
                                 && card.columnPointerPressSource === null
                                 && !card.spatialDirectDragBlocked
                            || card.windowDragHandlerOwnsLifecycle(windowPresentation)

                        onActiveTranslationChanged: {
                            if (thumbnailDragHandler.active) {
                                if (!windowPresentation.spatialDragLifecycleActive) {
                                    return;
                                }
                                const scenePosition = thumbnailDragHandler.centroid.scenePosition;
                                if (!thumbnailShell.storeSpatialDragHotSpot(scenePosition)) {
                                    card.cancelWindowSpatialDragSource(windowPresentation);
                                    return;
                                }
                                card.moveWindowSpatialDrag(windowPresentation, scenePosition);
                            }
                        }

                        onGrabChanged: (transition, point) => {
                            if (transition === PointerDevice.GrabExclusive) {
                                if (!card.settlePresentationMotion()
                                        || !thumbnailShell.storeSpatialDragHotSpot(point.scenePosition)) {
                                    card.cancelWindowSpatialDragSource(windowPresentation);
                                    return;
                                }
                                card.beginWindowSpatialDrag(windowPresentation, point.scenePosition);
                                if (!windowPresentation.spatialDragLifecycleActive) {
                                    thumbnailShell.Drag.cancel();
                                    thumbnailShell.Drag.active = false;
                                    return;
                                }
                                thumbnailShell.Drag.active = true;
                            } else if (transition === PointerDevice.UngrabExclusive) {
                                if (point.state === EventPoint.Released
                                        && windowPresentation.spatialDragLifecycleActive
                                        && thumbnailShell.storeSpatialDragHotSpot(point.scenePosition)) {
                                    const source = windowPresentation;
                                    const globalPosition = card.crossOutputWindowDropGlobalPosition(
                                        point.scenePosition);
                                    const action = thumbnailShell.Drag.drop();
                                    if (action !== Qt.MoveAction) {
                                        card.requestCrossOutputWindowDrop(source, globalPosition);
                                    }
                                    thumbnailShell.Drag.active = false;
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
                    readonly property var visualFrame: card.presentationMotionVisualFrame(
                        windowPresentation.windowId, "placeholder", frame,
                        windowPresentation.tiledPresentation !== null
                            && windowPresentation.tiledPresentation !== undefined)
                    readonly property var visualBaseFrame: frame !== null ? frame : visualFrame
                    readonly property real visualOpacity: card.presentationMotionVisualOpacity(
                        windowPresentation.windowId, "placeholder", windowPresentation.primaryVisualKind,
                        windowPresentation.tiledPresentation !== null
                            && windowPresentation.tiledPresentation !== undefined)
                    readonly property bool activationEligible: windowPresentation.primaryVisualKind === "placeholder"
                        && windowPresentation.minimizedActivationEligible
                    readonly property bool keyboardTarget: visible && activationEligible
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)
                    readonly property bool closeButtonLargeEnough: width >= 72 && height >= 20

                    function activationIsExact() {
                        return minimizedPlaceholderShell.visible
                            && windowPresentation.primaryVisualKind === "placeholder"
                            && windowPresentation.minimizedWindow
                            && windowPresentation.matchesSearch
                            && card.windowSnapshotCanActivateMinimizedWindow(windowPresentation);
                    }

                    x: visualFrame ? visualFrame.x : 0
                    y: visualFrame ? visualFrame.y : 0
                    width: visualBaseFrame ? visualBaseFrame.width : 0
                    height: visualBaseFrame ? visualBaseFrame.height : 0
                    visible: visualFrame !== null && visualOpacity > 0.0001 && model.window
                    opacity: visualOpacity
                    color: minimizedPlaceholderActivationHandler.pressed ? "#f23e4d65"
                        : minimizedPlaceholderHoverHandler.hovered ? "#e6323e52"
                        : "#dc252e3d"
                    border.width: 1
                    border.color: "#66758b"
                    radius: 3
                    clip: true
                    transform: Scale {
                        origin.x: 0
                        origin.y: 0
                        xScale: minimizedPlaceholderShell.visualFrame
                            && minimizedPlaceholderShell.visualBaseFrame
                            && minimizedPlaceholderShell.visualBaseFrame.width > 0
                            ? minimizedPlaceholderShell.visualFrame.width
                                / minimizedPlaceholderShell.visualBaseFrame.width : 1
                        yScale: minimizedPlaceholderShell.visualFrame
                            && minimizedPlaceholderShell.visualBaseFrame
                            && minimizedPlaceholderShell.visualBaseFrame.height > 0
                            ? minimizedPlaceholderShell.visualFrame.height
                                / minimizedPlaceholderShell.visualBaseFrame.height : 1
                    }

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
                        keyboardSelected: minimizedPlaceholderShell.keyboardSelected
                        surfaceLargeEnough: minimizedPlaceholderShell.closeButtonLargeEnough
                        enabled: !card.spatialDirectDragBlocked
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
                        enabled: minimizedPlaceholderShell.visible
                            && minimizedPlaceholderShell.activationEligible
                            && !card.spatialDirectDragBlocked
                        cursorShape: Qt.PointingHandCursor
                    }

                    TapHandler {
                        id: minimizedPlaceholderActivationHandler

                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad | PointerDevice.TouchScreen
                        gesturePolicy: TapHandler.DragThreshold
                        enabled: minimizedPlaceholderShell.visible && minimizedPlaceholderShell.activationEligible
                                 && card.desktop && card.screen && !card.spatialDirectDragBlocked
                        onTapped: point => {
                            if (card.closeButtonContainsPoint(minimizedPlaceholderCloseButton,
                                                              minimizedPlaceholderShell, point.position)
                                    || !minimizedPlaceholderShell.activationIsExact()) {
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
                            && !card.spatialDirectDragBlocked
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
        readonly property var spatialPreview: validTarget ? card.windowDropHoverPreview : null

        anchors.fill: parent
        clip: true
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
                         : plan.kind === "empty-row" ? "#4086aee8"
                         : plan.kind === "stack-insertion" ? "#35ffd166" : "#3586aee8"
            border.width: plan ? 2 : 0
            border.color: !plan ? "transparent"
                               : plan.kind === "stack-insertion" ? "#d9ffd166" : "#d986aee8"
            radius: 3
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
            antialiasing: false
            z: 2
        }

        Repeater {
            model: windowDropArea.spatialPreview ? windowDropArea.spatialPreview.affectedFrames : []

            Rectangle {
                required property var modelData

                x: modelData.x
                y: modelData.y
                width: modelData.width
                height: modelData.height
                visible: !windowDropArea.spatialPreview
                    || modelData.windowId !== windowDropArea.spatialPreview.sourceWindowId
                enabled: false
                color: "#1f86aee8"
                border.width: 1
                border.color: "#a6b8d8ff"
                radius: 2
                z: 1
            }
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
            if (!card.windowDropIsValid(source, drop.keys)
                    || !card.windowDropHoverOwnershipMatches(source)) {
                card.clearWindowDropHover();
                drop.accepted = false;
                return;
            }

            const exactTarget = card.windowDropHoverTarget;
            const exactPreview = card.windowDropHoverPreview;
            if (!card.windowDropPreviewIsExact(exactPreview, source, exactTarget,
                                               card.windowDropHoverSnapshot)) {
                card.clearWindowDropHover();
                drop.accepted = false;
                return;
            }

            drop.action = Qt.MoveAction;
            drop.accepted = true;
            card.clearWindowDropHover();
            if (exactPreview.noop === true) {
                return;
            }
            card.windowDropped(source.candidate, source.windowId, source.sourceDesktop, source.sourceDesktopId,
                               card.desktop, card.desktopId, card.screen, exactTarget,
                               exactPreview.basisFingerprint);
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

    DropArea {
        id: columnDropArea

        readonly property bool validTarget: containsDrag && card.columnDropHoverOwned
            && card.columnDropHoverTarget !== null && card.columnDropHoverOwnershipIsValid()
        readonly property var spatialPreview: validTarget ? card.columnDropHoverPreview : null

        anchors.fill: parent
        clip: true
        enabled: card.enabled && card.searchQuery.trim().length === 0
        keys: ["driftile-column"]
        z: 10001

        Rectangle {
            id: spatialColumnDropPreviewSurface

            readonly property var plan: columnDropArea.spatialPreview
            readonly property var frame: plan ? plan.columnFrame : null

            x: frame ? frame.x : 0
            y: frame ? frame.y : 0
            width: frame ? frame.width : 0
            height: frame ? frame.height : 0
            visible: frame !== null
            enabled: false
            color: "#2f86aee8"
            border.width: frame ? 2 : 0
            border.color: "#d986aee8"
            radius: 3
            antialiasing: false
            z: 1
        }

        Repeater {
            model: columnDropArea.spatialPreview ? columnDropArea.spatialPreview.memberFrames : []

            Rectangle {
                required property var modelData

                x: modelData.x
                y: modelData.y
                width: modelData.width
                height: modelData.height
                color: "#2486aee8"
                border.width: 1
                border.color: "#b8b8d8ff"
                radius: 2
                enabled: false
                z: 2
            }
        }

        Rectangle {
            id: spatialColumnDropPreviewMarker

            readonly property var plan: columnDropArea.spatialPreview
            readonly property var marker: plan ? plan.marker : null

            x: marker ? marker.x : 0
            y: marker ? marker.y : 0
            width: marker ? marker.width : 0
            height: marker ? marker.height : 0
            visible: marker !== null
            enabled: false
            color: "#ff9fc5ff"
            radius: 2
            antialiasing: false
            z: 3
        }

        onEntered: drag => drag.accepted = card.columnDropIsValid(drag.source, drag.keys)
            ? card.claimColumnDropHover(drag.source, drag)
            : card.rejectColumnDropHover()
        onPositionChanged: drag => drag.accepted = card.columnDropIsValid(drag.source, drag.keys)
            ? card.columnDropHoverOwned
              ? card.moveColumnDropHover(drag.source, drag)
              : card.claimColumnDropHover(drag.source, drag)
            : card.rejectColumnDropHover()
        onExited: card.clearColumnDropHover()
        onContainsDragChanged: {
            if (!containsDrag) {
                card.clearColumnDropHover();
            }
        }
        onDropped: drop => {
            const source = drop.source;
            if (!card.columnDropIsValid(source, drop.keys)
                    || !card.columnDropHoverOwnershipMatches(source)) {
                card.clearColumnDropHover();
                drop.accepted = false;
                return;
            }

            const exactTarget = card.columnDropHoverTarget;
            const exactPreview = card.columnDropHoverPreview;
            if (!card.columnDropPreviewIsExact(exactPreview, source, exactTarget,
                                               card.columnDropHoverSnapshot)) {
                card.clearColumnDropHover();
                drop.accepted = false;
                return;
            }

            drop.action = Qt.MoveAction;
            drop.accepted = true;
            card.clearColumnDropHover();
            card.columnDropped(source, card.desktop, card.desktopId, card.screen, exactTarget,
                               exactPreview.basisFingerprint);
        }

        Connections {
            target: card.columnDropHoverSource
            ignoreUnknownSignals: true

            function onColumnDragSnapshotChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onColumnSpatialDragLifecycleActiveChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onCandidateChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onDestroyed() {
                card.clearColumnDropHover();
            }

            function onDragEligibleChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onIndexChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSourceColumnChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSelectedWindowIdChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSourceContextChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSourceDesktopChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSourceDesktopIdChanged() {
                card.clearInvalidColumnDropHover();
            }

            function onSourceScreenChanged() {
                card.clearInvalidColumnDropHover();
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        visible: card.windowWorkspaceHoverTarget
        color: "transparent"
        border.width: 2
        border.color: "#86aee8"
        z: 9999
    }

    onCurrentChanged: {
        if (card.presentationMotionStructuralDriftShouldReset()) {
            card.resetPresentationMotionAfterDrift();
        }
        card.navigationTargetsChanged();
    }
    onContextChanged: {
        card.scheduleColumnDragEligibilityRefresh();
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelInvalidActiveWindowSpatialDrag();
        card.cancelInvalidActiveColumnSpatialDrag();
        card.schedulePresentationMotion();
    }
    onDesktopChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.scheduleColumnDragEligibilityRefresh();
        card.clearWindowDropHover();
        card.clearColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelActiveColumnSpatialDrag();
    }
    onDesktopIdChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.scheduleColumnDragEligibilityRefresh();
        card.clearWindowDropHover();
        card.clearColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelActiveColumnSpatialDrag();
    }
    onDesktopSurfaceActivityIdChanged: card.synchronizeDesktopSurfaceContext()
    onDesktopSurfaceContextExactChanged: card.synchronizeDesktopSurfaceContext()
    onDesktopSurfaceEnabledChanged: card.synchronizeDesktopSurfaceContext()
    onDesktopSurfaceLifecycleEventChanged: card.scheduleDesktopSurfaceReload()
    onEnabledChanged: {
        card.scheduleColumnDragEligibilityRefresh();
        if (!enabled) {
            card.clearWindowDropHover();
            card.clearColumnDropHover();
            card.cancelActiveWindowSpatialDrag();
            card.cancelActiveColumnSpatialDrag();
        }
    }
    onScreenChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.scheduleColumnDragEligibilityRefresh();
        card.clearWindowDropHover();
        card.clearColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelActiveColumnSpatialDrag();
    }
    onOutputIdChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.scheduleColumnDragEligibilityRefresh();
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelInvalidActiveWindowSpatialDrag();
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onColumnFramesChanged: {
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onTiledPresentationsChanged: {
        card.scheduleColumnDragEligibilityRefresh();
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.scheduleWindowSpatialDragValidation(card.windowDragActiveSource);
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onSpatialLiveColumnFramesChanged: {
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onTabRailPlansChanged: {
        card.navigationTargetsChanged();
        card.schedulePresentationMotion();
    }
    onSpatialRowGeometryPlanChanged: {
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelInvalidActiveColumnSpatialDrag();
        card.schedulePresentationMotion();
    }
    onWidthChanged: {
        card.resetPresentationMotionAfterDrift();
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onHeightChanged: {
        card.resetPresentationMotionAfterDrift();
        card.clearInvalidWindowDropHover();
        card.clearInvalidColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelInvalidActiveColumnSpatialDrag();
    }
    onSearchQueryChanged: {
        card.resetPresentationMotionAfterDrift();
        card.scheduleColumnDragEligibilityRefresh();
        card.navigationTargetsChanged();
        if (searchQuery.trim().length > 0) {
            card.clearWindowDropHover();
            card.clearColumnDropHover();
            card.cancelActiveWindowSpatialDrag();
            card.cancelActiveColumnSpatialDrag();
        }
    }
    onColumnsChanged: {
        card.scheduleColumnDragEligibilityRefresh();
        card.cancelInvalidActiveWindowSpatialDrag();
        card.schedulePresentationMotion();
    }
    onInteractionEligibleChanged: {
        card.scheduleColumnDragEligibilityRefresh();
        if (!interactionEligible) {
            card.cancelActiveWindowSpatialDrag();
        }
    }
    onLiveGeometryEnabledChanged: {
        if (card.presentationMotionStructuralDriftShouldReset()) {
            card.resetPresentationMotionAfterDrift();
        }
    }
    onOverviewActivityIdChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.scheduleColumnDragEligibilityRefresh();
        card.cancelInvalidActiveWindowSpatialDrag();
    }
    onOverviewContextGenerationChanged: {
        card.resetPresentationMotionAfterDrift();
        card.synchronizeDesktopSurfaceContext();
        card.cancelActiveWindowSpatialDrag();
    }
    onOverviewSessionIdChanged: card.resetPresentationMotionAfterDrift()
    onPreviewViewportOffsetChanged: card.resetPresentationMotionAfterDrift()
    onSpatialDirectDragBlockedChanged: {
        if (spatialDirectDragBlocked) {
            card.resetPresentationMotionAfterDrift();
        }
    }
    onSpatialMotionEligibleChanged: {
        if (!spatialMotionEligible) {
            card.resetPresentationMotionAfterDrift();
        } else if (presentationMotionPhase === "invalid") {
            card.resetPresentationMotionAfterDrift();
        }
    }

    Component.onCompleted: {
        card.synchronizeDesktopSurfaceContext();
        card.resetPresentationMotionAfterDrift();
    }

    Component.onDestruction: {
        card.invalidatePresentationMotion();
        card.rejectDesktopSurfaceLoad();
        card.clearWindowDropHover();
        card.clearColumnDropHover();
        card.cancelActiveWindowSpatialDrag();
        card.cancelActiveColumnSpatialDrag();
    }

    function presentationMotionKindIsValid(kind) {
        return kind === "thumbnail" || kind === "tab" || kind === "placeholder";
    }

    function presentationMotionRectSnapshot(frame) {
        try {
            if (!frame || Array.isArray(frame) || !Number.isFinite(frame.x)
                    || !Number.isFinite(frame.y) || !Number.isFinite(frame.width)
                    || !Number.isFinite(frame.height) || frame.width <= 0 || frame.height <= 0
                    || Math.abs(frame.x) > 1000000 || Math.abs(frame.y) > 1000000
                    || frame.width > 1000000 || frame.height > 1000000
                    || !Number.isFinite(frame.x + frame.width)
                    || !Number.isFinite(frame.y + frame.height)) {
                return null;
            }
            return Object.freeze({
                height: Number(frame.height),
                width: Number(frame.width),
                x: Object.is(frame.x, -0) ? 0 : Number(frame.x),
                y: Object.is(frame.y, -0) ? 0 : Number(frame.y)
            });
        } catch (error) {
            return null;
        }
    }

    function presentationMotionLogicalFrame(presentation, kind) {
        if (!presentationMotionKindIsValid(kind) || !presentation) {
            return null;
        }
        if (kind === "thumbnail") {
            const tiled = presentation.tiledPresentation;
            if (liveGeometryEnabled && current && tiled
                    && spatialLiveWindowPlanIsExact(presentation.spatialLiveFrame,
                                                    presentation.windowId, tiled)
                    && tiled.thumbnailFrame) {
                return tiled.thumbnailFrame;
            }
            return presentation.frame;
        }
        if (kind === "placeholder") {
            return presentation.minimizedPlaceholderFrame;
        }
        return presentation.tabFrame;
    }

    function presentationMotionProjectedLiveCandidateFrame(candidate, windowId) {
        try {
            if (!liveGeometryEnabled || !current || !candidate || !screen
                    || candidate.deleted !== false || candidate.minimized !== false
                    || candidate.output !== screen
                    || candidate.internalId === undefined || candidate.internalId === null
                    || String(candidate.internalId) !== windowId) {
                return null;
            }
            const geometry = candidate.frameGeometry;
            const screenGeometry = screen.geometry;
            if (!projectionGeometryIsValid(geometry) || !projectionGeometryIsValid(screenGeometry)) {
                return null;
            }
            return presentationMotionRectSnapshot({
                height: geometry.height * projectionScale,
                width: geometry.width * projectionScale,
                x: viewportOriginX + (geometry.x - screenGeometry.x) * projectionScale,
                y: viewportOriginY + (geometry.y - screenGeometry.y) * projectionScale
            });
        } catch (error) {
            return null;
        }
    }

    function presentationMotionNativeThumbnailFrame(presentation, kind) {
        const tiled = presentation ? presentation.tiledPresentation : null;
        if (!presentation || kind !== "thumbnail" || !liveGeometryEnabled || !current
                || !tiled || !spatialLiveWindowPlanIsExact(
                    presentation.spatialLiveFrame, presentation.windowId, tiled)) {
            return null;
        }
        return presentationMotionRectSnapshot(presentation.frame);
    }

    function presentationMotionColumnSnapshot(presentation, snapshotsByColumnIndex = null) {
        try {
            const tiled = presentation ? presentation.tiledPresentation : null;
            if (!tiled || !Number.isInteger(tiled.columnIndex)
                    || !Number.isInteger(tiled.memberIndex) || tiled.columnIndex < 0
                    || tiled.columnIndex >= columns.length || tiled.memberIndex < 0) {
                return null;
            }
            const column = columns[tiled.columnIndex];
            const cached = snapshotsByColumnIndex
                ? snapshotsByColumnIndex[tiled.columnIndex] : undefined;
            if (cached !== undefined) {
                return cached && cached.memberIds[tiled.memberIndex] === presentation.windowId
                    ? cached : null;
            }
            if (!column || !indexedListHasBoundedLength(column.members, 1, 256)
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0
                    || column.selectedMemberIndex >= column.members.length) {
                return null;
            }
            const memberIds = [];
            const seen = Object.create(null);
            for (const member of column.members) {
                const memberId = member && typeof member.windowId === "string"
                    ? member.windowId : "";
                if (memberId.length === 0 || seen[memberId] === true) {
                    return null;
                }
                seen[memberId] = true;
                memberIds.push(memberId);
            }
            const selectedWindowId = memberIds[column.selectedMemberIndex];
            if (presentation.windowId.length === 0
                    || memberIds[tiled.memberIndex] !== presentation.windowId
                    || typeof selectedWindowId !== "string" || selectedWindowId.length === 0) {
                return null;
            }
            Object.freeze(memberIds);
            const snapshot = Object.freeze({ memberIds, selectedWindowId });
            if (snapshotsByColumnIndex) {
                snapshotsByColumnIndex[tiled.columnIndex] = snapshot;
            }
            return snapshot;
        } catch (error) {
            return null;
        }
    }

    function presentationMotionVisualStateSnapshot(state) {
        try {
            if (!state || Array.isArray(state)) {
                return null;
            }
            const keys = ["minimizedProgress", "placeholderOpacity", "selectedProgress",
                          "tabOpacity", "thumbnailOpacity"];
            const snapshot = Object.create(null);
            for (const key of keys) {
                const value = state[key];
                if (typeof value !== "number" || !Number.isFinite(value)
                        || value < 0 || value > 1) {
                    return null;
                }
                snapshot[key] = Object.is(value, -0) ? 0 : value;
            }
            return Object.freeze(snapshot);
        } catch (error) {
            return null;
        }
    }

    function presentationMotionZeroVisualState() {
        return Object.freeze({
            minimizedProgress: 0,
            placeholderOpacity: 0,
            selectedProgress: 0,
            tabOpacity: 0,
            thumbnailOpacity: 0
        });
    }

    function interpolatePresentationMotionVisualState(fromState, targetState, progress) {
        const source = fromState || presentationMotionZeroVisualState();
        const target = targetState || presentationMotionZeroVisualState();
        if (!Number.isFinite(progress)) {
            return null;
        }
        const bounded = Math.max(0, Math.min(1, progress));
        return presentationMotionVisualStateSnapshot({
            minimizedProgress: source.minimizedProgress
                + (target.minimizedProgress - source.minimizedProgress) * bounded,
            placeholderOpacity: source.placeholderOpacity
                + (target.placeholderOpacity - source.placeholderOpacity) * bounded,
            selectedProgress: source.selectedProgress
                + (target.selectedProgress - source.selectedProgress) * bounded,
            tabOpacity: source.tabOpacity + (target.tabOpacity - source.tabOpacity) * bounded,
            thumbnailOpacity: source.thumbnailOpacity
                + (target.thumbnailOpacity - source.thumbnailOpacity) * bounded
        });
    }

    function freezePresentationMotionSnapshot(records, candidatesByWindowId,
                                              nativeThumbnailFramesByWindowId,
                                              tabFramesByWindowId, visualFramesByWindowId,
                                              visualStatesByWindowId, viewportOffset) {
        try {
            const recordsByWindowId = Object.create(null);
            const nativeThumbnailRecords = [];
            const tabRecords = [];
            const visualRecords = [];
            for (const record of records) {
                if (!record || recordsByWindowId[record.windowId] !== undefined) {
                    return null;
                }
                recordsByWindowId[record.windowId] = record;
                const visualState = presentationMotionVisualStateSnapshot(
                    visualStatesByWindowId[record.windowId]);
                const visualFrame = presentationMotionRectSnapshot(
                    visualFramesByWindowId[record.windowId]);
                if (!visualState || !visualFrame) {
                    return null;
                }
                visualFramesByWindowId[record.windowId] = visualFrame;
                visualStatesByWindowId[record.windowId] = visualState;
                visualRecords.push(Object.freeze({
                    frame: visualFrame,
                    state: visualState,
                    windowId: record.windowId
                }));
                const tabFrame = tabFramesByWindowId[record.windowId];
                if (tabFrame !== undefined) {
                    tabRecords.push(Object.freeze({ frame: tabFrame, windowId: record.windowId }));
                }
            }
            for (const windowId of Object.keys(nativeThumbnailFramesByWindowId)) {
                const record = recordsByWindowId[windowId];
                const nativeFrame = presentationMotionRectSnapshot(
                    nativeThumbnailFramesByWindowId[windowId]);
                if (!record || record.kind !== "thumbnail" || !nativeFrame
                        || !presentationMotionFramesEqual(
                            nativeFrame, visualFramesByWindowId[windowId])) {
                    return null;
                }
                nativeThumbnailFramesByWindowId[windowId] = nativeFrame;
                nativeThumbnailRecords.push(Object.freeze({ frame: nativeFrame, windowId }));
            }
            nativeThumbnailRecords.sort((left, right) => left.windowId < right.windowId
                ? -1 : left.windowId > right.windowId ? 1 : 0);
            Object.freeze(records);
            Object.freeze(recordsByWindowId);
            Object.freeze(candidatesByWindowId);
            Object.freeze(nativeThumbnailFramesByWindowId);
            Object.freeze(nativeThumbnailRecords);
            Object.freeze(tabRecords);
            Object.freeze(tabFramesByWindowId);
            Object.freeze(visualFramesByWindowId);
            Object.freeze(visualRecords);
            Object.freeze(visualStatesByWindowId);
            const fingerprint = JSON.stringify({
                nativeThumbnailRecords,
                records,
                tabRecords,
                visualRecords
            });
            if (typeof fingerprint !== "string" || fingerprint.length > 8388608) {
                return null;
            }
            return Object.freeze({
                candidatesByWindowId,
                fingerprint,
                nativeThumbnailFramesByWindowId,
                records,
                recordsByWindowId,
                tabFramesByWindowId,
                visualFramesByWindowId,
                visualStatesByWindowId,
                viewportOffset
            });
        } catch (error) {
            return null;
        }
    }

    function capturePresentationMotionSnapshot() {
        try {
            if (!Number.isInteger(windowRepeater.count) || windowRepeater.count < 0
                    || windowRepeater.count > 131072 || !Number.isFinite(previewViewportOffset)) {
                return null;
            }
            const records = [];
            const candidatesByWindowId = Object.create(null);
            const columnSnapshotsByIndex = Object.create(null);
            const nativeThumbnailFramesByWindowId = Object.create(null);
            const tabFramesByWindowId = Object.create(null);
            const visualFramesByWindowId = Object.create(null);
            const visualStatesByWindowId = Object.create(null);
            for (let index = 0; index < windowRepeater.count; index += 1) {
                const presentation = windowRepeater.itemAt(index);
                const candidate = presentation ? presentation.candidate : null;
                const windowId = presentation ? presentation.windowId : "";
                const tiled = presentation ? presentation.tiledPresentation : null;
                if (!presentation || !candidate || typeof windowId !== "string"
                        || windowId.length === 0 || windowId.length > 4096
                        || candidate.internalId === undefined || candidate.internalId === null
                        || String(candidate.internalId) !== windowId) {
                    return null;
                }
                if (!tiled) {
                    continue;
                }
                if (candidatesByWindowId[windowId] !== undefined) {
                    return null;
                }
                const kind = presentation.primaryVisualKind;
                const frame = presentationMotionRectSnapshot(
                    presentationMotionLogicalFrame(presentation, kind));
                const nativeThumbnailFrame = presentationMotionNativeThumbnailFrame(
                    presentation, kind);
                const visualFrame = nativeThumbnailFrame || frame;
                const column = presentationMotionColumnSnapshot(presentation,
                                                                 columnSnapshotsByIndex);
                const tabFrame = presentationMotionRectSnapshot(presentation.tabFrame);
                if (!presentationMotionKindIsValid(kind) || !frame || !visualFrame || !column) {
                    return null;
                }
                const record = Object.freeze({
                    column,
                    frame,
                    kind,
                    minimized: presentation.minimizedWindow === true,
                    windowId
                });
                candidatesByWindowId[windowId] = candidate;
                if (tabFrame) {
                    tabFramesByWindowId[windowId] = tabFrame;
                }
                if (nativeThumbnailFrame) {
                    nativeThumbnailFramesByWindowId[windowId] = nativeThumbnailFrame;
                }
                visualFramesByWindowId[windowId] = visualFrame;
                visualStatesByWindowId[windowId] = Object.freeze({
                    minimizedProgress: presentation.minimizedWindow === true ? 1 : 0,
                    placeholderOpacity: kind === "placeholder" ? 1 : 0,
                    selectedProgress: column.selectedWindowId === windowId ? 1 : 0,
                    tabOpacity: tabFrame ? 1 : 0,
                    thumbnailOpacity: kind === "thumbnail" ? 1 : 0
                });
                records.push(record);
            }
            records.sort((left, right) => left.windowId < right.windowId
                ? -1 : left.windowId > right.windowId ? 1 : 0);
            return freezePresentationMotionSnapshot(
                records, candidatesByWindowId, nativeThumbnailFramesByWindowId,
                tabFramesByWindowId, visualFramesByWindowId, visualStatesByWindowId,
                Number(previewViewportOffset));
        } catch (error) {
            return null;
        }
    }

    function presentationMotionSnapshotsAreExact(first, second) {
        if (!first || !second || first.fingerprint !== second.fingerprint
                || first.viewportOffset !== second.viewportOffset
                || first.records.length !== second.records.length) {
            return false;
        }
        for (const record of first.records) {
            if (second.recordsByWindowId[record.windowId] === undefined
                    || first.candidatesByWindowId[record.windowId]
                        !== second.candidatesByWindowId[record.windowId]) {
                return false;
            }
        }
        return true;
    }

    function presentationMotionTabFramesAreExact(first, second) {
        if (!first || !second) {
            return false;
        }
        for (const record of second.records) {
            const firstFrame = first.tabFramesByWindowId[record.windowId];
            const secondFrame = second.tabFramesByWindowId[record.windowId];
            if (firstFrame === undefined && secondFrame === undefined) {
                continue;
            }
            if (!presentationMotionFramesEqual(firstFrame, secondFrame)) {
                return false;
            }
        }
        return true;
    }

    function presentationMotionVisualStatesAreExact(first, second) {
        if (!first || !second) {
            return false;
        }
        const keys = ["minimizedProgress", "placeholderOpacity", "selectedProgress",
                      "tabOpacity", "thumbnailOpacity"];
        for (const record of second.records) {
            const firstState = first.visualStatesByWindowId[record.windowId];
            const secondState = second.visualStatesByWindowId[record.windowId];
            if (!firstState || !secondState) {
                return false;
            }
            for (const key of keys) {
                if (firstState[key] !== secondState[key]) {
                    return false;
                }
            }
        }
        return true;
    }

    function presentationMotionVisualFramesAreExact(first, second) {
        if (!first || !second) {
            return false;
        }
        for (const record of second.records) {
            if (!presentationMotionFramesEqual(
                    first.visualFramesByWindowId[record.windowId],
                    second.visualFramesByWindowId[record.windowId])) {
                return false;
            }
        }
        return true;
    }

    function presentationMotionTrackSample(track, progress = presentationMotionProgress) {
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            return runtime && typeof runtime.sampleOverviewSpatialPresentationMotion === "function"
                ? runtime.sampleOverviewSpatialPresentationMotion(track, progress) : null;
        } catch (error) {
            return null;
        }
    }

    function buildPresentationMotionSamples(progress, tracks, phase, owner) {
        const samples = Object.create(null);
        if (phase !== "animating" || owner === null || !presentationMotionOwnerIsExact()) {
            return Object.freeze(samples);
        }
        for (const windowId of Object.keys(tracks)) {
            const sample = presentationMotionTrackSample(tracks[windowId], progress);
            if (!sample) {
                return Object.freeze(Object.create(null));
            }
            samples[windowId] = sample;
        }
        return Object.freeze(samples);
    }

    function captureReadyRenderedPresentationMotionSnapshot(source) {
        const records = [];
        const candidatesByWindowId = Object.create(null);
        const nativeThumbnailFramesByWindowId = Object.create(null);
        const tabFramesByWindowId = Object.create(null);
        const visualFramesByWindowId = Object.create(null);
        const visualStatesByWindowId = Object.create(null);
        for (const sourceRecord of source.records) {
            const windowId = sourceRecord.windowId;
            const candidate = source.candidatesByWindowId[windowId];
            const liveFrame = sourceRecord.kind === "thumbnail"
                    && source.nativeThumbnailFramesByWindowId[windowId] !== undefined
                ? presentationMotionProjectedLiveCandidateFrame(candidate, windowId) : null;
            const renderedFrame = liveFrame || source.visualFramesByWindowId[windowId];
            if (!renderedFrame) {
                return null;
            }
            records.push(presentationMotionFramesEqual(renderedFrame, sourceRecord.frame)
                ? sourceRecord : Object.freeze({
                    column: sourceRecord.column,
                    frame: renderedFrame,
                    kind: sourceRecord.kind,
                    minimized: sourceRecord.minimized,
                    windowId
                }));
            candidatesByWindowId[windowId] = candidate;
            const tabFrame = source.tabFramesByWindowId[windowId];
            if (tabFrame !== undefined) {
                tabFramesByWindowId[windowId] = tabFrame;
            }
            visualFramesByWindowId[windowId] = renderedFrame;
            visualStatesByWindowId[windowId] = source.visualStatesByWindowId[windowId];
        }
        return freezePresentationMotionSnapshot(
            records, candidatesByWindowId, nativeThumbnailFramesByWindowId,
            tabFramesByWindowId, visualFramesByWindowId, visualStatesByWindowId,
            source.viewportOffset);
    }

    function captureRenderedPresentationMotionSnapshot() {
        const source = presentationMotionPhase === "animating"
            ? presentationMotionTargetSnapshot : presentationMotionFromSnapshot;
        if (!source) {
            return capturePresentationMotionSnapshot();
        }
        if (presentationMotionPhase === "ready") {
            return captureReadyRenderedPresentationMotionSnapshot(source);
        }
        if (presentationMotionPhase !== "animating") {
            return source;
        }

        const records = [];
        const candidatesByWindowId = Object.create(null);
        const nativeThumbnailFramesByWindowId = Object.create(null);
        const tabFramesByWindowId = Object.create(null);
        const visualFramesByWindowId = Object.create(null);
        const visualStatesByWindowId = Object.create(null);
        for (const targetRecord of source.records) {
            const track = presentationMotionTracksByWindowId[targetRecord.windowId];
            const cachedSample = track ? presentationMotionSamplesByWindowId[targetRecord.windowId] : null;
            const sample = cachedSample || (track
                ? presentationMotionTrackSample(track, presentationMotionProgress) : null);
            const fromVisualFrame = presentationMotionFromSnapshot
                ? presentationMotionFromSnapshot.visualFramesByWindowId[targetRecord.windowId] : null;
            const targetVisualFrame = source.visualFramesByWindowId[targetRecord.windowId];
            let renderedFrame = fromVisualFrame && targetVisualFrame
                ? presentationMotionInterpolatedFrame(
                    fromVisualFrame, targetVisualFrame, presentationMotionProgress)
                : targetVisualFrame || fromVisualFrame || (sample ? sample.frame : targetRecord.frame);
            renderedFrame = presentationMotionRectSnapshot(renderedFrame);
            if (!renderedFrame) {
                return null;
            }
            const record = Object.freeze({
                column: targetRecord.column,
                frame: renderedFrame,
                kind: targetRecord.kind,
                minimized: targetRecord.minimized,
                windowId: targetRecord.windowId
            });
            records.push(record);
            visualFramesByWindowId[record.windowId] = renderedFrame;
            candidatesByWindowId[record.windowId] = source.candidatesByWindowId[record.windowId];
            const targetTabFrame = source.tabFramesByWindowId[record.windowId];
            const fromTabFrame = presentationMotionFromSnapshot
                ? presentationMotionFromSnapshot.tabFramesByWindowId[record.windowId] : undefined;
            if (fromTabFrame !== undefined && targetTabFrame !== undefined) {
                tabFramesByWindowId[record.windowId] = presentationMotionInterpolatedFrame(
                    fromTabFrame, targetTabFrame, presentationMotionProgress);
            } else if (targetTabFrame !== undefined) {
                tabFramesByWindowId[record.windowId] = targetTabFrame;
            } else if (fromTabFrame !== undefined && presentationMotionProgress < 1) {
                tabFramesByWindowId[record.windowId] = fromTabFrame;
            }
            const fromVisualState = presentationMotionFromSnapshot
                ? presentationMotionFromSnapshot.visualStatesByWindowId[record.windowId] : null;
            const targetVisualState = source.visualStatesByWindowId[record.windowId];
            const visualState = interpolatePresentationMotionVisualState(
                fromVisualState, targetVisualState, presentationMotionProgress);
            if (!visualState) {
                return null;
            }
            visualStatesByWindowId[record.windowId] = visualState;
        }
        return freezePresentationMotionSnapshot(
            records, candidatesByWindowId, nativeThumbnailFramesByWindowId,
            tabFramesByWindowId, visualFramesByWindowId, visualStatesByWindowId,
            source.viewportOffset);
    }

    function advancePresentationMotionRequestId() {
        presentationMotionRequestId = presentationMotionRequestId >= 2147483646
            ? 0 : presentationMotionRequestId + 1;
        return presentationMotionRequestId;
    }

    function invalidatePresentationMotion() {
        advancePresentationMotionRequestId();
        presentationMotionAnimation.stop();
        presentationMotionPhase = "invalid";
        presentationMotionSeedRequestId = -1;
        presentationMotionValidationPending = false;
        presentationMotionProgress = 1;
        presentationMotionCandidateSnapshot = null;
        presentationMotionFromSnapshot = null;
        presentationMotionTargetSnapshot = null;
        presentationMotionTracksByWindowId = Object.create(null);
        presentationMotionOwner = null;
        return true;
    }

    function presentationMotionContextEligible() {
        return spatialMotionEligible && searchQuery.trim().length === 0
            && !spatialDirectDragBlocked && windowDragActiveSource === null
            && columnDragActiveSource === null && !windowDropHoverOwned
            && !columnDropHoverOwned && context && screen
            && overviewSessionId > 0 && overviewContextGeneration > 0;
    }

    function presentationMotionStructuralDriftShouldReset() {
        return spatialMotionStartEligible || !spatialMotionEligible;
    }

    function resetPresentationMotionAfterDrift() {
        const alreadyInvalid = presentationMotionPhase === "invalid"
            && presentationMotionCandidateSnapshot === null
            && presentationMotionFromSnapshot === null
            && presentationMotionTargetSnapshot === null
            && presentationMotionOwner === null
            && !presentationMotionValidationPending;
        if (!alreadyInvalid) {
            invalidatePresentationMotion();
        }
        if (presentationMotionContextEligible()
                && presentationMotionSeedRequestId !== presentationMotionRequestId) {
            presentationMotionSeedRequestId = presentationMotionRequestId;
            Qt.callLater(card.seedPresentationMotion, presentationMotionRequestId);
        }
        return true;
    }

    function seedPresentationMotion(expectedRequestId = -1) {
        if (expectedRequestId >= 0) {
            if (expectedRequestId !== presentationMotionRequestId
                    || presentationMotionPhase !== "invalid") {
                return false;
            }
            presentationMotionSeedRequestId = -1;
        } else {
            invalidatePresentationMotion();
        }
        if (!presentationMotionContextEligible()) {
            return false;
        }
        const snapshot = capturePresentationMotionSnapshot();
        if (!snapshot) {
            return false;
        }
        presentationMotionFromSnapshot = snapshot;
        presentationMotionTargetSnapshot = snapshot;
        presentationMotionPhase = "ready";
        return true;
    }

    function schedulePresentationMotion() {
        if (!presentationMotionContextEligible()) {
            resetPresentationMotionAfterDrift();
            return false;
        }
        if (!spatialMotionStartEligible) {
            return false;
        }
        if (presentationMotionPhase === "validating" && presentationMotionValidationPending) {
            return true;
        }

        const fromSnapshot = captureRenderedPresentationMotionSnapshot();
        if (!fromSnapshot) {
            resetPresentationMotionAfterDrift();
            return false;
        }
        const requestId = advancePresentationMotionRequestId();
        presentationMotionAnimation.stop();
        presentationMotionPhase = "validating";
        presentationMotionProgress = 0;
        presentationMotionCandidateSnapshot = null;
        presentationMotionFromSnapshot = fromSnapshot;
        presentationMotionTargetSnapshot = null;
        presentationMotionTracksByWindowId = Object.create(null);
        presentationMotionOwner = null;
        presentationMotionSeedRequestId = -1;
        presentationMotionValidationPending = true;
        Qt.callLater(card.capturePresentationMotionCandidate, requestId);
        return true;
    }

    function capturePresentationMotionCandidate(requestId) {
        if (requestId !== presentationMotionRequestId
                || presentationMotionPhase !== "validating") {
            return false;
        }
        presentationMotionValidationPending = false;
        if (!presentationMotionContextEligible()) {
            resetPresentationMotionAfterDrift();
            return false;
        }
        const candidate = capturePresentationMotionSnapshot();
        if (!candidate) {
            seedPresentationMotion();
            return false;
        }
        presentationMotionCandidateSnapshot = candidate;
        Qt.callLater(card.commitPresentationMotionCandidate, requestId, candidate);
        return true;
    }

    function commitPresentationMotionCandidate(requestId, candidate) {
        if (requestId !== presentationMotionRequestId
                || presentationMotionPhase !== "validating"
                || presentationMotionCandidateSnapshot !== candidate) {
            return false;
        }
        if (!presentationMotionContextEligible()) {
            resetPresentationMotionAfterDrift();
            return false;
        }
        const confirmed = capturePresentationMotionSnapshot();
        if (!presentationMotionSnapshotsAreExact(candidate, confirmed)) {
            seedPresentationMotion();
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        let plan = null;
        try {
            plan = runtime && typeof runtime.planOverviewSpatialPresentationMotion === "function"
                ? runtime.planOverviewSpatialPresentationMotion({
                    current: presentationMotionFromSnapshot.records,
                    next: confirmed.records
                }) : null;
        } catch (error) {
            plan = null;
        }
        const tracks = presentationMotionTracks(plan, presentationMotionFromSnapshot, confirmed);
        if (tracks === null) {
            seedPresentationMotion();
            return false;
        }
        if (Object.keys(tracks).length === 0
                && presentationMotionTabFramesAreExact(presentationMotionFromSnapshot, confirmed)
                && presentationMotionVisualFramesAreExact(presentationMotionFromSnapshot, confirmed)
                && presentationMotionVisualStatesAreExact(presentationMotionFromSnapshot, confirmed)) {
            presentationMotionAnimation.stop();
            presentationMotionProgress = 1;
            presentationMotionCandidateSnapshot = null;
            presentationMotionFromSnapshot = confirmed;
            presentationMotionTargetSnapshot = confirmed;
            presentationMotionTracksByWindowId = tracks;
            presentationMotionOwner = null;
            presentationMotionPhase = "ready";
            navigationTargetsChanged();
            return true;
        }

        presentationMotionTargetSnapshot = confirmed;
        presentationMotionTracksByWindowId = tracks;
        presentationMotionOwner = Object.freeze({
            activityId: overviewActivityId,
            cardHeight: height,
            cardWidth: width,
            context,
            desktop,
            desktopId,
            generation: overviewContextGeneration,
            outputId,
            requestId,
            rowGeometryPlan: spatialRowGeometryPlan,
            screen,
            sessionId: overviewSessionId,
            targetSnapshot: confirmed,
            viewportOffset: previewViewportOffset
        });
        presentationMotionCandidateSnapshot = null;
        presentationMotionProgress = 0;
        presentationMotionPhase = "animating";
        presentationMotionAnimation.duration = presentationMotionDuration(
            tracks, presentationMotionFromSnapshot, confirmed);
        presentationMotionAnimation.start();
        if (!presentationMotionOwnerIsExact()) {
            seedPresentationMotion();
            return false;
        }
        return true;
    }

    function presentationMotionTracks(plan, fromSnapshot, targetSnapshot) {
        try {
            if (!plan || !Object.isFrozen(plan) || !Array.isArray(plan.survivors)
                    || !Object.isFrozen(plan.survivors) || !Array.isArray(plan.entries)
                    || !Object.isFrozen(plan.entries) || !fromSnapshot || !targetSnapshot
                    || plan.survivors.length + plan.entries.length > targetSnapshot.records.length) {
                return null;
            }
            const tracks = Object.create(null);
            for (const track of [...plan.survivors, ...plan.entries]) {
                const targetRecord = track && typeof track.windowId === "string"
                    ? targetSnapshot.recordsByWindowId[track.windowId] : null;
                const sourceRecord = track && typeof track.windowId === "string"
                    ? fromSnapshot.recordsByWindowId[track.windowId] : null;
                if (!presentationMotionTrackIsExact(track, sourceRecord, targetRecord)
                        || tracks[track.windowId] !== undefined
                        || targetSnapshot.candidatesByWindowId[track.windowId] === undefined
                        || (track.disposition === "survivor"
                            && fromSnapshot.candidatesByWindowId[track.windowId]
                                !== targetSnapshot.candidatesByWindowId[track.windowId])) {
                    return null;
                }
                const fromSample = presentationMotionTrackSample(track, 0);
                const targetSample = presentationMotionTrackSample(track, 1);
                if (!fromSample || !targetSample
                        || !presentationMotionFramesEqual(fromSample.frame, track.fromFrame)
                        || !presentationMotionFramesEqual(targetSample.frame, track.toFrame)) {
                    return null;
                }
                tracks[track.windowId] = track;
            }
            for (const targetRecord of targetSnapshot.records) {
                const sourceRecord = fromSnapshot.recordsByWindowId[targetRecord.windowId];
                if (presentationMotionRecordNeedsTrack(sourceRecord, targetRecord)
                        !== (tracks[targetRecord.windowId] !== undefined)) {
                    return null;
                }
            }
            Object.freeze(tracks);
            return tracks;
        } catch (error) {
            return null;
        }
    }

    function presentationMotionRecordNeedsTrack(sourceRecord, targetRecord) {
        return sourceRecord === undefined
            || !presentationMotionFramesEqual(sourceRecord.frame, targetRecord.frame)
            || sourceRecord.kind !== targetRecord.kind
            || sourceRecord.minimized !== targetRecord.minimized
            || presentationMotionRecordMarkerProgress(sourceRecord)
                !== presentationMotionRecordMarkerProgress(targetRecord);
    }

    function presentationMotionTrackIsExact(track, sourceRecord, targetRecord) {
        if (!track || !Object.isFrozen(track) || !targetRecord
                || track.windowId !== targetRecord.windowId
                || track.toKind !== targetRecord.kind
                || track.toMinimized !== targetRecord.minimized
                || track.toMarkerProgress !== presentationMotionRecordMarkerProgress(targetRecord)
                || !presentationMotionFramesEqual(track.toFrame, targetRecord.frame)) {
            return false;
        }
        if (track.disposition === "entry") {
            return sourceRecord === undefined && track.column === null
                && track.fromKind === track.toKind
                && track.fromMinimized === track.toMinimized
                && track.fromMarkerProgress === 0
                && presentationMotionFramesEqual(track.fromFrame, track.toFrame);
        }
        if (track.disposition !== "survivor" || !sourceRecord
                || track.fromMarkerProgress !== presentationMotionRecordMarkerProgress(sourceRecord)) {
            return false;
        }
        const exactColumn = presentationMotionColumnIdentitiesEqual(sourceRecord.column,
                                                                    targetRecord.column)
            ? targetRecord.column : null;
        return (track.column === null && exactColumn === null
                || track.column !== null && exactColumn !== null
                    && presentationMotionColumnIdentitiesEqual(track.column, exactColumn))
            && track.fromKind === sourceRecord.kind
            && track.fromMinimized === sourceRecord.minimized
            && presentationMotionFramesEqual(track.fromFrame, sourceRecord.frame);
    }

    function presentationMotionRecordMarkerProgress(record) {
        return record && record.column && record.column.selectedWindowId === record.windowId ? 1 : 0;
    }

    function presentationMotionColumnIdentitiesEqual(first, second) {
        if (!first || !second || first.selectedWindowId !== second.selectedWindowId
                || first.memberIds.length !== second.memberIds.length) {
            return false;
        }
        for (let index = 0; index < first.memberIds.length; index += 1) {
            if (first.memberIds[index] !== second.memberIds[index]) {
                return false;
            }
        }
        return true;
    }

    function presentationMotionFramesEqual(first, second) {
        return first && second && first.x === second.x && first.y === second.y
            && first.width === second.width && first.height === second.height;
    }

    function presentationMotionDuration(tracks, fromSnapshot, targetSnapshot) {
        let maximumDistance = 0;
        for (const windowId of Object.keys(tracks)) {
            const track = tracks[windowId];
            maximumDistance = Math.max(maximumDistance,
                Math.abs(track.toFrame.x - track.fromFrame.x),
                Math.abs(track.toFrame.y - track.fromFrame.y),
                Math.abs(track.toFrame.width - track.fromFrame.width),
                Math.abs(track.toFrame.height - track.fromFrame.height));
        }
        if (fromSnapshot && targetSnapshot) {
            const tabWindowIds = Object.create(null);
            for (const windowId of Object.keys(fromSnapshot.tabFramesByWindowId)) {
                tabWindowIds[windowId] = true;
            }
            for (const windowId of Object.keys(targetSnapshot.tabFramesByWindowId)) {
                tabWindowIds[windowId] = true;
            }
            for (const windowId of Object.keys(tabWindowIds)) {
                const fromFrame = fromSnapshot.tabFramesByWindowId[windowId];
                const targetFrame = targetSnapshot.tabFramesByWindowId[windowId];
                if (!fromFrame || !targetFrame) {
                    continue;
                }
                maximumDistance = Math.max(maximumDistance,
                    Math.abs(targetFrame.x - fromFrame.x),
                    Math.abs(targetFrame.y - fromFrame.y),
                    Math.abs(targetFrame.width - fromFrame.width),
                    Math.abs(targetFrame.height - fromFrame.height));
            }
            for (const record of targetSnapshot.records) {
                const fromFrame = fromSnapshot.visualFramesByWindowId[record.windowId];
                const targetFrame = targetSnapshot.visualFramesByWindowId[record.windowId];
                if (!fromFrame || !targetFrame) {
                    continue;
                }
                maximumDistance = Math.max(maximumDistance,
                    Math.abs(targetFrame.x - fromFrame.x),
                    Math.abs(targetFrame.y - fromFrame.y),
                    Math.abs(targetFrame.width - fromFrame.width),
                    Math.abs(targetFrame.height - fromFrame.height));
            }
        }
        const extent = Math.max(1, width, height);
        return Math.max(110, Math.min(180, Math.round(120 + 48 * Math.min(1.25,
            maximumDistance / extent))));
    }

    function presentationMotionOwnerIsExact() {
        const owner = presentationMotionOwner;
        return presentationMotionPhase === "animating" && owner
            && spatialMotionEligible && presentationMotionRequestId === owner.requestId
            && overviewSessionId === owner.sessionId
            && overviewContextGeneration === owner.generation
            && overviewActivityId === owner.activityId && outputId === owner.outputId
            && desktopId === owner.desktopId && desktop === owner.desktop
            && context === owner.context && spatialRowGeometryPlan === owner.rowGeometryPlan
            && screen === owner.screen && width === owner.cardWidth && height === owner.cardHeight
            && previewViewportOffset === owner.viewportOffset
            && presentationMotionTargetSnapshot === owner.targetSnapshot
            && !spatialDirectDragBlocked && windowDragActiveSource === null
            && columnDragActiveSource === null && !windowDropHoverOwned && !columnDropHoverOwned;
    }

    function completePresentationMotion() {
        if (!presentationMotionOwnerIsExact() || presentationMotionProgress < 0.999999) {
            seedPresentationMotion();
            return false;
        }
        const settled = presentationMotionTargetSnapshot;
        presentationMotionAnimation.stop();
        presentationMotionProgress = 1;
        presentationMotionFromSnapshot = settled;
        presentationMotionTracksByWindowId = Object.create(null);
        presentationMotionOwner = null;
        presentationMotionPhase = "ready";
        navigationTargetsChanged();
        return true;
    }

    function settlePresentationMotion() {
        if (presentationMotionPhase === "ready") {
            return true;
        }
        return seedPresentationMotion();
    }

    function presentationMotionInterpolatedFrame(fromFrame, toFrame, progress) {
        if (!fromFrame || !toFrame || !Number.isFinite(progress)) {
            return null;
        }
        const bounded = Math.max(0, Math.min(1, progress));
        return {
            height: fromFrame.height + (toFrame.height - fromFrame.height) * bounded,
            width: fromFrame.width + (toFrame.width - fromFrame.width) * bounded,
            x: fromFrame.x + (toFrame.x - fromFrame.x) * bounded,
            y: fromFrame.y + (toFrame.y - fromFrame.y) * bounded
        };
    }

    function presentationMotionVisualValue(windowId, key, fallback, tracked = true) {
        if (!internalMotionActive || typeof windowId !== "string") {
            return fallback;
        }
        const fromState = presentationMotionFromSnapshot
            ? presentationMotionFromSnapshot.visualStatesByWindowId[windowId] : null;
        if (presentationMotionPhase === "validating") {
            return fromState ? fromState[key] : !tracked ? fallback : 0;
        }
        if (!presentationMotionOwnerIsExact()) {
            return fromState ? fromState[key] : !tracked ? fallback : 0;
        }
        const targetState = presentationMotionTargetSnapshot
            ? presentationMotionTargetSnapshot.visualStatesByWindowId[windowId] : null;
        if (!targetState) {
            return fallback;
        }
        const fromValue = fromState ? fromState[key] : 0;
        return fromValue + (targetState[key] - fromValue) * presentationMotionProgress;
    }

    function presentationMotionVisualFrame(windowId, kind, logicalFrame, tracked = true) {
        if (!internalMotionActive || typeof windowId !== "string"
                || !presentationMotionKindIsValid(kind)) {
            return logicalFrame;
        }
        const fromFrame = presentationMotionFromSnapshot
            ? presentationMotionFromSnapshot.visualFramesByWindowId[windowId] : null;
        if (presentationMotionPhase === "validating") {
            const opacityKey = kind === "thumbnail" ? "thumbnailOpacity" : "placeholderOpacity";
            const opacity = presentationMotionVisualValue(windowId, opacityKey,
                                                          kind === "thumbnail" ? 1 : 0, tracked);
            return fromFrame && opacity > 0 ? fromFrame : !tracked ? logicalFrame : null;
        }
        if (!presentationMotionOwnerIsExact()) {
            return fromFrame || (!tracked ? logicalFrame : null);
        }
        const targetFrame = presentationMotionTargetSnapshot
            ? presentationMotionTargetSnapshot.visualFramesByWindowId[windowId] : null;
        const track = presentationMotionTracksByWindowId[windowId];
        if (track && fromFrame && targetFrame
                && presentationMotionFramesEqual(fromFrame, track.fromFrame)
                && presentationMotionFramesEqual(targetFrame, track.toFrame)) {
            const cachedSample = presentationMotionSamplesByWindowId[windowId];
            const sample = cachedSample || presentationMotionTrackSample(
                track, presentationMotionProgress);
            if (sample) {
                return sample.frame;
            }
        }
        if (fromFrame && targetFrame) {
            return presentationMotionInterpolatedFrame(
                fromFrame, targetFrame, presentationMotionProgress) || fromFrame;
        }
        return targetFrame || fromFrame || (!tracked ? logicalFrame : null);
    }

    function presentationMotionVisualOpacity(windowId, kind, logicalKind, tracked = true) {
        const key = kind === "thumbnail" ? "thumbnailOpacity" : "placeholderOpacity";
        return presentationMotionVisualValue(windowId, key,
                                             kind === logicalKind ? 1 : 0, tracked);
    }

    function presentationMotionTabVisualFrame(windowId, logicalFrame) {
        if (!internalMotionActive || typeof windowId !== "string") {
            return logicalFrame;
        }
        const fromFrame = presentationMotionFromSnapshot
            ? presentationMotionFromSnapshot.tabFramesByWindowId[windowId] : null;
        if (presentationMotionPhase === "validating") {
            return fromFrame || logicalFrame;
        }
        if (!presentationMotionOwnerIsExact()) {
            return fromFrame || logicalFrame;
        }
        const toFrame = presentationMotionTargetSnapshot
            ? presentationMotionTargetSnapshot.tabFramesByWindowId[windowId] : null;
        if (fromFrame && toFrame) {
            return presentationMotionInterpolatedFrame(fromFrame, toFrame,
                                                       presentationMotionProgress);
        }
        return toFrame || fromFrame || logicalFrame;
    }

    function presentationMotionTabOpacity(windowId, logicalFrame) {
        return presentationMotionVisualValue(windowId, "tabOpacity", logicalFrame ? 1 : 0);
    }

    function presentationMotionSelectedProgress(windowId, selected) {
        return presentationMotionVisualValue(windowId, "selectedProgress",
                                             selected === true ? 1 : 0);
    }

    function presentationMotionMinimizedProgress(windowId, minimized) {
        return presentationMotionVisualValue(windowId, "minimizedProgress",
                                             minimized === true ? 1 : 0);
    }

    function scheduleDesktopSurfaceReload() {
        const event = desktopSurfaceLifecycleEvent;
        const eventRevision = desktopSurfaceLifecycleEventRevision(event);
        if (eventRevision <= 0 || !desktopSurfaceContextExact) {
            return false;
        }

        const plan = planDesktopSurfaceLifecycleRefresh(event, eventRevision);
        if (plan.targeted !== true) {
            return false;
        }

        const expectation = desktopSurfaceReloadExpectation();
        if (expectation === null || !Object.isFrozen(expectation)) {
            return false;
        }

        desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647
            ? 1 : desktopSurfaceReloadToken + 1;
        const token = desktopSurfaceReloadToken;
        desktopSurfaceReloadRevision = plan.revision;
        const reloadRevision = desktopSurfaceReloadRevision;
        desktopSurfaceReady = false;
        desktopSurfaceReadyToken = 0;
        desktopSurfaceLoadedToken = 0;
        desktopSurfaceContextInvalidated = false;
        if (!applyDesktopSurfaceReloadExpectation(expectation)) {
            desktopSurfaceContextInvalidated = true;
            return false;
        }
        Qt.callLater(card.completeDesktopSurfaceReload, token, reloadRevision);
        return true;
    }

    function completeDesktopSurfaceReload(token, reloadRevision) {
        if (token !== desktopSurfaceReloadToken
                || reloadRevision !== desktopSurfaceReloadRevision
                || !desktopSurfaceReloadContextExact) {
            return false;
        }

        desktopSurfaceReadyToken = token;
        desktopSurfaceReady = true;
        return true;
    }

    function scheduleDesktopSurfaceContextReload() {
        const expectation = desktopSurfaceReloadExpectation();
        if (expectation === null || !Object.isFrozen(expectation)) {
            return false;
        }

        desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647
            ? 1 : desktopSurfaceReloadToken + 1;
        const token = desktopSurfaceReloadToken;
        const reloadRevision = desktopSurfaceReloadRevision;
        desktopSurfaceReady = false;
        desktopSurfaceReadyToken = 0;
        desktopSurfaceLoadedToken = 0;
        desktopSurfaceContextInvalidated = false;
        if (!applyDesktopSurfaceReloadExpectation(expectation)) {
            desktopSurfaceContextInvalidated = true;
            return false;
        }

        Qt.callLater(card.completeDesktopSurfaceReload, token, reloadRevision);
        return true;
    }

    function synchronizeDesktopSurfaceContext() {
        if (!desktopSurfaceContextExact) {
            return invalidateDesktopSurfaceContext();
        }
        if (!desktopSurfaceContextInvalidated && desktopSurfaceReloadToken > 0
                && desktopSurfaceReloadContextExact) {
            return true;
        }

        return scheduleDesktopSurfaceContextReload();
    }

    function invalidateDesktopSurfaceContext() {
        if (desktopSurfaceContextInvalidated) {
            return false;
        }

        desktopSurfaceReloadToken = desktopSurfaceReloadToken >= 2147483647
            ? 1 : desktopSurfaceReloadToken + 1;
        desktopSurfaceContextInvalidated = true;
        desktopSurfaceReady = false;
        desktopSurfaceReadyToken = 0;
        desktopSurfaceLoadedToken = 0;
        return true;
    }

    function desktopSurfaceReloadExpectation() {
        try {
            if (!desktopSurfaceContextExact || !Number.isSafeInteger(overviewContextGeneration)
                    || overviewContextGeneration <= 0 || overviewContextGeneration > 2147483647
                    || !desktop || !screen || screen.name === undefined || screen.name === null) {
                return null;
            }

            return Object.freeze({
                generation: overviewContextGeneration,
                activityId: desktopSurfaceActivityId,
                desktop,
                desktopId,
                screen,
                screenName: String(screen.name),
                outputId
            });
        } catch (error) {
            return null;
        }
    }

    function applyDesktopSurfaceReloadExpectation(expectation) {
        if (!expectation || !Object.isFrozen(expectation)) {
            return false;
        }

        desktopSurfaceReloadGeneration = expectation.generation;
        desktopSurfaceReloadActivityId = expectation.activityId;
        desktopSurfaceReloadDesktop = expectation.desktop;
        desktopSurfaceReloadDesktopId = expectation.desktopId;
        desktopSurfaceReloadScreen = expectation.screen;
        desktopSurfaceReloadScreenName = expectation.screenName;
        desktopSurfaceReloadOutputId = expectation.outputId;
        return true;
    }

    function desktopSurfaceReloadContextIsExact() {
        try {
            return desktopSurfaceContextExact && desktopSurfaceReloadGeneration > 0
                && desktopSurfaceReloadGeneration === overviewContextGeneration
                && desktopSurfaceReloadActivityId === desktopSurfaceActivityId
                && desktopSurfaceReloadActivityId === overviewActivityId
                && desktopSurfaceReloadDesktop === desktop
                && desktopSurfaceReloadDesktopId === desktopId
                && desktopSurfaceReloadScreen === screen
                && desktopSurfaceReloadScreenName === String(screen.name)
                && desktopSurfaceReloadOutputId === outputId;
        } catch (error) {
            return false;
        }
    }

    function desktopSurfaceLoadedItemIsExact(candidate) {
        try {
            return candidate && candidate.driftileContextCaptured === true
                && candidate.driftileReloadToken === desktopSurfaceReloadToken
                && candidate.driftileContextGeneration === desktopSurfaceReloadGeneration
                && candidate.driftileActivityId === desktopSurfaceReloadActivityId
                && candidate.driftileDesktop === desktopSurfaceReloadDesktop
                && candidate.driftileDesktopId === desktopSurfaceReloadDesktopId
                && candidate.driftileScreen === desktopSurfaceReloadScreen
                && candidate.driftileScreenName === desktopSurfaceReloadScreenName
                && candidate.driftileOutputId === desktopSurfaceReloadOutputId
                && desktopSurfaceReloadContextExact;
        } catch (error) {
            return false;
        }
    }

    function acceptDesktopSurfaceLoad(candidate) {
        if (!desktopSurfaceReady || desktopSurfaceReadyToken !== desktopSurfaceReloadToken
                || !desktopSurfaceLoadedItemIsExact(candidate)) {
            return false;
        }

        desktopSurfaceLoadedToken = desktopSurfaceReloadToken;
        return true;
    }

    function rejectDesktopSurfaceLoad() {
        desktopSurfaceLoadedToken = 0;
        return true;
    }

    function desktopSurfaceLifecycleEventRevision(event) {
        try {
            return event !== null && event !== undefined
                && Number.isSafeInteger(event.revision) && event.revision > 0
                && event.revision <= 2147483647 ? event.revision : 0;
        } catch (error) {
            return 0;
        }
    }

    function planDesktopSurfaceLifecycleRefresh(event, eventRevision) {
        const fallback = {
            revision: eventRevision,
            targeted: true
        };

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewDesktopSurfaceLifecycleRefresh !== "function") {
                return fallback;
            }

            const plan = runtime.planOverviewDesktopSurfaceLifecycleRefresh({
                event,
                output: screen,
                outputName: String(screen.name),
                desktopId,
                activityId: desktopSurfaceActivityId
            });
            return desktopSurfaceLifecycleRefreshPlanIsValid(plan, eventRevision) ? plan : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function desktopSurfaceLifecycleRefreshPlanIsValid(plan, eventRevision) {
        return plan && !Array.isArray(plan) && typeof plan === "object"
            && Number.isSafeInteger(plan.revision) && plan.revision === eventRevision
            && typeof plan.targeted === "boolean";
    }

    function desktopSurfaceContextIsExact() {
        try {
            if (!desktopSurfaceEnabled || !desktop || desktop.id === undefined || desktop.id === null
                    || typeof desktopId !== "string" || desktopId.length === 0
                    || String(desktop.id) !== desktopId || !screen
                    || screen.name === undefined || screen.name === null
                    || String(screen.name).length === 0 || outputId.length === 0
                    || desktopSurfaceActivityId.length === 0
                    || overviewActivityId.length === 0
                    || overviewActivityId !== desktopSurfaceActivityId
                    || !Number.isSafeInteger(overviewContextGeneration)
                    || overviewContextGeneration <= 0 || overviewContextGeneration > 2147483647) {
                return false;
            }

            let desktopIdMatches = 0;
            let desktopObjectExact = false;
            for (const liveDesktop of KWin.Workspace.desktops) {
                if (liveDesktop && liveDesktop.id !== undefined && liveDesktop.id !== null
                        && String(liveDesktop.id) === desktopId) {
                    desktopIdMatches += 1;
                    desktopObjectExact = desktopObjectExact || liveDesktop === desktop;
                }
            }
            if (desktopIdMatches !== 1 || !desktopObjectExact) {
                return false;
            }

            let activityMatches = 0;
            for (const liveActivityId of KWin.Workspace.activities) {
                if (liveActivityId !== undefined && liveActivityId !== null
                        && String(liveActivityId) === desktopSurfaceActivityId) {
                    activityMatches += 1;
                }
            }
            if (activityMatches !== 1) {
                return false;
            }

            let screenMatches = 0;
            for (const liveScreen of KWin.Workspace.screens) {
                if (liveScreen === screen) {
                    screenMatches += 1;
                }
            }

            return screenMatches === 1;
        } catch (error) {
            return false;
        }
    }

    function collectNavigationTargets(sceneItem, includeOffscreen = false) {
        const targets = [];
        if (!interactionEligible || !sceneItem || !desktop || !screen
                || desktop.id === undefined || desktop.id === null
                || desktopId.length === 0 || String(desktop.id) !== desktopId) {
            return targets;
        }

        if (searchQuery.trim().length === 0) {
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

            const visual = navigationVisualForPresentation(presentation);
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
                    || visualContainsViewportPoint(presentation.minimizedPlaceholderTarget, point)
                    || visualContainsViewportPoint(presentation.tabTarget, point)) {
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
            const margin = button.hitMargin;
            if (!Number.isFinite(margin) || margin < 0) {
                return true;
            }
            return Number.isFinite(localPoint.x) && Number.isFinite(localPoint.y)
                && localPoint.x >= -margin && localPoint.y >= -margin
                && localPoint.x < button.width + margin && localPoint.y < button.height + margin;
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

    function windowSnapshotCanJoinColumnDrag(presentation, selectedMember) {
        if (selectedMember === true) {
            return windowSnapshotCanDrag(presentation);
        }
        return windowSnapshotCanDrag(presentation)
            || windowSnapshotIsExactPassiveMinimizedMember(presentation);
    }

    function windowSnapshotIsExactPassiveMinimizedMember(presentation) {
        try {
            const snapshot = presentation ? presentation.actionSnapshot : null;
            const candidate = presentation ? presentation.candidate : null;
            const sourceDesktop = presentation ? presentation.sourceDesktop : null;
            const sourceDesktopId = presentation ? presentation.sourceDesktopId : "";
            const sourceScreen = presentation ? presentation.sourceScreen : null;
            if (!snapshot || !candidate || presentation.matchesSearch !== true
                    || presentation.minimizedWindow !== true || snapshot.deleted
                    || snapshot.minimized !== true || snapshot.managed !== true
                    || snapshot.normalWindow !== true || snapshot.moveable !== true
                    || snapshot.wantsInput !== true || snapshot.modal !== false
                    || snapshot.transient !== false || snapshot.transientFor !== null
                    || snapshot.windowId.length === 0 || snapshot.windowId !== presentation.windowId
                    || candidate.deleted === true || candidate.minimized !== true
                    || candidate.managed !== true || candidate.normalWindow !== true
                    || candidate.moveable !== true || candidate.wantsInput !== true
                    || candidate.modal !== false || candidate.transient !== false
                    || candidate.transientFor !== null || candidate.internalId === undefined
                    || candidate.internalId === null || String(candidate.internalId) !== snapshot.windowId
                    || !sourceDesktop || typeof sourceDesktopId !== "string" || sourceDesktopId.length === 0
                    || !sourceScreen || snapshot.output !== sourceScreen || candidate.output !== sourceScreen
                    || !snapshot.desktops || snapshot.desktops.length !== 1
                    || snapshot.desktopIds.length !== 1 || snapshot.desktops[0] !== sourceDesktop
                    || snapshot.desktopIds[0] !== sourceDesktopId) {
                return false;
            }

            const candidateDesktops = candidate.desktops;
            return candidateDesktops && candidateDesktops.length === 1
                && candidateDesktops[0] === sourceDesktop
                && String(candidateDesktops[0].id) === sourceDesktopId;
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

    function crossOutputWindowDropGlobalPosition(scenePosition) {
        if (!scenePosition || !screen || !Number.isFinite(scenePosition.x)
                || !Number.isFinite(scenePosition.y)) {
            return null;
        }
        try {
            const globalPosition = screen.mapToGlobal(scenePosition);
            return globalPosition && Number.isFinite(globalPosition.x) && Number.isFinite(globalPosition.y)
                ? globalPosition : null;
        } catch (error) {
            return null;
        }
    }

    function requestCrossOutputWindowDrop(source, globalPosition) {
        if (!source || !globalPosition || !Number.isFinite(globalPosition.x)
                || !Number.isFinite(globalPosition.y)) {
            return;
        }

        const effect = KWin.SceneView.effect;
        if (!effect || typeof effect.checkItemDroppedOutOfScreen !== "function") {
            return;
        }

        try {
            effect.checkItemDroppedOutOfScreen(globalPosition, source);
        } catch (error) {
            return;
        }
    }

    function selectedWindowIdForColumn(column) {
        try {
            const members = column ? column.members : null;
            const selectedMemberIndex = column ? column.selectedMemberIndex : -1;
            const selectedMember = indexedListHasBoundedLength(members, 1, 256)
                && Number.isInteger(selectedMemberIndex)
                && selectedMemberIndex >= 0 && selectedMemberIndex < members.length
                ? members[selectedMemberIndex] : null;
            return selectedMember && typeof selectedMember.windowId === "string"
                ? selectedMember.windowId : "";
        } catch (error) {
            return "";
        }
    }

    function indexedListHasBoundedLength(value, minimumLength, maximumLength) {
        return value !== null && value !== undefined && typeof value !== "string"
            && Number.isInteger(value.length) && Number.isInteger(minimumLength)
            && Number.isInteger(maximumLength) && minimumLength >= 0
            && maximumLength >= minimumLength && value.length >= minimumLength
            && value.length <= maximumLength;
    }

    function advanceColumnDragEligibilityRevision() {
        columnDragEligibilityRevision = columnDragEligibilityRevision >= 2147483646
            ? 0 : columnDragEligibilityRevision + 1;
        return columnDragEligibilityRevision;
    }

    function exactActiveColumnDragSourceForEligibilityRefresh() {
        const source = columnDragActiveSource;
        if (source === null) {
            return null;
        }
        if (!ownedColumnDropSnapshotIsExact(source)
                || !columnDragHandleIsEligible(source)) {
            cancelColumnSpatialDragSource(source);
            return null;
        }
        return source;
    }

    function invalidateColumnDragEligibilityDelegates(preservedSource) {
        if (!Number.isInteger(columnRepeater.count) || columnRepeater.count < 0
                || columnRepeater.count > 131072) {
            return false;
        }
        for (let index = 0; index < columnRepeater.count; index += 1) {
            const source = columnRepeater.itemAt(index);
            if (source === preservedSource) {
                continue;
            }
            if (source && typeof source.invalidateColumnDragEligibility === "function") {
                source.invalidateColumnDragEligibility();
            }
        }
        return true;
    }

    function refreshColumnDragEligibilityDelegates() {
        if (columnDragEligibilityRefreshPending
                || !Number.isInteger(columnRepeater.count) || columnRepeater.count < 0
                || columnRepeater.count > 131072) {
            return false;
        }
        for (let index = 0; index < columnRepeater.count; index += 1) {
            const source = columnRepeater.itemAt(index);
            if (source && typeof source.refreshColumnDragEligibility === "function") {
                source.refreshColumnDragEligibility();
            }
        }
        return true;
    }

    function scheduleColumnDragEligibilityRefresh() {
        const preservedSource = exactActiveColumnDragSourceForEligibilityRefresh();
        columnDragEligibilityRefreshPending = true;
        invalidateColumnDragEligibilityDelegates(preservedSource);
        columnDragEligibilityRefreshTimer.restart();
    }

    function presentationForWindowId(expectedWindowId) {
        if (typeof expectedWindowId !== "string" || expectedWindowId.length === 0
                || !Number.isInteger(windowRepeater.count) || windowRepeater.count < 0
                || windowRepeater.count > 131072) {
            return null;
        }

        let result = null;
        for (let index = 0; index < windowRepeater.count; index += 1) {
            const presentation = windowRepeater.itemAt(index);
            if (!presentation || presentation.windowId !== expectedWindowId) {
                continue;
            }
            if (result !== null) {
                return null;
            }
            result = presentation;
        }
        return result;
    }

    function columnDragMemberSnapshotsAreEligible(column, expectedColumnIndex) {
        try {
            if (!column || !indexedListHasBoundedLength(column.members, 1, 256)
                    || !Number.isInteger(expectedColumnIndex)
                    || expectedColumnIndex < 0 || !Number.isInteger(windowRepeater.count)
                    || windowRepeater.count < column.members.length || windowRepeater.count > 131072
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0
                    || column.selectedMemberIndex >= column.members.length) {
                return false;
            }

            const expectedMemberIndexes = Object.create(null);
            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const windowId = member ? member.windowId : "";
                if (typeof windowId !== "string" || windowId.length === 0
                        || expectedMemberIndexes[windowId] !== undefined) {
                    return false;
                }
                expectedMemberIndexes[windowId] = memberIndex;
            }

            const matchedMemberIndexes = Object.create(null);
            let matchCount = 0;
            for (let index = 0; index < windowRepeater.count; index += 1) {
                const presentation = windowRepeater.itemAt(index);
                const windowId = presentation ? presentation.windowId : "";
                const memberIndex = expectedMemberIndexes[windowId];
                if (memberIndex === undefined) {
                    continue;
                }
                const tiled = presentation ? presentation.tiledPresentation : null;
                const expectedSelected = column.presentation !== "tabbed"
                    || memberIndex === column.selectedMemberIndex;
                const selectedMember = memberIndex === column.selectedMemberIndex;
                if (matchedMemberIndexes[memberIndex] === true || !tiled
                        || presentation.sourceCard !== card || presentation.sourceDesktop !== desktop
                        || presentation.sourceDesktopId !== desktopId || presentation.sourceScreen !== screen
                        || tiledPresentations[windowId] !== tiled
                        || tiled.columnIndex !== expectedColumnIndex || tiled.memberIndex !== memberIndex
                        || tiled.selected !== expectedSelected
                        || !windowSnapshotCanJoinColumnDrag(presentation, selectedMember)) {
                    return false;
                }
                matchedMemberIndexes[memberIndex] = true;
                matchCount += 1;
            }
            return matchCount === column.members.length;
        } catch (error) {
            return false;
        }
    }

    function claimColumnPointerPress(source) {
        try {
            if (!source || source.sourceCard !== card
                    || !refreshColumnDragEligibilityAtPointer(source)
                    || (columnPointerPressSource !== null && columnPointerPressSource !== source)) {
                return false;
            }
            columnPointerPressSource = source;
            return true;
        } catch (error) {
            return false;
        }
    }

    function claimColumnPointerHover(source) {
        try {
            if (!source || source.sourceCard !== card
                    || !refreshColumnDragEligibilityAtPointer(source)
                    || (columnPointerHoverSource !== null && columnPointerHoverSource !== source)) {
                return false;
            }
            columnPointerHoverSource = source;
            return true;
        } catch (error) {
            return false;
        }
    }

    function releaseColumnPointerHover(source) {
        if (columnPointerHoverSource === source) {
            columnPointerHoverSource = null;
            return true;
        }
        return false;
    }

    function releaseColumnPointerPress(source) {
        if (columnPointerPressSource === source) {
            columnPointerPressSource = null;
            return true;
        }
        return false;
    }

    function columnDragHandleIsEligible(source) {
        try {
            const column = source ? source.sourceColumn : null;
            const selectedPresentation = source ? source.selectedPresentation : null;
            const selectedWindowId = source ? source.selectedWindowId : "";
            const selectedMemberIndex = column ? column.selectedMemberIndex : -1;
            const selectedTiled = selectedPresentation ? selectedPresentation.tiledPresentation : null;
            return source && source.sourceCard === card && source.sourceContext === context
                    && source.sourceDesktop === desktop && source.sourceDesktopId === desktopId
                    && source.sourceScreen === screen && source.scope === "column"
                    && Number.isInteger(source.index) && source.index >= 0 && source.index < columns.length
                    && columns[source.index] === column && column
                    && indexedListHasBoundedLength(column.members, 1, 256)
                    && (column.presentation === "stacked" || column.presentation === "tabbed")
                    && Number.isInteger(selectedMemberIndex) && selectedMemberIndex >= 0
                    && selectedMemberIndex < column.members.length
                    && typeof selectedWindowId === "string" && selectedWindowId.length > 0
                    && column.members[selectedMemberIndex].windowId === selectedWindowId
                    && selectedPresentation && selectedPresentation.windowId === selectedWindowId
                    && selectedPresentation.sourceCard === card
                    && selectedTiled && tiledPresentations[selectedWindowId] === selectedTiled
                    && selectedTiled.columnIndex === source.index
                    && selectedTiled.memberIndex === selectedMemberIndex
                    && selectedTiled.selected === true
                    && windowSnapshotCanDrag(selectedPresentation)
                    && columnDragMemberSnapshotsAreEligible(column, source.index)
                    && windowDropTargetIsExact();
        } catch (error) {
            return false;
        }
    }

    function refreshColumnDragEligibilityAtPointer(source) {
        try {
            if (!source || source.sourceCard !== card || source.dragHandleAvailable !== true
                    || columnDragEligibilityRefreshPending
                    || typeof source.refreshColumnDragEligibility !== "function") {
                return false;
            }
            source.refreshColumnDragEligibility();
            return source.dragEligible === true && columnDragHandleIsEligible(source);
        } catch (error) {
            return false;
        }
    }

    function captureColumnDragSnapshot(source) {
        try {
            if (!columnDragHandleIsEligible(source) || columnDragActiveSource !== null
                    || spatialDirectDragBlocked) {
                return null;
            }

            const expectedContext = context;
            const expectedColumns = columns;
            const expectedColumn = source.sourceColumn;
            const expectedColumnIndex = source.index;
            const expectedPresentations = tiledPresentations;
            const expectedDesktop = desktop;
            const expectedDesktopId = desktopId;
            const expectedScreen = screen;
            const expectedOutputId = outputId;
            const expectedActivityId = overviewActivityId;
            const expectedWindowCount = windowRepeater.count;
            const members = expectedColumn.members;
            const selectedMemberIndex = expectedColumn.selectedMemberIndex;
            const selectedWindowId = source.selectedWindowId;
            const previewColumn = cloneWindowDropPreviewColumn(expectedColumn);
            const widthState = captureColumnWidthState(expectedColumn.width);
            const fullWidthRestoreState = expectedColumn.fullWidthRestore === undefined
                ? Object.freeze({ defined: false })
                : captureColumnWidthState(expectedColumn.fullWidthRestore);
            if (!previewColumn || !widthState || !fullWidthRestoreState
                    || !Number.isInteger(expectedWindowCount) || expectedWindowCount < members.length
                    || expectedWindowCount > 131072 || expectedActivityId.length === 0
                    || expectedOutputId.length === 0) {
                return null;
            }

            const expectedMemberIds = Object.create(null);
            for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
                const member = members[memberIndex];
                const windowId = member ? member.windowId : null;
                if (typeof windowId !== "string" || windowId.length === 0
                        || expectedMemberIds[windowId] !== undefined) {
                    return null;
                }
                expectedMemberIds[windowId] = memberIndex;
            }

            const presentations = Object.create(null);
            for (let index = 0; index < expectedWindowCount; index += 1) {
                const presentation = windowRepeater.itemAt(index);
                if (presentation && presentation.spatialDragLifecycleActive === true) {
                    return null;
                }
                const windowId = presentation ? presentation.windowId : "";
                if (expectedMemberIds[windowId] === undefined) {
                    continue;
                }
                if (presentations[windowId] !== undefined) {
                    return null;
                }
                presentations[windowId] = presentation;
            }

            const records = [];
            for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
                const member = members[memberIndex];
                const windowId = member.windowId;
                const presentation = presentations[windowId];
                const tiled = expectedPresentations[windowId];
                const heightState = captureColumnMemberHeightState(member);
                const heightBoundsState = captureColumnMemberHeightBoundsState(member);
                const expectedSelected = expectedColumn.presentation !== "tabbed"
                    || memberIndex === selectedMemberIndex;
                if (!presentation || !tiled || !heightState || !heightBoundsState
                        || presentation.sourceCard !== card || presentation.windowId !== windowId
                        || presentation.tiledPresentation !== tiled
                        || tiled.columnIndex !== expectedColumnIndex || tiled.memberIndex !== memberIndex
                        || tiled.selected !== expectedSelected
                        || !windowSnapshotCanJoinColumnDrag(presentation,
                                                            memberIndex === selectedMemberIndex)) {
                    return null;
                }
                records.push(Object.freeze({
                    actionSnapshot: presentation.actionSnapshot,
                    candidate: presentation.candidate,
                    heightBoundsState,
                    heightState,
                    member,
                    memberIndex,
                    presentation,
                    thumbnailTarget: expectedSelected ? presentation.thumbnailTarget : null,
                    windowId
                }));
            }

            for (const member of previewColumn.members) {
                Object.freeze(member);
            }
            Object.freeze(previewColumn.members);
            Object.freeze(previewColumn);
            Object.freeze(records);
            Object.freeze(expectedMemberIds);
            return Object.freeze({
                activityId: expectedActivityId,
                column: expectedColumn,
                columnIndex: expectedColumnIndex,
                columns: expectedColumns,
                context: expectedContext,
                desktop: expectedDesktop,
                desktopId: expectedDesktopId,
                fullWidthRestoreState,
                memberIds: expectedMemberIds,
                outputId: expectedOutputId,
                previewColumn,
                records,
                screen: expectedScreen,
                selectedMemberIndex,
                selectedWindowId,
                widthState,
                windowCount: expectedWindowCount
            });
        } catch (error) {
            return null;
        }
    }

    function captureColumnWidthState(value) {
        if (!value || (value.kind !== "fixed" && value.kind !== "proportion")
                || !Number.isFinite(value.value) || value.value <= 0) {
            return null;
        }
        return Object.freeze({ defined: true, kind: value.kind, value: Number(value.value) });
    }

    function captureColumnMemberHeightState(member) {
        const height = member ? member.height : undefined;
        if (height === undefined) {
            return Object.freeze({ defined: false });
        }
        if (!height || typeof height.kind !== "string") {
            return null;
        }
        if (height.kind === "auto" && Number.isFinite(height.weight) && height.weight > 0) {
            return Object.freeze({ defined: true, kind: "auto", value: Number(height.weight) });
        }
        if (height.kind === "fixed" && Number.isFinite(height.clientHeight) && height.clientHeight > 0) {
            return Object.freeze({ defined: true, kind: "fixed", value: Number(height.clientHeight) });
        }
        if (height.kind === "preset" && Number.isInteger(height.index) && height.index >= 0) {
            return Object.freeze({ defined: true, kind: "preset", value: Number(height.index) });
        }
        return null;
    }

    function captureColumnMemberHeightBoundsState(member) {
        const bounds = member ? member.heightBounds : undefined;
        if (bounds === undefined) {
            return Object.freeze({ defined: false });
        }
        if (!bounds || !Number.isFinite(bounds.decorationHeight) || bounds.decorationHeight < 0
                || !Number.isFinite(bounds.minimumClientHeight) || bounds.minimumClientHeight < 0
                || (bounds.maximumClientHeight !== Number.POSITIVE_INFINITY
                    && (!Number.isFinite(bounds.maximumClientHeight)
                        || bounds.maximumClientHeight <= 0
                        || bounds.maximumClientHeight < bounds.minimumClientHeight))) {
            return null;
        }
        return Object.freeze({
            decorationHeight: Number(bounds.decorationHeight),
            defined: true,
            maximumClientHeight: Number(bounds.maximumClientHeight),
            minimumClientHeight: Number(bounds.minimumClientHeight)
        });
    }

    function columnWidthStateIsExact(value, state) {
        return state && Object.isFrozen(state)
            && (state.defined === false
                ? value === undefined
                : state.defined === true && value
                  && value.kind === state.kind && Number(value.value) === state.value);
    }

    function columnMemberHeightStateIsExact(member, state) {
        const height = member ? member.height : undefined;
        if (!state || !Object.isFrozen(state)) {
            return false;
        }
        if (state.defined === false) {
            return height === undefined;
        }
        if (!height || height.kind !== state.kind) {
            return false;
        }
        return state.kind === "auto" ? Number(height.weight) === state.value
            : state.kind === "fixed" ? Number(height.clientHeight) === state.value
            : state.kind === "preset" && Number(height.index) === state.value;
    }

    function columnMemberHeightBoundsStateIsExact(member, state) {
        const bounds = member ? member.heightBounds : undefined;
        if (!state || !Object.isFrozen(state)) {
            return false;
        }
        return state.defined === false ? bounds === undefined
            : state.defined === true && bounds
              && Number(bounds.decorationHeight) === state.decorationHeight
              && Number(bounds.maximumClientHeight) === state.maximumClientHeight
              && Number(bounds.minimumClientHeight) === state.minimumClientHeight;
    }

    function ownedColumnDropSnapshotIsExact(source) {
        try {
            const snapshot = source ? source.columnDragSnapshot : null;
            if (!source || source.sourceCard !== card || source.scope !== "column"
                    || source.columnSpatialDragLifecycleActive !== true
                    || columnDragActiveSource !== source || !snapshot || !Object.isFrozen(snapshot)
                    || source.sourceContext !== context || source.sourceDesktop !== desktop
                    || source.sourceDesktopId !== desktopId || source.sourceScreen !== screen
                    || source.sourceColumn !== snapshot.column || source.index !== snapshot.columnIndex
                    || source.selectedWindowId !== snapshot.selectedWindowId
                    || snapshot.context !== context || snapshot.columns !== columns
                    || !context || context.columns !== columns
                    || snapshot.desktop !== desktop || snapshot.desktopId !== desktopId
                    || snapshot.screen !== screen || snapshot.outputId !== outputId
                    || snapshot.activityId !== overviewActivityId
                    || snapshot.windowCount !== windowRepeater.count
                    || !Array.isArray(snapshot.records) || !Object.isFrozen(snapshot.records)
                    || snapshot.records.length !== snapshot.column.members.length
                    || snapshot.selectedMemberIndex !== snapshot.column.selectedMemberIndex
                    || !columnWidthStateIsExact(snapshot.column.width, snapshot.widthState)
                    || !columnWidthStateIsExact(snapshot.column.fullWidthRestore,
                                                snapshot.fullWidthRestoreState)) {
                return false;
            }

            for (let memberIndex = 0; memberIndex < snapshot.records.length; memberIndex += 1) {
                const record = snapshot.records[memberIndex];
                const member = snapshot.column.members[memberIndex];
                const presentation = record ? record.presentation : null;
                const tiled = presentation ? presentation.tiledPresentation : null;
                const expectedSelected = snapshot.column.presentation !== "tabbed"
                    || memberIndex === snapshot.selectedMemberIndex;
                if (!record || !Object.isFrozen(record) || record.memberIndex !== memberIndex
                        || record.member !== member || !member || member.windowId !== record.windowId
                        || snapshot.memberIds[record.windowId] !== memberIndex
                        || !columnMemberHeightStateIsExact(member, record.heightState)
                        || !columnMemberHeightBoundsStateIsExact(member, record.heightBoundsState)
                        || !presentation || presentation.candidate !== record.candidate
                        || presentation.actionSnapshot !== record.actionSnapshot
                        || presentation.windowId !== record.windowId
                        || presentation.sourceCard !== card || presentation.sourceDesktop !== desktop
                        || presentation.sourceDesktopId !== desktopId || presentation.sourceScreen !== screen
                        || tiledPresentations[record.windowId] !== tiled
                        || tiled.columnIndex !== snapshot.columnIndex || tiled.memberIndex !== memberIndex
                        || tiled.selected !== expectedSelected
                        || !windowSnapshotCanJoinColumnDrag(presentation,
                                                            memberIndex === snapshot.selectedMemberIndex)) {
                    return false;
                }
            }
            return snapshot.records[snapshot.selectedMemberIndex].windowId === snapshot.selectedWindowId;
        } catch (error) {
            return false;
        }
    }

    function beginColumnSpatialDrag(source, scenePosition) {
        try {
            if (!source || source.columnSpatialDragLifecycleActive === true
                    || !spatialDragScenePointIsFinite(scenePosition)
                    || !settlePresentationMotion()
                    || !refreshColumnDragEligibilityAtPointer(source)) {
                return;
            }
            const snapshot = captureColumnDragSnapshot(source);
            if (!snapshot) {
                return;
            }

            source.columnDragSnapshot = snapshot;
            source.columnSpatialDragLifecycleActive = true;
            columnDragActiveSource = source;
            columnSpatialDragStarted(source, scenePosition.x, scenePosition.y);
        } catch (error) {
            cancelColumnSpatialDragSource(source);
        }
    }

    function moveColumnSpatialDrag(source, scenePosition) {
        try {
            if (source !== columnDragActiveSource || !ownedColumnDropSnapshotIsExact(source)
                    || !spatialDragScenePointIsFinite(scenePosition)) {
                cancelColumnSpatialDragSource(source);
                return;
            }
            columnSpatialDragMoved(source, scenePosition.x, scenePosition.y);
        } catch (error) {
            cancelColumnSpatialDragSource(source);
        }
    }

    function finishColumnSpatialDrag(source) {
        try {
            if (!source || source.columnSpatialDragLifecycleActive !== true) {
                if (columnDragActiveSource === source) {
                    columnDragActiveSource = null;
                }
                return;
            }
            source.columnSpatialDragLifecycleActive = false;
            if (columnDragActiveSource === source) {
                columnDragActiveSource = null;
            }
            source.columnDragSnapshot = null;
            clearColumnDropHover();
            columnSpatialDragFinished(source);
        } catch (error) {
            columnDragActiveSource = null;
        }
    }

    function cancelColumnSpatialDragSource(source) {
        if (!source) {
            return;
        }
        if (typeof source.cancelColumnDrag !== "function") {
            finishColumnSpatialDrag(source);
            return;
        }
        try {
            source.cancelColumnDrag();
        } catch (error) {
            finishColumnSpatialDrag(source);
        }
    }

    function cancelActiveColumnSpatialDrag() {
        const source = columnDragActiveSource;
        if (source !== null) {
            cancelColumnSpatialDragSource(source);
        }
        columnPointerPressSource = null;
        const hoveredSource = columnPointerHoverSource;
        if (hoveredSource !== null && !columnDragHandleIsEligible(hoveredSource)) {
            columnPointerHoverSource = null;
        }
    }

    function cancelInvalidActiveColumnSpatialDrag() {
        const source = columnDragActiveSource;
        if (source !== null && !ownedColumnDropSnapshotIsExact(source)) {
            cancelColumnSpatialDragSource(source);
        }
        const pressedSource = columnPointerPressSource;
        if (pressedSource !== null && !columnDragHandleIsEligible(pressedSource)) {
            columnPointerPressSource = null;
        }
        const hoveredSource = columnPointerHoverSource;
        if (hoveredSource !== null && !columnDragHandleIsEligible(hoveredSource)) {
            columnPointerHoverSource = null;
        }
    }

    function columnDragWindowIsDimmed(windowId) {
        try {
            const source = columnDragActiveSource;
            const snapshot = source ? source.columnDragSnapshot : null;
            return source && source.columnSpatialDragLifecycleActive === true
                    && snapshot && snapshot.memberIds[windowId] !== undefined;
        } catch (error) {
            return false;
        }
    }

    function windowDragHandlerOwnsLifecycle(source) {
        try {
            return source && source === windowDragActiveSource
                    && source.spatialDragLifecycleActive === true
                    && source.windowDragSnapshot && Object.isFrozen(source.windowDragSnapshot);
        } catch (error) {
            return false;
        }
    }

    function windowDragActionSnapshotIsExact(actionSnapshot, dragSnapshot) {
        try {
            return actionSnapshot && dragSnapshot && Object.isFrozen(dragSnapshot)
                && Array.isArray(actionSnapshot.desktops) && actionSnapshot.desktops.length === 1
                && Array.isArray(actionSnapshot.desktopIds) && actionSnapshot.desktopIds.length === 1
                && actionSnapshot.desktops[0] === dragSnapshot.actionDesktop
                && actionSnapshot.desktopIds[0] === dragSnapshot.actionDesktopId
                && actionSnapshot.deleted === dragSnapshot.actionDeleted
                && actionSnapshot.managed === dragSnapshot.actionManaged
                && actionSnapshot.minimized === dragSnapshot.actionMinimized
                && actionSnapshot.modal === dragSnapshot.actionModal
                && actionSnapshot.moveable === dragSnapshot.actionMoveable
                && actionSnapshot.normalWindow === dragSnapshot.actionNormalWindow
                && actionSnapshot.output === dragSnapshot.actionOutput
                && actionSnapshot.transient === dragSnapshot.actionTransient
                && actionSnapshot.transientFor === dragSnapshot.actionTransientFor
                && actionSnapshot.wantsInput === dragSnapshot.actionWantsInput
                && actionSnapshot.windowId === dragSnapshot.windowId;
        } catch (error) {
            return false;
        }
    }

    function captureWindowDragSnapshot(source) {
        try {
            if (!source || source.sourceCard !== card || windowDragActiveSource !== null
                    || source.spatialDragLifecycleActive === true || source.windowDragSnapshot !== null
                    || source.dragEligible !== true || source.minimizedWindow === true
                    || columnDragActiveSource !== null || columnPointerHoverSource !== null
                    || columnPointerPressSource !== null || spatialDirectDragBlocked
                    || !spatialDragSourceIsOwned(source) || !windowSnapshotCanDrag(source)
                    || !windowCanDrag(source) || !ownedWindowDropTiledPresentationIsExact(source)) {
                return null;
            }

            const expectedContext = context;
            const expectedColumns = columns;
            const expectedTiledPresentation = source.tiledPresentation;
            const expectedColumnIndex = expectedTiledPresentation.columnIndex;
            const expectedMemberIndex = expectedTiledPresentation.memberIndex;
            const expectedColumn = expectedColumns[expectedColumnIndex];
            const expectedMember = expectedColumn && expectedColumn.members
                ? expectedColumn.members[expectedMemberIndex] : null;
            const expectedActionSnapshot = source.actionSnapshot;
            const expectedCandidate = source.candidate;
            const expectedDesktop = desktop;
            const expectedDesktopId = desktopId;
            const expectedScreen = screen;
            const expectedOutputId = outputId;
            const expectedActivityId = overviewActivityId;
            const expectedWindowId = source.windowId;
            const expectedThumbnailTarget = source.thumbnailTarget;
            if (!expectedContext || expectedContext.columns !== expectedColumns
                    || !expectedColumn || !indexedListHasBoundedLength(expectedColumn.members, 1, 256)
                    || !expectedMember || expectedMember.windowId !== expectedWindowId
                    || !expectedActionSnapshot || !Array.isArray(expectedActionSnapshot.desktops)
                    || expectedActionSnapshot.desktops.length !== 1
                    || !Array.isArray(expectedActionSnapshot.desktopIds)
                    || expectedActionSnapshot.desktopIds.length !== 1
                    || !expectedThumbnailTarget || expectedThumbnailTarget.visible !== true
                    || expectedOutputId.length === 0 || expectedActivityId.length === 0) {
                return null;
            }

            return Object.freeze({
                actionDeleted: expectedActionSnapshot.deleted,
                actionDesktop: expectedActionSnapshot.desktops[0],
                actionDesktopId: expectedActionSnapshot.desktopIds[0],
                actionManaged: expectedActionSnapshot.managed,
                actionMinimized: expectedActionSnapshot.minimized,
                actionModal: expectedActionSnapshot.modal,
                actionMoveable: expectedActionSnapshot.moveable,
                actionNormalWindow: expectedActionSnapshot.normalWindow,
                actionOutput: expectedActionSnapshot.output,
                actionTransient: expectedActionSnapshot.transient,
                actionTransientFor: expectedActionSnapshot.transientFor,
                actionWantsInput: expectedActionSnapshot.wantsInput,
                activityId: expectedActivityId,
                candidate: expectedCandidate,
                column: expectedColumn,
                columnIndex: expectedColumnIndex,
                columnPresentation: expectedColumn.presentation,
                columns: expectedColumns,
                context: expectedContext,
                desktop: expectedDesktop,
                desktopId: expectedDesktopId,
                member: expectedMember,
                memberIndex: expectedMemberIndex,
                outputId: expectedOutputId,
                screen: expectedScreen,
                selectedMemberIndex: expectedColumn.selectedMemberIndex,
                thumbnailTarget: expectedThumbnailTarget,
                windowId: expectedWindowId
            });
        } catch (error) {
            return null;
        }
    }

    function ownedWindowDragSnapshotIsExact(source) {
        try {
            const snapshot = source ? source.windowDragSnapshot : null;
            const candidate = source ? source.candidate : null;
            const tiled = source ? source.tiledPresentation : null;
            const frame = source ? source.frame : null;
            return source && source.sourceCard === card && source === windowDragActiveSource
                    && source.spatialDragLifecycleActive === true
                    && source.minimizedWindow !== true && snapshot && Object.isFrozen(snapshot)
                    && windowDragActionSnapshotIsExact(source.actionSnapshot, snapshot)
                    && source.candidate === snapshot.candidate && candidate
                    && source.windowId === snapshot.windowId
                    && source.sourceDesktop === snapshot.desktop && source.sourceDesktop === desktop
                    && source.sourceDesktopId === snapshot.desktopId && source.sourceDesktopId === desktopId
                    && source.sourceScreen === snapshot.screen && source.sourceScreen === screen
                    && snapshot.context === context && snapshot.columns === columns
                    && context && context.columns === columns
                    && snapshot.desktop === desktop && snapshot.desktopId === desktopId
                    && snapshot.screen === screen && snapshot.outputId === outputId
                    && snapshot.activityId === overviewActivityId
                    && tiledPresentations[snapshot.windowId] === tiled
                    && Number.isInteger(snapshot.columnIndex) && snapshot.columnIndex >= 0
                    && snapshot.columnIndex < columns.length && columns[snapshot.columnIndex] === snapshot.column
                    && snapshot.column && snapshot.column.members
                    && snapshot.column.presentation === snapshot.columnPresentation
                    && snapshot.column.selectedMemberIndex === snapshot.selectedMemberIndex
                    && Number.isInteger(snapshot.memberIndex) && snapshot.memberIndex >= 0
                    && snapshot.memberIndex < snapshot.column.members.length
                    && snapshot.column.members[snapshot.memberIndex] === snapshot.member
                    && snapshot.member && snapshot.member.windowId === snapshot.windowId
                    && tiled && tiled.columnIndex === snapshot.columnIndex
                    && tiled.memberIndex === snapshot.memberIndex && tiled.selected === true
                    && source.thumbnailTarget === snapshot.thumbnailTarget
                    && snapshot.thumbnailTarget.visible === true
                    && frame && frame.floating === false
                    && spatialDragSourceIsOwned(source) && windowSnapshotCanDrag(source)
                    && windowCanDrag(source) && ownedWindowDropTiledPresentationIsExact(source);
        } catch (error) {
            return false;
        }
    }

    function beginWindowSpatialDrag(source, scenePosition) {
        try {
            if (columnDragActiveSource !== null || columnPointerHoverSource !== null
                    || columnPointerPressSource !== null) {
                return;
            }
            if (!spatialDragScenePointIsFinite(scenePosition)
                    || !settlePresentationMotion()) {
                return false;
            }
            const snapshot = captureWindowDragSnapshot(source);
            if (!snapshot) {
                return false;
            }

            advanceWindowDragValidationRevision();
            source.windowDragSnapshot = snapshot;
            windowDragActiveSource = source;
            source.spatialDragLifecycleActive = true;
            windowSpatialDragStarted(source, scenePosition.x, scenePosition.y);
            if (!ownedWindowDragSnapshotIsExact(source)) {
                cancelWindowSpatialDragSource(source);
                return false;
            }
            return true;
        } catch (error) {
            cancelWindowSpatialDragSource(source);
            return false;
        }
    }

    function moveWindowSpatialDrag(source, scenePosition) {
        try {
            if (!spatialDragScenePointIsFinite(scenePosition)) {
                cancelWindowSpatialDragSource(source);
                return false;
            }
            if (!ownedWindowDragSnapshotIsExact(source)) {
                scheduleWindowSpatialDragValidation(source);
                return false;
            }

            windowSpatialDragMoved(source, scenePosition.x, scenePosition.y);
            return true;
        } catch (error) {
            cancelWindowSpatialDragSource(source);
            return false;
        }
    }

    function finishWindowSpatialDrag(source) {
        try {
            if (!source) {
                return false;
            }

            const wasActive = source.spatialDragLifecycleActive === true;
            const wasOwned = source === windowDragActiveSource
                || source.windowDragSnapshot !== null;
            if (!wasActive && !wasOwned) {
                source.touchSpatialDragArmed = false;
                return false;
            }

            advanceWindowDragValidationRevision();
            source.spatialDragLifecycleActive = false;
            if (windowDragActiveSource === source) {
                windowDragActiveSource = null;
            }
            source.windowDragSnapshot = null;
            source.touchSpatialDragArmed = false;
            clearWindowDropHover();
            if (wasActive) {
                windowSpatialDragFinished(source);
            }
            return wasActive;
        } catch (error) {
            if (windowDragActiveSource === source) {
                windowDragActiveSource = null;
            }
            return false;
        }
    }

    function cancelWindowSpatialDragSource(source) {
        try {
            if (!source || (source !== windowDragActiveSource
                            && source.spatialDragLifecycleActive !== true
                            && source.windowDragSnapshot === null)) {
                return false;
            }
            if (typeof source.cancelWindowDrag === "function") {
                source.cancelWindowDrag();
            } else {
                finishWindowSpatialDrag(source);
            }
            return true;
        } catch (error) {
            finishWindowSpatialDrag(source);
            return false;
        }
    }

    function cancelActiveWindowSpatialDrag() {
        const source = windowDragActiveSource;
        return source !== null ? cancelWindowSpatialDragSource(source) : false;
    }

    function cancelInvalidWindowSpatialDragSource(source) {
        if (source && source === windowDragActiveSource
                && !ownedWindowDragSnapshotIsExact(source)) {
            return cancelWindowSpatialDragSource(source);
        }
        return false;
    }

    function cancelInvalidActiveWindowSpatialDrag() {
        return cancelInvalidWindowSpatialDragSource(windowDragActiveSource);
    }

    function advanceWindowDragValidationRevision() {
        windowDragValidationRevision = windowDragValidationRevision >= 2147483646
            ? 0 : windowDragValidationRevision + 1;
        return windowDragValidationRevision;
    }

    function scheduleWindowSpatialDragValidation(source) {
        if (!source || source !== windowDragActiveSource
                || source.spatialDragLifecycleActive !== true) {
            return false;
        }
        if (ownedWindowDragSnapshotIsExact(source)) {
            return true;
        }
        const requestId = advanceWindowDragValidationRevision();
        Qt.callLater(function() {
            if (requestId === card.windowDragValidationRevision
                    && source === card.windowDragActiveSource
                    && source.spatialDragLifecycleActive === true) {
                card.cancelInvalidWindowSpatialDragSource(source);
            }
        });
        return true;
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
                    && source.spatialDragLifecycleActive === true
                    && ownedWindowDragSnapshotIsExact(source)
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

    function buildColumnDropPlannerSnapshot() {
        try {
            const baseSnapshot = buildWindowDropPlannerSnapshot();
            if (!baseSnapshot) {
                return null;
            }

            const columnTargets = [];
            for (let columnIndex = 0; columnIndex < baseSnapshot.columns.length; columnIndex += 1) {
                const column = baseSnapshot.columns[columnIndex];
                const selectedMember = column && indexedListHasBoundedLength(column.members, 1, 256)
                    && Number.isInteger(column.selectedMemberIndex)
                    && column.selectedMemberIndex >= 0
                    && column.selectedMemberIndex < column.members.length
                    ? column.members[column.selectedMemberIndex] : null;
                const selectedWindowId = selectedMember ? selectedMember.windowId : "";
                const preview = baseSnapshot.previewFrames[selectedWindowId];
                if (!preview) {
                    continue;
                }
                if (typeof selectedWindowId !== "string" || selectedWindowId.length === 0
                        || !preview.columnFrame || !Object.isFrozen(preview.columnFrame)
                        || !windowDropPreviewFrameIsBounded(preview.columnFrame, baseSnapshot)) {
                    return null;
                }
                const before = Object.freeze({
                    activityId: baseSnapshot.activityId,
                    desktopId: baseSnapshot.desktopId,
                    kind: "column-boundary",
                    outputId: baseSnapshot.outputId,
                    position: "before",
                    rowIndex: 0,
                    targetWindowId: selectedWindowId
                });
                const after = Object.freeze({
                    activityId: baseSnapshot.activityId,
                    desktopId: baseSnapshot.desktopId,
                    kind: "column-boundary",
                    outputId: baseSnapshot.outputId,
                    position: "after",
                    rowIndex: 0,
                    targetWindowId: selectedWindowId
                });
                columnTargets.push(Object.freeze({
                    after,
                    before,
                    columnIndex,
                    frame: preview.columnFrame,
                    selectedWindowId
                }));
            }
            if (baseSnapshot.contextColumnCount > 0 && columnTargets.length === 0) {
                return null;
            }

            const emptyTarget = baseSnapshot.contextColumnCount === 0
                ? Object.freeze({
                      activityId: baseSnapshot.activityId,
                      desktopId: baseSnapshot.desktopId,
                      kind: "empty-row",
                      outputId: baseSnapshot.outputId,
                      rowIndex: 0
                  })
                : null;
            Object.freeze(columnTargets);
            return Object.freeze({
                baseSnapshot,
                columnTargets,
                emptyTarget
            });
        } catch (error) {
            return null;
        }
    }

    function columnDropPlannerSnapshotIsExact(snapshot) {
        try {
            const baseSnapshot = snapshot ? snapshot.baseSnapshot : null;
            if (!snapshot || !Object.isFrozen(snapshot) || !Object.isFrozen(snapshot.columnTargets)
                    || !windowDropPlannerSnapshotIsExact(baseSnapshot)
                    || (baseSnapshot.contextColumnCount === 0) !== (snapshot.emptyTarget !== null)
                    || (snapshot.emptyTarget !== null && !Object.isFrozen(snapshot.emptyTarget))) {
                return false;
            }
            let previousColumnIndex = -1;
            for (const target of snapshot.columnTargets) {
                const column = baseSnapshot.columns[target.columnIndex];
                const selectedMember = column ? column.members[column.selectedMemberIndex] : null;
                if (!target || !Object.isFrozen(target) || !Object.isFrozen(target.before)
                        || !Object.isFrozen(target.after) || target.columnIndex <= previousColumnIndex
                        || !selectedMember || selectedMember.windowId !== target.selectedWindowId
                        || baseSnapshot.previewFrames[target.selectedWindowId].columnFrame !== target.frame
                        || target.before.targetWindowId !== target.selectedWindowId
                        || target.after.targetWindowId !== target.selectedWindowId
                        || target.before.position !== "before" || target.after.position !== "after") {
                    return false;
                }
                previousColumnIndex = target.columnIndex;
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    function hitColumnDropPlannerSnapshot(snapshot, localPosition) {
        try {
            if (!columnDropPlannerSnapshotIsExact(snapshot)
                    || !spatialDragScenePointIsFinite(localPosition)) {
                return null;
            }
            const baseSnapshot = snapshot.baseSnapshot;
            if (snapshot.emptyTarget !== null) {
                return localPosition.x >= 0 && localPosition.y >= 0
                    && localPosition.x < baseSnapshot.cardWidth
                    && localPosition.y < baseSnapshot.cardHeight ? snapshot.emptyTarget : null;
            }

            let hit = null;
            for (const target of snapshot.columnTargets) {
                const frame = target.frame;
                if (localPosition.x < frame.x || localPosition.x >= frame.x + frame.width
                        || localPosition.y < frame.y || localPosition.y >= frame.y + frame.height) {
                    continue;
                }
                if (hit !== null) {
                    return null;
                }
                hit = localPosition.x < frame.x + frame.width / 2 ? target.before : target.after;
            }
            return hit;
        } catch (error) {
            return null;
        }
    }

    function columnDropPlannerTargetIsExact(target, snapshot) {
        try {
            if (!columnDropPlannerSnapshotIsExact(snapshot) || !target || !Object.isFrozen(target)) {
                return false;
            }
            if (target === snapshot.emptyTarget) {
                return target.kind === "empty-row";
            }
            for (const candidate of snapshot.columnTargets) {
                if (target === candidate.before || target === candidate.after) {
                    return target.kind === "column-boundary"
                        && target.targetWindowId === candidate.selectedWindowId;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    function columnDropSourceIsExact(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            return Boolean(sourceCard && source.scope === "column"
                && typeof sourceCard.ownedColumnDropSnapshotIsExact === "function"
                && sourceCard.ownedColumnDropSnapshotIsExact(source));
        } catch (error) {
            return false;
        }
    }

    function columnDropIsValid(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-column") >= 0
                    && source && source.scope === "column"
                    && source.columnSpatialDragLifecycleActive === true
                    && source.sourceScreen === screen && columnDropSourceIsExact(source)
                    && windowDropTargetIsExact() && windowDropSourceWorkspaceRelationIsExact(source);
        } catch (error) {
            return false;
        }
    }

    function columnDropLocalPosition(drag) {
        if (!drag || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
            return null;
        }
        return { x: Number(drag.x), y: Number(drag.y) };
    }

    function columnDropScenePosition(drag) {
        if (!drag || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
            return null;
        }
        try {
            const scenePosition = columnDropArea.mapToItem(null, drag.x, drag.y);
            return spatialDragScenePointIsFinite(scenePosition) ? scenePosition : null;
        } catch (error) {
            return null;
        }
    }

    function claimColumnDropHover(source, drag) {
        const localPosition = columnDropLocalPosition(drag);
        const scenePosition = columnDropScenePosition(drag);
        if (!localPosition || !scenePosition) {
            clearColumnDropHover();
            return false;
        }
        if (columnDropHoverOwned) {
            if (columnDropHoverOwnershipMatches(source)) {
                return moveColumnDropHoverToPositions(source, localPosition, scenePosition);
            }
            clearColumnDropHover();
        }

        try {
            const snapshot = buildColumnDropPlannerSnapshot();
            const target = hitColumnDropPlannerSnapshot(snapshot, localPosition);
            const preview = planColumnDropPreview(source, target, snapshot);
            if (!snapshot || !target || !preview || !windowDropSourceWorkspaceRelationIsExact(source)) {
                clearColumnDropHover();
                return false;
            }
            const crossWorkspace = windowDropSourceTargetsDifferentWorkspace(source);
            columnDropHoverSource = source;
            columnDropHoverSourceWindowId = source.selectedWindowId;
            columnDropHoverDesktop = desktop;
            columnDropHoverDesktopId = desktopId;
            columnDropHoverScreen = screen;
            columnDropHoverSnapshot = snapshot;
            columnDropHoverTarget = target;
            columnDropHoverPreview = preview;
            columnDropHoverCrossWorkspace = crossWorkspace;
            columnDropHoverOwned = true;
            if (crossWorkspace) {
                windowWorkspaceHoverEntered(source, desktop, desktopId, screen,
                                            scenePosition.x, scenePosition.y);
            }
            return true;
        } catch (error) {
            clearColumnDropHover();
            return false;
        }
    }

    function moveColumnDropHover(source, drag) {
        const localPosition = columnDropLocalPosition(drag);
        const scenePosition = columnDropScenePosition(drag);
        return localPosition && scenePosition
            ? moveColumnDropHoverToPositions(source, localPosition, scenePosition) : false;
    }

    function moveColumnDropHoverToPositions(source, localPosition, scenePosition) {
        if (!columnDropHoverOwnershipMatches(source)
                || !spatialDragScenePointIsFinite(localPosition)
                || !spatialDragScenePointIsFinite(scenePosition)) {
            clearColumnDropHover();
            return false;
        }
        const target = hitColumnDropPlannerSnapshot(columnDropHoverSnapshot, localPosition);
        if (!target) {
            clearColumnDropHover();
            return false;
        }
        if (target !== columnDropHoverTarget) {
            const preview = planColumnDropPreview(source, target, columnDropHoverSnapshot);
            if (!preview) {
                clearColumnDropHover();
                return false;
            }
            columnDropHoverTarget = target;
            columnDropHoverPreview = preview;
        }
        if (columnDropHoverCrossWorkspace) {
            windowWorkspaceHoverMoved(source, columnDropHoverDesktop, columnDropHoverDesktopId,
                                      columnDropHoverScreen, scenePosition.x, scenePosition.y);
        }
        return true;
    }

    function rejectColumnDropHover() {
        clearColumnDropHover();
        return false;
    }

    function clearInvalidColumnDropHover() {
        if (columnDropHoverOwned && !columnDropHoverOwnershipIsValid()) {
            clearColumnDropHover();
        }
    }

    function clearColumnDropHover() {
        if (!columnDropHoverOwned) {
            resetColumnDropHoverOwnership();
            return;
        }
        const source = columnDropHoverSource;
        const targetDesktop = columnDropHoverDesktop;
        const targetDesktopId = columnDropHoverDesktopId;
        const targetScreen = columnDropHoverScreen;
        const crossWorkspace = columnDropHoverCrossWorkspace;
        resetColumnDropHoverOwnership();
        if (crossWorkspace) {
            windowWorkspaceHoverLeft(source, targetDesktop, targetDesktopId, targetScreen);
        }
    }

    function resetColumnDropHoverOwnership() {
        columnDropHoverOwned = false;
        columnDropHoverSource = null;
        columnDropHoverSourceWindowId = "";
        columnDropHoverDesktop = null;
        columnDropHoverDesktopId = "";
        columnDropHoverScreen = null;
        columnDropHoverSnapshot = null;
        columnDropHoverTarget = null;
        columnDropHoverPreview = null;
        columnDropHoverCrossWorkspace = false;
    }

    function columnDropHoverOwnershipIsValid() {
        return columnDropHoverOwnershipMatches(columnDropHoverSource)
            && columnDropIsValid(columnDropHoverSource, ["driftile-column"]);
    }

    function columnDropHoverOwnershipMatches(source) {
        try {
            return columnDropHoverOwned && source && source === columnDropHoverSource
                    && source.scope === "column"
                    && source.selectedWindowId === columnDropHoverSourceWindowId
                    && source.columnSpatialDragLifecycleActive === true
                    && source.sourceScreen === screen && columnDropSourceIsExact(source)
                    && windowDropSourceWorkspaceRelationIsExact(source)
                    && columnDropHoverCrossWorkspace === windowDropSourceTargetsDifferentWorkspace(source)
                    && columnDropHoverDesktop === desktop && columnDropHoverDesktopId === desktopId
                    && columnDropHoverScreen === screen && windowDropTargetIsExact()
                    && columnDropPlannerSnapshotIsExact(columnDropHoverSnapshot)
                    && columnDropPlannerTargetIsExact(columnDropHoverTarget, columnDropHoverSnapshot)
                    && columnDropPreviewIsExact(columnDropHoverPreview, source,
                                                columnDropHoverTarget, columnDropHoverSnapshot);
        } catch (error) {
            return false;
        }
    }

    function planColumnDropPreview(source, target, snapshot) {
        try {
            if (!columnDropSourceIsExact(source)
                    || !columnDropPlannerTargetIsExact(target, snapshot)) {
                return null;
            }
            const prospective = buildColumnDropPreviewColumns(source, target, snapshot);
            const geometry = prospective ? solveColumnDropPreviewGeometry(prospective, snapshot) : null;
            const basisFingerprint = geometry
                ? captureWindowDropBasisFingerprint(source, target) : null;
            if (!geometry || basisFingerprint === null) {
                return null;
            }

            let marker = null;
            if (target.kind === "column-boundary") {
                const targetFrames = snapshot.baseSnapshot.previewFrames[target.targetWindowId];
                const frame = targetFrames ? targetFrames.columnFrame : null;
                if (!frame || !windowDropPreviewFrameIsBounded(frame, snapshot.baseSnapshot)) {
                    return null;
                }
                const thickness = Math.max(2, Math.min(6, frame.width, frame.height));
                marker = Object.freeze({
                    height: frame.height,
                    width: thickness,
                    x: target.position === "before" ? frame.x : frame.x + frame.width - thickness,
                    y: frame.y
                });
                if (!windowDropPreviewFrameIsBounded(marker, snapshot.baseSnapshot)) {
                    return null;
                }
            }

            return Object.freeze({
                basisFingerprint,
                columnFrame: geometry.columnFrame,
                kind: target.kind,
                marker,
                memberFrames: geometry.memberFrames,
                snapshot,
                source,
                target
            });
        } catch (error) {
            return null;
        }
    }

    function columnDropPreviewIsExact(preview, source, target, snapshot) {
        return preview && Object.isFrozen(preview) && preview.source === source
            && preview.target === target && preview.snapshot === snapshot
            && typeof preview.basisFingerprint === "string"
            && /^[0-9a-f]{64}$/.test(preview.basisFingerprint)
            && Object.isFrozen(preview.columnFrame) && Object.isFrozen(preview.memberFrames)
            && columnDropSourceIsExact(source) && columnDropPlannerTargetIsExact(target, snapshot)
            && columnDropPreviewMemberFramesAreExact(preview.memberFrames, source, snapshot)
            && windowDropPreviewFrameIsRenderable(preview.columnFrame, snapshot.baseSnapshot)
            && (preview.marker === null
                || Object.isFrozen(preview.marker)
                && windowDropPreviewFrameIsBounded(preview.marker, snapshot.baseSnapshot));
    }

    function columnDropPreviewMemberFramesAreExact(memberFrames, source, snapshot) {
        const sourceSnapshot = source ? source.columnDragSnapshot : null;
        const expectedCount = sourceSnapshot && sourceSnapshot.column.presentation === "tabbed"
            ? 1 : sourceSnapshot ? sourceSnapshot.records.length : -1;
        if (!Object.isFrozen(memberFrames) || memberFrames.length !== expectedCount
                || !snapshot || !snapshot.baseSnapshot) {
            return false;
        }
        const seenWindowIds = Object.create(null);
        for (const frame of memberFrames) {
            if (!frame || !Object.isFrozen(frame) || typeof frame.windowId !== "string"
                    || sourceSnapshot.memberIds[frame.windowId] === undefined
                    || seenWindowIds[frame.windowId] === true
                    || !windowDropPreviewFrameIsRenderable(frame, snapshot.baseSnapshot)) {
                return false;
            }
            seenWindowIds[frame.windowId] = true;
        }
        return sourceSnapshot.column.presentation !== "tabbed"
            || memberFrames[0].windowId === sourceSnapshot.selectedWindowId;
    }

    function buildColumnDropPreviewColumns(source, target, snapshot) {
        const sourceSnapshot = source ? source.columnDragSnapshot : null;
        const baseSnapshot = snapshot ? snapshot.baseSnapshot : null;
        if (!sourceSnapshot || !baseSnapshot
                || !indexedListHasBoundedLength(baseSnapshot.columns, 0, 512)) {
            return null;
        }
        const sameContext = source.sourceCard === card;
        if (sameContext !== (sourceSnapshot.context === baseSnapshot.context)) {
            return null;
        }

        const columns = [];
        for (const column of baseSnapshot.columns) {
            const clone = cloneWindowDropPreviewColumn(column);
            if (!clone) {
                return null;
            }
            columns.push(clone);
        }
        let movedColumn = cloneWindowDropPreviewColumn(sourceSnapshot.previewColumn);
        if (!movedColumn) {
            return null;
        }

        let originalSourceColumnIndex = -1;
        if (sameContext) {
            const sourceLocation = windowDropPreviewLocation(columns, sourceSnapshot.selectedWindowId);
            if (!sourceLocation || sourceLocation.columnIndex !== sourceSnapshot.columnIndex
                    || !columnDropPreviewColumnMatchesSource(columns[sourceLocation.columnIndex],
                                                             sourceSnapshot)) {
                return null;
            }
            originalSourceColumnIndex = sourceLocation.columnIndex;
            movedColumn = columns.splice(originalSourceColumnIndex, 1)[0];
        } else {
            for (const record of sourceSnapshot.records) {
                if (windowDropPreviewLocation(columns, record.windowId) !== null) {
                    return null;
                }
            }
        }

        if (target.kind === "empty-row") {
            if (sameContext || columns.length !== 0) {
                return null;
            }
            columns.push(movedColumn);
            return {
                activeColumnIndex: 0,
                columns,
                movedColumnIndex: 0,
                sourceWindowId: sourceSnapshot.selectedWindowId
            };
        }
        if (target.kind !== "column-boundary"
                || sourceSnapshot.memberIds[target.targetWindowId] !== undefined) {
            return null;
        }

        const targetLocation = windowDropPreviewLocation(columns, target.targetWindowId);
        if (!targetLocation) {
            return null;
        }
        const insertionIndex = targetLocation.columnIndex + (target.position === "after" ? 1 : 0);
        if (sameContext && insertionIndex === originalSourceColumnIndex) {
            return null;
        }
        columns.splice(insertionIndex, 0, movedColumn);
        return {
            activeColumnIndex: insertionIndex,
            columns,
            movedColumnIndex: insertionIndex,
            sourceWindowId: sourceSnapshot.selectedWindowId
        };
    }

    function columnDropPreviewColumnMatchesSource(column, sourceSnapshot) {
        if (!column || !sourceSnapshot || !indexedListHasBoundedLength(column.members, 1, 256)
                || column.members.length !== sourceSnapshot.records.length
                || column.presentation !== sourceSnapshot.column.presentation
                || column.selectedMemberIndex !== sourceSnapshot.selectedMemberIndex) {
            return false;
        }
        for (let index = 0; index < column.members.length; index += 1) {
            if (column.members[index].windowId !== sourceSnapshot.records[index].windowId) {
                return false;
            }
        }
        return true;
    }

    function solveColumnDropPreviewGeometry(prospective, snapshot) {
        const baseSnapshot = snapshot ? snapshot.baseSnapshot : null;
        if (!prospective || !baseSnapshot) {
            return null;
        }
        const outputGeometry = windowDropPreviewRect(baseSnapshot.screen.geometry);
        let workArea;
        try {
            workArea = windowDropPreviewRect(KWin.Workspace.clientArea(
                KWin.Workspace.MaximizeArea, baseSnapshot.screen, baseSnapshot.desktop));
        } catch (error) {
            return null;
        }
        const devicePixelRatio = Number(baseSnapshot.screen.devicePixelRatio);
        const viewportOffset = baseSnapshot.context ? Number(baseSnapshot.context.viewportOffset) : 0;
        const windowHeightBounds = windowDropPreviewHeightBounds(prospective.columns);
        const runtime = OverviewRuntime.DriftileOverview;
        if (!outputGeometry || !workArea || windowHeightBounds === null
                || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0
                || !Number.isFinite(viewportOffset) || !runtime
                || typeof runtime.planOverviewSpatialRowGeometry !== "function") {
            return null;
        }

        let plan;
        try {
            plan = runtime.planOverviewSpatialRowGeometry({
                activeColumnIndex: prospective.activeColumnIndex,
                alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,
                columns: prospective.columns,
                devicePixelRatio,
                gap: overviewGap,
                outputGeometry,
                viewportOffset,
                windowHeightBounds,
                workArea
            });
        } catch (error) {
            return null;
        }
        if (!windowDropPreviewGeometryPlanIsExact(plan, prospective)) {
            return null;
        }

        const plannedColumn = plan.columnFrames[prospective.movedColumnIndex];
        const sourceColumn = prospective.columns[prospective.movedColumnIndex];
        if (!plannedColumn || !sourceColumn || plannedColumn.columnIndex !== prospective.movedColumnIndex
                || !Number.isFinite(plannedColumn.contentX) || !Number.isFinite(plannedColumn.width)
                || plannedColumn.width <= 0) {
            return null;
        }
        const columnFrame = Object.freeze({
            height: projectedViewportHeight,
            width: plannedColumn.width * projectionScale,
            x: viewportOriginX
                + (plan.dimensions.viewportInsetX + plannedColumn.contentX - plan.camera.base) * projectionScale,
            y: viewportOriginY
        });
        if (!windowDropPreviewFrameIsRenderable(columnFrame, baseSnapshot)) {
            return null;
        }

        const memberFrames = [];
        for (const frame of plan.windowFrames) {
            if (frame.columnIndex !== prospective.movedColumnIndex
                    || sourceColumn.presentation === "tabbed"
                    && frame.memberIndex !== sourceColumn.selectedMemberIndex) {
                continue;
            }
            const projected = Object.freeze({
                height: frame.height * projectionScale,
                width: frame.width * projectionScale,
                windowId: frame.windowId,
                x: viewportOriginX + (frame.x - plan.camera.base) * projectionScale,
                y: viewportOriginY + frame.y * projectionScale
            });
            if (!windowDropPreviewFrameIsRenderable(projected, baseSnapshot)) {
                return null;
            }
            memberFrames.push(projected);
        }
        const expectedVisibleMembers = sourceColumn.presentation === "tabbed"
            ? 1 : sourceColumn.members.length;
        if (memberFrames.length !== expectedVisibleMembers) {
            return null;
        }
        Object.freeze(memberFrames);
        return Object.freeze({ columnFrame, memberFrames });
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
            const preview = planWindowDropPreview(source, target, snapshot);
            if (!snapshot || !target || !preview || !windowDropSourceWorkspaceRelationIsExact(source)) {
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
            windowDropHoverPreview = preview;
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

        const target = hitWindowDropPlannerSnapshot(windowDropHoverSnapshot, localPosition,
                                                    windowDropHoverTarget);
        if (!target) {
            clearWindowDropHover();
            return false;
        }

        if (windowDropHoverTarget !== target) {
            const preview = planWindowDropPreview(source, target, windowDropHoverSnapshot);
            if (!preview) {
                clearWindowDropHover();
                return false;
            }
            windowDropHoverTarget = target;
            windowDropHoverPreview = preview;
        }
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
        windowDropHoverPreview = null;
        windowDropHoverCrossWorkspace = false;
    }

    function windowDropHoverOwnershipIsValid() {
        return windowDropHoverOwnershipMatches(windowDropHoverSource)
                && windowDropIsValid(windowDropHoverSource, ["driftile-window"]);
    }

    function windowDropHoverOwnershipMatches(source) {
        try {
            const candidate = source ? source.candidate : null;
            const dragSnapshotIsExact = windowDropSourceDragSnapshotIsExact(source);
            const dragEligibilityIsCompatible = source
                && (source.dragEligible === true || dragSnapshotIsExact);
            return windowDropHoverOwned && source && source === windowDropHoverSource && candidate
                    && typeof source.windowId === "string" && source.windowId.length > 0
                    && source.windowId === windowDropHoverSourceWindowId
                    && candidate.internalId !== undefined && candidate.internalId !== null
                    && String(candidate.internalId) === windowDropHoverSourceWindowId
                    && source.spatialDragLifecycleActive === true
                    && dragEligibilityIsCompatible
                    && source.minimizedWindow !== true && source.sourceScreen === screen
                    && dragSnapshotIsExact
                    && windowDropSourceWorkspaceRelationIsExact(source)
                    && windowDropHoverCrossWorkspace === windowDropSourceTargetsDifferentWorkspace(source)
                    && windowDropHoverDesktop === desktop && windowDropHoverDesktopId === desktopId
                    && windowDropHoverScreen === screen && windowDropTargetIsExact()
                    && windowDropPlannerSnapshotIsExact(windowDropHoverSnapshot)
                    && windowDropPlannerTargetMatchesSnapshot(windowDropHoverTarget, windowDropHoverSnapshot)
                    && windowDropPreviewIsExact(windowDropHoverPreview, source,
                                                windowDropHoverTarget, windowDropHoverSnapshot);
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
            const activityId = overviewActivityId;
            const cardWidth = Number(width);
            const cardHeight = Number(height);
            if (!indexedListHasBoundedLength(expectedColumns, 0, 512)
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
                if (!column || !indexedListHasBoundedLength(members, 1, 256)
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
                    || overviewActivityId !== activityId) {
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
                    && snapshot.activityId === overviewActivityId
                    && snapshot.cardWidth === Number(width) && snapshot.cardHeight === Number(height)
                    && snapshot.contextColumnCount === snapshot.columns.length;
        } catch (error) {
            return false;
        }
    }

    function hitWindowDropPlannerSnapshot(snapshot, localPosition, previousTarget = null) {
        try {
            if (!windowDropPlannerSnapshotIsExact(snapshot)
                    || !spatialDragScenePointIsFinite(localPosition)) {
                return null;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.hitTestOverviewSpatialWindowDrop !== "function") {
                return null;
            }
            const previousTargetIsExact = previousTarget !== null
                && windowDropPlannerTargetMatchesSnapshot(previousTarget, snapshot);
            const target = previousTargetIsExact
                && typeof runtime.hitTestOverviewSpatialWindowDropWithHysteresis === "function"
                ? runtime.hitTestOverviewSpatialWindowDropWithHysteresis(
                      snapshot.plan, localPosition, previousTarget)
                : runtime.hitTestOverviewSpatialWindowDrop(snapshot.plan, localPosition);
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

    function captureWindowDropBasisFingerprint(source, target) {
        try {
            const sourceSnapshot = source && source.scope === "column"
                ? source.columnDragSnapshot : source ? source.windowDragSnapshot : null;
            if (!sourceSnapshot || !target || typeof spatialDropBasisProvider !== "function") {
                return null;
            }
            const canonicalSource = {
                activityId: sourceSnapshot.activityId,
                desktopId: sourceSnapshot.desktopId,
                outputId: sourceSnapshot.outputId,
                scope: source && source.scope === "column" ? "column" : "window",
                windowId: source && source.scope === "column"
                    ? sourceSnapshot.selectedWindowId : sourceSnapshot.windowId
            };
            let canonicalTarget = null;
            if (target.kind === "empty-row") {
                canonicalTarget = {
                    activityId: target.activityId,
                    desktopId: target.desktopId,
                    kind: target.kind,
                    outputId: target.outputId
                };
            } else if (target.kind === "column-boundary" || target.kind === "stack-insertion") {
                canonicalTarget = {
                    activityId: target.activityId,
                    desktopId: target.desktopId,
                    kind: target.kind,
                    outputId: target.outputId,
                    position: target.position,
                    targetWindowId: target.targetWindowId
                };
            }
            const fingerprint = canonicalTarget
                ? spatialDropBasisProvider(canonicalSource, canonicalTarget) : null;
            return typeof fingerprint === "string" && /^[0-9a-f]{64}$/.test(fingerprint)
                ? fingerprint : null;
        } catch (error) {
            return null;
        }
    }

    function planWindowDropPreview(source, target, snapshot) {
        try {
            if (!windowDropPlannerTargetIsExact(target, snapshot)
                    || !snapshot.previewFrames || !Object.isFrozen(snapshot.previewFrames)) {
                return null;
            }

            const prospective = buildWindowDropPreviewColumns(source, target, snapshot);
            const geometry = prospective
                ? solveWindowDropPreviewGeometry(prospective, snapshot) : null;
            const basisFingerprint = geometry
                ? captureWindowDropBasisFingerprint(source, target) : null;
            if (!geometry || basisFingerprint === null) {
                return null;
            }
            const surface = geometry.surface;
            if (target.kind === "empty-row") {
                return Object.freeze({
                    affectedFrames: geometry.affectedFrames,
                    basisFingerprint,
                    kind: geometry.noop ? "noop" : target.kind,
                    marker: null,
                    noop: geometry.noop,
                    snapshot,
                    source,
                    sourceWindowId: prospective.sourceWindowId,
                    surface,
                    target
                });
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
                const marker = Object.freeze({
                    height: thickness,
                    width: frame.width,
                    x: frame.x,
                    y: target.position === "before" ? frame.y : frame.y + frame.height - thickness
                });
                return windowDropPreviewFrameIsBounded(marker, snapshot)
                    ? Object.freeze({
                          affectedFrames: geometry.affectedFrames,
                          basisFingerprint,
                          kind: geometry.noop ? "noop" : target.kind,
                          marker: geometry.noop ? null : marker,
                          noop: geometry.noop,
                          snapshot,
                          source,
                          sourceWindowId: prospective.sourceWindowId,
                          surface,
                          target
                      }) : null;
            }

            if (target.kind !== "column-boundary") {
                return null;
            }

            const frame = frames.columnFrame;
            const thickness = Math.max(2, Math.min(6, frame.width, frame.height));
            const marker = Object.freeze({
                height: frame.height,
                width: thickness,
                x: target.position === "before" ? frame.x : frame.x + frame.width - thickness,
                y: frame.y
            });
            return windowDropPreviewFrameIsBounded(marker, snapshot)
                ? Object.freeze({
                      affectedFrames: geometry.affectedFrames,
                      basisFingerprint,
                      kind: geometry.noop ? "noop" : target.kind,
                      marker: geometry.noop ? null : marker,
                      noop: geometry.noop,
                      snapshot,
                      source,
                      sourceWindowId: prospective.sourceWindowId,
                      surface,
                      target
                  }) : null;
        } catch (error) {
            return null;
        }
    }

    function solveWindowDropPreviewGeometry(prospective, snapshot) {
        if (!prospective || typeof prospective.noop !== "boolean") {
            return null;
        }
        if (prospective.noop) {
            const currentFrames = snapshot.previewFrames[prospective.sourceWindowId];
            const currentFrame = currentFrames ? currentFrames.memberFrame : null;
            if (!currentFrame || !windowDropPreviewFrameIsBounded(currentFrame, snapshot)) {
                return null;
            }
            const sourceFrame = Object.freeze({
                height: Number(currentFrame.height),
                width: Number(currentFrame.width),
                windowId: prospective.sourceWindowId,
                x: Number(currentFrame.x),
                y: Number(currentFrame.y)
            });
            const affectedFrames = Object.freeze([sourceFrame]);
            return Object.freeze({ affectedFrames, noop: true, surface: sourceFrame });
        }

        const outputGeometry = windowDropPreviewRect(snapshot.screen.geometry);
        let workArea;
        try {
            workArea = windowDropPreviewRect(KWin.Workspace.clientArea(
                KWin.Workspace.MaximizeArea, snapshot.screen, snapshot.desktop));
        } catch (error) {
            return null;
        }
        const devicePixelRatio = Number(snapshot.screen.devicePixelRatio);
        const viewportOffset = snapshot.context ? Number(snapshot.context.viewportOffset) : 0;
        const windowHeightBounds = windowDropPreviewHeightBounds(prospective.columns);
        const runtime = OverviewRuntime.DriftileOverview;
        if (!outputGeometry || !workArea || windowHeightBounds === null
                || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0
                || !Number.isFinite(viewportOffset) || !Number.isFinite(overviewGap)
                || overviewGap < 0 || !runtime
                || typeof runtime.planOverviewSpatialRowGeometry !== "function") {
            return null;
        }

        let plan;
        try {
            plan = runtime.planOverviewSpatialRowGeometry({
                activeColumnIndex: prospective.activeColumnIndex,
                alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,
                columns: prospective.columns,
                devicePixelRatio,
                gap: overviewGap,
                outputGeometry,
                viewportOffset,
                windowHeightBounds,
                workArea
            });
        } catch (error) {
            return null;
        }
        if (!windowDropPreviewGeometryPlanIsExact(plan, prospective)) {
            return null;
        }

        let sourceFrame = null;
        const affectedFrames = [];
        const seenWindowIds = Object.create(null);
        for (const frame of plan.windowFrames) {
            const column = Number.isInteger(frame.columnIndex)
                && frame.columnIndex >= 0 && frame.columnIndex < prospective.columns.length
                ? prospective.columns[frame.columnIndex] : null;
            const selected = column && (column.presentation !== "tabbed"
                || frame.memberIndex === column.selectedMemberIndex);
            if (!selected || typeof frame.windowId !== "string" || frame.windowId.length === 0
                    || seenWindowIds[frame.windowId] === true
                    || !projectionGeometryScalarsAreValid(frame.x, frame.y, frame.width, frame.height)) {
                continue;
            }
            seenWindowIds[frame.windowId] = true;
            const projected = Object.freeze({
                height: frame.height * projectionScale,
                width: frame.width * projectionScale,
                windowId: frame.windowId,
                x: viewportOriginX + (frame.x - plan.camera.base) * projectionScale,
                y: viewportOriginY + frame.y * projectionScale
            });
            if (!windowDropPreviewFrameIsRenderable(projected, snapshot)) {
                if (frame.windowId === prospective.sourceWindowId) {
                    return null;
                }
                continue;
            }
            if (frame.windowId === prospective.sourceWindowId) {
                if (sourceFrame !== null) {
                    return null;
                }
                sourceFrame = projected;
            }

            const previousFrames = snapshot.previewFrames[frame.windowId];
            const previousFrame = previousFrames ? previousFrames.memberFrame : null;
            if (frame.windowId === prospective.sourceWindowId
                    || !windowDropPreviewFramesMatch(projected, previousFrame)) {
                affectedFrames.push(projected);
            }
        }
        if (!sourceFrame || affectedFrames.length === 0 || affectedFrames.length > 4096) {
            return null;
        }
        let sourceFrameCount = 0;
        for (const frame of affectedFrames) {
            if (frame.windowId === prospective.sourceWindowId) {
                sourceFrameCount += 1;
            }
        }
        if (sourceFrameCount !== 1 || prospective.noop && affectedFrames.length !== 1) {
            return null;
        }
        Object.freeze(affectedFrames);
        return Object.freeze({
            affectedFrames,
            noop: prospective.noop,
            surface: sourceFrame
        });
    }

    function windowDropPreviewFramesMatch(first, second) {
        return first && second && Number(first.x) === Number(second.x)
            && Number(first.y) === Number(second.y)
            && Number(first.width) === Number(second.width)
            && Number(first.height) === Number(second.height);
    }

    function windowDropPreviewIsExact(preview, source, target, snapshot) {
        try {
            if (!preview || !Object.isFrozen(preview) || preview.source !== source
                    || preview.target !== target || preview.snapshot !== snapshot
                    || typeof preview.basisFingerprint !== "string"
                    || !/^[0-9a-f]{64}$/.test(preview.basisFingerprint)
                    || typeof preview.noop !== "boolean"
                    || typeof preview.sourceWindowId !== "string"
                    || preview.sourceWindowId.length === 0 || source.windowId !== preview.sourceWindowId
                    || !windowDropPlannerTargetIsExact(target, snapshot)
                    || !windowDropPreviewFrameIsRenderable(preview.surface, snapshot)
                    || !Object.isFrozen(preview.surface)
                    || !indexedListHasBoundedLength(preview.affectedFrames, 1, 4096)
                    || !Object.isFrozen(preview.affectedFrames)
                    || preview.kind !== (preview.noop ? "noop" : target.kind)
                    || preview.noop && (preview.marker !== null || preview.affectedFrames.length !== 1)
                    || preview.marker !== null
                    && (!Object.isFrozen(preview.marker)
                        || !windowDropPreviewFrameIsBounded(preview.marker, snapshot))) {
                return false;
            }

            const seenWindowIds = Object.create(null);
            let sourceFrameCount = 0;
            for (const frame of preview.affectedFrames) {
                if (!frame || !Object.isFrozen(frame) || typeof frame.windowId !== "string"
                        || frame.windowId.length === 0 || seenWindowIds[frame.windowId] === true
                        || !windowDropPreviewFrameIsRenderable(frame, snapshot)) {
                    return false;
                }
                seenWindowIds[frame.windowId] = true;
                if (frame.windowId === preview.sourceWindowId) {
                    sourceFrameCount += 1;
                    if (!windowDropPreviewFramesMatch(frame, preview.surface)) {
                        return false;
                    }
                }
            }
            return sourceFrameCount === 1;
        } catch (error) {
            return false;
        }
    }

    function buildWindowDropPreviewColumns(source, target, snapshot) {
        const sourceState = windowDropPreviewSourceState(source);
        if (!sourceState || !target || !snapshot
                || !indexedListHasBoundedLength(snapshot.columns, 0, 512)) {
            return null;
        }

        const sameContext = sourceState.card === card;
        if (sameContext !== (sourceState.context === snapshot.context)
                || (sameContext && sourceState.context.columns !== snapshot.columns)) {
            return null;
        }
        const columns = [];
        for (const column of snapshot.columns) {
            const clone = cloneWindowDropPreviewColumn(column);
            if (!clone) {
                return null;
            }
            columns.push(clone);
        }
        if (!sameContext && windowDropPreviewLocation(columns, sourceState.windowId) !== null) {
            return null;
        }

        if (target.kind === "empty-row") {
            if (sameContext || columns.length !== 0) {
                return null;
            }
            columns.push(windowDropPreviewSingletonColumn(sourceState));
            return {
                activeColumnIndex: 0,
                columns,
                noop: false,
                sourceWindowId: sourceState.windowId
            };
        }

        if (target.kind === "stack-insertion") {
            return buildWindowDropStackPreviewColumns(sourceState, target, columns, sameContext);
        }
        if (target.kind === "column-boundary") {
            return buildWindowDropBoundaryPreviewColumns(sourceState, target, columns, sameContext);
        }
        return null;
    }

    function buildWindowDropStackPreviewColumns(sourceState, target, columns, sameContext) {
        if (target.targetWindowId === sourceState.windowId) {
            if (!sameContext) {
                return null;
            }
            const location = windowDropPreviewLocation(columns, sourceState.windowId);
            if (!location) {
                return null;
            }
            return {
                activeColumnIndex: location.columnIndex,
                columns,
                noop: true,
                sourceWindowId: sourceState.windowId
            };
        }

        let sourceLocation = null;
        if (sameContext) {
            sourceLocation = windowDropPreviewLocation(columns, sourceState.windowId);
            if (!sourceLocation) {
                return null;
            }
        }

        let targetLocation = windowDropPreviewLocation(columns, target.targetWindowId);
        if (!targetLocation) {
            return null;
        }
        if (sameContext && sourceLocation.columnIndex === targetLocation.columnIndex) {
            const column = columns[sourceLocation.columnIndex];
            const moved = column.members.splice(sourceLocation.memberIndex, 1)[0];
            if (!moved) {
                return null;
            }
            const targetAfterRemoval = targetLocation.memberIndex > sourceLocation.memberIndex
                ? targetLocation.memberIndex - 1 : targetLocation.memberIndex;
            const insertionIndex = targetAfterRemoval + (target.position === "after" ? 1 : 0);
            if (insertionIndex === sourceLocation.memberIndex) {
                column.members.splice(sourceLocation.memberIndex, 0, moved);
                column.selectedMemberIndex = sourceLocation.memberIndex;
                return {
                    activeColumnIndex: sourceLocation.columnIndex,
                    columns,
                    noop: true,
                    sourceWindowId: sourceState.windowId
                };
            }
            column.members.splice(insertionIndex, 0, moved);
            column.selectedMemberIndex = insertionIndex;
            return {
                activeColumnIndex: sourceLocation.columnIndex,
                columns,
                noop: false,
                sourceWindowId: sourceState.windowId
            };
        }

        if (sameContext) {
            const retained = retainWindowDropPreviewSource(
                columns[sourceLocation.columnIndex], sourceLocation.memberIndex);
            if (retained) {
                columns[sourceLocation.columnIndex] = retained;
            } else {
                columns.splice(sourceLocation.columnIndex, 1);
            }
            targetLocation = windowDropPreviewLocation(columns, target.targetWindowId);
            if (!targetLocation) {
                return null;
            }
        }

        const targetColumn = columns[targetLocation.columnIndex];
        const explicitHeights = windowDropPreviewColumnUsesExplicitHeights(targetColumn);
        const insertionIndex = targetLocation.memberIndex + (target.position === "after" ? 1 : 0);
        targetColumn.members.splice(insertionIndex, 0,
                                    automaticWindowDropPreviewMember(sourceState.member,
                                                                     explicitHeights));
        targetColumn.selectedMemberIndex = insertionIndex;
        return {
            activeColumnIndex: targetLocation.columnIndex,
            columns,
            noop: false,
            sourceWindowId: sourceState.windowId
        };
    }

    function buildWindowDropBoundaryPreviewColumns(sourceState, target, columns, sameContext) {
        let movedColumn = null;
        let originalSourceColumnIndex = -1;
        let retainedSourceAnchorIndex = -1;
        if (sameContext) {
            const sourceLocation = windowDropPreviewLocation(columns, sourceState.windowId);
            if (!sourceLocation) {
                return null;
            }
            originalSourceColumnIndex = sourceLocation.columnIndex;
            if (columns[sourceLocation.columnIndex].members.length === 1) {
                if (target.targetWindowId === sourceState.windowId) {
                    return {
                        activeColumnIndex: sourceLocation.columnIndex,
                        columns,
                        noop: true,
                        sourceWindowId: sourceState.windowId
                    };
                }
                movedColumn = columns.splice(sourceLocation.columnIndex, 1)[0];
            } else {
                const retained = retainWindowDropPreviewSource(
                    columns[sourceLocation.columnIndex], sourceLocation.memberIndex);
                if (!retained) {
                    return null;
                }
                columns[sourceLocation.columnIndex] = retained;
                if (target.targetWindowId === sourceState.windowId) {
                    retainedSourceAnchorIndex = sourceLocation.columnIndex;
                }
            }
        }

        let targetColumnIndex = retainedSourceAnchorIndex;
        if (targetColumnIndex < 0) {
            const targetLocation = windowDropPreviewLocation(columns, target.targetWindowId);
            if (!targetLocation) {
                return null;
            }
            targetColumnIndex = targetLocation.columnIndex;
        }
        const insertionIndex = targetColumnIndex + (target.position === "after" ? 1 : 0);
        if (movedColumn && insertionIndex === originalSourceColumnIndex) {
            columns.splice(originalSourceColumnIndex, 0, movedColumn);
            return {
                activeColumnIndex: originalSourceColumnIndex,
                columns,
                noop: true,
                sourceWindowId: sourceState.windowId
            };
        }
        columns.splice(insertionIndex, 0, movedColumn || windowDropPreviewSingletonColumn(sourceState));
        return {
            activeColumnIndex: insertionIndex,
            columns,
            noop: false,
            sourceWindowId: sourceState.windowId
        };
    }

    function windowDropPreviewSourceState(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            const snapshot = source ? source.windowDragSnapshot : null;
            if (!sourceCard || typeof sourceCard.ownedWindowDragSnapshotIsExact !== "function"
                    || !sourceCard.ownedWindowDragSnapshotIsExact(source)
                    || !snapshot || !Object.isFrozen(snapshot)) {
                return null;
            }
            return {
                card: sourceCard,
                column: snapshot.column,
                context: snapshot.context,
                member: snapshot.member,
                windowId: snapshot.windowId
            };
        } catch (error) {
            return null;
        }
    }

    function cloneWindowDropPreviewColumn(column) {
        if (!column || !indexedListHasBoundedLength(column.members, 1, 256)
                || !Number.isInteger(column.selectedMemberIndex)
                || column.selectedMemberIndex < 0 || column.selectedMemberIndex >= column.members.length
                || (column.presentation !== "stacked" && column.presentation !== "tabbed")
                || !column.width) {
            return null;
        }
        const explicitHeights = windowDropPreviewColumnUsesExplicitHeights(column);
        const members = [];
        for (const member of column.members) {
            const clone = cloneWindowDropPreviewMember(member, explicitHeights);
            if (!clone) {
                return null;
            }
            members.push(clone);
        }
        return {
            members,
            presentation: column.presentation,
            selectedMemberIndex: column.selectedMemberIndex,
            width: column.width
        };
    }

    function cloneWindowDropPreviewMember(member, forceExplicitHeight) {
        if (!member || typeof member.windowId !== "string" || member.windowId.length === 0) {
            return null;
        }
        const clone = { windowId: member.windowId };
        if (member.height !== undefined) {
            clone.height = member.height;
        } else if (forceExplicitHeight) {
            clone.height = { kind: "auto", weight: 1 };
        }
        if (member.heightBounds !== undefined) {
            clone.heightBounds = member.heightBounds;
        }
        return clone;
    }

    function automaticWindowDropPreviewMember(member, explicitHeight) {
        const clone = cloneWindowDropPreviewMember(member, false);
        if (!clone) {
            return null;
        }
        delete clone.height;
        if (explicitHeight) {
            clone.height = { kind: "auto", weight: 1 };
        }
        return clone;
    }

    function windowDropPreviewSingletonColumn(sourceState) {
        return {
            members: [automaticWindowDropPreviewMember(sourceState.member, false)],
            // Presentation is geometry-neutral for this one-member preview; runtime policy owns the commit value.
            presentation: sourceState.column.presentation,
            selectedMemberIndex: 0,
            width: sourceState.column.width
        };
    }

    function retainWindowDropPreviewSource(column, memberIndex) {
        if (!column || !indexedListHasBoundedLength(column.members, 2, 256)
                || !Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex >= column.members.length) {
            return null;
        }
        const members = column.members.slice();
        members.splice(memberIndex, 1);
        const previousSelection = column.selectedMemberIndex;
        const selectedMemberIndex = previousSelection < memberIndex
            ? previousSelection
            : previousSelection > memberIndex
              ? previousSelection - 1 : Math.min(memberIndex, members.length - 1);
        return {
            members,
            presentation: column.presentation,
            selectedMemberIndex,
            width: column.width
        };
    }

    function windowDropPreviewLocation(columns, windowId) {
        let result = null;
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
            const members = columns[columnIndex].members;
            for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
                if (members[memberIndex].windowId !== windowId) {
                    continue;
                }
                if (result !== null) {
                    return null;
                }
                result = { columnIndex, memberIndex };
            }
        }
        return result;
    }

    function windowDropPreviewColumnUsesExplicitHeights(column) {
        if (!column || !indexedListHasBoundedLength(column.members, 1, 256)) {
            return false;
        }
        for (let index = 0; index < column.members.length; index += 1) {
            const member = column.members[index];
            if (member && member.height !== undefined) {
                return true;
            }
        }
        return false;
    }

    function windowDropPreviewHeightBounds(columns) {
        const bounds = [];
        const seen = Object.create(null);
        for (const column of columns) {
            if (!windowDropPreviewColumnUsesExplicitHeights(column)) {
                continue;
            }
            for (const member of column.members) {
                const value = member ? member.heightBounds : null;
                if (!member || typeof member.windowId !== "string" || member.windowId.length === 0
                        || seen[member.windowId] === true || !value
                        || !Number.isFinite(value.decorationHeight) || value.decorationHeight < 0
                        || !Number.isFinite(value.minimumClientHeight) || value.minimumClientHeight < 0
                        || (value.maximumClientHeight !== Number.POSITIVE_INFINITY
                            && (!Number.isFinite(value.maximumClientHeight)
                                || value.maximumClientHeight <= 0
                                || value.maximumClientHeight < value.minimumClientHeight))) {
                    return null;
                }
                seen[member.windowId] = true;
                bounds.push({
                    decorationHeight: value.decorationHeight,
                    maximumClientHeight: value.maximumClientHeight,
                    minimumClientHeight: value.minimumClientHeight,
                    windowId: member.windowId
                });
            }
        }
        return bounds;
    }

    function windowDropPreviewGeometryPlanIsExact(plan, prospective) {
        if (!plan || !Object.isFrozen(plan) || !plan.camera || !Object.isFrozen(plan.camera)
                || !Number.isFinite(plan.camera.base) || !Number.isFinite(plan.camera.minimum)
                || !Number.isFinite(plan.camera.maximum) || plan.camera.minimum > plan.camera.base
                || plan.camera.base > plan.camera.maximum
                || !Array.isArray(plan.columnFrames) || !Object.isFrozen(plan.columnFrames)
                || !Array.isArray(plan.windowFrames) || !Object.isFrozen(plan.windowFrames)
                || plan.columnFrames.length !== prospective.columns.length) {
            return false;
        }
        let expectedWindowCount = 0;
        for (const column of prospective.columns) {
            expectedWindowCount += column.members.length;
        }
        return plan.windowFrames.length === expectedWindowCount;
    }

    function windowDropPreviewRect(candidate) {
        if (!candidate) {
            return null;
        }
        const frame = {
            height: Number(candidate.height),
            width: Number(candidate.width),
            x: Number(candidate.x),
            y: Number(candidate.y)
        };
        return projectionGeometryScalarsAreValid(frame.x, frame.y, frame.width, frame.height)
            ? frame : null;
    }

    function windowDropPreviewFrameIsRenderable(frame, snapshot) {
        return frame && snapshot
                && Number.isFinite(frame.x) && Number.isFinite(frame.y)
                && Number.isFinite(frame.width) && Number.isFinite(frame.height)
                && frame.width > 0 && frame.height > 0
                && frame.x < snapshot.cardWidth && frame.y < snapshot.cardHeight
                && frame.x + frame.width > 0 && frame.y + frame.height > 0;
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
            const activityId = overviewActivityId;
            const contextIsExact = context === null
                ? indexedListHasBoundedLength(columns, 0, 0)
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
            const sourceCard = source ? source.sourceCard : null;
            return Boolean(sourceCard
                && typeof sourceCard.ownedWindowDropTiledPresentationIsExact === "function"
                && sourceCard.ownedWindowDropTiledPresentationIsExact(source));
        } catch (error) {
            return false;
        }
    }

    function windowDropSourceDragSnapshotIsExact(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            return Boolean(sourceCard
                && typeof sourceCard.ownedWindowDragSnapshotIsExact === "function"
                && sourceCard.ownedWindowDragSnapshotIsExact(source));
        } catch (error) {
            return false;
        }
    }

    function ownedWindowDropTiledPresentationIsExact(source) {
        try {
            const windowId = source ? source.windowId : "";
            const tiled = source ? source.tiledPresentation : null;
            const frame = source ? source.frame : null;
            return Boolean(source && source.sourceCard === card && source.sourceDesktop === desktop
                    && source.sourceDesktopId === desktopId && source.sourceScreen === screen
                    && source.sourceCard.context === context && context
                    && context.columns === columns && spatialDragSourceIsOwned(source)
                    && typeof windowId === "string" && windowId.length > 0 && tiled
                    && tiledPresentations[windowId] === tiled && tiled.selected === true
                    && Number.isInteger(tiled.columnIndex) && tiled.columnIndex >= 0
                    && Number.isInteger(tiled.memberIndex) && tiled.memberIndex >= 0
                    && frame && frame.floating === false);
        } catch (error) {
            return false;
        }
    }

    function windowDropIsValid(source, keys) {
        try {
            return keys && typeof keys.indexOf === "function" && keys.indexOf("driftile-window") >= 0
                    && windowCanDrag(source)
                    && source.spatialDragLifecycleActive === true && windowDropTargetIsExact()
                    && windowDropSourceDragSnapshotIsExact(source)
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
                    && source.spatialDragLifecycleActive === true
                    && source.minimizedWindow !== true && windowDropTargetIsExact()
                    && windowDropSourceDragSnapshotIsExact(source)
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

    function navigationVisualForPresentation(presentation) {
        try {
            if (!presentation || presentation.matchesSearch !== true
                    || !windowCanNavigate(presentation)) {
                return null;
            }
            switch (presentation.primaryVisualKind) {
            case "thumbnail":
                return presentation.minimizedWindow !== true
                    && presentation.selectedThumbnail === true
                    && presentation.thumbnailTarget && presentation.thumbnailTarget.visible
                    ? presentation.thumbnailTarget : null;
            case "placeholder":
                return presentation.minimizedWindow === true
                    && presentation.selectedThumbnail === true
                    && presentation.minimizedPlaceholderTarget
                    && presentation.minimizedPlaceholderTarget.visible
                    ? presentation.minimizedPlaceholderTarget : null;
            case "tab":
                return presentation.tabTarget && presentation.tabTarget.visible
                    && presentation.tabTarget.activationEligible === true
                    ? presentation.tabTarget : null;
            default:
                return null;
            }
        } catch (error) {
            return null;
        }
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

    function buildTabRailPlans() {
        const plans = [];
        try {
            if (!context || context.columns !== columns || !indexedListHasBoundedLength(columns, 0, 512)
                    || !viewport || !Number.isFinite(viewport.width) || viewport.width <= 0
                    || !Number.isFinite(viewport.height) || viewport.height <= 0) {
                return Object.freeze(plans);
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.planOverviewTabRail !== "function") {
                return Object.freeze(plans);
            }

            for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
                const column = columns[columnIndex];
                if (!column || column.presentation !== "tabbed"
                        || !indexedListHasBoundedLength(column.members, 2, 256)) {
                    plans.push(null);
                    continue;
                }
                if (!Number.isInteger(column.selectedMemberIndex)
                        || column.selectedMemberIndex < 0
                        || column.selectedMemberIndex >= column.members.length) {
                    plans.push(null);
                    continue;
                }

                const sourceFrame = tabRailColumnFrame(column, columnIndex);
                if (sourceFrame === null) {
                    plans.push(null);
                    continue;
                }

                const planned = runtime.planOverviewTabRail({
                    columnFrame: sourceFrame,
                    memberCount: column.members.length,
                    minimumY: tabRailMinimumY,
                    presentation: "tabbed",
                    selectedIndex: column.selectedMemberIndex,
                    viewport: {
                        height: viewport.height,
                        width: viewport.width,
                        x: 0,
                        y: 0
                    }
                });
                plans.push(tabRailPlanIsExact(planned, column, columnIndex, sourceFrame)
                           ? planned : null);
            }

            return Object.freeze(plans);
        } catch (error) {
            return Object.freeze([]);
        }
    }

    function tabRailColumnFrame(column, columnIndex) {
        try {
            if (!column || !Number.isInteger(columnIndex) || columnIndex < 0
                    || columnIndex >= columns.length || columns[columnIndex] !== column
                    || column.presentation !== "tabbed"
                    || !indexedListHasBoundedLength(column.members, 2, 256)
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0
                    || column.selectedMemberIndex >= column.members.length) {
                return null;
            }

            const selectedMember = column.members[column.selectedMemberIndex];
            const selectedWindowId = selectedMember ? selectedMember.windowId : "";
            const tiled = typeof selectedWindowId === "string" && selectedWindowId.length > 0
                ? tiledPresentations[selectedWindowId] : null;
            if (!tiled || tiledPresentations[selectedWindowId] !== tiled
                    || tiled.columnIndex !== columnIndex
                    || tiled.memberIndex !== column.selectedMemberIndex || tiled.selected !== true
                    || !tiled.thumbnailFrame
                    || !projectionGeometryScalarsAreValid(tiled.thumbnailFrame.x,
                                                          tiled.thumbnailFrame.y,
                                                          tiled.thumbnailFrame.width,
                                                          tiled.thumbnailFrame.height)) {
                return null;
            }

            const livePlan = spatialLiveColumnPlan(columnIndex);
            let selectedFrame = tiled.thumbnailFrame;
            let shellFrame = columnFrame(columnIndex);
            if (livePlan !== null) {
                if (!spatialLiveColumnPlanIsExact(livePlan, columnIndex)) {
                    return null;
                }
                selectedFrame = livePlan.memberFrames[column.selectedMemberIndex];
                shellFrame = livePlan;
            }
            if (!selectedFrame
                    || !projectionGeometryScalarsAreValid(shellFrame.x, selectedFrame.y,
                                                          shellFrame.width, selectedFrame.height)) {
                return null;
            }

            return {
                height: selectedFrame.height,
                width: shellFrame.width,
                x: shellFrame.x,
                y: selectedFrame.y
            };
        } catch (error) {
            return null;
        }
    }

    function tabRailPlanIsExact(plan, column, columnIndex, sourceFrame) {
        try {
            if (!plan || Array.isArray(plan) || !Object.isFrozen(plan)
                    || !Object.isFrozen(plan.railFrame) || !Array.isArray(plan.chipFrames)
                    || !Object.isFrozen(plan.chipFrames) || !column
                    || !Number.isInteger(columnIndex) || columnIndex < 0
                    || columnIndex >= columns.length || columns[columnIndex] !== column
                    || column.presentation !== "tabbed"
                    || !indexedListHasBoundedLength(column.members, 2, 256)
                    || plan.chipFrames.length !== column.members.length
                    || !tabRailRectIsValid(sourceFrame) || !tabRailRectIsValid(plan.railFrame)) {
                return false;
            }

            const visibleLeft = Math.max(0, sourceFrame.x);
            const visibleTop = Math.max(0, sourceFrame.y);
            const availableTop = Math.max(visibleTop, tabRailMinimumY);
            const visibleRight = Math.min(viewport.width, sourceFrame.x + sourceFrame.width);
            const visibleBottom = Math.min(viewport.height, sourceFrame.y + sourceFrame.height);
            const rail = plan.railFrame;
            const epsilon = Math.max(1, viewport.width, viewport.height, Math.abs(rail.x),
                                     Math.abs(rail.y), rail.width, rail.height) * 0.000000001;
            if (visibleRight <= visibleLeft || visibleBottom <= visibleTop
                    || rail.x < visibleLeft - epsilon || rail.y < availableTop - epsilon
                    || rail.x + rail.width > visibleRight + epsilon
                    || rail.y + rail.height > visibleBottom + epsilon
                    || rail.height < 16 - epsilon || rail.height > 24 + epsilon) {
                return false;
            }

            let selectedCount = 0;
            let previousRight = rail.x;
            for (let memberIndex = 0; memberIndex < plan.chipFrames.length; memberIndex += 1) {
                const chip = plan.chipFrames[memberIndex];
                const member = column.members[memberIndex];
                if (!chip || Array.isArray(chip) || !Object.isFrozen(chip) || !member
                        || typeof member.windowId !== "string" || member.windowId.length === 0
                        || chip.memberIndex !== memberIndex
                        || chip.selected !== (memberIndex === column.selectedMemberIndex)
                        || !tabRailRectIsValid(chip)
                        || chip.width < 28 - epsilon || chip.width > 120 + epsilon
                        || Math.abs(chip.y - rail.y) > epsilon
                        || Math.abs(chip.height - rail.height) > epsilon
                        || chip.x < previousRight - epsilon || chip.x < rail.x - epsilon
                        || chip.x + chip.width > rail.x + rail.width + epsilon) {
                    return false;
                }
                if (chip.selected) {
                    selectedCount += 1;
                }
                previousRight = chip.x + chip.width;
            }

            const firstChip = plan.chipFrames[0];
            const lastChip = plan.chipFrames[plan.chipFrames.length - 1];
            return selectedCount === 1 && Math.abs(firstChip.x - rail.x) <= epsilon
                && Math.abs(lastChip.x + lastChip.width - (rail.x + rail.width)) <= epsilon;
        } catch (error) {
            return false;
        }
    }

    function tabRailRectIsValid(frame) {
        return frame && !Array.isArray(frame) && typeof frame === "object"
            && projectionGeometryScalarsAreValid(frame.x, frame.y, frame.width, frame.height);
    }

    function tabFrameForPresentation(tiled, expectedWindowId) {
        try {
            if (!tiled || typeof expectedWindowId !== "string" || expectedWindowId.length === 0
                    || tiledPresentations[expectedWindowId] !== tiled
                    || !Number.isInteger(tiled.columnIndex) || tiled.columnIndex < 0
                    || tiled.columnIndex >= columns.length || !Number.isInteger(tiled.memberIndex)
                    || !Object.isFrozen(tabRailPlans) || tiled.columnIndex >= tabRailPlans.length) {
                return null;
            }

            const column = columns[tiled.columnIndex];
            const member = column && column.members && tiled.memberIndex >= 0
                && tiled.memberIndex < column.members.length ? column.members[tiled.memberIndex] : null;
            const sourceFrame = tabRailColumnFrame(column, tiled.columnIndex);
            const plan = tabRailPlans[tiled.columnIndex];
            if (!member || member.windowId !== expectedWindowId || sourceFrame === null
                    || !tabRailPlanIsExact(plan, column, tiled.columnIndex, sourceFrame)) {
                return null;
            }

            return plan.chipFrames[tiled.memberIndex];
        } catch (error) {
            return null;
        }
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
