// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

#pragma once

#include "shortcuttypes.h"

#include <QDBusConnection>
#include <QList>
#include <QString>

class ShortcutBackend
{
public:
    struct LoadResult
    {
        QList<ShortcutAction> actions;
        QString componentUniqueName;
        QString error;

        [[nodiscard]] bool succeeded() const
        {
            return error.isEmpty();
        }
    };

    struct OperationResult
    {
        QString error;

        [[nodiscard]] bool succeeded() const
        {
            return error.isEmpty();
        }
    };

    explicit ShortcutBackend(QDBusConnection connection = QDBusConnection::sessionBus());

    [[nodiscard]] LoadResult loadActions() const;
    [[nodiscard]] OperationResult validate(const QList<ShortcutAction> &actions) const;
    [[nodiscard]] OperationResult apply(const QList<ShortcutAction> &actions) const;

private:
    struct Mutation
    {
        ShortcutAction action;
        QList<QKeySequence> before;
        QList<QKeySequence> after;
    };

    [[nodiscard]] QList<QKeySequence> shortcutKeys(const QStringList &actionId, QString *error) const;
    [[nodiscard]] bool setShortcutKeys(
        const QStringList &actionId,
        const QList<QKeySequence> &shortcuts,
        QString *error) const;
    [[nodiscard]] QString rollback(const QList<Mutation> &mutations) const;

    QDBusConnection m_connection;
};
