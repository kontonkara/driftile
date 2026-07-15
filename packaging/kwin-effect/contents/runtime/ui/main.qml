import QtCore
import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

QtObject {
    id: controller

    property bool active: false
    property bool loading: false
    property var overviewModel: null
    readonly property var overviewDelegate: Qt.createComponent("OverviewScene.qml")

    readonly property LayoutStateReader layoutStateReader: LayoutStateReader {
        onReady: document => controller.acceptLayoutState(document)
        onRejected: controller.rejectLayoutState("unstable-state")
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

        overviewModel = null;
        loading = true;
        layoutStateReader.sample();
    }

    function deactivate() {
        layoutStateReader.cancel();
        active = false;
        loading = false;
        overviewModel = null;
    }

    function acceptLayoutState(document) {
        if (!loading) {
            return;
        }

        try {
            const runtime = OverviewRuntime.DriftileOverview;
            if (!runtime || typeof runtime.loadOverviewModel !== "function") {
                rejectLayoutState("runtime-unavailable");
                return;
            }

            const result = runtime.loadOverviewModel(document, liveSnapshot());
            if (!result || result.ok !== true || !result.value) {
                rejectLayoutState(result && result.error ? String(result.error) : "invalid-model");
                return;
            }

            overviewModel = result.value;
            loading = false;
            active = true;
        } catch (error) {
            rejectLayoutState("runtime-error");
        }
    }

    function rejectLayoutState(reason) {
        deactivate();
        console.warn(`[driftile-overview] activation rejected reason=${reason}`);
    }

    function liveSnapshot() {
        const outputs = [];
        const desktopIds = [];
        const windowIds = [];

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
