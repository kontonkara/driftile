// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#pragma once

#include <effect/effect.h>
#include <effect/globals.h>

#include <QElapsedTimer>
#include <QString>

#include <array>
#include <cstddef>
#include <cstdint>

namespace KWin
{

class WheelControlEffect final : public Effect
{
public:
    explicit WheelControlEffect();

private:
    enum class WorkspaceCooldownLane : std::uint8_t {
        Focus,
        MoveColumn,
        Count,
    };

    enum class WorkspaceDirection : std::int8_t {
        Previous = -1,
        Next = 1,
    };

    struct WorkspaceCooldown
    {
        QElapsedTimer elapsed;
        WorkspaceDirection direction = WorkspaceDirection::Previous;
        bool initialized = false;
    };

    void registerImmediateAxisShortcut(
        Qt::KeyboardModifiers modifiers,
        PointerAxisDirection axis,
        QString actionId);
    void registerWorkspaceAxisShortcut(
        Qt::KeyboardModifiers modifiers,
        PointerAxisDirection axis,
        QString actionId,
        WorkspaceCooldownLane lane,
        WorkspaceDirection direction);
    bool acceptWorkspaceStep(WorkspaceCooldownLane lane, WorkspaceDirection direction);
    static void invokeShortcut(const QString &actionId);

    static constexpr qint64 WorkspaceCooldownMilliseconds = 150;
    static constexpr std::size_t WorkspaceCooldownLaneCount =
        static_cast<std::size_t>(WorkspaceCooldownLane::Count);

    std::array<WorkspaceCooldown, WorkspaceCooldownLaneCount> m_workspaceCooldowns;
};

} // namespace KWin
