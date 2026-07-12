import QtQuick
import org.kde.kwin

QtObject {
    function resizeFullWindow(window) {
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

    function isTwoHeadWindow(window) {
        return window.caption.indexOf("QEMU (driftile-vm-two-head)") === 0;
    }

    function resizeLifecycleWindow(window) {
        if (window.caption !== "QEMU (driftile-vm-lifecycle)") {
            return;
        }

        const area = Workspace.clientArea(Workspace.MaximizeArea, window);
        const width = 1366;
        const height = 768;

        window.frameGeometry = Qt.rect(
            area.x + Math.max(0, Math.round((area.width - width) / 2)),
            area.y + Math.max(0, Math.round((area.height - height) / 2)),
            width,
            height
        );
    }

    function arrangeTwoHeadWindows() {
        const windows = Workspace.stackingOrder
            .filter(isTwoHeadWindow)
            .sort((left, right) => left.caption.localeCompare(right.caption));

        if (windows.length !== 2) {
            return;
        }

        const area = Workspace.clientArea(Workspace.MaximizeArea, windows[0]);
        const gap = 8;
        const combinedWidth = windows[0].frameGeometry.width
            + gap
            + windows[1].frameGeometry.width;
        let x = area.x + Math.round((area.width - combinedWidth) / 2);

        for (const window of windows) {
            const geometry = window.frameGeometry;
            const y = area.y + Math.max(0, Math.round((area.height - geometry.height) / 2));

            window.frameGeometry = Qt.rect(x, y, geometry.width, geometry.height);
            x += geometry.width + gap;
        }
    }

    function placeWindow(window) {
        resizeFullWindow(window);
        resizeLifecycleWindow(window);
        arrangeTwoHeadWindows();
        Qt.callLater(resizeLifecycleWindow, window);
        Qt.callLater(arrangeTwoHeadWindows);
    }

    Component.onCompleted: {
        Workspace.windowAdded.connect(placeWindow);

        for (const window of Workspace.stackingOrder) {
            placeWindow(window);
        }
    }

    Component.onDestruction: Workspace.windowAdded.disconnect(placeWindow)
}
