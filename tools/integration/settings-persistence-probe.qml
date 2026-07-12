import QtCore
import QtQuick
import "../../packaging/kwin-script/contents/ui" as Driftile

QtObject {
    id: root

    readonly property string representativeState: "{\"schemaVersion\":1,\"label\":\"Driftile ☃ Привет\",\"escaped\":\"quote=\\\" backslash=\\\\ tab=\\t line=\\n\",\"rows\":[\"α\",\"日本語\"]}\n"

    readonly property Settings probeState: Settings {
        category: "Probe"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-settings-persistence-probe.ini"
    }

    readonly property Driftile.LayoutStateStore layoutState: Driftile.LayoutStateStore {
        category: "Layout"
        debounceInterval: 600000
        key: "State"
        location: root.probeState.location
    }

    Component.onCompleted: {
        const storedGeneration = Number(probeState.value("Generation", 0));
        const generation = Number.isInteger(storedGeneration) && storedGeneration >= 0 ? storedGeneration : 0;
        const loadedState = layoutState.load();

        if (generation === 0) {
            layoutState.queue(representativeState);
            probeState.setValue("InitialQueueVerified", loadedState === "" && layoutState.hasPendingState);
        } else if (generation === 1) {
            const payloadMatches = loadedState === representativeState;
            layoutState.queue("{\"schemaVersion\":1,\"cancelled\":true}\n");
            const replacementQueued = layoutState.hasPendingState;
            layoutState.queue(representativeState);
            probeState.setValue("CancellationVerified", replacementQueued && !layoutState.hasPendingState);
            probeState.setValue("PayloadVerified", payloadMatches);
        } else {
            probeState.setValue("CancellationSurvived", loadedState === representativeState);
        }

        probeState.setValue("Generation", generation + 1);
        probeState.sync();
        console.info(`[driftile-settings-probe] loaded=${generation} saved=${generation + 1}`);
    }

    Component.onDestruction: layoutState.flush()
}
