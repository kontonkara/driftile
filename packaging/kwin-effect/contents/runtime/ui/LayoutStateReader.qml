import QtCore
import Qt.labs.folderlistmodel
import QtQuick
import QtQml.Models

QtObject {
    id: root

    readonly property int sampleInterval: 120
    property bool sampling: false
    property string firstSample: ""
    property string stableSample: ""
    property int requestId: 0

    signal ready(int requestId, string document)
    signal rejected(int requestId)
    signal publicationDetected()

    readonly property url stateDirectory: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation)

    readonly property FolderListModel stateFiles: FolderListModel {
        folder: root.stateDirectory
        nameFilters: ["driftile-layout-state.ini"]
        showDirs: false
        showDotAndDotDot: false
        showFiles: true
    }

    readonly property Instantiator stateFileObserver: Instantiator {
        model: root.stateFiles

        delegate: QtObject {
            required property date fileModified
            required property double fileSize

            property bool armed: false

            Component.onCompleted: {
                armed = true;
                root.handlePublication();
            }

            onFileModifiedChanged: {
                if (armed) {
                    root.handlePublication();
                }
            }

            onFileSizeChanged: {
                if (armed) {
                    root.handlePublication();
                }
            }
        }
    }

    readonly property Settings settings: Settings {
        category: "Layout"
        location: root.stateDirectory + "/driftile-layout-state.ini"
    }

    readonly property Timer secondSampleTimer: Timer {
        interval: root.sampleInterval
        repeat: false

        onTriggered: {
            const completedRequestId = root.requestId;
            root.requestId = 0;
            const secondSample = root.readSample();
            root.sampling = false;
            const confirmed = root.firstSample.length > 0 && root.firstSample === secondSample;
            root.firstSample = "";

            if (confirmed) {
                root.stableSample = secondSample;
                if (completedRequestId > 0) {
                    root.ready(completedRequestId, secondSample);
                }
            } else {
                root.stableSample = "";
                if (completedRequestId > 0) {
                    root.rejected(completedRequestId);
                }
            }
        }
    }

    Component.onCompleted: primeStableSample()

    function readSample() {
        settings.sync();
        const storedValue = settings.value("layout-v1", "");
        return typeof storedValue === "string" ? storedValue : "";
    }

    function beginDoubleSample(nextRequestId) {
        firstSample = readSample();
        requestId = nextRequestId;
        sampling = true;
        secondSampleTimer.start();
    }

    function primeStableSample() {
        if (sampling || stableSample.length > 0) {
            return;
        }

        beginDoubleSample(0);
    }

    function handlePublication() {
        const pendingRequestId = sampling ? requestId : 0;
        cancel();
        stableSample = "";
        beginDoubleSample(pendingRequestId);
        publicationDetected();
    }

    function sample(requestId) {
        cancel();

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return;
        }

        const synchronousSample = readSample();
        if (stableSample.length > 0 && synchronousSample === stableSample) {
            ready(requestId, synchronousSample);
            return;
        }

        stableSample = "";
        firstSample = synchronousSample;
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
