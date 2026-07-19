import QtCore
import QtQuick
import org.kde.kwin
import "../code/main.js" as Runtime

QtObject {
    id: root

    property double lastConsumedRequestId: 0

    readonly property Settings commandSettings: Settings {
        category: "Command"
        location: StandardPaths.writableLocation(StandardPaths.RuntimeLocation)
                  + "/driftile-overview-command.ini"
    }

    readonly property ShortcutHandler applyShortcut: ShortcutHandler {
        name: "driftile_apply_overview_spatial_drop"
        text: "Driftile: Apply overview window placement"
        onActivated: root.consume()
    }

    function consume() {
        let document = "";

        try {
            commandSettings.sync();
            const stored = commandSettings.value("request", "");
            document = typeof stored === "string" ? stored : "";
            commandSettings.setValue("request", "");
            commandSettings.sync();
        } catch (error) {
            return false;
        }

        const runtime = Runtime.DriftileRuntime;
        if (!runtime || typeof runtime.applyOverviewSpatialDrop !== "function") {
            return false;
        }

        let result = null;
        try {
            result = runtime.applyOverviewSpatialDrop(document, Date.now(), lastConsumedRequestId);
        } catch (error) {
            return false;
        }

        if (!result || result.consumed !== true || !Number.isSafeInteger(result.requestId)
                || result.requestId <= 0 || typeof result.applied !== "boolean") {
            return false;
        }

        lastConsumedRequestId = result.requestId;
        return result.applied;
    }
}
