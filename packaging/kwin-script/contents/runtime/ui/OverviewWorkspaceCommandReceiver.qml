import QtCore
import QtQuick
import org.kde.kwin

QtObject {
    id: root

    required property var applyCommand
    property double lastConsumedRequestId: 0

    readonly property Settings commandSettings: Settings {
        category: "Command"
        location: StandardPaths.writableLocation(StandardPaths.RuntimeLocation)
                  + "/driftile-overview-workspace-command.ini"
    }

    readonly property ShortcutHandler applyShortcut: ShortcutHandler {
        name: "driftile_apply_overview_workspace_command"
        text: "Driftile: Apply overview workspace command"
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

        if (typeof applyCommand !== "function") {
            return false;
        }

        let result = null;
        try {
            result = applyCommand(document, Date.now(), lastConsumedRequestId);
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
