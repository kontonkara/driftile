import QtQuick
import org.kde.kwin

QtObject {
    function resizeWindow(window) {
        if (window.caption !== "QEMU (driftile-vm)") {
            return;
        }

        const area = Workspace.clientArea(Workspace.MaximizeArea, window);
        const width = Math.min(1440, area.width);
        const height = Math.min(900, area.height);

        window.frameGeometry = Qt.rect(
            area.x + Math.round((area.width - width) / 2),
            area.y + Math.round((area.height - height) / 2),
            width,
            height
        );
    }

    Component.onCompleted: {
        Workspace.windowAdded.connect(resizeWindow);

        for (const window of Workspace.stackingOrder) {
            resizeWindow(window);
        }
    }

    Component.onDestruction: Workspace.windowAdded.disconnect(resizeWindow)
}
