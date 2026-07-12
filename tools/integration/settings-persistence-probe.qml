import QtCore
import QtQuick

QtObject {
    readonly property Settings state: Settings {
        category: "Probe"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-settings-persistence-probe.ini"
    }

    Component.onCompleted: {
        const storedGeneration = Number(state.value("Generation", 0));
        const generation = Number.isInteger(storedGeneration) && storedGeneration >= 0 ? storedGeneration : 0;
        const payload = JSON.stringify({
            schemaVersion: 1
        });
        const payloadMatches = state.value("Payload", "") === payload;

        state.setValue("Generation", generation + 1);
        state.setValue("Payload", payload);
        state.setValue("PayloadVerified", payloadMatches);
        state.sync();
        console.info(`[driftile-settings-probe] loaded=${generation} saved=${generation + 1} payloadMatched=${payloadMatches}`);
    }
}
