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

    signal desktopTapped(var candidate, string expectedDesktopId, var expectedScreen)
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
    readonly property var tiledPlacements: buildTiledPlacements()
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

                        readonly property var memberFrame:
                            card.tiledPlacements[columnShell.modelData.members[index].windowId]

                        anchors.left: parent.left
                        anchors.right: parent.right
                        y: memberFrame ? memberFrame.y : 0
                        height: memberFrame ? memberFrame.height : 0
                        color: "transparent"
                        border.width: 1
                        border.color: "#304057"
                    }
                }
            }
        }

        Repeater {
            model: KWin.WindowFilterModel {
                activity: KWin.Workspace.currentActivity
                desktop: card.desktop
                screenName: card.screen ? String(card.screen.name) : ""
                windowModel: KWin.WindowModel {}
                minimizedWindows: false
                windowType: ~KWin.WindowFilterModel.Dock & ~KWin.WindowFilterModel.Desktop &
                            ~KWin.WindowFilterModel.Notification & ~KWin.WindowFilterModel.CriticalNotification
            }

            Item {
                id: thumbnailShell

                readonly property string windowId: model.window ? String(model.window.internalId) : ""
                readonly property var frame: card.frameForWindow(model.window, windowId)

                x: frame ? frame.x : 0
                y: frame ? frame.y : 0
                width: frame ? Math.max(1, frame.width) : 0
                height: frame ? Math.max(1, frame.height) : 0
                visible: frame !== null && frame !== undefined && model.window && !model.window.minimized
                z: frame && frame.floating ? 1000 + index : 100 + index
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

                TapHandler {
                    acceptedButtons: Qt.LeftButton
                    acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                    enabled: thumbnailShell.visible && card.desktop && card.screen
                    onTapped: card.windowTapped(model.window, thumbnailShell.windowId, card.desktop, card.desktopId,
                                                card.screen)
                }
            }
        }
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

    function buildTiledPlacements() {
        const placements = Object.create(null);
        if (!context || !screen) {
            return placements;
        }

        const gap = Math.max(2, Math.min(8, contentWidth * 0.008));
        let columnX = -context.viewportOffset * horizontalScale;

        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
            const column = columns[columnIndex];
            const columnWidth = widthForColumn(column.width);
            const memberHeights = column.presentation === "tabbed"
                ? [contentHeight]
                : heightsForMembers(column.members);
            let memberY = 0;

            for (let memberIndex = 0; memberIndex < column.members.length; memberIndex += 1) {
                const member = column.members[memberIndex];
                const memberHeight = memberHeights[memberIndex];
                placements[member.windowId] = {
                    floating: false,
                    height: Math.max(1, memberHeight - gap),
                    width: Math.max(1, columnWidth - gap),
                    x: columnX + gap / 2,
                    y: memberY + gap / 2
                };
                memberY += memberHeight;
            }

            columnX += columnWidth;
        }

        return placements;
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
        const tiled = tiledPlacements[windowId];
        if (tiled !== undefined) {
            return tiled;
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
