import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

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
    property bool desktopReorderAvailable: false
    property string keyboardSelectionId: ""
    property string searchQuery: ""
    property bool desktopReorderActive: false
    property real desktopReorderCardGap: 0
    property real desktopReorderCardHeight: 0
    property var desktopReorderCurrentDesktop: null
    property string desktopReorderCurrentDesktopId: ""
    property var desktopReorderDesktopIds: []
    property var desktopReorderDesktopObjects: []
    property var desktopReorderEffect: null
    property int desktopReorderInsertionSlot: -1
    property var desktopReorderModel: null
    property real desktopReorderOuterMargin: 0
    property var desktopReorderOutput: null
    property string desktopReorderOutputId: ""
    property real desktopReorderSceneHeight: 0
    property real desktopReorderSceneWidth: 0
    property var desktopReorderScreen: null
    property var desktopReorderSource: null
    property string desktopReorderSourceId: ""
    property int desktopReorderSourceIndex: -1

    onSearchQueryChanged: Qt.callLater(root.repairKeyboardSelection)

    Keys.onPressed: event => {
        const modifiers = event.modifiers & ~Qt.KeypadModifier;
        const forbiddenModifiers = Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier;
        if ((modifiers & forbiddenModifiers) !== Qt.NoModifier) {
            event.accepted = false;
            return;
        }

        const unmodified = modifiers === Qt.NoModifier;
        const searchTextModifier = unmodified || modifiers === Qt.ShiftModifier;
        let handled = true;
        if (unmodified && event.key === Qt.Key_Left) {
            root.navigateKeyboardSelection("left");
        } else if (unmodified && event.key === Qt.Key_Right) {
            root.navigateKeyboardSelection("right");
        } else if (unmodified && event.key === Qt.Key_Up) {
            root.navigateKeyboardSelection("up");
        } else if (unmodified && event.key === Qt.Key_Down) {
            root.navigateKeyboardSelection("down");
        } else if (unmodified
                   && (event.key === Qt.Key_Enter || event.key === Qt.Key_Return
                       || (event.key === Qt.Key_Space && searchQuery.length === 0))) {
            root.activateKeyboardSelection();
        } else if (searchTextModifier && event.key === Qt.Key_Backspace && searchQuery.length > 0) {
            root.removeLastSearchCharacter();
        } else if (searchTextModifier && event.key === Qt.Key_Escape) {
            if (searchQuery.length > 0) {
                searchQuery = "";
            } else if (sceneEffect) {
                sceneEffect.deactivate();
            }
        } else if (searchTextModifier && root.isPrintableSearchText(event.text)) {
            root.appendSearchText(event.text);
        } else {
            handled = false;
        }

        event.accepted = handled;
    }

    Component.onCompleted: {
        desktopReorderAvailable = typeof KWin.Workspace.moveDesktop === "function";
        forceActiveFocus();
        Qt.callLater(root.repairKeyboardSelection);
    }

    Connections {
        target: root.sceneEffect
        ignoreUnknownSignals: true

        function onActiveChanged() {
            if (!root.sceneEffect || root.sceneEffect.active !== true) {
                root.searchQuery = "";
            }
        }
    }

    Connections {
        target: KWin.Workspace
        ignoreUnknownSignals: true

        function onDesktopsChanged() {
            root.closeStaleOverview();
        }

        function onCurrentActivityChanged() {
            root.closeStaleOverview();
        }

        function onActivitiesChanged() {
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
        id: desktopRepeater

        model: root.desktopIds

        onItemAdded: Qt.callLater(root.repairKeyboardSelection)
        onItemRemoved: Qt.callLater(root.repairKeyboardSelection)

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
            desktopReorderEnabled: root.desktopReorderAvailable && root.desktopIds.length > 2
                                     && index < root.desktopIds.length - 1
            desktopReorderSource: root.desktopReorderActive && root.desktopReorderSourceId === modelData
            desktopId: modelData
            floatingWindows: root.floatingFor(modelData)
            keyboardSelectionId: root.keyboardSelectionId
            searchQuery: root.searchQuery
            screen: root.targetScreen
            onDesktopReorderCanceled: expectedDesktopId => root.cancelDesktopReorder(expectedDesktopId)
            onDesktopReorderGrabbed: (candidate, expectedDesktopId, expectedScreen, sceneX, sceneY) =>
                                         root.beginDesktopReorder(candidate, expectedDesktopId, expectedScreen,
                                                                  sceneX, sceneY)
            onDesktopReorderMoved: (expectedDesktopId, sceneX, sceneY) =>
                                       root.updateDesktopReorder(expectedDesktopId, sceneX, sceneY)
            onDesktopReorderReleased: (expectedDesktopId, sceneX, sceneY) =>
                                          root.finishDesktopReorder(expectedDesktopId, sceneX, sceneY)
            onNavigationTargetsChanged: Qt.callLater(root.repairKeyboardSelection)
            onDesktopTapped: (candidate, expectedDesktopId, expectedScreen) => root.selectDesktop(
                                 candidate, expectedDesktopId, expectedScreen)
            onWindowTapped: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) =>
                                root.focusWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                                 expectedScreen)
            onWindowDropped: (candidate, expectedWindowId, expectedSourceDesktop, expectedSourceDesktopId,
                              expectedTargetDesktop, expectedTargetDesktopId, expectedScreen) =>
                                 root.moveWindowToDesktop(candidate, expectedWindowId, expectedSourceDesktop,
                                                          expectedSourceDesktopId, expectedTargetDesktop,
                                                          expectedTargetDesktopId, expectedScreen)
        }
    }

    Rectangle {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.topMargin: Math.max(8, root.outerMargin * 0.3)
        width: Math.min(Math.max(1, root.width - root.outerMargin * 2),
                        Math.max(160, searchOverlayText.implicitWidth + 28))
        height: 34
        visible: root.searchQuery.length > 0
        color: "#f21a2230"
        border.width: 1
        border.color: "#86aee8"
        radius: 8
        z: 20000

        Text {
            id: searchOverlayText

            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            text: `Search: ${root.searchQuery}`
            textFormat: Text.PlainText
            color: "#f3f7ff"
            font.pixelSize: 14
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
    }

    Rectangle {
        readonly property real lineHeight: Math.max(2, Math.min(4, root.desktopReorderCardGap))

        x: root.desktopReorderOuterMargin
        y: root.desktopReorderOuterMargin
           + root.desktopReorderInsertionSlot * (root.desktopReorderCardHeight + root.desktopReorderCardGap)
           - (root.desktopReorderInsertionSlot === 0 ? 0 : root.desktopReorderCardGap / 2) - lineHeight / 2
        width: Math.max(1, root.desktopReorderSceneWidth - root.desktopReorderOuterMargin * 2)
        height: lineHeight
        visible: root.desktopReorderActive && root.desktopReorderInsertionSlot >= 0
        color: "#ffd166"
        radius: lineHeight / 2
        z: 10000
    }

    function beginDesktopReorder(candidate, expectedDesktopId, expectedScreen, sceneX, sceneY) {
        if (desktopReorderActive || !desktopReorderAvailable) {
            return;
        }
        resetDesktopReorder();

        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
        const snapshot = liveDesktopSnapshot();
        const selectedDesktop = currentDesktop;
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !snapshot || snapshot.ids.length <= 2
                || !sameStringList(snapshot.ids, desktopIds) || !selectedDesktop
                || String(selectedDesktop.id).length === 0) {
            return;
        }

        const sourceIndex = snapshot.ids.indexOf(expectedDesktopId);
        if (sourceIndex < 0 || sourceIndex >= snapshot.ids.length - 1
                || snapshot.objects[sourceIndex] !== liveDesktop) {
            return;
        }

        desktopReorderActive = true;
        desktopReorderCardGap = cardGap;
        desktopReorderCardHeight = cardHeight;
        desktopReorderCurrentDesktop = selectedDesktop;
        desktopReorderCurrentDesktopId = String(selectedDesktop.id);
        desktopReorderDesktopIds = snapshot.ids;
        desktopReorderDesktopObjects = snapshot.objects;
        desktopReorderEffect = effect;
        desktopReorderModel = model;
        desktopReorderOuterMargin = outerMargin;
        desktopReorderOutput = expectedOutput;
        desktopReorderOutputId = expectedOutputId;
        desktopReorderSceneHeight = height;
        desktopReorderSceneWidth = width;
        desktopReorderScreen = liveScreen;
        desktopReorderSource = liveDesktop;
        desktopReorderSourceId = expectedDesktopId;
        desktopReorderSourceIndex = sourceIndex;
        updateDesktopReorder(expectedDesktopId, sceneX, sceneY);
    }

    function updateDesktopReorder(expectedDesktopId, sceneX, sceneY) {
        if (!desktopReorderActive || expectedDesktopId !== desktopReorderSourceId) {
            return;
        }

        const insertionSlot = desktopReorderSlotAt(sceneX, sceneY);
        const targetIndex = plannedDesktopReorderIndex(insertionSlot);
        desktopReorderInsertionSlot = targetIndex === null ? -1 : insertionSlot;
    }

    function finishDesktopReorder(expectedDesktopId, sceneX, sceneY) {
        if (!desktopReorderActive || expectedDesktopId !== desktopReorderSourceId) {
            return;
        }

        const insertionSlot = desktopReorderSlotAt(sceneX, sceneY);
        const targetIndex = plannedDesktopReorderIndex(insertionSlot);
        const effect = desktopReorderEffect;
        const model = desktopReorderModel;
        const liveScreen = desktopReorderScreen;
        const expectedOutput = desktopReorderOutput;
        const expectedOutputId = desktopReorderOutputId;
        const source = desktopReorderSource;
        const sourceId = desktopReorderSourceId;
        const sourceIndex = desktopReorderSourceIndex;
        const expectedIds = desktopReorderDesktopIds;
        const expectedObjects = desktopReorderDesktopObjects;
        const selectedDesktop = desktopReorderCurrentDesktop;
        const selectedDesktopId = desktopReorderCurrentDesktopId;
        const snapshot = liveDesktopSnapshot();
        const geometryUnchanged = width === desktopReorderSceneWidth && height === desktopReorderSceneHeight
            && outerMargin === desktopReorderOuterMargin && cardGap === desktopReorderCardGap
            && cardHeight === desktopReorderCardHeight;
        const contextUnchanged = desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                                       source, sourceId) && selectedDesktop === currentDesktop
            && selectedDesktopId === String(currentDesktop ? currentDesktop.id : "");
        const orderUnchanged = snapshot && sameDesktopSnapshot(snapshot, expectedObjects, expectedIds)
            && sameStringList(snapshot.ids, desktopIds) && sourceIndex >= 0
            && sourceIndex < snapshot.ids.length - 1 && snapshot.objects[sourceIndex] === source
            && snapshot.ids[sourceIndex] === sourceId;
        const canCommit = targetIndex !== null && geometryUnchanged && contextUnchanged && orderUnchanged
            && typeof KWin.Workspace.moveDesktop === "function";

        resetDesktopReorder();
        if (!canCommit) {
            return;
        }

        try {
            KWin.Workspace.moveDesktop(source, targetIndex);
        } catch (error) {
            return;
        }
    }

    function cancelDesktopReorder(expectedDesktopId) {
        if (desktopReorderActive && expectedDesktopId === desktopReorderSourceId) {
            resetDesktopReorder();
        }
    }

    function resetDesktopReorder() {
        desktopReorderActive = false;
        desktopReorderCardGap = 0;
        desktopReorderCardHeight = 0;
        desktopReorderCurrentDesktop = null;
        desktopReorderCurrentDesktopId = "";
        desktopReorderDesktopIds = [];
        desktopReorderDesktopObjects = [];
        desktopReorderEffect = null;
        desktopReorderInsertionSlot = -1;
        desktopReorderModel = null;
        desktopReorderOuterMargin = 0;
        desktopReorderOutput = null;
        desktopReorderOutputId = "";
        desktopReorderSceneHeight = 0;
        desktopReorderSceneWidth = 0;
        desktopReorderScreen = null;
        desktopReorderSource = null;
        desktopReorderSourceId = "";
        desktopReorderSourceIndex = -1;
    }

    function desktopReorderSlotAt(sceneX, sceneY) {
        if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY) || desktopReorderDesktopIds.length <= 2
                || desktopReorderCardHeight <= 0 || desktopReorderCardGap < 0) {
            return -1;
        }

        let point;
        try {
            point = root.mapFromItem(null, sceneX, sceneY);
        } catch (error) {
            return -1;
        }

        const movableCount = desktopReorderDesktopIds.length - 1;
        const stride = desktopReorderCardHeight + desktopReorderCardGap;
        const protectedTop = desktopReorderOuterMargin + movableCount * stride;
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < desktopReorderOuterMargin
                || point.x >= desktopReorderSceneWidth - desktopReorderOuterMargin
                || point.y < desktopReorderOuterMargin || point.y >= protectedTop) {
            return -1;
        }

        return Math.max(0, Math.min(movableCount, Math.floor((point.y - desktopReorderOuterMargin
                                                               + desktopReorderCardHeight / 2
                                                               + desktopReorderCardGap) / stride)));
    }

    function plannedDesktopReorderIndex(insertionSlot) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewDesktopDrop !== "function") {
            return null;
        }

        try {
            const targetIndex = runtime.planOverviewDesktopDrop(desktopReorderDesktopIds.length,
                                                                desktopReorderSourceIndex, insertionSlot);
            return typeof targetIndex === "number" && targetIndex >= 0
                    && targetIndex < desktopReorderDesktopIds.length - 1 && Math.floor(targetIndex) === targetIndex
                ? targetIndex : null;
        } catch (error) {
            return null;
        }
    }

    function liveDesktopSnapshot() {
        const ids = [];
        const objects = [];
        const knownIds = Object.create(null);
        for (const desktop of KWin.Workspace.desktops) {
            if (!desktop || desktop.id === undefined || desktop.id === null) {
                return null;
            }
            const desktopId = String(desktop.id);
            if (desktopId.length === 0 || knownIds[desktopId] === true) {
                return null;
            }
            knownIds[desktopId] = true;
            ids.push(desktopId);
            objects.push(desktop);
        }

        return ids.length >= 2 ? {
                                   ids,
                                   objects
                               } : null;
    }

    function sameDesktopSnapshot(snapshot, expectedObjects, expectedIds) {
        if (!snapshot || !expectedObjects || !sameStringList(snapshot.ids, expectedIds)
                || snapshot.objects.length !== expectedObjects.length) {
            return false;
        }
        for (let index = 0; index < expectedObjects.length; index += 1) {
            if (snapshot.objects[index] !== expectedObjects[index]) {
                return false;
            }
        }

        return true;
    }

    function sameStringList(first, second) {
        if (!first || !second || first.length !== second.length) {
            return false;
        }
        for (let index = 0; index < first.length; index += 1) {
            if (first[index] !== second[index]) {
                return false;
            }
        }

        return true;
    }

    function collectNavigationTargets() {
        const targets = [];
        for (let cardIndex = 0; cardIndex < desktopRepeater.count; cardIndex += 1) {
            const desktopCard = desktopRepeater.itemAt(cardIndex);
            if (!desktopCard) {
                continue;
            }

            const cardTargets = desktopCard.collectNavigationTargets(root);
            for (const target of cardTargets) {
                targets.push(target);
            }
        }

        return targets;
    }

    function navigateKeyboardSelection(direction) {
        const targets = collectNavigationTargets();
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewNavigationTarget(keyboardSelectionId, targets, direction);
            if (typeof targetId === "string" && navigationTargetForId(targets, targetId)) {
                keyboardSelectionId = targetId;
            }
        } catch (error) {
            return;
        }
    }

    function activateKeyboardSelection() {
        const targets = collectNavigationTargets();
        const target = navigationTargetForId(targets, keyboardSelectionId);
        if (!target) {
            repairKeyboardSelectionFrom(targets);
            return;
        }

        if (target.kind === "desktop") {
            selectDesktop(target.candidate, target.desktopId, target.screen);
        } else if (target.kind === "window") {
            focusWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen);
        } else {
            repairKeyboardSelectionFrom(targets);
        }
    }

    function repairKeyboardSelection() {
        repairKeyboardSelectionFrom(collectNavigationTargets());
    }

    function repairKeyboardSelectionFrom(targets) {
        if (navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const preferred = preferredInitialNavigationTarget(targets);
        keyboardSelectionId = preferred ? preferred.id : "";
    }

    function preferredInitialNavigationTarget(targets) {
        const activeWindow = KWin.Workspace.activeWindow;
        const activeDesktopId = currentDesktop ? String(currentDesktop.id) : "";
        let firstActive = null;
        let firstCurrentDesktop = null;
        let firstVisual = null;

        for (const target of targets) {
            if (target.kind === "window" && target.candidate === activeWindow) {
                if (target.desktopId === activeDesktopId) {
                    return target;
                }
                if (!firstActive || navigationTargetPrecedes(target, firstActive)) {
                    firstActive = target;
                }
            }
            if (target.kind === "window" && target.desktopId === activeDesktopId
                    && (!firstCurrentDesktop || navigationTargetPrecedes(target, firstCurrentDesktop))) {
                firstCurrentDesktop = target;
            }
            if (!firstVisual || navigationTargetPrecedes(target, firstVisual)) {
                firstVisual = target;
            }
        }

        return firstActive || firstCurrentDesktop || firstVisual;
    }

    function navigationTargetPrecedes(candidate, current) {
        if (candidate.rect.y !== current.rect.y) {
            return candidate.rect.y < current.rect.y;
        }
        if (candidate.rect.x !== current.rect.x) {
            return candidate.rect.x < current.rect.x;
        }

        return candidate.id < current.id;
    }

    function navigationTargetForId(targets, targetId) {
        if (typeof targetId !== "string" || targetId.length === 0) {
            return null;
        }

        let match = null;
        for (const target of targets) {
            if (target.id !== targetId) {
                continue;
            }
            if (match) {
                return null;
            }
            match = target;
        }

        return match;
    }

    function appendSearchText(input) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.appendOverviewSearchText !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.appendOverviewSearchText(current, input);
            if (typeof next === "string") {
                searchQuery = next;
            }
        } catch (error) {
            return;
        }
    }

    function removeLastSearchCharacter() {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.removeLastOverviewSearchCharacter !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.removeLastOverviewSearchCharacter(current);
            if (typeof next === "string") {
                searchQuery = next;
            }
        } catch (error) {
            return;
        }
    }

    function isPrintableSearchText(input) {
        if (typeof input !== "string" || input.length === 0) {
            return false;
        }

        for (const character of input) {
            const codePoint = character.codePointAt(0);
            if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) {
                return false;
            }
        }

        return true;
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

    function moveWindowToDesktop(candidate, expectedWindowId, expectedSourceDesktop, expectedSourceDesktopId,
                                 expectedTargetDesktop, expectedTargetDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
        const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
        const currentActivity = KWin.Workspace.currentActivity;
        const expectedActivityId = currentActivity === undefined || currentActivity === null ? ""
                                                                                              : String(currentActivity);
        if (!windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveSourceDesktop,
                                                       expectedSourceDesktopId, expectedActivityId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowDesktopDrop !== "function") {
            return;
        }

        let accepted = false;
        try {
            accepted = runtime.planOverviewWindowDesktopDrop(model, {
                                                                 outputId: expectedOutputId,
                                                                 sourceDesktopId: expectedSourceDesktopId,
                                                                 targetDesktopId: expectedTargetDesktopId,
                                                                 windowId: expectedWindowId
                                                             }) === true;
        } catch (error) {
            return;
        }
        if (!accepted || !windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                                        liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                                        expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveSourceDesktop,
                                                       expectedSourceDesktopId, expectedActivityId)) {
            return;
        }

        try {
            candidate.desktops = [liveTargetDesktop];
        } catch (error) {
            return;
        }

        if (!windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, liveTargetDesktop,
                                                       expectedTargetDesktopId, expectedActivityId)
                || windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId)) {
            return;
        }
        effect.deactivate();
    }

    function windowDesktopDropSceneIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                           liveSourceDesktop, expectedSourceDesktopId, liveTargetDesktop,
                                           expectedTargetDesktopId) {
        return liveSourceDesktop !== liveTargetDesktop && expectedSourceDesktopId !== expectedTargetDesktopId
                && desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                         liveSourceDesktop, expectedSourceDesktopId)
                && desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId,
                                         liveTargetDesktop, expectedTargetDesktopId);
    }

    function windowDesktopDropCandidateIsExact(candidate, expectedWindowId, liveScreen, expectedDesktop,
                                               expectedDesktopId, expectedActivityId) {
        if (!candidate || candidate.deleted || candidate.minimized || candidate.wantsInput !== true
                || candidate.normalWindow !== true || candidate.managed !== true || candidate.moveable !== true
                || candidate.modal !== false || candidate.internalId === undefined || candidate.internalId === null
                || expectedWindowId.length === 0
                || String(candidate.internalId) !== expectedWindowId || candidate.output !== liveScreen
                || expectedActivityId.length === 0
                || String(KWin.Workspace.currentActivity) !== expectedActivityId
                || !windowUsesActivity(candidate, expectedActivityId) || candidate.transient !== false
                || candidate.transientFor !== null) {
            return false;
        }

        const desktops = candidate.desktops;
        return desktops && desktops.length === 1 && desktops[0] === expectedDesktop
                && String(desktops[0].id) === expectedDesktopId;
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
        resetDesktopReorder();
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
