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
        location: root.runtimeDirectory + "/driftile-overview-workspace-command.ini"
    }

    readonly property KWin.DBusCall applyCommandCall: KWin.DBusCall {
        service: "org.kde.kglobalaccel"
        path: "/component/kwin"
        dbusInterface: "org.kde.kglobalaccel.Component"
        method: "invokeShortcut"
    }

    Component.onCompleted: root.clearCommandOnStartup()

    function submitWorkspaceCommand(context, action) {
        try {
            const runtime = OverviewRuntime.DriftileOverview;
            const createdAt = Date.now();
            if (root.runtimeDirectory.length === 0
                    || !runtime
                    || typeof runtime.encodeOverviewWorkspaceCommand !== "function"
                    || !Number.isSafeInteger(createdAt)
                    || createdAt < 0
                    || Object.is(createdAt, -0)
                    || !commandChannelIsAvailable()) {
                return false;
            }

            const requestId = reserveNextRequestId();
            if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId > maximumRequestId) {
                return false;
            }
            const document = runtime.encodeOverviewWorkspaceCommand({
                action,
                activityId: context ? context.activityId : undefined,
                createdAt,
                desktopIds: context ? context.desktopIds : undefined,
                format: "driftile-overview-workspace-command",
                outputId: context ? context.outputId : undefined,
                requestId,
                version: 1
            });
            if (typeof document !== "string" || document.length === 0) {
                return false;
            }

            commandSettings.setValue(commandKey, document);
            commandSettings.sync();
            const storedDocument = commandSettings.value(commandKey, "");
            if (typeof storedDocument !== "string" || storedDocument !== document) {
                clearCommandIfExact(document);
                return false;
            }

            applyCommandCall.arguments = ["driftile_apply_overview_workspace_command"];
            try {
                applyCommandCall.call();
            } catch (error) {
                clearCommandIfExact(document);
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    function commandChannelIsAvailable() {
        try {
            commandSettings.sync();
            const document = commandSettings.value(commandKey, "");
            return typeof document === "string" && document.length === 0;
        } catch (error) {
            return false;
        }
    }

    function clearCommandOnStartup() {
        try {
            commandSettings.setValue(commandKey, "");
            commandSettings.sync();
            return commandSettings.value(commandKey, "") === "";
        } catch (error) {
            return false;
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

    function clearCommandIfExact(expectedDocument) {
        try {
            commandSettings.sync();
            if (commandSettings.value(commandKey, "") !== expectedDocument) {
                return false;
            }
            commandSettings.setValue(commandKey, "");
            commandSettings.sync();
            return commandSettings.value(commandKey, "") === "";
        } catch (error) {
            return false;
        }
    }
}
