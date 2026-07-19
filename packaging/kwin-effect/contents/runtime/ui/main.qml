import QtCore
import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

QtObject {
    id: controller

    property bool active: false
    property int activeSessionId: 0
    property bool loading: false
    property var overviewModel: null
    property int lastActivationAttemptId: 0
    property int lastLiveRefreshAttemptId: 0
    property int lastPresentationTransitionToken: 0
    property int pendingActivationAttemptId: 0
    property int pendingLiveRefreshAttemptId: 0
    property var pendingLiveRefreshModel: null
    property int pendingLiveRefreshRetryCount: 0
    property int pendingLiveRefreshSessionId: 0
    property bool pendingPostTransitionLiveRefresh: false
    property int pendingPresentationTransitionSessionId: 0
    property int pendingPresentationTransitionToken: 0
    property real presentationProgress: 0
    property string presentationPhase: "closed"
    property bool overviewAlwaysCenterSingleColumn: false
    property real overviewGap: 16
    property bool touchpadGestureEnabled: false
    property int touchpadGestureFingerCount: 4
    readonly property var overviewDelegate: Qt.createComponent("OverviewScene.qml")

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

        function onOpenRequested() {
            controller.openFromTouchpadGesture()
        }

        function onCloseRequested() {
            controller.closeFromTouchpadGesture()
        }
    }

    readonly property Connections workspaceWindowLifecycleConnection: Connections {
        id: workspaceWindowLifecycleConnection

        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onWindowAdded() {
            controller.requestLiveModelRefresh();
        }

        function onWindowRemoved() {
            controller.requestLiveModelRefresh();
        }
    }

    function toggle() {
        if (active && presentationPhase === "closing") {
            activate();
        } else if (active || loading) {
            deactivate();
        } else {
            activate();
        }
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
    }

    function rebuildTouchpadGesture() {
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

    function openFromTouchpadGesture() {
        open();
    }

    function closeFromTouchpadGesture() {
        close();
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
        if (active) {
            if (presentationPhase === "closing" && activeSessionId > 0 && overviewModel) {
                startPresentationTransition("opening", 1, activeSessionId);
            }
            return;
        }
        if (loading || plasmaOverviewIsActive()) {
            return;
        }

        captureOverviewLayoutSettings();
        const attemptId = lastActivationAttemptId >= 2147483647
            ? 1
            : lastActivationAttemptId + 1;
        lastActivationAttemptId = attemptId;
        pendingActivationAttemptId = attemptId;
        activeSessionId = 0;
        clearPendingLiveModelRefresh();
        invalidatePresentationTransition();
        pendingPostTransitionLiveRefresh = false;
        overviewModel = null;
        loading = true;
        presentationProgress = 0;
        presentationPhase = "closed";
        layoutStateReader.sample(attemptId);
    }

    function deactivate() {
        if (loading && !active) {
            deactivateImmediately();
            return;
        }
        if (!active || presentationPhase === "closing") {
            return;
        }
        if (activeSessionId <= 0 || !overviewModel) {
            deactivateImmediately();
            return;
        }

        if (pendingLiveRefreshAttemptId > 0) {
            pendingPostTransitionLiveRefresh = true;
        }
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        startPresentationTransition("closing", 0, activeSessionId);
    }

    function deactivateImmediately() {
        invalidatePresentationTransition();
        pendingActivationAttemptId = 0;
        clearPendingLiveModelRefresh();
        layoutStateReader.cancel();
        active = false;
        activeSessionId = 0;
        loading = false;
        overviewModel = null;
        pendingPostTransitionLiveRefresh = false;
        presentationProgress = 0;
        presentationPhase = "closed";
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
            deactivateImmediately();
            return;
        }

        presentationPhase = "open";
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

            const result = runtime.loadOverviewModel(document, liveSnapshot());
            if (!result || result.ok !== true || !result.value) {
                rejectLayoutState(attemptId, result && result.error ? String(result.error) : "invalid-model");
                return;
            }

            if (plasmaOverviewIsActive()) {
                cancelPendingActivation(attemptId);
                return;
            }

            pendingActivationAttemptId = 0;
            activeSessionId = attemptId;
            overviewModel = result.value;
            loading = false;
            active = true;
            presentationProgress = 0;
            startPresentationTransition("opening", 1, attemptId);
        } catch (error) {
            rejectLayoutState(attemptId, "runtime-error");
        }
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
        if (presentationPhase !== "open") {
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

        const sessionId = activeSessionId;
        const expectedModel = overviewModel;
        layoutStateReader.cancel();
        clearPendingLiveModelRefresh();

        const attemptId = lastLiveRefreshAttemptId >= 2147483647
            ? 1
            : lastLiveRefreshAttemptId + 1;
        lastLiveRefreshAttemptId = attemptId;
        pendingLiveRefreshModel = expectedModel;
        pendingLiveRefreshRetryCount = retryCount;
        pendingLiveRefreshSessionId = sessionId;
        pendingLiveRefreshAttemptId = attemptId;
        layoutStateReader.sample(attemptId);
        return true;
    }

    function acceptLiveModelRefresh(attemptId, document) {
        const sessionId = pendingLiveRefreshSessionId;
        const expectedModel = pendingLiveRefreshModel;
        if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel)) {
            return;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.loadOverviewModel !== "function") {
                controller.rejectLiveModelRefresh(attemptId);
                return;
            }

            const result = runtime.loadOverviewModel(document, liveSnapshot());
            if (!result || result.ok !== true || !result.value) {
                controller.rejectLiveModelRefresh(attemptId);
                return;
            }
            if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel)) {
                return;
            }

            clearPendingLiveModelRefresh();
            overviewModel = result.value;
        } catch (error) {
            controller.rejectLiveModelRefresh(attemptId);
        }
    }

    function rejectLiveModelRefresh(attemptId) {
        const sessionId = pendingLiveRefreshSessionId;
        const expectedModel = pendingLiveRefreshModel;
        if (!liveModelRefreshIsExact(attemptId, sessionId, expectedModel)) {
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

    function liveModelRefreshIsExact(attemptId, sessionId, expectedModel) {
        return Number.isInteger(attemptId) && attemptId > 0
            && attemptId === pendingLiveRefreshAttemptId
            && Number.isInteger(sessionId) && sessionId > 0
            && sessionId === pendingLiveRefreshSessionId
            && active && !loading && pendingActivationAttemptId === 0
            && presentationPhase === "open"
            && activeSessionId === sessionId
            && overviewModel === expectedModel
            && expectedModel !== null
            && pendingLiveRefreshModel === expectedModel;
    }

    function clearPendingLiveModelRefresh() {
        pendingLiveRefreshAttemptId = 0;
        pendingLiveRefreshModel = null;
        pendingLiveRefreshRetryCount = 0;
        pendingLiveRefreshSessionId = 0;
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
