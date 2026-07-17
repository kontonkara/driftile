pragma ComponentBehavior: Bound

import QtQuick

Rectangle {
    id: root

    required property var labelPlan

    readonly property string label: boundedLabel(labelPlan)

    implicitWidth: Math.min(240, Math.max(96, outputIdentityText.implicitWidth + 20))
    implicitHeight: 28
    visible: label.length > 0
    color: "#dc111824"
    border.width: 1
    border.color: "#a06f829f"
    radius: 5

    Text {
        id: outputIdentityText

        anchors.fill: parent
        anchors.leftMargin: 10
        anchors.rightMargin: 10
        text: root.label
        textFormat: Text.PlainText
        color: "#f3f7ff"
        font.bold: true
        font.pixelSize: 11
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    function boundedLabel(plan) {
        try {
            if (!plan || Array.isArray(plan) || typeof plan !== "object"
                    || typeof plan.label !== "string" || plan.label.length === 0 || plan.label.length > 128) {
                return "";
            }

            let codePoints = 0;
            for (const character of plan.label) {
                codePoints += 1;
                if (codePoints > 64) {
                    return "";
                }
            }

            return plan.label;
        } catch (error) {
            return "";
        }
    }
}
