// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#include "wheelcontroleffect.h"

#include <effect/effecthandler.h>

#include <QAction>
#include <QDBusConnection>
#include <QDBusMessage>

#include <utility>

namespace KWin
{

namespace
{

const QString FocusPreviousDesktop = QStringLiteral("driftile_focus_previous_desktop");
const QString FocusNextDesktop = QStringLiteral("driftile_focus_next_desktop");
const QString MoveColumnToPreviousDesktop = QStringLiteral("driftile_move_column_to_previous_desktop");
const QString MoveColumnToNextDesktop = QStringLiteral("driftile_move_column_to_next_desktop");
const QString FocusColumnLeft = QStringLiteral("driftile_focus_column_left");
const QString FocusColumnRight = QStringLiteral("driftile_focus_column_right");
const QString MoveColumnLeft = QStringLiteral("driftile_move_column_left");
const QString MoveColumnRight = QStringLiteral("driftile_move_column_right");

} // namespace

WheelControlEffect::WheelControlEffect()
{
    registerWorkspaceAxisShortcut(
        Qt::MetaModifier,
        PointerAxisUp,
        FocusPreviousDesktop,
        WorkspaceCooldownLane::Focus,
        WorkspaceDirection::Previous);
    registerWorkspaceAxisShortcut(
        Qt::MetaModifier,
        PointerAxisDown,
        FocusNextDesktop,
        WorkspaceCooldownLane::Focus,
        WorkspaceDirection::Next);
    registerWorkspaceAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier,
        PointerAxisUp,
        MoveColumnToPreviousDesktop,
        WorkspaceCooldownLane::MoveColumn,
        WorkspaceDirection::Previous);
    registerWorkspaceAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier,
        PointerAxisDown,
        MoveColumnToNextDesktop,
        WorkspaceCooldownLane::MoveColumn,
        WorkspaceDirection::Next);

    registerImmediateAxisShortcut(Qt::MetaModifier, PointerAxisLeft, FocusColumnLeft);
    registerImmediateAxisShortcut(Qt::MetaModifier, PointerAxisRight, FocusColumnRight);
    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier,
        PointerAxisLeft,
        MoveColumnLeft);
    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier,
        PointerAxisRight,
        MoveColumnRight);

    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ShiftModifier,
        PointerAxisUp,
        FocusColumnLeft);
    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ShiftModifier,
        PointerAxisDown,
        FocusColumnRight);
    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier | Qt::ShiftModifier,
        PointerAxisUp,
        MoveColumnLeft);
    registerImmediateAxisShortcut(
        Qt::MetaModifier | Qt::ControlModifier | Qt::ShiftModifier,
        PointerAxisDown,
        MoveColumnRight);
}

void WheelControlEffect::registerImmediateAxisShortcut(
    Qt::KeyboardModifiers modifiers,
    PointerAxisDirection axis,
    QString actionId)
{
    auto *action = new QAction(this);
    action->setObjectName(QStringLiteral("driftile_wheel_control_") + actionId);
    connect(action, &QAction::triggered, this, [actionId = std::move(actionId)]() {
        invokeShortcut(actionId);
    });
    effects->registerAxisShortcut(modifiers, axis, action);
}

void WheelControlEffect::registerWorkspaceAxisShortcut(
    Qt::KeyboardModifiers modifiers,
    PointerAxisDirection axis,
    QString actionId,
    WorkspaceCooldownLane lane,
    WorkspaceDirection direction)
{
    auto *action = new QAction(this);
    action->setObjectName(QStringLiteral("driftile_wheel_control_") + actionId);
    connect(action, &QAction::triggered, this, [this, actionId = std::move(actionId), lane, direction]() {
        if (acceptWorkspaceStep(lane, direction)) {
            invokeShortcut(actionId);
        }
    });
    effects->registerAxisShortcut(modifiers, axis, action);
}

bool WheelControlEffect::acceptWorkspaceStep(
    WorkspaceCooldownLane lane,
    WorkspaceDirection direction)
{
    auto &cooldown = m_workspaceCooldowns[static_cast<std::size_t>(lane)];
    if (cooldown.initialized
        && cooldown.direction == direction
        && cooldown.elapsed.elapsed() < WorkspaceCooldownMilliseconds) {
        return false;
    }

    cooldown.direction = direction;
    cooldown.initialized = true;
    cooldown.elapsed.start();
    return true;
}

void WheelControlEffect::invokeShortcut(const QString &actionId)
{
    QDBusMessage message = QDBusMessage::createMethodCall(
        QStringLiteral("org.kde.kglobalaccel"),
        QStringLiteral("/component/kwin"),
        QStringLiteral("org.kde.kglobalaccel.Component"),
        QStringLiteral("invokeShortcut"));
    message.setArguments({actionId});
    static_cast<void>(QDBusConnection::sessionBus().send(message));
}

} // namespace KWin
