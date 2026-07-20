pragma ComponentBehavior: Bound

import QtQuick
import org.kde.kwin

QtObject {
    id: root

    readonly property int maximumDesktopCount: 25

    readonly property Connections workspaceConnection: Connections {
        target: Workspace
        ignoreUnknownSignals: true

        function onDesktopsChanged() {
            root.synchronizeRows();
        }

        function onDesktopLayoutChanged() {
            root.synchronizeRows();
        }
    }

    Component.onCompleted: synchronizeRows()

    function synchronizeRows() {
        const desktopCount = exactDesktopCount();
        if (desktopCount === 0) {
            return false;
        }

        try {
            if (Workspace.desktopGridHeight !== desktopCount
                    || Workspace.desktopGridWidth !== 1) {
                Workspace.desktopGridHeight = desktopCount;
            }
            return Workspace.desktopGridHeight === desktopCount
                && Workspace.desktopGridWidth === 1;
        } catch (error) {
            return false;
        }
    }

    function exactDesktopCount() {
        try {
            const desktops = Workspace.desktops;
            if (!desktops || !Number.isInteger(desktops.length)
                    || desktops.length < 1 || desktops.length > maximumDesktopCount) {
                return 0;
            }
            return desktops.length;
        } catch (error) {
            return 0;
        }
    }
}
