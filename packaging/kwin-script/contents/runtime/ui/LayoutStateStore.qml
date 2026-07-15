import QtCore
import QtQuick

QtObject {
    id: root

    required property url location
    required property string category
    required property string key

    property int debounceInterval: 250

    readonly property bool hasPendingState: privateState.hasPendingState
    readonly property string state: privateState.committedState

    readonly property Settings settings: Settings {
        category: root.category
        location: root.location
    }

    readonly property Timer commitTimer: Timer {
        interval: root.debounceInterval
        repeat: false

        onTriggered: root.flush()
    }

    readonly property QtObject privateState: QtObject {
        property string committedState: ""
        property bool hasLoaded: false
        property bool hasPendingState: false
        property string pendingState: ""
    }

    function load() {
        if (!privateState.hasLoaded) {
            const storedState = settings.value(root.key, "");
            privateState.committedState = typeof storedState === "string" ? storedState : "";
            privateState.hasLoaded = true;
        }

        return privateState.committedState;
    }

    function queue(canonicalState) {
        if (typeof canonicalState !== "string") {
            throw new TypeError("Layout state must be a canonical string");
        }

        load();

        if (privateState.hasPendingState && canonicalState === privateState.pendingState) {
            return;
        }

        if (canonicalState === privateState.committedState) {
            commitTimer.stop();
            privateState.hasPendingState = false;
            privateState.pendingState = "";
            return;
        }

        privateState.pendingState = canonicalState;
        privateState.hasPendingState = true;
        commitTimer.restart();
    }

    function flush() {
        load();
        commitTimer.stop();

        if (!privateState.hasPendingState) {
            return false;
        }

        const pendingState = privateState.pendingState;
        settings.setValue(root.key, pendingState);
        settings.sync();
        privateState.committedState = pendingState;
        privateState.hasPendingState = false;
        privateState.pendingState = "";
        return true;
    }

    Component.onCompleted: load()
    Component.onDestruction: flush()
}
