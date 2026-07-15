import QtCore
import QtQuick

QtObject {
    id: root

    readonly property int sampleInterval: 325
    property bool sampling: false
    property string firstSample: ""
    property int requestId: 0

    signal ready(int requestId, string document)
    signal rejected(int requestId)

    readonly property Settings settings: Settings {
        category: "Layout"
        location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-layout-state.ini"
    }

    readonly property Timer secondSampleTimer: Timer {
        interval: root.sampleInterval
        repeat: false

        onTriggered: {
            const requestId = root.requestId;
            root.requestId = 0;
            root.settings.sync();
            const storedValue = root.settings.value("layout-v1", "");
            const secondSample = typeof storedValue === "string" ? storedValue : "";
            root.sampling = false;

            if (requestId > 0) {
                if (root.firstSample.length > 0 && root.firstSample === secondSample) {
                    root.ready(requestId, secondSample);
                } else {
                    root.rejected(requestId);
                }
            }

            root.firstSample = "";
        }
    }

    function sample(requestId) {
        cancel();

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return;
        }

        settings.sync();
        const storedValue = settings.value("layout-v1", "");
        firstSample = typeof storedValue === "string" ? storedValue : "";
        root.requestId = requestId;
        sampling = true;
        secondSampleTimer.start();
    }

    function cancel() {
        secondSampleTimer.stop();
        sampling = false;
        firstSample = "";
        requestId = 0;
    }
}
