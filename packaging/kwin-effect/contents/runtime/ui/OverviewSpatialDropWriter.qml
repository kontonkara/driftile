import QtCore
import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

QtObject {
    id: root

    readonly property double maximumRequestId: Number.MAX_SAFE_INTEGER
    readonly property string commandCategory: "Command"
    readonly property string commandKey: "request"
    readonly property string requestIdKey: "last-request-id"
    readonly property string runtimeDirectory: StandardPaths.writableLocation(StandardPaths.RuntimeLocation)

    readonly property Settings commandSettings: Settings {
        category: root.commandCategory
        location: root.runtimeDirectory + "/driftile-overview-command.ini"
    }

    readonly property KWin.DBusCall applyCommandCall: KWin.DBusCall {
        service: "org.kde.kglobalaccel"
        path: "/component/kwin"
        dbusInterface: "org.kde.kglobalaccel.Component"
        method: "invokeShortcut"
    }

    function submitSpatialDropCommand(source, target) {
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            const createdAt = Date.now();
            if (root.runtimeDirectory.length === 0
                    || !runtime
                    || typeof runtime.encodeSpatialDropCommand !== "function"
                    || !Number.isSafeInteger(createdAt)
                    || createdAt < 0) {
                return failSubmission();
            }

            const requestId = reserveNextRequestId();
            if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId > maximumRequestId) {
                return failSubmission();
            }
            const document = runtime.encodeSpatialDropCommand({
                createdAt,
                format: "driftile-spatial-drop",
                requestId,
                source,
                target,
                version: 2
            });
            if (typeof document !== "string" || document.length === 0) {
                return failSubmission();
            }

            commandSettings.setValue(commandKey, document);
            commandSettings.sync();
            const storedDocument = commandSettings.value(commandKey, "");
            if (typeof storedDocument !== "string" || storedDocument !== document) {
                return failSubmission();
            }

            applyCommandCall.arguments = ["driftile_apply_overview_spatial_drop"];
            applyCommandCall.call();
            return true;
        } catch (error) {
            return failSubmission();
        }
    }

    function reserveNextRequestId() {
        try {
            commandSettings.sync();
            const previous = commandSettings.value(requestIdKey, 0);
            if (typeof previous !== "number" || !Number.isSafeInteger(previous)
                    || previous < 0 || previous > maximumRequestId || Object.is(previous, -0)) {
                return null;
            }

            const requestId = previous >= 1 && previous < maximumRequestId ? previous + 1 : 1;
            commandSettings.setValue(requestIdKey, requestId);
            commandSettings.sync();
            const storedRequestId = commandSettings.value(requestIdKey, 0);
            return typeof storedRequestId === "number" && Number.isSafeInteger(storedRequestId)
                    && storedRequestId === requestId ? requestId : null;
        } catch (error) {
            return null;
        }
    }

    function failSubmission() {
        clearCommand();
        return false;
    }

    function clearCommand() {
        try {
            commandSettings.setValue(commandKey, "");
            commandSettings.sync();
        } catch (error) {
        }
    }
}
