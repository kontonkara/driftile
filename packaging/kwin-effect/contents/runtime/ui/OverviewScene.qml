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
            onDesktopTapped: (candidate, expectedDesktopId, expectedScreen) => root.selectDesktop(
                                 candidate, expectedDesktopId, expectedScreen)
            onWindowTapped: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) =>
                                root.focusWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                                 expectedScreen)
        }
    }

    function selectDesktop(candidate, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId)) {
            return;
        }

        if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId)) {
            return;
        }
        effect.deactivate();
    }

    function focusWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(expectedDesktop, expectedDesktopId);
        const expectedActivityId = String(KWin.Workspace.currentActivity);
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !windowContextIsExact(candidate, expectedWindowId,
                                                                               liveScreen, liveDesktop,
                                                                               expectedDesktopId,
                                                                               expectedActivityId, false)) {
            return;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop) {
            return;
        }

        let desktopSelectionConfirmed = false;
        if (activeDesktop !== liveDesktop || String(activeDesktop.id) !== expectedDesktopId) {
            if (!requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                         expectedDesktopId)) {
                return;
            }
            desktopSelectionConfirmed = true;
        }

        let focusConfirmed = false;
        const selectedDesktop = currentDesktop;
        if (selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId && desktopContextIsExact(
                    effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop, expectedDesktopId)
                && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                        expectedActivityId, true)) {
            try {
                if (KWin.Workspace.activeWindow !== candidate) {
                    KWin.Workspace.activeWindow = candidate;
                }
                focusConfirmed = KWin.Workspace.activeWindow === candidate;
            } catch (error) {
                focusConfirmed = false;
            }
        }

        if (focusConfirmed || desktopSelectionConfirmed) {
            effect.deactivate();
        }
    }

    function requestDesktopSelection(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId) {
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId)) {
            return false;
        }

        const screens = KWin.Workspace.screens;
        const hasSceneDesktop = typeof KWin.SceneView.currentDesktop !== "undefined";
        if (!hasSceneDesktop && (screens.length !== 1 || screens[0] !== liveScreen)) {
            return false;
        }

        const activeDesktop = currentDesktop;
        if (!activeDesktop || activeDesktop === liveDesktop || String(activeDesktop.id) === expectedDesktopId) {
            return false;
        }

        try {
            if (hasSceneDesktop) {
                KWin.SceneView.currentDesktop = liveDesktop;
            } else {
                KWin.Workspace.currentDesktop = liveDesktop;
            }
        } catch (error) {
            return false;
        }

        const selectedDesktop = currentDesktop;
        return selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId;
    }

    function desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) {
        if (!effect || effect !== sceneEffect || effect.active !== true || !model || effect.overviewModel !== model
                || overviewModel !== model || !liveScreen || targetScreen !== liveScreen
                || liveScreenFor(liveScreen) !== liveScreen || !expectedOutput || expectedOutputId.length === 0
                || String(expectedOutput.outputId) !== expectedOutputId || outputId !== expectedOutputId
                || projectedOutput(model, liveScreen) !== expectedOutput || !liveDesktop || expectedDesktopId.length === 0
                || String(liveDesktop.id) !== expectedDesktopId
                || liveDesktopFor(liveDesktop, expectedDesktopId) !== liveDesktop) {
            return false;
        }

        return true;
    }

    function windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                  expectedActivityId, rejectHidden) {
        return candidate && !candidate.deleted && !candidate.minimized && candidate.wantsInput === true
                && (!rejectHidden || !candidate.hidden) && expectedWindowId.length > 0
                && String(candidate.internalId) === expectedWindowId && candidate.output === liveScreen
                && String(KWin.Workspace.currentActivity) === expectedActivityId
                && windowUsesDesktop(candidate, liveDesktop, expectedDesktopId)
                && windowUsesActivity(candidate, expectedActivityId);
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

    function windowUsesActivity(candidate, expectedActivityId) {
        const activities = candidate.activities;
        if (!activities) {
            return false;
        }
        if (activities.length === 0) {
            return true;
        }

        for (const activity of activities) {
            if (String(activity) === expectedActivityId) {
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
        return projectedOutputId(overviewModel, targetScreen);
    }

    function projectedOutputId(model, screen) {
        const output = projectedOutput(model, screen);
        return output ? String(output.outputId) : "";
    }

    function projectedOutput(model, screen) {
        if (!model || !screen) {
            return null;
        }

        const screenName = String(screen.name);
        let projected = null;
        for (const output of model.outputs) {
            if (output.name === screenName && outputDescriptorsMatch(output, screen)) {
                if (projected !== null) {
                    return null;
                }
                projected = output;
            }
        }

        return projected;
    }

    function liveScreenFor(expectedScreen) {
        let liveScreen = null;
        for (const screen of KWin.Workspace.screens) {
            if (screen === expectedScreen) {
                if (liveScreen !== null) {
                    return null;
                }
                liveScreen = screen;
            }
        }

        return liveScreen;
    }

    function liveDesktopFor(expectedDesktop, expectedDesktopId) {
        let liveDesktop = null;
        for (const desktop of KWin.Workspace.desktops) {
            if (desktop === expectedDesktop && String(desktop.id) === expectedDesktopId) {
                if (liveDesktop !== null) {
                    return null;
                }
                liveDesktop = desktop;
            }
        }

        return liveDesktop;
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
