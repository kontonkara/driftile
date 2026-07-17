import QtQuick
import org.kde.kwin as KWin
import "../code/main.js" as OverviewRuntime

Rectangle {
    id: root

    color: sceneEffect && sceneEffect.backdropColor !== undefined
        ? sceneEffect.backdropColor
        : "#e60b0f17"
    focus: true

    readonly property var sceneEffect: KWin.SceneView.effect
    readonly property var targetScreen: KWin.SceneView.screen
    readonly property var currentDesktop: typeof KWin.SceneView.currentDesktop !== "undefined"
        ? KWin.SceneView.currentDesktop
        : KWin.Workspace.currentDesktop
    readonly property var overviewModel: sceneEffect ? sceneEffect.overviewModel : null
    readonly property bool showWindowLabels: sceneEffect && typeof sceneEffect.showWindowLabels === "boolean"
        ? sceneEffect.showWindowLabels
        : true
    readonly property bool showApplicationIdentity: sceneEffect
        && typeof sceneEffect.showApplicationIdentity === "boolean"
        ? sceneEffect.showApplicationIdentity
        : true
    readonly property bool showWindowCloseButtons: sceneEffect
        && typeof sceneEffect.showWindowCloseButtons === "boolean"
        ? sceneEffect.showWindowCloseButtons
        : true
    readonly property bool showWindowStateBadges: sceneEffect
        && typeof sceneEffect.showWindowStateBadges === "boolean"
        ? sceneEffect.showWindowStateBadges
        : true
    readonly property bool showDesktopNames: sceneEffect && typeof sceneEffect.showDesktopNames === "boolean"
        ? sceneEffect.showDesktopNames
        : true
    readonly property bool showApplicationIcons: sceneEffect
        && typeof sceneEffect.showApplicationIcons === "boolean"
        ? sceneEffect.showApplicationIcons
        : true
    readonly property bool showOutputNames: sceneEffect && typeof sceneEffect.showOutputNames === "boolean"
        ? sceneEffect.showOutputNames
        : true
    readonly property var searchQueryPlan: planSearchQuery(searchQuery)
    readonly property bool searchQueryValid: searchQueryPlan !== null
    readonly property bool outputLabelGeometryEligible: width >= 640 && height >= 360
        && searchQuery.length === 0
    readonly property int outputLabelLiveScreenCount: showOutputNames && outputLabelGeometryEligible
        ? liveScreenCountForOutputLabel(targetScreen) : 0
    readonly property bool outputLabelNeeded: searchQuery.length > 0 || outputLabelLiveScreenCount >= 2
    readonly property var outputLabelPlan: outputLabelNeeded ? planOutputLabel(targetScreen) : null
    readonly property string outputName: outputLabelPlan ? outputLabelPlan.label : ""
    readonly property string outputId: outputIdForScreen()
    readonly property var desktopIds: outputId.length > 0 ? orderedDesktopIds() : []
    readonly property real outerMargin: Math.max(20, Math.min(width, height) * 0.035)
    readonly property real cardGap: Math.max(2, Math.min(10, height * 0.012))
    readonly property real cardHeight: desktopIds.length > 0 ? Math.max(1, (height - outerMargin * 2 - cardGap
                                                                            * Math.max(0, desktopIds.length - 1))
                                                                        / desktopIds.length) : 0
    property bool desktopReorderAvailable: false
    property bool emptyDesktopAboveFirst: false
    property string keyboardSelectionId: ""
    property int overviewWheelRemainder: 0
    property string searchQuery: ""
    property int searchResultCount: 0
    property var searchResultCountsByDesktop: Object.create(null)
    property var searchResultOrdinalsByTarget: Object.create(null)
    readonly property int searchResultOrdinal: searchResultOrdinalForTarget(keyboardSelectionId)
    property bool desktopReorderActive: false
    property real desktopReorderCardGap: 0
    property real desktopReorderCardHeight: 0
    property var desktopReorderCurrentDesktop: null
    property string desktopReorderCurrentDesktopId: ""
    property var desktopReorderDesktopIds: []
    property var desktopReorderDesktopObjects: []
    property var desktopReorderEffect: null
    property bool desktopReorderEmptyDesktopAboveFirst: false
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
        const controlOnly = modifiers === Qt.ControlModifier;
        const unmodified = modifiers === Qt.NoModifier;
        const searchTextModifier = unmodified || modifiers === Qt.ShiftModifier;
        let handled = true;
        if (controlOnly && event.key === Qt.Key_Backspace && searchQuery.length > 0) {
            root.removeLastSearchClause();
        } else if (controlOnly && event.key === Qt.Key_U && searchQuery.length > 0) {
            searchQuery = "";
        } else if ((modifiers & forbiddenModifiers) !== Qt.NoModifier) {
            handled = false;
        } else if (unmodified && event.key === Qt.Key_Left) {
            root.navigateKeyboardSelection("left");
        } else if (unmodified && event.key === Qt.Key_Right) {
            root.navigateKeyboardSelection("right");
        } else if (unmodified && event.key === Qt.Key_Up) {
            root.navigateKeyboardSelection("up");
        } else if (unmodified && event.key === Qt.Key_Down) {
            root.navigateKeyboardSelection("down");
        } else if (unmodified && event.key === Qt.Key_Tab) {
            root.navigateKeyboardSequence("next");
        } else if ((modifiers === Qt.ShiftModifier && event.key === Qt.Key_Tab)
                   || event.key === Qt.Key_Backtab) {
            root.navigateKeyboardSequence("previous");
        } else if (unmodified && event.key === Qt.Key_Home) {
            root.navigateKeyboardSequence("first");
        } else if (unmodified && event.key === Qt.Key_End) {
            root.navigateKeyboardSequence("last");
        } else if (unmodified && event.key === Qt.Key_Delete) {
            root.closeKeyboardSelection();
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
        refreshEmptyDesktopBoundarySetting();
        forceActiveFocus();
        Qt.callLater(root.repairKeyboardSelection);
    }

    Connections {
        target: root.sceneEffect
        ignoreUnknownSignals: true

        function onActiveChanged() {
            if (!root.sceneEffect || root.sceneEffect.active !== true) {
                root.overviewWheelRemainder = 0;
                root.searchQuery = "";
            } else {
                root.refreshEmptyDesktopBoundarySetting();
            }
        }

        function onItemDroppedOutOfScreen(globalPosition, source, screen) {
            root.handleCrossOutputWindowDrop(globalPosition, source, screen);
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

    WheelHandler {
        target: null
        acceptedDevices: PointerDevice.Mouse
        acceptedModifiers: Qt.NoModifier
        orientation: Qt.Vertical

        onWheel: event => root.handleOverviewWheel(event)
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
            desktopReorderEnabled: root.desktopReorderAvailable
                                     && root.desktopIds.length > (root.emptyDesktopAboveFirst ? 3 : 2)
                                     && index >= (root.emptyDesktopAboveFirst ? 1 : 0)
                                     && index < root.desktopIds.length - 1
            desktopReorderSource: root.desktopReorderActive && root.desktopReorderSourceId === modelData
            desktopId: modelData
            floatingWindows: root.floatingFor(modelData)
            keyboardSelectionId: root.keyboardSelectionId
            outputName: root.outputName
            searchQuery: root.searchQuery
            searchQueryPlan: root.searchQueryPlan
            searchResultCount: root.searchResultCountForDesktop(modelData)
            screen: root.targetScreen
            showApplicationIdentity: root.showApplicationIdentity
            showApplicationIcons: root.showApplicationIcons
            showWindowCloseButtons: root.showWindowCloseButtons
            showWindowLabels: root.showWindowLabels
            showWindowStateBadges: root.showWindowStateBadges
            showDesktopNames: root.showDesktopNames
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
            onWindowCloseRequested: (candidate, expectedWindowId, expectedDesktop, expectedDesktopId,
                                     expectedScreen) => root.closeWindow(candidate, expectedWindowId,
                                                                          expectedDesktop, expectedDesktopId,
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
            text: !root.searchQueryValid
                ? `Invalid search query: ${root.searchQuery}`
                : root.searchResultCount === 0
                  ? `No matching windows: ${root.searchQuery}`
                : root.searchResultOrdinal > 0
                  ? `${root.searchResultOrdinal}/${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`
                  : `${root.searchResultCount} matching window${root.searchResultCount === 1 ? "" : "s"}: ${root.searchQuery}`
            textFormat: Text.PlainText
            color: "#f3f7ff"
            font.pixelSize: 14
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
    }

    Loader {
        id: outputIdentityLoader

        anchors.top: parent.top
        anchors.right: parent.right
        anchors.topMargin: Math.max(8, root.outerMargin * 0.3)
        anchors.rightMargin: root.outerMargin
        width: item ? item.implicitWidth : 0
        height: item ? item.implicitHeight : 0
        active: root.outputLabelLiveScreenCount >= 2
        z: 19000

        sourceComponent: Component {
            OutputIdentityBadge {
                labelPlan: root.outputLabelPlan
            }
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

        const keepEmptyDesktopAboveFirst = emptyDesktopAboveFirstFromConfig();
        emptyDesktopAboveFirst = keepEmptyDesktopAboveFirst;
        const firstMovableIndex = keepEmptyDesktopAboveFirst ? 1 : 0;

        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(candidate, expectedDesktopId);
        const snapshot = liveDesktopSnapshot();
        const selectedDesktop = currentDesktop;
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !snapshot
                || snapshot.ids.length <= firstMovableIndex + 2
                || !sameStringList(snapshot.ids, desktopIds) || !selectedDesktop
                || String(selectedDesktop.id).length === 0) {
            return;
        }

        const sourceIndex = snapshot.ids.indexOf(expectedDesktopId);
        if (sourceIndex < firstMovableIndex || sourceIndex >= snapshot.ids.length - 1
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
        desktopReorderEmptyDesktopAboveFirst = keepEmptyDesktopAboveFirst;
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
        const keepEmptyDesktopAboveFirst = desktopReorderEmptyDesktopAboveFirst;
        const firstMovableIndex = keepEmptyDesktopAboveFirst ? 1 : 0;
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
            && sourceIndex >= firstMovableIndex && sourceIndex < snapshot.ids.length - 1
            && snapshot.objects[sourceIndex] === source
            && snapshot.ids[sourceIndex] === sourceId;
        const settingUnchanged = keepEmptyDesktopAboveFirst === emptyDesktopAboveFirstFromConfig();
        const canCommit = targetIndex !== null && geometryUnchanged && contextUnchanged && orderUnchanged
            && settingUnchanged
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
        desktopReorderEmptyDesktopAboveFirst = false;
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

        const firstMovableIndex = desktopReorderEmptyDesktopAboveFirst ? 1 : 0;
        const movableCount = desktopReorderDesktopIds.length - 1;
        const stride = desktopReorderCardHeight + desktopReorderCardGap;
        const movableTop = desktopReorderOuterMargin + firstMovableIndex * stride;
        const protectedTop = desktopReorderOuterMargin + movableCount * stride;
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < desktopReorderOuterMargin
                || point.x >= desktopReorderSceneWidth - desktopReorderOuterMargin
                || point.y < movableTop || point.y >= protectedTop) {
            return -1;
        }

        return Math.max(firstMovableIndex,
                        Math.min(movableCount, Math.floor((point.y - desktopReorderOuterMargin
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
                                                                desktopReorderSourceIndex, insertionSlot,
                                                                desktopReorderEmptyDesktopAboveFirst);
            const firstMovableIndex = desktopReorderEmptyDesktopAboveFirst ? 1 : 0;
            return typeof targetIndex === "number" && targetIndex >= firstMovableIndex
                    && targetIndex < desktopReorderDesktopIds.length - 1 && Math.floor(targetIndex) === targetIndex
                ? targetIndex : null;
        } catch (error) {
            return null;
        }
    }

    function refreshEmptyDesktopBoundarySetting() {
        emptyDesktopAboveFirst = emptyDesktopAboveFirstFromConfig();
    }

    function emptyDesktopAboveFirstFromConfig() {
        try {
            const controller = sceneEffect ? sceneEffect.controller : null;
            return controller && typeof controller.emptyDesktopAboveFirstFromConfig === "function"
                ? controller.emptyDesktopAboveFirstFromConfig() === true : false;
        } catch (error) {
            return false;
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

    function navigateKeyboardSequence(direction) {
        const targets = collectNavigationTargets();
        repairKeyboardSelectionFrom(targets);
        if (keyboardSelectionId.length === 0) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.findOverviewSequentialNavigationTarget !== "function") {
            return;
        }

        try {
            const targetId = runtime.findOverviewSequentialNavigationTarget(keyboardSelectionId, targets, direction);
            if (typeof targetId === "string" && navigationTargetForId(targets, targetId)) {
                keyboardSelectionId = targetId;
            }
        } catch (error) {
            return;
        }
    }

    function handleOverviewWheel(event) {
        if (!event) {
            return;
        }
        event.accepted = false;
        if (!sceneEffect || sceneEffect.active !== true || event.modifiers !== Qt.NoModifier
                || !event.angleDelta || !Number.isFinite(event.angleDelta.y) || event.angleDelta.y === 0) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWheelNavigation !== "function") {
            return;
        }

        let plan = null;
        try {
            plan = runtime.planOverviewWheelNavigation(overviewWheelRemainder,
                                                       event.angleDelta.y);
        } catch (error) {
            return;
        }
        if (!plan || !Number.isInteger(plan.remainder) || Math.abs(plan.remainder) >= 120
                || !Number.isInteger(plan.steps) || plan.steps < 0
                || plan.steps > 4
                || (plan.steps === 0 ? plan.direction !== null
                                     : plan.direction !== "next" && plan.direction !== "previous")) {
            return;
        }

        overviewWheelRemainder = plan.remainder;
        for (let step = 0; step < plan.steps; step += 1) {
            navigateKeyboardSequence(plan.direction);
        }
        event.accepted = true;
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

    function closeKeyboardSelection() {
        const targets = collectNavigationTargets();
        const target = navigationTargetForId(targets, keyboardSelectionId);
        if (!target) {
            repairKeyboardSelectionFrom(targets);
            return;
        }
        if (target.kind !== "window") {
            return;
        }

        closeWindow(target.candidate, target.windowId, target.desktop, target.desktopId, target.screen);
    }

    function repairKeyboardSelection() {
        repairKeyboardSelectionFrom(collectNavigationTargets());
    }

    function repairKeyboardSelectionFrom(targets) {
        searchResultCount = 0;
        searchResultCountsByDesktop = Object.create(null);
        searchResultOrdinalsByTarget = Object.create(null);
        if (searchQuery.length > 0 && searchQueryValid) {
            const runtime = OverviewRuntime.DriftileOverview;
            if (runtime && typeof runtime.summarizeOverviewWindowNavigationTargets === "function") {
                try {
                    const summary = runtime.summarizeOverviewWindowNavigationTargets(targets);
                    if (searchSummaryIsValid(summary, targets.length)) {
                        searchResultCount = summary.total;
                        searchResultCountsByDesktop = summary.byDesktop;
                        searchResultOrdinalsByTarget = summary.ordinalByTargetId;
                    }
                } catch (error) {
                    searchResultCount = 0;
                    searchResultCountsByDesktop = Object.create(null);
                    searchResultOrdinalsByTarget = Object.create(null);
                }
            }
        }

        if (navigationTargetForId(targets, keyboardSelectionId)) {
            return;
        }

        const preferred = preferredInitialNavigationTarget(targets);
        keyboardSelectionId = preferred ? preferred.id : "";
    }

    function searchSummaryIsValid(summary, targetCount) {
        if (!summary || !Number.isInteger(summary.total) || summary.total < 0 || summary.total > targetCount
                || !summary.byDesktop || typeof summary.byDesktop !== "object"
                || Array.isArray(summary.byDesktop) || !summary.ordinalByTargetId
                || typeof summary.ordinalByTargetId !== "object" || Array.isArray(summary.ordinalByTargetId)) {
            return false;
        }

        for (const desktopId of Object.keys(summary.byDesktop)) {
            const count = summary.byDesktop[desktopId];
            if (desktopId.length === 0 || !Number.isInteger(count) || count <= 0 || count > summary.total) {
                return false;
            }
        }
        for (const targetId of Object.keys(summary.ordinalByTargetId)) {
            const ordinal = summary.ordinalByTargetId[targetId];
            if (targetId.length === 0 || !Number.isInteger(ordinal) || ordinal <= 0 || ordinal > summary.total) {
                return false;
            }
        }
        return true;
    }

    function searchResultCountForDesktop(desktopId) {
        const counts = searchResultCountsByDesktop;
        if (!counts || typeof desktopId !== "string" || desktopId.length === 0) {
            return 0;
        }

        const count = counts[desktopId];
        return Number.isInteger(count) && count > 0 ? count : 0;
    }

    function searchResultOrdinalForTarget(targetId) {
        const ordinals = searchResultOrdinalsByTarget;
        if (!ordinals || typeof targetId !== "string" || targetId.length === 0) {
            return 0;
        }

        const ordinal = ordinals[targetId];
        return Number.isInteger(ordinal) && ordinal > 0 && ordinal <= searchResultCount ? ordinal : 0;
    }

    function planSearchQuery(query) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowSearchQuery !== "function") {
            return null;
        }

        try {
            return runtime.planOverviewWindowSearchQuery(query);
        } catch (error) {
            return null;
        }
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

    function removeLastSearchClause() {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.removeLastOverviewSearchClause !== "function") {
            return;
        }

        const current = searchQuery;
        try {
            const next = runtime.removeLastOverviewSearchClause(current);
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
        const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;
        if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                   expectedDesktopId) || !windowContextIsExact(candidate, expectedWindowId,
                                                                               liveScreen, liveDesktop,
                                                                               expectedDesktopId,
                                                                               expectedActivityId)
                || !windowFocusStateIsExact(candidate, expectedMinimized, false)
                || (expectedMinimized && candidate.managed !== true)) {
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

        if (expectedMinimized) {
            if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId)
                    || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                             expectedDesktopId, expectedActivityId)
                    || !windowFocusStateIsExact(candidate, true, false) || candidate.managed !== true) {
                return;
            }

            try {
                candidate.minimized = false;
            } catch (error) {
                return;
            }

            if (!desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId)
                    || !windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                             expectedDesktopId, expectedActivityId)
                    || !windowFocusStateIsExact(candidate, false, true) || candidate.managed !== true) {
                return;
            }
        }

        let focusConfirmed = false;
        const selectedDesktop = currentDesktop;
        if (selectedDesktop === liveDesktop && String(selectedDesktop.id) === expectedDesktopId && desktopContextIsExact(
                    effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop, expectedDesktopId)
                && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                        expectedActivityId)
                && windowFocusStateIsExact(candidate, false, true)) {
            try {
                if (KWin.Workspace.activeWindow !== candidate) {
                    KWin.Workspace.activeWindow = candidate;
                }
                focusConfirmed = KWin.Workspace.activeWindow === candidate;
                if (focusConfirmed && expectedMinimized) {
                    focusConfirmed = desktopContextIsExact(effect, model, liveScreen, expectedOutput,
                                                           expectedOutputId, liveDesktop, expectedDesktopId)
                        && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop,
                                               expectedDesktopId, expectedActivityId)
                        && windowFocusStateIsExact(candidate, false, true);
                }
            } catch (error) {
                focusConfirmed = false;
            }
        }

        if (focusConfirmed || (!expectedMinimized && desktopSelectionConfirmed)) {
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
                                  expectedActivityId) {
        return candidate && !candidate.deleted && candidate.wantsInput === true && expectedWindowId.length > 0
                && String(candidate.internalId) === expectedWindowId && candidate.output === liveScreen
                && String(KWin.Workspace.currentActivity) === expectedActivityId
                && windowUsesDesktop(candidate, liveDesktop, expectedDesktopId)
                && windowUsesActivity(candidate, expectedActivityId);
    }

    function windowFocusStateIsExact(candidate, expectedMinimized, rejectHidden) {
        return candidate && candidate.minimized === expectedMinimized && (!rejectHidden || !candidate.hidden);
    }

    function closeWindow(candidate, expectedWindowId, expectedDesktop, expectedDesktopId, expectedScreen) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveScreen = liveScreenFor(expectedScreen);
        const expectedOutput = projectedOutput(model, liveScreen);
        const expectedOutputId = expectedOutput ? String(expectedOutput.outputId) : "";
        const liveDesktop = liveDesktopFor(expectedDesktop, expectedDesktopId);
        const expectedActivityId = String(KWin.Workspace.currentActivity);
        const expectedMinimized = candidate !== null && candidate !== undefined && candidate.minimized === true;
        if (!closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                       expectedMinimized)) {
            return;
        }

        try {
            if (!closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                           expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                           expectedMinimized)) {
                return;
            }
            candidate.closeWindow();
        } catch (error) {
            return;
        }
    }

    function closeWindowContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                       expectedDesktopId, candidate, expectedWindowId, expectedActivityId,
                                       expectedMinimized) {
        return desktopContextIsExact(effect, model, liveScreen, expectedOutput, expectedOutputId, liveDesktop,
                                     expectedDesktopId)
                && windowContextIsExact(candidate, expectedWindowId, liveScreen, liveDesktop, expectedDesktopId,
                                        expectedActivityId)
                && candidate.minimized === expectedMinimized
                && candidate.managed === true && candidate.closeable === true
                && typeof candidate.closeWindow === "function";
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

    function handleCrossOutputWindowDrop(globalPosition, source, expectedTargetScreen) {
        const targetCard = crossOutputDropTargetAt(globalPosition, expectedTargetScreen);
        if (!targetCard || !source) {
            return;
        }

        moveWindowAcrossOutputs(source.candidate, source.windowId, source.sourceDesktop,
                                source.sourceDesktopId, source.sourceScreen, targetCard.desktop,
                                targetCard.desktopId, targetCard.screen, globalPosition);
    }

    function crossOutputDropTargetAt(globalPosition, expectedTargetScreen) {
        const liveTargetScreen = liveScreenFor(expectedTargetScreen);
        if (!globalPosition || !liveTargetScreen || liveTargetScreen !== targetScreen
                || !Number.isFinite(globalPosition.x) || !Number.isFinite(globalPosition.y)) {
            return null;
        }

        let localPosition;
        try {
            localPosition = liveTargetScreen.mapFromGlobal(globalPosition);
        } catch (error) {
            return null;
        }
        if (!localPosition || !Number.isFinite(localPosition.x) || !Number.isFinite(localPosition.y)
                || localPosition.x < 0 || localPosition.y < 0 || localPosition.x >= width
                || localPosition.y >= height) {
            return null;
        }

        let targetCard = null;
        for (let index = 0; index < desktopRepeater.count; index += 1) {
            const candidate = desktopRepeater.itemAt(index);
            if (!candidate || !candidate.visible || candidate.screen !== liveTargetScreen
                    || !candidate.desktop || candidate.desktopId.length === 0) {
                continue;
            }

            let cardPosition;
            try {
                cardPosition = candidate.mapFromItem(root, localPosition.x, localPosition.y);
            } catch (error) {
                return null;
            }
            if (!cardPosition || !Number.isFinite(cardPosition.x) || !Number.isFinite(cardPosition.y)
                    || cardPosition.x < 0 || cardPosition.y < 0 || cardPosition.x >= candidate.width
                    || cardPosition.y >= candidate.height) {
                continue;
            }
            if (targetCard) {
                return null;
            }
            targetCard = candidate;
        }

        return targetCard;
    }

    function moveWindowAcrossOutputs(candidate, expectedWindowId, expectedSourceDesktop,
                                     expectedSourceDesktopId, expectedSourceScreen, expectedTargetDesktop,
                                     expectedTargetDesktopId, expectedTargetScreen, globalPosition) {
        const effect = sceneEffect;
        const model = overviewModel;
        const liveSourceScreen = liveScreenFor(expectedSourceScreen);
        const liveTargetScreen = liveScreenFor(expectedTargetScreen);
        const sourceWorkspaceOutput = candidate ? candidate.output : null;
        const targetWorkspaceOutput = workspaceOutputAt(globalPosition);
        const sourceOutput = projectedOutput(model, liveSourceScreen);
        const targetOutput = projectedOutput(model, liveTargetScreen);
        const sourceOutputId = sourceOutput ? String(sourceOutput.outputId) : "";
        const targetOutputId = targetOutput ? String(targetOutput.outputId) : "";
        const liveSourceDesktop = liveDesktopFor(expectedSourceDesktop, expectedSourceDesktopId);
        const liveTargetDesktop = liveDesktopFor(expectedTargetDesktop, expectedTargetDesktopId);
        const currentActivity = KWin.Workspace.currentActivity;
        const expectedActivityId = currentActivity === undefined || currentActivity === null ? ""
                                                                                              : String(currentActivity);
        const state = {
            candidate,
            effect,
            expectedActivityId,
            expectedWindowId,
            liveSourceDesktop,
            liveSourceScreen,
            liveTargetDesktop,
            liveTargetScreen,
            model,
            sourceDesktopId: expectedSourceDesktopId,
            sourceOutput,
            sourceOutputId,
            sourceWorkspaceOutput,
            targetDesktopId: expectedTargetDesktopId,
            targetGlobalPosition: globalPosition,
            targetOutput,
            targetOutputId,
            targetWorkspaceOutput
        };

        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, sourceWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            return;
        }

        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewWindowDesktopDrop !== "function"
                || typeof KWin.Workspace.sendClientToScreen !== "function") {
            return;
        }

        let accepted = false;
        try {
            accepted = runtime.planOverviewWindowDesktopDrop(model, {
                                                                 sourceDesktopId: expectedSourceDesktopId,
                                                                 sourceOutputId,
                                                                 targetDesktopId: expectedTargetDesktopId,
                                                                 targetOutputId,
                                                                 windowId: expectedWindowId
                                                             }) === true;
        } catch (error) {
            return;
        }
        if (!accepted || !crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, sourceWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            return;
        }

        try {
            KWin.Workspace.sendClientToScreen(candidate, targetWorkspaceOutput);
        } catch (error) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        if (candidate.output !== targetWorkspaceOutput) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, targetWorkspaceOutput,
                                                       liveSourceDesktop, expectedSourceDesktopId,
                                                       expectedActivityId)) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }

        if (liveSourceDesktop !== liveTargetDesktop || expectedSourceDesktopId !== expectedTargetDesktopId) {
            try {
                candidate.desktops = [liveTargetDesktop];
            } catch (error) {
                settleFailedCrossOutputWindowDrop(state);
                return;
            }
        }

        if (!crossOutputDropSceneIsExact(state)
                || !windowDesktopDropCandidateIsExact(candidate, expectedWindowId, targetWorkspaceOutput,
                                                       liveTargetDesktop, expectedTargetDesktopId,
                                                       expectedActivityId)
                || (expectedSourceDesktopId !== expectedTargetDesktopId
                    && windowUsesDesktop(candidate, liveSourceDesktop, expectedSourceDesktopId))) {
            settleFailedCrossOutputWindowDrop(state);
            return;
        }
        effect.deactivate();
    }

    function settleFailedCrossOutputWindowDrop(state) {
        if (!state || !state.candidate) {
            return;
        }
        const sourceStateIsExact = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                     state.sourceWorkspaceOutput,
                                                                     state.liveSourceDesktop,
                                                                     state.sourceDesktopId,
                                                                     state.expectedActivityId);
        if (sourceStateIsExact) {
            if (!crossOutputDropSceneIsExact(state) && state.effect && state.effect === sceneEffect
                    && state.effect.active === true) {
                state.effect.deactivate();
            }
            return;
        }

        compensateCrossOutputWindowDrop(state);
        if (state.effect && state.effect === sceneEffect && state.effect.active === true) {
            state.effect.deactivate();
        }
    }

    function compensateCrossOutputWindowDrop(state) {
        if (!crossOutputDropSceneIsExact(state) || state.candidate.output !== state.targetWorkspaceOutput
                || typeof KWin.Workspace.sendClientToScreen !== "function") {
            return false;
        }

        const atSourceDesktop = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                  state.targetWorkspaceOutput,
                                                                  state.liveSourceDesktop,
                                                                  state.sourceDesktopId,
                                                                  state.expectedActivityId);
        const atTargetDesktop = windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                                  state.targetWorkspaceOutput,
                                                                  state.liveTargetDesktop,
                                                                  state.targetDesktopId,
                                                                  state.expectedActivityId);
        if (!atSourceDesktop && !atTargetDesktop) {
            return false;
        }

        if (!atSourceDesktop) {
            try {
                state.candidate.desktops = [state.liveSourceDesktop];
            } catch (error) {
                return false;
            }
            if (!windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                   state.targetWorkspaceOutput, state.liveSourceDesktop,
                                                   state.sourceDesktopId, state.expectedActivityId)) {
                return false;
            }
        }

        if (!crossOutputDropSceneIsExact(state)) {
            return false;
        }
        try {
            KWin.Workspace.sendClientToScreen(state.candidate, state.sourceWorkspaceOutput);
        } catch (error) {
            return false;
        }

        return windowDesktopDropCandidateIsExact(state.candidate, state.expectedWindowId,
                                                 state.sourceWorkspaceOutput, state.liveSourceDesktop,
                                                 state.sourceDesktopId, state.expectedActivityId);
    }

    function crossOutputDropSceneIsExact(state) {
        if (!state || !state.effect || state.effect !== sceneEffect || state.effect.active !== true || !state.model
                || state.effect.overviewModel !== state.model || overviewModel !== state.model
                || !state.liveSourceScreen || !state.liveTargetScreen
                || state.liveSourceScreen === state.liveTargetScreen || targetScreen !== state.liveTargetScreen
                || liveScreenFor(state.liveSourceScreen) !== state.liveSourceScreen
                || liveScreenFor(state.liveTargetScreen) !== state.liveTargetScreen
                || !workspaceOutputIsLive(state.sourceWorkspaceOutput)
                || !workspaceOutputIsLive(state.targetWorkspaceOutput)
                || state.sourceWorkspaceOutput !== state.liveSourceScreen
                || state.targetWorkspaceOutput !== state.liveTargetScreen
                || state.sourceWorkspaceOutput === state.targetWorkspaceOutput
                || workspaceOutputAt(state.targetGlobalPosition) !== state.targetWorkspaceOutput
                || !state.sourceOutput
                || !state.targetOutput || state.sourceOutput === state.targetOutput
                || state.sourceOutputId.length === 0 || state.targetOutputId.length === 0
                || state.sourceOutputId === state.targetOutputId
                || String(state.sourceOutput.outputId) !== state.sourceOutputId
                || String(state.targetOutput.outputId) !== state.targetOutputId
                || projectedOutput(state.model, state.liveSourceScreen) !== state.sourceOutput
                || projectedOutput(state.model, state.liveTargetScreen) !== state.targetOutput
                || outputId !== state.targetOutputId || !state.liveSourceDesktop || !state.liveTargetDesktop
                || state.sourceDesktopId.length === 0 || state.targetDesktopId.length === 0
                || String(state.liveSourceDesktop.id) !== state.sourceDesktopId
                || String(state.liveTargetDesktop.id) !== state.targetDesktopId
                || liveDesktopFor(state.liveSourceDesktop, state.sourceDesktopId) !== state.liveSourceDesktop
                || liveDesktopFor(state.liveTargetDesktop, state.targetDesktopId) !== state.liveTargetDesktop) {
            return false;
        }

        return true;
    }

    function workspaceOutputAt(globalPosition) {
        if (!globalPosition || !Number.isFinite(globalPosition.x) || !Number.isFinite(globalPosition.y)
                || typeof KWin.Workspace.screenAt !== "function") {
            return null;
        }

        try {
            return KWin.Workspace.screenAt(globalPosition);
        } catch (error) {
            return null;
        }
    }

    function workspaceOutputIsLive(expectedOutput) {
        if (!expectedOutput) {
            return false;
        }

        let matches = 0;
        for (const output of KWin.Workspace.screens) {
            if (output === expectedOutput) {
                matches += 1;
            }
        }
        return matches === 1;
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
                                                                 sourceDesktopId: expectedSourceDesktopId,
                                                                 sourceOutputId: expectedOutputId,
                                                                 targetDesktopId: expectedTargetDesktopId,
                                                                 targetOutputId: expectedOutputId,
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

    function liveScreenCountForOutputLabel(expectedScreen) {
        if (!expectedScreen) {
            return 0;
        }

        try {
            const screens = KWin.Workspace.screens;
            if (!screens || !Number.isInteger(screens.length) || screens.length < 2 || screens.length > 64) {
                return 0;
            }

            let targetMatches = 0;
            for (const screen of screens) {
                if (screen === expectedScreen) {
                    targetMatches += 1;
                }
            }

            return targetMatches === 1 ? screens.length : 0;
        } catch (error) {
            return 0;
        }
    }

    function planOutputLabel(screen) {
        const runtime = OverviewRuntime.DriftileOverview;
        if (!runtime || typeof runtime.planOverviewOutputLabel !== "function") {
            return null;
        }

        try {
            const planned = runtime.planOverviewOutputLabel(screen);
            return planned && !Array.isArray(planned) && typeof planned === "object"
                    && boundedPlainOutputLabel(planned.label) ? planned : null;
        } catch (error) {
            return null;
        }
    }

    function boundedPlainOutputLabel(value) {
        if (typeof value !== "string" || value.length === 0 || value.length > 128) {
            return false;
        }

        let codePoints = 0;
        for (const character of value) {
            codePoints += 1;
            if (codePoints > 64) {
                return false;
            }

            const codePoint = character.codePointAt(0);
            if (codePoint <= 0x1f || codePoint === 0x7f || codePoint >= 0x80 && codePoint <= 0x9f
                    || codePoint === 0x2028 || codePoint === 0x2029) {
                return false;
            }
        }

        return true;
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
