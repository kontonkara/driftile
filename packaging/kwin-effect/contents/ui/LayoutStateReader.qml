import QtCore
import QtQuick

QtObject {
    id: root

    readonly property int sampleInterval: 325
    property bool sampling: false
    property string firstSample: ""

    signal ready(string document)
    signal rejected

    readonly property Settings settings: Settings {
        category: "Layout"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-layout-state.ini"
    }

    readonly property Timer secondSampleTimer: Timer {
        interval: root.sampleInterval
        repeat: false

        onTriggered: {
            root.settings.sync();
            const storedValue = root.settings.value("layout-v1", "");
            const secondSample = typeof storedValue === "string" ? storedValue : "";
            root.sampling = false;

            if (root.firstSample.length > 0 && root.firstSample === secondSample) {
                root.ready(secondSample);
            } else {
                root.rejected();
            }

            root.firstSample = "";
        }
    }

    function sample() {
        secondSampleTimer.stop();
        settings.sync();
        const storedValue = settings.value("layout-v1", "");
        firstSample = typeof storedValue === "string" ? storedValue : "";
        sampling = true;
        secondSampleTimer.start();
    }

    function cancel() {
        secondSampleTimer.stop();
        sampling = false;
        firstSample = "";
    }
}
