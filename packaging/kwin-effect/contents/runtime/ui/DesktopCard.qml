import QtQuick
import org.kde.kwin as KWin

Rectangle {
    id: card

    required property var context
    required property bool current
    required property var desktop
    required property string desktopId
    required property var floatingWindows
    required property var screen
    property string keyboardSelectionId: ""

    signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)
    signal navigationTargetsChanged()
    signal windowTapped(var candidate, string expectedWindowId, var expectedDesktop, string expectedDesktopId,
                        var expectedScreen)

    readonly property var columns: context ? context.columns : []
    readonly property real contentLeft: 42
    readonly property real contentTop: 10
    readonly property real contentWidth: Math.max(1, width - contentLeft - 10)
    readonly property real contentHeight: Math.max(1, height - contentTop * 2)
    readonly property real horizontalScale: screen && screen.geometry.width > 0 ? contentWidth / screen.geometry.width :
                                                                                  1
    readonly property real verticalScale: screen && screen.geometry.height > 0 ? contentHeight / screen.geometry.height :
                                                                                 1
    readonly property var tiledPresentations: buildTiledPresentations()
    readonly property var floatingWindowIds: buildFloatingWindowIds()

    color: current ? "#f02b3548" : "#dc171e2a"
    border.width: current ? 2 : 1
    border.color: current ? "#a8c7ff" : "#526179"
    radius: 8
    clip: true

    Item {
        id: numberGutter

        width: card.contentLeft
        height: card.height

        Text {
            x: 12
            anchors.verticalCenter: parent.verticalCenter
            width: numberGutter.width - 18
            text: String(card.indexOfDesktop(card.desktopId) + 1)
            color: card.current ? "#f3f7ff" : "#b6c1d2"
            font.bold: card.current
            font.pixelSize: Math.max(12, Math.min(20, card.height * 0.2))
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
        }

        TapHandler {
            acceptedButtons: Qt.LeftButton
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            enabled: !card.current && card.desktop && card.screen
            onTapped: card.desktopTapped(card.desktop, card.desktopId, card.screen)
        }
    }

    Item {
        id: viewport

        x: card.contentLeft
        y: card.contentTop
        width: card.contentWidth
        height: card.contentHeight
        clip: true

        Repeater {
            model: card.columns

            Rectangle {
                id: columnShell

                required property var modelData
                required property int index

                readonly property var frame: card.columnFrame(index)

                x: frame.x
                y: 0
                width: frame.width
                height: viewport.height
                color: "#351e2938"
                border.width: card.context && card.context.activeColumnIndex === index ? 2 : 1
                border.color: card.context && card.context.activeColumnIndex === index ? "#9fc2ff" : "#45536a"
                radius: 4

                Repeater {
                    model: modelData.members

                    Rectangle {
                        required property int index

                        readonly property var memberPresentation:
                            card.tiledPresentations[columnShell.modelData.members[index].windowId]
                        readonly property var memberFrame: memberPresentation ? memberPresentation.thumbnailFrame : null

                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: memberFrame ? memberFrame.y : 0
                        height: memberFrame ? memberFrame.height : 0
                        visible: memberFrame !== null
                        color: "transparent"
                        border.width: 1
                        border.color: "#304057"
                    }
                }
            }
        }

        Repeater {
            id: windowRepeater

            model: KWin.WindowFilterModel {
                activity: KWin.Workspace.currentActivity
                desktop: card.desktop
                screenName: card.screen ? String(card.screen.name) : ""
                windowModel: KWin.WindowModel {}
                minimizedWindows: true
                windowType: ~KWin.WindowFilterModel.Dock & ~KWin.WindowFilterModel.Desktop &
                            ~KWin.WindowFilterModel.Notification & ~KWin.WindowFilterModel.CriticalNotification
            }

            onItemAdded: card.navigationTargetsChanged()
            onItemRemoved: card.navigationTargetsChanged()

            Item {
                id: windowPresentation

                readonly property var candidate: model.window
                readonly property string windowId: model.window ? String(model.window.internalId) : ""
                readonly property var tiledPresentation: card.tiledPresentations[windowId]
                readonly property var frame: card.frameForWindow(model.window, windowId)
                readonly property bool selectedThumbnail: !tiledPresentation || tiledPresentation.selected
                readonly property bool minimizedWindow: model.window ? model.window.minimized : false
                readonly property var thumbnailTarget: thumbnailShell
                readonly property var tabTarget: tabShell

                width: viewport.width
                height: viewport.height
                z: frame && frame.floating ? 1000 + index : 100 + index

                onCandidateChanged: card.navigationTargetsChanged()

                Connections {
                    target: windowPresentation.candidate
                    ignoreUnknownSignals: true

                    function onDeletedChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onFrameGeometryChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onMinimizedChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onOutputChanged() {
                        card.navigationTargetsChanged();
                    }

                    function onWantsInputChanged() {
                        card.navigationTargetsChanged();
                    }
                }

                Item {
                    id: thumbnailShell

                    readonly property bool keyboardTarget: !windowPresentation.tiledPresentation
                        || windowPresentation.tiledPresentation.selected
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)

                    x: windowPresentation.frame ? windowPresentation.frame.x : 0
                    y: windowPresentation.frame ? windowPresentation.frame.y : 0
                    width: windowPresentation.frame ? Math.max(1, windowPresentation.frame.width) : 0
                    height: windowPresentation.frame ? Math.max(1, windowPresentation.frame.height) : 0
                    visible: windowPresentation.selectedThumbnail && windowPresentation.frame !== null
                             && windowPresentation.frame !== undefined && model.window
                             && !windowPresentation.minimizedWindow
                    clip: true

                    Rectangle {
                        anchors.fill: parent
                        color: "#131a25"
                    }

                    KWin.WindowThumbnail {
                        anchors.fill: parent
                        wId: model.window.internalId
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: KWin.Workspace.activeWindow === model.window ? 2 : 1
                        border.color: KWin.Workspace.activeWindow === model.window ? "#f4f8ff" : "#71839e"
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: thumbnailShell.keyboardSelected ? 3 : 0
                        border.color: "#ffd166"
                        z: 1
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: thumbnailShell.visible && card.desktop && card.screen
                        onTapped: card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                                    card.desktopId, card.screen)
                    }
                }

                Rectangle {
                    id: tabShell

                    readonly property var frame: windowPresentation.tiledPresentation
                        ? windowPresentation.tiledPresentation.tabFrame : null
                    readonly property bool keyboardTarget: windowPresentation.tiledPresentation
                        && !windowPresentation.tiledPresentation.selected
                    readonly property bool keyboardSelected: keyboardTarget
                        && card.keyboardSelectionId === card.navigationTargetId(windowPresentation.windowId)

                    x: frame ? frame.x : 0
                    y: frame ? frame.y : 0
                    width: frame ? frame.width : 0
                    height: frame ? frame.height : 0
                    visible: frame !== null && model.window
                    opacity: windowPresentation.minimizedWindow ? 0.6 : 1
                    color: windowPresentation.minimizedWindow ? "#252e3d"
                                                               : windowPresentation.tiledPresentation
                                                                 && windowPresentation.tiledPresentation.selected
                                                                 ? "#7085a8" : "#34435a"
                    border.width: 1
                    border.color: windowPresentation.minimizedWindow ? "#536176"
                                                                     : windowPresentation.tiledPresentation
                                                                       && windowPresentation.tiledPresentation.selected
                                                                       ? "#f4f8ff" : "#71839e"
                    radius: 2
                    clip: true

                    Text {
                        anchors.fill: parent
                        anchors.leftMargin: 4
                        anchors.rightMargin: 4
                        text: model.window && model.window.caption ? String(model.window.caption)
                                                                   : windowPresentation.tiledPresentation
                                                                     ? String(windowPresentation.tiledPresentation.memberIndex + 1)
                                                                     : ""
                        color: windowPresentation.minimizedWindow ? "#8a96a8" : "#f3f7ff"
                        font.pixelSize: Math.max(8, Math.min(12, tabShell.height * 0.55))
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        elide: Text.ElideRight
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "transparent"
                        border.width: tabShell.keyboardSelected ? 3 : 0
                        border.color: "#ffd166"
                        radius: tabShell.radius
                        z: 1
                    }

                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                        enabled: tabShell.visible && windowPresentation.tiledPresentation
                                 && !windowPresentation.tiledPresentation.selected
                                 && !windowPresentation.minimizedWindow && card.desktop && card.screen
                        onTapped: card.windowTapped(model.window, windowPresentation.windowId, card.desktop,
                                                    card.desktopId, card.screen)
                    }
                }
            }
        }
    }

    function collectNavigationTargets(sceneItem) {
        const targets = [];
        if (!sceneItem || !desktop || !screen) {
            return targets;
        }

        for (let index = 0; index < windowRepeater.count; index += 1) {
            const presentation = windowRepeater.itemAt(index);
            if (!presentation || !windowIsActionable(presentation.candidate)) {
                continue;
            }

            const visual = presentation.tiledPresentation && !presentation.tiledPresentation.selected
                ? presentation.tabTarget
                : presentation.thumbnailTarget;
            const rect = clippedNavigationRect(visual, sceneItem);
            if (!rect) {
                continue;
            }

            targets.push({
                candidate: presentation.candidate,
                desktop,
                desktopId,
                id: navigationTargetId(presentation.windowId),
                rect,
                screen,
                window: presentation.candidate,
                windowId: presentation.windowId
            });
        }

        return targets;
    }

    function navigationTargetId(windowId) {
        return JSON.stringify([desktopId, windowId]);
    }

    function windowIsActionable(candidate) {
        return candidate && !candidate.deleted && !candidate.minimized && candidate.wantsInput === true
                && candidate.output === screen && candidate.internalId !== undefined && candidate.internalId !== null
                && String(candidate.internalId).length > 0;
    }

    function clippedNavigationRect(visual, sceneItem) {
        if (!visual || !visual.visible || visual.width <= 0 || visual.height <= 0 || !viewport.visible || !card.visible) {
            return null;
        }

        try {
            let rect = plainRect(visual.mapToItem(sceneItem, 0, 0, visual.width, visual.height));
            rect = intersectRects(rect, plainRect(viewport.mapToItem(sceneItem, 0, 0, viewport.width, viewport.height)));
            rect = intersectRects(rect, plainRect(card.mapToItem(sceneItem, 0, 0, card.width, card.height)));
            rect = intersectRects(rect, {
                height: sceneItem.height,
                width: sceneItem.width,
                x: 0,
                y: 0
            });
            return rect && rect.width > 0 && rect.height > 0 ? rect : null;
        } catch (error) {
            return null;
        }
    }

    function intersectRects(first, second) {
        if (!first || !second) {
            return null;
        }

        const left = Math.max(first.x, second.x);
        const top = Math.max(first.y, second.y);
        const right = Math.min(first.x + first.width, second.x + second.width);
        const bottom = Math.min(first.y + first.height, second.y + second.height);
        if (right <= left || bottom <= top) {
            return null;
        }

        return {
            height: bottom - top,
            width: right - left,
            x: left,
            y: top
        };
    }

    function plainRect(rect) {
        return {
            height: Number(rect.height),
            width: Number(rect.width),
            x: Number(rect.x),
            y: Number(rect.y)
        };
    }

    function indexOfDesktop(id) {
        const desktops = KWin.Workspace.desktops;
        for (let index = 0; index < desktops.length; index += 1) {
            if (String(desktops[index].id) === id) {
                return index;
            }
        }

        return 0;
    }

    function buildTiledPresentations() {
        const presentations = Object.create(null);
        if (!context || !screen) {
            return presentations;
        }

        const gap = Math.max(2, Math.min(8, contentWidth * 0.008));
        let columnX = -context.viewportOffset * horizontalScale;

        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
            const column = columns[columnIndex];
            const columnWidth = widthForColumn(column.width);
            const tabbed = column.presentation === "tabbed";
            const memberHeights = tabbed ? [] : heightsForMembers(column.members);
            const tabStripHeight = tabbed ? boundedTabStripHeight() : 0;
            const tabWidth = tabbed ? Math.max(1, columnWidth - gap) / Math.max(1, column.members.length) : 0;
            const stripBodyGap = gap;
            const tabHeight = Math.max(1, tabStripHeight - stripBodyGap);
            const thumbnailY = tabbed ? tabStripHeight + stripBodyGap / 2 : gap / 2;
            const tabbedThumbnailHeight = Math.max(1, contentHeight - thumbnailY - gap / 2);
            let memberY = 0;

            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const memberHeight = tabbed ? contentHeight : memberHeights[memberIndex];
                const selected = !tabbed || memberIndex === column.selectedMemberIndex;
                presentations[member.windowId] = {
                    memberIndex,
                    selected,
                    tabFrame: tabbed ? {
                        height: tabHeight,
                        width: tabWidth,
                        x: columnX + gap / 2 + tabWidth * memberIndex,
                        y: gap / 2
                    } : null,
                    thumbnailFrame: selected ? {
                        floating: false,
                        height: tabbed ? tabbedThumbnailHeight : Math.max(1, memberHeight - gap),
                        width: Math.max(1, columnWidth - gap),
                        x: columnX + gap / 2,
                        y: tabbed ? thumbnailY : memberY + gap / 2
                    } : null
                };
                memberY += memberHeight;
            }

            columnX += columnWidth;
        }

        return presentations;
    }

    function boundedTabStripHeight() {
        return Math.max(1, Math.min(28, contentHeight * 0.16));
    }

    function buildFloatingWindowIds() {
        const ids = Object.create(null);
        for (const floatingWindow of floatingWindows) {
            ids[floatingWindow.windowId] = true;
        }
        return ids;
    }

    function columnFrame(columnIndex) {
        if (!context || columnIndex < 0 || columnIndex >= columns.length) {
            return {
                width: 0,
                x: 0
            };
        }

        let x = -context.viewportOffset * horizontalScale;
        for (let index = 0; index < columnIndex; index += 1) {
            x += widthForColumn(columns[index].width);
        }

        return {
            width: widthForColumn(columns[columnIndex].width),
            x
        };
    }

    function widthForColumn(width) {
        if (width.kind === "fixed") {
            return Math.max(1, width.value * horizontalScale);
        }

        return Math.max(1, width.value * contentWidth);
    }

    function heightsForMembers(members) {
        const targets = [];
        const autoWeights = [];
        let fixedTotal = 0;
        let autoWeightTotal = 0;

        for (const member of members) {
            const height = member.height;
            if (!height || height.kind === "auto") {
                const weight = height ? Math.max(0.01, height.weight) : 1;
                targets.push(0);
                autoWeights.push(weight);
                autoWeightTotal += weight;
                continue;
            }

            const target = height.kind === "fixed" ? Math.max(1, height.clientHeight * verticalScale) : presetHeight(
                                                         height.index, members.length);
            targets.push(target);
            autoWeights.push(0);
            fixedTotal += target;
        }

        const fixedScale = fixedTotal > contentHeight ? contentHeight / fixedTotal : 1;
        const remaining = Math.max(0, contentHeight - fixedTotal * fixedScale);
        const heights = [];

        for (let index = 0; index < members.length; index += 1) {
            const weight = autoWeights[index];
            heights.push(weight > 0 && autoWeightTotal > 0 ? remaining * weight / autoWeightTotal : targets[index]
                                                             * fixedScale);
        }

        return heights;
    }

    function presetHeight(index, memberCount) {
        if (index === 0) {
            return contentHeight / 3;
        }
        if (index === 1) {
            return contentHeight / 2;
        }
        if (index === 2) {
            return contentHeight * 2 / 3;
        }

        return contentHeight / Math.max(1, memberCount);
    }

    function frameForWindow(window, windowId) {
        const tiled = tiledPresentations[windowId];
        if (tiled !== undefined) {
            return tiled.thumbnailFrame;
        }
        if (!window || floatingWindowIds[windowId] !== true || !screen) {
            return null;
        }

        const geometry = window.frameGeometry;
        const screenGeometry = screen.geometry;
        return {
            floating: true,
            height: geometry.height * verticalScale,
            width: geometry.width * horizontalScale,
            x: (geometry.x - screenGeometry.x) * horizontalScale,
            y: (geometry.y - screenGeometry.y) * verticalScale
        };
    }
}
