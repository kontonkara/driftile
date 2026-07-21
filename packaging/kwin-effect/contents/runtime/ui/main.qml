import QtCore
import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

QtObject {
    id: controller

    property bool active: false
    property int activeSessionId: 0
    property bool sceneVisible: false
    property var desktopSurfaceLifecycleEvent: null
    readonly property int desktopSurfaceLifecycleIdLimit: 512
    readonly property int desktopSurfaceLifecycleIdentifierLimit: 256
    property int desktopSurfaceLifecycleRevision: 0
    readonly property int desktopSurfaceLifecycleScopeLimit: 64
    property bool desktopSurfaceLifecycleFlushQueued: false
    property bool loading: false
    property var overviewModel: null
    readonly property var overviewActivationCache: createActivationCache()
    property var overviewExitHandoffPromotion: null
    property var overviewExitHandoffState: null
    property var overviewExitHandoffWindow: null
    property int overviewExitHandoffLastToken: 0
    property int overviewContextRefreshGeneration: 0
    property bool overviewContextRefreshPending: false
    property int overviewTopologyGeneration: 1
    property int lastActivationAttemptId: 0
    property int lastLiveRefreshAttemptId: 0
    property int lastPresentationTransitionToken: 0
    property int lastSceneReadinessEpoch: 0
    property int lastSceneRestartToken: 0
    property int lastSceneRetirementToken: 0
    property int openingReadinessEpoch: 0
    property var openingReadinessExpectedOutputIds: []
    property var openingReadinessModel: null
    property var openingReadinessRegistrations: []
    property bool openingReadinessSceneActivated: false
    property int openingReadinessSessionId: 0
    property int openingReadinessTopologyGeneration: 0
    property int pendingActivationAttemptId: 0
    property bool pendingDesktopSurfaceLifecycleGlobal: false
    property var pendingDesktopSurfaceLifecycleScopes: []
    property int pendingLiveRefreshAttemptId: 0
    property var pendingLiveRefreshModel: null
    property int pendingLiveRefreshRetryCount: 0
    property int pendingLiveRefreshSessionId: 0
    property int pendingLiveRefreshTopologyGeneration: 0
    property bool pendingPostTransitionLiveRefresh: false
    property int pendingPresentationTransitionSessionId: 0
    property int pendingPresentationTransitionToken: 0
    property bool pendingSceneRetirementReopen: false
    property int pendingSceneRetirementSessionId: 0
    property int pendingSceneRetirementToken: 0
    property bool pendingSceneRetirementContextDrift: false
    property var pendingSceneRestartRequest: null
    property real presentationProgress: 0
    property string presentationPhase: "closed"
    property bool overviewAlwaysCenterSingleColumn: false
    property real overviewGap: 16
    readonly property real overviewZoomMinimum: 0.2
    readonly property real overviewZoomMaximum: 0.75
    readonly property real overviewZoomGestureSpan: 0.1
    property real configuredOverviewZoom: 0.5
    property real overviewSessionZoom: 0.5
    property int overviewZoomRevision: 0
    property var overviewZoomInputStates: []
    property int overviewZoomInputStateRevision: 0
    property bool overviewZoomLiveRefreshDeferred: false
    property bool overviewZoomLiveRefreshResumeQueued: false
    property int overviewZoomLocalOwnerSessionId: 0
    property string overviewZoomLocalOwnerOutputId: ""
    property var overviewZoomLocalOwnerSceneToken: null
    property var overviewZoomLocalOwnerModel: null
    property real overviewZoomLocalOwnerInitialZoom: 0.5
    property int overviewZoomGestureSessionId: 0
    property string overviewZoomGestureDirection: ""
    property real overviewZoomGestureInitialZoom: 0.5
    property bool touchpadGestureEnabled: false
    property bool touchpadGestureDispatching: false
    property int touchpadGestureFingerCount: 4
    property real touchpadGestureProgress: 0
    property string touchpadGestureOwner: ""
    readonly property var overviewDelegate: Qt.createComponent("OverviewScene.qml")

    onActiveChanged: syncOverviewTouchpadZoomGesture()
    onLoadingChanged: syncOverviewTouchpadZoomGesture()
    onOverviewModelChanged: reconcileOverviewZoomInputStatesForModel()
    onPresentationPhaseChanged: {
        syncOverviewTouchpadZoomGesture();
        scheduleDeferredOverviewZoomLiveRefresh();
    }

    readonly property NumberAnimation presentationAnimation: NumberAnimation {
        property int sessionId: 0
        property int transitionToken: 0
        property string targetPhase: "closed"
        property real targetProgress: 0

        target: controller
        property: "presentationProgress"
        easing.type: Easing.InOutCubic

        onFinished: controller.completePresentationTransition(transitionToken,
                                                               sessionId,
                                                               targetPhase,
                                                               targetProgress)
    }

    onPresentationProgressChanged: {
        const bounded = boundedPresentationProgress(presentationProgress);
        if (presentationProgress !== bounded) {
            presentationProgress = bounded;
        }
    }

    readonly property Settings mainScriptSettings: Settings {
        category: "Script-io.github.kontonkara.driftile"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/kwinrc"
    }

    readonly property KWin.DBusCall rejectionOsdCall: KWin.DBusCall {
        service: "org.kde.plasmashell"
        path: "/org/kde/osdService"
        dbusInterface: "org.kde.osdService"
        method: "showText"
    }

    readonly property LayoutStateReader layoutStateReader: LayoutStateReader {
        onReady: (attemptId, document) => controller.acceptLayoutState(attemptId, document)
        onRejected: attemptId => controller.rejectLayoutState(attemptId, "unstable-state")
        onPublicationDetected: controller.requestLiveModelRefresh()
    }

    readonly property OverviewSpatialDropWriter spatialDropWriter: OverviewSpatialDropWriter {
    }

    readonly property OverviewWorkspaceCommandWriter workspaceCommandWriter: OverviewWorkspaceCommandWriter {
    }

    readonly property KWin.ShortcutHandler toggleShortcut: KWin.ShortcutHandler {
        name: "driftile_toggle_overview"
        text: "Driftile: Toggle overview"
        sequence: "Meta+O"
        onActivated: controller.toggle()
    }

    readonly property KWin.ShortcutHandler openShortcut: KWin.ShortcutHandler {
        name: "driftile_open_overview"
        text: "Driftile: Open overview"
        onActivated: controller.open()
    }

    readonly property KWin.ShortcutHandler closeShortcut: KWin.ShortcutHandler {
        name: "driftile_close_overview"
        text: "Driftile: Close overview"
        onActivated: controller.close()
    }

    readonly property Loader touchpadGestureLoader: Loader {
        active: false
    }

    readonly property Connections touchpadGestureConnection: Connections {
        ignoreUnknownSignals: true
        target: touchpadGestureLoader.item

        function onGestureStarted(owner, progress) {
            controller.beginTouchpadGesture(owner, progress)
        }

        function onGestureProgressed(owner, progress) {
            controller.updateTouchpadGesture(owner, progress)
        }

        function onGestureCancelled(owner) {
            controller.cancelTouchpadGesture(owner)
        }

        function onGestureActivated(owner) {
            controller.activateTouchpadGesture(owner)
        }

        function onGestureInvalidated(owner) {
            controller.invalidateTouchpadGesture(owner)
        }
    }

    readonly property Loader overviewTouchpadZoomGestureLoader: Loader {
        active: false
    }

    readonly property Connections overviewTouchpadZoomGestureConnection: Connections {
        ignoreUnknownSignals: true
        target: overviewTouchpadZoomGestureLoader.item

        function onZoomStarted(direction, progress) {
            controller.beginOverviewZoomGesture(controller.activeSessionId, direction, progress);
        }

        function onZoomProgressed(direction, progress) {
            controller.updateOverviewZoomGesture(controller.overviewZoomGestureSessionId, direction, progress);
        }

        function onZoomCancelled(direction) {
            controller.cancelOverviewZoomGesture(controller.overviewZoomGestureSessionId, direction);
        }

        function onZoomCommitted(direction) {
            controller.commitOverviewZoomGesture(controller.overviewZoomGestureSessionId, direction);
        }

        function onZoomInvalidated(direction) {
            controller.invalidateOverviewZoomGesture(controller.overviewZoomGestureSessionId, direction);
        }
    }

    readonly property Connections workspaceWindowLifecycleConnection: Connections {
        id: workspaceWindowLifecycleConnection

        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onWindowAdded(window) {
            if (controller.pendingSceneRestartRequest) {
                return;
            }
            if (controller.presentationPhase === "preparing") {
                controller.restartPreparingSceneForContextDrift();
                return;
            }
            if (controller.presentationPhase === "retiring") {
                controller.pendingSceneRetirementContextDrift = true;
                return;
            }
            controller.queueDesktopSurfaceLifecycleEvent(window);
            controller.requestLiveModelRefresh();
        }

        function onWindowRemoved(window) {
            if (controller.pendingSceneRestartRequest) {
                return;
            }
            if (controller.presentationPhase === "preparing") {
                controller.restartPreparingSceneForContextDrift();
                return;
            }
            if (controller.presentationPhase === "retiring") {
                controller.pendingSceneRetirementContextDrift = true;
                return;
            }
            controller.handleOverviewExitWindowRemoved(window);
            controller.queueDesktopSurfaceLifecycleEvent(window);
            controller.requestLiveModelRefresh();
        }

        function onDesktopsChanged() {
            controller.advanceOverviewTopologyGeneration();
            controller.invalidateOverviewExitHandoff("topology");
            controller.invalidateOverviewZoomGestureContext();
            controller.requestLiveModelRefresh();
        }

        function onCurrentDesktopChanged() {
            controller.invalidateOverviewZoomGestureContext();
        }

        function onCurrentActivityChanged() {
            controller.advanceOverviewTopologyGeneration();
            controller.requestOverviewContextRefresh();
            controller.invalidateOverviewExitHandoff("topology");
            controller.invalidateOverviewZoomGestureContext();
        }

        function onActivitiesChanged() {
            controller.advanceOverviewTopologyGeneration();
            controller.requestOverviewContextRefresh();
            controller.invalidateOverviewExitHandoff("topology");
            controller.invalidateOverviewZoomGestureContext();
        }

        function onScreensChanged() {
            controller.advanceOverviewTopologyGeneration();
            controller.requestOverviewContextRefresh();
            controller.invalidateOverviewExitHandoff("topology");
            controller.invalidateOverviewZoomGestureContext();
        }

        function onVirtualScreenGeometryChanged() {
            controller.advanceOverviewTopologyGeneration();
            controller.requestOverviewContextRefresh();
            controller.invalidateOverviewExitHandoff("topology");
            controller.invalidateOverviewZoomGestureContext();
        }
    }

    function toggle() {
        if (pendingSceneRestartRequest) {
            clearPendingSceneRestart();
            return;
        }
        if (active && (presentationPhase === "closing"
                || (presentationPhase === "retiring" && !pendingSceneRetirementReopen))) {
            activate();
        } else if (active || loading) {
            deactivate();
        } else {
            activate();
        }
    }

    function queueDesktopSurfaceLifecycleEvent(window) {
        try {
            if (!window || window.desktopWindow !== true) {
                return false;
            }
        } catch (error) {
            return false;
        }
        if (!active || presentationPhase === "retiring") {
            return false;
        }

        let scope = null;
        try {
            scope = snapshotDesktopSurfaceLifecycleScope(window);
        } catch (error) {
            scope = null;
        }
        if (!scope) {
            queueGlobalDesktopSurfaceLifecycleEvent();
            return true;
        }

        mergeDesktopSurfaceLifecycleScope(scope);
        return true;
    }

    function snapshotDesktopSurfaceLifecycleScope(window) {
        const output = snapshotDesktopSurfaceLifecycleOutput(window);
        const desktops = snapshotDesktopSurfaceLifecycleDesktops(window);
        const activities = snapshotDesktopSurfaceLifecycleActivities(window);
        if (!output || !desktops || !activities) {
            return null;
        }

        return {
            output: output.output,
            outputName: output.outputName,
            allDesktops: desktops.all,
            desktopIds: desktops.ids,
            allActivities: activities.all,
            activityIds: activities.ids
        };
    }

    function snapshotDesktopSurfaceLifecycleOutput(window) {
        const output = window.output;
        if (!output || output.name === undefined || output.name === null) {
            return null;
        }

        const outputName = String(output.name);
        if (!desktopSurfaceLifecycleIdentifierIsValid(outputName)) {
            return null;
        }

        const liveOutputs = KWin.Workspace.screens;
        if (!desktopSurfaceLifecycleSequenceIsValid(liveOutputs)) {
            return null;
        }
        let objectMatches = 0;
        let nameMatches = 0;
        for (const liveOutput of liveOutputs) {
            if (!liveOutput || liveOutput.name === undefined || liveOutput.name === null) {
                return null;
            }
            const liveOutputName = String(liveOutput.name);
            if (!desktopSurfaceLifecycleIdentifierIsValid(liveOutputName)) {
                return null;
            }
            if (liveOutput === output) {
                objectMatches += 1;
                if (liveOutputName !== outputName) {
                    return null;
                }
            }
            if (liveOutputName === outputName) {
                nameMatches += 1;
            }
        }

        return objectMatches === 1 && nameMatches === 1 ? { output, outputName } : null;
    }

    function snapshotDesktopSurfaceLifecycleDesktops(window) {
        const memberships = window.desktops;
        if (!desktopSurfaceLifecycleSequenceIsValid(memberships)) {
            return null;
        }
        const liveDesktops = KWin.Workspace.desktops;
        if (!desktopSurfaceLifecycleSequenceIsValid(liveDesktops)) {
            return null;
        }
        if (memberships.length === 0) {
            return { all: true, ids: [] };
        }

        const ids = [];
        const knownIds = Object.create(null);
        for (const desktop of memberships) {
            if (!desktop || desktop.id === undefined || desktop.id === null) {
                return null;
            }
            const desktopId = String(desktop.id);
            if (!desktopSurfaceLifecycleIdentifierIsValid(desktopId)) {
                return null;
            }

            let objectMatches = 0;
            let idMatches = 0;
            for (const liveDesktop of liveDesktops) {
                if (!liveDesktop || liveDesktop.id === undefined || liveDesktop.id === null) {
                    return null;
                }
                const liveDesktopId = String(liveDesktop.id);
                if (!desktopSurfaceLifecycleIdentifierIsValid(liveDesktopId)) {
                    return null;
                }
                if (liveDesktop === desktop) {
                    objectMatches += 1;
                    if (liveDesktopId !== desktopId) {
                        return null;
                    }
                }
                if (liveDesktopId === desktopId) {
                    idMatches += 1;
                }
            }
            if (objectMatches !== 1 || idMatches !== 1) {
                return null;
            }
            if (knownIds[desktopId] === true) {
                return null;
            }
            knownIds[desktopId] = true;
            ids.push(desktopId);
        }

        return { all: false, ids };
    }

    function snapshotDesktopSurfaceLifecycleActivities(window) {
        const memberships = window.activities;
        if (!desktopSurfaceLifecycleSequenceIsValid(memberships)) {
            return null;
        }
        const liveActivities = KWin.Workspace.activities;
        if (!desktopSurfaceLifecycleSequenceIsValid(liveActivities)) {
            return null;
        }
        if (memberships.length === 0) {
            return { all: true, ids: [] };
        }

        const ids = [];
        const knownIds = Object.create(null);
        for (const membership of memberships) {
            if (membership === undefined || membership === null) {
                return null;
            }
            const activityId = String(membership);
            if (!desktopSurfaceLifecycleIdentifierIsValid(activityId)) {
                return null;
            }

            let matches = 0;
            for (const liveActivity of liveActivities) {
                if (liveActivity === undefined || liveActivity === null) {
                    return null;
                }
                const liveActivityId = String(liveActivity);
                if (!desktopSurfaceLifecycleIdentifierIsValid(liveActivityId)) {
                    return null;
                }
                if (liveActivityId === activityId) {
                    matches += 1;
                }
            }
            if (matches !== 1) {
                return null;
            }
            if (knownIds[activityId] === true) {
                return null;
            }
            knownIds[activityId] = true;
            ids.push(activityId);
        }

        return { all: false, ids };
    }

    function desktopSurfaceLifecycleSequenceIsValid(sequence) {
        return sequence !== undefined && sequence !== null && typeof sequence !== "string"
            && Number.isInteger(sequence.length) && sequence.length >= 0
            && sequence.length <= desktopSurfaceLifecycleIdLimit;
    }

    function desktopSurfaceLifecycleIdentifierIsValid(value) {
        if (typeof value !== "string" || value.length === 0
                || value.length > desktopSurfaceLifecycleIdentifierLimit) {
            return false;
        }
        for (let index = 0; index < value.length; index += 1) {
            const code = value.charCodeAt(index);
            if (code <= 31 || code === 127) {
                return false;
            }
        }
        return true;
    }

    function mergeDesktopSurfaceLifecycleScope(scope) {
        if (pendingDesktopSurfaceLifecycleGlobal) {
            scheduleDesktopSurfaceLifecycleFlush();
            return;
        }
        if (!desktopSurfaceLifecycleScopeIsValid(scope)) {
            queueGlobalDesktopSurfaceLifecycleEvent();
            return;
        }

        for (let index = 0; index < pendingDesktopSurfaceLifecycleScopes.length; index += 1) {
            const pendingScope = pendingDesktopSurfaceLifecycleScopes[index];
            if (!desktopSurfaceLifecycleScopeIsValid(pendingScope)) {
                queueGlobalDesktopSurfaceLifecycleEvent();
                return;
            }
            if (pendingScope.output === scope.output
                    && pendingScope.outputName !== scope.outputName) {
                queueGlobalDesktopSurfaceLifecycleEvent();
                return;
            }
            if (desktopSurfaceLifecycleScopesAreEqual(pendingScope, scope)) {
                scheduleDesktopSurfaceLifecycleFlush();
                return;
            }
        }

        if (pendingDesktopSurfaceLifecycleScopes.length >= desktopSurfaceLifecycleScopeLimit) {
            queueGlobalDesktopSurfaceLifecycleEvent();
            return;
        }

        pendingDesktopSurfaceLifecycleScopes.push({
                                                      output: scope.output,
                                                      outputName: scope.outputName,
                                                      allDesktops: scope.allDesktops,
                                                      desktopIds: scope.allDesktops ? [] : scope.desktopIds.slice(),
                                                      allActivities: scope.allActivities,
                                                      activityIds: scope.allActivities ? [] : scope.activityIds.slice()
                                                  });
        scheduleDesktopSurfaceLifecycleFlush();
    }

    function desktopSurfaceLifecycleScopeIsValid(scope) {
        try {
            return scope && typeof scope === "object" && !Array.isArray(scope)
                && scope.output && typeof scope.output === "object" && !Array.isArray(scope.output)
                && desktopSurfaceLifecycleIdentifierIsValid(scope.outputName)
                && desktopSurfaceLifecycleIdSelectionIsValid(scope.allDesktops, scope.desktopIds)
                && desktopSurfaceLifecycleIdSelectionIsValid(scope.allActivities, scope.activityIds);
        } catch (error) {
            return false;
        }
    }

    function desktopSurfaceLifecycleIdSelectionIsValid(all, ids) {
        if (typeof all !== "boolean" || !desktopSurfaceLifecycleSequenceIsValid(ids)
                || (all ? ids.length !== 0 : ids.length === 0)) {
            return false;
        }

        const knownIds = Object.create(null);
        for (const id of ids) {
            if (!desktopSurfaceLifecycleIdentifierIsValid(id) || knownIds[id] === true) {
                return false;
            }
            knownIds[id] = true;
        }
        return true;
    }

    function desktopSurfaceLifecycleScopesAreEqual(first, second) {
        return first.output === second.output && first.outputName === second.outputName
            && first.allDesktops === second.allDesktops
            && first.allActivities === second.allActivities
            && desktopSurfaceLifecycleIdSetsAreEqual(first.desktopIds, second.desktopIds)
            && desktopSurfaceLifecycleIdSetsAreEqual(first.activityIds, second.activityIds);
    }

    function desktopSurfaceLifecycleIdSetsAreEqual(first, second) {
        if (!desktopSurfaceLifecycleSequenceIsValid(first)
                || !desktopSurfaceLifecycleSequenceIsValid(second)
                || first.length !== second.length) {
            return false;
        }

        const firstIds = Object.create(null);
        for (const id of first) {
            if (!desktopSurfaceLifecycleIdentifierIsValid(id) || firstIds[id] === true) {
                return false;
            }
            firstIds[id] = true;
        }
        const secondIds = Object.create(null);
        for (const id of second) {
            if (!desktopSurfaceLifecycleIdentifierIsValid(id) || secondIds[id] === true
                    || firstIds[id] !== true) {
                return false;
            }
            secondIds[id] = true;
        }
        return true;
    }

    function queueGlobalDesktopSurfaceLifecycleEvent() {
        pendingDesktopSurfaceLifecycleGlobal = true;
        pendingDesktopSurfaceLifecycleScopes = [];
        scheduleDesktopSurfaceLifecycleFlush();
    }

    function scheduleDesktopSurfaceLifecycleFlush() {
        if (desktopSurfaceLifecycleFlushQueued) {
            return;
        }

        desktopSurfaceLifecycleFlushQueued = true;
        Qt.callLater(controller.flushDesktopSurfaceLifecycleEvent);
    }

    function flushDesktopSurfaceLifecycleEvent() {
        if (!desktopSurfaceLifecycleFlushQueued) {
            return false;
        }

        const global = pendingDesktopSurfaceLifecycleGlobal;
        const pendingScopes = pendingDesktopSurfaceLifecycleScopes;
        clearPendingDesktopSurfaceLifecycleEvent();
        if (!active || presentationPhase === "retiring") {
            return false;
        }

        const scopes = [];
        if (!global) {
            for (const scope of pendingScopes) {
                const allDesktops = scope.allDesktops === true;
                const allActivities = scope.allActivities === true;
                scopes.push(Object.freeze({
                                              output: scope.output,
                                              outputName: scope.outputName,
                                              allDesktops,
                                              desktopIds: Object.freeze(allDesktops ? [] : scope.desktopIds.slice()),
                                              allActivities,
                                              activityIds: Object.freeze(allActivities ? [] : scope.activityIds.slice())
                                          }));
            }
        }

        const revision = nextDesktopSurfaceLifecycleRevision();
        desktopSurfaceLifecycleRevision = revision;
        if (!active || presentationPhase === "retiring") {
            desktopSurfaceLifecycleEvent = null;
            return false;
        }
        const event = Object.freeze({
                                        revision,
                                        global,
                                        scopes: Object.freeze(scopes)
                                    });
        desktopSurfaceLifecycleEvent = event;
        Qt.callLater(controller.clearPublishedDesktopSurfaceLifecycleEvent, event);
        return true;
    }

    function clearPublishedDesktopSurfaceLifecycleEvent(expectedEvent) {
        if (desktopSurfaceLifecycleEvent !== expectedEvent) {
            return false;
        }

        desktopSurfaceLifecycleEvent = null;
        return true;
    }

    function clearPendingDesktopSurfaceLifecycleEvent() {
        desktopSurfaceLifecycleFlushQueued = false;
        pendingDesktopSurfaceLifecycleGlobal = false;
        pendingDesktopSurfaceLifecycleScopes = [];
    }

    function nextDesktopSurfaceLifecycleRevision() {
        return desktopSurfaceLifecycleRevision >= 2147483647 ? 1
                                                             : desktopSurfaceLifecycleRevision + 1;
    }

    function open() {
        activate();
    }

    function close() {
        if (!active && !loading) {
            return;
        }

        deactivate();
    }

    function submitSpatialDropCommand(source, target, basisFingerprint) {
        if (!active || loading || activeSessionId <= 0 || !overviewModel
                || typeof basisFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(basisFingerprint)
                || (presentationPhase !== "opening" && presentationPhase !== "open")) {
            return false;
        }

        return spatialDropWriter.submitSpatialDropCommand(source, target, basisFingerprint);
    }

    function captureSpatialDropBasisFingerprint(source, target) {
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            const sessionId = activeSessionId;
            const model = overviewModel;
            const screens = KWin.Workspace.screens;
            const desktops = KWin.Workspace.desktops;
            if (!runtime || typeof runtime.fingerprintOverviewSpatialDropBasis !== "function"
                    || typeof runtime.overviewSpatialDropBasisContextKeys !== "function"
                    || !model || !screens || !desktops
                    || !active || loading || sessionId <= 0
                    || !Number.isInteger(screens.length) || screens.length < 1 || screens.length > 32
                    || !Number.isInteger(desktops.length) || desktops.length < 1 || desktops.length > 512) {
                return null;
            }

            const contextKeys = runtime.overviewSpatialDropBasisContextKeys(source, target);
            if (!contextKeys || !Object.isFrozen(contextKeys)
                    || !Number.isInteger(contextKeys.length)
                    || contextKeys.length < 1 || contextKeys.length > 3) {
                return null;
            }
            const contextGeometries = [];
            for (const key of contextKeys) {
                const screen = exactSpatialDropScreen(key.outputId, screens);
                const desktop = exactSpatialDropDesktop(key.desktopId, desktops);
                const fingerprint = spatialDropContextGeometryFingerprint(screen, desktop);
                if (!screen || !desktop || fingerprint === null) {
                    return null;
                }
                contextGeometries.push({
                                           activityId: key.activityId,
                                           desktopId: key.desktopId,
                                           fingerprint,
                                           outputId: key.outputId
                                       });
            }

            const fingerprint = runtime.fingerprintOverviewSpatialDropBasis({
                                                                                alwaysCenterSingleColumn: overviewAlwaysCenterSingleColumn,
                                                                                contextGeometries,
                                                                                gap: overviewGap,
                                                                                model,
                                                                                source,
                                                                                target
                                                                            });
            return active && !loading && activeSessionId === sessionId && overviewModel === model
                && (presentationPhase === "opening" || presentationPhase === "open")
                && typeof fingerprint === "string" && /^[0-9a-f]{64}$/.test(fingerprint)
                ? fingerprint : null;
        } catch (error) {
            return null;
        }
    }

    function exactSpatialDropScreen(expectedOutputId, screens) {
        let match = null;
        for (const screen of screens) {
            if (screen && String(screen.name) === expectedOutputId) {
                if (match !== null) {
                    return null;
                }
                match = screen;
            }
        }
        return match;
    }

    function exactSpatialDropDesktop(expectedDesktopId, desktops) {
        let match = null;
        for (const desktop of desktops) {
            if (desktop && String(desktop.id) === expectedDesktopId) {
                if (match !== null) {
                    return null;
                }
                match = desktop;
            }
        }
        return match;
    }

    function spatialDropContextGeometryFingerprint(screen, desktop) {
        try {
            if (!screen || !desktop || !screen.geometry) {
                return null;
            }
            const outputGeometry = screen.geometry;
            const workArea = KWin.Workspace.clientArea(KWin.Workspace.MaximizeArea,
                                                       screen, desktop);
            const values = [
                Number(screen.devicePixelRatio),
                Number(outputGeometry.x),
                Number(outputGeometry.y),
                Number(outputGeometry.width),
                Number(outputGeometry.height),
                Number(workArea.x),
                Number(workArea.y),
                Number(workArea.width),
                Number(workArea.height)
            ];
            if (values.some(value => !Number.isFinite(value))
                    || values.some(value => Math.abs(value) > 1000000)
                    || values[0] <= 0 || values[3] <= 0 || values[4] <= 0
                    || values[7] <= 0 || values[8] <= 0) {
                return null;
            }
            return values.join("\u0000");
        } catch (error) {
            return null;
        }
    }

    function submitWorkspaceCommand(context, action) {
        if (!active || loading || activeSessionId <= 0 || !overviewModel
                || overviewContextRefreshPending
                || (presentationPhase !== "opening" && presentationPhase !== "open")) {
            return false;
        }

        return workspaceCommandWriter.submitWorkspaceCommand(context, action);
    }

    function applyTouchpadGestureSettings(enabled, fingerCount) {
        const nextEnabled = enabled === true;
        const numericFingerCount = Number(fingerCount);
        const nextFingerCount = Number.isFinite(numericFingerCount)
                && Math.floor(numericFingerCount) === numericFingerCount
                && numericFingerCount >= 3
                && numericFingerCount <= 5
            ? numericFingerCount
            : 4;

        if (nextEnabled === touchpadGestureEnabled
                && nextFingerCount === touchpadGestureFingerCount) {
            return;
        }

        touchpadGestureEnabled = nextEnabled;
        touchpadGestureFingerCount = nextFingerCount;
        rebuildTouchpadGesture();
        syncOverviewTouchpadZoomGesture(true);
    }

    function rebuildTouchpadGesture() {
        if (touchpadGestureOwner !== "") {
            cancelTouchpadGesture(touchpadGestureOwner);
        }
        touchpadGestureLoader.active = false;
        touchpadGestureLoader.source = "";

        if (!touchpadGestureEnabled) {
            return;
        }

        touchpadGestureLoader.setSource("OverviewTouchpadGesture.qml", {
            fingerCount: touchpadGestureFingerCount
        });
        touchpadGestureLoader.active = true;
    }

    function applyOverviewZoomSetting(value) {
        const zoom = normalizedOverviewZoom(value);
        if (!Number.isFinite(zoom)) {
            return false;
        }

        configuredOverviewZoom = zoom;
        if (!active) {
            assignOverviewSessionZoom(zoom);
        }
        return true;
    }

    function setOverviewSessionZoom(sessionId, outputId, sceneToken, value) {
        const zoom = normalizedOverviewZoom(value);
        if (!Number.isFinite(zoom)
                || !overviewZoomSceneOwnsMutation(sessionId, outputId, sceneToken)
                || !captureOverviewZoomLocalOwner(sessionId, outputId, sceneToken)) {
            return false;
        }

        assignOverviewSessionZoom(zoom);
        return true;
    }

    function resetOverviewSessionZoom(sessionId, outputId, sceneToken) {
        return setOverviewSessionZoom(sessionId, outputId, sceneToken,
            configuredOverviewZoom);
    }

    function applyOverviewZoomInputState(sessionId, outputId, sceneToken, eligible) {
        if (!overviewZoomInputStateContextIsExact(sessionId, outputId, sceneToken) || typeof eligible !== "boolean") {
            return false;
        }

        const nextStates = [];
        let matchingState = null;
        for (const state of overviewZoomInputStates) {
            if (state.outputId !== outputId) {
                nextStates.push(state);
                continue;
            }
            if (matchingState !== null || state.sceneToken !== sceneToken) {
                return false;
            }
            matchingState = state;
        }
        if (eligible && overviewZoomLocalOwnerIsExact(
                sessionId, outputId, sceneToken, overviewModel)) {
            clearOverviewZoomLocalOwner();
        }
        if (matchingState && matchingState.eligible === eligible
                && matchingState.model === overviewModel) {
            if (eligible) {
                scheduleDeferredOverviewZoomLiveRefresh();
            }
            return true;
        }
        nextStates.push({
            eligible,
            model: overviewModel,
            outputId,
            sceneToken,
            sessionId
        });
        overviewZoomInputStates = nextStates;
        advanceOverviewZoomInputStateRevision();
        syncOverviewTouchpadZoomGesture();
        if (eligible) {
            scheduleDeferredOverviewZoomLiveRefresh();
        }
        return true;
    }

    function clearOverviewZoomInputState(sessionId, outputId, sceneToken) {
        if (!Number.isInteger(sessionId) || sessionId <= 0 || !overviewZoomIdentifierIsValid(outputId) || !overviewZoomSceneTokenIsValid(sceneToken)) {
            return false;
        }

        let matchingState = null;
        for (const state of overviewZoomInputStates) {
            if (state.sessionId === sessionId && state.outputId === outputId) {
                if (matchingState !== null || state.sceneToken !== sceneToken) {
                    return false;
                }
                matchingState = state;
            }
        }
        if (!matchingState) {
            return false;
        }

        if (overviewZoomLocalOwnerIsExact(
                sessionId, outputId, sceneToken, matchingState.model)) {
            rollbackActiveOverviewLocalZoom();
        }
        const nextStates = overviewZoomInputStates.filter(state => state !== matchingState);
        overviewZoomInputStates = nextStates;
        advanceOverviewZoomInputStateRevision();
        syncOverviewTouchpadZoomGesture();
        scheduleDeferredOverviewZoomLiveRefresh();
        return true;
    }

    function invalidateOverviewZoomInputStates() {
        rollbackActiveOverviewLocalZoom();
        cancelActiveOverviewZoomGesture();
        if (overviewZoomInputStates.length > 0) {
            overviewZoomInputStates = [];
            advanceOverviewZoomInputStateRevision();
        }
        syncOverviewTouchpadZoomGesture();
    }

    function reconcileOverviewZoomInputStatesForModel() {
        rollbackActiveOverviewLocalZoom();
        invalidateOverviewZoomGestureContext();
        const outputIds = overviewZoomModelOutputIds();
        const nextStates = [];
        if (outputIds !== null) {
            for (const state of overviewZoomInputStates) {
                if (state && state.model === overviewModel
                        && outputIds.indexOf(state.outputId) >= 0) {
                    nextStates.push(state);
                }
            }
        }
        if (nextStates.length !== overviewZoomInputStates.length) {
            overviewZoomInputStates = nextStates;
            advanceOverviewZoomInputStateRevision();
        }
        syncOverviewTouchpadZoomGesture();
    }

    function invalidateOverviewZoomGestureContext() {
        const gesture = overviewTouchpadZoomGestureLoader.item;
        if (gesture && typeof gesture.invalidateGesture === "function") {
            try {
                if (gesture.invalidateGesture() === true) {
                    return true;
                }
            } catch (error) {
            }
        }
        return cancelActiveOverviewZoomGesture();
    }

    function captureOverviewZoomLocalOwner(sessionId, outputId, sceneToken) {
        if (overviewZoomLocalOwnerSessionId > 0) {
            return overviewZoomLocalOwnerIsExact(
                sessionId, outputId, sceneToken, overviewModel);
        }

        overviewZoomLocalOwnerSessionId = sessionId;
        overviewZoomLocalOwnerOutputId = outputId;
        overviewZoomLocalOwnerSceneToken = sceneToken;
        overviewZoomLocalOwnerModel = overviewModel;
        overviewZoomLocalOwnerInitialZoom = overviewSessionZoom;
        return true;
    }

    function overviewZoomLocalOwnerIsExact(sessionId, outputId, sceneToken, model) {
        return overviewZoomLocalOwnerSessionId > 0
            && overviewZoomLocalOwnerSessionId === sessionId
            && overviewZoomLocalOwnerOutputId === outputId
            && overviewZoomLocalOwnerSceneToken === sceneToken
            && overviewZoomLocalOwnerModel === model;
    }

    function clearOverviewZoomLocalOwner() {
        overviewZoomLocalOwnerSessionId = 0;
        overviewZoomLocalOwnerOutputId = "";
        overviewZoomLocalOwnerSceneToken = null;
        overviewZoomLocalOwnerModel = null;
        overviewZoomLocalOwnerInitialZoom = overviewSessionZoom;
    }

    function rollbackActiveOverviewLocalZoom() {
        if (overviewZoomLocalOwnerSessionId <= 0) {
            return false;
        }

        const sessionId = overviewZoomLocalOwnerSessionId;
        const initialZoom = overviewZoomLocalOwnerInitialZoom;
        clearOverviewZoomLocalOwner();
        if (active && sessionId === activeSessionId && Number.isFinite(initialZoom)) {
            assignOverviewSessionZoom(initialZoom);
        }
        return true;
    }

    function beginOverviewZoomGesture(sessionId, direction, progress) {
        const boundedProgress = normalizedOverviewZoomGestureProgress(progress);
        if (!overviewZoomGestureDirectionIsValid(direction)
                || !Number.isFinite(boundedProgress)
                || !overviewZoomGlobalGestureCanBegin(sessionId)) {
            return false;
        }

        overviewZoomGestureSessionId = sessionId;
        overviewZoomGestureDirection = direction;
        overviewZoomGestureInitialZoom = overviewSessionZoom;
        if (!applyOverviewZoomGesturePreview(boundedProgress)) {
            clearOverviewZoomGestureState();
            return false;
        }
        return true;
    }

    function updateOverviewZoomGesture(sessionId, direction, progress) {
        const boundedProgress = normalizedOverviewZoomGestureProgress(progress);
        if (!Number.isFinite(boundedProgress) || !overviewZoomGestureContextIsExact(sessionId, direction)) {
            cancelActiveOverviewZoomGesture();
            return false;
        }

        if (!applyOverviewZoomGesturePreview(boundedProgress)) {
            cancelActiveOverviewZoomGesture();
            return false;
        }
        return true;
    }

    function commitOverviewZoomGesture(sessionId, direction) {
        if (!overviewZoomGestureContextIsExact(sessionId, direction)) {
            cancelActiveOverviewZoomGesture();
            return false;
        }

        clearOverviewZoomGestureState();
        scheduleDeferredOverviewZoomLiveRefresh();
        return true;
    }

    function cancelOverviewZoomGesture(sessionId, direction) {
        if (!Number.isInteger(sessionId) || sessionId <= 0 || sessionId !== overviewZoomGestureSessionId || !overviewZoomGestureDirectionIsValid(direction) || direction !== overviewZoomGestureDirection) {
            return false;
        }

        return cancelActiveOverviewZoomGesture();
    }

    function invalidateOverviewZoomGesture(sessionId, direction) {
        return cancelOverviewZoomGesture(sessionId, direction);
    }

    function cancelActiveOverviewZoomGesture() {
        if (overviewZoomGestureDirection === "") {
            return false;
        }

        const sessionId = overviewZoomGestureSessionId;
        const initialZoom = overviewZoomGestureInitialZoom;
        clearOverviewZoomGestureState();
        if (active && sessionId === activeSessionId && Number.isFinite(initialZoom)) {
            assignOverviewSessionZoom(initialZoom);
        }
        scheduleDeferredOverviewZoomLiveRefresh();
        return true;
    }

    function clearOverviewZoomGestureState() {
        overviewZoomGestureSessionId = 0;
        overviewZoomGestureDirection = "";
        overviewZoomGestureInitialZoom = overviewSessionZoom;
    }

    function applyOverviewZoomGesturePreview(progress) {
        if (overviewZoomGestureDirection === "" || !Number.isFinite(progress) || progress < 0 || progress > 1 || !Number.isFinite(overviewZoomGestureInitialZoom)) {
            return false;
        }

        const direction = overviewZoomGestureDirection === "in" ? 1 : -1;
        const requested = overviewZoomGestureInitialZoom + direction * overviewZoomGestureSpan * progress;
        const bounded = Math.max(overviewZoomMinimum, Math.min(overviewZoomMaximum, requested));
        const zoom = normalizedOverviewZoom(bounded);
        if (!Number.isFinite(zoom)) {
            return false;
        }

        assignOverviewSessionZoom(zoom);
        return true;
    }

    function overviewZoomGestureContextIsExact(sessionId, direction) {
        return Number.isInteger(sessionId) && sessionId > 0 && sessionId === overviewZoomGestureSessionId && sessionId === activeSessionId && overviewZoomGestureDirectionIsValid(direction) && direction === overviewZoomGestureDirection && overviewZoomSessionContextIsExact(sessionId) && overviewZoomInputStatesAreEligible();
    }

    function overviewZoomGlobalGestureCanBegin(sessionId) {
        return overviewZoomGestureDirection === ""
            && overviewZoomSessionContextIsExact(sessionId)
            && overviewZoomInputStatesAreEligible();
    }

    function overviewZoomSceneOwnsMutation(sessionId, outputId, sceneToken) {
        if (overviewZoomGestureDirection !== ""
                || !overviewZoomSessionContextIsExact(sessionId)
                || !overviewZoomIdentifierIsValid(outputId)
                || !overviewZoomSceneTokenIsValid(sceneToken)) {
            return false;
        }

        const outputIds = overviewZoomModelOutputIds();
        const states = overviewZoomInputStates;
        if (outputIds === null || !states || !Number.isInteger(states.length)
                || states.length !== outputIds.length) {
            return false;
        }

        let callerMatched = false;
        for (const expectedOutputId of outputIds) {
            let matchingState = null;
            for (const state of states) {
                if (state && state.outputId === expectedOutputId) {
                    if (matchingState !== null) {
                        return false;
                    }
                    matchingState = state;
                }
            }
            if (!matchingState || matchingState.sessionId !== sessionId
                    || matchingState.model !== overviewModel
                    || !overviewZoomSceneTokenIsValid(matchingState.sceneToken)) {
                return false;
            }
            if (expectedOutputId === outputId) {
                if (matchingState.sceneToken !== sceneToken
                        || matchingState.eligible !== false) {
                    return false;
                }
                callerMatched = true;
            } else if (matchingState.eligible !== true) {
                return false;
            }
        }
        return callerMatched;
    }

    function overviewZoomSessionContextIsExact(sessionId) {
        return Number.isInteger(sessionId) && sessionId > 0 && active && !loading && activeSessionId === sessionId && overviewModel && presentationPhase === "open" && Math.abs(presentationProgress - 1) <= 0.000001;
    }

    function overviewZoomInputStateContextIsExact(sessionId, outputId, sceneToken) {
        if (!Number.isInteger(sessionId) || sessionId <= 0 || sessionId !== activeSessionId
                || !active || loading || !overviewModel
                || (presentationPhase !== "opening" && presentationPhase !== "open")
                || !overviewZoomIdentifierIsValid(outputId)
                || !overviewZoomSceneTokenIsValid(sceneToken)) {
            return false;
        }

        const outputIds = overviewZoomModelOutputIds();
        return outputIds !== null && outputIds.indexOf(outputId) >= 0;
    }

    function overviewZoomInputStatesAreEligible() {
        if (!overviewZoomSessionContextIsExact(activeSessionId)) {
            return false;
        }

        const outputIds = overviewZoomModelOutputIds();
        const states = overviewZoomInputStates;
        if (outputIds === null || !states || !Number.isInteger(states.length) || states.length !== outputIds.length) {
            return false;
        }

        for (const outputId of outputIds) {
            let matchingState = null;
            for (const state of states) {
                if (state && state.outputId === outputId) {
                    if (matchingState !== null) {
                        return false;
                    }
                    matchingState = state;
                }
            }
            if (!matchingState || matchingState.sessionId !== activeSessionId || matchingState.model !== overviewModel || matchingState.eligible !== true || !overviewZoomSceneTokenIsValid(matchingState.sceneToken)) {
                return false;
            }
        }
        return true;
    }

    function overviewZoomModelOutputIds() {
        try {
            const outputs = overviewModel ? overviewModel.outputs : null;
            if (!outputs || !Number.isInteger(outputs.length) || outputs.length < 1 || outputs.length > 64) {
                return null;
            }

            const outputIds = [];
            for (const output of outputs) {
                const outputId = output && overviewZoomIdentifierIsValid(output.outputId) ? String(output.outputId) : "";
                if (outputId.length === 0 || outputIds.indexOf(outputId) >= 0) {
                    return null;
                }
                outputIds.push(outputId);
            }
            return outputIds;
        } catch (error) {
            return null;
        }
    }

    function overviewZoomIdentifierIsValid(value) {
        if (typeof value !== "string" || value.length < 1 || value.length > 4096) {
            return false;
        }
        for (let index = 0; index < value.length; index += 1) {
            const code = value.charCodeAt(index);
            if (code <= 31 || code === 127) {
                return false;
            }
        }
        return true;
    }

    function overviewZoomSceneTokenIsValid(value) {
        return value !== null && typeof value === "object";
    }

    function overviewZoomGestureDirectionIsValid(value) {
        return value === "in" || value === "out";
    }

    function normalizedOverviewZoomGestureProgress(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric >= 0 ? Math.max(0, Math.min(1, numeric)) : Number.NaN;
    }

    function normalizedOverviewZoom(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || value < overviewZoomMinimum || value > overviewZoomMaximum) {
            return Number.NaN;
        }
        return Object.is(value, -0) ? 0 : value;
    }

    function assignOverviewSessionZoom(value) {
        if (overviewSessionZoom === value) {
            return false;
        }
        overviewSessionZoom = value;
        advanceOverviewZoomRevision();
        return true;
    }

    function advanceOverviewZoomRevision() {
        overviewZoomRevision = overviewZoomRevision >= 2147483647 ? 1 : overviewZoomRevision + 1;
    }

    function advanceOverviewZoomInputStateRevision() {
        overviewZoomInputStateRevision = overviewZoomInputStateRevision >= 2147483647 ? 1 : overviewZoomInputStateRevision + 1;
    }

    function syncOverviewTouchpadZoomGesture(forceRebuild = false) {
        const shouldLoad = touchpadGestureEnabled && overviewZoomInputStatesAreEligible();
        const loader = overviewTouchpadZoomGestureLoader;
        if (!shouldLoad) {
            cancelActiveOverviewZoomGesture();
            loader.active = false;
            loader.source = "";
            return false;
        }

        if (!forceRebuild && loader.active && loader.item && loader.item.fingerCount === touchpadGestureFingerCount) {
            return true;
        }

        cancelActiveOverviewZoomGesture();
        loader.active = false;
        loader.source = "";
        loader.setSource("OverviewTouchpadZoomGesture.qml", {
            fingerCount: touchpadGestureFingerCount
        });
        loader.active = true;
        return true;
    }

    function resetTouchpadGestureState() {
        touchpadGestureOwner = "";
        touchpadGestureProgress = 0;
    }

    function touchpadGestureTarget(owner, progress) {
        const bounded = boundedPresentationProgress(progress);
        return owner === "close" ? 1 - bounded : bounded;
    }

    function applyTouchpadGestureProgress(owner, progress) {
        if (owner !== touchpadGestureOwner || !active || loading
                || activeSessionId <= 0 || !overviewModel) {
            return false;
        }

        presentationPhase = owner === "close" ? "closing" : "opening";
        presentationProgress = touchpadGestureTarget(owner, progress);
        return true;
    }

    function beginTouchpadGesture(owner, progress) {
        const numericProgress = Number(progress);
        if ((owner !== "open" && owner !== "close")
                || !Number.isFinite(numericProgress) || numericProgress <= 0
                || touchpadGestureOwner !== "") {
            return false;
        }

        const boundedProgress = boundedPresentationProgress(numericProgress);
        if (owner === "open") {
            if (active || loading || presentationPhase !== "closed"
                    || plasmaOverviewIsActive()) {
                return false;
            }

            touchpadGestureOwner = owner;
            touchpadGestureProgress = boundedProgress;
            touchpadGestureDispatching = true;
            try {
                activate();
            } finally {
                touchpadGestureDispatching = false;
            }
            if (!active && !loading) {
                resetTouchpadGestureState();
                return false;
            }
            return true;
        }

        if (!active || loading || presentationPhase !== "open"
                || activeSessionId <= 0 || !overviewModel) {
            return false;
        }

        touchpadGestureOwner = owner;
        touchpadGestureProgress = boundedProgress;
        if (pendingLiveRefreshAttemptId > 0) {
            pendingPostTransitionLiveRefresh = true;
        }
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        invalidatePresentationTransition();
        return applyTouchpadGestureProgress(owner, boundedProgress);
    }

    function updateTouchpadGesture(owner, progress) {
        const numericProgress = Number(progress);
        if (owner !== touchpadGestureOwner || owner === ""
                || !Number.isFinite(numericProgress)) {
            return false;
        }

        const boundedProgress = boundedPresentationProgress(numericProgress);
        touchpadGestureProgress = boundedProgress;
        if (owner === "open" && ((loading && !active)
                || (active && presentationPhase === "preparing"))) {
            return true;
        }
        return applyTouchpadGestureProgress(owner, boundedProgress);
    }

    function finishTouchpadGesture(owner, committed) {
        if (owner === "" || owner !== touchpadGestureOwner) {
            return false;
        }

        resetTouchpadGestureState();
        if (owner === "open" && loading && !active) {
            if (!committed) {
                deactivateImmediately();
            }
            return true;
        }
        if (!active || loading || activeSessionId <= 0 || !overviewModel) {
            return false;
        }
        if (owner === "open" && presentationPhase === "preparing") {
            if (!committed) {
                deactivateImmediately();
            }
            return true;
        }

        const opening = owner === "open" ? committed : !committed;
        const phase = opening ? "opening" : "closing";
        const target = phase === "opening" ? 1 : 0;
        return startPresentationTransition(phase, target, activeSessionId);
    }

    function cancelTouchpadGesture(owner) {
        return finishTouchpadGesture(owner, false);
    }

    function activateTouchpadGesture(owner) {
        return finishTouchpadGesture(owner, true);
    }

    function invalidateTouchpadGesture(owner) {
        if (owner === "" || owner !== touchpadGestureOwner) {
            return false;
        }

        deactivateImmediately();
        return true;
    }

    function emptyDesktopAboveFirstFromConfig() {
        try {
            mainScriptSettings.sync();
            return mainScriptSettings.value("EmptyDesktopAboveFirst", false) === true;
        } catch (error) {
            return false;
        }
    }

    function captureOverviewLayoutSettings() {
        let nextAlwaysCenterSingleColumn = false;
        let nextGap = 16;

        try {
            mainScriptSettings.sync();

            const alwaysCenterSingleColumn = mainScriptSettings.value("AlwaysCenterSingleColumn", false);
            if (typeof alwaysCenterSingleColumn === "boolean") {
                nextAlwaysCenterSingleColumn = alwaysCenterSingleColumn;
            }

            const gap = mainScriptSettings.value("Gap", 16);
            if (typeof gap === "number" && Number.isFinite(gap) && gap >= 0 && gap <= 64) {
                nextGap = gap;
            }
        } catch (error) {
        }

        overviewAlwaysCenterSingleColumn = nextAlwaysCenterSingleColumn;
        overviewGap = nextGap;
    }

    function activate() {
        if (pendingSceneRestartRequest) {
            return;
        }
        const interruptedTouchpadGesture = !touchpadGestureDispatching
            && touchpadGestureOwner !== "";
        if (interruptedTouchpadGesture) {
            resetTouchpadGestureState();
        }
        if (active) {
            if (presentationPhase === "retiring") {
                pendingSceneRetirementReopen = true;
                return;
            }
            if (presentationPhase === "preparing") {
                return;
            }
            if ((presentationPhase === "closing" || interruptedTouchpadGesture)
                    && activeSessionId > 0 && overviewModel) {
                cancelOverviewExitHandoff("reopen");
                startPresentationTransition("opening", 1, activeSessionId);
            }
            return;
        }
        if (loading || plasmaOverviewIsActive()) {
            return;
        }

        prepareOverviewZoomForFreshActivation();
        captureOverviewLayoutSettings();
        const attemptId = lastActivationAttemptId >= 2147483647
            ? 1
            : lastActivationAttemptId + 1;
        lastActivationAttemptId = attemptId;
        pendingActivationAttemptId = attemptId;
        activeSessionId = 0;
        clearOverviewContextRefresh();
        clearPendingLiveModelRefresh();
        clearOpeningReadiness();
        clearSceneRetirement();
        invalidatePresentationTransition();
        pendingPostTransitionLiveRefresh = false;
        overviewModel = null;
        sceneVisible = false;
        loading = true;
        presentationProgress = 0;
        presentationPhase = "closed";
        const synchronousDocument = layoutStateReader.readSample();
        const cachedModel = lookupActivationCache(synchronousDocument);
        if (cachedModel) {
            acceptActivationModel(attemptId, cachedModel);
            return;
        }
        layoutStateReader.sample(attemptId);
    }

    function deactivate() {
        if (pendingSceneRestartRequest) {
            clearPendingSceneRestart();
            return;
        }
        const interruptedTouchpadGesture = !touchpadGestureDispatching
            && touchpadGestureOwner !== "";
        if (interruptedTouchpadGesture) {
            resetTouchpadGestureState();
        }
        if (loading && !active) {
            deactivateImmediately();
            return;
        }
        if (active && presentationPhase === "retiring") {
            pendingSceneRetirementReopen = false;
            return;
        }
        if (active && presentationPhase === "preparing") {
            deactivateImmediately();
            return;
        }
        if (!active || (presentationPhase === "closing" && !interruptedTouchpadGesture)) {
            return;
        }
        if (activeSessionId <= 0 || !overviewModel) {
            deactivateImmediately();
            return;
        }

        invalidateOverviewZoomInputStates();
        clearOverviewContextRefresh();
        if (pendingLiveRefreshAttemptId > 0) {
            pendingPostTransitionLiveRefresh = true;
        }
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        startPresentationTransition("closing", 0, activeSessionId);
    }

    function deactivateImmediately() {
        clearPendingSceneRestart();
        if (active && presentationPhase === "retiring") {
            return;
        }
        if (!active || activeSessionId <= 0 || !overviewModel || !sceneVisible) {
            finalizeInactiveOverviewState();
            return;
        }

        requestSceneRetirement(activeSessionId);
    }

    function finalizeInactiveOverviewState() {
        invalidateOverviewZoomInputStates();
        clearDeferredOverviewZoomLiveRefresh();
        resetTouchpadGestureState();
        touchpadGestureDispatching = false;
        clearPendingDesktopSurfaceLifecycleEvent();
        desktopSurfaceLifecycleEvent = null;
        clearOverviewExitHandoff();
        clearOpeningReadiness();
        clearSceneRetirement();
        clearPendingSceneRestart();
        invalidatePresentationTransition();
        pendingActivationAttemptId = 0;
        clearOverviewContextRefresh();
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        sceneVisible = false;
        active = false;
        activeSessionId = 0;
        loading = false;
        overviewModel = null;
        pendingPostTransitionLiveRefresh = false;
        presentationProgress = 0;
        presentationPhase = "closed";
    }

    function nextSceneRetirementToken() {
        const token = lastSceneRetirementToken >= 2147483647
            ? 1 : lastSceneRetirementToken + 1;
        lastSceneRetirementToken = token;
        return token;
    }

    function nextSceneRestartToken() {
        const token = lastSceneRestartToken >= 2147483647
            ? 1 : lastSceneRestartToken + 1;
        lastSceneRestartToken = token;
        return token;
    }

    function clearPendingSceneRestart() {
        pendingSceneRestartRequest = null;
    }

    function queueSceneRestart(sessionId, contextDrift) {
        if (!Number.isInteger(sessionId) || sessionId <= 0
                || typeof contextDrift !== "boolean" || active || loading
                || sceneVisible || presentationPhase !== "closed") {
            return false;
        }

        const request = Object.freeze({
            contextDrift,
            restartToken: nextSceneRestartToken(),
            sessionId,
            topologyGeneration: overviewTopologyGeneration
        });
        pendingSceneRestartRequest = request;
        Qt.callLater(function() {
            if (controller.pendingSceneRestartRequest !== request) {
                return;
            }
            controller.pendingSceneRestartRequest = null;
            if (controller.active || controller.loading || controller.sceneVisible
                    || controller.presentationPhase !== "closed"
                    || controller.plasmaOverviewIsActive()) {
                return;
            }
            controller.activate();
        });
        return true;
    }

    function clearSceneRetirement() {
        pendingSceneRetirementReopen = false;
        pendingSceneRetirementSessionId = 0;
        pendingSceneRetirementToken = 0;
        pendingSceneRetirementContextDrift = false;
    }

    function requestSceneRetirement(sessionId, reopen, forcedContextDrift) {
        if (!Number.isInteger(sessionId) || sessionId <= 0
                || !active || activeSessionId !== sessionId || !overviewModel) {
            if (!active || !sceneVisible) {
                finalizeInactiveOverviewState();
            }
            return false;
        }
        if (presentationPhase === "retiring") {
            return pendingSceneRetirementSessionId === sessionId
                && pendingSceneRetirementToken > 0 && !sceneVisible;
        }
        if (!sceneVisible) {
            finalizeInactiveOverviewState();
            return false;
        }
        if (presentationPhase === "preparing" && !openingReadinessSceneActivated) {
            sceneVisible = false;
            finalizeInactiveOverviewState();
            return true;
        }

        invalidatePresentationTransition();
        presentationProgress = 0;
        presentationPhase = "retiring";
        const contextDrift = forcedContextDrift === true || overviewContextRefreshPending
            || pendingLiveRefreshAttemptId > 0 || pendingPostTransitionLiveRefresh;
        invalidateOverviewZoomInputStates();
        clearDeferredOverviewZoomLiveRefresh();
        resetTouchpadGestureState();
        touchpadGestureDispatching = false;
        clearPendingDesktopSurfaceLifecycleEvent();
        clearOpeningReadiness();
        pendingActivationAttemptId = 0;
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        pendingPostTransitionLiveRefresh = false;
        pendingSceneRetirementSessionId = sessionId;
        pendingSceneRetirementToken = nextSceneRetirementToken();
        pendingSceneRetirementReopen = reopen === true;
        pendingSceneRetirementContextDrift = contextDrift;
        sceneVisible = false;
        return true;
    }

    function handleSceneDeactivated(retirementToken, sessionId) {
        if (pendingSceneRetirementToken > 0) {
            if (!Number.isInteger(retirementToken) || retirementToken <= 0
                    || retirementToken !== pendingSceneRetirementToken
                    || !Number.isInteger(sessionId) || sessionId <= 0
                    || sessionId !== pendingSceneRetirementSessionId
                    || !active || activeSessionId !== sessionId || !overviewModel
                    || sceneVisible || presentationPhase !== "retiring") {
                return false;
            }

            const reopen = pendingSceneRetirementReopen;
            const contextDrift = pendingSceneRetirementContextDrift;
            const completedSessionId = pendingSceneRetirementSessionId;
            clearSceneRetirement();
            if (!reopen) {
                finalizeInactiveOverviewState();
                return true;
            }
            finalizeInactiveOverviewState();
            return queueSceneRestart(completedSessionId, contextDrift);
        }

        if (!active && !sceneVisible) {
            return false;
        }

        sceneVisible = false;
        finalizeInactiveOverviewState();
        return true;
    }

    function prepareOverviewZoomForFreshActivation() {
        invalidateOverviewZoomInputStates();
        clearDeferredOverviewZoomLiveRefresh();
        clearOverviewZoomGestureState();
        assignOverviewSessionZoom(configuredOverviewZoom);
    }

    function nextSceneReadinessEpoch() {
        const epoch = lastSceneReadinessEpoch >= 2147483647
            ? 1 : lastSceneReadinessEpoch + 1;
        lastSceneReadinessEpoch = epoch;
        return epoch;
    }

    function clearOpeningReadiness() {
        openingReadinessEpoch = 0;
        openingReadinessExpectedOutputIds = [];
        openingReadinessModel = null;
        openingReadinessRegistrations = [];
        openingReadinessSceneActivated = false;
        openingReadinessSessionId = 0;
        openingReadinessTopologyGeneration = 0;
    }

    function openingModelOutputIds(model) {
        try {
            if (!model || !model.outputs || !Number.isInteger(model.outputs.length)
                    || model.outputs.length < 1 || model.outputs.length > 64) {
                return null;
            }
            const liveOutputs = KWin.Workspace.screens;
            if (!liveOutputs || !Number.isInteger(liveOutputs.length)
                    || liveOutputs.length !== model.outputs.length) {
                return null;
            }

            const outputIds = [];
            for (const output of model.outputs) {
                const outputId = output && overviewZoomIdentifierIsValid(output.outputId)
                    ? String(output.outputId) : "";
                if (outputId.length === 0 || outputIds.indexOf(outputId) >= 0) {
                    return null;
                }
                let liveMatches = 0;
                for (const liveOutput of liveOutputs) {
                    if (openingOutputMatchesScreen(output, liveOutput)) {
                        liveMatches += 1;
                    }
                }
                if (liveMatches !== 1) {
                    return null;
                }
                outputIds.push(outputId);
            }
            for (const liveOutput of liveOutputs) {
                let modelMatches = 0;
                for (const output of model.outputs) {
                    if (openingOutputMatchesScreen(output, liveOutput)) {
                        modelMatches += 1;
                    }
                }
                if (modelMatches !== 1) {
                    return null;
                }
            }
            return outputIds;
        } catch (error) {
            return null;
        }
    }

    function openingOutputMatchesScreen(output, screen) {
        if (!output || !screen || output.name === undefined || output.name === null
                || screen.name === undefined || screen.name === null
                || String(output.name) !== String(screen.name)) {
            return false;
        }
        const outputManufacturer = output.manufacturer === undefined || output.manufacturer === null
            ? "" : String(output.manufacturer);
        const screenManufacturer = screen.manufacturer === undefined || screen.manufacturer === null
            ? "" : String(screen.manufacturer);
        const outputModel = output.model === undefined || output.model === null
            ? "" : String(output.model);
        const screenModel = screen.model === undefined || screen.model === null
            ? "" : String(screen.model);
        const outputSerial = output.serialNumber === undefined || output.serialNumber === null
            ? "" : String(output.serialNumber);
        const screenSerial = screen.serialNumber === undefined || screen.serialNumber === null
            ? "" : String(screen.serialNumber);
        return outputManufacturer === screenManufacturer && outputModel === screenModel
            && outputSerial === screenSerial;
    }

    function sameOpeningOutputIds(first, second) {
        if (!first || !second || !Number.isInteger(first.length)
                || !Number.isInteger(second.length) || first.length !== second.length) {
            return false;
        }
        for (let index = 0; index < first.length; index += 1) {
            if (first[index] !== second[index]) {
                return false;
            }
        }
        return true;
    }

    function prepareOpeningReadiness(sessionId, model) {
        const outputIds = openingModelOutputIds(model);
        if (!Number.isInteger(sessionId) || sessionId <= 0 || !active
                || activeSessionId !== sessionId || !model || overviewModel !== model
                || outputIds === null) {
            finalizeInactiveOverviewState();
            return false;
        }

        clearOpeningReadiness();
        invalidatePresentationTransition();
        const epoch = nextSceneReadinessEpoch();
        openingReadinessEpoch = epoch;
        openingReadinessExpectedOutputIds = outputIds;
        openingReadinessModel = model;
        openingReadinessRegistrations = [];
        openingReadinessSceneActivated = false;
        openingReadinessSessionId = sessionId;
        openingReadinessTopologyGeneration = overviewTopologyGeneration;
        presentationProgress = 0;
        presentationPhase = "preparing";
        sceneVisible = true;
        Qt.callLater(function() {
            controller.rejectUnstartedOpeningScene(epoch, sessionId, model,
                                                   controller.openingReadinessTopologyGeneration);
        });
        return true;
    }

    function openingReadinessIdentityIsExact(epoch, sessionId, model, topologyGeneration) {
        return Number.isInteger(epoch) && epoch > 0 && epoch === openingReadinessEpoch
            && Number.isInteger(sessionId) && sessionId > 0
            && sessionId === openingReadinessSessionId && sessionId === activeSessionId
            && model && model === openingReadinessModel && model === overviewModel
            && Number.isInteger(topologyGeneration) && topologyGeneration > 0
            && topologyGeneration === openingReadinessTopologyGeneration
            && topologyGeneration === overviewTopologyGeneration
            && active && !loading && sceneVisible && presentationPhase === "preparing"
            && Math.abs(presentationProgress) <= 0.000001;
    }

    function openingReadinessContextIsExact(epoch, sessionId, model, topologyGeneration) {
        const outputIds = openingModelOutputIds(model);
        return openingReadinessIdentityIsExact(epoch, sessionId, model, topologyGeneration)
            && outputIds !== null
            && sameOpeningOutputIds(outputIds, openingReadinessExpectedOutputIds)
    }

    function rejectUnstartedOpeningScene(epoch, sessionId, model, topologyGeneration) {
        if (!openingReadinessIdentityIsExact(epoch, sessionId, model, topologyGeneration)
                || openingReadinessSceneActivated) {
            return false;
        }

        sceneVisible = false;
        finalizeInactiveOverviewState();
        return true;
    }

    function acknowledgeOverviewSceneActivated(epoch, sessionId) {
        if (!openingReadinessContextIsExact(epoch, sessionId, openingReadinessModel,
                                            openingReadinessTopologyGeneration)) {
            return false;
        }
        if (openingReadinessSceneActivated) {
            return true;
        }

        openingReadinessSceneActivated = true;
        return completeOpeningReadinessIfExact();
    }

    function registerOverviewSceneReady(epoch, sessionId, model, topologyGeneration,
                                        outputId, sceneToken) {
        if (!openingReadinessContextIsExact(epoch, sessionId, model, topologyGeneration)
                || !overviewZoomIdentifierIsValid(outputId)
                || openingReadinessExpectedOutputIds.indexOf(outputId) < 0
                || !overviewZoomSceneTokenIsValid(sceneToken)) {
            return false;
        }

        const registrations = openingReadinessRegistrations;
        for (const registration of registrations) {
            if (!registration || !overviewZoomIdentifierIsValid(registration.outputId)
                    || !overviewZoomSceneTokenIsValid(registration.sceneToken)) {
                requestSceneRetirement(sessionId);
                return false;
            }
            if (registration.outputId === outputId || registration.sceneToken === sceneToken) {
                if (registration.outputId === outputId && registration.sceneToken === sceneToken) {
                    return true;
                }
                requestSceneRetirement(sessionId);
                return false;
            }
        }

        const nextRegistrations = registrations.slice();
        nextRegistrations.push({ outputId, sceneToken });
        openingReadinessRegistrations = nextRegistrations;
        completeOpeningReadinessIfExact();
        return true;
    }

    function unregisterOverviewSceneReady(epoch, sessionId, model, topologyGeneration,
                                          outputId, sceneToken, fatal) {
        if (epoch !== openingReadinessEpoch || sessionId !== openingReadinessSessionId
                || model !== openingReadinessModel
                || topologyGeneration !== openingReadinessTopologyGeneration) {
            return false;
        }

        const registrations = openingReadinessRegistrations;
        let matchingIndex = -1;
        for (let index = 0; index < registrations.length; index += 1) {
            const registration = registrations[index];
            if (registration && registration.outputId === outputId
                    && registration.sceneToken === sceneToken) {
                if (matchingIndex >= 0) {
                    requestSceneRetirement(sessionId);
                    return false;
                }
                matchingIndex = index;
            }
        }
        if (matchingIndex < 0) {
            return false;
        }

        const nextRegistrations = registrations.slice();
        nextRegistrations.splice(matchingIndex, 1);
        openingReadinessRegistrations = nextRegistrations;
        if (fatal === true && active && activeSessionId === sessionId
                && presentationPhase === "preparing") {
            requestSceneRetirement(sessionId);
        }
        return true;
    }

    function completeOpeningReadinessIfExact() {
        const epoch = openingReadinessEpoch;
        const sessionId = openingReadinessSessionId;
        const model = openingReadinessModel;
        const topologyGeneration = openingReadinessTopologyGeneration;
        if (!openingReadinessSceneActivated
                || !openingReadinessContextIsExact(epoch, sessionId, model, topologyGeneration)) {
            return false;
        }

        const outputIds = openingReadinessExpectedOutputIds;
        const registrations = openingReadinessRegistrations;
        if (registrations.length !== outputIds.length) {
            return false;
        }
        for (const outputId of outputIds) {
            let matches = 0;
            for (const registration of registrations) {
                if (registration && registration.outputId === outputId
                        && overviewZoomSceneTokenIsValid(registration.sceneToken)) {
                    matches += 1;
                }
            }
            if (matches !== 1) {
                return false;
            }
        }

        clearOpeningReadiness();
        if (touchpadGestureOwner === "open") {
            invalidatePresentationTransition();
            presentationPhase = "opening";
            presentationProgress = touchpadGestureTarget("open", touchpadGestureProgress);
            return true;
        }
        return startPresentationTransition("opening", 1, sessionId);
    }

    function boundedPresentationProgress(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        return Math.max(0, Math.min(1, numeric));
    }

    function nextPresentationTransitionToken() {
        const token = lastPresentationTransitionToken >= 2147483647
            ? 1
            : lastPresentationTransitionToken + 1;
        lastPresentationTransitionToken = token;
        return token;
    }

    function invalidatePresentationTransition() {
        pendingPresentationTransitionToken = 0;
        pendingPresentationTransitionSessionId = 0;
        presentationAnimation.transitionToken = 0;
        presentationAnimation.sessionId = 0;
        presentationAnimation.targetPhase = "closed";
        presentationAnimation.targetProgress = 0;
        if (presentationAnimation.running) {
            presentationAnimation.stop();
        }
    }

    function startPresentationTransition(phase, targetProgress, sessionId) {
        const target = boundedPresentationProgress(targetProgress);
        if ((phase !== "opening" && phase !== "closing")
                || !Number.isInteger(sessionId) || sessionId <= 0
                || !active || activeSessionId !== sessionId || !overviewModel) {
            deactivateImmediately();
            return false;
        }

        invalidatePresentationTransition();
        const token = nextPresentationTransitionToken();
        const start = boundedPresentationProgress(presentationProgress);
        const distance = Math.abs(target - start);

        pendingPresentationTransitionToken = token;
        pendingPresentationTransitionSessionId = sessionId;
        presentationPhase = phase;
        presentationProgress = start;
        presentationAnimation.transitionToken = token;
        presentationAnimation.sessionId = sessionId;
        presentationAnimation.targetPhase = phase;
        presentationAnimation.targetProgress = target;

        if (distance <= 0.000001) {
            presentationProgress = target;
            completePresentationTransition(token, sessionId, phase, target);
            return true;
        }

        presentationAnimation.from = start;
        presentationAnimation.to = target;
        presentationAnimation.duration = Math.max(1, Math.round(220 * distance));
        presentationAnimation.start();
        return true;
    }

    function completePresentationTransition(token, sessionId, phase, targetProgress) {
        const target = boundedPresentationProgress(targetProgress);
        if (!Number.isInteger(token) || token <= 0
                || token !== pendingPresentationTransitionToken
                || token !== presentationAnimation.transitionToken
                || !Number.isInteger(sessionId) || sessionId <= 0
                || sessionId !== pendingPresentationTransitionSessionId
                || sessionId !== presentationAnimation.sessionId
                || sessionId !== activeSessionId
                || phase !== presentationPhase
                || phase !== presentationAnimation.targetPhase
                || target !== presentationAnimation.targetProgress
                || Math.abs(presentationProgress - target) > 0.000001) {
            return;
        }

        pendingPresentationTransitionToken = 0;
        pendingPresentationTransitionSessionId = 0;
        presentationProgress = target;

        if (phase === "closing") {
            requestSceneRetirement(sessionId);
            return;
        }

        presentationPhase = "open";
        if (overviewExitHandoffState && overviewExitHandoffState.phase === "canceled") {
            clearOverviewExitHandoff();
        }
        if (pendingPostTransitionLiveRefresh) {
            pendingPostTransitionLiveRefresh = false;
            requestLiveModelRefresh();
        }
    }

    function plasmaOverviewIsActive() {
        try {
            const workspace = KWin.Workspace;
            if (!workspace || typeof workspace.isEffectActive !== "function") {
                return true;
            }

            return workspace.isEffectActive("overview") === true;
        } catch (error) {
            return true;
        }
    }

    function cancelPendingActivation(attemptId) {
        if (!loading || active || attemptId <= 0 || attemptId !== pendingActivationAttemptId) {
            return false;
        }

        resetTouchpadGestureState();
        pendingActivationAttemptId = 0;
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        active = false;
        activeSessionId = 0;
        loading = false;
        overviewModel = null;
        return true;
    }

    function acceptLayoutState(attemptId, document) {
        if (pendingLiveRefreshAttemptId > 0 && attemptId === pendingLiveRefreshAttemptId) {
            acceptLiveModelRefresh(attemptId, document);
            return;
        }
        if (!loading || active || attemptId <= 0 || attemptId !== pendingActivationAttemptId) {
            return;
        }

        if (plasmaOverviewIsActive()) {
            cancelPendingActivation(attemptId);
            return;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.loadOverviewModel !== "function") {
                rejectLayoutState(attemptId, "runtime-unavailable");
                return;
            }

            const snapshot = liveSnapshot();
            const result = runtime.loadOverviewModel(document, snapshot);
            if (!result || result.ok !== true || !result.value) {
                rejectLayoutState(attemptId, result && result.error ? String(result.error) : "invalid-model");
                return;
            }

            if (plasmaOverviewIsActive()) {
                cancelPendingActivation(attemptId);
                return;
            }

            if (acceptActivationModel(attemptId, result.value)) {
                scheduleActivationCacheStore(attemptId, document, snapshot,
                                             result.value);
            }
        } catch (error) {
            rejectLayoutState(attemptId, "runtime-error");
        }
    }

    function acceptActivationModel(attemptId, model) {
        if (!loading || active || !model || attemptId <= 0
                || attemptId !== pendingActivationAttemptId) {
            return false;
        }
        if (plasmaOverviewIsActive()) {
            cancelPendingActivation(attemptId);
            return false;
        }

        pendingActivationAttemptId = 0;
        activeSessionId = attemptId;
        overviewModel = model;
        loading = false;
        active = true;
        return prepareOpeningReadiness(attemptId, model);
    }

    function createActivationCache() {
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            return runtime && typeof runtime.createOverviewActivationCache === "function"
                ? runtime.createOverviewActivationCache() : null;
        } catch (error) {
            return null;
        }
    }

    function lookupActivationCache(document) {
        const cache = overviewActivationCache;
        if (!cache || typeof cache.hasExactDocument !== "function"
                || typeof cache.lookup !== "function") {
            return null;
        }

        try {
            if (!cache.hasExactDocument(document)) {
                return null;
            }
            const snapshot = liveSnapshot();
            const result = cache.lookup(document, snapshot);
            return result && result.ok === true && result.value ? result.value : null;
        } catch (error) {
            return null;
        }
    }

    function scheduleActivationCacheStore(sessionId, document, snapshot, model) {
        if (!Number.isInteger(sessionId) || sessionId <= 0
                || !active || loading || activeSessionId !== sessionId
                || pendingActivationAttemptId !== 0 || overviewModel !== model) {
            return false;
        }

        try {
            Qt.callLater(function() {
                if (!controller.active || controller.loading
                        || controller.activeSessionId !== sessionId
                        || controller.pendingActivationAttemptId !== 0
                        || controller.overviewModel !== model) {
                    return;
                }
                controller.storeActivationCache(document, snapshot, model);
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    function storeActivationCache(document, snapshot, model) {
        const cache = overviewActivationCache;
        if (!cache || typeof cache.store !== "function") {
            return null;
        }

        try {
            const result = cache.store(document, snapshot, model);
            return result && result.ok === true && result.value ? result.value : null;
        } catch (error) {
            return null;
        }
    }

    function beginOverviewExitHandoff(windowCandidate, input) {
        if (!active || loading || presentationPhase !== "open" || presentationProgress < 1
                || activeSessionId <= 0 || !overviewModel || !input
                || overviewExitHandoffIsActive()) {
            return 0;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.captureOverviewExitHandoff !== "function") {
            return 0;
        }

        const targetKind = input.targetKind;
        const targetWindowId = input.targetWindowId === undefined
            || input.targetWindowId === null ? null : String(input.targetWindowId);
        if (targetKind === "window") {
            try {
                if (!windowCandidate || windowCandidate.deleted === true
                        || windowCandidate.internalId === undefined
                        || windowCandidate.internalId === null
                        || String(windowCandidate.internalId) !== targetWindowId) {
                    return 0;
                }
            } catch (error) {
                return 0;
            }
        } else if (targetKind !== "desktop-fallback" || targetWindowId !== null) {
            return 0;
        }

        const token = nextOverviewExitHandoffToken();
        let state = null;
        try {
            state = runtime.captureOverviewExitHandoff({
                                                           camera: input.camera,
                                                           generation: overviewTopologyGeneration,
                                                           sessionId: activeSessionId,
                                                           sourceDesktopId: input.sourceDesktopId,
                                                           sourceOutputId: input.sourceOutputId,
                                                           sourceRect: input.sourceRect,
                                                           targetDesktopId: input.targetDesktopId,
                                                           targetFrame: input.targetFrame,
                                                           targetKind,
                                                           targetMinimized: input.targetMinimized === true,
                                                           targetOutputId: input.targetOutputId,
                                                           targetWindowId,
                                                           token
                                                       });
        } catch (error) {
            state = null;
        }
        if (!state || state.phase !== "captured" || !state.capture
                || state.capture.sessionId !== activeSessionId
                || state.capture.generation !== overviewTopologyGeneration
                || state.capture.token !== token) {
            return 0;
        }

        if (pendingLiveRefreshAttemptId > 0) {
            pendingPostTransitionLiveRefresh = true;
        }
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        overviewExitHandoffPromotion = null;
        overviewExitHandoffWindow = targetKind === "window" ? windowCandidate : null;
        overviewExitHandoffState = state;
        return token;
    }

    function settleOverviewExitHandoff(token, windowCandidate) {
        const state = overviewExitHandoffState;
        const capture = state ? state.capture : null;
        if (!overviewExitHandoffIsActive() || !capture || state.phase !== "captured"
                || !Number.isInteger(token) || token <= 0 || token !== capture.token) {
            return false;
        }

        let targetFrame = capture.targetFrame;
        let targetMinimized = false;
        let targetWindowId = null;
        if (capture.targetKind === "window") {
            try {
                if (!windowCandidate || windowCandidate !== overviewExitHandoffWindow
                        || windowCandidate.deleted === true
                        || windowCandidate.internalId === undefined
                        || windowCandidate.internalId === null
                        || KWin.Workspace.activeWindow !== windowCandidate) {
                    return invalidateOverviewExitHandoff("stale");
                }
                targetWindowId = String(windowCandidate.internalId);
                if (targetWindowId !== capture.targetWindowId) {
                    return invalidateOverviewExitHandoff("stale");
                }
                targetMinimized = windowCandidate.minimized === true;
                targetFrame = overviewExitRect(windowCandidate.frameGeometry);
            } catch (error) {
                return invalidateOverviewExitHandoff("stale");
            }
            if (!targetFrame) {
                return invalidateOverviewExitHandoff("stale");
            }
        }

        const plan = planOverviewExitHandoff({
                                                 generation: capture.generation,
                                                 sessionId: capture.sessionId,
                                                 targetDesktopId: capture.targetDesktopId,
                                                 targetFrame,
                                                 targetMinimized,
                                                 targetOutputId: capture.targetOutputId,
                                                 targetWindowId,
                                                 token: capture.token,
                                                 topologyGeneration: overviewTopologyGeneration,
                                                 type: "settle"
                                             });
        return applyOverviewExitHandoffPlan(plan, windowCandidate);
    }

    function invalidateOverviewExitHandoff(reason) {
        const state = overviewExitHandoffState;
        const capture = state ? state.capture : null;
        if (presentationPhase === "retiring" || !overviewExitHandoffIsActive() || !capture
                || (reason !== "stale" && reason !== "topology")) {
            return false;
        }

        const plan = planOverviewExitHandoff({
                                                 generation: capture.generation,
                                                 reason,
                                                 sessionId: capture.sessionId,
                                                 token: capture.token,
                                                 type: "invalidate"
                                             });
        return applyOverviewExitHandoffPlan(plan, null);
    }

    function cancelOverviewExitHandoff(type) {
        const state = overviewExitHandoffState;
        const capture = state ? state.capture : null;
        if (!overviewExitHandoffIsActive() || !capture
                || (type !== "interrupt" && type !== "reopen")) {
            return false;
        }

        const plan = planOverviewExitHandoff({
                                                 generation: capture.generation,
                                                 sessionId: capture.sessionId,
                                                 token: capture.token,
                                                 type
                                             });
        return applyOverviewExitHandoffPlan(plan, null);
    }

    function planOverviewExitHandoff(event) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewExitHandoffTransition !== "function"
                || !overviewExitHandoffState) {
            return null;
        }

        try {
            return runtime.planOverviewExitHandoffTransition({
                                                                 event,
                                                                 state: overviewExitHandoffState
                                                             });
        } catch (error) {
            return null;
        }
    }

    function applyOverviewExitHandoffPlan(plan, windowCandidate) {
        if (!plan || !plan.state || (plan.disposition !== "promote"
                && plan.disposition !== "fallback" && plan.disposition !== "cancel"
                && plan.disposition !== "none")) {
            clearOverviewExitHandoff();
            return false;
        }

        overviewExitHandoffState = plan.state;
        overviewExitHandoffPromotion = plan.disposition === "promote"
            && plan.promotion ? plan.promotion : null;
        overviewExitHandoffWindow = overviewExitHandoffPromotion && windowCandidate
            ? windowCandidate : null;
        if (plan.disposition === "cancel" && presentationPhase === "open"
                && pendingPostTransitionLiveRefresh) {
            pendingPostTransitionLiveRefresh = false;
            requestLiveModelRefresh();
        }
        return plan.disposition === "promote" || plan.disposition === "fallback"
            || plan.disposition === "cancel" || plan.disposition === "none";
    }

    function overviewExitHandoffIsActive() {
        const state = overviewExitHandoffState;
        const capture = state ? state.capture : null;
        return active && capture && capture.sessionId === activeSessionId
            && (state.phase === "captured" || state.phase === "promoted"
                || state.phase === "fallback");
    }

    function handleOverviewExitWindowRemoved(window) {
        return presentationPhase !== "retiring" && overviewExitHandoffIsActive() && window
            && window === overviewExitHandoffWindow
            ? invalidateOverviewExitHandoff("stale") : false;
    }

    function clearOverviewExitHandoff() {
        overviewExitHandoffPromotion = null;
        overviewExitHandoffWindow = null;
        overviewExitHandoffState = null;
    }

    function restartPreparingSceneForContextDrift() {
        if (!active || loading || presentationPhase !== "preparing"
                || activeSessionId <= 0 || !overviewModel || !sceneVisible) {
            return false;
        }

        const sessionId = activeSessionId;
        if (!openingReadinessSceneActivated) {
            sceneVisible = false;
            finalizeInactiveOverviewState();
            return queueSceneRestart(sessionId, true);
        }
        return requestSceneRetirement(sessionId, true, true);
    }

    function advanceOverviewTopologyGeneration() {
        if (presentationPhase === "retiring") {
            overviewTopologyGeneration = overviewTopologyGeneration >= 2147483647
                ? 1 : overviewTopologyGeneration + 1;
            pendingSceneRetirementContextDrift = true;
            return overviewTopologyGeneration;
        }
        overviewTopologyGeneration = overviewTopologyGeneration >= 2147483647
            ? 1 : overviewTopologyGeneration + 1;
        if (active && presentationPhase === "preparing") {
            restartPreparingSceneForContextDrift();
        }
        return overviewTopologyGeneration;
    }

    function requestOverviewContextRefresh() {
        if (!active || loading || activeSessionId <= 0 || !overviewModel
                || presentationPhase === "retiring") {
            return false;
        }

        overviewContextRefreshGeneration = overviewTopologyGeneration;
        overviewContextRefreshPending = true;
        requestLiveModelRefresh();
        return true;
    }

    function completeOverviewContextRefresh(topologyGeneration) {
        if (!overviewContextRefreshPending
                || !Number.isInteger(topologyGeneration) || topologyGeneration <= 0
                || topologyGeneration !== overviewContextRefreshGeneration
                || topologyGeneration !== overviewTopologyGeneration) {
            return false;
        }

        overviewContextRefreshPending = false;
        overviewContextRefreshGeneration = 0;
        return true;
    }

    function clearOverviewContextRefresh() {
        overviewContextRefreshPending = false;
        overviewContextRefreshGeneration = 0;
    }

    function nextOverviewExitHandoffToken() {
        const token = overviewExitHandoffLastToken >= 2147483647
            ? 1 : overviewExitHandoffLastToken + 1;
        overviewExitHandoffLastToken = token;
        return token;
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

    function rejectLayoutState(attemptId, reason) {
        if (pendingLiveRefreshAttemptId > 0 && attemptId === pendingLiveRefreshAttemptId) {
            rejectLiveModelRefresh(attemptId);
            return;
        }
        if (!loading || active || attemptId <= 0 || attemptId !== pendingActivationAttemptId) {
            return;
        }

        if (plasmaOverviewIsActive()) {
            cancelPendingActivation(attemptId);
            return;
        }

        deactivateImmediately();
        console.warn(`[driftile-overview] activation rejected reason=${reason}`);
        rejectionOsdCall.arguments = ["dialog-warning", "Could not open Driftile overview"];
        rejectionOsdCall.call();
    }

    function requestLiveModelRefresh() {
        if (presentationPhase === "retiring") {
            return;
        }
        if (presentationPhase !== "open" || overviewExitHandoffIsActive()) {
            pendingPostTransitionLiveRefresh = true;
            return;
        }
        if (!active || loading || activeSessionId <= 0 || !overviewModel) {
            return;
        }

        startLiveModelRefresh(0);
    }

    function startLiveModelRefresh(retryCount) {
        if (!Number.isInteger(retryCount) || retryCount < 0 || retryCount > 1
                || !active || loading || pendingActivationAttemptId !== 0
                || presentationPhase !== "open"
                || activeSessionId <= 0 || !overviewModel) {
            return false;
        }

        if (overviewZoomModelReplacementIsBlocked()) {
            deferOverviewZoomLiveRefresh();
            return true;
        }

        const sessionId = activeSessionId;
        const expectedModel = overviewModel;
        const topologyGeneration = overviewTopologyGeneration;
        overviewZoomLiveRefreshDeferred = false;
        layoutStateReader.cancel();
        clearPendingLiveModelRefresh();

        const attemptId = lastLiveRefreshAttemptId >= 2147483647
            ? 1
            : lastLiveRefreshAttemptId + 1;
        lastLiveRefreshAttemptId = attemptId;
        pendingLiveRefreshModel = expectedModel;
        pendingLiveRefreshRetryCount = retryCount;
        pendingLiveRefreshSessionId = sessionId;
        pendingLiveRefreshTopologyGeneration = topologyGeneration;
        pendingLiveRefreshAttemptId = attemptId;
        layoutStateReader.sample(attemptId);
        return true;
    }

    function acceptLiveModelRefresh(attemptId, document) {
        const sessionId = pendingLiveRefreshSessionId;
        const expectedModel = pendingLiveRefreshModel;
        const topologyGeneration = pendingLiveRefreshTopologyGeneration;
        if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel,
                                     topologyGeneration)) {
            return;
        }
        if (overviewZoomModelReplacementIsBlocked()) {
            deferOverviewZoomLiveRefresh();
            return;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.loadOverviewModel !== "function") {
                controller.rejectLiveModelRefresh(attemptId);
                return;
            }

            const snapshot = liveSnapshot();
            const result = runtime.loadOverviewModel(document, snapshot);
            if (!result || result.ok !== true || !result.value) {
                controller.rejectLiveModelRefresh(attemptId);
                return;
            }
            if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel,
                                         topologyGeneration)) {
                return;
            }
            if (overviewZoomModelReplacementIsBlocked()) {
                deferOverviewZoomLiveRefresh();
                return;
            }

            rollbackActiveOverviewLocalZoom();
            overviewModel = result.value;
            clearPendingLiveModelRefresh();
            completeOverviewContextRefresh(topologyGeneration);
            overviewZoomLiveRefreshDeferred = false;
            scheduleActivationCacheStore(sessionId, document, snapshot,
                                         result.value);
        } catch (error) {
            controller.rejectLiveModelRefresh(attemptId);
        }
    }

    function rejectLiveModelRefresh(attemptId) {
        const sessionId = pendingLiveRefreshSessionId;
        const expectedModel = pendingLiveRefreshModel;
        const topologyGeneration = pendingLiveRefreshTopologyGeneration;
        if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel,
                                     topologyGeneration)) {
            return;
        }

        const retryCount = pendingLiveRefreshRetryCount;
        clearPendingLiveModelRefresh();
        if (retryCount >= 1) {
            return;
        }
        if (!active || loading || presentationPhase !== "open"
                || activeSessionId !== sessionId || overviewModel !== expectedModel) {
            return;
        }

        startLiveModelRefresh(retryCount + 1);
    }

    function liveModelRefreshIsExact(attemptId, sessionId, expectedModel,
                                     topologyGeneration) {
        return Number.isInteger(attemptId) && attemptId > 0
            && attemptId === pendingLiveRefreshAttemptId
            && Number.isInteger(sessionId) && sessionId > 0
            && sessionId === pendingLiveRefreshSessionId
            && active && !loading && pendingActivationAttemptId === 0
            && presentationPhase === "open"
            && activeSessionId === sessionId
            && overviewModel === expectedModel
            && expectedModel !== null
            && pendingLiveRefreshModel === expectedModel
            && Number.isInteger(topologyGeneration) && topologyGeneration > 0
            && topologyGeneration === pendingLiveRefreshTopologyGeneration
            && topologyGeneration === overviewTopologyGeneration;
    }

    function clearPendingLiveModelRefresh() {
        pendingLiveRefreshAttemptId = 0;
        pendingLiveRefreshModel = null;
        pendingLiveRefreshRetryCount = 0;
        pendingLiveRefreshSessionId = 0;
        pendingLiveRefreshTopologyGeneration = 0;
    }

    function overviewZoomModelReplacementIsBlocked() {
        if (overviewZoomGestureDirection !== ""
                || overviewZoomLocalOwnerSessionId > 0) {
            return true;
        }

        const exactContextRefresh = overviewContextRefreshPending
            && overviewContextRefreshGeneration === overviewTopologyGeneration;
        for (const state of overviewZoomInputStates) {
            if (state && state.sessionId === activeSessionId
                    && state.model === overviewModel && state.eligible === false
                    && !exactContextRefresh) {
                return true;
            }
        }
        return false;
    }

    function deferOverviewZoomLiveRefresh() {
        overviewZoomLiveRefreshDeferred = true;
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
    }

    function scheduleDeferredOverviewZoomLiveRefresh() {
        if (!overviewZoomLiveRefreshDeferred
                || overviewZoomLiveRefreshResumeQueued
                || overviewZoomModelReplacementIsBlocked()) {
            return false;
        }

        const sessionId = activeSessionId;
        const model = overviewModel;
        overviewZoomLiveRefreshResumeQueued = true;
        Qt.callLater(function() {
            controller.overviewZoomLiveRefreshResumeQueued = false;
            if (!controller.overviewZoomLiveRefreshDeferred
                    || controller.overviewZoomModelReplacementIsBlocked()
                    || !controller.active || controller.loading
                    || controller.presentationPhase !== "open"
                    || controller.activeSessionId !== sessionId
                    || controller.overviewModel !== model) {
                return;
            }
            controller.requestLiveModelRefresh();
        });
        return true;
    }

    function clearDeferredOverviewZoomLiveRefresh() {
        overviewZoomLiveRefreshDeferred = false;
        overviewZoomLiveRefreshResumeQueued = false;
    }

    function liveSnapshot() {
        const fallbackActivityId = "driftile-default-activity";
        const activityIds = [];
        const outputs = [];
        const desktopIds = [];
        const windowIds = [];
        const windowHeightBounds = [];
        const workspaceActivityIds = KWin.Workspace.activities;
        let currentActivityId = fallbackActivityId;

        if (workspaceActivityIds) {
            for (const activity of workspaceActivityIds) {
                const candidate = String(activity);
                if (candidate.length > 0) {
                    activityIds.push(candidate);
                }
            }
        }

        if (KWin.Workspace.currentActivity !== undefined
                && KWin.Workspace.currentActivity !== null
                && String(KWin.Workspace.currentActivity).length > 0) {
            currentActivityId = String(KWin.Workspace.currentActivity);
        } else if (activityIds.length === 1) {
            currentActivityId = activityIds[0];
        }

        if (activityIds.length === 0) {
            activityIds.push(currentActivityId);
        }

        for (const screen of KWin.Workspace.screens) {
            const output = {
                name: String(screen.name)
            };
            addOptionalIdentifier(output, "manufacturer", screen.manufacturer);
            addOptionalIdentifier(output, "model", screen.model);
            addOptionalIdentifier(output, "serialNumber", screen.serialNumber);
            outputs.push(output);
        }

        for (const desktop of KWin.Workspace.desktops) {
            desktopIds.push(String(desktop.id));
        }

        for (const window of KWin.Workspace.stackingOrder) {
            const windowId = String(window.internalId);
            windowIds.push(windowId);
            const bounds = liveWindowHeightBound(window, windowId);
            if (bounds) {
                windowHeightBounds.push(bounds);
            }
        }

        return {
            activityIds,
            currentActivityId,
            desktopIds,
            outputs,
            windowHeightBounds,
            windowIds
        };
    }

    function liveWindowHeightBound(window, windowId) {
        const maximumMagnitude = 1000000;
        if (!window || typeof windowId !== "string" || windowId.length < 1
                || windowId.length > 256) {
            return null;
        }

        try {
            const frameHeight = Number(window.frameGeometry.height);
            const clientHeight = Number(window.clientGeometry.height);
            const minimumClientHeight = Number(window.minSize.height);
            const rawMaximumClientHeight = Number(window.maxSize.height);
            const rawDecorationHeight = frameHeight - clientHeight;

            if (!Number.isFinite(frameHeight) || frameHeight < 0
                    || !Number.isFinite(clientHeight) || clientHeight < 0
                    || !Number.isFinite(rawDecorationHeight) || rawDecorationHeight < -0.000001
                    || rawDecorationHeight > maximumMagnitude
                    || !Number.isFinite(minimumClientHeight) || minimumClientHeight < 0
                    || minimumClientHeight > maximumMagnitude) {
                return null;
            }

            const decorationHeight = rawDecorationHeight > 0 ? rawDecorationHeight : 0;
            const maximumClientHeight = Number.isFinite(rawMaximumClientHeight)
                    && rawMaximumClientHeight > 0 && rawMaximumClientHeight <= maximumMagnitude
                ? rawMaximumClientHeight : Number.POSITIVE_INFINITY;
            if ((maximumClientHeight !== Number.POSITIVE_INFINITY
                    && maximumClientHeight < minimumClientHeight)) {
                return null;
            }

            return {
                decorationHeight,
                maximumClientHeight,
                minimumClientHeight,
                windowId
            };
        } catch (error) {
            return null;
        }
    }

    function addOptionalIdentifier(target, key, value) {
        if (value !== undefined && value !== null && String(value).length > 0) {
            target[key] = String(value);
        }
    }
}
