import QtQuick
import org.kde.kwin as KWin

Rectangle {
    id: root

    color: "#e60b0f17"
    focus: true

    readonly property var sceneEffect: KWin.SceneView.effect
    readonly property var targetScreen: KWin.SceneView.screen
    readonly property var currentDesktop: typeof KWin.SceneView.currentDesktop !== "undefined"
        ? KWin.SceneView.currentDesktop
        : KWin.Workspace.currentDesktop
    readonly property var overviewModel: sceneEffect ? sceneEffect.overviewModel : null
    readonly property string outputId: outputIdForScreen()
    readonly property var desktopIds: outputId.length > 0 ? orderedDesktopIds() : []
    readonly property real outerMargin: Math.max(20, Math.min(width, height) * 0.035)
    readonly property real cardGap: Math.max(2, Math.min(10, height * 0.012))
    readonly property real cardHeight: desktopIds.length > 0 ? Math.max(1, (height - outerMargin * 2 - cardGap
                                                                            * Math.max(0, desktopIds.length - 1))
                                                                        / desktopIds.length) : 0

    Keys.onEscapePressed: {
        if (sceneEffect) {
            sceneEffect.deactivate();
        }
    }

    Component.onCompleted: forceActiveFocus()

    Connections {
        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onDesktopsChanged() {
            root.closeStaleOverview();
        }

        function onScreensChanged() {
            root.closeStaleOverview();
        }

        function onWindowAdded() {
            root.closeStaleOverview();
        }

        function onWindowRemoved() {
            root.closeStaleOverview();
        }
    }

    Repeater {
        model: root.desktopIds

        DesktopCard {
            required property string modelData
            required property int index

            x: root.outerMargin
            y: root.outerMargin + index * (root.cardHeight + root.cardGap)
            width: Math.max(1, root.width - root.outerMargin * 2)
            height: root.cardHeight
            context: root.contextFor(modelData)
            current: root.currentDesktop !== null && String(root.currentDesktop.id) === modelData
            desktop: root.desktopForId(modelData)
            desktopId: modelData
            floatingWindows: root.floatingFor(modelData)
            screen: root.targetScreen
            onWindowTapped: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId) => root.focusWindow(
                                candidate, expectedWindowId, expectedDesktop, expectedDesktopId)
        }
    }

    function focusWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId) {
        if (!sceneEffect || sceneEffect.active !== true || !candidate || candidate.deleted || candidate.hidden
                || candidate.minimized || candidate.wantsInput !== true || expectedWindowId.length === 0
                || String(candidate.internalId) !== expectedWindowId || expectedDesktopId.length === 0 || !targetScreen
                || candidate.output !== targetScreen) {
            return;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop || activeDesktop !== expectedDesktop || String(activeDesktop.id) !== expectedDesktopId
                || !windowUsesDesktop(candidate, expectedDesktop, expectedDesktopId) || !windowUsesCurrentActivity(
                    candidate)) {
            return;
        }

        if (KWin.Workspace.activeWindow !== candidate) {
            KWin.Workspace.activeWindow = candidate;
        }
        if (KWin.Workspace.activeWindow !== candidate) {
            return;
        }
        sceneEffect.deactivate();
    }

    function windowUsesDesktop(candidate, expectedDesktop, expectedDesktopId) {
        const desktops = candidate.desktops;
        if (!desktops) {
            return false;
        }
        if (desktops.length === 0) {
            return true;
        }

        for (const desktop of desktops) {
            if (desktop === expectedDesktop && String(desktop.id) === expectedDesktopId) {
                return true;
            }
        }

        return false;
    }

    function windowUsesCurrentActivity(candidate) {
        const activities = candidate.activities;
        if (!activities) {
            return false;
        }
        if (activities.length === 0) {
            return true;
        }

        const currentActivity = String(KWin.Workspace.currentActivity);
        for (const activity of activities) {
            if (String(activity) === currentActivity) {
                return true;
            }
        }

        return false;
    }

    function orderedDesktopIds() {
        if (!overviewModel) {
            return [];
        }

        const knownIds = Object.create(null);
        const orderedIds = [];
        for (const desktopId of overviewModel.desktopIds) {
            knownIds[desktopId] = true;
        }
        for (const desktop of KWin.Workspace.desktops) {
            const desktopId = String(desktop.id);
            if (knownIds[desktopId] === true) {
                orderedIds.push(desktopId);
            }
        }

        return orderedIds;
    }

    function closeStaleOverview() {
        if (sceneEffect) {
            sceneEffect.deactivate();
        }
    }

    function outputIdForScreen() {
        if (!overviewModel || !targetScreen) {
            return "";
        }

        const screenName = String(targetScreen.name);
        for (const output of overviewModel.outputs) {
            if (output.name === screenName && outputDescriptorsMatch(output, targetScreen)) {
                return output.outputId;
            }
        }

        return "";
    }

    function outputDescriptorsMatch(output, screen) {
        return optionalIdentifier(output.manufacturer) === optionalIdentifier(screen.manufacturer) && optionalIdentifier(
                    output.model) === optionalIdentifier(screen.model) && optionalIdentifier(output.serialNumber)
                === optionalIdentifier(screen.serialNumber);
    }

    function optionalIdentifier(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function contextFor(desktopId) {
        if (!overviewModel || outputId.length === 0) {
            return null;
        }

        for (const context of overviewModel.contexts) {
            if (context.outputId === outputId && context.desktopId === desktopId) {
                return context;
            }
        }

        return null;
    }

    function floatingFor(desktopId) {
        if (!overviewModel || outputId.length === 0) {
            return [];
        }

        const windows = [];
        for (const floatingWindow of overviewModel.floatingWindows) {
            if (floatingWindow.outputId === outputId && floatingWindow.desktopId === desktopId) {
                windows.push(floatingWindow);
            }
        }

        return windows;
    }

    function desktopForId(desktopId) {
        for (const desktop of KWin.Workspace.desktops) {
            if (String(desktop.id) === desktopId) {
                return desktop;
            }
        }

        return null;
    }
}
