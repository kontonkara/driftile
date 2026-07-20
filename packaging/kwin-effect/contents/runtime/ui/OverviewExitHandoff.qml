pragma ComponentBehavior: Bound

import QtQuick
import org.kde.kwin as KWin

Item {
    id: root

    required property var handoff
    required property var windowCandidate
    required property string thumbnailSource
    required property rect sourceRect
    required property rect targetRect
    required property rect targetOutputGeometry
    required property real progress
    required property bool handoffActive
    required property string activeOutput
    required property string promotedOutput

    signal handoffCompleted(var immutableHandoff, string visualMode)

    readonly property real boundedProgress: boundedUnit(progress)
    readonly property real easedProgress: smoothstep(boundedProgress)
    readonly property string expectedOutput: promotedOutput
    readonly property bool outputPromoted: activeOutput.length > 0
        && activeOutput === expectedOutput
    readonly property string handoffKind: validatedHandoffKind()
    readonly property string handoffWindowId: validatedHandoffWindowId()
    readonly property bool exactWindowCandidate: windowCandidateIsExact()
    readonly property bool liveThumbnailEligible: exactWindowCandidate
        && thumbnailSource.length > 0 && thumbnailSource === handoffWindowId
    readonly property bool liveThumbnailReady: liveThumbnailEligible
        && exitThumbnailLoader.status === Loader.Ready
        && objectAvailable(exitThumbnailLoader.item)
    readonly property bool liveThumbnailPending: liveThumbnailEligible
        && exitThumbnailLoader.status !== Loader.Ready
        && exitThumbnailLoader.status !== Loader.Error
    readonly property string fallbackReason: plannedFallbackReason()
    readonly property string visualMode: liveThumbnailReady
        ? "thumbnail" : exactWindowCandidate ? "monochrome" : "row-fallback"
    readonly property rect safeSourceRect: rectIsUsable(sourceRect)
        ? sourceRect : Qt.rect(0, 0, Math.max(1, width), Math.max(1, height))
    readonly property rect localTargetRect: rectForOutput(targetRect, targetOutputGeometry)
    readonly property rect animatedRect: interpolatedRect(safeSourceRect, localTargetRect,
                                                          easedProgress)
    readonly property real chromeOpacity: 1 - boundedUnit(boundedProgress / 0.45)
    readonly property real surfaceOpacity: liveThumbnailPending
        ? 1 : 1 - easedProgress
    readonly property real windowOverlayOpacity:
        liveThumbnailPending ? 0
        : 1 - boundedUnit((boundedProgress - 0.84) / 0.16)
    readonly property real rowFallbackOpacity: surfaceOpacity
    readonly property real rowFallbackScale: 1 - 0.06 * easedProgress
    property bool completionReported: false

    visible: handoffActive && outputPromoted && boundedProgress < 1
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

    function smoothstep(value) {
        const bounded = boundedUnit(value);
        return bounded * bounded * (3 - 2 * bounded);
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

    function windowCandidateIsExact() {
        if (handoffKind !== "window" || handoffWindowId.length === 0
                || !rectIsUsable(sourceRect) || !rectIsUsable(targetRect)
                || !rectIsUsable(targetOutputGeometry)
                || !outputPromoted || !objectAvailable(windowCandidate)) {
            return false;
        }

        try {
            if (windowCandidate.deleted === true || windowCandidate.minimized === true
                    || windowCandidate.internalId === undefined
                    || windowCandidate.internalId === null
                    || String(windowCandidate.internalId) !== handoffWindowId
                    || !rectsMatch(windowCandidate.frameGeometry, targetRect)) {
                return false;
            }
        } catch (error) {
            return false;
        }

        return true;
    }

    function plannedFallbackReason() {
        if (handoffKind === "desktop") {
            return "desktop";
        }
        if (handoffKind !== "window" || handoffWindowId.length === 0) {
            return "stale-handoff";
        }
        if (!rectIsUsable(sourceRect) || !rectIsUsable(targetRect)
                || !rectIsUsable(targetOutputGeometry)) {
            return "stale-geometry";
        }
        if (!objectAvailable(windowCandidate)) {
            return "missing-candidate";
        }

        try {
            if (windowCandidate.deleted === true) {
                return "deleted-candidate";
            }
            if (windowCandidate.minimized === true) {
                return "minimized-candidate";
            }
            if (windowCandidate.internalId === undefined
                    || windowCandidate.internalId === null
                    || String(windowCandidate.internalId) !== handoffWindowId) {
                return "stale-window";
            }
            if (!outputPromoted) {
                return "stale-output";
            }
            if (!rectsMatch(windowCandidate.frameGeometry, targetRect)) {
                return "stale-frame";
            }
        } catch (error) {
            return "stale-candidate";
        }

        return liveThumbnailEligible ? "" : "missing-thumbnail-source";
    }

    function updateCompletion() {
        if (!handoffActive || boundedProgress < 1) {
            completionReported = false;
            return;
        }
        if (completionReported) {
            return;
        }

        completionReported = true;
        handoffCompleted(handoff, visualMode);
    }

    onBoundedProgressChanged: updateCompletion()
    onHandoffActiveChanged: updateCompletion()
    onHandoffChanged: completionReported = false
    Component.onCompleted: updateCompletion()

    Item {
        id: windowHandoffShell

        x: root.animatedRect.x
        y: root.animatedRect.y
        width: root.animatedRect.width
        height: root.animatedRect.height
        visible: root.visualMode !== "row-fallback"
        opacity: root.windowOverlayOpacity
        clip: true

        Rectangle {
            anchors.fill: parent
            color: "#202936"
        }

        Loader {
            id: exitThumbnailLoader

            anchors.fill: parent
            active: root.handoffActive && root.liveThumbnailEligible
            asynchronous: true

            sourceComponent: Component {
                KWin.WindowThumbnail {
                    anchors.fill: parent
                    wId: root.thumbnailSource
                }
            }
        }
    }

    Item {
        id: rowFallbackShell

        x: root.safeSourceRect.x
        y: root.safeSourceRect.y
        width: root.safeSourceRect.width
        height: root.safeSourceRect.height
        visible: root.visualMode === "row-fallback"
        opacity: root.rowFallbackOpacity
        scale: root.rowFallbackScale
        transformOrigin: Item.Center
        clip: true

        Rectangle {
            anchors.fill: parent
            color: "#202936"
        }
    }
}
