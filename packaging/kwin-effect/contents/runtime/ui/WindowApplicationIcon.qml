pragma ComponentBehavior: Bound

import QtQuick
import org.kde.kirigami as Kirigami

Item {
    id: root

    required property var candidate
    required property bool presentationEligible

    readonly property bool iconAvailable: iconLoader.item !== null
        && iconLoader.item.iconAvailable === true
    readonly property bool boundedGeometry: Number.isFinite(root.width) && Number.isFinite(root.height)
        && root.width >= 8 && root.height >= 8 && root.width <= 24 && root.height <= 24

    visible: iconAvailable

    Loader {
        id: iconLoader

        anchors.fill: parent
        active: root.presentationEligible && root.boundedGeometry

        sourceComponent: Component {
            Item {
                id: iconHost

                readonly property var iconSource: root.readCandidateIcon(root.candidate)
                readonly property bool iconAvailable: iconSource !== null

                Kirigami.Icon {
                    anchors.fill: parent
                    source: iconHost.iconSource
                    visible: iconHost.iconAvailable
                }
            }
        }
    }

    function readCandidateIcon(candidate) {
        if (candidate === null || candidate === undefined) {
            return null;
        }

        try {
            const icon = candidate.icon;
            if (icon === null || icon === undefined || typeof icon !== "object" || Array.isArray(icon)) {
                return null;
            }
            return icon;
        } catch (error) {
            return null;
        }
    }
}
