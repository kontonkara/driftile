import QtCore
import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

QtObject {
    id: controller

    property bool active: false
    property bool loading: false
    property var overviewModel: null
    property int lastActivationAttemptId: 0
    property int pendingActivationAttemptId: 0
    readonly property var overviewDelegate: Qt.createComponent("OverviewScene.qml")

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

    function toggle() {
        if (active || loading) {
            deactivate();
        } else {
            activate();
        }
    }

    function activate() {
        if (active || loading) {
            return;
        }

        const attemptId = lastActivationAttemptId >= 2147483647
            ? 1
            : lastActivationAttemptId + 1;
        lastActivationAttemptId = attemptId;
        pendingActivationAttemptId = attemptId;
        overviewModel = null;
        loading = true;
        layoutStateReader.sample(attemptId);
    }

    function deactivate() {
        pendingActivationAttemptId = 0;
        layoutStateReader.cancel();
        active = false;
        loading = false;
        overviewModel = null;
    }

    function acceptLayoutState(attemptId, document) {
        if (!loading || active || attemptId <= 0 || attemptId !== pendingActivationAttemptId) {
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

            pendingActivationAttemptId = 0;
            overviewModel = result.value;
            loading = false;
            active = true;
        } catch (error) {
            rejectLayoutState(attemptId, "runtime-error");
        }
    }

    function rejectLayoutState(attemptId, reason) {
        if (!loading || active || attemptId <= 0 || attemptId !== pendingActivationAttemptId) {
            return;
        }

        deactivate();
        console.warn(`[driftile-overview] activation rejected reason=${reason}`);
        rejectionOsdCall.arguments = ["dialog-warning", "Could not open Driftile overview"];
        rejectionOsdCall.call();
    }

    function liveSnapshot() {
        const fallbackActivityId = "driftile-default-activity";
        const activityIds = [];
        const outputs = [];
        const desktopIds = [];
        const windowIds = [];
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
            windowIds.push(String(window.internalId));
        }

        return {
            activityIds,
            currentActivityId,
            desktopIds,
            outputs,
            windowIds
        };
    }

    function addOptionalIdentifier(target, key, value) {
        if (value !== undefined && value !== null && String(value).length > 0) {
            target[key] = String(value);
        }
    }
}
