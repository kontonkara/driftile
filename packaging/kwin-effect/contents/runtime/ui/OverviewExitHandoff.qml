pragma ComponentBehavior: Bound

import QtQuick
import org.kde.kwin as KWin

Item {
    id: root

    required property var handoff
    required property string handoffPhase
    required property var promotion
    required property var windowCandidate
    required property rect sourceRect
    required property string targetActivityId
    required property var targetDesktop
    required property string targetDesktopId
    required property rect targetOutputGeometry
    required property var targetScreen
    required property real progress
    required property bool handoffActive
    required property string activeOutput
    required property string capturedOutput

    signal handoffCompleted(var immutableHandoff, string visualMode)

    readonly property real boundedProgress: boundedUnit(progress)
    readonly property string handoffKey: validatedHandoffKey()
    readonly property string handoffKind: validatedHandoffKind()
    readonly property string handoffWindowId: validatedHandoffWindowId()
    readonly property bool capturedOutputExact: handoffKey.length > 0
        && activeOutput.length > 0 && capturedOutput.length > 0
        && activeOutput === capturedOutput
    readonly property bool promotionExact: promotionMatchesHandoff()
    readonly property string promotedOutput: validatedPromotedOutput()
    readonly property bool promotedOutputExact: promotionExact
        && promotedOutput.length > 0 && promotedOutput === capturedOutput
        && activeOutput === promotedOutput
    readonly property bool fallbackOutputExact: handoffPhase === "fallback"
        && capturedOutputExact
    readonly property bool resolvedOutputExact: promotedOutputExact || fallbackOutputExact
    readonly property bool preloadWindowCandidateExact: preloadCandidateIsExact()
    readonly property bool liveThumbnailEligible: preloadWindowCandidateExact
        && handoffWindowId.length > 0
    readonly property int liveThumbnailLoaderStatus: exitThumbnailLoader.status
    readonly property var liveThumbnailItem: liveThumbnailLoaderStatus === Loader.Ready
        && objectAvailable(exitThumbnailLoader.item) ? exitThumbnailLoader.item : null
    readonly property bool liveThumbnailReady: liveThumbnailEligible
        && liveThumbnailLoaderStatus === Loader.Ready
        && objectAvailable(liveThumbnailItem)
    readonly property rect targetRect: validatedTargetRect()
    readonly property bool exactWindowCandidate: promotedCandidateIsExact()
    readonly property string visualMode: visualModeCommitted
        ? committedVisualMode : "none"
    readonly property bool preloadStagingVisible: handoffActive
        && !visualModeCommitted && capturedOutputExact
        && (handoffPhase === "captured" || handoffPhase === "promoted")
        && preloadWindowCandidateExact
    readonly property rect safeSourceRect: rectIsUsable(sourceRect)
        ? sourceRect : Qt.rect(0, 0, Math.max(1, width), Math.max(1, height))
    readonly property rect safeDesktopSourceRect: validatedDesktopSourceRect()
    readonly property rect localTargetRect: rectForOutput(targetRect, targetOutputGeometry)
    readonly property rect localTargetOutputRect: rectForOutput(targetOutputGeometry,
                                                                 targetOutputGeometry)
    readonly property rect animatedRect: interpolatedRect(safeSourceRect, localTargetRect,
                                                          boundedProgress)
    readonly property rect animatedDesktopRect: interpolatedRect(safeDesktopSourceRect,
                                                                  localTargetOutputRect,
                                                                  boundedProgress)
    readonly property bool desktopBridgeContextExact: desktopBridgeContextIsExact()
    readonly property int desktopBridgeLoaderStatus: desktopBridgeLoader.status
    readonly property var desktopBridgeItem: desktopBridgeLoaderStatus === Loader.Ready
        && objectAvailable(desktopBridgeLoader.item) ? desktopBridgeLoader.item : null
    readonly property bool desktopBridgeReady: desktopBridgeTwoFrameLatch
        && desktopBridgeReadyFrameCount >= 2 && desktopBridgeLoaderStatus === Loader.Ready
        && desktopBridgeAcceptedItem === desktopBridgeItem
        && desktopBridgeItemIsExact(desktopBridgeItem)
    readonly property real revealOpacity: boundedUnit(boundedProgress / 0.16)
    readonly property real desktopBridgeOpacity: desktopBridgeReady
        ? boundedUnit(desktopBridgeBlend) : 0
    readonly property real surfaceOpacity: terminalCoverageMode === "canvas"
        || desktopBridgeOpacity < 1 ? 1 : 0
    readonly property real chromeOpacity: 1 - boundedProgress
    readonly property real thumbnailOpacity: revealOpacity
    readonly property real fallbackOpacity: revealOpacity * (1 - boundedProgress)
    readonly property real windowOverlayOpacity: visualMode === "thumbnail"
        ? thumbnailOpacity : visualMode === "monochrome" ? fallbackOpacity : 0
    readonly property bool terminalCoverageOpaque: terminalCoverageMode === "canvas"
        ? surfaceOpacity >= 1 && desktopBridgeOpacity <= 0
        : terminalCoverageMode === "bridge" && desktopBridgeReady
          && desktopBridgeOpacity >= 1 && surfaceOpacity <= 0
    property string committedHandoffKey: ""
    property string committedVisualMode: "none"
    property bool visualModeCommitted: false
    property bool completionReported: false
    property string preloadTrackedHandoffKey: ""
    property string preloadTrackedOutput: ""
    property var preloadTrackedCandidate: null
    property rect preloadTrackedSourceRect: Qt.rect(0, 0, 0, 0)
    property bool preloadTrackedLoaderActive: false
    property int preloadTrackedLoaderStatus: Loader.Null
    property var preloadTrackedLoaderItem: null
    property int preloadReadyFrameCount: 0
    property bool preloadTwoFrameLatch: false
    property var preloadTrackedPromotion: null
    property int preloadPromotedFrameCount: 0
    property bool preloadPromotionInheritedLatch: false
    property string desktopBridgeTrackedHandoffKey: ""
    property string desktopBridgeTrackedActivityId: ""
    property var desktopBridgeTrackedDesktop: null
    property string desktopBridgeTrackedDesktopId: ""
    property string desktopBridgeTrackedOutput: ""
    property var desktopBridgeTrackedScreen: null
    property var desktopBridgeTrackedItem: null
    property var desktopBridgeAcceptedItem: null
    property int desktopBridgeReadyFrameCount: 0
    property bool desktopBridgeTwoFrameLatch: false
    property real desktopBridgeBlend: 0
    property string terminalCoverageMode: "none"

    visible: handoffActive && capturedOutputExact
        && (preloadStagingVisible || (visualModeCommitted && resolvedOutputExact))
    enabled: false
    clip: false

    function objectAvailable(value) {
        return value !== null && value !== undefined;
    }

    function boundedUnit(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 0;
        }

        return Math.max(0, Math.min(1, numeric));
    }

    function finiteNumber(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : Number.NaN;
    }

    function rectIsUsable(rect) {
        return objectAvailable(rect) && Number.isFinite(finiteNumber(rect.x))
                && Number.isFinite(finiteNumber(rect.y))
                && Number.isFinite(finiteNumber(rect.width))
                && Number.isFinite(finiteNumber(rect.height))
                && finiteNumber(rect.width) > 0 && finiteNumber(rect.height) > 0;
    }

    function rectsMatch(first, second) {
        if (!rectIsUsable(first) || !rectIsUsable(second)) {
            return false;
        }

        return Math.abs(finiteNumber(first.x) - finiteNumber(second.x)) <= 2
                && Math.abs(finiteNumber(first.y) - finiteNumber(second.y)) <= 2
                && Math.abs(finiteNumber(first.width) - finiteNumber(second.width)) <= 2
                && Math.abs(finiteNumber(first.height) - finiteNumber(second.height)) <= 2;
    }

    function rectsEqual(first, second) {
        return rectIsUsable(first) && rectIsUsable(second)
            && finiteNumber(first.x) === finiteNumber(second.x)
            && finiteNumber(first.y) === finiteNumber(second.y)
            && finiteNumber(first.width) === finiteNumber(second.width)
            && finiteNumber(first.height) === finiteNumber(second.height);
    }

    function cameraIsUsable(camera) {
        return objectAvailable(camera)
            && Number.isFinite(finiteNumber(camera.offsetX))
            && Number.isFinite(finiteNumber(camera.offsetY))
            && Number.isFinite(finiteNumber(camera.zoom))
            && finiteNumber(camera.zoom) > 0;
    }

    function camerasEqual(first, second) {
        return cameraIsUsable(first) && cameraIsUsable(second)
            && finiteNumber(first.offsetX) === finiteNumber(second.offsetX)
            && finiteNumber(first.offsetY) === finiteNumber(second.offsetY)
            && finiteNumber(first.zoom) === finiteNumber(second.zoom);
    }

    function frozenRecord(value) {
        return objectAvailable(value) && typeof value === "object"
            && !Array.isArray(value) && Object.isFrozen(value);
    }

    function rectValue(rect) {
        if (!rectIsUsable(rect)) {
            return Qt.rect(0, 0, 0, 0);
        }

        return Qt.rect(finiteNumber(rect.x), finiteNumber(rect.y),
                       finiteNumber(rect.width), finiteNumber(rect.height));
    }

    function rectForOutput(globalRect, outputGeometry) {
        if (!rectIsUsable(globalRect) || !rectIsUsable(outputGeometry)) {
            return Qt.rect(0, 0, 0, 0);
        }

        return Qt.rect(finiteNumber(globalRect.x) - finiteNumber(outputGeometry.x),
                       finiteNumber(globalRect.y) - finiteNumber(outputGeometry.y),
                       finiteNumber(globalRect.width), finiteNumber(globalRect.height));
    }

    function interpolatedRect(first, second, amount) {
        if (!rectIsUsable(first)) {
            return Qt.rect(0, 0, Math.max(1, width), Math.max(1, height));
        }
        if (!rectIsUsable(second)) {
            return Qt.rect(first.x, first.y, first.width, first.height);
        }

        const bounded = boundedUnit(amount);
        return Qt.rect(finiteNumber(first.x)
                       + (finiteNumber(second.x) - finiteNumber(first.x)) * bounded,
                       finiteNumber(first.y)
                       + (finiteNumber(second.y) - finiteNumber(first.y)) * bounded,
                       Math.max(1, finiteNumber(first.width)
                                + (finiteNumber(second.width) - finiteNumber(first.width)) * bounded),
                       Math.max(1, finiteNumber(first.height)
                                + (finiteNumber(second.height) - finiteNumber(first.height)) * bounded));
    }

    function validatedHandoffKind() {
        if (!objectAvailable(handoff)) {
            return "stale";
        }

        try {
            if (handoff.targetKind === "window") {
                return "window";
            }
            if (handoff.targetKind === "desktop-fallback") {
                return "desktop";
            }
        } catch (error) {
            return "stale";
        }

        return "stale";
    }

    function validatedHandoffWindowId() {
        if (handoffKind !== "window" || !objectAvailable(handoff)) {
            return "";
        }

        try {
            if (handoff.targetWindowId === undefined || handoff.targetWindowId === null) {
                return "";
            }

            return String(handoff.targetWindowId);
        } catch (error) {
            return "";
        }
    }

    function validatedDesktopSourceRect() {
        if (handoffKey.length === 0) {
            return safeSourceRect;
        }

        try {
            return rectValue(handoff.desktopSourceRect);
        } catch (error) {
            return safeSourceRect;
        }
    }

    function validatedHandoffKey() {
        if (!objectAvailable(handoff) || capturedOutput.length === 0) {
            return "";
        }

        try {
            if (!frozenRecord(handoff) || !frozenRecord(handoff.camera)
                    || !frozenRecord(handoff.desktopSourceRect)
                    || !frozenRecord(handoff.sourceRect)
                    || !frozenRecord(handoff.targetFrame)) {
                return "";
            }
            const sessionId = Number(handoff.sessionId);
            const generation = Number(handoff.generation);
            const token = Number(handoff.token);
            const sourceDesktopId = String(handoff.sourceDesktopId);
            const sourceOutputId = String(handoff.sourceOutputId);
            const targetDesktopId = String(handoff.targetDesktopId);
            const targetOutputId = String(handoff.targetOutputId);
            const targetKind = String(handoff.targetKind);
            const targetMinimized = handoff.targetMinimized;
            const targetWindowId = handoff.targetWindowId === undefined
                || handoff.targetWindowId === null ? "" : String(handoff.targetWindowId);
            if (!Number.isInteger(sessionId) || sessionId <= 0
                    || !Number.isInteger(generation) || generation <= 0
                    || !Number.isInteger(token) || token <= 0
                    || sourceDesktopId.length === 0 || sourceOutputId.length === 0
                    || targetDesktopId.length === 0 || targetOutputId.length === 0
                    || targetOutputId !== capturedOutput
                    || (handoff.desktopRelation !== "same-desktop"
                        && handoff.desktopRelation !== "cross-desktop")
                    || handoff.desktopRelation !== (sourceDesktopId === targetDesktopId
                        ? "same-desktop" : "cross-desktop")
                    || (targetKind !== "window" && targetKind !== "desktop-fallback")
                    || typeof targetMinimized !== "boolean"
                    || (targetKind === "window" && targetWindowId.length === 0)
                    || (targetKind === "desktop-fallback" && targetWindowId.length > 0)
                    || (targetKind === "desktop-fallback" && targetMinimized)
                    || !cameraIsUsable(handoff.camera)
                    || !rectIsUsable(handoff.desktopSourceRect)
                    || !rectIsUsable(handoff.sourceRect)
                    || !rectIsUsable(handoff.targetFrame)) {
                return "";
            }

            return JSON.stringify([sessionId, generation, token, sourceDesktopId,
                                   sourceOutputId, targetDesktopId, targetOutputId,
                                   targetKind, targetWindowId, handoff.desktopRelation,
                                   handoff.camera.offsetX, handoff.camera.offsetY,
                                   handoff.camera.zoom, handoff.desktopSourceRect.x,
                                   handoff.desktopSourceRect.y,
                                   handoff.desktopSourceRect.width,
                                   handoff.desktopSourceRect.height, handoff.sourceRect.x,
                                   handoff.sourceRect.y, handoff.sourceRect.width,
                                   handoff.sourceRect.height]);
        } catch (error) {
            return "";
        }
    }

    function promotionMatchesHandoff() {
        if (handoffPhase !== "promoted" || handoffKey.length === 0
                || handoffKind !== "window" || !objectAvailable(promotion)) {
            return false;
        }

        try {
            if (!frozenRecord(promotion) || !frozenRecord(promotion.camera)
                    || !frozenRecord(promotion.desktopSourceRect)
                    || !frozenRecord(promotion.sourceRect)
                    || !frozenRecord(promotion.targetFrame)) {
                return false;
            }
            return promotion === handoff
                && Number(promotion.sessionId) === Number(handoff.sessionId)
                && Number(promotion.generation) === Number(handoff.generation)
                && Number(promotion.token) === Number(handoff.token)
                && String(promotion.sourceDesktopId) === String(handoff.sourceDesktopId)
                && String(promotion.sourceOutputId) === String(handoff.sourceOutputId)
                && String(promotion.targetDesktopId) === String(handoff.targetDesktopId)
                && String(promotion.targetOutputId) === capturedOutput
                && String(promotion.targetOutputId) === String(handoff.targetOutputId)
                && promotion.desktopRelation === handoff.desktopRelation
                && promotion.targetKind === "window"
                && promotion.targetKind === handoff.targetKind
                && promotion.targetMinimized === false
                && handoff.targetMinimized === false
                && promotion.targetWindowId !== undefined
                && promotion.targetWindowId !== null
                && String(promotion.targetWindowId) === handoffWindowId
                && String(promotion.targetWindowId) === String(handoff.targetWindowId)
                && camerasEqual(promotion.camera, handoff.camera)
                && rectsEqual(promotion.desktopSourceRect, handoff.desktopSourceRect)
                && rectsEqual(promotion.sourceRect, handoff.sourceRect)
                && rectsEqual(promotion.targetFrame, handoff.targetFrame);
        } catch (error) {
            return false;
        }
    }

    function validatedPromotedOutput() {
        if (!promotionExact) {
            return "";
        }

        try {
            return String(promotion.targetOutputId);
        } catch (error) {
            return "";
        }
    }

    function validatedTargetRect() {
        if (promotionExact) {
            try {
                return rectValue(promotion.targetFrame);
            } catch (error) {
                return Qt.rect(0, 0, 0, 0);
            }
        }
        if (handoffKey.length === 0) {
            return Qt.rect(0, 0, 0, 0);
        }

        try {
            return rectValue(handoff.targetFrame);
        } catch (error) {
            return Qt.rect(0, 0, 0, 0);
        }
    }

    function preloadCandidateIsExact() {
        if ((handoffPhase !== "captured" && handoffPhase !== "promoted")
                || !capturedOutputExact || handoffKind !== "window"
                || handoffWindowId.length === 0 || !objectAvailable(windowCandidate)) {
            return false;
        }

        try {
            return windowCandidate.deleted !== true
                && windowCandidate.internalId !== undefined
                && windowCandidate.internalId !== null
                && String(windowCandidate.internalId) === handoffWindowId;
        } catch (error) {
            return false;
        }
    }

    function promotedCandidateIsExact() {
        if (!promotionExact || !promotedOutputExact || !preloadWindowCandidateExact
                || !rectIsUsable(sourceRect) || !rectIsUsable(targetRect)
                || !rectIsUsable(targetOutputGeometry)) {
            return false;
        }

        try {
            return windowCandidate.minimized !== true
                && rectsMatch(windowCandidate.frameGeometry, targetRect);
        } catch (error) {
            return false;
        }
    }

    function desktopBridgeContextIsExact() {
        try {
            if (!handoffActive || !capturedOutputExact || handoffKey.length === 0
                    || !objectAvailable(targetDesktop) || targetDesktop.id === undefined
                    || targetDesktop.id === null || String(targetDesktop.id) !== targetDesktopId
                    || targetDesktopId.length === 0 || !objectAvailable(targetScreen)
                    || targetScreen.name === undefined || targetScreen.name === null
                    || targetActivityId.length === 0 || activeOutput.length === 0
                    || KWin.Workspace.currentActivity === undefined
                    || KWin.Workspace.currentActivity === null
                    || String(KWin.Workspace.currentActivity) !== targetActivityId) {
                return false;
            }
            if (String(handoff.targetDesktopId) !== targetDesktopId) {
                return false;
            }

            let desktopMatches = 0;
            let desktopIdMatches = 0;
            for (const liveDesktop of KWin.Workspace.desktops) {
                if (String(liveDesktop.id) === targetDesktopId) {
                    desktopIdMatches += 1;
                    if (liveDesktop === targetDesktop) {
                        desktopMatches += 1;
                    }
                }
            }
            if (desktopMatches !== 1 || desktopIdMatches !== 1) {
                return false;
            }

            let activityMatches = 0;
            for (const liveActivityId of KWin.Workspace.activities) {
                if (String(liveActivityId) === targetActivityId) {
                    activityMatches += 1;
                }
            }
            if (activityMatches !== 1) {
                return false;
            }

            let screenMatches = 0;
            for (const liveScreen of KWin.Workspace.screens) {
                if (liveScreen === targetScreen
                        && String(liveScreen.name) === String(targetScreen.name)) {
                    screenMatches += 1;
                }
            }
            return screenMatches === 1;
        } catch (error) {
            return false;
        }
    }

    function desktopBridgeItemIsExact(candidate) {
        try {
            return objectAvailable(candidate) && candidate.driftileContextCaptured === true
                && desktopBridgeContextExact
                && candidate.driftileHandoffKey === handoffKey
                && candidate.driftileActivityId === targetActivityId
                && candidate.driftileDesktop === targetDesktop
                && candidate.driftileDesktopId === targetDesktopId
                && candidate.driftileScreen === targetScreen
                && candidate.driftileScreenName === String(targetScreen.name)
                && candidate.driftileOutputId === activeOutput;
        } catch (error) {
            return false;
        }
    }

    function resetDesktopBridgeTracking() {
        desktopBridgeTrackedHandoffKey = "";
        desktopBridgeTrackedActivityId = "";
        desktopBridgeTrackedDesktop = null;
        desktopBridgeTrackedDesktopId = "";
        desktopBridgeTrackedOutput = "";
        desktopBridgeTrackedScreen = null;
        desktopBridgeTrackedItem = null;
        desktopBridgeReadyFrameCount = 0;
        desktopBridgeTwoFrameLatch = false;
    }

    function invalidateDesktopBridge() {
        desktopBridgeAcceptedItem = null;
        resetDesktopBridgeTracking();
        return true;
    }

    function acceptDesktopBridgeCandidate(candidate) {
        if (!desktopBridgeItemIsExact(candidate)) {
            return false;
        }

        desktopBridgeAcceptedItem = candidate;
        resetDesktopBridgeTracking();
        return true;
    }

    function desktopBridgeIdentityIsTracked() {
        return handoffActive && capturedOutputExact && handoffKey.length > 0
            && desktopBridgeContextExact && desktopBridgeLoaderStatus === Loader.Ready
            && desktopBridgeTrackedHandoffKey === handoffKey
            && desktopBridgeTrackedActivityId === targetActivityId
            && desktopBridgeTrackedDesktop === targetDesktop
            && desktopBridgeTrackedDesktopId === targetDesktopId
            && desktopBridgeTrackedOutput === activeOutput
            && desktopBridgeTrackedScreen === targetScreen
            && desktopBridgeTrackedItem === desktopBridgeItem
            && desktopBridgeAcceptedItem === desktopBridgeItem
            && desktopBridgeItemIsExact(desktopBridgeItem);
    }

    function beginDesktopBridgeTracking() {
        if (!handoffActive || !capturedOutputExact || handoffKey.length === 0
                || !desktopBridgeContextExact || desktopBridgeLoaderStatus !== Loader.Ready
                || desktopBridgeAcceptedItem !== desktopBridgeItem
                || !desktopBridgeItemIsExact(desktopBridgeItem)) {
            resetDesktopBridgeTracking();
            return false;
        }

        desktopBridgeTrackedHandoffKey = handoffKey;
        desktopBridgeTrackedActivityId = targetActivityId;
        desktopBridgeTrackedDesktop = targetDesktop;
        desktopBridgeTrackedDesktopId = targetDesktopId;
        desktopBridgeTrackedOutput = activeOutput;
        desktopBridgeTrackedScreen = targetScreen;
        desktopBridgeTrackedItem = desktopBridgeItem;
        desktopBridgeReadyFrameCount = 0;
        desktopBridgeTwoFrameLatch = false;
        return true;
    }

    function advanceDesktopBridgeFrame() {
        if (!desktopBridgeIdentityIsTracked() && !beginDesktopBridgeTracking()) {
            return false;
        }

        desktopBridgeReadyFrameCount = Math.min(2, desktopBridgeReadyFrameCount + 1);
        desktopBridgeTwoFrameLatch = desktopBridgeReadyFrameCount >= 2;
        return desktopBridgeTwoFrameLatch;
    }

    function startDesktopBridgeFadeIfEligible() {
        if (!desktopBridgeReady || !resolvedOutputExact
                || terminalCoverageMode === "canvas") {
            return false;
        }
        if (desktopBridgeBlend >= 1 || desktopBridgeFadeIn.running) {
            return true;
        }

        desktopBridgeFadeIn.restart();
        return true;
    }

    function synchronizeTerminalCoverageMode() {
        if (boundedProgress < 1) {
            terminalCoverageMode = "none";
            return true;
        }
        if (terminalCoverageMode !== "none") {
            return true;
        }
        if (desktopBridgeReady) {
            terminalCoverageMode = "bridge";
            startDesktopBridgeFadeIfEligible();
            return true;
        }

        desktopBridgeFadeIn.stop();
        desktopBridgeBlend = 0;
        terminalCoverageMode = "canvas";
        return true;
    }

    function handleDesktopBridgeReadyChange() {
        if (desktopBridgeReady) {
            return startDesktopBridgeFadeIfEligible();
        }

        desktopBridgeFadeIn.stop();
        desktopBridgeBlend = 0;
        if (terminalCoverageMode === "bridge") {
            terminalCoverageMode = "canvas";
        }
        return true;
    }

    function preloadIdentityIsUsable() {
        return preloadStagingVisible && handoffKey.length > 0
            && activeOutput === capturedOutput
            && rectsEqual(sourceRect, handoff.sourceRect);
    }

    function preloadIdentityIsTracked() {
        return preloadIdentityIsUsable()
            && preloadTrackedHandoffKey === handoffKey
            && preloadTrackedOutput === capturedOutput
            && preloadTrackedCandidate === windowCandidate
            && rectsEqual(preloadTrackedSourceRect, sourceRect)
            && preloadTrackedLoaderActive === exitThumbnailLoader.active
            && preloadTrackedLoaderStatus === liveThumbnailLoaderStatus
            && preloadTrackedLoaderItem === liveThumbnailItem;
    }

    function preloadLatchIsExact() {
        return preloadTwoFrameLatch && preloadReadyFrameCount >= 2
            && liveThumbnailReady && preloadIdentityIsTracked();
    }

    function resetPreloadTracking() {
        preloadTrackedHandoffKey = "";
        preloadTrackedOutput = "";
        preloadTrackedCandidate = null;
        preloadTrackedSourceRect = Qt.rect(0, 0, 0, 0);
        preloadTrackedLoaderActive = false;
        preloadTrackedLoaderStatus = Loader.Null;
        preloadTrackedLoaderItem = null;
        preloadReadyFrameCount = 0;
        preloadTwoFrameLatch = false;
        preloadTrackedPromotion = null;
        preloadPromotedFrameCount = 0;
        preloadPromotionInheritedLatch = false;
    }

    function beginCurrentPreloadIdentity() {
        if (!preloadIdentityIsUsable()) {
            resetPreloadTracking();
            return false;
        }

        preloadTrackedHandoffKey = handoffKey;
        preloadTrackedOutput = capturedOutput;
        preloadTrackedCandidate = windowCandidate;
        preloadTrackedSourceRect = rectValue(sourceRect);
        preloadTrackedLoaderActive = exitThumbnailLoader.active;
        preloadTrackedLoaderStatus = liveThumbnailLoaderStatus;
        preloadTrackedLoaderItem = liveThumbnailItem;
        preloadReadyFrameCount = 0;
        preloadTwoFrameLatch = false;
        preloadTrackedPromotion = null;
        preloadPromotedFrameCount = 0;
        preloadPromotionInheritedLatch = false;
        return true;
    }

    function synchronizePromotionResolution() {
        if (handoffPhase !== "promoted") {
            preloadTrackedPromotion = null;
            preloadPromotedFrameCount = 0;
            preloadPromotionInheritedLatch = false;
            return false;
        }
        if (preloadTrackedPromotion !== promotion) {
            preloadTrackedPromotion = promotion;
            preloadPromotedFrameCount = 0;
            preloadPromotionInheritedLatch = promotionExact
                && promotedOutputExact && exactWindowCandidate
                && preloadLatchIsExact();
        }
        return promotionExact && promotedOutputExact && exactWindowCandidate;
    }

    function handlePreloadIdentityChange() {
        if (!preloadIdentityIsUsable()) {
            resetPreloadTracking();
        } else if (preloadTrackedHandoffKey.length > 0
                   && !preloadIdentityIsTracked()) {
            resetPreloadTracking();
        }
        synchronizePromotionResolution();
        synchronizeVisualMode();
    }

    function advancePreloadFrame() {
        if (!preloadIdentityIsUsable()) {
            resetPreloadTracking();
            synchronizeVisualMode();
            return false;
        }
        if (!preloadIdentityIsTracked() && !beginCurrentPreloadIdentity()) {
            synchronizeVisualMode();
            return false;
        }

        // Capture whether the promotion inherited a completed preload before
        // this rendered frame can advance the latch.
        const promotionResolved = synchronizePromotionResolution();

        if (liveThumbnailReady) {
            preloadReadyFrameCount = Math.min(2, preloadReadyFrameCount + 1);
            preloadTwoFrameLatch = preloadReadyFrameCount >= 2;
        } else {
            preloadReadyFrameCount = 0;
            preloadTwoFrameLatch = false;
        }

        if (handoffPhase !== "promoted") {
            return true;
        }

        preloadPromotedFrameCount = Math.min(2, preloadPromotedFrameCount + 1);
        if (preloadPromotedFrameCount < 2 || visualModeCommitted) {
            return true;
        }

        const nextMode = !promotionResolved ? "desktop"
            : liveThumbnailReady && preloadIdentityIsTracked()
              ? "thumbnail" : "monochrome";
        return commitVisualMode(nextMode);
    }

    function planInitialVisualMode() {
        if (fallbackOutputExact) {
            return "desktop";
        }
        if (handoffPhase !== "promoted") {
            return "";
        }

        const promotionResolved = synchronizePromotionResolution();
        return promotionResolved && preloadPromotionInheritedLatch
            && preloadLatchIsExact()
            ? "thumbnail" : "";
    }

    function planDowngradedVisualMode(currentMode) {
        if (currentMode === "desktop") {
            return currentMode;
        }
        if (fallbackOutputExact || !promotedOutputExact || !exactWindowCandidate) {
            return "desktop";
        }
        if (currentMode === "thumbnail" && !liveThumbnailReady) {
            return "monochrome";
        }

        return currentMode;
    }

    function resetCommittedVisualMode(nextHandoffKey) {
        committedHandoffKey = nextHandoffKey;
        committedVisualMode = "none";
        visualModeCommitted = false;
        completionReported = false;
    }

    function commitVisualMode(nextMode) {
        if (nextMode !== "thumbnail" && nextMode !== "monochrome"
                && nextMode !== "desktop") {
            return false;
        }

        committedVisualMode = nextMode;
        visualModeCommitted = true;
        return true;
    }

    function synchronizeVisualMode() {
        const nextHandoffKey = handoffKey;
        if (!handoffActive || nextHandoffKey.length === 0) {
            if (committedHandoffKey.length > 0 || visualModeCommitted
                    || committedVisualMode !== "none" || completionReported) {
                resetCommittedVisualMode("");
            }
            return;
        }
        if (committedHandoffKey !== nextHandoffKey) {
            resetCommittedVisualMode(nextHandoffKey);
        }

        if (!visualModeCommitted) {
            const initialMode = planInitialVisualMode();
            if (initialMode.length > 0) {
                commitVisualMode(initialMode);
            }
            return;
        }

        const downgradedMode = planDowngradedVisualMode(committedVisualMode);
        if (downgradedMode !== committedVisualMode) {
            committedVisualMode = downgradedMode;
        }
    }

    function updateCompletion() {
        if (completionReported || !handoffActive || !visualModeCommitted
                || !resolvedOutputExact || boundedProgress < 1) {
            return;
        }

        completionReported = true;
        handoffCompleted(handoff, visualMode);
    }

    onHandoffKeyChanged: {
        invalidateDesktopBridge();
        handlePreloadIdentityChange();
    }
    onHandoffPhaseChanged: handlePreloadIdentityChange()
    onPromotionChanged: handlePreloadIdentityChange()
    onWindowCandidateChanged: handlePreloadIdentityChange()
    onHandoffActiveChanged: {
        invalidateDesktopBridge();
        handlePreloadIdentityChange();
    }
    onActiveOutputChanged: {
        invalidateDesktopBridge();
        handlePreloadIdentityChange();
    }
    onCapturedOutputChanged: {
        invalidateDesktopBridge();
        handlePreloadIdentityChange();
    }
    onCapturedOutputExactChanged: handlePreloadIdentityChange()
    onSourceRectChanged: handlePreloadIdentityChange()
    onPreloadStagingVisibleChanged: handlePreloadIdentityChange()
    onPromotedOutputExactChanged: {
        synchronizeVisualMode();
        startDesktopBridgeFadeIfEligible();
    }
    onFallbackOutputExactChanged: {
        synchronizeVisualMode();
        startDesktopBridgeFadeIfEligible();
    }
    onExactWindowCandidateChanged: synchronizeVisualMode()
    onLiveThumbnailLoaderStatusChanged: handlePreloadIdentityChange()
    onLiveThumbnailItemChanged: handlePreloadIdentityChange()
    onLiveThumbnailReadyChanged: handlePreloadIdentityChange()
    onTargetActivityIdChanged: invalidateDesktopBridge()
    onTargetDesktopChanged: invalidateDesktopBridge()
    onTargetDesktopIdChanged: invalidateDesktopBridge()
    onTargetScreenChanged: invalidateDesktopBridge()
    onDesktopBridgeContextExactChanged: invalidateDesktopBridge()
    onDesktopBridgeItemChanged: invalidateDesktopBridge()
    onDesktopBridgeReadyChanged: handleDesktopBridgeReadyChange()
    onBoundedProgressChanged: {
        synchronizeTerminalCoverageMode();
        updateCompletion();
    }
    onVisualModeCommittedChanged: updateCompletion()
    onResolvedOutputExactChanged: updateCompletion()
    Component.onCompleted: handlePreloadIdentityChange()

    FrameAnimation {
        running: root.preloadStagingVisible
        onTriggered: root.advancePreloadFrame()
    }

    FrameAnimation {
        running: root.handoffActive && !root.desktopBridgeTwoFrameLatch
        onTriggered: root.advanceDesktopBridgeFrame()
    }

    NumberAnimation {
        id: desktopBridgeFadeIn

        target: root
        property: "desktopBridgeBlend"
        from: 0
        to: 1
        duration: 90
        easing.type: Easing.OutCubic
    }

    Item {
        id: desktopBridgeShell

        x: root.animatedDesktopRect.x
        y: root.animatedDesktopRect.y
        width: root.animatedDesktopRect.width
        height: root.animatedDesktopRect.height
        visible: root.handoffActive && root.capturedOutputExact
            && root.desktopBridgeLoaderStatus === Loader.Ready
            && root.desktopBridgeAcceptedItem === root.desktopBridgeItem
            && root.desktopBridgeItemIsExact(root.desktopBridgeItem)
            && root.terminalCoverageMode !== "canvas"
        opacity: root.resolvedOutputExact
            ? Math.max(0.001, root.desktopBridgeOpacity) : 0.001
        enabled: false
        clip: true
        z: -10

        Loader {
            id: desktopBridgeLoader

            anchors.fill: parent
            active: root.handoffActive && root.capturedOutputExact
                && root.desktopBridgeContextExact
            asynchronous: true
            enabled: false

            onActiveChanged: {
                if (!active) {
                    root.invalidateDesktopBridge();
                }
            }
            onLoaded: root.acceptDesktopBridgeCandidate(desktopBridgeLoader.item)
            onStatusChanged: {
                if (status !== Loader.Ready) {
                    root.invalidateDesktopBridge();
                }
            }

            sourceComponent: Component {
                KWin.DesktopBackground {
                    id: desktopBackground

                    property bool driftileContextCaptured: false
                    property string driftileHandoffKey: root.handoffKey
                    property string driftileActivityId: root.targetActivityId
                    property var driftileDesktop: root.targetDesktop
                    property string driftileDesktopId: root.targetDesktopId
                    property var driftileScreen: root.targetScreen
                    property string driftileScreenName: root.targetScreen
                        && root.targetScreen.name !== undefined
                        && root.targetScreen.name !== null ? String(root.targetScreen.name) : ""
                    property string driftileOutputId: root.activeOutput

                    anchors.fill: parent
                    output: driftileScreen
                    desktop: driftileDesktop
                    activity: driftileActivityId
                    enabled: false

                    Component.onCompleted: {
                        driftileHandoffKey = root.handoffKey;
                        driftileActivityId = root.targetActivityId;
                        driftileDesktop = root.targetDesktop;
                        driftileDesktopId = root.targetDesktopId;
                        driftileScreen = root.targetScreen;
                        driftileScreenName = root.targetScreen
                            && root.targetScreen.name !== undefined
                            && root.targetScreen.name !== null
                            ? String(root.targetScreen.name) : "";
                        driftileOutputId = root.activeOutput;
                        driftileContextCaptured = true;
                        root.acceptDesktopBridgeCandidate(desktopBackground);
                    }
                }
            }
        }
    }

    Item {
        id: windowHandoffShell

        x: root.animatedRect.x
        y: root.animatedRect.y
        width: root.animatedRect.width
        height: root.animatedRect.height
        visible: root.preloadStagingVisible || root.visualMode === "thumbnail"
            || root.visualMode === "monochrome"
        opacity: root.preloadStagingVisible ? 0.001 : root.windowOverlayOpacity
        clip: true
        z: 10

        Rectangle {
            anchors.fill: parent
            color: "#202936"
        }

        Loader {
            id: exitThumbnailLoader

            anchors.fill: parent
            active: root.handoffActive && root.liveThumbnailEligible
                && (!root.visualModeCommitted || root.visualMode === "thumbnail")
            asynchronous: true

            sourceComponent: Component {
                KWin.WindowThumbnail {
                    anchors.fill: parent
                    wId: root.handoffWindowId
                }
            }
        }
    }

}
