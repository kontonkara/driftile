import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

Rectangle {
    id: root

    color: "transparent"
    clip: true
    enabled: spatialPresentationVisible
    focus: spatialKeyboardInputEligible

    readonly property var sceneEffect: KWin.SceneView.effect
    readonly property var targetScreen: KWin.SceneView.screen
    readonly property var currentDesktop: typeof KWin.SceneView.currentDesktop !== "undefined"
        ? KWin.SceneView.currentDesktop
        : KWin.Workspace.currentDesktop
    readonly property var overviewModel: sceneEffect ? sceneEffect.overviewModel : null
    readonly property var overviewExitHandoffState: sceneEffect
        ? sceneEffect.overviewExitHandoffState : null
    readonly property var overviewExitHandoffCapture: overviewExitHandoffState
        && overviewExitHandoffState.capture ? overviewExitHandoffState.capture : null
    readonly property var overviewExitHandoffPromotion: sceneEffect
        ? sceneEffect.overviewExitHandoffPromotion : null
    readonly property bool spatialExitHandoffActive: overviewExitHandoffCapture
        && sceneEffect && sceneEffect.active === true
        && overviewExitHandoffCapture.sessionId === sceneEffect.activeSessionId
        && (overviewExitHandoffState.phase === "captured"
            || overviewExitHandoffState.phase === "promoted"
            || overviewExitHandoffState.phase === "fallback")
    readonly property bool showWindowLabels: sceneEffect && typeof sceneEffect.showWindowLabels === "boolean"
        ? sceneEffect.showWindowLabels
        : false
    readonly property bool showApplicationIdentity: sceneEffect
        && typeof sceneEffect.showApplicationIdentity === "boolean"
        ? sceneEffect.showApplicationIdentity
        : false
    readonly property bool showWindowCloseButtons: sceneEffect
        && typeof sceneEffect.showWindowCloseButtons === "boolean"
        ? sceneEffect.showWindowCloseButtons
        : false
    readonly property bool showWindowStateBadges: sceneEffect
        && typeof sceneEffect.showWindowStateBadges === "boolean"
        ? sceneEffect.showWindowStateBadges
        : false
    readonly property bool showDesktopNames: sceneEffect && typeof sceneEffect.showDesktopNames === "boolean"
        ? sceneEffect.showDesktopNames
        : false
    readonly property bool showApplicationIcons: sceneEffect
        && typeof sceneEffect.showApplicationIcons === "boolean"
        ? sceneEffect.showApplicationIcons
        : false
    readonly property var desktopSurfaceLifecycleEvent: validatedDesktopSurfaceLifecycleEvent()
    readonly property bool showOutputNames: sceneEffect && typeof sceneEffect.showOutputNames === "boolean"
        ? sceneEffect.showOutputNames
        : false
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
    readonly property int activeOverviewSessionId: sceneEffect
        && Number.isInteger(sceneEffect.activeSessionId) ? sceneEffect.activeSessionId : 0
    readonly property string activeOverviewActivityId: canonicalOverviewActivityId()
    readonly property int overviewContextGeneration: sceneEffect
        && Number.isInteger(sceneEffect.overviewTopologyGeneration)
        && sceneEffect.overviewTopologyGeneration > 0
        ? sceneEffect.overviewTopologyGeneration : 0
    readonly property bool overviewContextRefreshPending: sceneEffect
        && sceneEffect.overviewContextRefreshPending === true
    readonly property bool overviewContextModelExact: contextModelIsExact()
    readonly property var desktopIds: outputId.length > 0
        ? orderedDesktopIds(desktopTopologyRevision) : []
    readonly property int currentWorkspaceIndex: currentDesktop && currentDesktop.id !== undefined
        && currentDesktop.id !== null ? desktopIds.indexOf(String(currentDesktop.id)) : -1
    property int spatialExitFrozenWorkspaceIndex: -1
    property int spatialExitHandoffToken: 0
    property bool spatialExitRestoringCamera: false
    readonly property int spatialLayoutWorkspaceIndex: spatialExitHandoffActive
        && spatialExitFrozenWorkspaceIndex >= 0
        && spatialExitFrozenWorkspaceIndex < desktopIds.length
        ? spatialExitFrozenWorkspaceIndex : currentWorkspaceIndex
    readonly property string spatialPresentationDesktopId: spatialLayoutWorkspaceIndex >= 0
        && spatialLayoutWorkspaceIndex < desktopIds.length
        ? desktopIds[spatialLayoutWorkspaceIndex] : ""
    readonly property real configuredOverviewZoom: sceneEffect
        && Number.isFinite(sceneEffect.configuredOverviewZoom)
        ? sceneEffect.configuredOverviewZoom : 0.5
    readonly property real overviewZoom: sceneEffect && Number.isFinite(sceneEffect.overviewZoom)
        ? sceneEffect.overviewZoom : 0.5
    readonly property int overviewZoomRevision: sceneEffect
        && Number.isInteger(sceneEffect.overviewZoomRevision)
        ? sceneEffect.overviewZoomRevision : 0
    readonly property int overviewZoomInputStateRevision: sceneEffect
        && Number.isInteger(sceneEffect.overviewZoomInputStateRevision)
        ? sceneEffect.overviewZoomInputStateRevision : 0
    readonly property string overviewZoomGestureDirection: sceneEffect
        && typeof sceneEffect.overviewZoomGestureDirection === "string"
        ? sceneEffect.overviewZoomGestureDirection : ""
    readonly property int overviewZoomGestureSessionId: sceneEffect
        && Number.isInteger(sceneEffect.overviewZoomGestureSessionId)
        ? sceneEffect.overviewZoomGestureSessionId : 0
    readonly property bool overviewAlwaysCenterSingleColumn: sceneEffect
        && typeof sceneEffect.overviewAlwaysCenterSingleColumn === "boolean"
        ? sceneEffect.overviewAlwaysCenterSingleColumn
        : false
    readonly property real overviewGap: sceneEffect && Number.isFinite(sceneEffect.overviewGap)
        && sceneEffect.overviewGap >= 0 && sceneEffect.overviewGap <= 64
        ? sceneEffect.overviewGap
        : 16
    readonly property var overviewSpatialLayout: planSpatialLayout()
    readonly property var overviewSpatialVisibleRangePlan: planSpatialVisibleRange()
    readonly property var overviewSpatialVisibleRange:
        spatialVisibleRangeIsValid(overviewSpatialVisibleRangePlan)
        ? overviewSpatialVisibleRangePlan : fallbackSpatialVisibleRange()
    readonly property real outerMargin: Math.max(20, Math.min(width, height) * 0.035)
    readonly property real cardGap: overviewSpatialLayout.gap
    readonly property real cardHeight: overviewSpatialLayout.cardHeight
    readonly property real cardWidth: overviewSpatialLayout.cardWidth
    readonly property real cardX: overviewSpatialLayout.cardX
    readonly property real cardTop: overviewSpatialLayout.edgeMargin - spatialVisualContentY
    property bool desktopReorderAvailable: false
    property int desktopTopologyRevision: 0
    property int desktopTopologyRefreshRequestId: 0
    property bool desktopTopologyRefreshPending: false
    property var desktopSurfaceCandidateRange: null
    property var desktopSurfaceCommittedRange: null
    readonly property int desktopSurfaceMaximumResidentRows: {
        const runtime = OverviewRuntime.DriftileOverview;
        return runtime && Number.isInteger(runtime.MAXIMUM_RESIDENT_ROWS)
            ? runtime.MAXIMUM_RESIDENT_ROWS : 0;
    }
    property var desktopSurfaceResidencyDesktopIds: []
    property string desktopSurfaceResidencyActivityId: ""
    property string desktopSurfaceResidencyOutputId: ""
    property var desktopSurfaceResidencyRange: null
    property int desktopSurfaceResidencyRequestId: 0
    property int desktopSurfaceResidencySessionId: 0
    property bool emptyDesktopAboveFirst: false
    property bool keyboardHelpVisible: false
    property string keyboardSelectionId: ""
    property var keyboardSelectionViewportTarget: null
    property int keyboardBoundaryNavigationRequestId: 0
    property bool keyboardBoundaryNavigationPending: false
    property int overviewDesktopCardEpoch: 0
    property real overviewHorizontalWheelPixelRemainder: 0
    property int overviewHorizontalWheelRemainder: 0
    property string overviewHorizontalWheelSelectionDesktopId: ""
    property int overviewHorizontalWheelSelectionGeometryEpoch: -1
    property string overviewHorizontalWheelSelectionOutputId: ""
    property bool overviewHorizontalWheelSelectionPending: false
    property int overviewHorizontalWheelSelectionRequestId: 0
    property string overviewHorizontalWheelSelectionSourceTargetId: ""
    property int overviewHorizontalWheelSelectionStepOffset: 0
    property string overviewHorizontalWheelSelectionTargetId: ""
    property int overviewHorizontalWheelSelectionWorkspaceIndex: -1
    property string overviewWheelAxisOwner: ""
    property real overviewWheelPixelRemainder: 0
    property int overviewWheelRemainder: 0
    property bool overviewVerticalWheelSettlePending: false
    property int overviewVerticalWheelSettleRequestId: 0
    property string overviewVerticalWheelWorkspaceDesktopId: ""
    property int overviewVerticalWheelWorkspaceGeometryEpoch: -1
    property string overviewVerticalWheelWorkspaceOutputId: ""
    property int overviewVerticalWheelWorkspaceRequestId: 0
    property int overviewVerticalWheelWorkspaceSourceIndex: -1
    property int overviewVerticalWheelWorkspaceTargetIndex: -1
    property int overviewVerticalWheelWorkspaceCount: 0
    property real spatialContentY: 0
    property real spatialVisualContentY: 0
    property bool spatialVisualContentYDeferred: false
    readonly property string spatialPresentationPhase: sceneEffect
        && typeof sceneEffect.presentationPhase === "string"
        ? sceneEffect.presentationPhase : "open"
    readonly property real spatialPresentationProgress: sceneEffect
        && Number.isFinite(sceneEffect.presentationProgress)
        ? Math.max(0, Math.min(1, sceneEffect.presentationProgress)) : 1
    readonly property bool spatialPresentationVisible: sceneEffect
        && sceneEffect.active === true && spatialPresentationProgress > 0
        && (spatialPresentationPhase === "opening" || spatialPresentationPhase === "open"
            || spatialPresentationPhase === "closing")
    readonly property bool spatialPresentationInteractive:
        spatialPresentationVisible
        && !spatialExitHandoffActive
        && !overviewContextRefreshPending && overviewContextModelExact
        && (spatialPresentationPhase === "opening" || spatialPresentationPhase === "open")
    readonly property bool spatialPresentationSettled:
        spatialPresentationInteractive && spatialPresentationPhase === "open"
        && spatialPresentationProgress >= 1
    readonly property bool spatialKeyboardInputEligible:
        spatialPresentationVisible && !spatialExitHandoffActive
        && (spatialPresentationPhase === "opening" || spatialPresentationPhase === "open")
    readonly property bool spatialPointerInputEligible:
        spatialPresentationInteractive && !keyboardHelpVisible
        && spatialZoomOwner.length === 0 && spatialExternalZoomTransaction === null
        && !spatialExternalZoomActive
    readonly property var spatialDirectDragSource: spatialColumnDragSource !== null
        ? spatialColumnDragSource : spatialWindowDragSource
    readonly property bool spatialDirectDragActive: spatialDirectDragSource !== null
    readonly property bool spatialHorizontalRowDragActive: spatialHorizontalRowDragHandler.active
    readonly property bool spatialZoomContextEligible:
        spatialPresentationSettled && !desktopTopologyRefreshPending
        && sceneEffect && sceneEffect.active === true
        && Number.isInteger(sceneEffect.activeSessionId) && sceneEffect.activeSessionId > 0
        && overviewModel && outputId.length > 0 && desktopIds.length > 0
        && currentWorkspaceIndex >= 0 && currentWorkspaceIndex < desktopIds.length
        && Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
        && spatialLayoutIsValid(overviewSpatialLayout) && spatialViewportSnapshot !== null
        && sameStringList(spatialHorizontalDesktopIds, desktopIds)
        && spatialHorizontalViewportOffsets.length === desktopIds.length
    readonly property bool spatialZoomCompetingInputEligible:
        !keyboardHelpVisible && !desktopReorderActive
        && !spatialDirectDragActive
        && !spatialViewportDragHandler.active && !spatialHorizontalViewportDragHandler.active
        && !spatialHorizontalRowDragHandler.active && !spatialVisualContentYDeferred
        && !spatialVerticalCameraAnimation.running && !keyboardBoundaryNavigationPending
        && !overviewVerticalWheelSettlePending && !overviewHorizontalWheelSelectionPending
        && overviewWheelAxisOwner.length === 0
    readonly property bool spatialZoomInputEligible:
        spatialZoomContextEligible && spatialZoomCompetingInputEligible
        && !spatialTouchPanDragHandler.active
    readonly property bool spatialTouchscreenZoomGestureEligible:
        spatialZoomContextEligible && spatialZoomCompetingInputEligible
    readonly property bool spatialZoomSceneRegistrationEligible:
        spatialZoomInputEligible && spatialZoomOwner.length === 0
        && !spatialZoomWheelHandler.active
    readonly property bool spatialExternalZoomActive:
        overviewZoomGestureDirection === "in" || overviewZoomGestureDirection === "out"
    readonly property bool spatialZoomHudShown:
        spatialPresentationSettled && !keyboardHelpVisible
        && (spatialZoomOwner.length > 0 || spatialExternalZoomActive
            || Math.abs(overviewZoom - configuredOverviewZoom) > 0.000001)
    readonly property var spatialZoomSceneToken: ({})
    property bool spatialZoomApplying: false
    property var spatialExternalZoomContext: null
    property int spatialExternalZoomFinalizeRequestId: 0
    property var spatialExternalZoomTransaction: null
    property var spatialZoomDesktopIds: []
    property var spatialZoomRegisteredEffect: null
    property int spatialZoomRegisteredSessionId: 0
    property string spatialZoomRegisteredOutputId: ""
    property bool spatialZoomRegistrationSuppressed: false
    property real spatialZoomHeight: 0
    property var spatialZoomHorizontalOffsets: []
    property var spatialZoomModel: null
    property string spatialZoomOutputId: ""
    property string spatialZoomOwner: ""
    property int spatialZoomSessionId: 0
    property int spatialZoomTopologyRevision: -1
    property var spatialZoomTransaction: null
    property bool spatialZoomFinishing: false
    property real spatialZoomWheelPixelTotal: 0
    property int spatialZoomWheelRemainder: 0
    property string spatialZoomWheelMode: ""
    property real spatialZoomWidth: 0
    property int spatialPresentationWorkspaceIndex: -1
    property var spatialHorizontalDesktopIds: []
    property var spatialHorizontalGeometryPlans: []
    property int spatialHorizontalViewportRevision: 0
    property var spatialHorizontalViewportOffsets: []
    property var spatialLiveCameraAttachment: null
    property var spatialLiveCameraWindow: null
    property string spatialLiveCameraWindowId: ""
    property string spatialLiveCameraDesktopId: ""
    property var spatialLiveCameraProbeWindow: null
    property var spatialLiveCameraDetachedWindow: null
    property string spatialLiveCameraDetachedWindowId: ""
    property string spatialLiveCameraReturnDesktopId: ""
    property string spatialLiveCameraReturnOutputId: ""
    property real spatialLiveCameraReturnViewportOffset: Number.NaN
    property string spatialLiveGeometryDetachedDesktopId: ""
    property string spatialLiveGeometryDetachedOutputId: ""
    property bool spatialLiveCameraRefreshPending: false
    property int spatialLiveCameraRefreshBudget: 1
    property int spatialLiveCameraRefreshEpoch: 0
    property var spatialViewportSnapshot: null
    property var spatialColumnDragSource: null
    property string spatialColumnDragSourceDesktopId: ""
    property int spatialColumnDragSourceWorkspaceIndex: -1
    property var spatialColumnDragVisualPlan: null
    property var spatialWindowDragSource: null
    property string spatialWindowDragSourceDesktopId: ""
    property int spatialWindowDragSourceWorkspaceIndex: -1
    property var spatialWindowDragVisualPlan: null
    property var workspaceGapPreviewSource: null
    property string workspaceGapPreviewWindowId: ""
    property int workspaceGapPreviewIndex: -1
    property var workspaceGapPreviewPlan: null
    readonly property int spatialWindowDragHoverThresholdMilliseconds: 600
    property string spatialWindowDragHoverCurrentDesktopId: ""
    property int spatialWindowDragHoverGeometryEpoch: -1
    property int spatialWindowDragHoverModelEpoch: -1
    property var spatialWindowDragHoverSource: null
    property string spatialWindowDragHoverSourceDesktopId: ""
    property var spatialWindowDragHoverTargetDesktop: null
    property string spatialWindowDragHoverTargetDesktopId: ""
    property var spatialWindowDragHoverTargetScreen: null
    property int spatialWindowDragHoverTargetWorkspaceIndex: -1
    property int spatialWindowDragHoverSessionId: 0
    property real spatialEdgePanSceneX: Number.NaN
    property real spatialEdgePanSceneY: Number.NaN
    property real spatialEdgePanPointerX: Number.NaN
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

    onSpatialKeyboardInputEligibleChanged: {
        if (spatialKeyboardInputEligible) {
            forceActiveFocus();
        }
    }
    onOverviewContextRefreshPendingChanged: {
        if (overviewContextRefreshPending) {
            root.beginOverviewContextRefreshBarrier();
        } else if (overviewContextModelExact) {
            root.finishOverviewContextRefreshBarrier();
        }
    }
    onActiveOverviewSessionIdChanged: root.restartDesktopSurfaceResidency()
    onActiveOverviewActivityIdChanged: {
        if (overviewContextRefreshPending || !overviewContextModelExact) {
            root.beginOverviewContextRefreshBarrier();
        } else {
            root.restartDesktopSurfaceResidency();
        }
    }
    onCurrentWorkspaceIndexChanged: root.updateDesktopSurfaceResidency()
    onOverviewSpatialVisibleRangePlanChanged: root.updateDesktopSurfaceResidency()
    onSpatialExternalZoomActiveChanged: root.finishDesktopSurfaceResidencyBridge()
    onSpatialExternalZoomTransactionChanged: root.finishDesktopSurfaceResidencyBridge()
    onSpatialVisualContentYDeferredChanged: root.finishDesktopSurfaceResidencyBridge()
    onSpatialZoomApplyingChanged: root.finishDesktopSurfaceResidencyBridge()
    onSpatialZoomOwnerChanged: root.finishDesktopSurfaceResidencyBridge()
    onSpatialZoomTransactionChanged: root.finishDesktopSurfaceResidencyBridge()
    onKeyboardSelectionIdChanged: {
        const target = keyboardSelectionViewportTarget;
        keyboardSelectionViewportTarget = null;
        root.synchronizeKeyboardSelectionViewport(target);
    }
    onKeyboardHelpVisibleChanged: {
        if (keyboardHelpVisible) {
            root.cancelSpatialZoomTransaction();
        }
        root.resetOverviewWheelState();
        root.resetWindowWorkspaceHover();
    }
    onCurrentDesktopChanged: root.handleCurrentDesktopChanged()
    function handleCurrentDesktopChanged() {
        root.cancelSpatialZoomTransaction();
        if (spatialExitHandoffActive) {
            return;
        }
        if (spatialPresentationPhase === "closing") {
            if (sceneEffect && typeof sceneEffect.deactivateImmediately === "function") {
                sceneEffect.deactivateImmediately();
            }
            return;
        }
        if (spatialPresentationPhase === "opening" && currentWorkspaceIndex >= 0
                && currentWorkspaceIndex < desktopIds.length) {
            spatialPresentationWorkspaceIndex = currentWorkspaceIndex;
        }
        if (spatialPresentationInteractive && spatialDirectDragSource !== null
                && spatialDirectDragSourceIsExact(spatialDirectDragSource,
                                                  spatialDirectDragSourceDesktopId())) {
            resetWindowWorkspaceHover();
            const plan = planSpatialWorkspaceCenter(currentWorkspaceIndex);
            if (plan) {
                setSpatialContentY(plan.contentY, true);
            }
            resolveSpatialLiveCamera();
            Qt.callLater(root.repairKeyboardSelection);
            return;
        }
        root.refreshOverviewSpatialSession(false, spatialPresentationInteractive);
    }
    onOverviewModelChanged: {
        root.cancelActiveColumnSpatialDrag();
        if (spatialExitHandoffActive) {
            root.invalidateSpatialExitHandoff("stale");
            return;
        }
        root.cancelSpatialZoomTransaction();
        root.discardSpatialZoomTransaction();
        root.refreshOverviewSpatialSession(true);
        root.restartDesktopSurfaceResidency();
        root.synchronizeSpatialZoomInputState();
    }
    onOverviewAlwaysCenterSingleColumnChanged: root.refreshOverviewSpatialSession(true)
    onOverviewGapChanged: root.refreshOverviewSpatialSession(true)
    onOverviewSpatialLayoutChanged: {
        if (spatialExternalZoomTransaction !== null) {
            if (!root.applyExternalSpatialZoom()) {
                root.recoverExternalSpatialZoomContext();
            }
        } else if (spatialZoomTransaction !== null && !spatialZoomApplying) {
            if (!root.applyControllerSpatialZoomRollback()) {
                root.cancelSpatialZoomTransaction();
                root.refreshOverviewSpatialSession(true);
            }
        } else if (!spatialZoomApplying && !spatialExitRestoringCamera
                   && !spatialExitHandoffActive) {
            root.refreshOverviewSpatialSession(true);
        }
    }
    onOverviewZoomGestureDirectionChanged: root.handleExternalSpatialZoomDirectionChanged()
    onOutputIdChanged: {
        root.cancelActiveColumnSpatialDrag();
        root.cancelSpatialZoomTransaction();
        root.discardSpatialZoomTransaction();
        root.restartDesktopSurfaceResidency();
        root.synchronizeSpatialZoomInputState();
    }
    onDesktopIdsChanged: {
        root.cancelActiveColumnSpatialDrag();
        root.cancelSpatialZoomTransaction();
        root.discardSpatialZoomTransaction();
        root.handleDesktopSurfaceResidencyDesktopIdsChanged();
        root.synchronizeSpatialZoomInputState();
    }
    onWidthChanged: {
        root.cancelActiveColumnSpatialDrag();
        root.cancelSpatialZoomTransaction();
    }
    onHeightChanged: {
        root.cancelActiveColumnSpatialDrag();
        root.cancelSpatialZoomTransaction();
    }
    onSpatialZoomInputEligibleChanged: {
        if (!spatialZoomInputEligible) {
            root.cancelSpatialZoomTransaction();
        }
        root.synchronizeSpatialZoomInputState();
    }
    onSpatialZoomSceneRegistrationEligibleChanged: root.synchronizeSpatialZoomInputState()
    onOverviewZoomInputStateRevisionChanged: root.synchronizeSpatialZoomInputState()
    onSpatialContentYChanged: {
        if (!spatialVisualContentYDeferred) {
            spatialVerticalCameraAnimation.stop();
            spatialVisualContentY = spatialContentY;
        }
        root.resetOverviewWheelState();
        root.captureSpatialViewportSnapshot();
    }
    onSearchQueryChanged: {
        root.cancelActiveColumnSpatialDrag();
        resetOverviewWheelState();
        resetWindowWorkspaceHover();
        cancelKeyboardBoundaryNavigation();
        Qt.callLater(root.repairKeyboardSelection);
    }
    onOverviewExitHandoffStateChanged: root.handleOverviewExitHandoffStateChanged()

    Keys.onPressed: event => {
        if (!spatialKeyboardInputEligible) {
            event.accepted = false;
            return;
        }

        const modifiers = event.modifiers & ~Qt.KeypadModifier;
        const forbiddenModifiers = Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier;
        const controlOnly = modifiers === Qt.ControlModifier;
        const zoomControl = controlOnly
            || modifiers === (Qt.ControlModifier | Qt.ShiftModifier);
        const unmodified = modifiers === Qt.NoModifier;
        const searchTextModifier = unmodified || modifiers === Qt.ShiftModifier;
        if (!spatialPresentationInteractive) {
            if (!event.isAutoRepeat && unmodified && event.key === Qt.Key_Escape
                    && sceneEffect) {
                sceneEffect.deactivate();
            }
            event.accepted = true;
            return;
        }
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
        if (unmodified && event.key === Qt.Key_Escape && spatialColumnDragSource !== null) {
            root.cancelActiveColumnSpatialDrag();
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
        if (spatialZoomOwner.length > 0 || spatialExternalZoomTransaction !== null
                || spatialExternalZoomActive) {
            event.accepted = true;
            return;
        }

        let handled = true;
        if (zoomControl && (event.key === Qt.Key_Plus || event.key === Qt.Key_Equal)) {
            handled = root.handleSpatialZoomKeyboard("in");
        } else if (controlOnly && event.key === Qt.Key_Minus) {
            handled = root.handleSpatialZoomKeyboard("out");
        } else if (controlOnly && event.key === Qt.Key_0) {
            handled = root.handleSpatialZoomKeyboard("reset");
        } else if (controlOnly && event.key === Qt.Key_Backspace && searchQuery.length > 0) {
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
            root.navigateKeyboardBoundary("first");
        } else if (unmodified && event.key === Qt.Key_End) {
            root.navigateKeyboardBoundary("last");
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
        resetOverviewSession();
        spatialPresentationWorkspaceIndex = currentWorkspaceIndex;
        handleSpatialPresentationPhaseChanged();
        synchronizeSpatialZoomInputState();
    }
    Component.onDestruction: root.destroySpatialZoomScene()

    Connections {
        target: root.sceneEffect
        ignoreUnknownSignals: true

        function onActiveChanged() {
            root.cancelSpatialZoomTransaction();
            root.resetOverviewSession();
            if (root.sceneEffect && root.sceneEffect.active === true) {
                root.refreshEmptyDesktopBoundarySetting();
            }
            root.synchronizeSpatialZoomInputState();
        }

        function onPresentationPhaseChanged() {
            root.handleSpatialPresentationPhaseChanged();
        }

        function onItemDroppedOutOfScreen(globalPosition, source, screen) {
            root.handleCrossOutputWindowDrop(globalPosition, source, screen);
        }
    }

    Rectangle {
        id: spatialBackdrop

        anchors.fill: parent
        color: root.sceneEffect && root.sceneEffect.backdropColor !== undefined
            ? root.sceneEffect.backdropColor
            : "#e60b0f17"
        opacity: root.spatialPresentationProgress
        z: -10000
    }

    Connections {
        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onDesktopsChanged() {
            root.cancelActiveColumnSpatialDrag();
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
                return;
            }
            root.handleDesktopTopologyChanged();
        }

        function onCurrentActivityChanged() {
            root.beginOverviewContextRefreshBarrier();
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
                root.sceneEffect.deactivate();
                return;
            }
        }

        function onActivitiesChanged() {
            root.beginOverviewContextRefreshBarrier();
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
                root.sceneEffect.deactivate();
                return;
            }
        }

        function onScreensChanged() {
            root.beginOverviewContextRefreshBarrier();
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
                root.sceneEffect.deactivate();
                return;
            }
        }

        function onVirtualScreenGeometryChanged() {
            root.beginOverviewContextRefreshBarrier();
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
                root.sceneEffect.deactivate();
            }
        }

        function onWindowActivated() {
            if (!root.spatialExitHandoffActive) {
                root.resolveSpatialLiveCamera();
            }
        }

        function onWindowRemoved(window) {
            root.handleSpatialLiveCameraWindowRemoved(window);
        }
    }

    Connections {
        target: root.spatialLiveCameraWindow
        enabled: target !== null
        ignoreUnknownSignals: true

        function onFrameGeometryChanged() {
            root.applySpatialLiveCamera();
        }

        function onActivitiesChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onDeletedChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onDesktopsChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onDialogChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onFullScreenChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onManagedChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onMaximizedChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onModalChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onMinimizedChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onMoveResizedChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onNormalWindowChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onOutputChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onTileChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onTransientChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onTransientForChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onUtilityChanged() {
            root.resolveSpatialLiveCamera();
        }

        function onWindowRoleChanged() {
            root.resolveSpatialLiveCamera();
        }
    }

    Connections {
        target: root.workspaceGapPreviewSource
        enabled: target !== null
        ignoreUnknownSignals: true

        function onCandidateChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onColumnDragSnapshotChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onColumnSpatialDragLifecycleActiveChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onIndexChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onDestroyed() {
            root.clearWorkspaceGapPreview();
        }

        function onDragEligibleChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onMinimizedWindowChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onModelDataChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSourceColumnChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSelectedWindowIdChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSourceContextChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSourceDesktopChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSourceDesktopIdChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSourceScreenChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }

        function onSpatialDragLifecycleActiveChanged() {
            root.clearInvalidWorkspaceGapPreview();
        }
    }

    Connections {
        target: root.spatialColumnDragSource
        enabled: target !== null
        ignoreUnknownSignals: true

        function onColumnDragSnapshotChanged() {
            if (target && !root.columnSpatialDragSourceIsExact(
                    target, root.spatialColumnDragSourceDesktopId)) {
                root.cancelActiveColumnSpatialDrag();
            }
        }

        function onColumnSpatialDragLifecycleActiveChanged() {
            if (target && target.columnSpatialDragLifecycleActive !== true) {
                root.resetSpatialEdgePanTracking();
            }
        }

        function onCandidateChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onDestroyed() {
            root.resetSpatialEdgePanTracking();
        }

        function onDragEligibleChanged() {
            if (target && target.dragEligible !== true) {
                root.cancelActiveColumnSpatialDrag();
            }
        }

        function onIndexChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSourceColumnChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSelectedWindowIdChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSourceContextChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSourceDesktopChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSourceDesktopIdChanged() {
            root.cancelActiveColumnSpatialDrag();
        }

        function onSourceScreenChanged() {
            root.cancelActiveColumnSpatialDrag();
        }
    }

    Connections {
        target: root.spatialWindowDragSource
        enabled: target !== null
        ignoreUnknownSignals: true

        function onDestroyed() {
            root.resetSpatialEdgePanTracking();
        }

        function onDragEligibleChanged() {
            if (target && target.dragEligible !== true) {
                root.resetSpatialEdgePanTracking();
            }
        }

        function onMinimizedWindowChanged() {
            if (target && target.minimizedWindow === true) {
                root.resetSpatialEdgePanTracking();
            }
        }

        function onSpatialDragLifecycleActiveChanged() {
            if (target && target.spatialDragLifecycleActive !== true) {
                root.resetSpatialEdgePanTracking();
            }
        }
    }

    Connections {
        target: root.spatialLiveCameraProbeWindow
        enabled: target !== null && target !== root.spatialLiveCameraWindow
        ignoreUnknownSignals: true

        function onActivitiesChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onDeletedChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onDesktopsChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onDialogChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onFullScreenChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onManagedChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onMaximizedChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onModalChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onMinimizedChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onMoveResizedChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onNormalWindowChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onOutputChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onTileChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onTransientChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onTransientForChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onUtilityChanged() {
            root.resolveSpatialLiveCameraProbe();
        }

        function onWindowRoleChanged() {
            root.resolveSpatialLiveCameraProbe();
        }
    }

    Connections {
        target: root.targetScreen
        ignoreUnknownSignals: true

        function onGeometryChanged() {
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
            } else {
                root.refreshOverviewSpatialSession(true);
            }
        }

        function onScaleChanged() {
            if (root.spatialExitHandoffActive) {
                root.invalidateSpatialExitHandoff("topology");
            } else {
                root.refreshOverviewSpatialSession(true);
            }
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

    Timer {
        id: spatialWindowDragHoverTimer

        interval: root.spatialWindowDragHoverThresholdMilliseconds
        repeat: false
        triggeredOnStart: false
        onTriggered: root.completeWindowWorkspaceHover()
    }

    NumberAnimation {
        id: spatialVerticalCameraAnimation

        target: root
        property: "spatialVisualContentY"
        easing.type: Easing.OutCubic
        onRunningChanged: root.finishDesktopSurfaceResidencyBridge()
    }

    WheelHandler {
        id: spatialZoomWheelHandler

        target: null
        enabled: root.spatialZoomInputEligible
                 && !root.spatialExternalZoomActive
                 && root.spatialExternalZoomTransaction === null
                 && (root.spatialZoomOwner.length === 0 || root.spatialZoomOwner === "wheel")
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        acceptedModifiers: Qt.ControlModifier
        blocking: true
        orientation: Qt.Vertical

        onActiveChanged: {
            root.synchronizeSpatialZoomInputState();
            if (!active) {
                root.finishSpatialZoomWheelGesture();
            }
        }
        onWheel: event => root.handleSpatialZoomWheel(event, point.position)
    }

    WheelHandler {
        id: spatialVerticalWheelHandler

        target: null
        enabled: root.spatialPointerInputEligible
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        acceptedModifiers: Qt.NoModifier
        blocking: false
        orientation: Qt.Vertical

        onActiveChanged: root.releaseOverviewWheelAxisIfIdle()
        onWheel: event => root.routeOverviewWheel(event, point.position, "vertical")
    }

    WheelHandler {
        id: spatialHorizontalWheelHandler

        target: null
        enabled: root.spatialPointerInputEligible
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        acceptedModifiers: Qt.NoModifier
        blocking: false
        orientation: Qt.Horizontal

        onActiveChanged: root.releaseOverviewWheelAxisIfIdle()
        onWheel: event => root.routeOverviewWheel(event, point.position, "horizontal")
    }

    WheelHandler {
        id: spatialShiftHorizontalWheelHandler

        target: null
        enabled: root.spatialPointerInputEligible
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        acceptedModifiers: Qt.ShiftModifier
        blocking: false
        orientation: Qt.Vertical

        onActiveChanged: root.releaseOverviewWheelAxisIfIdle()
        onWheel: event => root.routeOverviewShiftHorizontalWheel(event, point.position)
    }

    Item {
        id: spatialTouchPanInput

        property string panAxis: "blocked"
        property bool panHorizontalAvailable: false
        property var panLayout: null
        property real panLastContentY: 0
        property string panOutputId: ""
        property real panPressX: Number.NaN
        property real panPressY: Number.NaN
        property real panSceneHeight: 0
        property real panStartContentY: 0
        property bool panVerticalAvailable: false

        anchors.fill: parent
        enabled: root.spatialPointerInputEligible && !root.keyboardHelpVisible
                 && !root.desktopReorderActive && !root.spatialDirectDragActive
                 && !spatialViewportDragHandler.active
                 && !spatialHorizontalViewportDragHandler.active
                 && !spatialHorizontalRowDragHandler.active
        z: 18000
        containmentMask: QtObject {
            function contains(point: point) : bool {
                return root.spatialTouchPanContains(point);
            }
        }

        DragHandler {
            id: spatialTouchPanDragHandler

            target: null
            acceptedButtons: Qt.NoButton
            acceptedDevices: PointerDevice.TouchScreen
            acceptedModifiers: Qt.NoModifier
            minimumPointCount: 1
            maximumPointCount: 1
            grabPermissions: PointerHandler.CanTakeOverFromHandlersOfDifferentType
                             | PointerHandler.CanTakeOverFromItems
                             | PointerHandler.ApprovesTakeOverByHandlersOfDifferentType
                             | PointerHandler.ApprovesTakeOverByHandlersOfSameType
                             | PointerHandler.ApprovesCancellation

            onActiveChanged: {
                if (active) {
                    root.beginSpatialTouchPan(centroid.pressPosition,
                                              centroid.position.x - centroid.pressPosition.x,
                                              centroid.position.y - centroid.pressPosition.y);
                } else {
                    root.clearSpatialTouchPan();
                }
            }
            onCentroidChanged: {
                if (active) {
                    root.updateSpatialTouchPan(centroid.position.x - centroid.pressPosition.x,
                                               centroid.position.y - centroid.pressPosition.y);
                }
            }
            onGrabChanged: (transition, point) => {
                if (transition === PointerDevice.CancelGrabExclusive
                        || transition === PointerDevice.CancelGrabPassive) {
                    root.clearSpatialTouchPan();
                }
            }
        }
    }

    OverviewTouchscreenZoomGesture {
        id: spatialTouchscreenZoom

        anchors.fill: parent
        gestureEnabled: root.spatialTouchscreenZoomGestureEligible
                        && !root.spatialExternalZoomActive
                        && root.spatialExternalZoomTransaction === null
                        && (root.spatialZoomOwner.length === 0
                            || root.spatialZoomOwner === "touchscreen")
        z: 18500

        onZoomStarted: (scale, sceneX, sceneY) => {
            if (!root.beginSpatialZoomTransaction("touchscreen", sceneY)
                    || !root.previewSpatialZoomTransaction(scale)) {
                root.cancelSpatialZoomTransaction();
            }
        }
        onZoomProgressed: scale => {
            if (!root.previewSpatialZoomTransaction(scale)) {
                root.cancelSpatialZoomTransaction();
            }
        }
        onZoomCommitted: scale => root.commitSpatialTouchscreenZoom(scale)
        onZoomCancelled: root.cancelSpatialZoomTransaction()
    }

    Item {
        id: spatialViewportInput

        property var panLayout: null
        property real panStartContentY: 0

        anchors.fill: parent
        enabled: root.spatialPointerInputEligible && !root.keyboardHelpVisible
                 && !root.desktopReorderActive
                 && !spatialTouchPanDragHandler.active
                 && !spatialHorizontalRowDragHandler.active
                 && root.overviewSpatialLayout.contentHeight > root.height
        containmentMask: QtObject {
            function contains(point: point) : bool {
                return root.spatialViewportBackdropContains(point);
            }
        }

        DragHandler {
            id: spatialViewportDragHandler

            target: null
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            acceptedModifiers: Qt.NoModifier
            grabPermissions: PointerHandler.TakeOverForbidden
            xAxis.enabled: false
            yAxis.enabled: true

            onActiveChanged: {
                if (active) {
                    root.resetOverviewWheelState();
                    if (!root.adoptSpatialVisualContentY()) {
                        spatialViewportInput.panLayout = null;
                        return;
                    }
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

    Item {
        id: spatialHorizontalViewportInput

        property string panDesktopId: ""
        property int panGeometryEpoch: -1
        property real panLastViewportOffset: 0
        property string panOutputId: ""
        property real panProjectionScale: 1
        property real panStartViewportOffset: 0
        property int panWorkspaceIndex: -1

        anchors.fill: parent
        enabled: root.spatialPointerInputEligible && !root.keyboardHelpVisible
                 && !root.desktopReorderActive
                 && !spatialTouchPanDragHandler.active
                 && !spatialHorizontalRowDragHandler.active
        containmentMask: QtObject {
            function contains(point: point) : bool {
                return root.spatialHorizontalViewportBackdropContains(point);
            }
        }

        DragHandler {
            id: spatialHorizontalViewportDragHandler

            target: null
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            acceptedModifiers: Qt.NoModifier
            grabPermissions: PointerHandler.TakeOverForbidden
            xAxis.enabled: true
            yAxis.enabled: false

            onActiveChanged: {
                if (active) {
                    root.beginSpatialHorizontalViewportDrag(centroid.pressPosition);
                    root.updateSpatialHorizontalViewportDrag(activeTranslation.x);
                } else {
                    root.clearSpatialHorizontalViewportDrag();
                }
            }
            onActiveTranslationChanged: {
                if (active) {
                    root.updateSpatialHorizontalViewportDrag(activeTranslation.x);
                }
            }
        }
    }

    Item {
        id: spatialCanvas

        readonly property int presentationWorkspaceIndex:
            root.spatialPresentationWorkspaceIndex >= 0
            && root.spatialPresentationWorkspaceIndex < root.desktopIds.length
            ? root.spatialPresentationWorkspaceIndex : Math.max(0, root.spatialLayoutWorkspaceIndex)
        readonly property real fullScale: root.cardHeight > 0
            ? Math.max(1, root.height / root.cardHeight) : 1
        readonly property real presentationScale: 1 + (fullScale - 1)
            * (1 - Math.max(0, Math.min(1, root.spatialPresentationProgress)))
        readonly property real presentationRowCenter: presentationWorkspaceIndex
            * (root.cardHeight + root.cardGap) + root.cardHeight / 2
        readonly property real presentationOffsetY:
            (root.height / 2 - (root.cardTop + presentationRowCenter))
            * (1 - root.spatialPresentationProgress)

        x: 0
        y: root.cardTop + presentationOffsetY
        width: root.width
        height: Math.max(0, root.desktopIds.length * (root.cardHeight + root.cardGap) - root.cardGap)
        opacity: root.spatialExitHandoffActive
            ? overviewExitHandoffOverlay.surfaceOpacity : root.spatialPresentationProgress
        transform: Scale {
            origin.x: spatialCanvas.width / 2
            origin.y: spatialCanvas.presentationWorkspaceIndex * (root.cardHeight + root.cardGap)
                      + root.cardHeight / 2
            xScale: spatialCanvas.presentationScale
            yScale: spatialCanvas.presentationScale
        }

        Repeater {
            id: desktopRepeater

            model: root.desktopIds

            onItemAdded: {
                root.advanceOverviewDesktopCardEpoch();
                Qt.callLater(root.repairKeyboardSelection);
            }
            onItemRemoved: {
                root.advanceOverviewDesktopCardEpoch();
                Qt.callLater(root.repairKeyboardSelection);
            }

            Loader {
                id: desktopCardLoader

                required property string modelData
                required property int index
                readonly property var desktopObject: root.desktopForId(modelData)

                x: 0
                y: index * (root.cardHeight + root.cardGap)
                width: spatialCanvas.width
                height: root.cardHeight
                active: root.desktopCardShouldLoad(index, modelData)
                onActiveChanged: {
                    root.advanceOverviewDesktopCardEpoch();
                    Qt.callLater(root.repairKeyboardSelection);
                }
                onLoaded: {
                    root.advanceOverviewDesktopCardEpoch();
                    Qt.callLater(root.repairKeyboardSelection);
                }

                sourceComponent: Component {
                    DesktopCard {
                        enabled: interactionEligible && !root.keyboardHelpVisible
                            && !root.spatialHorizontalRowDragActive
                        context: root.contextFor(desktopCardLoader.modelData)
                        current: root.spatialPresentationDesktopId === desktopCardLoader.modelData
                        desktop: desktopCardLoader.desktopObject
                        desktopReorderEnabled: root.desktopReorderAvailable
                                                 && root.desktopIds.length > (root.emptyDesktopAboveFirst ? 3 : 2)
                                                 && desktopCardLoader.index >= (root.emptyDesktopAboveFirst ? 1 : 0)
                                                 && desktopCardLoader.index < root.desktopIds.length - 1
                        desktopReorderSource: root.desktopReorderActive
                            && root.desktopReorderSourceId === desktopCardLoader.modelData
                        desktopId: desktopCardLoader.modelData
                        desktopSurfaceEnabled: root.desktopSurfaceShouldLoad(
                                                   desktopCardLoader.index,
                                                   desktopCardLoader.modelData,
                                                   desktopCardLoader.desktopObject)
                        desktopSurfaceLifecycleEvent: root.desktopSurfaceLifecycleEvent
                        floatingWindows: root.floatingFor(desktopCardLoader.modelData)
                        interactionEligible: root.desktopCardInteractionEligible(
                                                 desktopCardLoader.index,
                                                 desktopCardLoader.modelData)
                        keyboardSelectionId: root.keyboardSelectionId
                        liveGeometryEnabled: current && !root.spatialLiveGeometryIsManuallyDetached(
                                                 root.outputId, desktopCardLoader.modelData)
                        overviewAlwaysCenterSingleColumn: root.overviewAlwaysCenterSingleColumn
                        overviewContextGeneration: root.overviewContextGeneration
                        overviewGap: root.overviewGap
                        overviewActivityId: root.activeOverviewActivityId
                        outputId: root.outputId
                        outputName: root.outputName
                        presentationProgress: root.spatialPresentationProgress
                        previewViewportOffset: root.spatialPresentationViewportOffsetAt(
                                                   desktopCardLoader.index, desktopCardLoader.modelData,
                                                   root.spatialHorizontalViewportRevision)
                        spatialRowGeometryPlan: root.spatialHorizontalGeometryPlanAt(
                                                    desktopCardLoader.index, desktopCardLoader.modelData,
                                                    root.spatialHorizontalViewportRevision)
                        windowWorkspaceHoverTarget: root.spatialWindowDragHoverTargetDesktopId
                            === desktopCardLoader.modelData
                        searchQuery: root.searchQuery
                        searchQueryPlan: root.searchQueryPlan
                        searchResultCount: root.searchResultCountForDesktop(desktopCardLoader.modelData)
                        screen: root.targetScreen
                        spatialDirectDragBlocked: root.spatialDirectDragActive
                        showApplicationIdentity: root.showApplicationIdentity
                        showApplicationIcons: root.showApplicationIcons
                        showWindowCloseButtons: root.showWindowCloseButtons
                        showWindowLabels: root.showWindowLabels
                        showWindowStateBadges: root.showWindowStateBadges
                        showDesktopNames: root.showDesktopNames
                        onDesktopReorderCanceled: expectedDesktopId => root.cancelDesktopReorder(expectedDesktopId)
                        onDesktopReorderGrabbed: (candidate, expectedDesktopId, expectedScreen, sceneX, sceneY) =>
                                                     root.beginDesktopReorder(candidate, expectedDesktopId,
                                                                              expectedScreen, sceneX, sceneY)
                        onDesktopReorderMoved: (expectedDesktopId, sceneX, sceneY) =>
                                                   root.updateDesktopReorder(expectedDesktopId, sceneX, sceneY)
                        onDesktopReorderReleased: (expectedDesktopId, sceneX, sceneY) =>
                                                      root.finishDesktopReorder(expectedDesktopId, sceneX, sceneY)
                        onNavigationTargetsChanged: {
                            root.advanceOverviewDesktopCardEpoch();
                            Qt.callLater(root.repairKeyboardSelection);
                        }
                        onDesktopTapped: (candidate, expectedDesktopId, expectedScreen) => root.selectDesktop(
                                             candidate, expectedDesktopId, expectedScreen)
                        onColumnDropped: (source, expectedTargetDesktop, expectedTargetDesktopId,
                                          expectedScreen, exactTarget) =>
                                             root.submitColumnSpatialDrop(source, expectedTargetDesktop,
                                                                          expectedTargetDesktopId,
                                                                          expectedScreen, exactTarget)
                        onColumnSpatialDragStarted: (source, sceneX, sceneY) =>
                                                        root.beginColumnSpatialEdgePan(
                                                            source, desktopCardLoader.modelData, sceneX, sceneY)
                        onColumnSpatialDragMoved: (source, sceneX, sceneY) =>
                                                      root.updateColumnSpatialEdgePan(
                                                          source, desktopCardLoader.modelData, sceneX, sceneY)
                        onColumnSpatialDragFinished: source => root.finishColumnSpatialEdgePan(
                                                         source, desktopCardLoader.modelData)
                        onWindowTapped: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                         expectedScreen) => root.focusWindow(candidate, expectedWindowId,
                                                                              expectedDesktop, expectedDesktopId,
                                                                              expectedScreen)
                        onWindowCloseRequested: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                                 expectedScreen) => root.closeWindow(candidate, expectedWindowId,
                                                                                      expectedDesktop,
                                                                                      expectedDesktopId,
                                                                                      expectedScreen)
                        onWindowDropped: (candidate, expectedWindowId, expectedSourceDesktop,
                                          expectedSourceDesktopId, expectedTargetDesktop,
                                          expectedTargetDesktopId, expectedScreen, exactTarget) =>
                                             root.submitWindowSpatialDrop(candidate, expectedWindowId,
                                                                          expectedSourceDesktop,
                                                                          expectedSourceDesktopId,
                                                                          expectedTargetDesktop,
                                                                          expectedTargetDesktopId,
                                                                          expectedScreen, expectedScreen,
                                                                          exactTarget)
                        onWindowSpatialDragStarted: (source, sceneX, sceneY) =>
                                                        root.beginWindowSpatialEdgePan(
                                                            source, desktopCardLoader.modelData, sceneX, sceneY)
                        onWindowSpatialDragMoved: (source, sceneX, sceneY) =>
                                                      root.updateWindowSpatialEdgePan(
                                                          source, desktopCardLoader.modelData, sceneX, sceneY)
                        onWindowSpatialDragFinished: source => root.finishWindowSpatialEdgePan(
                                                         source, desktopCardLoader.modelData)
                        onWindowWorkspaceHoverEntered: (source, expectedTargetDesktop,
                                                         expectedTargetDesktopId, expectedTargetScreen,
                                                         sceneX, sceneY) =>
                                                            root.beginWindowWorkspaceHover(
                                                                source, expectedTargetDesktop,
                                                                expectedTargetDesktopId,
                                                                expectedTargetScreen, sceneX, sceneY)
                        onWindowWorkspaceHoverMoved: (source, expectedTargetDesktop,
                                                       expectedTargetDesktopId, expectedTargetScreen,
                                                       sceneX, sceneY) =>
                                                          root.moveWindowWorkspaceHover(
                                                              source, expectedTargetDesktop,
                                                              expectedTargetDesktopId,
                                                              expectedTargetScreen, sceneX, sceneY)
                        onWindowWorkspaceHoverLeft: (source, expectedTargetDesktop,
                                                      expectedTargetDesktopId, expectedTargetScreen) =>
                                                         root.leaveWindowWorkspaceHover(
                                                             source, expectedTargetDesktop,
                                                             expectedTargetDesktopId,
                                                             expectedTargetScreen)
                    }
                }
            }
        }

        Repeater {
            id: workspaceGapDropRepeater

            model: Math.max(0, root.desktopIds.length - 1)

            Item {
                id: workspaceGapDropSlot

                required property int index

                x: 0
                y: index * (root.cardHeight + root.cardGap) + root.cardHeight
                width: spatialCanvas.width
                height: root.cardGap
                enabled: root.spatialPointerInputEligible && !root.desktopReorderActive
                z: 10000

                onEnabledChanged: {
                    if (!enabled) {
                        root.releaseWorkspaceGapPreview(index);
                    }
                }

                DropArea {
                    id: workspaceGapDropArea

                    anchors.fill: parent
                    keys: ["driftile-window"]

                    onEntered: drag => {
                        drag.accepted = root.claimWorkspaceGapPreview(
                            workspaceGapDropArea, drag, workspaceGapDropSlot.index);
                    }
                    onPositionChanged: drag => {
                        drag.accepted = root.claimWorkspaceGapPreview(
                            workspaceGapDropArea, drag, workspaceGapDropSlot.index);
                    }
                    onExited: root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index)
                    onContainsDragChanged: {
                        if (!containsDrag) {
                            root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index);
                        }
                    }
                    onDropped: drop => {
                        const plan = root.planWorkspaceGapDrop(workspaceGapDropArea, drop,
                                                               workspaceGapDropSlot.index);
                        const accepted = plan !== null
                            && root.submitWindowWorkspaceGapDrop(drop.source, plan, root.targetScreen);
                        drop.action = accepted ? Qt.MoveAction : Qt.IgnoreAction;
                        drop.accepted = accepted;
                        root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index);
                    }
                }

                DropArea {
                    id: workspaceGapColumnDropArea

                    anchors.fill: parent
                    keys: ["driftile-column"]

                    onEntered: drag => {
                        drag.accepted = root.claimColumnWorkspaceGapPreview(
                            workspaceGapColumnDropArea, drag, workspaceGapDropSlot.index);
                    }
                    onPositionChanged: drag => {
                        drag.accepted = root.claimColumnWorkspaceGapPreview(
                            workspaceGapColumnDropArea, drag, workspaceGapDropSlot.index);
                    }
                    onExited: root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index)
                    onContainsDragChanged: {
                        if (!containsDrag) {
                            root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index);
                        }
                    }
                    onDropped: drop => {
                        const plan = root.planColumnWorkspaceGapDrop(workspaceGapColumnDropArea, drop,
                                                                     workspaceGapDropSlot.index);
                        const accepted = plan !== null
                            && root.submitColumnWorkspaceGapDrop(drop.source, plan, root.targetScreen);
                        drop.action = accepted ? Qt.MoveAction : Qt.IgnoreAction;
                        drop.accepted = accepted;
                        root.releaseWorkspaceGapPreview(workspaceGapDropSlot.index);
                    }
                }

                Rectangle {
                    readonly property var plan: root.workspaceGapPreviewSource !== null
                        && root.workspaceGapPreviewWindowId.length > 0
                        && root.workspaceGapPreviewSourceId(root.workspaceGapPreviewSource)
                           === root.workspaceGapPreviewWindowId
                        && root.workspaceGapPreviewIndex === workspaceGapDropSlot.index
                        && root.workspaceGapPreviewPlan !== null ? root.workspaceGapPreviewPlan : null

                    x: root.cardX
                    y: plan ? plan.lineY - workspaceGapDropSlot.y - height / 2 : 0
                    width: root.cardWidth
                    height: Math.max(2, Math.min(6, root.cardGap * 0.18))
                    visible: plan !== null
                    color: "#86aee8"
                    opacity: root.spatialPresentationProgress
                    radius: height / 2
                }
            }
        }
    }

    Item {
        id: spatialWindowDragVisual

        readonly property var plan: root.spatialWindowDragVisualPlan

        x: root.spatialEdgePanPointerX - (plan ? plan.hotSpotX : 0)
        y: root.spatialEdgePanPointerY - (plan ? plan.hotSpotY : 0)
        width: plan ? plan.width : 0
        height: plan ? plan.height : 0
        visible: root.spatialWindowDragVisualIsExact()
        enabled: false
        clip: true
        opacity: root.spatialPresentationProgress
        z: 23000

        Rectangle {
            anchors.fill: parent
            color: "#e61b2432"
        }

        Loader {
            anchors.fill: parent
            active: spatialWindowDragVisual.plan !== null
            asynchronous: false

            sourceComponent: Component {
                KWin.WindowThumbnail {
                    wId: spatialWindowDragVisual.plan ? spatialWindowDragVisual.plan.windowId : ""
                }
            }
        }

        Rectangle {
            anchors.fill: parent
            color: "#12000000"
            border.width: 2
            border.color: "#f2d7e8ff"
            radius: 4
        }
    }

    Item {
        id: spatialColumnDragVisual

        readonly property var plan: root.spatialColumnDragVisualPlan

        x: root.spatialEdgePanPointerX - (plan ? plan.hotSpotX : 0)
        y: root.spatialEdgePanPointerY - (plan ? plan.hotSpotY : 0)
        width: plan ? plan.width : 0
        height: plan ? plan.height : 0
        visible: root.spatialColumnDragVisualIsExact()
        enabled: false
        clip: true
        opacity: root.spatialPresentationProgress
        z: 23001

        Rectangle {
            anchors.fill: parent
            color: "#dc1b2432"
            border.width: 2
            border.color: "#f2d7e8ff"
            radius: 4
        }

        Repeater {
            model: spatialColumnDragVisual.plan ? spatialColumnDragVisual.plan.members : []

            Item {
                required property var modelData

                x: modelData.x
                y: modelData.y
                width: modelData.width
                height: modelData.height
                clip: true

                Rectangle {
                    anchors.fill: parent
                    color: "#d8435368"
                }

                Rectangle {
                    anchors.fill: parent
                    color: "#10000000"
                    border.width: 1
                    border.color: "#b8b8d8ff"
                    radius: 2
                }
            }
        }

        Rectangle {
            anchors.top: parent.top
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.topMargin: 5
            width: Math.max(22, Math.min(38, parent.width - 4))
            height: 7
            color: "#f3f8ff"
            border.width: 1
            border.color: "#b0182433"
            radius: height / 2
        }
    }

    OverviewExitHandoff {
        id: overviewExitHandoffOverlay

        anchors.fill: parent
        handoff: root.overviewExitHandoffCapture
        windowCandidate: root.overviewExitHandoffState
            && root.overviewExitHandoffState.phase === "promoted"
            && root.overviewExitHandoffPromotion
            && root.sceneEffect ? root.sceneEffect.overviewExitHandoffWindow : null
        thumbnailSource: root.overviewExitHandoffPromotion
            && root.overviewExitHandoffPromotion.targetWindowId
            ? root.overviewExitHandoffPromotion.targetWindowId : ""
        sourceRect: root.overviewExitOverlaySourceRect()
        targetRect: root.overviewExitHandoffPromotion
            ? root.overviewExitRectValue(root.overviewExitHandoffPromotion.targetFrame)
            : root.overviewExitHandoffCapture
              ? root.overviewExitRectValue(root.overviewExitHandoffCapture.targetFrame)
              : Qt.rect(0, 0, 1, 1)
        targetOutputGeometry: root.overviewExitOutputGeometry()
        progress: 1 - root.spatialPresentationProgress
        handoffActive: root.spatialExitHandoffActive
        activeOutput: root.outputId
        promotedOutput: root.overviewExitHandoffCapture
            ? root.overviewExitHandoffCapture.targetOutputId : ""
        z: 24000
    }

    Item {
        id: spatialHorizontalRowInput

        anchors.fill: parent
        enabled: root.spatialPointerInputEligible && !root.desktopReorderActive
                 && !root.spatialDirectDragActive
                 && !spatialTouchPanDragHandler.active
                 && !spatialViewportDragHandler.active
                 && !spatialHorizontalViewportDragHandler.active
        z: 9000
        containmentMask: QtObject {
            function contains(point: point) : bool {
                return root.spatialHorizontalViewportRowContains(point);
            }
        }

        DragHandler {
            id: spatialHorizontalRowDragHandler

            target: null
            acceptedButtons: Qt.RightButton
            acceptedDevices: PointerDevice.Mouse
            acceptedModifiers: Qt.NoModifier
            grabPermissions: PointerHandler.TakeOverForbidden
            xAxis.enabled: true
            yAxis.enabled: false

            onActiveChanged: {
                if (active) {
                    root.beginSpatialHorizontalViewportDrag(centroid.pressPosition, true);
                    root.updateSpatialHorizontalViewportDrag(activeTranslation.x);
                } else {
                    root.clearSpatialHorizontalViewportDrag();
                }
            }
            onActiveTranslationChanged: {
                if (active) {
                    root.updateSpatialHorizontalViewportDrag(activeTranslation.x);
                }
            }
        }
    }

    OverviewZoomHud {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: Math.max(8, root.outerMargin * 0.3)
        shown: root.spatialZoomHudShown
        zoom: root.overviewZoom
        opacity: root.spatialExitHandoffActive ? overviewExitHandoffOverlay.chromeOpacity : 1
        z: 19000
    }

    KeyboardHelpHint {
        id: keyboardHelpHint

        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: Math.max(0, (root.outerMargin - height) / 2)
        visible: root.spatialPresentationSettled && !root.keyboardHelpVisible
                 && root.searchQuery.length === 0
        opacity: root.spatialExitHandoffActive ? overviewExitHandoffOverlay.chromeOpacity : 1
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
        opacity: root.spatialExitHandoffActive ? overviewExitHandoffOverlay.chromeOpacity : 1
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
                        { keys: "Ctrl+wheel", action: "Zoom at the pointer" },
                        { keys: "Ctrl++ / Ctrl+-", action: "Zoom in / out" },
                        { keys: "Ctrl+0", action: "Reset session zoom" },
                        { keys: "Pinch", action: "Zoom with a touchpad or touchscreen" },
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
        opacity: root.spatialExitHandoffActive ? overviewExitHandoffOverlay.chromeOpacity : 1
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
        opacity: root.spatialExitHandoffActive ? overviewExitHandoffOverlay.chromeOpacity : 1
        color: "#ffd166"
        radius: lineHeight / 2
        z: 10000
    }

    function planSpatialLayout() {
        const fallback = legacySpatialLayout();
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
                || desktopIds.length <= 0 || spatialLayoutWorkspaceIndex < 0
                || spatialLayoutWorkspaceIndex >= desktopIds.length) {
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
                                                               currentWorkspaceIndex: spatialLayoutWorkspaceIndex,
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

        const horizontalError = Math.abs(plan.cardX) + Math.abs(plan.cardWidth - width);
        const currentCardCenter = plan.edgeMargin - plan.initialContentY
            + spatialLayoutWorkspaceIndex * (plan.cardHeight + plan.gap) + plan.cardHeight / 2;
        return horizontalError <= Math.max(1, width) * 0.000001
            && Math.abs(currentCardCenter - height / 2) <= Math.max(1, height) * 0.000001;
    }

    function legacySpatialLayout() {
        const count = desktopIds.length;
        const zoom = Number.isFinite(overviewZoom) && overviewZoom >= 0.2 && overviewZoom <= 0.75
            ? overviewZoom : 0.5;
        const legacyCardHeight = count > 0 ? Math.max(1, height * zoom) : 0;
        const edgeMargin = Math.max(0, (height - legacyCardHeight) / 2);
        const gap = Math.max(1, Math.min(48, legacyCardHeight * 0.1));
        const stride = legacyCardHeight + gap;
        const contentHeight = Math.max(height, height + Math.max(0, count - 1) * stride);
        return {
            cardHeight: legacyCardHeight,
            cardWidth: Math.max(1, width),
            cardX: 0,
            contentHeight,
            edgeMargin,
            gap,
            initialContentY: Math.min(Math.max(0, contentHeight - height),
                                      Math.max(0, spatialLayoutWorkspaceIndex) * stride)
        };
    }

    function planSpatialVisibleRange() {
        if (desktopIds.length <= 0) {
            return null;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialVisibleRange !== "function") {
            return null;
        }

        const logicalRange = planSpatialVisibleRangeAt(runtime, spatialContentY);
        if (!spatialVisibleRangeIsValid(logicalRange)) {
            return null;
        }

        if (Math.abs(spatialVisualContentY - spatialContentY) <= 0.000001) {
            return logicalRange;
        }

        const visualRange = planSpatialVisibleRangeAt(runtime, spatialVisualContentY);
        if (!spatialVisibleRangeIsValid(visualRange)) {
            return null;
        }

        return {
            firstIndex: Math.min(logicalRange.firstIndex, visualRange.firstIndex),
            lastIndex: Math.max(logicalRange.lastIndex, visualRange.lastIndex)
        };
    }

    function planSpatialVisibleRangeAt(runtime, contentY) {
        try {
            return runtime.planOverviewSpatialVisibleRange({
                                                               sceneHeight: height,
                                                               contentHeight: overviewSpatialLayout.contentHeight,
                                                               contentY,
                                                               edgeMargin: overviewSpatialLayout.edgeMargin,
                                                               cardHeight,
                                                               gap: cardGap,
                                                               workspaceCount: desktopIds.length,
                                                               overscan: 1
                                                           });
        } catch (error) {
            return null;
        }
    }

    function spatialVisibleRangeIsValid(plan) {
        return plan && Number.isInteger(plan.firstIndex) && Number.isInteger(plan.lastIndex)
            && plan.firstIndex >= 0 && plan.firstIndex <= plan.lastIndex
            && plan.lastIndex < desktopIds.length;
    }

    function fallbackSpatialVisibleRange() {
        if (currentWorkspaceIndex >= 0 && currentWorkspaceIndex < desktopIds.length) {
            return {
                firstIndex: currentWorkspaceIndex,
                lastIndex: currentWorkspaceIndex
            };
        }
        return {
            firstIndex: 0,
            lastIndex: -1
        };
    }

    function restartDesktopSurfaceResidency() {
        resetDesktopSurfaceResidency();
        Qt.callLater(root.updateDesktopSurfaceResidency);
    }

    function handleDesktopSurfaceResidencyDesktopIdsChanged() {
        if (desktopSurfaceResidencyContextMatchesCurrent()) {
            Qt.callLater(root.updateDesktopSurfaceResidency);
            return true;
        }

        restartDesktopSurfaceResidency();
        return false;
    }

    function resetDesktopSurfaceResidency() {
        advanceDesktopSurfaceResidencyRequestId();
        desktopSurfaceCandidateRange = null;
        desktopSurfaceCommittedRange = null;
        desktopSurfaceResidencyRange = null;
        desktopSurfaceResidencySessionId = 0;
        desktopSurfaceResidencyOutputId = "";
        desktopSurfaceResidencyActivityId = "";
        desktopSurfaceResidencyDesktopIds = [];
        return true;
    }

    function updateDesktopSurfaceResidency() {
        if (!desktopSurfaceResidencyCurrentContextIsValid()) {
            if (desktopSurfaceResidencySessionId > 0 || desktopSurfaceResidencyRange !== null) {
                resetDesktopSurfaceResidency();
            }
            return false;
        }

        if (!desktopSurfaceResidencyContextMatchesCurrent()) {
            resetDesktopSurfaceResidency();
            desktopSurfaceResidencySessionId = activeOverviewSessionId;
            desktopSurfaceResidencyOutputId = outputId;
            desktopSurfaceResidencyActivityId = activeOverviewActivityId;
            desktopSurfaceResidencyDesktopIds = copyDesktopSurfaceResidencyDesktopIds();
        }

        const candidate = spatialVisibleRangeIsValid(overviewSpatialVisibleRangePlan)
            ? copyDesktopSurfaceResidencyRange(overviewSpatialVisibleRangePlan) : null;
        if (candidate === null) {
            const retained = spatialVisibleRangeIsValid(desktopSurfaceResidencyRange)
                ? copyDesktopSurfaceResidencyRange(desktopSurfaceResidencyRange)
                : spatialVisibleRangeIsValid(desktopSurfaceCommittedRange)
                  ? copyDesktopSurfaceResidencyRange(desktopSurfaceCommittedRange) : null;
            advanceDesktopSurfaceResidencyRequestId();
            const retainedPlan = planDesktopSurfaceResidency(null, retained, false, true);
            if (!desktopSurfaceResidencyPlanIsValid(retainedPlan)) {
                return false;
            }
            desktopSurfaceResidencyRange = retainedPlan;
            return true;
        }

        desktopSurfaceCandidateRange = candidate;
        if (!spatialVisibleRangeIsValid(desktopSurfaceCommittedRange)) {
            desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange(candidate);
        }
        const previous = copyDesktopSurfaceResidencyRange(desktopSurfaceCommittedRange);
        advanceDesktopSurfaceResidencyRequestId();
        const plan = planDesktopSurfaceResidency(candidate, previous, true,
                                                 desktopSurfaceResidencyShouldPinCurrent(candidate));
        if (!desktopSurfaceResidencyPlanIsValid(plan)) {
            return false;
        }

        desktopSurfaceResidencyRange = plan;

        if (!desktopSurfaceResidencyBridgeIsActive()
                && desktopSurfaceResidencyRangesAreEqual(plan, candidate)) {
            desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange(candidate);
        } else if (!desktopSurfaceResidencyBridgeIsActive()) {
            scheduleDesktopSurfaceResidencySettle(candidate);
        }
        return true;
    }

    function planDesktopSurfaceResidency(candidate, previous, retainPrevious, pinCurrent) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewDesktopSurfaceResidency !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewDesktopSurfaceResidency({
                candidateRange: candidate,
                currentWorkspaceIndex,
                pinCurrent,
                previousRange: previous,
                retainPrevious,
                workspaceCount: desktopIds.length
            });
        } catch (error) {
            return null;
        }
    }

    function desktopSurfaceResidencyShouldPinCurrent(candidate) {
        return candidate === null || spatialPresentationPhase !== "open"
            || desktopSurfaceResidencyBridgeIsActive();
    }

    function desktopSurfaceResidencyBridgeIsActive() {
        return spatialVisualContentYDeferred || spatialVerticalCameraAnimation.running
            || spatialZoomApplying || spatialZoomOwner.length > 0
            || spatialZoomTransaction !== null || spatialExternalZoomTransaction !== null
            || spatialExternalZoomActive;
    }

    function finishDesktopSurfaceResidencyBridge() {
        if (desktopSurfaceResidencyBridgeIsActive()
                || !desktopSurfaceResidencyContextMatchesCurrent()) {
            return false;
        }

        const candidate = spatialVisibleRangeIsValid(overviewSpatialVisibleRangePlan)
            ? copyDesktopSurfaceResidencyRange(overviewSpatialVisibleRangePlan) : null;
        if (candidate === null) {
            return updateDesktopSurfaceResidency();
        }

        const plan = planDesktopSurfaceResidency(candidate, null, false,
                                                 spatialPresentationPhase !== "open");
        if (!desktopSurfaceResidencyPlanIsValid(plan)) {
            return false;
        }
        advanceDesktopSurfaceResidencyRequestId();
        desktopSurfaceCandidateRange = copyDesktopSurfaceResidencyRange(candidate);
        desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange(candidate);
        desktopSurfaceResidencyRange = plan;
        return true;
    }

    function scheduleDesktopSurfaceResidencySettle(candidate) {
        const requestId = advanceDesktopSurfaceResidencyRequestId();
        const expectation = {
            activityId: desktopSurfaceResidencyActivityId,
            candidate: copyDesktopSurfaceResidencyRange(candidate),
            desktopIds: copyDesktopSurfaceResidencyDesktopIds(),
            outputId: desktopSurfaceResidencyOutputId,
            sessionId: desktopSurfaceResidencySessionId
        };
        Qt.callLater(root.advanceDesktopSurfaceResidencySettle, requestId, expectation, 0);
        return true;
    }

    function advanceDesktopSurfaceResidencySettle(requestId, expectation, stage) {
        if (!desktopSurfaceResidencyExpectationIsExact(requestId, expectation)) {
            return false;
        }
        if (stage === 0) {
            Qt.callLater(root.advanceDesktopSurfaceResidencySettle, requestId, expectation, 1);
            return true;
        }
        if (stage !== 1) {
            return false;
        }
        if (desktopSurfaceResidencyBridgeIsActive()) {
            return true;
        }

        const plan = planDesktopSurfaceResidency(expectation.candidate, null, false,
                                                 desktopSurfaceResidencyShouldPinCurrent(
                                                     expectation.candidate));
        if (!desktopSurfaceResidencyPlanIsValid(plan)) {
            return false;
        }
        desktopSurfaceCommittedRange = copyDesktopSurfaceResidencyRange(expectation.candidate);
        desktopSurfaceResidencyRange = plan;
        return true;
    }

    function desktopSurfaceResidencyExpectationIsExact(requestId, expectation) {
        try {
            return Number.isInteger(requestId) && requestId > 0
                && requestId === desktopSurfaceResidencyRequestId
                && expectation && !Array.isArray(expectation)
                && desktopSurfaceResidencyContextMatchesCurrent()
                && expectation.sessionId === desktopSurfaceResidencySessionId
                && expectation.outputId === desktopSurfaceResidencyOutputId
                && expectation.activityId === desktopSurfaceResidencyActivityId
                && sameStringList(expectation.desktopIds, desktopSurfaceResidencyDesktopIds)
                && desktopSurfaceResidencyRangesAreEqual(
                    expectation.candidate, desktopSurfaceCandidateRange)
                && desktopSurfaceResidencyRangesAreEqual(
                    expectation.candidate, overviewSpatialVisibleRangePlan);
        } catch (error) {
            return false;
        }
    }

    function desktopSurfaceResidencyCurrentContextIsValid() {
        return sceneEffect && sceneEffect.active === true
            && activeOverviewSessionId > 0 && outputId.length > 0
            && activeOverviewActivityId.length > 0
            && desktopIdListShapeIsValid(desktopIds)
            && desktopIds.length > 0;
    }

    function desktopSurfaceResidencyContextMatchesCurrent() {
        return desktopSurfaceResidencyCurrentContextIsValid()
            && desktopSurfaceResidencySessionId === activeOverviewSessionId
            && desktopSurfaceResidencyOutputId === outputId
            && desktopSurfaceResidencyActivityId === activeOverviewActivityId
            && sameStringList(desktopSurfaceResidencyDesktopIds, desktopIds);
    }

    function desktopSurfaceResidencyPlanIsValid(plan) {
        return spatialVisibleRangeIsValid(plan) && Object.isFrozen(plan)
            && plan.lastIndex - plan.firstIndex + 1 <= desktopSurfaceMaximumResidentRows;
    }

    function desktopSurfaceResidencyRangesAreEqual(first, second) {
        return first && second && Number.isInteger(first.firstIndex)
            && Number.isInteger(first.lastIndex) && first.firstIndex === second.firstIndex
            && first.lastIndex === second.lastIndex;
    }

    function copyDesktopSurfaceResidencyRange(range) {
        return {
            firstIndex: range.firstIndex,
            lastIndex: range.lastIndex
        };
    }

    function copyDesktopSurfaceResidencyDesktopIds() {
        const copied = [];
        for (const desktopId of desktopIds) {
            copied.push(desktopId);
        }
        return copied;
    }

    function advanceDesktopSurfaceResidencyRequestId() {
        desktopSurfaceResidencyRequestId = desktopSurfaceResidencyRequestId >= 2147483646
            ? 1 : desktopSurfaceResidencyRequestId + 1;
        return desktopSurfaceResidencyRequestId;
    }

    function validatedDesktopSurfaceLifecycleEvent() {
        try {
            const controller = sceneEffect ? sceneEffect.controller : null;
            if (!controller) {
                return null;
            }

            const event = controller.desktopSurfaceLifecycleEvent;
            return event !== null && event !== undefined
                && Number.isSafeInteger(event.revision) && event.revision > 0
                && event.revision <= 2147483647 ? event : null;
        } catch (error) {
            return null;
        }
    }

    function desktopCardShouldLoad(index, expectedDesktopId) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopIds.length
                || typeof expectedDesktopId !== "string" || desktopIds[index] !== expectedDesktopId) {
            return false;
        }
        if (desktopCardInteractionEligible(index, expectedDesktopId)) {
            return true;
        }
        return desktopSurfaceResidencyContextMatchesCurrent()
            && spatialVisibleRangeIsValid(desktopSurfaceResidencyRange)
            && index >= desktopSurfaceResidencyRange.firstIndex
            && index <= desktopSurfaceResidencyRange.lastIndex;
    }

    function desktopCardInteractionEligible(index, expectedDesktopId) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopIds.length
                || typeof expectedDesktopId !== "string" || desktopIds[index] !== expectedDesktopId
                || !spatialPresentationInteractive) {
            return false;
        }
        if (searchQuery.length > 0
                || (spatialPresentationPhase !== "open"
                    && index === spatialPresentationWorkspaceIndex)
                || (desktopReorderActive && desktopReorderSourceId === expectedDesktopId)
                || (spatialWindowDragSource !== null
                    && spatialWindowDragSourceDesktopId === expectedDesktopId)
                || (spatialColumnDragSource !== null
                    && spatialColumnDragSourceDesktopId === expectedDesktopId)) {
            return true;
        }

        return spatialVisibleRangeIsValid(overviewSpatialVisibleRangePlan)
            && index >= overviewSpatialVisibleRangePlan.firstIndex
            && index <= overviewSpatialVisibleRangePlan.lastIndex;
    }

    function desktopSurfaceShouldLoad(index, expectedDesktopId, expectedDesktop) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopIds.length
                || typeof expectedDesktopId !== "string" || desktopIds[index] !== expectedDesktopId
                || outputId.length === 0 || !targetScreen
                || !desktopSurfaceResidencyContextMatchesCurrent()
                || !spatialVisibleRangeIsValid(desktopSurfaceResidencyRange)) {
            return false;
        }

        try {
            if (!expectedDesktop || expectedDesktop.id === undefined || expectedDesktop.id === null
                    || String(expectedDesktop.id) !== expectedDesktopId) {
                return false;
            }
        } catch (error) {
            return false;
        }

        return index >= desktopSurfaceResidencyRange.firstIndex
            && index <= desktopSurfaceResidencyRange.lastIndex;
    }

    function desktopCardAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= desktopRepeater.count) {
            return null;
        }

        const loader = desktopRepeater.itemAt(index);
        const expectedDesktopId = desktopIds[index];
        if (!loader || loader.index !== index || loader.modelData !== expectedDesktopId
                || loader.active !== true || !loader.item
                || loader.item.desktopId !== expectedDesktopId
                || loader.item.interactionEligible !== true) {
            return null;
        }

        return loader.item;
    }

    function beginWindowSpatialEdgePan(source, expectedDesktopId, sceneX, sceneY) {
        const workspaceIndex = desktopIds.indexOf(expectedDesktopId);
        if (desktopReorderActive || spatialDirectDragActive
                || spatialHorizontalRowDragHandler.active
                || workspaceIndex < 0 || workspaceIndex >= desktopIds.length
                || !windowSpatialDragSourceIsExact(source, expectedDesktopId)) {
            return;
        }
        if (!adoptSpatialVisualContentY()
                || !storeSpatialEdgePanScenePoint(sceneX, sceneY)) {
            return;
        }

        resetOverviewWheelState();
        spatialWindowDragSource = source;
        spatialWindowDragSourceDesktopId = expectedDesktopId;
        spatialWindowDragSourceWorkspaceIndex = workspaceIndex;
        captureSpatialWindowDragVisual(source);
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

    function beginColumnSpatialEdgePan(source, expectedDesktopId, sceneX, sceneY) {
        const workspaceIndex = desktopIds.indexOf(expectedDesktopId);
        if (desktopReorderActive || spatialDirectDragActive
                || spatialHorizontalRowDragHandler.active
                || workspaceIndex < 0 || workspaceIndex >= desktopIds.length
                || !columnSpatialDragSourceIsExact(source, expectedDesktopId)) {
            cancelColumnSpatialDragOwner(source);
            return;
        }
        if (!adoptSpatialVisualContentY() || !storeSpatialEdgePanScenePoint(sceneX, sceneY)) {
            cancelColumnSpatialDragOwner(source);
            return;
        }

        resetOverviewWheelState();
        spatialColumnDragSource = source;
        spatialColumnDragSourceDesktopId = expectedDesktopId;
        spatialColumnDragSourceWorkspaceIndex = workspaceIndex;
        if (!captureSpatialColumnDragVisual(source)) {
            cancelActiveColumnSpatialDrag();
        }
    }

    function updateColumnSpatialEdgePan(source, expectedDesktopId, sceneX, sceneY) {
        if (source !== spatialColumnDragSource
                || expectedDesktopId !== spatialColumnDragSourceDesktopId) {
            return;
        }
        if (!columnSpatialDragSourceIsExact(source, expectedDesktopId)
                || !storeSpatialEdgePanScenePoint(sceneX, sceneY)) {
            cancelActiveColumnSpatialDrag();
        }
    }

    function finishColumnSpatialEdgePan(source, expectedDesktopId) {
        if (source === spatialColumnDragSource
                && expectedDesktopId === spatialColumnDragSourceDesktopId) {
            resetSpatialEdgePanTracking();
        }
    }

    function beginWindowWorkspaceHover(source, expectedTargetDesktop, expectedTargetDesktopId,
                                       expectedTargetScreen, sceneX, sceneY) {
        resetWindowWorkspaceHover();
        if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY)
                || source !== spatialDirectDragSource
                || !spatialDirectDragSourceIsExact(source, spatialDirectDragSourceDesktopId())) {
            return false;
        }

        const effect = sceneEffect;
        const sessionId = effect && Number.isInteger(effect.activeSessionId)
            ? effect.activeSessionId : 0;
        const currentDesktopId = currentDesktop && currentDesktop.id !== undefined
            && currentDesktop.id !== null ? String(currentDesktop.id) : "";
        const targetWorkspaceIndex = desktopIds.indexOf(expectedTargetDesktopId);
        if (sessionId <= 0 || targetWorkspaceIndex < 0
                || targetWorkspaceIndex >= desktopIds.length
                || desktopIds[targetWorkspaceIndex] !== expectedTargetDesktopId
                || !windowWorkspaceHoverTargetIsExact(source, expectedTargetDesktop,
                                                       expectedTargetDesktopId,
                                                       expectedTargetScreen,
                                                       targetWorkspaceIndex)) {
            return false;
        }

        const plan = planWindowWorkspaceHover(0, sessionId, overviewDesktopCardEpoch,
                                              spatialHorizontalViewportRevision,
                                              currentDesktopId, source.sourceDesktopId,
                                              expectedTargetDesktopId, targetWorkspaceIndex);
        if (!plan || plan.intent !== "pending") {
            return false;
        }

        spatialWindowDragHoverCurrentDesktopId = currentDesktopId;
        spatialWindowDragHoverGeometryEpoch = spatialHorizontalViewportRevision;
        spatialWindowDragHoverModelEpoch = overviewDesktopCardEpoch;
        spatialWindowDragHoverSource = source;
        spatialWindowDragHoverSourceDesktopId = source.sourceDesktopId;
        spatialWindowDragHoverTargetDesktop = expectedTargetDesktop;
        spatialWindowDragHoverTargetDesktopId = expectedTargetDesktopId;
        spatialWindowDragHoverTargetScreen = expectedTargetScreen;
        spatialWindowDragHoverTargetWorkspaceIndex = targetWorkspaceIndex;
        spatialWindowDragHoverSessionId = sessionId;
        spatialWindowDragHoverTimer.restart();
        return true;
    }

    function moveWindowWorkspaceHover(source, expectedTargetDesktop, expectedTargetDesktopId,
                                      expectedTargetScreen, sceneX, sceneY) {
        if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY)) {
            resetWindowWorkspaceHover();
            return false;
        }
        if (!windowWorkspaceHoverOwnershipMatches(source, expectedTargetDesktop,
                                                   expectedTargetDesktopId,
                                                   expectedTargetScreen)) {
            return beginWindowWorkspaceHover(source, expectedTargetDesktop,
                                             expectedTargetDesktopId, expectedTargetScreen,
                                             sceneX, sceneY);
        }
        return true;
    }

    function leaveWindowWorkspaceHover(source, expectedTargetDesktop, expectedTargetDesktopId,
                                       expectedTargetScreen) {
        if (!windowWorkspaceHoverOwnershipMatches(source, expectedTargetDesktop,
                                                   expectedTargetDesktopId,
                                                   expectedTargetScreen)) {
            return false;
        }
        resetWindowWorkspaceHover();
        return true;
    }

    function completeWindowWorkspaceHover() {
        if (!windowWorkspaceHoverContextIsExact()) {
            resetWindowWorkspaceHover();
            return false;
        }

        const plan = planWindowWorkspaceHover(spatialWindowDragHoverThresholdMilliseconds,
                                              spatialWindowDragHoverSessionId,
                                              spatialWindowDragHoverModelEpoch,
                                              spatialWindowDragHoverGeometryEpoch,
                                              spatialWindowDragHoverCurrentDesktopId,
                                              spatialWindowDragHoverSourceDesktopId,
                                              spatialWindowDragHoverTargetDesktopId,
                                              spatialWindowDragHoverTargetWorkspaceIndex);
        if (!plan || plan.intent !== "activate") {
            resetWindowWorkspaceHover();
            return false;
        }

        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(spatialWindowDragHoverTargetScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(spatialWindowDragHoverTargetDesktop,
                                           spatialWindowDragHoverTargetDesktopId);
        const expectedDesktopId = spatialWindowDragHoverTargetDesktopId;
        resetWindowWorkspaceHover();
        return requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                       liveDesktop, expectedDesktopId);
    }

    function planWindowWorkspaceHover(elapsedMilliseconds, sessionId, modelEpoch, geometryEpoch,
                                      expectedCurrentDesktopId, sourceDesktopId, targetDesktopId,
                                      targetWorkspaceIndex) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialDragHover !== "function") {
            return null;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialDragHover({
                activationThresholdMilliseconds: spatialWindowDragHoverThresholdMilliseconds,
                activeGeometryEpoch: spatialHorizontalViewportRevision,
                activeModelEpoch: overviewDesktopCardEpoch,
                activeSessionId: sceneEffect ? sceneEffect.activeSessionId : 0,
                currentDesktopId: currentDesktop && currentDesktop.id !== undefined
                    && currentDesktop.id !== null ? String(currentDesktop.id) : "",
                elapsedMilliseconds,
                geometryEpoch,
                modelEpoch,
                rowCount: desktopIds.length,
                sessionId,
                sourceDesktopId,
                targetDesktopId,
                targetRowIndex: targetWorkspaceIndex
            });
        } catch (error) {
            return null;
        }

        return plan && !Array.isArray(plan)
            && (plan.intent === "pending" || plan.intent === "activate")
            && plan.targetDesktopId === targetDesktopId
            && plan.targetRowIndex === targetWorkspaceIndex
            && expectedCurrentDesktopId === (currentDesktop && currentDesktop.id !== undefined
                && currentDesktop.id !== null ? String(currentDesktop.id) : "")
            ? plan : null;
    }

    function windowWorkspaceHoverContextIsExact() {
        try {
            const source = spatialWindowDragHoverSource;
            const targetDesktop = spatialWindowDragHoverTargetDesktop;
            const targetDesktopId = spatialWindowDragHoverTargetDesktopId;
            const targetScreen = spatialWindowDragHoverTargetScreen;
            const targetWorkspaceIndex = spatialWindowDragHoverTargetWorkspaceIndex;
            const card = desktopCardAt(targetWorkspaceIndex);
            return spatialWindowDragHoverSessionId > 0
                && sceneEffect && sceneEffect.active === true
                && sceneEffect.activeSessionId === spatialWindowDragHoverSessionId
                && sceneEffect.overviewModel === overviewModel
                && overviewDesktopCardEpoch === spatialWindowDragHoverModelEpoch
                && spatialHorizontalViewportRevision === spatialWindowDragHoverGeometryEpoch
                && windowWorkspaceHoverOwnershipMatches(source, targetDesktop,
                                                         targetDesktopId, targetScreen)
                && windowWorkspaceHoverTargetIsExact(source, targetDesktop, targetDesktopId,
                                                      targetScreen, targetWorkspaceIndex)
                && card && spatialDirectDropHoverOwnedByCard(card, source);
        } catch (error) {
            return false;
        }
    }

    function windowWorkspaceHoverOwnershipMatches(source, expectedTargetDesktop,
                                                   expectedTargetDesktopId, expectedTargetScreen) {
        return spatialWindowDragHoverSource !== null && source === spatialWindowDragHoverSource
            && expectedTargetDesktop === spatialWindowDragHoverTargetDesktop
            && expectedTargetDesktopId === spatialWindowDragHoverTargetDesktopId
            && expectedTargetScreen === spatialWindowDragHoverTargetScreen;
    }

    function windowWorkspaceHoverTargetIsExact(source, expectedTargetDesktop,
                                                expectedTargetDesktopId, expectedTargetScreen,
                                                targetWorkspaceIndex) {
        try {
            return source && source.sourceDesktopId !== expectedTargetDesktopId
                && expectedTargetDesktop && expectedTargetDesktop.id !== undefined
                && expectedTargetDesktop.id !== null
                && String(expectedTargetDesktop.id) === expectedTargetDesktopId
                && expectedTargetScreen === targetScreen
                && liveScreenFor(expectedTargetScreen) === expectedTargetScreen
                && Number.isInteger(targetWorkspaceIndex) && targetWorkspaceIndex >= 0
                && targetWorkspaceIndex < desktopIds.length
                && desktopIds[targetWorkspaceIndex] === expectedTargetDesktopId
                && desktopForId(expectedTargetDesktopId) === expectedTargetDesktop;
        } catch (error) {
            return false;
        }
    }

    function resetWindowWorkspaceHover() {
        spatialWindowDragHoverTimer.stop();
        spatialWindowDragHoverCurrentDesktopId = "";
        spatialWindowDragHoverGeometryEpoch = -1;
        spatialWindowDragHoverModelEpoch = -1;
        spatialWindowDragHoverSource = null;
        spatialWindowDragHoverSourceDesktopId = "";
        spatialWindowDragHoverTargetDesktop = null;
        spatialWindowDragHoverTargetDesktopId = "";
        spatialWindowDragHoverTargetScreen = null;
        spatialWindowDragHoverTargetWorkspaceIndex = -1;
        spatialWindowDragHoverSessionId = 0;
    }

    function windowSpatialDragSourceIsExact(source, expectedDesktopId) {
        try {
            if (!spatialPresentationInteractive || !sceneEffect || sceneEffect.active !== true || !source
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

    function columnSpatialDragSourceIsExact(source, expectedDesktopId) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            const candidate = source ? source.candidate : null;
            const liveDesktop = source ? source.sourceDesktop : null;
            const liveScreen = source ? source.sourceScreen : null;
            return spatialPresentationInteractive && sceneEffect && sceneEffect.active === true
                && source && (source === spatialColumnDragSource
                              || spatialColumnDragSource === null && spatialWindowDragSource === null)
                && source.scope === "column" && source.columnSpatialDragLifecycleActive === true
                && source.dragEligible === true && source.sourceDesktopId === expectedDesktopId
                && typeof source.selectedWindowId === "string" && source.selectedWindowId.length > 0
                && sourceCard && typeof sourceCard.ownedColumnDropSnapshotIsExact === "function"
                && sourceCard.ownedColumnDropSnapshotIsExact(source)
                && candidate && !candidate.deleted && candidate.internalId !== undefined
                && candidate.internalId !== null
                && String(candidate.internalId) === source.selectedWindowId
                && liveDesktop && liveDesktop.id !== undefined && liveDesktop.id !== null
                && String(liveDesktop.id) === expectedDesktopId
                && liveScreen && liveScreen === targetScreen && candidate.output === liveScreen;
        } catch (error) {
            return false;
        }
    }

    function spatialDirectDragSourceIsExact(source, expectedDesktopId) {
        return source === spatialColumnDragSource
            ? columnSpatialDragSourceIsExact(source, expectedDesktopId)
            : source === spatialWindowDragSource
              && windowSpatialDragSourceIsExact(source, expectedDesktopId);
    }

    function spatialDirectDragSourceDesktopId() {
        return spatialColumnDragSource !== null
            ? spatialColumnDragSourceDesktopId : spatialWindowDragSourceDesktopId;
    }

    function spatialDirectDragSourceWorkspaceIndex() {
        return spatialColumnDragSource !== null
            ? spatialColumnDragSourceWorkspaceIndex : spatialWindowDragSourceWorkspaceIndex;
    }

    function spatialDirectDropHoverOwnedByCard(card, source) {
        return source === spatialColumnDragSource
            ? card.columnDropHoverOwned === true && card.columnDropHoverSource === source
            : source === spatialWindowDragSource
              && card.windowDropHoverOwned === true && card.windowDropHoverSource === source;
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
        spatialEdgePanPointerX = point.x;
        spatialEdgePanPointerY = point.y;
        return true;
    }

    function clearSpatialEdgePanScenePoint() {
        spatialEdgePanSceneX = Number.NaN;
        spatialEdgePanSceneY = Number.NaN;
        spatialEdgePanPointerX = Number.NaN;
        spatialEdgePanPointerY = Number.NaN;
    }

    function captureSpatialWindowDragVisual(source) {
        clearSpatialWindowDragVisual();
        try {
            const target = source ? source.thumbnailTarget : null;
            const hotSpot = target ? target.spatialDragHotSpot : null;
            if (!target || !hotSpot || typeof source.windowId !== "string"
                    || source.windowId.length === 0 || !Number.isFinite(target.width)
                    || !Number.isFinite(target.height) || target.width <= 0 || target.height <= 0
                    || !Number.isFinite(hotSpot.x) || !Number.isFinite(hotSpot.y)) {
                return false;
            }

            const visualFrame = target.mapToItem(root, 0, 0, target.width, target.height);
            const mappedHotSpot = target.mapToItem(root, hotSpot.x, hotSpot.y);
            if (!visualFrame || !mappedHotSpot
                    || !Number.isFinite(visualFrame.x) || !Number.isFinite(visualFrame.y)
                    || !Number.isFinite(visualFrame.width) || !Number.isFinite(visualFrame.height)
                    || !Number.isFinite(mappedHotSpot.x) || !Number.isFinite(mappedHotSpot.y)) {
                return false;
            }

            const visualWidth = visualFrame.width;
            const visualHeight = visualFrame.height;
            const visualHotSpotX = mappedHotSpot.x - visualFrame.x;
            const visualHotSpotY = mappedHotSpot.y - visualFrame.y;
            if (!Number.isFinite(visualWidth) || visualWidth <= 0
                    || !Number.isFinite(visualHeight) || visualHeight <= 0
                    || !Number.isFinite(visualHotSpotX) || !Number.isFinite(visualHotSpotY)) {
                return false;
            }

            spatialWindowDragVisualPlan = Object.freeze({
                height: visualHeight,
                hotSpotX: visualHotSpotX,
                hotSpotY: visualHotSpotY,
                width: visualWidth,
                windowId: source.windowId
            });
            return true;
        } catch (error) {
            clearSpatialWindowDragVisual();
            return false;
        }
    }

    function clearSpatialWindowDragVisual() {
        spatialWindowDragVisualPlan = null;
    }

    function spatialWindowDragVisualIsExact() {
        try {
            const plan = spatialWindowDragVisualPlan;
            return spatialWindowDragSource !== null
                && spatialWindowDragSource.dragEligible === true
                && spatialWindowDragSource.minimizedWindow !== true
                && spatialWindowDragSource.spatialDragLifecycleActive === true
                && plan && Object.isFrozen(plan)
                && spatialWindowDragSource.windowId === plan.windowId
                && plan.windowId.length > 0
                && Number.isFinite(spatialEdgePanPointerX)
                && Number.isFinite(spatialEdgePanPointerY)
                && Number.isFinite(plan.width) && plan.width > 0
                && Number.isFinite(plan.height) && plan.height > 0
                && Number.isFinite(plan.hotSpotX) && Number.isFinite(plan.hotSpotY);
        } catch (error) {
            return false;
        }
    }

    function captureSpatialColumnDragVisual(source) {
        clearSpatialColumnDragVisual();
        try {
            const target = source ? source.columnVisualTarget : null;
            const hotSpot = source ? source.spatialDragHotSpot : null;
            const snapshot = source ? source.columnDragSnapshot : null;
            if (!target || !hotSpot || !snapshot || !Object.isFrozen(snapshot)
                    || !Array.isArray(snapshot.records) || snapshot.records.length > 256
                    || typeof source.selectedWindowId !== "string" || source.selectedWindowId.length === 0
                    || !Number.isFinite(target.width) || !Number.isFinite(target.height)
                    || target.width <= 0 || target.height <= 0
                    || !Number.isFinite(hotSpot.x) || !Number.isFinite(hotSpot.y)) {
                return false;
            }

            const visualFrame = target.mapToItem(root, 0, 0, target.width, target.height);
            const mappedHotSpot = target.mapToItem(root, hotSpot.x, hotSpot.y);
            if (!visualFrame || !mappedHotSpot
                    || !Number.isFinite(visualFrame.x) || !Number.isFinite(visualFrame.y)
                    || !Number.isFinite(visualFrame.width) || !Number.isFinite(visualFrame.height)
                    || visualFrame.width <= 0 || visualFrame.height <= 0
                    || !Number.isFinite(mappedHotSpot.x) || !Number.isFinite(mappedHotSpot.y)) {
                return false;
            }

            const members = [];
            for (const record of snapshot.records) {
                const memberTarget = record ? record.thumbnailTarget : null;
                if (!memberTarget || members.length >= 32) {
                    continue;
                }
                const memberFrame = memberTarget.mapToItem(root, 0, 0,
                                                           memberTarget.width, memberTarget.height);
                if (!memberFrame || !Number.isFinite(memberFrame.x) || !Number.isFinite(memberFrame.y)
                        || !Number.isFinite(memberFrame.width) || memberFrame.width <= 0
                        || !Number.isFinite(memberFrame.height) || memberFrame.height <= 0) {
                    return false;
                }
                members.push(Object.freeze({
                    height: memberFrame.height,
                    width: memberFrame.width,
                    windowId: record.windowId,
                    x: memberFrame.x - visualFrame.x,
                    y: memberFrame.y - visualFrame.y
                }));
            }
            if (members.length === 0) {
                return false;
            }
            Object.freeze(members);
            spatialColumnDragVisualPlan = Object.freeze({
                height: visualFrame.height,
                hotSpotX: mappedHotSpot.x - visualFrame.x,
                hotSpotY: mappedHotSpot.y - visualFrame.y,
                members,
                snapshot,
                width: visualFrame.width,
                windowId: source.selectedWindowId
            });
            return true;
        } catch (error) {
            clearSpatialColumnDragVisual();
            return false;
        }
    }

    function clearSpatialColumnDragVisual() {
        spatialColumnDragVisualPlan = null;
    }

    function spatialColumnDragVisualIsExact() {
        try {
            const source = spatialColumnDragSource;
            const plan = spatialColumnDragVisualPlan;
            return source && columnSpatialDragSourceIsExact(source, spatialColumnDragSourceDesktopId)
                && plan && Object.isFrozen(plan) && Object.isFrozen(plan.members)
                && plan.snapshot === source.columnDragSnapshot
                && plan.windowId === source.selectedWindowId && plan.windowId.length > 0
                && plan.members.length > 0 && plan.members.length <= 32
                && Number.isFinite(spatialEdgePanPointerX) && Number.isFinite(spatialEdgePanPointerY)
                && Number.isFinite(plan.width) && plan.width > 0
                && Number.isFinite(plan.height) && plan.height > 0
                && Number.isFinite(plan.hotSpotX) && Number.isFinite(plan.hotSpotY);
        } catch (error) {
            return false;
        }
    }

    function cancelActiveColumnSpatialDrag() {
        const source = spatialColumnDragSource;
        if (source === null) {
            return false;
        }
        cancelColumnSpatialDragOwner(source);
        if (spatialColumnDragSource === source) {
            resetSpatialEdgePanTracking();
        }
        return true;
    }

    function cancelColumnSpatialDragOwner(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            if (sourceCard && typeof sourceCard.cancelColumnSpatialDragSource === "function") {
                sourceCard.cancelColumnSpatialDragSource(source);
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    function resetSpatialEdgePanTracking() {
        resetWindowWorkspaceHover();
        clearWorkspaceGapPreview();
        clearSpatialWindowDragVisual();
        clearSpatialColumnDragVisual();
        spatialColumnDragSource = null;
        spatialColumnDragSourceDesktopId = "";
        spatialColumnDragSourceWorkspaceIndex = -1;
        spatialWindowDragSource = null;
        spatialWindowDragSourceDesktopId = "";
        spatialWindowDragSourceWorkspaceIndex = -1;
        clearSpatialEdgePanScenePoint();
    }

    function handleSpatialPresentationPhaseChanged() {
        if (spatialPresentationPhase === "closing") {
            cancelActiveColumnSpatialDrag();
            cancelSpatialZoomTransaction();
            if (!spatialExitHandoffActive) {
                spatialPresentationWorkspaceIndex = currentWorkspaceIndex;
            }
            if (!adoptSpatialVisualContentY()) {
                spatialVerticalCameraAnimation.stop();
            }
            cancelKeyboardBoundaryNavigation();
            resetOverviewWheelState();
            resetDesktopReorder();
            resetSpatialEdgePanTracking();
            clearSpatialTouchPan();
            clearSpatialHorizontalViewportDrag();
            spatialViewportInput.panLayout = null;
            spatialViewportInput.panStartContentY = 0;
            keyboardSelectionViewportTarget = null;
            synchronizeSpatialZoomInputState();
            return;
        }

        if (spatialPresentationPhase === "opening") {
            cancelSpatialZoomTransaction();
            spatialPresentationWorkspaceIndex = currentWorkspaceIndex >= 0
                && currentWorkspaceIndex < desktopIds.length ? currentWorkspaceIndex : 0;
            synchronizeSpatialZoomInputState();
            return;
        }

        if (spatialKeyboardInputEligible) {
            forceActiveFocus();
        }
        synchronizeSpatialZoomInputState();
    }

    function resetOverviewSession() {
        cancelSpatialZoomTransaction();
        clearExternalSpatialZoom();
        invalidateDesktopTopologyRefresh();
        resetSpatialLiveCameraSession();
        clearSpatialTouchPan();
        keyboardSelectionViewportTarget = null;
        keyboardSelectionId = "";
        keyboardHelpVisible = false;
        searchQuery = "";
        spatialHorizontalDesktopIds = [];
        spatialHorizontalGeometryPlans = [];
        spatialHorizontalViewportOffsets = [];
        spatialViewportSnapshot = null;
        refreshOverviewSpatialSession(false);
        restartDesktopSurfaceResidency();
        return true;
    }

    function beginOverviewContextRefreshBarrier() {
        cancelActiveColumnSpatialDrag();
        cancelSpatialZoomTransaction();
        discardSpatialZoomTransaction();
        invalidateDesktopTopologyRefresh();
        cancelKeyboardBoundaryNavigation();
        resetOverviewWheelState();
        resetDesktopReorder();
        resetSpatialEdgePanTracking();
        clearSpatialTouchPan();
        clearSpatialHorizontalViewportDrag();
        spatialViewportInput.panLayout = null;
        spatialViewportInput.panStartContentY = 0;
        keyboardSelectionViewportTarget = null;
        if (!adoptSpatialVisualContentY()) {
            spatialVerticalCameraAnimation.stop();
        }
        synchronizeSpatialZoomInputState();
        return true;
    }

    function finishOverviewContextRefreshBarrier() {
        if (!overviewContextModelExact || overviewContextRefreshPending
                || !sceneEffect || sceneEffect.active !== true) {
            return false;
        }
        synchronizeSpatialZoomInputState();
        if (spatialKeyboardInputEligible) {
            forceActiveFocus();
        }
        Qt.callLater(root.repairKeyboardSelection);
        return true;
    }

    function synchronizeSpatialZoomInputState() {
        if (spatialZoomRegistrationSuppressed) {
            return false;
        }
        const effect = sceneEffect;
        const sessionId = effect && Number.isInteger(effect.activeSessionId)
            ? effect.activeSessionId : 0;
        const expectedOutputId = outputId;
        if (spatialZoomRegisteredEffect !== null
                && (spatialZoomRegisteredEffect !== effect
                    || spatialZoomRegisteredSessionId !== sessionId
                    || spatialZoomRegisteredOutputId !== expectedOutputId)) {
            clearSpatialZoomInputState();
        }
        if (!effect || typeof effect.applyOverviewZoomInputState !== "function"
                || effect.active !== true || sessionId <= 0 || expectedOutputId.length === 0) {
            return false;
        }

        let accepted = false;
        try {
            accepted = effect.applyOverviewZoomInputState(
                sessionId, expectedOutputId, spatialZoomSceneToken,
                spatialZoomSceneRegistrationEligible) === true;
        } catch (error) {
            accepted = false;
        }
        if (accepted) {
            spatialZoomRegisteredEffect = effect;
            spatialZoomRegisteredSessionId = sessionId;
            spatialZoomRegisteredOutputId = expectedOutputId;
        }
        return accepted;
    }

    function clearSpatialZoomInputState() {
        const effect = spatialZoomRegisteredEffect;
        const sessionId = spatialZoomRegisteredSessionId;
        const expectedOutputId = spatialZoomRegisteredOutputId;
        spatialZoomRegisteredEffect = null;
        spatialZoomRegisteredSessionId = 0;
        spatialZoomRegisteredOutputId = "";
        if (!effect || typeof effect.clearOverviewZoomInputState !== "function"
                || sessionId <= 0 || expectedOutputId.length === 0) {
            return false;
        }
        try {
            return effect.clearOverviewZoomInputState(
                sessionId, expectedOutputId, spatialZoomSceneToken) === true;
        } catch (error) {
            return false;
        }
    }

    function destroySpatialZoomScene() {
        spatialZoomRegistrationSuppressed = true;
        cancelSpatialZoomTransaction(false);
        clearExternalSpatialZoom();
        clearSpatialZoomInputState();
        clearSpatialZoomTransactionState();
    }

    function discardSpatialZoomTransaction() {
        if (spatialZoomTransaction === null && spatialZoomOwner.length === 0) {
            return false;
        }
        const wasApplying = spatialZoomApplying;
        const wasRegistrationSuppressed = spatialZoomRegistrationSuppressed;
        spatialZoomApplying = true;
        spatialZoomRegistrationSuppressed = true;
        try {
            clearSpatialZoomInputState();
            clearSpatialZoomTransactionState();
        } finally {
            spatialZoomApplying = wasApplying;
            spatialZoomRegistrationSuppressed = wasRegistrationSuppressed;
        }
        return true;
    }

    function handleExternalSpatialZoomDirectionChanged() {
        const direction = overviewZoomGestureDirection;
        spatialExternalZoomFinalizeRequestId = spatialExternalZoomFinalizeRequestId >= 2147483647
            ? 1 : spatialExternalZoomFinalizeRequestId + 1;
        const requestId = spatialExternalZoomFinalizeRequestId;
        if (direction === "in" || direction === "out") {
            if (spatialExternalZoomTransaction !== null) {
                clearExternalSpatialZoom();
            }
            return beginExternalSpatialZoom(direction);
        }

        Qt.callLater(function() {
            if (requestId === root.spatialExternalZoomFinalizeRequestId
                    && root.overviewZoomGestureDirection.length === 0) {
                root.clearExternalSpatialZoom();
            }
        });
        return true;
    }

    function captureSpatialZoomHorizontalOffsets() {
        if (!sameStringList(spatialHorizontalDesktopIds, desktopIds)
                || spatialHorizontalViewportOffsets.length !== desktopIds.length) {
            return null;
        }

        const snapshot = [];
        const knownIds = Object.create(null);
        for (let index = 0; index < desktopIds.length; index += 1) {
            const desktopId = desktopIds[index];
            const offset = spatialHorizontalViewportOffsets[index];
            if (typeof desktopId !== "string" || desktopId.length === 0
                    || knownIds[desktopId] === true || !Number.isFinite(offset)) {
                return null;
            }
            knownIds[desktopId] = true;
            snapshot.push({ desktopId, offset });
        }
        return snapshot;
    }

    function restoreSpatialZoomHorizontalOffsets(snapshot) {
        if (!snapshot || !Number.isInteger(snapshot.length) || snapshot.length > 512
                || !sameStringList(spatialHorizontalDesktopIds, desktopIds)
                || spatialHorizontalViewportOffsets.length !== desktopIds.length) {
            return false;
        }

        const offsetsByDesktopId = Object.create(null);
        for (const entry of snapshot) {
            if (!entry || typeof entry.desktopId !== "string" || entry.desktopId.length === 0
                    || offsetsByDesktopId[entry.desktopId] !== undefined
                    || !Number.isFinite(entry.offset)) {
                return false;
            }
            offsetsByDesktopId[entry.desktopId] = entry.offset;
        }
        for (let index = 0; index < desktopIds.length; index += 1) {
            const desktopId = desktopIds[index];
            const offset = offsetsByDesktopId[desktopId];
            if (!Number.isFinite(offset)) {
                continue;
            }
            const bounds = spatialHorizontalViewportBounds(index, desktopId);
            if (!bounds || !setSpatialHorizontalViewportOffsetForBounds(
                    index, desktopId,
                    Math.min(bounds.maximum, Math.max(bounds.minimum, offset)), bounds)) {
                return false;
            }
        }
        return true;
    }

    function beginExternalSpatialZoom(direction) {
        if ((direction !== "in" && direction !== "out") || spatialZoomOwner.length > 0
                || !spatialZoomInputEligible || !sceneEffect
                || overviewZoomGestureSessionId !== sceneEffect.activeSessionId) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialZoomBegin !== "function") {
            return false;
        }
        let transaction = null;
        try {
            transaction = runtime.planOverviewSpatialZoomBegin({
                                                                    anchorSceneY: height / 2,
                                                                    contentY: spatialContentY,
                                                                    currentWorkspaceIndex,
                                                                    sceneHeight: height,
                                                                    sceneWidth: width,
                                                                    workspaceCount: desktopIds.length,
                                                                    zoom: overviewZoom
                                                                });
        } catch (error) {
            return false;
        }
        if (!transaction) {
            return false;
        }

        const copiedDesktopIds = [];
        for (const desktopId of desktopIds) {
            if (typeof desktopId !== "string" || desktopId.length === 0) {
                return false;
            }
            copiedDesktopIds.push(desktopId);
        }
        const horizontalOffsets = captureSpatialZoomHorizontalOffsets();
        if (horizontalOffsets === null) {
            return false;
        }
        spatialExternalZoomContext = {
            desktopIds: copiedDesktopIds,
            height,
            horizontalOffsets,
            model: overviewModel,
            outputId,
            sessionId: sceneEffect.activeSessionId,
            topologyRevision: desktopTopologyRevision,
            width
        };
        spatialExternalZoomTransaction = transaction;
        return true;
    }

    function applyExternalSpatialZoom() {
        const context = spatialExternalZoomContext;
        const transaction = spatialExternalZoomTransaction;
        const effect = sceneEffect;
        if (!context || !transaction || !effect || effect.active !== true
                || effect.activeSessionId !== context.sessionId
                || overviewModel !== context.model || effect.overviewModel !== context.model
                || outputId !== context.outputId || desktopTopologyRevision !== context.topologyRevision
                || width !== context.width || height !== context.height
                || currentWorkspaceIndex !== transaction.currentWorkspaceIndex
                || !sameStringList(desktopIds, context.desktopIds)
                || Math.abs(spatialContentY - transaction.previewContentY) > 0.000001
                || !Number.isFinite(overviewZoom) || transaction.originZoom <= 0) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        let plan = null;
        if (runtime && typeof runtime.planOverviewSpatialZoomPreview === "function") {
            try {
                plan = runtime.planOverviewSpatialZoomPreview({
                                                                  scale: overviewZoom / transaction.originZoom,
                                                                  transaction
                                                              });
            } catch (error) {
                plan = null;
            }
        }
        if (!plan || !plan.transaction) {
            return false;
        }

        spatialZoomApplying = true;
        let applied = false;
        try {
            applied = setSpatialContentY(plan.contentY, false);
            if (applied) {
                applied = refreshSpatialHorizontalViewports(true);
                if (overviewZoomGestureDirection.length === 0
                        && Math.abs(overviewZoom - transaction.originZoom) <= 0.000001) {
                    applied = applied
                        && restoreSpatialZoomHorizontalOffsets(context.horizontalOffsets);
                }
                if (applied) {
                    spatialExternalZoomTransaction = plan.transaction;
                    captureSpatialViewportSnapshot();
                }
            }
        } finally {
            spatialZoomApplying = false;
        }
        return applied;
    }

    function clearExternalSpatialZoom() {
        spatialExternalZoomContext = null;
        spatialExternalZoomTransaction = null;
    }

    function recoverExternalSpatialZoomContext() {
        const context = spatialExternalZoomContext;
        const horizontalOffsets = context && context.horizontalOffsets
            ? context.horizontalOffsets : null;
        clearExternalSpatialZoom();
        refreshOverviewSpatialSession(true);
        if (horizontalOffsets !== null) {
            restoreSpatialZoomHorizontalOffsets(horizontalOffsets);
        }
    }

    function beginSpatialZoomTransaction(owner, anchorSceneY) {
        if (spatialZoomFinishing || spatialZoomOwner.length > 0
                || spatialExternalZoomActive || spatialExternalZoomTransaction !== null
                || (owner !== "wheel" && owner !== "keyboard" && owner !== "touchscreen")
                || !spatialZoomInputEligible || !Number.isFinite(anchorSceneY)
                || anchorSceneY < 0 || anchorSceneY > height) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialZoomBegin !== "function") {
            return false;
        }

        let transaction = null;
        try {
            transaction = runtime.planOverviewSpatialZoomBegin({
                                                                    anchorSceneY,
                                                                    contentY: spatialContentY,
                                                                    currentWorkspaceIndex,
                                                                    sceneHeight: height,
                                                                    sceneWidth: width,
                                                                    workspaceCount: desktopIds.length,
                                                                    zoom: overviewZoom
                                                                });
        } catch (error) {
            return false;
        }
        if (!transaction) {
            return false;
        }

        const copiedDesktopIds = [];
        for (const desktopId of desktopIds) {
            if (typeof desktopId !== "string" || desktopId.length === 0) {
                return false;
            }
            copiedDesktopIds.push(desktopId);
        }

        const horizontalOffsets = captureSpatialZoomHorizontalOffsets();
        if (horizontalOffsets === null) {
            return false;
        }

        spatialZoomDesktopIds = copiedDesktopIds;
        spatialZoomHeight = height;
        spatialZoomHorizontalOffsets = horizontalOffsets;
        spatialZoomModel = overviewModel;
        spatialZoomOutputId = outputId;
        spatialZoomSessionId = sceneEffect.activeSessionId;
        spatialZoomTopologyRevision = desktopTopologyRevision;
        spatialZoomTransaction = transaction;
        spatialZoomWidth = width;
        spatialZoomOwner = owner;
        synchronizeSpatialZoomInputState();
        return true;
    }

    function spatialZoomSessionContextIsCurrent() {
        const effect = sceneEffect;
        return spatialZoomSessionId > 0 && effect && effect.active === true
            && effect.activeSessionId === spatialZoomSessionId
            && overviewModel === spatialZoomModel && effect.overviewModel === spatialZoomModel;
    }

    function spatialZoomContextIsExact() {
        const transaction = spatialZoomTransaction;
        return spatialZoomOwner.length > 0 && transaction
            && spatialZoomSessionContextIsCurrent()
            && spatialPresentationPhase === "open" && spatialPresentationProgress >= 1
            && outputId === spatialZoomOutputId
            && desktopTopologyRevision === spatialZoomTopologyRevision
            && width === spatialZoomWidth && height === spatialZoomHeight
            && currentWorkspaceIndex === transaction.currentWorkspaceIndex
            && sameStringList(desktopIds, spatialZoomDesktopIds)
            && Math.abs(spatialContentY - transaction.previewContentY) <= 0.000001
            && Math.abs(overviewZoom - transaction.previewZoom) <= 0.000001;
    }

    function applySpatialZoomPlan(plan) {
        if (!plan || !Number.isFinite(plan.zoom) || !Number.isFinite(plan.contentY)
                || !Number.isFinite(plan.maximumContentY) || !spatialZoomContextIsExact()
                || !sceneEffect || typeof sceneEffect.setOverviewSessionZoom !== "function") {
            return false;
        }

        spatialZoomApplying = true;
        let applied = false;
        const previousZoom = spatialZoomTransaction.previewZoom;
        const previousContentY = spatialZoomTransaction.previewContentY;
        const previousHorizontalOffsets = captureSpatialZoomHorizontalOffsets();
        try {
            if (previousHorizontalOffsets === null) {
                return false;
            }
            const result = sceneEffect.setOverviewSessionZoom(
                spatialZoomSessionId, spatialZoomOutputId, spatialZoomSceneToken, plan.zoom);
            if (result === false && Math.abs(overviewZoom - plan.zoom) > 0.000001) {
                return false;
            }
            if (!setSpatialContentY(plan.contentY, false)) {
                return false;
            }
            if (!refreshSpatialHorizontalViewports(true)) {
                return false;
            }
            captureSpatialViewportSnapshot();
            applied = true;
        } catch (error) {
            applied = false;
        } finally {
            if (!applied && previousHorizontalOffsets !== null) {
                try {
                    const rollbackResult = sceneEffect.setOverviewSessionZoom(
                        spatialZoomSessionId, spatialZoomOutputId,
                        spatialZoomSceneToken, previousZoom);
                    if ((rollbackResult === true
                            || Math.abs(overviewZoom - previousZoom) <= 0.000001)
                            && setSpatialContentY(previousContentY, false)
                            && refreshSpatialHorizontalViewports(false)
                            && restoreSpatialZoomHorizontalOffsets(previousHorizontalOffsets)) {
                        captureSpatialViewportSnapshot();
                    }
                } catch (error) {
                }
            }
            spatialZoomApplying = false;
        }
        return applied;
    }

    function previewSpatialZoomTransaction(scale) {
        if (!Number.isFinite(scale) || !spatialZoomContextIsExact()) {
            return false;
        }
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialZoomPreview !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialZoomPreview({
                                                              scale,
                                                              transaction: spatialZoomTransaction
                                                          });
        } catch (error) {
            return false;
        }
        if (!plan || !plan.transaction || !applySpatialZoomPlan(plan)) {
            return false;
        }
        spatialZoomTransaction = plan.transaction;
        return true;
    }

    function applyControllerSpatialZoomRollback() {
        const transaction = spatialZoomTransaction;
        const effect = sceneEffect;
        if (spatialZoomFinishing || !transaction || !effect || effect.active !== true
                || effect.activeSessionId !== spatialZoomSessionId
                || overviewModel !== spatialZoomModel || effect.overviewModel !== spatialZoomModel
                || outputId !== spatialZoomOutputId
                || desktopTopologyRevision !== spatialZoomTopologyRevision
                || width !== spatialZoomWidth || height !== spatialZoomHeight
                || currentWorkspaceIndex !== transaction.currentWorkspaceIndex
                || !sameStringList(desktopIds, spatialZoomDesktopIds)
                || Math.abs(spatialContentY - transaction.previewContentY) > 0.000001
                || Math.abs(overviewZoom - transaction.originZoom) > 0.000001) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        let plan = null;
        if (runtime && typeof runtime.planOverviewSpatialZoomFinish === "function") {
            try {
                plan = runtime.planOverviewSpatialZoomFinish({
                                                                 disposition: "cancel",
                                                                 transaction
                                                             });
            } catch (error) {
                plan = null;
            }
        }
        if (!plan) {
            return false;
        }

        spatialZoomFinishing = true;
        spatialZoomApplying = true;
        let restored = false;
        try {
            restored = setSpatialContentY(plan.contentY, false)
                && refreshSpatialHorizontalViewports(true)
                && restoreSpatialZoomHorizontalOffsets(spatialZoomHorizontalOffsets);
            if (restored) {
                captureSpatialViewportSnapshot();
            }
        } finally {
            spatialZoomApplying = false;
        }
        clearSpatialZoomTransactionState();
        spatialZoomFinishing = false;
        synchronizeSpatialZoomInputState();
        return restored;
    }

    function finishSpatialZoomTransaction(disposition) {
        if (spatialZoomFinishing || spatialZoomOwner.length === 0 || !spatialZoomTransaction
                || (disposition !== "commit" && disposition !== "cancel")) {
            return false;
        }

        spatialZoomFinishing = true;
        const transaction = spatialZoomTransaction;
        const exactContext = spatialZoomContextIsExact();
        const runtime = OverviewRuntime.DriftileOverview;
        let plan = null;
        if (runtime && typeof runtime.planOverviewSpatialZoomFinish === "function") {
            try {
                plan = runtime.planOverviewSpatialZoomFinish({ disposition, transaction });
            } catch (error) {
                plan = null;
            }
        }

        let finished = false;
        if (exactContext && plan) {
            finished = applySpatialZoomPlan(plan);
            if (finished && disposition === "cancel") {
                finished = restoreSpatialZoomHorizontalOffsets(spatialZoomHorizontalOffsets);
            }
        }
        const needsOriginFallback = !exactContext || !plan
            || (disposition === "cancel" && !finished);
        if (needsOriginFallback && spatialZoomSessionContextIsCurrent()
                && sceneEffect && typeof sceneEffect.setOverviewSessionZoom === "function") {
            spatialZoomApplying = true;
            try {
                const result = sceneEffect.setOverviewSessionZoom(
                    spatialZoomSessionId, spatialZoomOutputId,
                    spatialZoomSceneToken, transaction.originZoom);
                if (result === true
                        || Math.abs(overviewZoom - transaction.originZoom) <= 0.000001) {
                    if (exactContext && plan && disposition === "cancel") {
                        finished = setSpatialContentY(plan.contentY, false)
                            && refreshSpatialHorizontalViewports(true)
                            && restoreSpatialZoomHorizontalOffsets(spatialZoomHorizontalOffsets);
                        if (finished) {
                            captureSpatialViewportSnapshot();
                        }
                    } else {
                        refreshOverviewSpatialSession(true);
                        finished = restoreSpatialZoomHorizontalOffsets(spatialZoomHorizontalOffsets);
                    }
                }
            } catch (error) {
                finished = false;
            } finally {
                spatialZoomApplying = false;
            }
        }

        if (disposition === "cancel" && !finished) {
            spatialZoomFinishing = false;
            synchronizeSpatialZoomInputState();
            return false;
        }
        clearSpatialZoomTransactionState();
        spatialZoomFinishing = false;
        synchronizeSpatialZoomInputState();
        return finished;
    }

    function clearSpatialZoomTransactionState() {
        spatialZoomDesktopIds = [];
        spatialZoomHeight = 0;
        spatialZoomHorizontalOffsets = [];
        spatialZoomModel = null;
        spatialZoomOutputId = "";
        spatialZoomOwner = "";
        spatialZoomSessionId = 0;
        spatialZoomTopologyRevision = -1;
        spatialZoomTransaction = null;
        spatialZoomWheelPixelTotal = 0;
        spatialZoomWheelRemainder = 0;
        spatialZoomWheelMode = "";
        spatialZoomWidth = 0;
    }

    function cancelSpatialZoomTransaction(repairAfterDiscard = true) {
        if (spatialZoomFinishing || spatialZoomOwner.length === 0 || !spatialZoomTransaction) {
            return false;
        }
        const finished = finishSpatialZoomTransaction("cancel");
        if (!finished && spatialZoomTransaction !== null) {
            discardSpatialZoomTransaction();
            if (repairAfterDiscard && sceneEffect && sceneEffect.active === true) {
                refreshOverviewSpatialSession(true);
                synchronizeSpatialZoomInputState();
            }
        }
        return finished;
    }

    function handleSpatialZoomKeyboard(intent) {
        if ((intent !== "in" && intent !== "out" && intent !== "reset")
                || !beginSpatialZoomTransaction("keyboard", height / 2)) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        let levelPlan = null;
        if (runtime && typeof runtime.planOverviewSpatialZoomLevel === "function") {
            try {
                levelPlan = intent === "reset"
                    ? runtime.planOverviewSpatialZoomLevel({
                                                               configuredZoom: configuredOverviewZoom,
                                                               currentZoom: overviewZoom,
                                                               intent: "reset"
                                                           })
                    : runtime.planOverviewSpatialZoomLevel({
                                                               currentZoom: overviewZoom,
                                                               direction: intent,
                                                               intent: "step",
                                                               steps: 1
                                                           });
            } catch (error) {
                levelPlan = null;
            }
        }
        if (!levelPlan || !previewSpatialZoomTransaction(levelPlan.scale)) {
            cancelSpatialZoomTransaction();
            return false;
        }
        return finishSpatialZoomTransaction("commit");
    }

    function handleSpatialZoomWheel(event, point) {
        if (!event || !point || !spatialZoomInputEligible
                || event.modifiers !== Qt.ControlModifier || !event.pixelDelta || !event.angleDelta
                || !Number.isFinite(point.y) || !Number.isFinite(event.pixelDelta.y)
                || !Number.isFinite(event.angleDelta.y)) {
            return false;
        }

        const rawPixelDelta = event.pixelDelta.y;
        const runtime = OverviewRuntime.DriftileOverview;
        const angleDelta = runtime
            && typeof runtime.normalizeOverviewPhysicalWheelAngleDelta === "function"
            ? runtime.normalizeOverviewPhysicalWheelAngleDelta(
                event.angleDelta.y, event.inverted === true) : Number.NaN;
        const pixelDelta = runtime
            && typeof runtime.normalizeOverviewPhysicalWheelPixelDelta === "function"
            ? runtime.normalizeOverviewPhysicalWheelPixelDelta(
                rawPixelDelta, event.inverted === true) : Number.NaN;
        const mode = Number.isFinite(pixelDelta) && pixelDelta !== 0
            ? "pixel" : angleDelta !== 0 ? "angle" : "";
        if (mode.length === 0 || !Number.isSafeInteger(angleDelta)) {
            return false;
        }

        if (spatialZoomOwner.length > 0 && spatialZoomOwner !== "wheel") {
            event.accepted = true;
            return true;
        }
        if (spatialZoomWheelMode.length > 0 && spatialZoomWheelMode !== mode) {
            finishSpatialZoomWheelGesture();
        }
        spatialZoomWheelMode = mode;

        if (mode === "pixel") {
            if (spatialZoomOwner.length === 0
                    && !beginSpatialZoomTransaction("wheel", point.y)) {
                return false;
            }
            const maximumPixelTotal = Math.log(16) * 1200;
            spatialZoomWheelPixelTotal = Math.max(-maximumPixelTotal,
                Math.min(maximumPixelTotal, spatialZoomWheelPixelTotal + pixelDelta));
            if (!previewSpatialZoomTransaction(Math.exp(-spatialZoomWheelPixelTotal / 1200))) {
                cancelSpatialZoomTransaction();
                return false;
            }
            const transaction = spatialZoomTransaction;
            if (!transaction || !Number.isFinite(transaction.previewZoom)
                    || !Number.isFinite(transaction.originZoom) || transaction.originZoom <= 0) {
                cancelSpatialZoomTransaction();
                return false;
            }
            spatialZoomWheelPixelTotal = -Math.log(
                transaction.previewZoom / transaction.originZoom) * 1200;
        } else {
            const combined = spatialZoomWheelRemainder !== 0
                && Math.sign(spatialZoomWheelRemainder) !== Math.sign(angleDelta)
                ? angleDelta : spatialZoomWheelRemainder + angleDelta;
            const stepCount = Math.min(4, Math.floor(Math.abs(combined) / 120));
            spatialZoomWheelRemainder = Math.sign(combined) * (Math.abs(combined) % 120);
            if (stepCount > 0) {
                if (spatialZoomOwner.length === 0
                        && !beginSpatialZoomTransaction("wheel", point.y)) {
                    return false;
                }
                let levelPlan = null;
                if (runtime && typeof runtime.planOverviewSpatialZoomLevel === "function") {
                    try {
                        levelPlan = runtime.planOverviewSpatialZoomLevel({
                                                                            currentZoom: overviewZoom,
                                                                            direction: combined < 0 ? "in" : "out",
                                                                            intent: "step",
                                                                            steps: stepCount
                                                                        });
                    } catch (error) {
                        levelPlan = null;
                    }
                }
                const originZoom = spatialZoomTransaction
                    ? spatialZoomTransaction.originZoom : Number.NaN;
                const scale = levelPlan && Number.isFinite(originZoom) && originZoom > 0
                    ? levelPlan.zoom / originZoom : Number.NaN;
                if (!previewSpatialZoomTransaction(scale)) {
                    cancelSpatialZoomTransaction();
                    return false;
                }
            }
        }

        event.accepted = true;
        return true;
    }

    function finishSpatialZoomWheelGesture() {
        const owned = spatialZoomOwner === "wheel";
        spatialZoomWheelPixelTotal = 0;
        spatialZoomWheelRemainder = 0;
        spatialZoomWheelMode = "";
        return owned ? finishSpatialZoomTransaction("commit") : false;
    }

    function commitSpatialTouchscreenZoom(scale) {
        if (spatialZoomOwner !== "touchscreen" || !Number.isFinite(scale)
                || !previewSpatialZoomTransaction(scale)) {
            cancelSpatialZoomTransaction();
            return false;
        }
        return finishSpatialZoomTransaction("commit");
    }

    function handleDesktopTopologyChanged() {
        desktopTopologyRefreshPending = true;
        cancelSpatialZoomTransaction();
        desktopTopologyRevision = desktopTopologyRevision >= 2147483646
            ? 0 : desktopTopologyRevision + 1;
        resetOverviewWheelState();
        return scheduleDesktopTopologyRefresh();
    }

    function scheduleDesktopTopologyRefresh() {
        const effect = sceneEffect;
        const expectedModel = overviewModel;
        const expectedSessionId = effect && Number.isInteger(effect.activeSessionId)
            ? effect.activeSessionId : 0;
        if (!effect || effect.active !== true || spatialPresentationPhase === "closing"
                || !expectedModel || expectedSessionId <= 0) {
            desktopTopologyRefreshPending = false;
            synchronizeSpatialZoomInputState();
            return false;
        }

        invalidateDesktopTopologyRefresh();
        desktopTopologyRefreshPending = true;
        const requestId = desktopTopologyRefreshRequestId;
        resetWindowWorkspaceHover();
        Qt.callLater(function() {
            root.completeDesktopTopologyRefresh(requestId, expectedSessionId, expectedModel);
        });
        return true;
    }

    function completeDesktopTopologyRefresh(requestId, expectedSessionId, expectedModel) {
        const effect = sceneEffect;
        if (requestId !== desktopTopologyRefreshRequestId || !effect || effect.active !== true
                || spatialPresentationPhase === "closing"
                || effect.activeSessionId !== expectedSessionId || overviewModel !== expectedModel
                || effect.overviewModel !== expectedModel) {
            if (requestId === desktopTopologyRefreshRequestId) {
                desktopTopologyRefreshPending = false;
                synchronizeSpatialZoomInputState();
            }
            return false;
        }

        refreshOverviewSpatialSession(true);
        desktopTopologyRefreshPending = false;
        synchronizeSpatialZoomInputState();
        return true;
    }

    function invalidateDesktopTopologyRefresh() {
        desktopTopologyRefreshRequestId = desktopTopologyRefreshRequestId >= 2147483646
            ? 0 : desktopTopologyRefreshRequestId + 1;
        desktopTopologyRefreshPending = false;
    }

    function refreshOverviewSpatialSession(preserveViewport, animateViewport = false) {
        cancelActiveColumnSpatialDrag();
        const previousViewportSnapshot = preserveViewport === true ? spatialViewportSnapshot : null;
        let selectedDesktopId = "";
        if (previousViewportSnapshot && sceneEffect && sceneEffect.active === true
                && keyboardSelectionId.length > 0) {
            const selectedTarget = navigationTargetForId(collectNavigationTargets(), keyboardSelectionId);
            if (selectedTarget && typeof selectedTarget.desktopId === "string") {
                selectedDesktopId = selectedTarget.desktopId;
            }
        }

        cancelKeyboardBoundaryNavigation();
        searchResultCount = 0;
        searchResultCountsByDesktop = Object.create(null);
        searchResultOrdinalsByTarget = Object.create(null);
        resetOverviewWheelState();
        refreshSpatialHorizontalViewports(true);
        spatialViewportInput.panLayout = null;
        spatialViewportInput.panStartContentY = 0;
        clearSpatialTouchPan();
        clearSpatialHorizontalViewportDrag();
        resetDesktopReorder();
        resetSpatialEdgePanTracking();

        if (sceneEffect && sceneEffect.active === true) {
            const nextViewportGeometry = currentSpatialViewportGeometry();
            const anchorPlan = previousViewportSnapshot && nextViewportGeometry
                ? planSpatialViewportAnchor(previousViewportSnapshot, nextViewportGeometry) : null;
            if (anchorPlan) {
                setSpatialContentY(anchorPlan.contentY, animateViewport);
            } else {
                resetSpatialViewport(animateViewport);
                const selectedWorkspaceIndex = desktopIds && typeof desktopIds.indexOf === "function"
                    ? desktopIds.indexOf(selectedDesktopId) : -1;
                const selectionPlan = selectedWorkspaceIndex >= 0
                    ? planSpatialWorkspaceCenter(selectedWorkspaceIndex) : null;
                if (selectionPlan) {
                    setSpatialContentY(selectionPlan.contentY, animateViewport);
                }
            }
            captureSpatialViewportSnapshot();
            Qt.callLater(root.repairKeyboardSelection);
        } else {
            spatialVerticalCameraAnimation.stop();
            spatialContentY = 0;
            spatialVisualContentY = 0;
            spatialHorizontalDesktopIds = [];
            spatialHorizontalGeometryPlans = [];
            spatialHorizontalViewportOffsets = [];
            spatialViewportSnapshot = null;
        }
        resolveSpatialLiveCamera();
    }

    function currentSpatialViewportGeometry() {
        if (!spatialLayoutIsValid(overviewSpatialLayout) || !desktopIds
                || !Number.isInteger(desktopIds.length) || desktopIds.length < 1
                || desktopIds.length > 512 || !Number.isFinite(height) || height <= 0) {
            return null;
        }

        const copiedDesktopIds = [];
        for (let index = 0; index < desktopIds.length; index += 1) {
            const desktopId = desktopIds[index];
            if (typeof desktopId !== "string" || desktopId.length === 0) {
                return null;
            }
            copiedDesktopIds.push(desktopId);
        }

        return {
            desktopIds: copiedDesktopIds,
            layout: {
                cardHeight: overviewSpatialLayout.cardHeight,
                contentHeight: overviewSpatialLayout.contentHeight,
                edgeMargin: overviewSpatialLayout.edgeMargin,
                gap: overviewSpatialLayout.gap
            },
            sceneHeight: height
        };
    }

    function captureSpatialViewportSnapshot() {
        const geometry = currentSpatialViewportGeometry();
        if (!geometry || !Number.isFinite(spatialContentY) || spatialContentY < 0
                || spatialContentY > geometry.layout.contentHeight - geometry.sceneHeight) {
            return false;
        }

        spatialViewportSnapshot = {
            contentY: spatialContentY,
            desktopIds: geometry.desktopIds,
            layout: geometry.layout,
            sceneHeight: geometry.sceneHeight
        };
        return true;
    }

    function planSpatialViewportAnchor(previousSnapshot, nextGeometry) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialViewportAnchor !== "function") {
            return null;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialViewportAnchor({
                                                                 nextDesktopIds: nextGeometry.desktopIds,
                                                                 nextLayout: nextGeometry.layout,
                                                                 nextSceneHeight: nextGeometry.sceneHeight,
                                                                 previousContentY: previousSnapshot.contentY,
                                                                 previousDesktopIds: previousSnapshot.desktopIds,
                                                                 previousLayout: previousSnapshot.layout,
                                                                 previousSceneHeight: previousSnapshot.sceneHeight
                                                             });
        } catch (error) {
            return null;
        }

        return spatialViewportAnchorPlanIsValid(plan, nextGeometry) ? plan : null;
    }

    function spatialViewportAnchorPlanIsValid(plan, nextGeometry) {
        if (!spatialViewportPlanIsValid(plan) || !nextGeometry || !nextGeometry.desktopIds
                || !Number.isInteger(plan.anchorWorkspaceIndex)
                || plan.anchorWorkspaceIndex < 0
                || plan.anchorWorkspaceIndex >= nextGeometry.desktopIds.length
                || typeof plan.anchorDesktopId !== "string"
                || plan.anchorDesktopId !== nextGeometry.desktopIds[plan.anchorWorkspaceIndex]
                || !Number.isFinite(plan.anchorOffsetFraction)
                || plan.anchorOffsetFraction < -0.5 || plan.anchorOffsetFraction > 0.5) {
            return false;
        }

        return true;
    }

    function refreshSpatialHorizontalViewports(preserveViewport) {
        const currentDesktopIds = desktopIds;
        if (!desktopIdListShapeIsValid(currentDesktopIds)) {
            spatialHorizontalDesktopIds = [];
            spatialHorizontalGeometryPlans = [];
            spatialHorizontalViewportOffsets = [];
            resetOverviewHorizontalWheelState();
            return false;
        }

        const previousDesktopIds = spatialHorizontalDesktopIds;
        const previousOffsets = spatialHorizontalViewportOffsets;
        const previousOffsetsByDesktopId = Object.create(null);
        let preserve = preserveViewport === true && desktopIdListShapeIsValid(previousDesktopIds)
            && previousOffsets && previousOffsets.length === previousDesktopIds.length;
        if (preserve) {
            for (let index = 0; index < previousDesktopIds.length; index += 1) {
                const previousDesktopId = previousDesktopIds[index];
                const previousOffset = previousOffsets[index];
                if (typeof previousDesktopId !== "string" || previousDesktopId.length === 0
                        || previousOffsetsByDesktopId[previousDesktopId] !== undefined
                        || !Number.isFinite(previousOffset)) {
                    preserve = false;
                    break;
                }
                previousOffsetsByDesktopId[previousDesktopId] = previousOffset;
            }
        }
        const nextDesktopIds = [];
        const nextGeometryPlans = [];
        const nextOffsets = [];

        for (let index = 0; index < currentDesktopIds.length; index += 1) {
            const desktopId = currentDesktopIds[index];
            const geometryPlan = planSpatialHorizontalGeometry(index, desktopId);
            const bounds = spatialHorizontalViewportBoundsForPlan(geometryPlan);
            if (!bounds) {
                spatialHorizontalDesktopIds = [];
                spatialHorizontalGeometryPlans = [];
                spatialHorizontalViewportOffsets = [];
                resetOverviewHorizontalWheelState();
                return false;
            }

            const preservedOffset = preserve ? previousOffsetsByDesktopId[desktopId] : undefined;
            const previous = Number.isFinite(preservedOffset) ? preservedOffset : bounds.base;
            nextDesktopIds.push(desktopId);
            nextGeometryPlans.push(geometryPlan);
            nextOffsets.push(Math.min(bounds.maximum, Math.max(bounds.minimum, previous)));
        }

        spatialHorizontalDesktopIds = nextDesktopIds;
        spatialHorizontalGeometryPlans = nextGeometryPlans;
        spatialHorizontalViewportOffsets = nextOffsets;
        advanceSpatialHorizontalViewportRevision();
        resetOverviewHorizontalWheelState();
        return true;
    }

    function planSpatialHorizontalGeometry(index, expectedDesktopId) {
        const currentDesktopIds = desktopIds;
        if (!overviewModel || outputId.length === 0 || !desktopIdListShapeIsValid(currentDesktopIds)
                || !Number.isInteger(index) || index < 0 || index >= currentDesktopIds.length
                || currentDesktopIds[index] !== expectedDesktopId || typeof expectedDesktopId !== "string"
                || expectedDesktopId.length === 0) {
            return null;
        }

        const storedContext = contextFor(expectedDesktopId);
        const context = storedContext !== null ? storedContext : {
            activeColumnIndex: null,
            columns: [],
            desktopId: expectedDesktopId,
            outputId,
            viewportOffset: 0
        };
        const desktop = desktopForId(expectedDesktopId);
        const screen = liveScreenFor(targetScreen);
        if (context.desktopId !== expectedDesktopId || context.outputId !== outputId
                || !context.columns || !Number.isInteger(context.columns.length) || context.columns.length > 512
                || !desktop || !screen || !screen.geometry) {
            return null;
        }

        const outputGeometry = spatialGeometryRect(screen.geometry);
        const workArea = spatialWorkArea(screen, desktop);
        const windowHeightBounds = spatialWindowHeightBounds(context);
        const devicePixelRatio = Number(screen.devicePixelRatio);
        if (!outputGeometry || !workArea || windowHeightBounds === null
                || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
            return null;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialRowGeometry !== "function") {
            return null;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialRowGeometry({
                                                              activeColumnIndex: context.activeColumnIndex,
                                                              alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,
                                                              columns: context.columns,
                                                              devicePixelRatio,
                                                              gap: overviewGap,
                                                              outputGeometry,
                                                              viewportOffset: context.viewportOffset,
                                                              windowHeightBounds,
                                                              workArea
                                                          });
        } catch (error) {
            return null;
        }
        return spatialHorizontalGeometryPlanIsValid(plan, context, outputGeometry, workArea,
                                                    devicePixelRatio) ? plan : null;
    }

    function spatialWorkArea(screen, desktop) {
        try {
            return spatialGeometryRect(KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea, screen, desktop));
        } catch (error) {
            return null;
        }
    }

    function spatialGeometryRect(candidate) {
        if (!candidate) {
            return null;
        }

        const x = Number(candidate.x);
        const y = Number(candidate.y);
        const width = Number(candidate.width);
        const height = Number(candidate.height);
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && width > 0
            && Number.isFinite(height) && height > 0
            ? { height, width, x, y } : null;
    }

    function spatialWindowHeightBounds(context) {
        if (!context || !context.columns || !Number.isInteger(context.columns.length)
                || context.columns.length > 512) {
            return null;
        }

        const bounds = [];
        const seenIds = Object.create(null);
        for (const column of context.columns) {
            if (!column || !column.members || !Number.isInteger(column.members.length)
                    || column.members.length < 1 || column.members.length > 256) {
                return null;
            }

            let needsBounds = false;
            for (const member of column.members) {
                if (member && member.height !== undefined) {
                    needsBounds = true;
                    break;
                }
            }
            if (!needsBounds) {
                continue;
            }

            for (const member of column.members) {
                const id = member && typeof member.windowId === "string" ? member.windowId : "";
                const memberBounds = member ? member.heightBounds : null;
                if (id.length === 0 || seenIds[id] === true || !memberBounds
                        || !Number.isFinite(memberBounds.decorationHeight)
                        || memberBounds.decorationHeight < 0
                        || !Number.isFinite(memberBounds.minimumClientHeight)
                        || memberBounds.minimumClientHeight < 0
                        || (memberBounds.maximumClientHeight !== Number.POSITIVE_INFINITY
                            && (!Number.isFinite(memberBounds.maximumClientHeight)
                                || memberBounds.maximumClientHeight <= 0
                                || memberBounds.maximumClientHeight < memberBounds.minimumClientHeight))) {
                    return null;
                }
                seenIds[id] = true;
                bounds.push({
                                decorationHeight: memberBounds.decorationHeight,
                                maximumClientHeight: memberBounds.maximumClientHeight,
                                minimumClientHeight: memberBounds.minimumClientHeight,
                                windowId: id
                            });
            }
        }

        return bounds;
    }

    function spatialHorizontalGeometryPlanIsValid(plan, context, outputGeometry, workArea, devicePixelRatio) {
        if (!plan || Array.isArray(plan) || !plan.camera || Array.isArray(plan.camera)
                || !plan.dimensions || Array.isArray(plan.dimensions) || !plan.columnFrames
                || !plan.windowFrames || !Number.isInteger(plan.windowFrames.length)
                || !Number.isInteger(plan.columnFrames.length)
                || plan.columnFrames.length !== context.columns.length || plan.columnFrames.length > 512
                || !Number.isFinite(plan.contentWidth) || plan.contentWidth < 0
                || !Number.isFinite(plan.camera.base) || !Number.isFinite(plan.camera.minimum)
                || !Number.isFinite(plan.camera.maximum) || plan.camera.minimum > plan.camera.base
                || plan.camera.base > plan.camera.maximum
                || plan.dimensions.outputWidth !== outputGeometry.width
                || plan.dimensions.outputHeight !== outputGeometry.height
                || plan.dimensions.viewportWidth !== workArea.width
                || plan.dimensions.viewportHeight !== workArea.height
                || plan.dimensions.viewportInsetX !== workArea.x - outputGeometry.x
                || plan.dimensions.viewportInsetY !== workArea.y - outputGeometry.y
                || plan.dimensions.devicePixelRatio !== devicePixelRatio) {
            return false;
        }

        let windowFrameIndex = 0;
        for (let columnIndex = 0; columnIndex < plan.columnFrames.length; columnIndex += 1) {
            const frame = plan.columnFrames[columnIndex];
            const column = context.columns[columnIndex];
            if (!frame || Array.isArray(frame) || frame.columnIndex !== columnIndex
                    || frame.columnId !== `overview-column-${columnIndex}`
                    || !Number.isFinite(frame.contentX) || !Number.isFinite(frame.width) || frame.width <= 0
                    || !Number.isFinite(frame.contentX + frame.width) || !column || !column.members
                    || !Number.isInteger(column.members.length) || column.members.length < 1
                    || column.members.length > 256) {
                return false;
            }

            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const windowFrame = plan.windowFrames[windowFrameIndex];
                if (!member || !windowFrame || Array.isArray(windowFrame)
                        || windowFrame.columnId !== frame.columnId
                        || windowFrame.columnIndex !== columnIndex
                        || windowFrame.memberIndex !== memberIndex
                        || windowFrame.windowId !== member.windowId
                        || !Number.isFinite(windowFrame.x) || !Number.isFinite(windowFrame.y)
                        || !Number.isFinite(windowFrame.width) || windowFrame.width <= 0
                        || !Number.isFinite(windowFrame.height) || windowFrame.height <= 0
                        || !Number.isFinite(windowFrame.x + windowFrame.width)
                        || !Number.isFinite(windowFrame.y + windowFrame.height)) {
                    return false;
                }
                windowFrameIndex += 1;
            }
        }
        return windowFrameIndex === plan.windowFrames.length;
    }

    function spatialHorizontalGeometryPlanAt(index, expectedDesktopId, expectedRevision) {
        const currentDesktopIds = desktopIds;
        if (!Number.isInteger(expectedRevision) || expectedRevision !== spatialHorizontalViewportRevision
                || !Number.isInteger(index) || index < 0 || index >= spatialHorizontalDesktopIds.length
                || !desktopIdListShapeIsValid(currentDesktopIds)
                || spatialHorizontalDesktopIds.length !== currentDesktopIds.length
                || spatialHorizontalGeometryPlans.length !== currentDesktopIds.length
                || spatialHorizontalDesktopIds[index] !== expectedDesktopId) {
            return null;
        }
        return spatialHorizontalGeometryPlans[index] || null;
    }

    function spatialHorizontalViewportBoundsForPlan(plan) {
        if (!plan || !plan.camera || !plan.dimensions || !Number.isFinite(plan.camera.base)
                || !Number.isFinite(plan.camera.minimum) || !Number.isFinite(plan.camera.maximum)
                || plan.camera.minimum > plan.camera.base || plan.camera.base > plan.camera.maximum
                || !Number.isFinite(plan.dimensions.viewportWidth) || plan.dimensions.viewportWidth <= 0) {
            return null;
        }
        return {
            base: plan.camera.base,
            maximum: plan.camera.maximum,
            minimum: plan.camera.minimum,
            sourceWidth: plan.dimensions.viewportWidth
        };
    }

    function spatialHorizontalViewportBounds(index, expectedDesktopId) {
        const plan = spatialHorizontalGeometryPlanAt(index, expectedDesktopId,
                                                     spatialHorizontalViewportRevision);
        return spatialHorizontalViewportBoundsForPlan(plan);
    }

    function spatialHorizontalViewportOffsetAt(index, expectedDesktopId, expectedRevision) {
        const bounds = spatialHorizontalViewportBounds(index, expectedDesktopId);
        if (!Number.isInteger(expectedRevision) || expectedRevision !== spatialHorizontalViewportRevision) {
            return bounds ? bounds.base : 0;
        }
        return spatialHorizontalViewportOffsetForBounds(index, expectedDesktopId, bounds);
    }

    function spatialPresentationViewportOffsetAt(index, expectedDesktopId, expectedRevision) {
        const viewportOffset = spatialHorizontalViewportOffsetAt(index, expectedDesktopId, expectedRevision);
        if ((spatialPresentationPhase !== "opening" && spatialPresentationPhase !== "closing")
                || index !== currentWorkspaceIndex || expectedDesktopId !== spatialLiveCameraReturnDesktopId
                || outputId !== spatialLiveCameraReturnOutputId
                || !Number.isFinite(spatialLiveCameraReturnViewportOffset)) {
            return viewportOffset;
        }

        const bounds = spatialHorizontalViewportBounds(index, expectedDesktopId);
        const returnOffset = spatialLiveCameraReturnViewportOffset;
        if (!bounds || returnOffset < bounds.minimum || returnOffset > bounds.maximum) {
            return viewportOffset;
        }

        const progress = Math.max(0, Math.min(1, spatialPresentationProgress));
        return returnOffset + (viewportOffset - returnOffset) * progress;
    }

    function spatialHorizontalViewportOffsetForBounds(index, expectedDesktopId, bounds) {
        if (!bounds || spatialHorizontalDesktopIds.length !== desktopIds.length
                || spatialHorizontalDesktopIds[index] !== expectedDesktopId
                || spatialHorizontalViewportOffsets.length !== desktopIds.length) {
            return bounds ? bounds.base : 0;
        }

        const offset = spatialHorizontalViewportOffsets[index];
        return Number.isFinite(offset) && offset >= bounds.minimum && offset <= bounds.maximum
            ? offset : bounds.base;
    }

    function setSpatialHorizontalViewportOffset(index, expectedDesktopId, offset) {
        const bounds = spatialHorizontalViewportBounds(index, expectedDesktopId);
        return setSpatialHorizontalViewportOffsetForBounds(index, expectedDesktopId, offset, bounds);
    }

    function setSpatialHorizontalViewportOffsetForBounds(index, expectedDesktopId, offset, bounds) {
        if (!bounds || !Number.isFinite(offset) || offset < bounds.minimum || offset > bounds.maximum
                || spatialHorizontalDesktopIds.length !== desktopIds.length
                || spatialHorizontalDesktopIds[index] !== expectedDesktopId
                || spatialHorizontalViewportOffsets.length !== desktopIds.length) {
            return false;
        }

        const normalizedOffset = Object.is(offset, -0) ? 0 : offset;
        if (spatialHorizontalViewportOffsets[index] === normalizedOffset) {
            return true;
        }
        spatialHorizontalViewportOffsets[index] = normalizedOffset;
        advanceSpatialHorizontalViewportRevision();
        return spatialHorizontalViewportOffsets[index] === normalizedOffset;
    }

    function advanceSpatialHorizontalViewportRevision() {
        spatialHorizontalViewportRevision = spatialHorizontalViewportRevision >= 2147483646
            ? 0 : spatialHorizontalViewportRevision + 1;
    }

    function resolveSpatialLiveCamera() {
        if (spatialExitHandoffActive) {
            return false;
        }
        const candidate = KWin.Workspace.activeWindow;
        const attachment = createSpatialLiveCameraAttachment(candidate);
        if (!attachment) {
            updateSpatialLiveCameraProbe(candidate);
            return false;
        }

        clearSpatialLiveCameraProbe();
        if (spatialLiveCameraDetachedWindow === attachment.window
                && spatialLiveCameraDetachedWindowId === attachment.windowId) {
            if (refreshSpatialLiveCameraReturnOffset(attachment)) {
                return false;
            }
        }

        if (spatialLiveCameraDetachedWindow !== null
                || spatialLiveGeometryDetachedDesktopId.length > 0
                || spatialLiveGeometryDetachedOutputId.length > 0) {
            clearSpatialLiveCameraDetachment();
        }
        spatialLiveCameraWindow = attachment.window;
        spatialLiveCameraWindowId = attachment.windowId;
        spatialLiveCameraDesktopId = attachment.desktopId;
        spatialLiveCameraAttachment = attachment;
        return applySpatialLiveCamera();
    }

    function resolveSpatialLiveCameraProbe() {
        const candidate = spatialLiveCameraProbeWindow;
        if (!candidate || candidate === spatialLiveCameraWindow
                || KWin.Workspace.activeWindow !== candidate) {
            return false;
        }
        return resolveSpatialLiveCamera();
    }

    function updateSpatialLiveCameraProbe(candidate) {
        try {
            if (!sceneEffect || sceneEffect.active !== true || !candidate
                    || candidate === spatialLiveCameraWindow || candidate.deleted === true) {
                clearSpatialLiveCameraProbe();
                return false;
            }
        } catch (error) {
            clearSpatialLiveCameraProbe();
            return false;
        }

        spatialLiveCameraProbeWindow = candidate;
        return true;
    }

    function clearSpatialLiveCameraProbe() {
        spatialLiveCameraProbeWindow = null;
    }

    function createSpatialLiveCameraAttachment(candidate) {
        try {
            if (!sceneEffect || sceneEffect.active !== true || !overviewModel
                    || !Number.isInteger(currentWorkspaceIndex) || currentWorkspaceIndex < 0
                    || currentWorkspaceIndex >= desktopIds.length || !currentDesktop) {
                return null;
            }

            const desktopId = desktopIds[currentWorkspaceIndex];
            const desktop = liveDesktopFor(currentDesktop, desktopId);
            const screen = liveScreenFor(targetScreen);
            const model = overviewModel;
            const outputDescriptor = projectedOutput(model, screen);
            const outputIndex = outputDescriptor ? model.outputs.indexOf(outputDescriptor) : -1;
            const activityId = String(KWin.Workspace.currentActivity);
            let context = null;
            let contextIndex = -1;
            for (let index = 0; index < model.contexts.length; index += 1) {
                const current = model.contexts[index];
                if (current.outputId === outputId && current.desktopId === desktopId) {
                    if (context !== null) {
                        return null;
                    }
                    context = current;
                    contextIndex = index;
                }
            }
            if (!desktop || !screen || !outputDescriptor || outputIndex < 0 || !context || contextIndex < 0
                    || context.desktopId !== desktopId || context.outputId !== outputId
                    || context.activityId !== activityId
                    || !Number.isInteger(context.activeColumnIndex)
                    || context.activeColumnIndex < 0 || context.activeColumnIndex >= context.columns.length) {
                return null;
            }

            const columnIndex = context.activeColumnIndex;
            const column = context.columns[columnIndex];
            if (!column || !column.members || !Number.isInteger(column.members.length)
                    || column.members.length < 1 || column.members.length > 512
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0 || column.selectedMemberIndex >= column.members.length) {
                return null;
            }

            const member = column.members[column.selectedMemberIndex];
            const windowId = member && typeof member.windowId === "string" ? member.windowId : "";
            if (!spatialLiveCameraWindowIsEligible(candidate, windowId, screen)) {
                return null;
            }

            const candidateDesktops = candidate.desktops;
            if (!candidateDesktops || candidateDesktops.length !== 1
                    || candidateDesktops[0] !== desktop || String(candidateDesktops[0].id) !== desktopId) {
                return null;
            }

            const candidateActivities = candidate.activities;
            let activityIndex = -1;
            if (!candidateActivities || !Number.isInteger(candidateActivities.length)
                    || candidateActivities.length > 512) {
                return null;
            }
            if (candidateActivities.length > 0) {
                for (let index = 0; index < candidateActivities.length; index += 1) {
                    if (String(candidateActivities[index]) === activityId) {
                        activityIndex = index;
                        break;
                    }
                }
                if (activityIndex < 0) {
                    return null;
                }
            }

            const geometryPlan = spatialHorizontalGeometryPlanAt(currentWorkspaceIndex, desktopId,
                                                                 spatialHorizontalViewportRevision);
            const bounds = spatialHorizontalViewportBoundsForPlan(geometryPlan);
            const columnFrame = geometryPlan && geometryPlan.columnFrames
                ? geometryPlan.columnFrames[columnIndex] : null;
            const outputGeometry = spatialGeometryRect(screen.geometry);
            const workArea = spatialWorkArea(screen, desktop);
            const devicePixelRatio = Number(screen.devicePixelRatio);
            if (!geometryPlan || !bounds || !columnFrame || columnFrame.columnIndex !== columnIndex
                    || !outputGeometry || !workArea || !Number.isFinite(devicePixelRatio)
                    || devicePixelRatio <= 0) {
                return null;
            }
            if (!spatialLiveCameraDimensionsAreExact(geometryPlan.dimensions, outputGeometry,
                                                     workArea, devicePixelRatio)) {
                scheduleSpatialLiveCameraRefresh();
                return null;
            }

            return {
                activityId,
                activityIndex,
                bounds,
                camera: geometryPlan.camera,
                columnFrame,
                column,
                columnIndex,
                context,
                contextIndex,
                desktopId,
                desktop,
                devicePixelRatio,
                effect: sceneEffect,
                geometryPlan,
                member,
                memberIndex: column.selectedMemberIndex,
                model,
                outputDescriptor,
                outputGeometryHeight: outputGeometry.height,
                outputGeometryWidth: outputGeometry.width,
                outputGeometryX: outputGeometry.x,
                outputGeometryY: outputGeometry.y,
                outputIndex,
                outputId,
                screen,
                window: candidate,
                windowId,
                windowActivityCount: candidateActivities.length,
                workAreaHeight: workArea.height,
                workAreaWidth: workArea.width,
                workAreaX: workArea.x,
                workAreaY: workArea.y,
                workspaceIndex: currentWorkspaceIndex
            };
        } catch (error) {
            return null;
        }
    }

    function spatialLiveCameraWindowIsEligible(candidate, expectedWindowId, expectedScreen) {
        if (!candidate || typeof expectedWindowId !== "string" || expectedWindowId.length === 0
                || candidate.deleted === true || candidate.minimized === true
                || candidate.normalWindow !== true || candidate.managed !== true
                || candidate.output !== expectedScreen || candidate.fullScreen === true
                || candidate.maximizeMode !== 0 || candidate.tile !== null
                || candidate.move !== false || candidate.resize !== false
                || candidate.internalId === undefined || candidate.internalId === null
                || String(candidate.internalId) !== expectedWindowId) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.hasAutomaticFloatingRole !== "function") {
            return false;
        }

        try {
            return runtime.hasAutomaticFloatingRole(candidate) === false;
        } catch (error) {
            return false;
        }
    }

    function spatialLiveCameraDimensionsAreExact(dimensions, outputGeometry, workArea, devicePixelRatio) {
        return dimensions && !Array.isArray(dimensions)
            && dimensions.outputWidth === outputGeometry.width
            && dimensions.outputHeight === outputGeometry.height
            && dimensions.viewportWidth === workArea.width
            && dimensions.viewportHeight === workArea.height
            && dimensions.viewportInsetX === workArea.x - outputGeometry.x
            && dimensions.viewportInsetY === workArea.y - outputGeometry.y
            && dimensions.devicePixelRatio === devicePixelRatio;
    }

    function spatialLiveCameraAttachmentContextIsExact(attachment) {
        if (!attachment || sceneEffect !== attachment.effect || sceneEffect.active !== true
                || overviewModel !== attachment.model || sceneEffect.overviewModel !== attachment.model
                || targetScreen !== attachment.screen || currentDesktop !== attachment.desktop
                || currentWorkspaceIndex !== attachment.workspaceIndex
                || desktopIds[attachment.workspaceIndex] !== attachment.desktopId
                || outputId !== attachment.outputId
                || String(KWin.Workspace.currentActivity) !== attachment.activityId
                || KWin.Workspace.activeWindow !== attachment.window
                || attachment.model.outputs[attachment.outputIndex] !== attachment.outputDescriptor
                || attachment.model.contexts[attachment.contextIndex] !== attachment.context
                || attachment.context.outputId !== attachment.outputId
                || attachment.context.desktopId !== attachment.desktopId
                || attachment.context.activityId !== attachment.activityId
                || attachment.context.activeColumnIndex !== attachment.columnIndex
                || attachment.context.columns[attachment.columnIndex] !== attachment.column
                || attachment.column.selectedMemberIndex !== attachment.memberIndex
                || attachment.column.members[attachment.memberIndex] !== attachment.member
                || attachment.member.windowId !== attachment.windowId
                || spatialHorizontalDesktopIds[attachment.workspaceIndex] !== attachment.desktopId
                || spatialHorizontalGeometryPlans[attachment.workspaceIndex] !== attachment.geometryPlan
                || attachment.geometryPlan.camera !== attachment.camera
                || attachment.geometryPlan.columnFrames[attachment.columnIndex] !== attachment.columnFrame
                || !spatialLiveCameraWindowIsEligible(attachment.window, attachment.windowId,
                                                      attachment.screen)) {
            return false;
        }

        const outputGeometry = attachment.screen.geometry;
        const dimensions = attachment.geometryPlan.dimensions;
        const desktops = attachment.window.desktops;
        const activities = attachment.window.activities;
        if (!outputGeometry || !dimensions
                || Number(outputGeometry.x) !== attachment.outputGeometryX
                || Number(outputGeometry.y) !== attachment.outputGeometryY
                || Number(outputGeometry.width) !== attachment.outputGeometryWidth
                || Number(outputGeometry.height) !== attachment.outputGeometryHeight
                || Number(attachment.screen.devicePixelRatio) !== attachment.devicePixelRatio
                || dimensions.outputWidth !== attachment.outputGeometryWidth
                || dimensions.outputHeight !== attachment.outputGeometryHeight
                || dimensions.viewportWidth !== attachment.workAreaWidth
                || dimensions.viewportHeight !== attachment.workAreaHeight
                || dimensions.viewportInsetX !== attachment.workAreaX - attachment.outputGeometryX
                || dimensions.viewportInsetY !== attachment.workAreaY - attachment.outputGeometryY
                || dimensions.devicePixelRatio !== attachment.devicePixelRatio
                || !desktops || desktops.length !== 1 || desktops[0] !== attachment.desktop
                || String(desktops[0].id) !== attachment.desktopId
                || !activities || activities.length !== attachment.windowActivityCount) {
            return false;
        }

        return activities.length === 0
            || String(activities[attachment.activityIndex]) === attachment.activityId;
    }

    function spatialLiveCameraAttachmentIsExact(attachment) {
        return attachment && spatialLiveCameraAttachment === attachment
            && spatialLiveCameraWindow === attachment.window
            && spatialLiveCameraWindowId === attachment.windowId
            && spatialLiveCameraDesktopId === attachment.desktopId
            && spatialLiveCameraDetachedWindow === null
            && spatialLiveCameraAttachmentContextIsExact(attachment);
    }

    function spatialLiveCameraDetachedAttachmentIsExact(attachment) {
        return attachment && spatialLiveCameraAttachment === null
            && spatialLiveCameraWindow === null && spatialLiveCameraWindowId.length === 0
            && spatialLiveCameraDesktopId.length === 0
            && spatialLiveCameraDetachedWindow === attachment.window
            && spatialLiveCameraDetachedWindowId === attachment.windowId
            && spatialLiveCameraReturnDesktopId === attachment.desktopId
            && spatialLiveCameraReturnOutputId === attachment.outputId
            && spatialLiveGeometryDetachedDesktopId === attachment.desktopId
            && spatialLiveGeometryDetachedOutputId === attachment.outputId
            && spatialLiveCameraAttachmentContextIsExact(attachment);
    }

    function applySpatialLiveCamera() {
        if (spatialExitHandoffActive) {
            return false;
        }
        const attachment = spatialLiveCameraAttachment;
        if (!spatialLiveCameraAttachmentIsExact(attachment)) {
            return false;
        }

        let workArea = null;
        try {
            workArea = KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea,
                                                 attachment.screen, attachment.desktop);
        } catch (error) {
            return false;
        }
        if (!workArea || Number(workArea.x) !== attachment.workAreaX
                || Number(workArea.y) !== attachment.workAreaY
                || Number(workArea.width) !== attachment.workAreaWidth
                || Number(workArea.height) !== attachment.workAreaHeight) {
            clearSpatialLiveCameraAttachment();
            scheduleSpatialLiveCameraRefresh();
            return false;
        }

        const frame = attachment.window.frameGeometry;
        const liveFrame = frame ? { width: Number(frame.width), x: Number(frame.x) } : null;
        if (!liveFrame || !Number.isFinite(liveFrame.x) || !Number.isFinite(liveFrame.width)
                || liveFrame.width <= 0) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialLiveCamera !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialLiveCamera({
                                                             camera: attachment.camera,
                                                             columnFrame: attachment.columnFrame,
                                                             devicePixelRatio: attachment.devicePixelRatio,
                                                             liveFrame,
                                                             workAreaX: attachment.workAreaX
                                                         });
        } catch (error) {
            return false;
        }

        if (!spatialLiveCameraPlanIsValid(plan, attachment.bounds)
                || !spatialLiveCameraAttachmentIsExact(attachment)) {
            return false;
        }

        const applied = applySpatialLiveCameraViewportOffset(attachment.workspaceIndex, attachment.desktopId,
                                                             plan.viewportOffset, attachment.bounds,
                                                             attachment.geometryPlan);
        if (applied) {
            completeSpatialLiveCameraRefresh();
        }
        return applied;
    }

    function refreshSpatialLiveCameraReturnOffset(attachment) {
        if (!spatialLiveCameraDetachedAttachmentIsExact(attachment)) {
            return false;
        }

        let workArea = null;
        try {
            workArea = KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea,
                                                 attachment.screen, attachment.desktop);
        } catch (error) {
            return false;
        }
        if (!workArea || Number(workArea.x) !== attachment.workAreaX
                || Number(workArea.y) !== attachment.workAreaY
                || Number(workArea.width) !== attachment.workAreaWidth
                || Number(workArea.height) !== attachment.workAreaHeight) {
            return false;
        }

        const frame = attachment.window.frameGeometry;
        const liveFrame = frame ? { width: Number(frame.width), x: Number(frame.x) } : null;
        if (!liveFrame || !Number.isFinite(liveFrame.x) || !Number.isFinite(liveFrame.width)
                || liveFrame.width <= 0) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialLiveCamera !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialLiveCamera({
                                                             camera: attachment.camera,
                                                             columnFrame: attachment.columnFrame,
                                                             devicePixelRatio: attachment.devicePixelRatio,
                                                             liveFrame,
                                                             workAreaX: attachment.workAreaX
                                                         });
        } catch (error) {
            return false;
        }

        if (!spatialLiveCameraPlanIsValid(plan, attachment.bounds)
                || !spatialLiveCameraDetachedAttachmentIsExact(attachment)) {
            return false;
        }

        spatialLiveCameraReturnViewportOffset = plan.viewportOffset;
        return spatialLiveCameraReturnViewportOffset === plan.viewportOffset;
    }

    function spatialLiveCameraPlanIsValid(plan, bounds) {
        return plan && !Array.isArray(plan) && bounds
            && Number.isFinite(plan.viewportOffset)
            && plan.viewportOffset >= bounds.minimum && plan.viewportOffset <= bounds.maximum;
    }

    function applySpatialLiveCameraViewportOffset(index, expectedDesktopId, offset, bounds, expectedGeometryPlan) {
        if (!bounds || !expectedGeometryPlan || !Number.isFinite(offset)
                || offset < bounds.minimum || offset > bounds.maximum
                || spatialHorizontalDesktopIds.length !== desktopIds.length
                || spatialHorizontalDesktopIds[index] !== expectedDesktopId
                || spatialHorizontalGeometryPlans[index] !== expectedGeometryPlan
                || spatialHorizontalViewportOffsets.length !== desktopIds.length) {
            return false;
        }

        const normalizedOffset = Object.is(offset, -0) ? 0 : offset;
        if (spatialHorizontalViewportOffsets[index] === normalizedOffset) {
            return true;
        }

        spatialHorizontalViewportOffsets[index] = normalizedOffset;
        advanceSpatialHorizontalViewportRevision();
        return spatialHorizontalViewportOffsets[index] === normalizedOffset;
    }

    function detachSpatialLiveCameraForManualOffset(index, expectedDesktopId, previousOffset, nextOffset) {
        const normalizedNextOffset = Object.is(nextOffset, -0) ? 0 : nextOffset;
        if (!manualSpatialLiveGeometryDetachIsExact(index, expectedDesktopId, previousOffset,
                                                     normalizedNextOffset)) {
            return false;
        }

        if (spatialLiveCameraReturnDesktopId !== expectedDesktopId
                || spatialLiveCameraReturnOutputId !== outputId
                || !Number.isFinite(spatialLiveCameraReturnViewportOffset)) {
            spatialLiveCameraReturnDesktopId = expectedDesktopId;
            spatialLiveCameraReturnOutputId = outputId;
            spatialLiveCameraReturnViewportOffset = previousOffset;
        }
        spatialLiveGeometryDetachedDesktopId = expectedDesktopId;
        spatialLiveGeometryDetachedOutputId = outputId;
        if (expectedDesktopId === spatialLiveCameraDesktopId && spatialLiveCameraWindow !== null
                && spatialLiveCameraWindowId.length > 0) {
            spatialLiveCameraDetachedWindow = spatialLiveCameraWindow;
            spatialLiveCameraDetachedWindowId = spatialLiveCameraWindowId;
            clearSpatialLiveCameraAttachment();
        }
        return true;
    }

    function manualSpatialLiveGeometryDetachIsExact(index, expectedDesktopId, previousOffset, nextOffset) {
        try {
            if (!Number.isInteger(index) || index !== currentWorkspaceIndex
                    || typeof expectedDesktopId !== "string" || expectedDesktopId.length === 0
                    || !Number.isFinite(previousOffset) || !Number.isFinite(nextOffset)
                    || previousOffset === nextOffset || outputId.length === 0
                    || spatialHorizontalDesktopIds.length !== desktopIds.length
                    || spatialHorizontalDesktopIds[index] !== expectedDesktopId
                    || spatialHorizontalViewportOffsets.length !== desktopIds.length
                    || spatialHorizontalViewportOffsets[index] !== nextOffset
                    || desktopIds[index] !== expectedDesktopId) {
                return false;
            }

            const effect = sceneEffect;
            const model = overviewModel;
            const liveScreen = liveScreenFor(targetScreen);
            const expectedOutput = projectedOutput(model, liveScreen);
            const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
            const liveDesktop = liveDesktopFor(currentDesktop, expectedDesktopId);
            return expectedOutputId === outputId
                && desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                         liveDesktop, expectedDesktopId);
        } catch (error) {
            return false;
        }
    }

    function spatialLiveGeometryIsManuallyDetached(expectedOutputId, expectedDesktopId) {
        return typeof expectedOutputId === "string" && expectedOutputId.length > 0
            && typeof expectedDesktopId === "string" && expectedDesktopId.length > 0
            && spatialLiveGeometryDetachedOutputId === expectedOutputId
            && spatialLiveGeometryDetachedDesktopId === expectedDesktopId;
    }

    function clearSpatialLiveCameraAttachment() {
        spatialLiveCameraAttachment = null;
        spatialLiveCameraWindow = null;
        spatialLiveCameraWindowId = "";
        spatialLiveCameraDesktopId = "";
    }

    function clearSpatialLiveCameraDetachment() {
        spatialLiveCameraDetachedWindow = null;
        spatialLiveCameraDetachedWindowId = "";
        spatialLiveCameraReturnDesktopId = "";
        spatialLiveCameraReturnOutputId = "";
        spatialLiveCameraReturnViewportOffset = Number.NaN;
        spatialLiveGeometryDetachedDesktopId = "";
        spatialLiveGeometryDetachedOutputId = "";
    }

    function scheduleSpatialLiveCameraRefresh() {
        if (!sceneEffect || sceneEffect.active !== true || spatialLiveCameraRefreshPending
                || spatialLiveCameraRefreshBudget <= 0) {
            return false;
        }

        spatialLiveCameraRefreshBudget -= 1;
        spatialLiveCameraRefreshPending = true;
        const requestEpoch = spatialLiveCameraRefreshEpoch;
        Qt.callLater(function() {
            if (root.spatialLiveCameraRefreshEpoch !== requestEpoch) {
                return;
            }
            root.spatialLiveCameraRefreshPending = false;
            if (!root.sceneEffect || root.sceneEffect.active !== true) {
                return;
            }
            root.refreshOverviewSpatialSession(true);
        });
        return true;
    }

    function completeSpatialLiveCameraRefresh() {
        if (spatialLiveCameraRefreshPending) {
            advanceSpatialLiveCameraRefreshEpoch();
            spatialLiveCameraRefreshPending = false;
        }
        spatialLiveCameraRefreshBudget = 1;
    }

    function resetSpatialLiveCameraRefresh() {
        advanceSpatialLiveCameraRefreshEpoch();
        spatialLiveCameraRefreshPending = false;
        spatialLiveCameraRefreshBudget = 1;
    }

    function advanceSpatialLiveCameraRefreshEpoch() {
        spatialLiveCameraRefreshEpoch = spatialLiveCameraRefreshEpoch >= 2147483646
            ? 0 : spatialLiveCameraRefreshEpoch + 1;
    }

    function resetSpatialLiveCameraSession() {
        resetSpatialLiveCameraRefresh();
        clearSpatialLiveCameraAttachment();
        clearSpatialLiveCameraProbe();
        clearSpatialLiveCameraDetachment();
    }

    function handleSpatialLiveCameraWindowRemoved(removedWindow) {
        if (!removedWindow) {
            return false;
        }

        let removed = false;
        if (removedWindow === spatialLiveCameraWindow) {
            clearSpatialLiveCameraAttachment();
            removed = true;
        }
        if (removedWindow === spatialLiveCameraDetachedWindow) {
            clearSpatialLiveCameraDetachment();
            removed = true;
        }
        if (removedWindow === spatialLiveCameraProbeWindow) {
            clearSpatialLiveCameraProbe();
            removed = true;
        }
        if (removed) {
            resolveSpatialLiveCamera();
        }
        return removed;
    }

    function resetSpatialViewport(animateVisual = false) {
        if (!spatialLayoutIsValid(overviewSpatialLayout)) {
            resetSpatialEdgePanTracking();
            spatialVerticalCameraAnimation.stop();
            spatialContentY = 0;
            spatialVisualContentY = 0;
            return false;
        }

        const plan = planSpatialViewport(overviewSpatialLayout.initialContentY);
        if (!plan) {
            resetSpatialEdgePanTracking();
            spatialVerticalCameraAnimation.stop();
            spatialContentY = 0;
            spatialVisualContentY = 0;
            return false;
        }

        return setSpatialContentY(plan.contentY, animateVisual);
    }

    function setSpatialContentY(requestedContentY, animateVisual = false) {
        const plan = planSpatialViewport(requestedContentY);
        if (!plan) {
            return false;
        }

        const start = spatialVisualContentY;
        spatialVerticalCameraAnimation.stop();
        spatialVisualContentYDeferred = animateVisual === true && spatialPresentationSettled;
        if (spatialContentY !== plan.contentY) {
            spatialContentY = plan.contentY;
        }
        spatialVisualContentYDeferred = false;

        const distance = Math.abs(plan.contentY - start);
        const stride = Math.max(1, cardHeight + cardGap);
        const animateBoundedDistance = animateVisual === true && spatialPresentationSettled
            && distance > 0.000001 && distance <= stride * 4;
        if (animateBoundedDistance) {
            spatialVerticalCameraAnimation.from = start;
            spatialVerticalCameraAnimation.to = plan.contentY;
            spatialVerticalCameraAnimation.duration = Math.max(90, Math.min(180,
                Math.round(105 + Math.min(1.5, distance / stride) * 50)));
            spatialVerticalCameraAnimation.start();
        } else {
            spatialVisualContentY = plan.contentY;
        }
        return true;
    }

    function adoptSpatialVisualContentY() {
        const plan = planSpatialViewport(spatialVisualContentY);
        if (!plan) {
            return false;
        }

        spatialVerticalCameraAnimation.stop();
        spatialVisualContentYDeferred = false;
        if (spatialContentY !== plan.contentY) {
            spatialContentY = plan.contentY;
        }
        spatialVisualContentY = plan.contentY;
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
                || !Number.isFinite(spatialContentY) || spatialContentY < 0
                || spatialContentY > overviewSpatialLayout.contentHeight - height
                || !Number.isFinite(spatialEdgePanSceneX)
                || !Number.isFinite(spatialEdgePanSceneY)
                || !Number.isFinite(spatialEdgePanPointerX)
                || !Number.isFinite(spatialEdgePanPointerY)) {
            return false;
        }

        return spatialVerticalEdgePanCanRun() || spatialHorizontalEdgePanCanRun();
    }

    function spatialVerticalEdgePanCanRun() {
        if (overviewSpatialLayout.contentHeight <= height) {
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

        return spatialDirectDragSourceIsExact(spatialDirectDragSource,
                                              spatialDirectDragSourceDesktopId())
            || desktopReorderSpatialEdgePanIsExact();
    }

    function spatialHorizontalEdgePanContext() {
        try {
            const workspaceIndex = spatialDirectDragSourceWorkspaceIndex();
            const expectedDesktopId = spatialDirectDragSourceDesktopId();
            if (!Number.isInteger(workspaceIndex) || workspaceIndex < 0
                    || workspaceIndex >= desktopIds.length
                    || desktopIds[workspaceIndex] !== expectedDesktopId
                    || !spatialDirectDragSourceIsExact(spatialDirectDragSource, expectedDesktopId)) {
                return null;
            }

            const card = desktopCardAt(workspaceIndex);
            const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
            if (!card || !bounds || !Number.isFinite(card.projectionScale)
                    || card.projectionScale <= 0 || !Number.isFinite(card.contentWidth)
                    || card.contentWidth <= 0) {
                return null;
            }

            let viewportPoint = null;
            try {
                viewportPoint = card.mapToItem(root, card.contentLeft, card.contentTop);
            } catch (error) {
                return null;
            }
            if (!viewportPoint || !Number.isFinite(viewportPoint.x)) {
                return null;
            }

            const viewportOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex,
                                                                            expectedDesktopId, bounds);
            if (!Number.isFinite(viewportOffset) || viewportOffset < bounds.minimum
                    || viewportOffset > bounds.maximum) {
                return null;
            }

            return {
                bounds,
                card,
                expectedDesktopId,
                geometryEpoch: spatialHorizontalViewportRevision,
                pointerX: spatialEdgePanPointerX,
                projectionScale: card.projectionScale,
                viewportLeft: viewportPoint.x,
                viewportOffset,
                viewportWidth: card.contentWidth,
                workspaceIndex
            };
        } catch (error) {
            return null;
        }
    }

    function spatialHorizontalEdgePanCanRun() {
        const context = spatialHorizontalEdgePanContext();
        if (!context || !Number.isFinite(context.pointerX)) {
            return false;
        }

        const edgeZone = Math.min(context.viewportWidth * 0.12, 96);
        const viewportRight = context.viewportLeft + context.viewportWidth;
        if (!Number.isFinite(edgeZone) || edgeZone <= 0 || !Number.isFinite(viewportRight)) {
            return false;
        }

        return (context.pointerX < context.viewportLeft + edgeZone
                && context.viewportOffset > context.bounds.minimum)
            || (context.pointerX > viewportRight - edgeZone
                && context.viewportOffset < context.bounds.maximum);
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

        const verticalAdvanced = spatialVerticalEdgePanCanRun()
            && advanceSpatialVerticalEdgePan(elapsedMilliseconds);
        const horizontalAdvanced = spatialHorizontalEdgePanCanRun()
            && advanceSpatialHorizontalEdgePan(elapsedMilliseconds);
        return verticalAdvanced || horizontalAdvanced;
    }

    function advanceSpatialVerticalEdgePan(elapsedMilliseconds) {
        if (!spatialVerticalEdgePanCanRun() || elapsedMilliseconds !== spatialEdgePanTimer.interval) {
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

    function advanceSpatialHorizontalEdgePan(elapsedMilliseconds) {
        const context = spatialHorizontalEdgePanContext();
        const runtime = OverviewRuntime.DriftileOverview;
        if (!context || elapsedMilliseconds !== spatialEdgePanTimer.interval || !runtime
                || typeof runtime.planOverviewSpatialHorizontalEdgePan !== "function") {
            clearSpatialEdgePanScenePoint();
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialHorizontalEdgePan({
                                                                    elapsedMilliseconds,
                                                                    maximumViewportOffset: context.bounds.maximum,
                                                                    minimumViewportOffset: context.bounds.minimum,
                                                                    pointerX: context.pointerX,
                                                                    projectionScale: context.projectionScale,
                                                                    viewportLeft: context.viewportLeft,
                                                                    viewportOffset: context.viewportOffset,
                                                                    viewportWidth: context.viewportWidth
                                                                });
        } catch (error) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (!spatialHorizontalEdgePanPlanIsValid(plan, context, elapsedMilliseconds)) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (!plan.active) {
            return false;
        }

        const confirmed = spatialHorizontalEdgePanContext();
        if (!confirmed || confirmed.card !== context.card
                || confirmed.geometryEpoch !== context.geometryEpoch
                || confirmed.expectedDesktopId !== context.expectedDesktopId
                || confirmed.pointerX !== context.pointerX
                || confirmed.viewportLeft !== context.viewportLeft
                || confirmed.viewportOffset !== context.viewportOffset
                || confirmed.viewportWidth !== context.viewportWidth
                || confirmed.projectionScale !== context.projectionScale
                || !setSpatialHorizontalViewportOffsetForBounds(context.workspaceIndex,
                                                                context.expectedDesktopId,
                                                                plan.viewportOffset, context.bounds)) {
            clearSpatialEdgePanScenePoint();
            return false;
        }
        if (context.workspaceIndex === currentWorkspaceIndex
                && !detachSpatialLiveCameraForManualOffset(context.workspaceIndex, context.expectedDesktopId,
                                                           context.viewportOffset, plan.viewportOffset)) {
            const rollbackBounds = spatialHorizontalViewportBounds(context.workspaceIndex,
                                                                   context.expectedDesktopId);
            setSpatialHorizontalViewportOffsetForBounds(context.workspaceIndex, context.expectedDesktopId,
                                                        context.viewportOffset, rollbackBounds);
            clearSpatialEdgePanScenePoint();
            return false;
        }
        return true;
    }

    function spatialHorizontalEdgePanPlanIsValid(plan, context, elapsedMilliseconds) {
        if (!plan || Array.isArray(plan) || !context || typeof plan.active !== "boolean"
                || !Number.isFinite(plan.viewportOffset)
                || plan.viewportOffset < context.bounds.minimum
                || plan.viewportOffset > context.bounds.maximum
                || elapsedMilliseconds !== spatialEdgePanTimer.interval) {
            return false;
        }

        const delta = plan.viewportOffset - context.viewportOffset;
        const tolerance = Math.max(1, context.bounds.sourceWidth) * 0.000001;
        if (!plan.active) {
            return plan.direction === null && Math.abs(delta) <= tolerance;
        }

        const maximumDistance = Math.min(context.viewportWidth * 1.5, 1800)
            * elapsedMilliseconds / (1000 * context.projectionScale);
        return (plan.direction === "left" && delta < 0 || plan.direction === "right" && delta > 0)
            && Math.abs(delta) <= maximumDistance + tolerance;
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

    function setKeyboardSelectionTarget(target) {
        if (!target || typeof target.id !== "string" || target.id.length === 0) {
            return false;
        }

        if (keyboardSelectionId === target.id) {
            keyboardSelectionViewportTarget = null;
            return synchronizeKeyboardSelectionViewport(target);
        }

        keyboardSelectionViewportTarget = target;
        keyboardSelectionId = target.id;
        keyboardSelectionViewportTarget = null;
        return keyboardSelectionId === target.id;
    }

    function synchronizeKeyboardSelectionViewport(preferredTarget) {
        const selectedTargetId = keyboardSelectionId;
        if (selectedTargetId.length === 0) {
            return false;
        }

        let target = preferredTarget;
        if (!target || target.id !== selectedTargetId) {
            target = navigationTargetForId(collectNavigationTargets(), selectedTargetId);
        }
        if (!target || target.id !== selectedTargetId || typeof target.desktopId !== "string"
                || target.desktopId.length === 0) {
            return false;
        }

        const workspaceIndex = desktopIds.indexOf(target.desktopId);
        if (workspaceIndex < 0 || desktopIds[workspaceIndex] !== target.desktopId) {
            return false;
        }

        const plan = planSpatialWorkspaceCenter(workspaceIndex);
        if (!plan || keyboardSelectionId !== selectedTargetId) {
            return false;
        }

        if (!setSpatialContentY(plan.contentY, true)) {
            return false;
        }
        return target.kind !== "window"
            || revealHorizontalNavigationTarget(workspaceIndex, target.desktopId, target);
    }

    function planSpatialWorkspaceCenter(workspaceIndex) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceCenter !== "function") {
            return null;
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
            return null;
        }

        return spatialViewportPlanIsValid(plan) ? plan : null;
    }

    function spatialTouchPanContains(point) {
        try {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                    || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height
                    || !spatialPointerInputEligible || desktopReorderActive
                    || spatialDirectDragActive || !spatialWheelPresentationIsExact()
                    || spatialViewportOverlayContainsPoint(keyboardHelpHint, point)
                    || spatialViewportOverlayContainsPoint(searchOverlay, point)
                    || spatialViewportOverlayContainsPoint(outputIdentityLoader, point)) {
                return false;
            }

            const verticalAvailable = overviewSpatialLayout.contentHeight > height;
            return verticalAvailable || spatialHorizontalViewportRowContains(point);
        } catch (error) {
            return false;
        }
    }

    function beginSpatialTouchPan(point, translationX, translationY) {
        clearSpatialTouchPan();
        if (!spatialTouchPanDragHandler.active || !point
                || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || !Number.isFinite(translationX) || !Number.isFinite(translationY)
                || !spatialTouchPanContains(point)) {
            return blockSpatialTouchPan();
        }

        const horizontalCandidate = spatialHorizontalViewportRowContains(point);
        const verticalCandidate = overviewSpatialLayout.contentHeight > height;
        resetOverviewWheelState();

        spatialTouchPanInput.panAxis = "pending";
        spatialTouchPanInput.panHorizontalAvailable = horizontalCandidate;
        spatialTouchPanInput.panLayout = verticalCandidate ? overviewSpatialLayout : null;
        spatialTouchPanInput.panLastContentY = spatialContentY;
        spatialTouchPanInput.panOutputId = outputId;
        spatialTouchPanInput.panPressX = point.x;
        spatialTouchPanInput.panPressY = point.y;
        spatialTouchPanInput.panSceneHeight = height;
        spatialTouchPanInput.panStartContentY = spatialContentY;
        spatialTouchPanInput.panVerticalAvailable = verticalCandidate;

        if (horizontalCandidate
                && !beginSpatialHorizontalViewportDrag(
                    { x: spatialTouchPanInput.panPressX, y: spatialTouchPanInput.panPressY }, true)) {
            return blockSpatialTouchPan();
        }
        if (!horizontalCandidate) {
            clearSpatialHorizontalViewportDrag();
        }

        return updateSpatialTouchPan(translationX, translationY);
    }

    function updateSpatialTouchPan(translationX, translationY) {
        const axis = spatialTouchPanInput.panAxis;
        if ((axis !== "pending" && axis !== "horizontal" && axis !== "vertical")
                || !spatialTouchPanDragHandler.active
                || !Number.isFinite(translationX) || !Number.isFinite(translationY)
                || !spatialTouchPanContextIsExact()) {
            return blockSpatialTouchPan();
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewTouchPanAxis !== "function") {
            return blockSpatialTouchPan();
        }

        let plan = null;
        try {
            plan = runtime.planOverviewTouchPanAxis({
                                                        axis,
                                                        horizontalAvailable:
                                                            spatialTouchPanInput.panHorizontalAvailable,
                                                        translationX,
                                                        translationY,
                                                        verticalAvailable:
                                                            spatialTouchPanInput.panVerticalAvailable
                                                    });
        } catch (error) {
            return blockSpatialTouchPan();
        }
        if (!spatialTouchPanAxisPlanIsValid(plan, axis)) {
            return blockSpatialTouchPan();
        }

        if (axis === "pending" && plan.axis === "pending") {
            return true;
        }
        if (plan.axis === "horizontal") {
            if (!spatialTouchPanInput.panHorizontalAvailable
                    || !updateSpatialHorizontalViewportDrag(translationX)) {
                return blockSpatialTouchPan();
            }
            spatialTouchPanInput.panAxis = "horizontal";
            spatialTouchPanInput.panLayout = null;
            spatialTouchPanInput.panVerticalAvailable = false;
            return true;
        }
        if (plan.axis === "vertical") {
            if (!spatialTouchPanInput.panVerticalAvailable
                    || !spatialTouchPanVerticalContextIsExact()) {
                return blockSpatialTouchPan();
            }
            if (axis === "pending") {
                if (!adoptSpatialVisualContentY()) {
                    return blockSpatialTouchPan();
                }
                spatialTouchPanInput.panStartContentY = spatialContentY;
                spatialTouchPanInput.panLastContentY = spatialContentY;
            }
            clearSpatialHorizontalViewportDrag();
            spatialTouchPanInput.panAxis = "vertical";
            spatialTouchPanInput.panHorizontalAvailable = false;
            const viewportPlan = planSpatialViewport(
                spatialTouchPanInput.panStartContentY - translationY);
            if (!viewportPlan || !setSpatialContentY(viewportPlan.contentY)
                    || spatialContentY !== viewportPlan.contentY) {
                return blockSpatialTouchPan();
            }
            spatialTouchPanInput.panLastContentY = spatialContentY;
            if (!spatialTouchPanVerticalContextIsExact()) {
                return blockSpatialTouchPan();
            }
            return true;
        }

        return blockSpatialTouchPan();
    }

    function spatialTouchPanContextIsExact() {
        try {
            const pressPosition = spatialTouchPanDragHandler.centroid.pressPosition;
            if (!pressPosition || !Number.isFinite(spatialTouchPanInput.panPressX)
                    || !Number.isFinite(spatialTouchPanInput.panPressY)
                    || pressPosition.x !== spatialTouchPanInput.panPressX
                    || pressPosition.y !== spatialTouchPanInput.panPressY
                    || (!spatialTouchPanInput.panHorizontalAvailable
                        && !spatialTouchPanInput.panVerticalAvailable)) {
                return false;
            }
            if (spatialTouchPanInput.panHorizontalAvailable
                    && spatialHorizontalViewportDragContext() === null) {
                return false;
            }
            return !spatialTouchPanInput.panVerticalAvailable
                || spatialTouchPanVerticalContextIsExact();
        } catch (error) {
            return false;
        }
    }

    function spatialTouchPanVerticalContextIsExact() {
        const layout = spatialTouchPanInput.panLayout;
        const maximumContentY = layout ? layout.contentHeight - height : Number.NaN;
        return spatialTouchPanInput.panVerticalAvailable && layout
            && layout === overviewSpatialLayout && layout.contentHeight > height
            && spatialTouchPanInput.panOutputId.length > 0
            && spatialTouchPanInput.panOutputId === outputId
            && spatialTouchPanInput.panSceneHeight === height
            && spatialWheelPresentationIsExact()
            && Number.isFinite(spatialTouchPanInput.panLastContentY)
            && spatialContentY === spatialTouchPanInput.panLastContentY
            && Number.isFinite(spatialTouchPanInput.panStartContentY)
            && spatialTouchPanInput.panStartContentY >= 0
            && spatialTouchPanInput.panStartContentY <= maximumContentY;
    }

    function spatialTouchPanAxisPlanIsValid(plan, expectedAxis) {
        return plan && !Array.isArray(plan)
            && (plan.axis === "pending" || plan.axis === "horizontal" || plan.axis === "vertical")
            && (expectedAxis === "pending" || plan.axis === expectedAxis);
    }

    function blockSpatialTouchPan() {
        spatialTouchPanInput.panAxis = "blocked";
        spatialTouchPanInput.panHorizontalAvailable = false;
        spatialTouchPanInput.panLayout = null;
        spatialTouchPanInput.panLastContentY = 0;
        spatialTouchPanInput.panOutputId = "";
        spatialTouchPanInput.panSceneHeight = 0;
        spatialTouchPanInput.panVerticalAvailable = false;
        clearSpatialHorizontalViewportDrag();
        return false;
    }

    function clearSpatialTouchPan() {
        blockSpatialTouchPan();
        spatialTouchPanInput.panPressX = Number.NaN;
        spatialTouchPanInput.panPressY = Number.NaN;
        spatialTouchPanInput.panLastContentY = 0;
        spatialTouchPanInput.panStartContentY = 0;
    }

    function spatialViewportBackdropContains(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height
                || !spatialPointerInputEligible || desktopReorderActive
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

    function spatialHorizontalViewportBackdropContains(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height
                || !spatialPointerInputEligible || desktopReorderActive
                || spatialDirectDragActive
                || spatialViewportOverlayContainsPoint(keyboardHelpHint, point)
                || spatialViewportOverlayContainsPoint(searchOverlay, point)
                || spatialViewportOverlayContainsPoint(outputIdentityLoader, point)) {
            return false;
        }

        const workspaceIndex = spatialWorkspaceIndexAtPoint(point);
        if (workspaceIndex < 0) {
            return false;
        }
        const expectedDesktopId = desktopIds[workspaceIndex];
        const card = desktopCardAt(workspaceIndex);
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        if (!card || !bounds || bounds.minimum === bounds.maximum) {
            return false;
        }

        try {
            const localPoint = card.mapFromItem(root, point.x, point.y);
            const viewportX = localPoint.x - card.contentLeft;
            const viewportY = localPoint.y - card.contentTop;
            if (!Number.isFinite(viewportX) || !Number.isFinite(viewportY)
                    || viewportX < 0 || viewportY < 0
                    || viewportX >= card.contentWidth || viewportY >= card.contentHeight) {
                return false;
            }
            return !card.viewportPointHitsWindow({ x: viewportX, y: viewportY });
        } catch (error) {
            return false;
        }
    }

    function spatialHorizontalViewportRowContains(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height
                || !spatialPointerInputEligible || desktopReorderActive
                || spatialDirectDragActive || spatialViewportDragHandler.active
                || spatialHorizontalViewportDragHandler.active
                || spatialViewportOverlayContainsPoint(keyboardHelpHint, point)
                || spatialViewportOverlayContainsPoint(searchOverlay, point)
                || spatialViewportOverlayContainsPoint(outputIdentityLoader, point)) {
            return false;
        }

        const workspaceIndex = spatialWorkspaceIndexAtPoint(point);
        if (workspaceIndex < 0 || workspaceIndex >= desktopIds.length) {
            return false;
        }
        const expectedDesktopId = desktopIds[workspaceIndex];
        const card = desktopCardAt(workspaceIndex);
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        const viewportOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex,
                                                                        expectedDesktopId, bounds);
        return typeof expectedDesktopId === "string" && expectedDesktopId.length > 0
            && card && card.desktopId === expectedDesktopId
            && Number.isFinite(card.projectionScale) && card.projectionScale > 0
            && bounds && Number.isFinite(bounds.minimum) && Number.isFinite(bounds.maximum)
            && bounds.minimum < bounds.maximum && Number.isFinite(viewportOffset)
            && viewportOffset >= bounds.minimum && viewportOffset <= bounds.maximum;
    }

    function beginSpatialHorizontalViewportDrag(point, includeWindows = false) {
        clearSpatialHorizontalViewportDrag();
        const pointAccepted = includeWindows === true
            ? spatialHorizontalViewportRowContains(point)
            : includeWindows === false && spatialHorizontalViewportBackdropContains(point);
        if (!spatialPointerInputEligible || !spatialWheelPresentationIsExact() || !pointAccepted) {
            return false;
        }

        const workspaceIndex = spatialWorkspaceIndexAtPoint(point);
        const expectedDesktopId = workspaceIndex >= 0 && workspaceIndex < desktopIds.length
            ? desktopIds[workspaceIndex] : "";
        const card = desktopCardAt(workspaceIndex);
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        if (!card || !bounds || !Number.isFinite(card.projectionScale) || card.projectionScale <= 0) {
            return false;
        }

        const viewportOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex,
                                                                        expectedDesktopId, bounds);
        if (!Number.isFinite(viewportOffset) || viewportOffset < bounds.minimum
                || viewportOffset > bounds.maximum) {
            return false;
        }

        resetOverviewWheelState();
        spatialHorizontalViewportInput.panDesktopId = expectedDesktopId;
        spatialHorizontalViewportInput.panGeometryEpoch = spatialHorizontalViewportRevision;
        spatialHorizontalViewportInput.panLastViewportOffset = viewportOffset;
        spatialHorizontalViewportInput.panOutputId = outputId;
        spatialHorizontalViewportInput.panProjectionScale = card.projectionScale;
        spatialHorizontalViewportInput.panStartViewportOffset = viewportOffset;
        spatialHorizontalViewportInput.panWorkspaceIndex = workspaceIndex;
        return true;
    }

    function spatialHorizontalViewportDragContext() {
        try {
            const workspaceIndex = spatialHorizontalViewportInput.panWorkspaceIndex;
            const expectedDesktopId = spatialHorizontalViewportInput.panDesktopId;
            const expectedOutputId = spatialHorizontalViewportInput.panOutputId;
            if (!spatialWheelPresentationIsExact()
                    || typeof expectedOutputId !== "string" || expectedOutputId.length === 0
                    || outputId !== expectedOutputId
                    || !Number.isInteger(workspaceIndex) || workspaceIndex < 0
                    || workspaceIndex >= desktopIds.length || desktopIds[workspaceIndex] !== expectedDesktopId
                    || spatialHorizontalViewportInput.panGeometryEpoch !== spatialHorizontalViewportRevision) {
                return null;
            }

            const card = desktopCardAt(workspaceIndex);
            const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
            const lastViewportOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex,
                                                                                expectedDesktopId, bounds);
            if (!card || !bounds || card.projectionScale !== spatialHorizontalViewportInput.panProjectionScale
                    || lastViewportOffset !== spatialHorizontalViewportInput.panLastViewportOffset
                    || !Number.isFinite(spatialHorizontalViewportInput.panStartViewportOffset)
                    || spatialHorizontalViewportInput.panStartViewportOffset < bounds.minimum
                    || spatialHorizontalViewportInput.panStartViewportOffset > bounds.maximum) {
                return null;
            }

            return {
                bounds,
                card,
                expectedDesktopId,
                expectedOutputId,
                geometryEpoch: spatialHorizontalViewportRevision,
                lastViewportOffset,
                projectionScale: card.projectionScale,
                startViewportOffset: spatialHorizontalViewportInput.panStartViewportOffset,
                workspaceIndex
            };
        } catch (error) {
            return null;
        }
    }

    function updateSpatialHorizontalViewportDrag(translationX) {
        const context = spatialHorizontalViewportDragContext();
        const runtime = OverviewRuntime.DriftileOverview;
        if (!context || !Number.isFinite(translationX) || !runtime
                || typeof runtime.planOverviewSpatialHorizontalDrag !== "function") {
            return false;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewSpatialHorizontalDrag({
                                                                 maximumViewportOffset: context.bounds.maximum,
                                                                 minimumViewportOffset: context.bounds.minimum,
                                                                 projectionScale: context.projectionScale,
                                                                 startViewportOffset: context.startViewportOffset,
                                                                 translationX
                                                             });
        } catch (error) {
            return false;
        }
        if (!spatialHorizontalViewportDragPlanIsValid(plan, context, translationX)) {
            return false;
        }

        const confirmed = spatialHorizontalViewportDragContext();
        if (!confirmed || confirmed.card !== context.card
                || confirmed.geometryEpoch !== context.geometryEpoch
                || confirmed.expectedDesktopId !== context.expectedDesktopId
                || confirmed.expectedOutputId !== context.expectedOutputId
                || confirmed.lastViewportOffset !== context.lastViewportOffset
                || confirmed.projectionScale !== context.projectionScale
                || confirmed.startViewportOffset !== context.startViewportOffset) {
            return false;
        }
        if (plan.viewportOffset === context.lastViewportOffset) {
            return true;
        }
        if (!setSpatialHorizontalViewportOffsetForBounds(context.workspaceIndex,
                                                         context.expectedDesktopId,
                                                         plan.viewportOffset, context.bounds)) {
            return false;
        }
        if (context.workspaceIndex === currentWorkspaceIndex
                && !detachSpatialLiveCameraForManualOffset(context.workspaceIndex, context.expectedDesktopId,
                                                           context.lastViewportOffset, plan.viewportOffset)) {
            const rollbackBounds = spatialHorizontalViewportBounds(context.workspaceIndex,
                                                                   context.expectedDesktopId);
            const rollbackSucceeded = rollbackBounds
                && setSpatialHorizontalViewportOffsetForBounds(context.workspaceIndex,
                                                               context.expectedDesktopId,
                                                               context.lastViewportOffset, rollbackBounds)
                && spatialHorizontalViewportOffsetForBounds(context.workspaceIndex,
                                                            context.expectedDesktopId,
                                                            rollbackBounds) === context.lastViewportOffset;
            clearSpatialHorizontalViewportDrag();
            if (!rollbackSucceeded && !refreshSpatialHorizontalViewports(false)) {
                refreshOverviewSpatialSession(true);
            }
            return false;
        }

        spatialHorizontalViewportInput.panGeometryEpoch = spatialHorizontalViewportRevision;
        spatialHorizontalViewportInput.panLastViewportOffset = plan.viewportOffset;
        return true;
    }

    function spatialHorizontalViewportDragPlanIsValid(plan, context, translationX) {
        if (!plan || Array.isArray(plan) || !context || !Number.isFinite(plan.viewportOffset)
                || plan.viewportOffset < context.bounds.minimum
                || plan.viewportOffset > context.bounds.maximum) {
            return false;
        }

        const expectedViewportOffset = Math.min(context.bounds.maximum,
                                                Math.max(context.bounds.minimum,
                                                         context.startViewportOffset
                                                         - translationX / context.projectionScale));
        const normalizedExpectedViewportOffset = Object.is(expectedViewportOffset, -0)
            ? 0 : expectedViewportOffset;
        return Number.isFinite(normalizedExpectedViewportOffset)
            && plan.viewportOffset === normalizedExpectedViewportOffset;
    }

    function clearSpatialHorizontalViewportDrag() {
        spatialHorizontalViewportInput.panDesktopId = "";
        spatialHorizontalViewportInput.panGeometryEpoch = -1;
        spatialHorizontalViewportInput.panLastViewportOffset = 0;
        spatialHorizontalViewportInput.panOutputId = "";
        spatialHorizontalViewportInput.panProjectionScale = 1;
        spatialHorizontalViewportInput.panStartViewportOffset = 0;
        spatialHorizontalViewportInput.panWorkspaceIndex = -1;
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
        if (desktopReorderActive || spatialDirectDragActive
                || spatialTouchPanDragHandler.active || !desktopReorderAvailable) {
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
        if (!adoptSpatialVisualContentY()) {
            return;
        }

        resetOverviewWheelState();
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
        if (!spatialDirectDragActive) {
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

    function desktopIdListShapeIsValid(candidate) {
        return candidate !== undefined && candidate !== null && Number.isInteger(candidate.length)
            && candidate.length >= 0 && candidate.length <= 512;
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
        const previousSelectionId = keyboardSelectionId;
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }
        if (keyboardSelectionId !== previousSelectionId) {
            targets = collectNavigationTargets();
        }
        if (!navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewNavigationTarget(keyboardSelectionId, targets, direction);
            const target = typeof targetId === "string" ? navigationTargetForId(targets, targetId) : null;
            if (target) {
                setKeyboardSelectionTarget(target);
            }
        } catch (error) {
            return;
        }
    }

    function navigateKeyboardSequence(direction) {
        let targets = collectNavigationTargets();
        const previousSelectionId = keyboardSelectionId;
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }
        if (keyboardSelectionId !== previousSelectionId) {
            targets = collectNavigationTargets();
        }
        if (!navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewSequentialNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewSequentialNavigationTarget(keyboardSelectionId, targets, direction);
            const target = typeof targetId === "string" ? navigationTargetForId(targets, targetId) : null;
            if (target) {
                setKeyboardSelectionTarget(target);
            }
        } catch (error) {
            return;
        }
    }

    function navigateKeyboardBoundary(direction) {
        if (direction !== "first" && direction !== "last") {
            return;
        }
        if (searchQuery.length > 0) {
            navigateKeyboardSequence(direction);
            return;
        }
        if (desktopIds.length <= 0 || !spatialLayoutIsValid(overviewSpatialLayout)) {
            return;
        }

        const workspaceIndex = direction === "first" ? 0 : desktopIds.length - 1;
        const plan = planSpatialWorkspaceCenter(workspaceIndex);
        if (!plan) {
            return;
        }

        const requestId = nextKeyboardBoundaryNavigationRequestId();
        const request = {
            contentY: plan.contentY,
            currentDesktop,
            currentWorkspaceIndex,
            desktopIds,
            direction,
            effect: sceneEffect,
            layout: overviewSpatialLayout,
            model: overviewModel,
            outputId,
            requestId,
            screen: targetScreen,
            workspaceIndex
        };
        if (!keyboardBoundaryNavigationContextIsExact(request)) {
            return;
        }

        keyboardBoundaryNavigationPending = true;
        if (!setSpatialContentY(plan.contentY, true)
                || !keyboardBoundaryNavigationViewportIsExact(request)) {
            finishFailedKeyboardBoundaryNavigation(request);
            return;
        }

        Qt.callLater(root.completeKeyboardBoundaryNavigation, request);
    }

    function nextKeyboardBoundaryNavigationRequestId() {
        const nextRequestId = keyboardBoundaryNavigationRequestId >= 2147483646
            ? 1 : keyboardBoundaryNavigationRequestId + 1;
        keyboardBoundaryNavigationRequestId = nextRequestId;
        return nextRequestId;
    }

    function cancelKeyboardBoundaryNavigation() {
        nextKeyboardBoundaryNavigationRequestId();
        keyboardBoundaryNavigationPending = false;
    }

    function keyboardBoundaryNavigationContextIsExact(request) {
        try {
            if (!request || request.requestId !== keyboardBoundaryNavigationRequestId
                    || !spatialKeyboardInputEligible
                    || (request.direction !== "first" && request.direction !== "last")
                    || request.effect !== sceneEffect || !request.effect
                    || request.effect.active !== true || request.effect.overviewModel !== request.model
                    || request.model !== overviewModel || request.screen !== targetScreen
                    || request.outputId !== outputId || request.desktopIds !== desktopIds
                    || request.layout !== overviewSpatialLayout
                    || request.currentDesktop !== currentDesktop
                    || request.currentWorkspaceIndex !== currentWorkspaceIndex
                    || searchQuery.length > 0 || keyboardHelpVisible || desktopReorderActive
                    || spatialDirectDragActive || spatialTouchPanDragHandler.active
                    || spatialViewportDragHandler.active
                    || spatialHorizontalViewportDragHandler.active
                    || spatialHorizontalRowDragHandler.active
                    || desktopRepeater.count !== desktopIds.length
                    || !spatialLayoutIsValid(overviewSpatialLayout)
                    || !Number.isInteger(request.workspaceIndex)
                    || request.workspaceIndex < 0 || request.workspaceIndex >= desktopIds.length
                    || request.workspaceIndex !== (request.direction === "first" ? 0 : desktopIds.length - 1)
                    || !Number.isFinite(request.contentY)) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    function keyboardBoundaryNavigationViewportIsExact(request) {
        return keyboardBoundaryNavigationPending
            && keyboardBoundaryNavigationContextIsExact(request)
            && spatialContentY === request.contentY
            && spatialVisibleRangeIsValid(overviewSpatialVisibleRange)
            && request.workspaceIndex >= overviewSpatialVisibleRange.firstIndex
            && request.workspaceIndex <= overviewSpatialVisibleRange.lastIndex;
    }

    function completeKeyboardBoundaryNavigation(request) {
        if (!keyboardBoundaryNavigationViewportIsExact(request)
                || !desktopCardAt(request.workspaceIndex)) {
            finishFailedKeyboardBoundaryNavigation(request);
            return;
        }

        const targets = collectNavigationTargets();
        const target = keyboardBoundaryNavigationTarget(targets, request.direction);
        if (!keyboardBoundaryNavigationViewportIsExact(request) || !target
                || navigationTargetForId(targets, target.id) !== target) {
            finishFailedKeyboardBoundaryNavigation(request);
            return;
        }

        keyboardBoundaryNavigationPending = false;
        setKeyboardSelectionTarget(target);
    }

    function finishFailedKeyboardBoundaryNavigation(request) {
        if (!request || request.requestId !== keyboardBoundaryNavigationRequestId) {
            return;
        }

        keyboardBoundaryNavigationPending = false;
        Qt.callLater(root.repairKeyboardSelection);
    }

    function keyboardBoundaryNavigationTarget(targets, direction) {
        let selected = null;
        for (const target of targets) {
            if (!target || typeof target.id !== "string" || target.id.length === 0) {
                continue;
            }
            if (!selected || (direction === "first" && navigationTargetPrecedes(target, selected))
                    || (direction === "last" && navigationTargetPrecedes(selected, target))) {
                selected = target;
            }
        }

        return selected;
    }

    function routeOverviewWheel(event, point, handlerAxis) {
        if (!event) {
            return false;
        }
        if (!spatialPointerInputEligible) {
            return false;
        }
        if ((handlerAxis !== "horizontal" && handlerAxis !== "vertical")
                || !event.pixelDelta || !event.angleDelta
                || !Number.isFinite(event.pixelDelta.x) || !Number.isFinite(event.pixelDelta.y)
                || !Number.isFinite(event.angleDelta.x) || !Number.isFinite(event.angleDelta.y)) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWheelAxis !== "function") {
            return false;
        }

        const expectedAxisOwner = overviewWheelAxisOwner.length === 0 ? null : overviewWheelAxisOwner;
        let plan = null;
        try {
            plan = runtime.planOverviewSpatialWheelAxis({
                                                            angleDeltaX: event.angleDelta.x,
                                                            angleDeltaY: event.angleDelta.y,
                                                            axisOwner: expectedAxisOwner,
                                                            pixelDeltaX: event.pixelDelta.x,
                                                            pixelDeltaY: event.pixelDelta.y
                                                        });
        } catch (error) {
            return false;
        }
        if (!spatialWheelAxisPlanIsValid(plan, expectedAxisOwner) || plan.axis === null
                || handlerAxis !== plan.axis) {
            return false;
        }

        const claimedAxis = overviewWheelAxisOwner.length === 0;
        if (claimedAxis) {
            overviewWheelAxisOwner = plan.axisOwner;
        }
        if (plan.axis !== plan.axisOwner) {
            event.accepted = true;
            return true;
        }

        const handled = plan.axis === "horizontal"
            ? handleOverviewHorizontalWheel(event, point)
            : handleOverviewWheel(event);
        if (claimedAxis && !handled) {
            overviewWheelAxisOwner = "";
        }
        return handled;
    }

    function spatialWheelAxisPlanIsValid(plan, expectedAxisOwner) {
        if (!plan || Array.isArray(plan)
                || (expectedAxisOwner !== null && expectedAxisOwner !== "horizontal"
                    && expectedAxisOwner !== "vertical")
                || (plan.axis !== null && plan.axis !== "horizontal" && plan.axis !== "vertical")
                || (plan.axisOwner !== null && plan.axisOwner !== "horizontal"
                    && plan.axisOwner !== "vertical")
                || (plan.inputMode !== null && plan.inputMode !== "angle" && plan.inputMode !== "pixel")) {
            return false;
        }
        if (plan.axis === null) {
            return plan.inputMode === null && plan.axisOwner === expectedAxisOwner;
        }

        return plan.inputMode !== null && plan.axisOwner !== null
            && (expectedAxisOwner === null ? plan.axisOwner === plan.axis
                                           : plan.axisOwner === expectedAxisOwner);
    }

    function routeOverviewShiftHorizontalWheel(event, point) {
        if (!event) {
            return false;
        }
        if (!spatialPointerInputEligible) {
            return false;
        }
        if (event.modifiers !== Qt.ShiftModifier
                || !event.pixelDelta || !event.angleDelta
                || !Number.isFinite(event.pixelDelta.y) || !Number.isFinite(event.angleDelta.y)) {
            return false;
        }

        const pixelDeltaX = event.pixelDelta.y;
        const angleDeltaX = event.angleDelta.y;
        if (pixelDeltaX === 0 && angleDeltaX === 0) {
            return false;
        }

        const claimedAxis = overviewWheelAxisOwner.length === 0;
        if (claimedAxis) {
            overviewWheelAxisOwner = "horizontal";
        }
        if (overviewWheelAxisOwner !== "horizontal") {
            event.accepted = true;
            return true;
        }

        const handled = handleOverviewHorizontalWheelInput(event, point, angleDeltaX, pixelDeltaX);
        if (claimedAxis && !handled) {
            overviewWheelAxisOwner = "";
        }
        return handled;
    }

    function releaseOverviewWheelAxisIfIdle() {
        if (!spatialVerticalWheelHandler.active && !spatialHorizontalWheelHandler.active
                && !spatialShiftHorizontalWheelHandler.active) {
            if (overviewWheelAxisOwner === "vertical") {
                finishSpatialVerticalWheelGesture();
            }
            overviewWheelAxisOwner = "";
        }
    }

    function handleOverviewWheel(event) {
        if (!event) {
            return false;
        }
        try {
            if (keyboardHelpVisible || !sceneEffect || sceneEffect.active !== true
                    || event.modifiers !== Qt.NoModifier || !event.pixelDelta || !event.angleDelta
                    || !Number.isFinite(event.pixelDelta.y) || !Number.isFinite(event.angleDelta.y)) {
                return false;
            }

            const rawPixelDeltaY = event.pixelDelta.y;
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime
                    || typeof runtime.normalizeOverviewPhysicalWheelAngleDelta !== "function"
                    || typeof runtime.normalizeOverviewPhysicalWheelPixelDelta !== "function") {
                return false;
            }
            const angleDeltaY = runtime.normalizeOverviewPhysicalWheelAngleDelta(
                event.angleDelta.y, event.inverted === true);
            const physicalPixelDeltaY = runtime.normalizeOverviewPhysicalWheelPixelDelta(
                rawPixelDeltaY, event.inverted === true);
            if (!Number.isSafeInteger(angleDeltaY) || !Number.isFinite(physicalPixelDeltaY)) {
                return false;
            }
            const pixelDeltaY = physicalPixelDeltaY === 0 ? 0 : -physicalPixelDeltaY;
            if (pixelDeltaY === 0 && angleDeltaY === 0) {
                return false;
            }
            if (spatialTouchPanDragHandler.active || spatialViewportDragHandler.active
                    || spatialHorizontalViewportDragHandler.active
                    || spatialHorizontalRowDragHandler.active
                    || spatialDirectDragActive
                    || desktopReorderActive) {
                resetOverviewWheelState();
                event.accepted = true;
                return true;
            }

            resetOverviewHorizontalWheelState();
            const handled = pixelDeltaY !== 0
                ? handleSpatialViewportWheel(angleDeltaY, pixelDeltaY)
                : searchQuery.length > 0
                    ? handleSearchResultWheel(angleDeltaY)
                    : handleSpatialWorkspaceWheel(angleDeltaY);
            if (handled) {
                event.accepted = true;
            }
            return handled;
        } catch (error) {
            return false;
        }
    }

    function handleOverviewHorizontalWheel(event, point) {
        if (!event) {
            return false;
        }
        try {
            if (keyboardHelpVisible || !sceneEffect || sceneEffect.active !== true
                    || event.modifiers !== Qt.NoModifier || !event.pixelDelta || !event.angleDelta
                    || !Number.isFinite(event.pixelDelta.x) || !Number.isFinite(event.angleDelta.x)) {
                return false;
            }

            return handleOverviewHorizontalWheelInput(event, point,
                                                      event.angleDelta.x, event.pixelDelta.x);
        } catch (error) {
            return false;
        }
    }

    function handleOverviewHorizontalWheelInput(event, point, angleDeltaX, pixelDeltaX) {
        try {
            if (!event || keyboardHelpVisible || !sceneEffect || sceneEffect.active !== true
                    || !Number.isFinite(pixelDeltaX) || !Number.isFinite(angleDeltaX)
                    || (pixelDeltaX === 0 && angleDeltaX === 0)) {
                return false;
            }

            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime
                    || typeof runtime.normalizeOverviewPhysicalWheelAngleDelta !== "function"
                    || typeof runtime.normalizeOverviewPhysicalWheelPixelDelta !== "function") {
                return false;
            }
            const physicalAngleDeltaX = runtime.normalizeOverviewPhysicalWheelAngleDelta(
                angleDeltaX, event.inverted === true);
            const physicalPixelDeltaX = runtime.normalizeOverviewPhysicalWheelPixelDelta(
                pixelDeltaX, event.inverted === true);
            if (!Number.isSafeInteger(physicalAngleDeltaX) || !Number.isFinite(physicalPixelDeltaX)) {
                return false;
            }
            angleDeltaX = physicalAngleDeltaX === 0 ? 0 : -physicalAngleDeltaX;
            pixelDeltaX = physicalPixelDeltaX === 0 ? 0 : -physicalPixelDeltaX;
            if (pixelDeltaX !== 0) {
                cancelOverviewHorizontalWheelSelectionRequest();
            }
            if (spatialTouchPanDragHandler.active || spatialViewportDragHandler.active
                    || spatialHorizontalViewportDragHandler.active
                    || spatialHorizontalRowDragHandler.active
                    || spatialDirectDragActive
                    || desktopReorderActive) {
                resetOverviewWheelState();
                event.accepted = true;
                return true;
            }
            if (searchQuery.length > 0) {
                resetOverviewHorizontalWheelState();
                event.accepted = true;
                return true;
            }

            const workspaceIndex = spatialWorkspaceIndexAtPoint(point);
            if (workspaceIndex < 0) {
                return false;
            }
            const expectedDesktopId = desktopIds[workspaceIndex];
            const card = desktopCardAt(workspaceIndex);
            if (!card || card.desktopId !== expectedDesktopId || !Number.isFinite(card.projectionScale)
                    || card.projectionScale <= 0) {
                return false;
            }

            resetOverviewVerticalWheelState();
            const handled = pixelDeltaX !== 0
                ? handleSpatialHorizontalViewportWheel(workspaceIndex, expectedDesktopId, card,
                                                       angleDeltaX, pixelDeltaX)
                : handleSpatialHorizontalSelectionWheel(workspaceIndex, expectedDesktopId, card, angleDeltaX);
            if (handled) {
                event.accepted = true;
            }
            return handled;
        } catch (error) {
            return false;
        }
    }

    function spatialWorkspaceIndexAtPoint(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || !Number.isFinite(cardX) || !Number.isFinite(cardTop)
                || !Number.isFinite(cardWidth) || !Number.isFinite(cardHeight)
                || !Number.isFinite(cardGap) || cardWidth <= 0 || cardHeight <= 0 || cardGap < 0
                || point.x < cardX || point.x >= cardX + cardWidth) {
            return -1;
        }

        const stride = cardHeight + cardGap;
        const index = Math.floor((point.y - cardTop) / stride);
        const localY = point.y - cardTop - index * stride;
        return index >= 0 && index < desktopIds.length && localY >= 0 && localY < cardHeight
            ? index : -1;
    }

    function handleSpatialHorizontalViewportWheel(workspaceIndex, expectedDesktopId, card,
                                                   angleDeltaX, pixelDeltaX) {
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        const currentOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex, expectedDesktopId, bounds);
        if (!bounds || !spatialWheelPresentationIsExact()) {
            return false;
        }

        const plan = planSpatialHorizontalWheel(angleDeltaX, pixelDeltaX, currentOffset,
                                                card.projectionScale, bounds);
        if (!spatialHorizontalViewportWheelPlanIsValid(plan, pixelDeltaX, currentOffset,
                                                       card.projectionScale, bounds)
                || !spatialWheelPresentationIsExact()
                || !setSpatialHorizontalViewportOffsetForBounds(workspaceIndex, expectedDesktopId,
                                                                plan.viewportOffset, bounds)) {
            return false;
        }

        overviewHorizontalWheelPixelRemainder = plan.pixelRemainder;
        overviewHorizontalWheelRemainder = 0;
        const applied = spatialHorizontalViewportOffsets[workspaceIndex] === plan.viewportOffset;
        if (applied) {
            detachSpatialLiveCameraForManualOffset(workspaceIndex, expectedDesktopId,
                                                   currentOffset, plan.viewportOffset);
        }
        return applied;
    }

    function handleSpatialHorizontalSelectionWheel(workspaceIndex, expectedDesktopId, card, angleDeltaX) {
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        const currentOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex, expectedDesktopId, bounds);
        if (!bounds || !spatialWheelPresentationIsExact()) {
            return false;
        }

        const plan = planSpatialHorizontalWheel(angleDeltaX, 0, currentOffset, card.projectionScale, bounds);
        if (!spatialHorizontalSelectionWheelPlanIsValid(plan, currentOffset)
                || !spatialWheelPresentationIsExact()) {
            return false;
        }

        if (plan.steps > 0) {
            if (!requestSpatialHorizontalWheelSelection(workspaceIndex, expectedDesktopId,
                                                        plan.direction, plan.steps)) {
                return false;
            }
            overviewHorizontalWheelPixelRemainder = 0;
            overviewHorizontalWheelRemainder = 0;
        } else {
            overviewHorizontalWheelPixelRemainder = 0;
            overviewHorizontalWheelRemainder = plan.remainder;
        }
        return true;
    }

    function planSpatialHorizontalWheel(angleDeltaX, pixelDeltaX, viewportOffset, projectionScale, bounds) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialHorizontalWheel !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewSpatialHorizontalWheel({
                                                                  angleDeltaX,
                                                                  maximumViewportOffset: bounds.maximum,
                                                                  minimumViewportOffset: bounds.minimum,
                                                                  pixelDeltaX,
                                                                  pixelRemainder: overviewHorizontalWheelPixelRemainder,
                                                                  projectionScale,
                                                                  remainder: overviewHorizontalWheelRemainder,
                                                                  viewportOffset
                                                              });
        } catch (error) {
            return null;
        }
    }

    function spatialHorizontalViewportWheelPlanIsValid(plan, pixelDeltaX, viewportOffset,
                                                       projectionScale, bounds) {
        const sceneDelta = pixelDeltaX / projectionScale;
        const accumulatedSceneDelta = overviewHorizontalWheelPixelRemainder !== 0
            && Math.sign(overviewHorizontalWheelPixelRemainder) !== Math.sign(sceneDelta)
            ? sceneDelta : overviewHorizontalWheelPixelRemainder + sceneDelta;
        const quantizedSceneDelta = Math.trunc(accumulatedSceneDelta * 64) / 64;
        const expectedOffset = Math.min(bounds.maximum,
                                        Math.max(bounds.minimum, viewportOffset - quantizedSceneDelta));
        const reachedBoundary = (accumulatedSceneDelta > 0 && expectedOffset === bounds.minimum)
            || (accumulatedSceneDelta < 0 && expectedOffset === bounds.maximum);
        const expectedPixelRemainder = reachedBoundary
            ? 0 : accumulatedSceneDelta - quantizedSceneDelta;
        return plan && !Array.isArray(plan) && plan.intent === "viewport"
            && plan.remainder === 0 && plan.direction === undefined && plan.steps === undefined
            && Number.isFinite(plan.viewportOffset) && plan.viewportOffset === expectedOffset
            && Number.isFinite(plan.pixelRemainder) && Math.abs(plan.pixelRemainder) < 1 / 64
            && Math.abs(plan.pixelRemainder - expectedPixelRemainder) <= Number.EPSILON * 8;
    }

    function spatialHorizontalSelectionWheelPlanIsValid(plan, viewportOffset) {
        return plan && !Array.isArray(plan) && plan.intent === "selection"
            && plan.viewportOffset === viewportOffset && plan.pixelRemainder === 0
            && spatialWorkspaceWheelPlanShapeIsValid(plan);
    }

    function requestSpatialHorizontalWheelSelection(workspaceIndex, expectedDesktopId, direction, steps) {
        const expectedOutputId = outputId;
        if ((direction !== "previous" && direction !== "next") || !Number.isInteger(steps)
                || steps < 1 || steps > 4 || !horizontalWheelScalarIdIsValid(expectedDesktopId, false)
                || !horizontalWheelScalarIdIsValid(expectedOutputId, false)
                || desktopIds[workspaceIndex] !== expectedDesktopId
                || !spatialWheelPresentationIsExact()) {
            return false;
        }

        const geometryEpoch = spatialHorizontalViewportRevision;
        const cardEpoch = overviewDesktopCardEpoch;
        const pendingExact = overviewHorizontalWheelSelectionPending
            && overviewHorizontalWheelSelectionOutputId === expectedOutputId
            && overviewHorizontalWheelSelectionDesktopId === expectedDesktopId
            && overviewHorizontalWheelSelectionWorkspaceIndex === workspaceIndex
            && overviewHorizontalWheelSelectionGeometryEpoch === geometryEpoch
            && horizontalWheelSelectionRequestContextIsExact(
                overviewHorizontalWheelSelectionRequestId,
                overviewHorizontalWheelSelectionOutputId,
                overviewHorizontalWheelSelectionDesktopId,
                overviewHorizontalWheelSelectionWorkspaceIndex,
                overviewHorizontalWheelSelectionGeometryEpoch,
                cardEpoch,
                overviewHorizontalWheelSelectionSourceTargetId);
        if (overviewHorizontalWheelSelectionPending && !pendingExact) {
            cancelOverviewHorizontalWheelSelectionRequest();
        }
        const sourceTargetId = pendingExact
            ? overviewHorizontalWheelSelectionSourceTargetId : keyboardSelectionId;
        const currentStepOffset = pendingExact
            ? overviewHorizontalWheelSelectionStepOffset : 0;
        if (!horizontalWheelScalarIdIsValid(sourceTargetId, true)
                || !Number.isInteger(currentStepOffset) || Math.abs(currentStepOffset) > 4) {
            return false;
        }

        const stepDelta = direction === "next" ? steps : -steps;
        const requestedStepOffset = Math.max(-4, Math.min(4, currentStepOffset + stepDelta));
        if (requestedStepOffset === 0) {
            if (pendingExact) {
                cancelOverviewHorizontalWheelSelectionRequest();
            }
            return true;
        }

        let targetPlan = null;
        try {
            targetPlan = horizontalWheelSelectionTargetPlan(expectedDesktopId, sourceTargetId,
                                                            requestedStepOffset);
        } catch (error) {
            if (pendingExact) {
                cancelOverviewHorizontalWheelSelectionRequest();
            }
            return false;
        }
        if (!targetPlan || Array.isArray(targetPlan)
                || !horizontalWheelScalarIdIsValid(targetPlan.targetId, true)
                || !Number.isInteger(targetPlan.stepOffset)
                || Math.abs(targetPlan.stepOffset) > Math.abs(requestedStepOffset)
                || (targetPlan.stepOffset !== 0
                    && Math.sign(targetPlan.stepOffset) !== Math.sign(requestedStepOffset))
                || geometryEpoch !== spatialHorizontalViewportRevision
                || cardEpoch !== overviewDesktopCardEpoch || outputId !== expectedOutputId
                || desktopIds[workspaceIndex] !== expectedDesktopId
                || !spatialWheelPresentationIsExact()) {
            if (pendingExact) {
                cancelOverviewHorizontalWheelSelectionRequest();
            }
            return false;
        }
        if (targetPlan.stepOffset === 0 || targetPlan.targetId.length === 0
                || targetPlan.targetId === sourceTargetId) {
            if (pendingExact) {
                cancelOverviewHorizontalWheelSelectionRequest();
            }
            return true;
        }
        if (pendingExact) {
            overviewHorizontalWheelSelectionStepOffset = targetPlan.stepOffset;
            overviewHorizontalWheelSelectionTargetId = targetPlan.targetId;
            return true;
        }

        const requestId = advanceOverviewHorizontalWheelSelectionRequestId();
        overviewHorizontalWheelSelectionDesktopId = expectedDesktopId;
        overviewHorizontalWheelSelectionGeometryEpoch = geometryEpoch;
        overviewHorizontalWheelSelectionOutputId = expectedOutputId;
        overviewHorizontalWheelSelectionPending = true;
        overviewHorizontalWheelSelectionSourceTargetId = sourceTargetId;
        overviewHorizontalWheelSelectionStepOffset = targetPlan.stepOffset;
        overviewHorizontalWheelSelectionTargetId = targetPlan.targetId;
        overviewHorizontalWheelSelectionWorkspaceIndex = workspaceIndex;
        Qt.callLater(root.completeSpatialHorizontalWheelSelection,
                     requestId, expectedOutputId, expectedDesktopId, workspaceIndex,
                     geometryEpoch, cardEpoch, sourceTargetId);
        return true;
    }

    function horizontalWheelSelectionTargetPlan(expectedDesktopId, sourceTargetId, requestedStepOffset) {
        if (!horizontalWheelScalarIdIsValid(expectedDesktopId, false)
                || !horizontalWheelScalarIdIsValid(sourceTargetId, true)
                || !Number.isInteger(requestedStepOffset) || requestedStepOffset === 0
                || Math.abs(requestedStepOffset) > 4) {
            return null;
        }

        const rowTargets = [];
        for (const target of collectNavigationTargets()) {
            if (target && target.kind === "window" && target.desktopId === expectedDesktopId) {
                if (!horizontalWheelScalarIdIsValid(target.id, false) || rowTargets.length >= 131072) {
                    return null;
                }
                rowTargets.push(target);
            }
        }
        if (rowTargets.length === 0) {
            return {
                stepOffset: 0,
                targetId: ""
            };
        }

        const direction = requestedStepOffset > 0 ? "next" : "previous";
        const navigationDirection = direction === "next" ? "right" : "left";
        const stepSign = requestedStepOffset > 0 ? 1 : -1;
        let remainingSteps = Math.abs(requestedStepOffset);
        let appliedSteps = 0;
        let selected = navigationTargetForId(rowTargets, sourceTargetId);
        if (!selected) {
            selected = horizontalBoundaryNavigationTarget(rowTargets, direction === "next" ? "first" : "last");
            remainingSteps -= 1;
            appliedSteps = 1;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!selected || !runtime || typeof runtime.findOverviewNavigationTarget !== "function") {
            return null;
        }
        for (let step = 0; step < remainingSteps; step += 1) {
            let targetId = null;
            try {
                targetId = runtime.findOverviewNavigationTarget(selected.id, rowTargets, navigationDirection);
            } catch (error) {
                return null;
            }
            const target = navigationTargetForId(rowTargets, targetId);
            if (!target) {
                break;
            }
            selected = target;
            appliedSteps += 1;
        }

        return horizontalWheelScalarIdIsValid(selected.id, false)
            ? {
                stepOffset: appliedSteps * stepSign,
                targetId: selected.id
            }
            : null;
    }

    function completeSpatialHorizontalWheelSelection(requestId, expectedOutputId, expectedDesktopId,
                                                     workspaceIndex, expectedGeometryEpoch,
                                                     expectedCardEpoch, expectedSourceTargetId) {
        if (!horizontalWheelSelectionRequestContextIsExact(
                requestId, expectedOutputId, expectedDesktopId, workspaceIndex,
                expectedGeometryEpoch, expectedCardEpoch, expectedSourceTargetId)) {
            finishFailedSpatialHorizontalWheelSelection(requestId);
            return;
        }

        const targetId = overviewHorizontalWheelSelectionTargetId;
        let targets = null;
        let sourceTarget = null;
        let target = null;
        try {
            targets = collectNavigationTargets();
            sourceTarget = expectedSourceTargetId.length > 0
                ? navigationTargetForId(targets, expectedSourceTargetId) : null;
            target = navigationTargetForId(targets, targetId);
        } catch (error) {
            finishFailedSpatialHorizontalWheelSelection(requestId);
            return;
        }
        if (!horizontalWheelSelectionRequestContextIsExact(
                requestId, expectedOutputId, expectedDesktopId, workspaceIndex,
                expectedGeometryEpoch, expectedCardEpoch, expectedSourceTargetId)
                || (expectedSourceTargetId.length > 0 && !sourceTarget)
                || !target || target.kind !== "window" || target.desktopId !== expectedDesktopId
                || target.id !== targetId) {
            finishFailedSpatialHorizontalWheelSelection(requestId);
            return;
        }

        clearOverviewHorizontalWheelSelectionRequest();
        try {
            setKeyboardSelectionTarget(target);
        } catch (error) {
            return;
        }
    }

    function horizontalWheelSelectionRequestContextIsExact(
        requestId, expectedOutputId, expectedDesktopId, workspaceIndex,
        expectedGeometryEpoch, expectedCardEpoch, expectedSourceTargetId
    ) {
        try {
            if (!overviewHorizontalWheelSelectionPending
                    || !Number.isInteger(requestId)
                    || requestId !== overviewHorizontalWheelSelectionRequestId
                    || !Number.isInteger(workspaceIndex) || workspaceIndex < 0
                    || workspaceIndex >= desktopIds.length
                    || !Number.isInteger(expectedGeometryEpoch)
                    || expectedGeometryEpoch !== spatialHorizontalViewportRevision
                    || !Number.isInteger(expectedCardEpoch)
                    || expectedCardEpoch !== overviewDesktopCardEpoch
                    || !horizontalWheelScalarIdIsValid(expectedOutputId, false)
                    || !horizontalWheelScalarIdIsValid(expectedDesktopId, false)
                    || !horizontalWheelScalarIdIsValid(expectedSourceTargetId, true)
                    || !Number.isInteger(overviewHorizontalWheelSelectionStepOffset)
                    || overviewHorizontalWheelSelectionStepOffset === 0
                    || Math.abs(overviewHorizontalWheelSelectionStepOffset) > 4
                    || !horizontalWheelScalarIdIsValid(overviewHorizontalWheelSelectionTargetId, false)
                    || overviewHorizontalWheelSelectionOutputId !== expectedOutputId
                    || overviewHorizontalWheelSelectionDesktopId !== expectedDesktopId
                    || overviewHorizontalWheelSelectionWorkspaceIndex !== workspaceIndex
                    || overviewHorizontalWheelSelectionGeometryEpoch !== expectedGeometryEpoch
                    || overviewHorizontalWheelSelectionSourceTargetId !== expectedSourceTargetId
                    || outputId !== expectedOutputId || desktopIds[workspaceIndex] !== expectedDesktopId
                    || keyboardSelectionId !== expectedSourceTargetId || searchQuery.length > 0
                    || keyboardHelpVisible || spatialTouchPanDragHandler.active
                    || spatialViewportDragHandler.active
                    || spatialHorizontalViewportDragHandler.active
                    || spatialHorizontalRowDragHandler.active
                    || spatialDirectDragActive || desktopReorderActive
                    || !spatialWheelPresentationIsExact()) {
                return false;
            }

            const card = desktopCardAt(workspaceIndex);
            return card && card.desktopId === expectedDesktopId;
        } catch (error) {
            return false;
        }
    }

    function finishFailedSpatialHorizontalWheelSelection(requestId) {
        if (requestId !== overviewHorizontalWheelSelectionRequestId) {
            return;
        }
        clearOverviewHorizontalWheelSelectionRequest();
    }

    function horizontalWheelScalarIdIsValid(candidate, allowEmpty) {
        return typeof candidate === "string" && candidate.length <= 4096
            && (allowEmpty === true || candidate.length > 0);
    }

    function horizontalBoundaryNavigationTarget(targets, boundary) {
        let selected = null;
        for (const target of targets) {
            if (!target || !target.rect || !Number.isFinite(target.rect.x)
                    || !Number.isFinite(target.rect.width) || target.rect.width <= 0) {
                continue;
            }
            const center = target.rect.x + target.rect.width / 2;
            if (!selected || (boundary === "first" && center < selected.center)
                    || (boundary === "last" && center > selected.center)) {
                selected = {
                    center,
                    target
                };
            }
        }
        return selected ? selected.target : null;
    }

    function revealHorizontalNavigationTarget(workspaceIndex, expectedDesktopId, target) {
        const card = desktopCardAt(workspaceIndex);
        const bounds = spatialHorizontalViewportBounds(workspaceIndex, expectedDesktopId);
        if (!card || !bounds || !target || !target.rect || !Number.isFinite(card.projectionScale)
                || card.projectionScale <= 0) {
            return false;
        }

        let viewportPoint;
        try {
            viewportPoint = card.mapToItem(root, card.contentLeft, card.contentTop);
        } catch (error) {
            return false;
        }
        if (!viewportPoint || !Number.isFinite(viewportPoint.x) || !Number.isFinite(card.contentWidth)
                || card.contentWidth <= 0 || !Number.isFinite(target.rect.x)
                || !Number.isFinite(target.rect.width) || target.rect.width <= 0) {
            return false;
        }

        const margin = Math.min(24, card.contentWidth * 0.03);
        const visibleLeft = viewportPoint.x + margin;
        const visibleRight = viewportPoint.x + card.contentWidth - margin;
        const targetLeft = target.rect.x;
        const targetRight = target.rect.x + target.rect.width;
        let sceneAdjustment = 0;
        if (targetLeft < visibleLeft) {
            sceneAdjustment = targetLeft - visibleLeft;
        } else if (targetRight > visibleRight) {
            sceneAdjustment = targetRight - visibleRight;
        }

        const currentOffset = spatialHorizontalViewportOffsetForBounds(workspaceIndex, expectedDesktopId, bounds);
        const nextOffset = Math.min(bounds.maximum,
                                    Math.max(bounds.minimum, currentOffset + sceneAdjustment / card.projectionScale));
        if (!setSpatialHorizontalViewportOffsetForBounds(workspaceIndex, expectedDesktopId, nextOffset, bounds)) {
            return false;
        }
        detachSpatialLiveCameraForManualOffset(workspaceIndex, expectedDesktopId, currentOffset, nextOffset);
        return true;
    }

    function handleSpatialViewportWheel(angleDeltaY, pixelDeltaY) {
        if (!spatialWheelPresentationIsExact()) {
            return false;
        }

        if (spatialVerticalCameraAnimation.running && !adoptSpatialVisualContentY()) {
            return false;
        }

        advanceOverviewVerticalWheelSettleRequestId();
        const previousContentY = spatialContentY;
        const plan = planSpatialWheel(angleDeltaY, pixelDeltaY);
        if (!spatialViewportWheelPlanIsValid(plan, pixelDeltaY) || !spatialWheelPresentationIsExact()
                || !setSpatialContentY(plan.contentY)
                || spatialContentY !== plan.contentY) {
            return false;
        }

        overviewWheelPixelRemainder = plan.pixelRemainder;
        overviewWheelRemainder = 0;
        if (searchQuery.length === 0 && plan.contentY !== previousContentY) {
            overviewVerticalWheelSettlePending = true;
        }
        return true;
    }

    function handleSpatialWorkspaceWheel(angleDeltaY) {
        if (!spatialWheelPresentationIsExact()) {
            return false;
        }

        resetOverviewPreciseVerticalWheelState();
        const plan = planSpatialWheel(angleDeltaY, 0);
        if (!spatialWorkspaceWheelPlanIsValid(plan) || !spatialWheelPresentationIsExact()) {
            return false;
        }
        if (plan.steps > 0) {
            overviewWheelPixelRemainder = 0;
            overviewWheelRemainder = 0;
            if (!requestSpatialWheelWorkspace(plan.direction, plan.steps)) {
                return false;
            }
        } else {
            overviewWheelPixelRemainder = 0;
            overviewWheelRemainder = plan.remainder;
        }
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

        resetOverviewPreciseVerticalWheelState();
        overviewWheelRemainder = plan.remainder;
        for (let step = 0; step < plan.steps; step += 1) {
            navigateKeyboardSequence(plan.direction);
        }
        return true;
    }

    function finishSpatialVerticalWheelGesture() {
        const settlePending = overviewVerticalWheelSettlePending;
        resetOverviewPreciseVerticalWheelState();
        if (!settlePending) {
            return false;
        }

        const request = captureSpatialWheelWorkspaceRequest();
        if (!request) {
            return false;
        }

        const requestId = advanceOverviewVerticalWheelSettleRequestId();
        Qt.callLater(root.completeSpatialVerticalWheelSettle,
                     requestId, request.outputId, request.sourceDesktopId, request.sourceIndex,
                     request.geometryEpoch, request.contentY, request.cardHeight, request.gap,
                     request.sceneHeight, request.layout.contentHeight, request.desktopIds.length);
        return true;
    }

    function completeSpatialVerticalWheelSettle(requestId, expectedOutputId, expectedDesktopId,
                                                expectedSourceIndex, expectedGeometryEpoch,
                                                expectedContentY, expectedCardHeight, expectedGap,
                                                expectedSceneHeight, expectedContentHeight,
                                                expectedWorkspaceCount) {
        if (!Number.isInteger(requestId) || requestId !== overviewVerticalWheelSettleRequestId) {
            return false;
        }

        const request = deferredSpatialWheelWorkspaceRequest(
            expectedOutputId, expectedDesktopId, expectedSourceIndex, expectedGeometryEpoch,
            expectedContentY, expectedCardHeight, expectedGap, expectedSceneHeight,
            expectedContentHeight, expectedWorkspaceCount);
        if (!request) {
            return false;
        }

        const plan = planSpatialWorkspaceSettle(request);
        if (!spatialWorkspaceSettlePlanIsValid(plan, request)
                || !spatialWheelWorkspaceRequestIsExact(request)) {
            return false;
        }

        advanceOverviewVerticalWheelSettleRequestId();
        if (plan.targetIndex === request.sourceIndex) {
            if (!setSpatialContentY(plan.contentY, true) || spatialContentY !== plan.contentY) {
                return false;
            }
            keyboardSelectionId = "";
            Qt.callLater(root.repairKeyboardSelection);
            return true;
        }

        if (!requestSpatialWheelWorkspaceIndex(request, plan.targetIndex)) {
            return false;
        }
        return setSpatialContentY(plan.contentY, true) && spatialContentY === plan.contentY;
    }

    function planSpatialWorkspaceSettle(request) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceSettle !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewSpatialWorkspaceSettle({
                                                                  cardHeight: request.cardHeight,
                                                                  contentHeight: request.layout.contentHeight,
                                                                  contentY: request.contentY,
                                                                  gap: request.gap,
                                                                  sceneHeight: request.sceneHeight,
                                                                  workspaceCount: request.desktopIds.length
                                                              });
        } catch (error) {
            return null;
        }
    }

    function spatialWorkspaceSettlePlanIsValid(plan, request) {
        if (!plan || Array.isArray(plan) || !Number.isInteger(plan.targetIndex)
                || plan.targetIndex < 0 || plan.targetIndex >= request.desktopIds.length
                || !Number.isFinite(plan.contentY) || !Number.isFinite(plan.maximumContentY)) {
            return false;
        }

        const stride = request.cardHeight + request.gap;
        const maximumContentY = request.layout.contentHeight - request.sceneHeight;
        const targetIndex = Math.min(request.desktopIds.length - 1,
                                     Math.max(0, Math.floor(request.contentY / stride + 0.5)));
        return plan.targetIndex === targetIndex && plan.contentY === targetIndex * stride
            && plan.maximumContentY === maximumContentY;
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
                                                        pixelRemainder: overviewWheelPixelRemainder,
                                                        remainder: overviewWheelRemainder,
                                                        sceneHeight: height
                                                    });
        } catch (error) {
            return null;
        }
    }

    function spatialViewportWheelPlanIsValid(plan, pixelDeltaY) {
        const accumulatedPixelDelta = overviewWheelPixelRemainder !== 0
            && Math.sign(overviewWheelPixelRemainder) !== Math.sign(pixelDeltaY)
            ? pixelDeltaY : overviewWheelPixelRemainder + pixelDeltaY;
        const quantizedPixelDelta = Math.trunc(accumulatedPixelDelta * 64) / 64;
        const expectedContentY = Math.min(overviewSpatialLayout.contentHeight - height,
                                          Math.max(0, spatialContentY - quantizedPixelDelta));
        const reachedBoundary = (accumulatedPixelDelta > 0 && expectedContentY === 0)
            || (accumulatedPixelDelta < 0
                && expectedContentY === overviewSpatialLayout.contentHeight - height);
        const expectedPixelRemainder = reachedBoundary
            ? 0 : accumulatedPixelDelta - quantizedPixelDelta;
        return plan && !Array.isArray(plan) && plan.intent === "viewport"
            && plan.remainder === 0 && Number.isFinite(plan.pixelRemainder)
            && Math.abs(plan.pixelRemainder) < 1 / 64
            && plan.direction === undefined && plan.steps === undefined
            && spatialWheelContentYIsValid(plan.contentY) && plan.contentY === expectedContentY
            && Math.abs(plan.pixelRemainder - expectedPixelRemainder) <= Number.EPSILON * 8;
    }

    function spatialWorkspaceWheelPlanIsValid(plan) {
        return plan && !Array.isArray(plan) && plan.intent === "workspace"
            && spatialWheelContentYIsValid(plan.contentY) && plan.contentY === spatialContentY
            && plan.pixelRemainder === 0
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

    function resetOverviewWheelState() {
        resetOverviewHorizontalWheelState();
        resetOverviewVerticalWheelState();
    }

    function resetOverviewHorizontalWheelState() {
        cancelOverviewHorizontalWheelSelectionRequest();
        overviewHorizontalWheelPixelRemainder = 0;
        overviewHorizontalWheelRemainder = 0;
    }

    function advanceOverviewDesktopCardEpoch() {
        overviewDesktopCardEpoch = overviewDesktopCardEpoch >= 2147483646
            ? 0 : overviewDesktopCardEpoch + 1;
        cancelOverviewHorizontalWheelSelectionRequest();
        return overviewDesktopCardEpoch;
    }

    function advanceOverviewHorizontalWheelSelectionRequestId() {
        overviewHorizontalWheelSelectionRequestId = overviewHorizontalWheelSelectionRequestId >= 2147483646
            ? 1 : overviewHorizontalWheelSelectionRequestId + 1;
        return overviewHorizontalWheelSelectionRequestId;
    }

    function cancelOverviewHorizontalWheelSelectionRequest() {
        advanceOverviewHorizontalWheelSelectionRequestId();
        clearOverviewHorizontalWheelSelectionRequest();
    }

    function clearOverviewHorizontalWheelSelectionRequest() {
        overviewHorizontalWheelSelectionDesktopId = "";
        overviewHorizontalWheelSelectionGeometryEpoch = -1;
        overviewHorizontalWheelSelectionOutputId = "";
        overviewHorizontalWheelSelectionPending = false;
        overviewHorizontalWheelSelectionSourceTargetId = "";
        overviewHorizontalWheelSelectionStepOffset = 0;
        overviewHorizontalWheelSelectionTargetId = "";
        overviewHorizontalWheelSelectionWorkspaceIndex = -1;
    }

    function resetOverviewVerticalWheelState() {
        resetOverviewPreciseVerticalWheelState();
        clearOverviewVerticalWheelWorkspaceRequest();
        advanceOverviewVerticalWheelWorkspaceRequestId();
        overviewWheelRemainder = 0;
    }

    function resetOverviewPreciseVerticalWheelState() {
        advanceOverviewVerticalWheelSettleRequestId();
        overviewWheelPixelRemainder = 0;
        overviewVerticalWheelSettlePending = false;
    }

    function advanceOverviewVerticalWheelSettleRequestId() {
        overviewVerticalWheelSettleRequestId = overviewVerticalWheelSettleRequestId >= 2147483646
            ? 0 : overviewVerticalWheelSettleRequestId + 1;
        return overviewVerticalWheelSettleRequestId;
    }

    function advanceOverviewVerticalWheelWorkspaceRequestId() {
        overviewVerticalWheelWorkspaceRequestId = overviewVerticalWheelWorkspaceRequestId >= 2147483646
            ? 0 : overviewVerticalWheelWorkspaceRequestId + 1;
        return overviewVerticalWheelWorkspaceRequestId;
    }

    function spatialWheelPresentationIsExact() {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const liveDesktop = currentDesktop;
            const expectedDesktopId = liveDesktop && liveDesktop.id !== undefined && liveDesktop.id !== null
                ? String(liveDesktop.id) : "";
            return spatialPointerInputEligible && effect && effect.active === true
                && effect.overviewModel === model
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
        const request = captureSpatialWheelWorkspaceRequest();
        if (!request) {
            return false;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceWheelTarget !== "function") {
            return false;
        }

        const planningSourceIndex = overviewVerticalWheelWorkspaceRequestIsExact(request)
            ? overviewVerticalWheelWorkspaceTargetIndex : request.sourceIndex;
        let targetPlan = null;
        try {
            targetPlan = runtime.planOverviewSpatialWorkspaceWheelTarget({
                                                                            currentIndex: planningSourceIndex,
                                                                            direction,
                                                                            steps,
                                                                            workspaceCount: request.desktopIds.length
                                                                        });
        } catch (error) {
            return false;
        }
        if (!spatialWorkspaceWheelTargetPlanIsValid(targetPlan, planningSourceIndex, direction, steps,
                                                    request.desktopIds.length)
                || !spatialWheelWorkspaceRequestIsExact(request)) {
            return false;
        }
        if (targetPlan.appliedSteps === 0) {
            return targetPlan.targetIndex === planningSourceIndex;
        }
        if (targetPlan.targetIndex === request.sourceIndex) {
            clearOverviewVerticalWheelWorkspaceRequest();
            advanceOverviewVerticalWheelWorkspaceRequestId();
            return true;
        }

        rememberOverviewVerticalWheelWorkspaceRequest(request, targetPlan.targetIndex);
        const requestId = advanceOverviewVerticalWheelWorkspaceRequestId();
        Qt.callLater(root.completeSpatialWheelWorkspaceSelection,
                     requestId, request.outputId, request.sourceDesktopId, request.sourceIndex,
                     request.geometryEpoch, request.contentY, request.cardHeight, request.gap,
                     request.sceneHeight, request.layout.contentHeight, request.desktopIds.length,
                     targetPlan.targetIndex);
        return true;
    }

    function completeSpatialWheelWorkspaceSelection(requestId, expectedOutputId, expectedDesktopId,
                                                     expectedSourceIndex, expectedGeometryEpoch,
                                                     expectedContentY, expectedCardHeight, expectedGap,
                                                     expectedSceneHeight, expectedContentHeight,
                                                     expectedWorkspaceCount, expectedTargetIndex) {
        if (!Number.isInteger(requestId) || requestId !== overviewVerticalWheelWorkspaceRequestId
                || !Number.isInteger(expectedTargetIndex)) {
            return false;
        }

        const request = deferredSpatialWheelWorkspaceRequest(
            expectedOutputId, expectedDesktopId, expectedSourceIndex, expectedGeometryEpoch,
            expectedContentY, expectedCardHeight, expectedGap, expectedSceneHeight,
            expectedContentHeight, expectedWorkspaceCount);
        if (!request || !overviewVerticalWheelWorkspaceRequestIsExact(request)
                || overviewVerticalWheelWorkspaceTargetIndex !== expectedTargetIndex
                || expectedTargetIndex < 0 || expectedTargetIndex >= request.desktopIds.length
                || expectedTargetIndex === request.sourceIndex) {
            if (requestId === overviewVerticalWheelWorkspaceRequestId) {
                clearOverviewVerticalWheelWorkspaceRequest();
                advanceOverviewVerticalWheelWorkspaceRequestId();
            }
            return false;
        }

        clearOverviewVerticalWheelWorkspaceRequest();
        advanceOverviewVerticalWheelWorkspaceRequestId();
        return requestSpatialWheelWorkspaceIndex(request, expectedTargetIndex);
    }

    function rememberOverviewVerticalWheelWorkspaceRequest(request, targetIndex) {
        overviewVerticalWheelWorkspaceDesktopId = request.sourceDesktopId;
        overviewVerticalWheelWorkspaceGeometryEpoch = request.geometryEpoch;
        overviewVerticalWheelWorkspaceOutputId = request.outputId;
        overviewVerticalWheelWorkspaceSourceIndex = request.sourceIndex;
        overviewVerticalWheelWorkspaceTargetIndex = targetIndex;
        overviewVerticalWheelWorkspaceCount = request.desktopIds.length;
    }

    function overviewVerticalWheelWorkspaceRequestIsExact(request) {
        return request && overviewVerticalWheelWorkspaceDesktopId === request.sourceDesktopId
            && overviewVerticalWheelWorkspaceGeometryEpoch === request.geometryEpoch
            && overviewVerticalWheelWorkspaceOutputId === request.outputId
            && overviewVerticalWheelWorkspaceSourceIndex === request.sourceIndex
            && overviewVerticalWheelWorkspaceCount === request.desktopIds.length
            && overviewVerticalWheelWorkspaceTargetIndex >= 0
            && overviewVerticalWheelWorkspaceTargetIndex < request.desktopIds.length;
    }

    function clearOverviewVerticalWheelWorkspaceRequest() {
        overviewVerticalWheelWorkspaceDesktopId = "";
        overviewVerticalWheelWorkspaceGeometryEpoch = -1;
        overviewVerticalWheelWorkspaceOutputId = "";
        overviewVerticalWheelWorkspaceSourceIndex = -1;
        overviewVerticalWheelWorkspaceTargetIndex = -1;
        overviewVerticalWheelWorkspaceCount = 0;
    }

    function deferredSpatialWheelWorkspaceRequest(expectedOutputId, expectedDesktopId,
                                                   expectedSourceIndex, expectedGeometryEpoch,
                                                   expectedContentY, expectedCardHeight, expectedGap,
                                                   expectedSceneHeight, expectedContentHeight,
                                                   expectedWorkspaceCount) {
        if (typeof expectedOutputId !== "string" || expectedOutputId.length === 0
                || typeof expectedDesktopId !== "string" || expectedDesktopId.length === 0
                || !Number.isInteger(expectedSourceIndex) || expectedSourceIndex < 0
                || !Number.isInteger(expectedGeometryEpoch)
                || expectedGeometryEpoch !== spatialHorizontalViewportRevision
                || !Number.isFinite(expectedContentY) || !Number.isFinite(expectedCardHeight)
                || !Number.isFinite(expectedGap) || !Number.isFinite(expectedSceneHeight)
                || !Number.isFinite(expectedContentHeight)
                || !Number.isInteger(expectedWorkspaceCount) || expectedWorkspaceCount < 1) {
            return null;
        }

        const request = captureSpatialWheelWorkspaceRequest();
        if (!request || request.outputId !== expectedOutputId
                || request.sourceDesktopId !== expectedDesktopId
                || request.sourceIndex !== expectedSourceIndex
                || request.geometryEpoch !== expectedGeometryEpoch
                || request.contentY !== expectedContentY || request.cardHeight !== expectedCardHeight
                || request.gap !== expectedGap || request.sceneHeight !== expectedSceneHeight
                || request.layout.contentHeight !== expectedContentHeight
                || request.desktopIds.length !== expectedWorkspaceCount
                || !spatialWheelWorkspaceRequestIsExact(request)) {
            return null;
        }

        return request;
    }

    function captureSpatialWheelWorkspaceRequest() {
        try {
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
            const layout = overviewSpatialLayout;
            if (!spatialWheelPresentationIsExact() || sourceIndex < 0
                    || expectedDesktopIds[sourceIndex] !== sourceDesktopId
                    || !desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                              sourceDesktop, sourceDesktopId)) {
                return null;
            }

            return {
                cardHeight,
                contentY: spatialContentY,
                desktopIds: expectedDesktopIds,
                effect,
                gap: cardGap,
                geometryEpoch: spatialHorizontalViewportRevision,
                layout,
                liveScreen,
                model,
                output: expectedOutput,
                outputId: expectedOutputId,
                sceneHeight: height,
                sourceDesktop,
                sourceDesktopId,
                sourceIndex
            };
        } catch (error) {
            return null;
        }
    }

    function spatialWheelWorkspaceRequestIsExact(request) {
        return request && sceneEffect === request.effect && overviewModel === request.model
            && desktopIds === request.desktopIds && currentDesktop === request.sourceDesktop
            && currentWorkspaceIndex === request.sourceIndex && overviewSpatialLayout === request.layout
            && spatialContentY === request.contentY && height === request.sceneHeight
            && cardHeight === request.cardHeight && cardGap === request.gap
            && spatialHorizontalViewportRevision === request.geometryEpoch
            && request.desktopIds[request.sourceIndex] === request.sourceDesktopId
            && spatialWheelPresentationIsExact()
            && desktopContextIsExact(request.effect, request.model, request.liveScreen, request.output,
                                     request.outputId, request.sourceDesktop, request.sourceDesktopId);
    }

    function requestSpatialWheelWorkspaceIndex(request, targetIndex) {
        if (!spatialWheelWorkspaceRequestIsExact(request) || !Number.isInteger(targetIndex)
                || targetIndex < 0 || targetIndex >= request.desktopIds.length
                || targetIndex === request.sourceIndex) {
            return false;
        }

        const targetDesktopId = request.desktopIds[targetIndex];
        if (typeof targetDesktopId !== "string" || targetDesktopId.length === 0) {
            return false;
        }
        const targetDesktop = liveDesktopFor(desktopForId(targetDesktopId), targetDesktopId);
        if (!desktopContextIsExact(request.effect, request.model, request.liveScreen, request.output,
                                   request.outputId, request.sourceDesktop, request.sourceDesktopId)
                || !desktopContextIsExact(request.effect, request.model, request.liveScreen, request.output,
                                          request.outputId,
                                          targetDesktop, targetDesktopId)
                || !requestDesktopSelection(request.effect, request.model, request.liveScreen, request.output,
                                            request.outputId,
                                            targetDesktop, targetDesktopId)) {
            return false;
        }

        const selectionConfirmed = sceneEffect === request.effect && request.effect.active === true
            && overviewModel === request.model && currentDesktop === targetDesktop
            && currentWorkspaceIndex === targetIndex && desktopIds === request.desktopIds;
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
        let target = navigationTargetForId(targets, keyboardSelectionId);
        if (!target) {
            repairKeyboardSelectionFrom(targets);
            target = navigationTargetForId(targets, keyboardSelectionId);
        }
        if (!target) {
            return false;
        }

        if (target.kind === "desktop") {
            return selectDesktop(target.candidate, target.desktopId, target.screen);
        }
        if (target.kind === "window") {
            return focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen);
        }

        return false;
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
        if (!sceneEffect || sceneEffect.active !== true || keyboardBoundaryNavigationPending) {
            return;
        }
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
        if (preferred) {
            setKeyboardSelectionTarget(preferred);
        } else {
            keyboardSelectionId = "";
        }
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
        let currentDesktopMarker = null;
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
            if (target.kind === "desktop" && target.desktopId === activeDesktopId
                    && (!currentDesktopMarker || navigationTargetPrecedes(target, currentDesktopMarker))) {
                currentDesktopMarker = target;
            }
            if (!firstVisual || navigationTargetPrecedes(target, firstVisual)) {
                firstVisual = target;
            }
        }

        return firstActive || firstCurrentDesktop || currentDesktopMarker || firstVisual;
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

    function prepareOverviewWindowExitHandoff(candidate, expectedWindowId,
                                              expectedDesktopId, expectedScreen) {
        const target = overviewExitNavigationTarget("window", candidate, expectedWindowId,
                                                    expectedDesktopId, expectedScreen);
        const targetFrame = overviewExitWindowFrame(candidate);
        if (!target || !targetFrame) {
            return 0;
        }

        let targetMinimized = false;
        try {
            targetMinimized = candidate.minimized === true;
        } catch (error) {
            return 0;
        }
        return beginSpatialExitHandoff(candidate, {
                                           sourceRect: target.rect,
                                           targetDesktopId: expectedDesktopId,
                                           targetFrame,
                                           targetKind: "window",
                                           targetMinimized,
                                           targetOutputId: outputId,
                                           targetWindowId: expectedWindowId
                                       });
    }

    function prepareOverviewDesktopExitHandoff(candidate, expectedDesktopId,
                                               expectedScreen) {
        const target = overviewExitNavigationTarget("desktop", candidate, null,
                                                    expectedDesktopId, expectedScreen);
        const sourceRect = target ? overviewExitDesktopRowRect(expectedDesktopId)
                                  || target.rect : null;
        const targetFrame = overviewExitOutputFrame(expectedScreen);
        if (!sourceRect || !targetFrame) {
            return 0;
        }

        return beginSpatialExitHandoff(null, {
                                           sourceRect,
                                           targetDesktopId: expectedDesktopId,
                                           targetFrame,
                                           targetKind: "desktop-fallback",
                                           targetMinimized: false,
                                           targetOutputId: outputId,
                                           targetWindowId: null
                                       });
    }

    function beginSpatialExitHandoff(windowCandidate, target) {
        const effect = sceneEffect;
        const sourceIndex = currentWorkspaceIndex;
        const sourceDesktop = currentDesktop;
        if (!effect || effect.active !== true || !spatialPresentationSettled
                || spatialExitHandoffActive || !target || outputId.length === 0
                || !sourceDesktop || sourceDesktop.id === undefined
                || sourceDesktop.id === null || sourceIndex < 0
                || sourceIndex >= desktopIds.length
                || typeof effect.beginOverviewExitHandoff !== "function") {
            return 0;
        }

        const sourceDesktopId = String(sourceDesktop.id);
        const offsetX = spatialHorizontalViewportOffsetAt(
            sourceIndex, sourceDesktopId, spatialHorizontalViewportRevision);
        if (desktopIds[sourceIndex] !== sourceDesktopId || !Number.isFinite(offsetX)
                || !Number.isFinite(spatialContentY) || !Number.isFinite(overviewZoom)
                || overviewZoom <= 0) {
            return 0;
        }

        spatialExitFrozenWorkspaceIndex = sourceIndex;
        spatialPresentationWorkspaceIndex = sourceIndex;
        let token = 0;
        try {
            token = Number(effect.beginOverviewExitHandoff(windowCandidate, {
                                                                camera: {
                                                                    offsetX,
                                                                    offsetY: spatialContentY,
                                                                    zoom: overviewZoom
                                                                },
                                                                sourceDesktopId,
                                                                sourceOutputId: outputId,
                                                                sourceRect: target.sourceRect,
                                                                targetDesktopId: target.targetDesktopId,
                                                                targetFrame: target.targetFrame,
                                                                targetKind: target.targetKind,
                                                                targetMinimized: target.targetMinimized,
                                                                targetOutputId: target.targetOutputId,
                                                                targetWindowId: target.targetWindowId
                                                            }));
        } catch (error) {
            token = 0;
        }
        if (!Number.isInteger(token) || token <= 0) {
            spatialExitFrozenWorkspaceIndex = -1;
            spatialExitHandoffToken = 0;
            return 0;
        }

        spatialExitHandoffToken = token;
        return token;
    }

    function settleSpatialExitHandoff(windowCandidate, token) {
        const effect = sceneEffect;
        if (!effect || effect.active !== true || !Number.isInteger(token) || token <= 0
                || token !== spatialExitHandoffToken
                || typeof effect.settleOverviewExitHandoff !== "function") {
            return false;
        }

        try {
            return effect.settleOverviewExitHandoff(token, windowCandidate) === true;
        } catch (error) {
            invalidateSpatialExitHandoff("stale");
            return false;
        }
    }

    function cancelSpatialExitHandoff() {
        const effect = sceneEffect;
        if (!effect) {
            spatialExitFrozenWorkspaceIndex = -1;
            spatialExitHandoffToken = 0;
            return false;
        }

        let canceled = false;
        if (typeof effect.cancelOverviewExitHandoff === "function") {
            try {
                canceled = effect.cancelOverviewExitHandoff("interrupt") === true;
            } catch (error) {
                canceled = false;
            }
        }
        if (!canceled && spatialExitHandoffActive
                && typeof effect.deactivateImmediately === "function") {
            try {
                effect.deactivateImmediately();
            } catch (error) {
            }
        }
        return canceled;
    }

    function invalidateSpatialExitHandoff(reason) {
        const effect = sceneEffect;
        if (!effect || typeof effect.invalidateOverviewExitHandoff !== "function") {
            return false;
        }
        try {
            return effect.invalidateOverviewExitHandoff(reason) === true;
        } catch (error) {
            return false;
        }
    }

    function handleOverviewExitHandoffStateChanged() {
        const state = overviewExitHandoffState;
        const capture = state ? state.capture : null;
        if (capture && sceneEffect && capture.sessionId === sceneEffect.activeSessionId
                && (state.phase === "captured" || state.phase === "promoted"
                    || state.phase === "fallback")) {
            if (spatialExitFrozenWorkspaceIndex < 0) {
                spatialExitFrozenWorkspaceIndex = currentWorkspaceIndex;
            }
            return;
        }

        if (capture && state.phase === "canceled") {
            restoreSpatialExitCamera(capture);
        } else {
            spatialExitFrozenWorkspaceIndex = -1;
        }
        spatialExitHandoffToken = 0;
    }

    function restoreSpatialExitCamera(capture) {
        const camera = capture ? capture.camera : null;
        const sourceDesktopId = capture ? capture.sourceDesktopId : "";
        const sourceIndex = desktopIds.indexOf(sourceDesktopId);
        spatialExitRestoringCamera = true;
        spatialExitFrozenWorkspaceIndex = -1;
        if (camera && capture.sourceOutputId === outputId
                && sourceIndex >= 0 && sourceIndex < desktopIds.length
                && Number.isFinite(camera.offsetY) && Number.isFinite(camera.offsetX)
                && Number.isFinite(camera.zoom)
                && Math.abs(camera.zoom - overviewZoom) <= 0.000001) {
            refreshSpatialHorizontalViewports(true);
            setSpatialContentY(camera.offsetY, false);
            setSpatialHorizontalViewportOffset(sourceIndex, sourceDesktopId, camera.offsetX);
            spatialPresentationWorkspaceIndex = sourceIndex;
        }
        spatialExitRestoringCamera = false;
    }

    function overviewExitNavigationTarget(kind, candidate, expectedWindowId,
                                          expectedDesktopId, expectedScreen) {
        let match = null;
        for (const target of collectNavigationTargets()) {
            if (!target || target.kind !== kind || target.candidate !== candidate
                    || target.desktopId !== expectedDesktopId || target.screen !== expectedScreen
                    || (kind === "window" && target.windowId !== expectedWindowId)) {
                continue;
            }
            if (match) {
                return null;
            }
            match = target;
        }
        return match && overviewExitRect(match.rect) ? match : null;
    }

    function overviewExitDesktopRowRect(expectedDesktopId) {
        const index = desktopIds.indexOf(expectedDesktopId);
        const card = index >= 0 ? desktopCardAt(index) : null;
        if (!card || !Number.isFinite(card.width) || card.width <= 0
                || !Number.isFinite(card.height) || card.height <= 0) {
            return null;
        }

        try {
            const point = card.mapToItem(root, 0, 0);
            return overviewExitRect({
                                        x: point.x,
                                        y: point.y,
                                        width: card.width,
                                        height: card.height
                                    });
        } catch (error) {
            return null;
        }
    }

    function overviewExitWindowFrame(candidate) {
        try {
            return candidate ? overviewExitRect(candidate.frameGeometry) : null;
        } catch (error) {
            return null;
        }
    }

    function overviewExitOutputFrame(screen) {
        try {
            return screen ? overviewExitRect(screen.geometry) : null;
        } catch (error) {
            return null;
        }
    }

    function overviewExitRect(rect) {
        if (!rect) {
            return null;
        }
        const x = Number(rect.x);
        const y = Number(rect.y);
        const width = Number(rect.width);
        const height = Number(rect.height);
        return Number.isFinite(x) && Number.isFinite(y)
            && Number.isFinite(width) && width > 0
            && Number.isFinite(height) && height > 0
            ? { x, y, width, height } : null;
    }

    function overviewExitRectValue(rect) {
        const value = overviewExitRect(rect);
        return value ? Qt.rect(value.x, value.y, value.width, value.height)
                     : Qt.rect(0, 0, 1, 1);
    }

    function overviewExitOutputGeometry() {
        return overviewExitRectValue(targetScreen ? targetScreen.geometry : null);
    }

    function overviewExitOverlaySourceRect() {
        const capture = overviewExitHandoffCapture;
        if (!capture) {
            return Qt.rect(0, 0, 1, 1);
        }
        if (overviewExitHandoffState && overviewExitHandoffState.phase === "fallback") {
            const row = overviewExitDesktopRowRect(capture.targetDesktopId);
            if (row) {
                return overviewExitRectValue(row);
            }
        }
        return overviewExitRectValue(capture.sourceRect);
    }

    function selectDesktop(candidate, expectedDesktopId, expectedScreen) {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const liveScreen = liveScreenFor(expectedScreen);
            const expectedOutput = projectedOutput(model, liveScreen);
            const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
            const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
            if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId)) {
                return false;
            }

            const activeDesktop = currentDesktop;
            if (!activeDesktop || activeDesktop.id === undefined || activeDesktop.id === null) {
                return false;
            }
            const exitToken = prepareOverviewDesktopExitHandoff(candidate, expectedDesktopId,
                                                                expectedScreen);
            if (exitToken <= 0) {
                return false;
            }
            if (activeDesktop === liveDesktop && String(activeDesktop.id) === expectedDesktopId) {
                if (!settleSpatialExitHandoff(null, exitToken)) {
                    cancelSpatialExitHandoff();
                    return false;
                }
                effect.deactivate();
                return true;
            }

            if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                         expectedDesktopId, true)) {
                cancelSpatialExitHandoff();
                return false;
            }
            if (!settleSpatialExitHandoff(null, exitToken)) {
                cancelSpatialExitHandoff();
                return false;
            }
            effect.deactivate();
            return true;
        } catch (error) {
            cancelSpatialExitHandoff();
            return false;
        }
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
            return false;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop) {
            return false;
        }
        const exitToken = prepareOverviewWindowExitHandoff(candidate, expectedWindowId,
                                                           expectedDesktopId, expectedScreen);
        if (exitToken <= 0) {
            return false;
        }

        try {
            let desktopSelectionConfirmed = false;
            if (activeDesktop !== liveDesktop || String(activeDesktop.id) !== expectedDesktopId) {
                if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                             expectedDesktopId, true)) {
                    cancelSpatialExitHandoff();
                    return false;
                }
                desktopSelectionConfirmed = true;
            }

            if (expectedMinimized) {
                if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                           expectedDesktopId, true)
                        || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                                 expectedDesktopId, expectedActivityId)
                        || !windowFocusStateIsExact(candidate, true, false) || candidate.managed !== true) {
                    cancelSpatialExitHandoff();
                    return false;
                }

                try {
                    candidate.minimized = false;
                } catch (error) {
                    cancelSpatialExitHandoff();
                    return false;
                }

                if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                           expectedDesktopId, true)
                        || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                                 expectedDesktopId, expectedActivityId)
                        || !windowFocusStateIsExact(candidate, false, true) || candidate.managed !== true) {
                    cancelSpatialExitHandoff();
                    return false;
                }
            }

            let focusConfirmed = false;
            const selectedDesktop = currentDesktop;
            if (selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId && desktopContextIsExact(
                        effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop, expectedDesktopId, true)
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
                                                               expectedOutputId, liveDesktop, expectedDesktopId, true)
                            && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                                   expectedDesktopId, expectedActivityId)
                            && windowFocusStateIsExact(candidate, false, true);
                    }
                } catch (error) {
                    focusConfirmed = false;
                }
            }

            if (focusConfirmed || (!expectedMinimized && desktopSelectionConfirmed)) {
                if (!settleSpatialExitHandoff(candidate, exitToken)) {
                    cancelSpatialExitHandoff();
                    return false;
                }
                effect.deactivate();
                return true;
            }
            cancelSpatialExitHandoff();
            return false;
        } catch (error) {
            cancelSpatialExitHandoff();
            return false;
        }
    }

    function requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId, allowExitHandoff = false) {
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId, allowExitHandoff)) {
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
                                   expectedDesktopId, allowExitHandoff = false) {
        const interactionExact = spatialPresentationInteractive
            || (allowExitHandoff === true && spatialExitHandoffActive
                && spatialExitHandoffToken > 0);
        if (!interactionExact || !effect || effect !== sceneEffect || effect.active !== true
                || !model || effect.overviewModel !== model
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

    function planWorkspaceGapDrop(dropArea, drag, expectedGapIndex) {
        try {
            if (!dropArea || !drag || !Number.isInteger(expectedGapIndex)
                    || expectedGapIndex < 0 || !workspaceGapDropSourceIsExact(drag.source)
                    || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
                return null;
            }

            const point = dropArea.mapToItem(spatialCanvas, drag.x, drag.y);
            const plan = point && Number.isFinite(point.y)
                ? planWorkspaceGapDropAtCanvasY(point.y) : null;
            return workspaceGapPlanIsExact(plan, expectedGapIndex + 1) ? plan : null;
        } catch (error) {
            return null;
        }
    }

    function claimWorkspaceGapPreview(dropArea, drag, expectedGapIndex) {
        const source = drag ? drag.source : null;
        const plan = planWorkspaceGapDrop(dropArea, drag, expectedGapIndex);
        if (!workspaceGapPreviewContextIsExact(source, plan, expectedGapIndex)) {
            releaseWorkspaceGapPreview(expectedGapIndex);
            return false;
        }

        workspaceGapPreviewSource = source;
        workspaceGapPreviewWindowId = source.windowId;
        workspaceGapPreviewIndex = expectedGapIndex;
        workspaceGapPreviewPlan = plan;
        return true;
    }

    function releaseWorkspaceGapPreview(expectedGapIndex) {
        if (expectedGapIndex !== undefined && expectedGapIndex !== workspaceGapPreviewIndex) {
            return;
        }
        clearWorkspaceGapPreview();
    }

    function clearWorkspaceGapPreview() {
        workspaceGapPreviewSource = null;
        workspaceGapPreviewWindowId = "";
        workspaceGapPreviewIndex = -1;
        workspaceGapPreviewPlan = null;
    }

    function clearInvalidWorkspaceGapPreview() {
        if (workspaceGapPreviewSource !== null && !workspaceGapPreviewIsExact()) {
            clearWorkspaceGapPreview();
        }
    }

    function workspaceGapPreviewIsExact() {
        return workspaceGapPreviewContextIsExact(workspaceGapPreviewSource,
                                                  workspaceGapPreviewPlan,
                                                  workspaceGapPreviewIndex)
            && workspaceGapPreviewSourceId(workspaceGapPreviewSource)
               === workspaceGapPreviewWindowId;
    }

    function workspaceGapPreviewContextIsExact(source, plan, expectedGapIndex) {
        if (source && source.scope === "column") {
            return columnWorkspaceGapPreviewContextIsExact(source, plan, expectedGapIndex);
        }
        try {
            if (!spatialPointerInputEligible || desktopReorderActive
                    || !Number.isInteger(expectedGapIndex) || expectedGapIndex < 0
                    || !workspaceGapDropSourceIsExact(source)
                    || !workspaceGapPlanIsExact(plan, expectedGapIndex + 1)) {
                return false;
            }

            const effect = sceneEffect;
            const model = overviewModel;
            const candidate = source.candidate;
            const expectedWindowId = source.windowId;
            const expectedSourceDesktop = source.sourceDesktop;
            const expectedSourceDesktopId = source.sourceDesktopId;
            const liveSourceScreen = liveScreenFor(source.sourceScreen);
            const liveTargetScreen = liveScreenFor(targetScreen);
            const sourceOutput = projectedOutput(model, liveSourceScreen);
            const targetOutput = projectedOutput(model, liveTargetScreen);
            const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
            const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
            const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
            const expectedAnchorDesktop = desktopForId(plan.anchorDesktopId);
            const anchorDesktop = liveDesktopFor(expectedAnchorDesktop, plan.anchorDesktopId);
            const expectedActivityId = activeOverviewActivityId;
            const localSource = liveSourceScreen === liveTargetScreen
                && source === spatialWindowDragSource
                && expectedSourceDesktopId === spatialWindowDragSourceDesktopId;
            const externalSource = liveSourceScreen !== liveTargetScreen
                && spatialWindowDragSource === null && sourceOutputId !== targetOutputId;
            if ((!localSource && !externalSource) || !anchorDesktop
                    || !windowSpatialDropSceneIsExact(effect, model, liveSourceScreen, sourceOutput,
                                                      sourceOutputId, liveTargetScreen, targetOutput,
                                                      targetOutputId, liveSourceDesktop,
                                                      expectedSourceDesktopId, anchorDesktop,
                                                      plan.anchorDesktopId)) {
                return false;
            }

            return windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveSourceScreen,
                                                      liveSourceDesktop, expectedSourceDesktopId,
                                                      expectedActivityId);
        } catch (error) {
            return false;
        }
    }

    function planWorkspaceGapDropAtRootPoint(point) {
        try {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                return null;
            }

            const canvasPoint = spatialCanvas.mapFromItem(root, point.x, point.y);
            return canvasPoint && Number.isFinite(canvasPoint.y)
                ? planWorkspaceGapDropAtCanvasY(canvasPoint.y) : null;
        } catch (error) {
            return null;
        }
    }

    function planWorkspaceGapDropAtCanvasY(pointY) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewSpatialWorkspaceGap !== "function") {
            return null;
        }

        try {
            const plan = runtime.planOverviewSpatialWorkspaceGap({
                cardGap: cardGap,
                cardHeight: cardHeight,
                cardTop: 0,
                desktopIds: desktopIds,
                keepEmptyDesktopAboveFirst: emptyDesktopAboveFirst,
                pointY: pointY
            });
            return workspaceGapPlanIsExact(plan) ? plan : null;
        } catch (error) {
            return null;
        }
    }

    function workspaceGapPlanIsExact(plan, expectedInsertionIndex) {
        try {
            if (!plan || !Object.isFrozen(plan) || !Number.isInteger(plan.insertionIndex)
                    || plan.insertionIndex < 1 || plan.insertionIndex >= desktopIds.length
                    || expectedInsertionIndex !== undefined
                    && plan.insertionIndex !== expectedInsertionIndex
                    || !Number.isFinite(plan.lineY)
                    || typeof plan.anchorDesktopId !== "string" || plan.anchorDesktopId.length === 0
                    || typeof plan.adjacentDesktopId !== "string" || plan.adjacentDesktopId.length === 0
                    || plan.anchorDesktopId === plan.adjacentDesktopId
                    || (plan.position !== "before" && plan.position !== "after")) {
                return false;
            }

            const anchorIndex = desktopIds.indexOf(plan.anchorDesktopId);
            const adjacentIndex = desktopIds.indexOf(plan.adjacentDesktopId);
            if (anchorIndex < 0 || adjacentIndex < 0
                    || desktopIds.lastIndexOf(plan.anchorDesktopId) !== anchorIndex
                    || desktopIds.lastIndexOf(plan.adjacentDesktopId) !== adjacentIndex
                    || anchorIndex === desktopIds.length - 1
                    || emptyDesktopAboveFirst && anchorIndex === 0) {
                return false;
            }

            return plan.position === "before"
                ? adjacentIndex + 1 === anchorIndex && plan.insertionIndex === anchorIndex
                : anchorIndex + 1 === adjacentIndex && plan.insertionIndex === adjacentIndex;
        } catch (error) {
            return false;
        }
    }

    function workspaceGapDropSourceIsExact(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            return source && sourceCard && source.spatialDragLifecycleActive === true
                    && source.dragEligible === true && source.minimizedWindow !== true
                    && typeof sourceCard.crossOutputWindowDropSourceIsExact === "function"
                    && sourceCard.crossOutputWindowDropSourceIsExact(source);
        } catch (error) {
            return false;
        }
    }

    function planColumnWorkspaceGapDrop(dropArea, drag, expectedGapIndex) {
        try {
            if (!dropArea || !drag || !Number.isInteger(expectedGapIndex)
                    || expectedGapIndex < 0 || !columnWorkspaceGapDropSourceIsExact(drag.source)
                    || !Number.isFinite(drag.x) || !Number.isFinite(drag.y)) {
                return null;
            }
            const point = dropArea.mapToItem(spatialCanvas, drag.x, drag.y);
            const plan = point && Number.isFinite(point.y)
                ? planWorkspaceGapDropAtCanvasY(point.y) : null;
            return workspaceGapPlanIsExact(plan, expectedGapIndex + 1) ? plan : null;
        } catch (error) {
            return null;
        }
    }

    function claimColumnWorkspaceGapPreview(dropArea, drag, expectedGapIndex) {
        const source = drag ? drag.source : null;
        const plan = planColumnWorkspaceGapDrop(dropArea, drag, expectedGapIndex);
        if (!workspaceGapPreviewContextIsExact(source, plan, expectedGapIndex)) {
            releaseWorkspaceGapPreview(expectedGapIndex);
            return false;
        }
        workspaceGapPreviewSource = source;
        workspaceGapPreviewWindowId = source.selectedWindowId;
        workspaceGapPreviewIndex = expectedGapIndex;
        workspaceGapPreviewPlan = plan;
        return true;
    }

    function workspaceGapPreviewSourceId(source) {
        return source && source.scope === "column" ? source.selectedWindowId
            : source && typeof source.windowId === "string" ? source.windowId : "";
    }

    function columnWorkspaceGapPreviewContextIsExact(source, plan, expectedGapIndex) {
        try {
            if (!spatialPointerInputEligible || desktopReorderActive
                    || !Number.isInteger(expectedGapIndex) || expectedGapIndex < 0
                    || !columnWorkspaceGapDropSourceIsExact(source)
                    || !workspaceGapPlanIsExact(plan, expectedGapIndex + 1)) {
                return false;
            }
            const effect = sceneEffect;
            const model = overviewModel;
            const liveScreen = liveScreenFor(source.sourceScreen);
            const sourceOutput = projectedOutput(model, liveScreen);
            const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
            const sourceDesktop = liveDesktopFor(source.sourceDesktop, source.sourceDesktopId);
            const expectedAnchorDesktop = desktopForId(plan.anchorDesktopId);
            const anchorDesktop = liveDesktopFor(expectedAnchorDesktop, plan.anchorDesktopId);
            return source === spatialColumnDragSource && liveScreen === targetScreen
                && sourceOutputId === outputId && anchorDesktop
                && windowSpatialDropSceneIsExact(effect, model, liveScreen, sourceOutput, sourceOutputId,
                                                 targetScreen, sourceOutput, sourceOutputId, sourceDesktop,
                                                 source.sourceDesktopId, anchorDesktop, plan.anchorDesktopId);
        } catch (error) {
            return false;
        }
    }

    function columnWorkspaceGapDropSourceIsExact(source) {
        try {
            const sourceCard = source ? source.sourceCard : null;
            return source && source === spatialColumnDragSource && source.scope === "column"
                && source.sourceScreen === targetScreen && sourceCard
                && typeof sourceCard.ownedColumnDropSnapshotIsExact === "function"
                && sourceCard.ownedColumnDropSnapshotIsExact(source)
                && columnSpatialDragSourceIsExact(source, spatialColumnDragSourceDesktopId);
        } catch (error) {
            return false;
        }
    }

    function submitWindowWorkspaceGapDrop(source, exactPlan, expectedTargetScreen) {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const candidate = source ? source.candidate : null;
            const expectedWindowId = source ? source.windowId : "";
            const expectedSourceDesktop = source ? source.sourceDesktop : null;
            const expectedSourceDesktopId = source ? source.sourceDesktopId : "";
            const liveSourceScreen = liveScreenFor(source ? source.sourceScreen : null);
            const liveTargetScreen = liveScreenFor(expectedTargetScreen);
            const sourceOutput = projectedOutput(model, liveSourceScreen);
            const targetOutput = projectedOutput(model, liveTargetScreen);
            const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
            const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
            const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
            const expectedAnchorDesktop = exactPlan
                ? desktopForId(exactPlan.anchorDesktopId) : null;
            const anchorDesktop = exactPlan
                ? liveDesktopFor(expectedAnchorDesktop, exactPlan.anchorDesktopId) : null;
            const expectedActivityId = activeOverviewActivityId;
            const target = canonicalWorkspaceGapDropTarget(exactPlan, expectedActivityId, targetOutputId);
            if (!workspaceGapDropSourceIsExact(source) || !target || !anchorDesktop
                    || !windowSpatialDropSceneIsExact(effect, model, liveSourceScreen, sourceOutput,
                                                      sourceOutputId, liveTargetScreen, targetOutput,
                                                      targetOutputId, liveSourceDesktop,
                                                      expectedSourceDesktopId, anchorDesktop,
                                                      exactPlan.anchorDesktopId)
                    || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveSourceScreen,
                                                           liveSourceDesktop, expectedSourceDesktopId,
                                                           expectedActivityId)
                    || typeof effect.submitSpatialDropCommand !== "function") {
                return false;
            }

            return effect.submitSpatialDropCommand({
                                                       activityId: expectedActivityId,
                                                       desktopId: expectedSourceDesktopId,
                                                       outputId: sourceOutputId,
                                                       scope: "window",
                                                       windowId: expectedWindowId
                                                   }, target) === true;
        } catch (error) {
            return false;
        }
    }

    function submitColumnWorkspaceGapDrop(source, exactPlan, expectedTargetScreen) {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const candidate = source ? source.candidate : null;
            const expectedWindowId = source ? source.selectedWindowId : "";
            const expectedSourceDesktop = source ? source.sourceDesktop : null;
            const expectedSourceDesktopId = source ? source.sourceDesktopId : "";
            const liveScreen = liveScreenFor(source ? source.sourceScreen : null);
            const liveTargetScreen = liveScreenFor(expectedTargetScreen);
            const sourceOutput = projectedOutput(model, liveScreen);
            const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
            const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
            const expectedAnchorDesktop = exactPlan
                ? desktopForId(exactPlan.anchorDesktopId) : null;
            const anchorDesktop = exactPlan
                ? liveDesktopFor(expectedAnchorDesktop, exactPlan.anchorDesktopId) : null;
            const expectedActivityId = activeOverviewActivityId;
            const target = canonicalWorkspaceGapDropTarget(exactPlan, expectedActivityId, sourceOutputId);
            if (!columnWorkspaceGapDropSourceIsExact(source) || !target || !anchorDesktop
                    || liveScreen !== liveTargetScreen || liveScreen !== targetScreen
                    || !windowSpatialDropSceneIsExact(effect, model, liveScreen, sourceOutput, sourceOutputId,
                                                      liveTargetScreen, sourceOutput, sourceOutputId,
                                                      liveSourceDesktop, expectedSourceDesktopId,
                                                      anchorDesktop, exactPlan.anchorDesktopId)
                    || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen,
                                                           liveSourceDesktop, expectedSourceDesktopId,
                                                           expectedActivityId)
                    || typeof effect.submitSpatialDropCommand !== "function") {
                return false;
            }

            return effect.submitSpatialDropCommand({
                                                       activityId: expectedActivityId,
                                                       desktopId: expectedSourceDesktopId,
                                                       outputId: sourceOutputId,
                                                       scope: "column",
                                                       windowId: expectedWindowId
                                                   }, target) === true;
        } catch (error) {
            return false;
        }
    }

    function canonicalWorkspaceGapDropTarget(exactPlan, expectedActivityId, expectedOutputId) {
        if (!workspaceGapPlanIsExact(exactPlan) || expectedActivityId.length === 0
                || expectedOutputId.length === 0 || outputId !== expectedOutputId) {
            return null;
        }

        return {
            activityId: expectedActivityId,
            adjacentDesktopId: exactPlan.adjacentDesktopId,
            anchorDesktopId: exactPlan.anchorDesktopId,
            kind: "workspace-gap",
            outputId: expectedOutputId,
            position: exactPlan.position
        };
    }

    function handleCrossOutputWindowDrop(globalPosition, source, expectedTargetScreen) {
        const targetHit = crossOutputDropTargetAt(globalPosition, expectedTargetScreen);
        if (!targetHit || !source) {
            return;
        }

        if (targetHit.kind === "workspace-gap") {
            submitWindowWorkspaceGapDrop(source, targetHit.plan, expectedTargetScreen);
            return;
        }

        const targetCard = targetHit.card;
        const exactTarget = targetCard.planCrossOutputWindowDropTarget(source, targetHit.localPosition);
        if (exactTarget) {
            submitWindowSpatialDrop(source.candidate, source.windowId, source.sourceDesktop,
                                    source.sourceDesktopId, targetCard.desktop, targetCard.desktopId,
                                    source.sourceScreen, targetCard.screen, exactTarget);
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

        const workspaceGapPlan = planWorkspaceGapDropAtRootPoint(localPosition);
        if (workspaceGapPlan) {
            return Object.freeze({ kind: "workspace-gap", plan: workspaceGapPlan });
        }

        let targetHit = null;
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
            if (targetHit) {
                return null;
            }
            targetHit = Object.freeze({
                card: candidate,
                kind: "desktop-card",
                localPosition: Object.freeze({
                    x: Number(cardPosition.x),
                    y: Number(cardPosition.y)
                })
            });
        }

        return targetHit;
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
        const expectedActivityId = activeOverviewActivityId;
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
                state.effect.deactivateImmediately();
            }
            return;
        }

        compensateCrossOutputWindowDrop(state);
        if (state.effect && state.effect === sceneEffect && state.effect.active === true) {
            state.effect.deactivateImmediately();
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

    function submitColumnSpatialDrop(source, expectedTargetDesktop,
                                     expectedTargetDesktopId, expectedScreen, exactTarget) {
        try {
            const effect = sceneEffect;
            const model = overviewModel;
            const candidate = source ? source.candidate : null;
            const expectedWindowId = source ? source.selectedWindowId : "";
            const expectedSourceDesktop = source ? source.sourceDesktop : null;
            const expectedSourceDesktopId = source ? source.sourceDesktopId : "";
            const liveSourceScreen = liveScreenFor(source ? source.sourceScreen : null);
            const liveTargetScreen = liveScreenFor(expectedScreen);
            const sourceOutput = projectedOutput(model, liveSourceScreen);
            const targetOutput = projectedOutput(model, liveTargetScreen);
            const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
            const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
            const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
            const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
            const expectedActivityId = activeOverviewActivityId;
            const target = canonicalColumnSpatialDropTarget(exactTarget, expectedActivityId,
                                                            targetOutputId, expectedTargetDesktopId);
            if (!columnSpatialDragSourceIsExact(source, expectedSourceDesktopId)
                    || liveSourceScreen !== liveTargetScreen || liveSourceScreen !== targetScreen
                    || !windowSpatialDropSceneIsExact(effect, model, liveSourceScreen, sourceOutput,
                                                      sourceOutputId, liveTargetScreen, targetOutput,
                                                      targetOutputId, liveSourceDesktop,
                                                      expectedSourceDesktopId, liveTargetDesktop,
                                                      expectedTargetDesktopId)
                    || !target
                    || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveSourceScreen,
                                                           liveSourceDesktop, expectedSourceDesktopId,
                                                           expectedActivityId)
                    || typeof effect.submitSpatialDropCommand !== "function") {
                return false;
            }

            return effect.submitSpatialDropCommand({
                                                       activityId: expectedActivityId,
                                                       desktopId: expectedSourceDesktopId,
                                                       outputId: sourceOutputId,
                                                       scope: "column",
                                                       windowId: expectedWindowId
                                                   }, target) === true;
        } catch (error) {
            return false;
        }
    }

    function canonicalColumnSpatialDropTarget(exactTarget, expectedActivityId,
                                              expectedOutputId, expectedTargetDesktopId) {
        try {
            if (!exactTarget || !Object.isFrozen(exactTarget) || exactTarget.rowIndex !== 0
                    || exactTarget.activityId !== expectedActivityId
                    || exactTarget.outputId !== expectedOutputId
                    || exactTarget.desktopId !== expectedTargetDesktopId) {
                return null;
            }
            const targetContext = contextFor(expectedTargetDesktopId);
            if (exactTarget.kind === "empty-row") {
                return (targetContext === null
                        || targetContext
                           && indexedListHasBoundedLength(targetContext.columns, 0, 0))
                    ? {
                          activityId: expectedActivityId,
                          desktopId: expectedTargetDesktopId,
                          kind: "empty-row",
                          outputId: expectedOutputId
                      }
                    : null;
            }
            if (exactTarget.kind !== "column-boundary"
                    || (exactTarget.position !== "before" && exactTarget.position !== "after")
                    || typeof exactTarget.targetWindowId !== "string"
                    || exactTarget.targetWindowId.length === 0 || !targetContext
                    || !spatialDropContextSelectedColumnAnchorIsExact(
                        targetContext, exactTarget.targetWindowId)) {
                return null;
            }
            return {
                activityId: expectedActivityId,
                desktopId: expectedTargetDesktopId,
                kind: "column-boundary",
                outputId: expectedOutputId,
                position: exactTarget.position,
                targetWindowId: exactTarget.targetWindowId
            };
        } catch (error) {
            return null;
        }
    }

    function spatialDropContextSelectedColumnAnchorIsExact(targetContext, expectedWindowId) {
        if (!targetContext || !indexedListHasBoundedLength(targetContext.columns, 1, 512)) {
            return false;
        }
        let matches = 0;
        for (const column of targetContext.columns) {
            if (!column || !indexedListHasBoundedLength(column.members, 1, 256)
                    || !Number.isInteger(column.selectedMemberIndex)
                    || column.selectedMemberIndex < 0
                    || column.selectedMemberIndex >= column.members.length) {
                return false;
            }
            const member = column.members[column.selectedMemberIndex];
            if (!member || typeof member.windowId !== "string" || member.windowId.length === 0) {
                return false;
            }
            if (member.windowId === expectedWindowId) {
                matches += 1;
            }
        }
        return matches === 1;
    }

    function submitWindowSpatialDrop(candidate, expectedWindowId, expectedSourceDesktop,
                                     expectedSourceDesktopId, expectedTargetDesktop,
                                     expectedTargetDesktopId, expectedSourceScreen,
                                     expectedTargetScreen, exactTarget) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveSourceScreen = liveScreenFor(expectedSourceScreen);
        const liveTargetScreen = liveScreenFor(expectedTargetScreen);
        const sourceOutput = projectedOutput(model, liveSourceScreen);
        const targetOutput = projectedOutput(model, liveTargetScreen);
        const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
        const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
        const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
        const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
        const expectedActivityId = activeOverviewActivityId;
        const target = canonicalSpatialDropTarget(exactTarget, expectedActivityId, targetOutputId,
                                                  expectedTargetDesktopId, expectedWindowId);
        if (!windowSpatialDropSceneIsExact(effect, model, liveSourceScreen, sourceOutput, sourceOutputId,
                                           liveTargetScreen, targetOutput, targetOutputId, liveSourceDesktop,
                                           expectedSourceDesktopId, liveTargetDesktop, expectedTargetDesktopId)
                || !target
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveSourceScreen,
                                                       liveSourceDesktop,
                                                       expectedSourceDesktopId, expectedActivityId)
                || typeof effect.submitSpatialDropCommand !== "function") {
            return false;
        }

        return effect.submitSpatialDropCommand({
                                                   activityId: expectedActivityId,
                                                   desktopId: expectedSourceDesktopId,
                                                   outputId: sourceOutputId,
                                                   scope: "window",
                                                   windowId: expectedWindowId
                                               }, target) === true;
    }

    function canonicalSpatialDropTarget(exactTarget, expectedActivityId, expectedOutputId,
                                        expectedTargetDesktopId, expectedSourceWindowId) {
        try {
            if (!exactTarget || !Object.isFrozen(exactTarget) || exactTarget.rowIndex !== 0
                    || exactTarget.activityId !== expectedActivityId
                    || exactTarget.outputId !== expectedOutputId
                    || exactTarget.desktopId !== expectedTargetDesktopId) {
                return null;
            }

            const targetContext = contextFor(expectedTargetDesktopId);
            if (exactTarget.kind === "empty-row") {
                const exactEmptyContext = targetContext === null
                    || (targetContext
                        && indexedListHasBoundedLength(targetContext.columns, 0, 0));
                return exactEmptyContext
                    ? {
                          activityId: expectedActivityId,
                          desktopId: expectedTargetDesktopId,
                          kind: "empty-row",
                          outputId: expectedOutputId
                      }
                    : null;
            }

            if ((exactTarget.kind !== "column-boundary" && exactTarget.kind !== "stack-insertion")
                    || (exactTarget.position !== "before" && exactTarget.position !== "after")
                    || typeof exactTarget.targetWindowId !== "string"
                    || exactTarget.targetWindowId.length === 0 || !targetContext
                    || (exactTarget.kind === "stack-insertion"
                        && exactTarget.targetWindowId === expectedSourceWindowId)
                    || !spatialDropContextContainsWindow(targetContext, exactTarget.targetWindowId)) {
                return null;
            }

            return {
                activityId: expectedActivityId,
                desktopId: expectedTargetDesktopId,
                kind: exactTarget.kind,
                outputId: expectedOutputId,
                position: exactTarget.position,
                targetWindowId: exactTarget.targetWindowId
            };
        } catch (error) {
            return null;
        }
    }

    function spatialDropContextContainsWindow(targetContext, expectedWindowId) {
        if (!targetContext || !targetContext.columns || !Number.isInteger(targetContext.columns.length)
                || targetContext.columns.length < 1 || targetContext.columns.length > 512) {
            return false;
        }

        let matches = 0;
        for (const column of targetContext.columns) {
            if (!column || !column.members || !Number.isInteger(column.members.length)
                    || column.members.length < 1 || column.members.length > 256) {
                return false;
            }
            for (const member of column.members) {
                if (!member || typeof member.windowId !== "string" || member.windowId.length === 0) {
                    return false;
                }
                if (member.windowId === expectedWindowId) {
                    matches += 1;
                }
            }
        }
        return matches === 1;
    }

    function windowSpatialDropSceneIsExact(effect, model, liveSourceScreen, sourceOutput, sourceOutputId,
                                           liveTargetScreen, targetOutput, targetOutputId, liveSourceDesktop,
                                           expectedSourceDesktopId, liveTargetDesktop, expectedTargetDesktopId) {
        if (!desktopContextIsExact(effect, model, liveTargetScreen, targetOutput, targetOutputId,
                                   liveTargetDesktop, expectedTargetDesktopId)
                || !liveSourceScreen || liveScreenFor(liveSourceScreen) !== liveSourceScreen
                || !sourceOutput || sourceOutputId.length === 0
                || String(sourceOutput.outputId) !== sourceOutputId
                || projectedOutput(model, liveSourceScreen) !== sourceOutput
                || !liveSourceDesktop || expectedSourceDesktopId.length === 0
                || String(liveSourceDesktop.id) !== expectedSourceDesktopId
                || liveDesktopFor(liveSourceDesktop, expectedSourceDesktopId) !== liveSourceDesktop) {
            return false;
        }

        const sameOutput = liveSourceScreen === liveTargetScreen;
        if (sameOutput !== (sourceOutput === targetOutput)
                || sameOutput !== (sourceOutputId === targetOutputId)) {
            return false;
        }
        return !sameOutput || desktopContextIsExact(effect, model, liveSourceScreen, sourceOutput,
                                                     sourceOutputId, liveSourceDesktop,
                                                     expectedSourceDesktopId);
    }

    function windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, expectedDesktop,
                                               expectedDesktopId, expectedActivityId) {
        if (!candidate || candidate.deleted || candidate.minimized || candidate.wantsInput !== true
                || candidate.normalWindow !== true || candidate.managed !== true || candidate.moveable !== true
                || candidate.modal !== false || candidate.internalId === undefined || candidate.internalId === null
                || expectedWindowId.length === 0
                || String(candidate.internalId) !== expectedWindowId || candidate.output !== liveScreen
                || expectedActivityId.length === 0
                || activeOverviewActivityId !== expectedActivityId
                || !windowUsesActivity(candidate, expectedActivityId) || candidate.transient !== false
                || candidate.transientFor !== null) {
            return false;
        }

        const desktops = candidate.desktops;
        return desktops && desktops.length === 1 && desktops[0] === expectedDesktop
                && String(desktops[0].id) === expectedDesktopId;
    }

    function orderedDesktopIds(expectedTopologyRevision) {
        if (!Number.isInteger(expectedTopologyRevision) || expectedTopologyRevision < 0
                || expectedTopologyRevision > 2147483646 || !overviewModel) {
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
        resetOverviewSession();
        if (sceneEffect && typeof sceneEffect.deactivateImmediately === "function") {
            sceneEffect.deactivateImmediately();
        }
    }

    function contextModelIsExact() {
        try {
            const model = overviewModel;
            const screen = targetScreen;
            return overviewContextGeneration > 0 && model
                && typeof model.currentActivityId === "string"
                && model.currentActivityId === activeOverviewActivityId
                && screen && liveScreenFor(screen) === screen
                && projectedOutput(model, screen) !== null;
        } catch (error) {
            return false;
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

    function canonicalOverviewActivityId() {
        const fallbackActivityId = "driftile-default-activity";
        const currentActivity = KWin.Workspace.currentActivity;
        if (currentActivity !== undefined && currentActivity !== null
                && String(currentActivity).length > 0) {
            return String(currentActivity);
        }

        const activities = KWin.Workspace.activities;
        if (!activities || !Number.isInteger(activities.length)
                || activities.length > 1024) {
            return fallbackActivityId;
        }
        const activityIds = [];
        for (let index = 0; index < activities.length; index += 1) {
            const activityId = String(activities[index]);
            if (activityId.length > 0) {
                activityIds.push(activityId);
            }
        }
        return activityIds.length === 1 ? activityIds[0] : fallbackActivityId;
    }

    function indexedListHasBoundedLength(value, minimumLength, maximumLength) {
        return value !== null && value !== undefined && typeof value !== "string"
            && Number.isInteger(value.length) && Number.isInteger(minimumLength)
            && Number.isInteger(maximumLength) && minimumLength >= 0
            && maximumLength >= minimumLength && value.length >= minimumLength
            && value.length <= maximumLength;
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
